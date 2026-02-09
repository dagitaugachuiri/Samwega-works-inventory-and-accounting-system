const { getFirestore } = require('../config/firebase.config');
const logger = require('../utils/logger');
const { serializeDocs, serializeDoc } = require('../utils/serializer');

class VehicleReportService {
    constructor() {
        this.db = getFirestore();
    }

    /**
     * Calculate multiplier for a given layer index based on packaging structure
     */
    calculateMultiplier(structure, layerIndex) {
        if (!structure) return 1;
        if (Array.isArray(structure)) {
            if (layerIndex >= structure.length) return 1;
            let multiplier = 1;
            for (let i = layerIndex + 1; i < structure.length; i++) {
                multiplier *= (structure[i].qty || 1);
            }
            return multiplier;
        }
        let multiplier = 1;
        if (layerIndex === 0) {
            multiplier = (structure.cartonSize || 1) * (structure.packetSize || 1);
        } else if (layerIndex === 1) {
            multiplier = structure.packetSize || 1;
        }
        return multiplier;
    }

    /**
     * Calculate total stock in hand for a vehicle inventory item using layers
     */
    /**
     * Calculate total stock in hand for a vehicle inventory item using layers
     */
    calculateStockInHand(item, packagingStructure) {
        if (item.stock !== undefined && item.stock !== null) return item.stock; // Legacy or simple stock support

        // If layers exist, calculate from layers
        if (item.layers && item.layers.length > 0) {
            // Need packaging structure to calculate totals
            if (!packagingStructure) return 0;

            let totalStock = 0;
            for (const layer of item.layers) {
                const multiplier = this.calculateMultiplier(packagingStructure, layer.layerIndex);
                totalStock += (layer.quantity || 0) * multiplier;
            }
            return totalStock;
        }
        return 0;
    }

    /**
     * Get Vehicle Inventory Report
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getVehicleInventoryReport(filters = {}) {
        try {
            const { vehicleId } = filters;
            console.log('Generating optimized Vehicle Inventory Report with filters:', filters);

            // 1. Fetch ALL Inventory (Global Cache for performance)
            // This avoids fetching inventory doc for every single item inside the loops
            const allInvSnapshot = await this.db.collection('inventory').get();
            const invMap = new Map();
            allInvSnapshot.forEach(doc => {
                invMap.set(doc.id, { id: doc.id, ...doc.data() });
            });

            // 2. Fetch Vehicles
            let vehiclesQuery = this.db.collection('vehicles').where('isActive', '==', true);
            if (vehicleId) {
                vehiclesQuery = vehiclesQuery.where('__name__', '==', vehicleId);
            }

            const vehiclesSnapshot = await vehiclesQuery.get();
            const vehicles = serializeDocs(vehiclesSnapshot);

            // 3. Process each vehicle
            const reportRows = [];

            for (const vehicle of vehicles) {
                // Get Vehicle Inventory
                const inventorySnapshot = await this.db.collection('vehicle_inventory')
                    .where('vehicleId', '==', vehicle.id)
                    .get();

                const vehicleInventory = serializeDocs(inventorySnapshot);

                if (vehicleInventory.length === 0) {
                    continue; // Skip vehicles with no inventory
                }

                // Batch Fetch Transfers (for this vehicle) - Optimized
                // Instead of querying per item, get all transfers for vehicle and process in memory
                const activeStatuses = ['approved', 'collected', 'partially_collected', 'completed'];
                const transfersSnapshot = await this.db.collection('stock_transfers')
                    .where('vehicleId', '==', vehicle.id)
                    .where('status', 'in', activeStatuses)
                    .orderBy('createdAt', 'desc')
                    .get();

                const vehicleTransfers = serializeDocs(transfersSnapshot);

                // Batch Fetch Sales (for this vehicle) - Optimized
                const salesSnapshot = await this.db.collection('sales')
                    .where('vehicleId', '==', vehicle.id)
                    .where('status', '==', 'completed')
                    .get();

                const vehicleSales = serializeDocs(salesSnapshot);

                // Process each inventory item
                for (const item of vehicleInventory) {
                    // Get Inventory Details from Map
                    const invDetail = invMap.get(item.inventoryId);

                    // Calculate TRUE remaining stock from layers (Sync now)
                    const quantityRemaining = this.calculateStockInHand(item, invDetail?.packagingStructure);

                    // Determine Vehicle Status
                    let vehicleStatus = 'At Warehouse';
                    if (vehicle.assignedUserId && quantityRemaining > 0) {
                        vehicleStatus = 'On Route';
                    }

                    // Find last transfer date for this item (In Memory)
                    let loadedDate = new Date(0); // Default start time
                    const lastTransfer = vehicleTransfers.find(t =>
                        t.items && t.items.some(ti => ti.inventoryId === item.inventoryId)
                    );

                    if (lastTransfer) {
                        loadedDate = new Date(lastTransfer.createdAt);
                    }

                    // Calculate Sold: Sum of sales since loadedDate (In Memory)
                    let quantitySold = 0;
                    let valueSold = 0;

                    vehicleSales.forEach(sale => {
                        const saleDate = sale.saleDate ? new Date(sale.saleDate) : new Date(sale.createdAt);
                        if (saleDate >= loadedDate) {
                            const saleItem = sale.items.find(i => i.inventoryId === item.inventoryId);
                            if (saleItem) {
                                quantitySold += saleItem.quantity || 0;
                                const itemTotal = saleItem.subTotal || ((saleItem.quantity || 0) * (saleItem.unitPrice || 0));
                                valueSold += itemTotal;
                            }
                        }
                    });

                    // Recalculate Loaded: Loaded = Remaining + Sold
                    const quantityLoaded = quantityRemaining + quantitySold;

                    // Get Prices from Map
                    const unitCost = invDetail?.buyingPrice || 0;
                    const minimumPrice = invDetail?.minimumPrice || 0;
                    const sellingPrice = invDetail?.sellingPrice || 0;
                    const itemName = invDetail?.name || item.productName || 'Unknown Item';
                    const itemCategory = invDetail?.category || item.category || 'General';

                    const row = {
                        vehicleId: vehicle.id,
                        vehicleName: vehicle.vehicleName,
                        registrationNumber: vehicle.vehicleNumber,
                        vehicleStatus,
                        stockLoadedDate: loadedDate,
                        itemName,
                        itemCategory,
                        quantityLoaded,
                        quantitySold,
                        quantityRemaining,
                        unitCost,
                        unitSellingPrice: sellingPrice,
                        minimumPrice,
                        totalValueLoaded: quantityLoaded * unitCost,
                        // Value remaining at Minimum Price
                        totalValueRemaining: quantityRemaining * minimumPrice,
                        // Value sold at Actual Sales Amount
                        totalValueSold: valueSold,
                        salesRepresentative: vehicle.assignedUserName || 'Unassigned'
                    };

                    reportRows.push(row);
                }
            }

            // 4. Sorting (Default by Vehicle Name then Item Name)
            reportRows.sort((a, b) => {
                if (a.vehicleName !== b.vehicleName) return a.vehicleName.localeCompare(b.vehicleName);
                return a.itemName.localeCompare(b.itemName);
            });

            // 5. Summary Metrics
            const summary = {
                totalVehiclesTracked: new Set(reportRows.map(r => r.vehicleId)).size,
                totalValueLoadedStock: reportRows.reduce((sum, r) => sum + r.totalValueLoaded, 0),
                totalValueSold: reportRows.reduce((sum, r) => sum + r.totalValueSold, 0),
                totalValueRemaining: reportRows.reduce((sum, r) => sum + r.totalValueRemaining, 0)
            };

            return {
                data: reportRows,
                summary
            };

        } catch (error) {
            logger.error('Get vehicle inventory report error:', error);
            throw error;
        }
    }
}

module.exports = new VehicleReportService();
