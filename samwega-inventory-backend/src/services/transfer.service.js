const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const vehicleService = require('./vehicle.service');
const inventoryService = require('./inventory.service');

class TransferService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'stock_transfers';
        this.vehicleInventoryCollection = 'vehicle_inventory';
        this.breakdownCollection = 'unit_breakdowns';
        this.cachePrefix = 'transfer:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Calculate multiplier for a given layer index based on packaging structure
     * @param {Object|Array} structure
     * @param {number} layerIndex
     * @returns {number}
     */
    calculateMultiplier(structure, layerIndex) {
        if (!structure) return 1;

        // Handle Array Format (New)
        if (Array.isArray(structure)) {
            // If requesting a layer outside bounds, return 1 (base)
            if (layerIndex >= structure.length) return 1;

            let multiplier = 1;
            // Multiplying the 'qty' of all SUBSEQUENT layers
            // structure[i].qty is "how many units of layer i make 1 unit of layer i-1"
            // But for multiplier relative to base unit (last layer), we cascade down.
            // Layer 0 (Carton) -> contains structure[1].qty Boxes. Each Box contains structure[2].qty Pieces.
            // So Multiplier = structure[1].qty * structure[2].qty * ...

            for (let i = layerIndex + 1; i < structure.length; i++) {
                multiplier *= (structure[i].qty || 1);
            }
            return multiplier;
        }

        // Handle Object Format (Legacy)
        let multiplier = 1;
        if (layerIndex === 0) {
            // Carton
            multiplier = (structure.cartonSize || 1) * (structure.packetSize || 1);
        } else if (layerIndex === 1) {
            // Box/Packet
            multiplier = structure.packetSize || 1;
        }
        return multiplier;
    }

    /**
     * Generate transfer number
     * @returns {Promise<string>}
     */
    async generateTransferNumber() {
        const year = new Date().getFullYear();
        const snapshot = await this.db.collection(this.collection)
            .where('transferNumber', '>=', `TRF-${year}-`)
            .where('transferNumber', '<', `TRF-${year + 1}-`)
            .orderBy('transferNumber', 'desc')
            .limit(1)
            .get();

        let nextNumber = 1;
        if (!snapshot.empty) {
            const lastNumber = snapshot.docs[0].data().transferNumber;
            const match = lastNumber.match(/TRF-\d{4}-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        return `TRF-${year}-${String(nextNumber).padStart(3, '0')}`;
    }

    /**
     * Create new stock transfer
     * @param {Object} transferData
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async createTransfer(transferData, userId) {
        try {
            const { vehicleId, items, notes = '' } = transferData;

            // Verify vehicle exists
            const vehicle = await vehicleService.getVehicleById(vehicleId);

            // Get user details
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }
            const userData = userDoc.data();
            const userName = userData.fullName || userData.email;

            // Validate all items and check stock availability
            const validatedItems = [];
            for (const item of items) {
                const inventoryItem = await inventoryService.getItemById(item.inventoryId);

                // Calculate total quantity needed across all layers
                let totalNeeded = 0;
                for (const layer of item.layers) {
                    // Convert to base units (pieces) for validation
                    const packagingStructure = inventoryItem.packagingStructure || {};
                    const multiplier = this.calculateMultiplier(packagingStructure, layer.layerIndex);

                    totalNeeded += layer.quantity * multiplier;
                }

                // Check if enough stock available
                if (inventoryItem.stock < totalNeeded) {
                    throw new ValidationError(
                        `Insufficient stock for ${inventoryItem.productName}. Available: ${inventoryItem.stock}, Needed: ${totalNeeded}`
                    );
                }

                validatedItems.push({
                    inventoryId: item.inventoryId,
                    productName: inventoryItem.productName,
                    layers: item.layers.map(layer => ({
                        layerIndex: layer.layerIndex,
                        unit: layer.unit,
                        quantity: layer.quantity,
                        collected: false,
                        collectedQty: 0,
                        collectedAt: null
                    }))
                });
            }

            // Generate transfer number
            const transferNumber = await this.generateTransferNumber();

            // Create transfer record
            const newTransfer = {
                transferNumber,
                vehicleId,
                vehicleName: vehicle.vehicleName,
                fromLocation: 'Main Store',
                status: 'pending',
                items: validatedItems,
                issuedBy: userId,
                issuedByName: userName,
                issuedAt: admin.firestore.FieldValue.serverTimestamp(),
                approvedBy: null,
                approvedByName: null,
                approvedAt: null,
                confirmedBy: null,
                confirmedByName: null,
                confirmedAt: null,
                notes,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(newTransfer);

            logger.info(`Transfer created: ${transferNumber}`, { id: docRef.id, vehicleId });

            // Auto-approve the transfer immediately
            logger.info(`Auto-approving transfer: ${transferNumber}`);
            await this.approveTransfer(docRef.id, userId);

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);

            return await this.getTransferById(docRef.id);
        } catch (error) {
            logger.error('Create transfer error:', error);
            throw error;
        }
    }

    /**
     * Approve transfer and deduct stock
     * @param {string} transferId
     * @param {string} approverId
     * @returns {Promise<Object>}
     */
    async approveTransfer(transferId, approverId) {
        try {
            const transferDoc = await this.db.collection(this.collection).doc(transferId).get();

            if (!transferDoc.exists) {
                throw new NotFoundError('Transfer');
            }

            const transfer = transferDoc.data();

            if (transfer.status !== 'pending') {
                throw new ValidationError(`Cannot approve transfer with status: ${transfer.status}`);
            }

            // Get approver details
            const approverDoc = await this.db.collection('users').doc(approverId).get();
            if (!approverDoc.exists) {
                throw new NotFoundError('Approver');
            }
            const approverData = approverDoc.data();
            const approverName = approverData.fullName || approverData.email;

            // Begin Firestore transaction
            await this.db.runTransaction(async (transaction) => {
                // PHASE 1: PREPARE AND EXECUTE ALL READS
                // Firestore requires all reads to come before any writes in a transaction
                const inventoryRefs = [];
                const vehicleInventoryQueries = [];

                // Prepare reads
                for (const item of transfer.items) {
                    inventoryRefs.push(this.db.collection('inventory').doc(item.inventoryId));

                    const q = this.db.collection(this.vehicleInventoryCollection)
                        .where('vehicleId', '==', transfer.vehicleId)
                        .where('inventoryId', '==', item.inventoryId)
                        .limit(1);
                    vehicleInventoryQueries.push(transaction.get(q));
                }

                // Execute reads
                // Note: getAll is varargs in some SDKs, array in others. Admin SDK supports spread.
                const inventoryDocs = await transaction.getAll(...inventoryRefs);
                const vehicleInventorySnapshots = await Promise.all(vehicleInventoryQueries);

                // PHASE 2: LOGIC AND WRITES
                for (let i = 0; i < transfer.items.length; i++) {
                    const item = transfer.items[i];
                    const inventoryDoc = inventoryDocs[i];
                    const vehicleInventorySnapshot = vehicleInventorySnapshots[i];

                    if (!inventoryDoc.exists) {
                        throw new NotFoundError(`Inventory item: ${item.inventoryId}`);
                    }

                    const inventoryData = inventoryDoc.data();
                    const packagingStructure = inventoryData.packagingStructure || {};
                    const inventoryRef = inventoryDoc.ref;

                    // Calculate total quantity to deduct (in base units)
                    let totalToDeduct = 0;
                    for (const layer of item.layers) {
                        const multiplier = this.calculateMultiplier(packagingStructure, layer.layerIndex);
                        totalToDeduct += layer.quantity * multiplier;
                    }

                    const newStock = inventoryData.stock - totalToDeduct;

                    if (newStock < 0) {
                        throw new ValidationError(
                            `Insufficient stock for ${inventoryData.productName}. Available: ${inventoryData.stock}, Needed: ${totalToDeduct}`
                        );
                    }

                    // Update store inventory
                    transaction.update(inventoryRef, {
                        stock: newStock,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Add to vehicle inventory
                    if (vehicleInventorySnapshot.empty) {
                        // Create new vehicle inventory record
                        const vehicleInventoryRef = this.db.collection(this.vehicleInventoryCollection).doc();
                        transaction.set(vehicleInventoryRef, {
                            vehicleId: transfer.vehicleId,
                            inventoryId: item.inventoryId,
                            productName: item.productName,
                            layers: item.layers.map(layer => ({
                                layerIndex: layer.layerIndex,
                                unit: layer.unit,
                                quantity: layer.quantity,
                                unitsPerParent: Array.isArray(packagingStructure) && packagingStructure[layer.layerIndex + 1]
                                    ? packagingStructure[layer.layerIndex + 1].qty
                                    : (layer.layerIndex === 0 ? null :
                                        layer.layerIndex === 1 ? packagingStructure.cartonSize :
                                            packagingStructure.packetSize)
                            })),
                            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                        });
                    } else {
                        // Update existing vehicle inventory
                        const vehicleInventoryDoc = vehicleInventorySnapshot.docs[0];
                        const vehicleInventoryData = vehicleInventoryDoc.data();
                        const existingLayers = vehicleInventoryData.layers || [];

                        // Merge layers
                        const updatedLayers = [...existingLayers];
                        for (const newLayer of item.layers) {
                            const existingLayerIndex = updatedLayers.findIndex(l => l.layerIndex === newLayer.layerIndex);
                            if (existingLayerIndex >= 0) {
                                updatedLayers[existingLayerIndex].quantity += newLayer.quantity;
                            } else {
                                updatedLayers.push({
                                    layerIndex: newLayer.layerIndex,
                                    unit: newLayer.unit,
                                    quantity: newLayer.quantity,
                                    unitsPerParent: Array.isArray(packagingStructure) && packagingStructure[newLayer.layerIndex + 1]
                                        ? packagingStructure[newLayer.layerIndex + 1].qty
                                        : (newLayer.layerIndex === 0 ? null :
                                            newLayer.layerIndex === 1 ? packagingStructure.cartonSize :
                                                packagingStructure.packetSize)
                                });
                            }
                        }

                        transaction.update(vehicleInventoryDoc.ref, {
                            layers: updatedLayers,
                            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    // Log stock adjustment for store
                    const adjustmentRef = this.db.collection('stock_adjustments').doc();
                    transaction.set(adjustmentRef, {
                        inventoryId: item.inventoryId,
                        productName: item.productName,
                        previousStock: inventoryData.stock,
                        adjustment: -totalToDeduct,
                        newStock,
                        reason: 'transfer',
                        transferId: transferId,
                        transferNumber: transfer.transferNumber,
                        notes: `Transfer to ${transfer.vehicleName}`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // Update transfer status
                const transferRef = this.db.collection(this.collection).doc(transferId);
                transaction.update(transferRef, {
                    status: 'approved',
                    approvedBy: approverId,
                    approvedByName: approverName,
                    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            logger.info(`Transfer approved: ${transfer.transferNumber}`, { transferId, approverId });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${transferId}`);
            await cache.delPattern(`${this.cachePrefix}*`);
            await cache.delPattern(`vehicle:inventory:${transfer.vehicleId}*`);

            return await this.getTransferById(transferId);
        } catch (error) {
            logger.error('Approve transfer error:', error);
            throw error;
        }
    }

    /**
     * Confirm transfer collection by sales rep
     * @param {string} transferId
     * @param {string} salesRepId
     * @returns {Promise<Object>}
     */
    async confirmTransfer(transferId, salesRepId) {
        try {
            const transferDoc = await this.db.collection(this.collection).doc(transferId).get();

            if (!transferDoc.exists) {
                throw new NotFoundError('Transfer');
            }

            const transfer = transferDoc.data();

            if (transfer.status !== 'approved' && transfer.status !== 'partially_collected') {
                throw new ValidationError(`Cannot confirm transfer with status: ${transfer.status}`);
            }

            // Verify sales rep is assigned to the vehicle
            const vehicle = await vehicleService.getVehicleById(transfer.vehicleId);
            if (vehicle.assignedUserId !== salesRepId) {
                throw new UnauthorizedError('Only the assigned sales representative can confirm this transfer');
            }

            // Get sales rep details
            const salesRepDoc = await this.db.collection('users').doc(salesRepId).get();
            if (!salesRepDoc.exists) {
                throw new NotFoundError('Sales representative');
            }
            const salesRepData = salesRepDoc.data();
            const salesRepName = salesRepData.fullName || salesRepData.email;

            // Mark all items as collected
            const updatedItems = transfer.items.map(item => ({
                ...item,
                layers: item.layers.map(layer => ({
                    ...layer,
                    collected: true,
                    collectedQty: layer.quantity,
                    collectedAt: new Date().toISOString() // FieldValue.serverTimestamp() not supported in arrays
                }))
            }));

            await this.db.collection(this.collection).doc(transferId).update({
                status: 'collected',
                items: updatedItems,
                confirmedBy: salesRepId,
                confirmedByName: salesRepName,
                confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`Transfer confirmed: ${transfer.transferNumber}`, { transferId, salesRepId });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${transferId}`);
            await cache.delPattern(`${this.cachePrefix}*`);

            return await this.getTransferById(transferId);
        } catch (error) {
            logger.error('Confirm transfer error:', error);
            throw error;
        }
    }

    /**
     * Collect specific layer of an item in a transfer
     * @param {string} transferId
     * @param {number} itemIndex
     * @param {number} layerIndex
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async collectTransferLayer(transferId, itemIndex, layerIndex, userId) {
        try {
            const transferDoc = await this.db.collection(this.collection).doc(transferId).get();

            if (!transferDoc.exists) {
                throw new NotFoundError('Transfer');
            }

            const transfer = transferDoc.data();

            // Allow collection if status is 'approved' or 'partially_collected'
            if (transfer.status !== 'approved' && transfer.status !== 'partially_collected') {
                throw new ValidationError(`Cannot collect items for transfer with status: ${transfer.status}`);
            }

            // Verify vehicle/user assignment
            const vehicle = await vehicleService.getVehicleById(transfer.vehicleId);
            if (vehicle.assignedUserId !== userId) {
                throw new AuthorizationError('Only the assigned sales representative can collect items');
            }

            const items = [...transfer.items];
            if (!items[itemIndex]) {
                throw new NotFoundError('Transfer item');
            }

            const layers = [...items[itemIndex].layers];
            if (!layers[layerIndex]) {
                throw new NotFoundError('Transfer item layer');
            }

            // Mark layer as collected
            layers[layerIndex] = {
                ...layers[layerIndex],
                collected: true,
                collectedQty: layers[layerIndex].quantity,
                collectedAt: new Date().toISOString() // FieldValue.serverTimestamp() not supported in arrays
            };

            items[itemIndex] = {
                ...items[itemIndex],
                layers
            };

            // Check if all items and layers are collected
            const allCollected = items.every(item =>
                item.layers.every(layer => layer.collected)
            );

            const status = allCollected ? 'collected' : 'partially_collected';

            const updateData = {
                items,
                status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (status === 'collected') {
                updateData.confirmedBy = userId;
                updateData.confirmedByName = (await this.db.collection('users').doc(userId).get()).data().fullName || 'Unknown';
                updateData.confirmedAt = admin.firestore.FieldValue.serverTimestamp();
            }

            await this.db.collection(this.collection).doc(transferId).update(updateData);

            // If all items collected, calculate and set sales target
            if (status === 'collected') {
                try {
                    // Get all vehicle inventory with prices
                    const vehicleInventorySnapshot = await this.db.collection(this.vehicleInventoryCollection)
                        .where('vehicleId', '==', transfer.vehicleId)
                        .get();

                    let totalInventoryValue = 0;

                    // Calculate total value: sum(quantity × sellingPrice) for all items
                    for (const doc of vehicleInventorySnapshot.docs) {
                        const invData = doc.data();
                        const layers = invData.layers || [];

                        // Get selling price from inventory collection
                        let sellingPrice = 0;
                        try {
                            const inventoryDoc = await this.db.collection('inventory').doc(invData.inventoryId).get();
                            if (inventoryDoc.exists) {
                                sellingPrice = inventoryDoc.data().sellingPrice || 0;
                            }
                        } catch (err) {
                            logger.warn(`Could not fetch selling price for ${invData.inventoryId}`, err);
                        }

                        // Sum up all layers' value (weighted by pieces per layer)
                        let itemTotalQty = 0;
                        const packagingStructure = (await this.db.collection('inventory').doc(invData.inventoryId).get()).data()?.packagingStructure;

                        for (const layer of layers) {
                            const multiplier = this.calculateMultiplier(packagingStructure, layer.layerIndex);
                            itemTotalQty += (layer.quantity || 0) * multiplier;
                        }

                        totalInventoryValue += itemTotalQty * sellingPrice;
                    }

                    // Calculate target: 95% of total inventory value
                    const salesTarget = Math.round(totalInventoryValue * 0.95);

                    // Update vehicle with new sales target
                    await this.db.collection('vehicles').doc(transfer.vehicleId).update({
                        currentSalesTarget: salesTarget,
                        targetSetAt: admin.firestore.FieldValue.serverTimestamp(),
                        targetSetBy: transferId,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    logger.info(`Sales target set for vehicle ${transfer.vehicleId}: ${salesTarget} (95% of ${totalInventoryValue})`);
                } catch (targetError) {
                    // Don't fail the collection if target calculation fails, just log
                    logger.error('Error calculating/setting sales target:', targetError);
                }
            }

            logger.info(`Transfer layer collected: ${transfer.transferNumber} Item:${itemIndex} Layer:${layerIndex}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${transferId}`);
            await cache.delPattern(`${this.cachePrefix}*`);

            return await this.getTransferById(transferId);
        } catch (error) {
            logger.error('Collect transfer layer error:', error);
            throw error;
        }
    }

    /**
     * Break unit from one layer to another
     * @param {string} vehicleId
     * @param {Object} breakdownData
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async breakUnit(vehicleId, breakdownData, userId) {
        try {
            const { inventoryId, fromLayer, toLayer, quantity } = breakdownData;

            // Verify vehicle exists and user is assigned
            const vehicle = await vehicleService.getVehicleById(vehicleId);
            if (vehicle.assignedUserId !== userId) {
                throw new UnauthorizedError('Only the assigned sales representative can break units');
            }

            // Get inventory item for packaging structure
            const inventoryItem = await inventoryService.getItemById(inventoryId);
            const packagingStructure = inventoryItem.packagingStructure || {};

            // Calculate conversion rate
            const fromMultiplier = this.calculateMultiplier(packagingStructure, fromLayer);
            const toMultiplier = this.calculateMultiplier(packagingStructure, toLayer);
            const conversionRate = Math.floor(fromMultiplier / toMultiplier) || 1;

            const resultingQuantity = quantity * conversionRate;

            // Begin transaction
            await this.db.runTransaction(async (transaction) => {
                // Get vehicle inventory
                const vehicleInventoryQuery = await this.db.collection(this.vehicleInventoryCollection)
                    .where('vehicleId', '==', vehicleId)
                    .where('inventoryId', '==', inventoryId)
                    .limit(1)
                    .get();

                if (vehicleInventoryQuery.empty) {
                    throw new NotFoundError('Vehicle inventory item');
                }

                const vehicleInventoryDoc = vehicleInventoryQuery.docs[0];
                const vehicleInventoryData = vehicleInventoryDoc.data();
                const layers = vehicleInventoryData.layers || [];

                // Find and update layers
                const fromLayerData = layers.find(l => l.layerIndex === fromLayer);
                if (!fromLayerData || fromLayerData.quantity < quantity) {
                    throw new ValidationError(
                        `Insufficient quantity in layer ${fromLayer}. Available: ${fromLayerData?.quantity || 0}, Needed: ${quantity}`
                    );
                }

                // Update layers
                const updatedLayers = layers.map(layer => {
                    if (layer.layerIndex === fromLayer) {
                        return { ...layer, quantity: layer.quantity - quantity };
                    } else if (layer.layerIndex === toLayer) {
                        return { ...layer, quantity: layer.quantity + resultingQuantity };
                    }
                    return layer;
                });

                // If toLayer doesn't exist, add it
                if (!layers.find(l => l.layerIndex === toLayer)) {
                    updatedLayers.push({
                        layerIndex: toLayer,
                        unit: toLayer === 0 ? 'carton' : toLayer === 1 ? 'box' : 'piece',
                        quantity: resultingQuantity,
                        unitsPerParent: Array.isArray(packagingStructure) && packagingStructure[toLayer + 1]
                            ? packagingStructure[toLayer + 1].qty
                            : (toLayer === 0 ? null :
                                toLayer === 1 ? packagingStructure.cartonSize :
                                    packagingStructure.packetSize)
                    });
                }

                // Update vehicle inventory
                transaction.update(vehicleInventoryDoc.ref, {
                    layers: updatedLayers,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });

                // Log breakdown
                const breakdownRef = this.db.collection(this.breakdownCollection).doc();
                transaction.set(breakdownRef, {
                    vehicleId,
                    inventoryId,
                    productName: inventoryItem.productName,
                    fromLayer,
                    fromUnit: fromLayer === 0 ? 'carton' : fromLayer === 1 ? 'box' : 'piece',
                    toLayer,
                    toUnit: toLayer === 0 ? 'carton' : toLayer === 1 ? 'box' : 'piece',
                    quantity,
                    resultingQuantity,
                    conversionRate,
                    performedBy: userId,
                    performedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            logger.info(`Unit breakdown performed`, {
                vehicleId,
                inventoryId,
                fromLayer,
                toLayer,
                quantity,
                resultingQuantity
            });

            // Invalidate cache
            await cache.delPattern(`vehicle:inventory:${vehicleId}*`);

            return {
                success: true,
                fromLayer,
                toLayer,
                quantity,
                resultingQuantity,
                conversionRate
            };
        } catch (error) {
            logger.error('Break unit error:', error);
            throw error;
        }
    }

    /**
     * Return stock from vehicle to main inventory
     * @param {Object} returnData
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async returnStock(returnData, userId) {
        try {
            const { vehicleId, items, notes = '' } = returnData;

            const vehicle = await vehicleService.getVehicleById(vehicleId);
            const userDoc = await this.db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : { email: 'System' };
            const userName = userData.fullName || userData.email;

            // Generate transfer number
            const transferNumber = await this.generateTransferNumber();

            await this.db.runTransaction(async (transaction) => {
                // Reads
                const vehicleInventoryQueries = [];
                const inventoryRefs = [];

                for (const item of items) {
                    const q = this.db.collection(this.vehicleInventoryCollection)
                        .where('vehicleId', '==', vehicleId)
                        .where('inventoryId', '==', item.inventoryId)
                        .limit(1);
                    vehicleInventoryQueries.push(transaction.get(q));
                    inventoryRefs.push(this.db.collection('inventory').doc(item.inventoryId));
                }

                const vehicleInventorySnapshots = await Promise.all(vehicleInventoryQueries);
                const inventoryDocs = await transaction.getAll(...inventoryRefs);

                const finalItems = [];

                // Writes
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const vehicleSnapshot = vehicleInventorySnapshots[i];
                    const inventoryDoc = inventoryDocs[i];

                    if (vehicleSnapshot.empty) {
                        throw new ValidationError(`Item not found in vehicle inventory: ${item.inventoryId}`);
                    }
                    if (!inventoryDoc.exists) {
                        throw new NotFoundError(`Main inventory item: ${item.inventoryId}`);
                    }

                    const vehicleInvDoc = vehicleSnapshot.docs[0];
                    const vehicleInvData = vehicleInvDoc.data();
                    const mainInvData = inventoryDoc.data();
                    const packagingStructure = mainInvData.packagingStructure || {};

                    // 1. Deduct from Vehicle
                    const layers = vehicleInvData.layers || [];
                    const layerIndex = item.layerIndex || 0;
                    const targetLayer = layers.find(l => l.layerIndex === layerIndex);

                    // Allow return if quantity matches exactly or is less
                    // Note: item.quantity must be deducted.
                    if (!targetLayer || targetLayer.quantity < item.quantity) {
                        throw new ValidationError(`Insufficient vehicle stock for ${mainInvData.productName}. Available: ${targetLayer?.quantity || 0}`);
                    }

                    targetLayer.quantity -= item.quantity;

                    transaction.update(vehicleInvDoc.ref, {
                        layers: layers,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 2. Add to Main Inventory
                    const multiplier = this.calculateMultiplier(packagingStructure, layerIndex);
                    const totalPiecesToAdd = item.quantity * multiplier;

                    transaction.update(inventoryDoc.ref, {
                        stock: mainInvData.stock + totalPiecesToAdd,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 3. Log Adjustment
                    const adjustmentRef = this.db.collection('stock_adjustments').doc();
                    transaction.set(adjustmentRef, {
                        inventoryId: item.inventoryId,
                        productName: mainInvData.productName,
                        previousStock: mainInvData.stock,
                        adjustment: totalPiecesToAdd,
                        newStock: mainInvData.stock + totalPiecesToAdd,
                        reason: 'return',
                        transferNumber: transferNumber,
                        vehicleId: vehicleId,
                        vehicleName: `${vehicle.vehicleName} (${vehicle.registrationNumber || vehicle.vehicleNumber || ''})`,
                        notes: `Return from ${vehicle.vehicleName}`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    finalItems.push({
                        inventoryId: item.inventoryId,
                        productName: mainInvData.productName,
                        unit: item.unit,
                        quantity: item.quantity,
                        layerIndex: layerIndex
                    });
                }

                // 4. Create Transfer Record
                const transferRef = this.db.collection(this.collection).doc();
                transaction.set(transferRef, {
                    transferNumber,
                    vehicleId,
                    vehicleName: `${vehicle.vehicleName} (${vehicle.registrationNumber || vehicle.vehicleNumber || ''})`,
                    fromLocation: vehicle.vehicleName,
                    toLocation: 'Main Store',
                    type: 'return',
                    status: 'returned',
                    items: finalItems,
                    issuedBy: userId,
                    issuedByName: userName,
                    notes,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);
            await cache.delPattern(`vehicle:inventory:${vehicleId}*`);

            return { success: true, transferNumber };
        } catch (error) {
            logger.error('Return stock error:', error);
            throw error;
        }
    }

    /**
     * Get pending transfers
     * @returns {Promise<Array>}
     */
    async getPendingTransfers() {
        try {
            const cacheKey = `${this.cachePrefix}pending`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const snapshot = await this.db.collection(this.collection)
                .where('status', '==', 'pending')
                .orderBy('createdAt', 'desc')
                .get();

            const transfers = serializeDocs(snapshot);

            // Cache for shorter time (1 minute)
            await cache.set(cacheKey, transfers, 60);

            return transfers;
        } catch (error) {
            logger.error('Get pending transfers error:', error);
            throw error;
        }
    }

    /**
     * Get transfer by ID
     * @param {string} transferId
     * @returns {Promise<Object>}
     */
    async getTransferById(transferId) {
        try {
            const cacheKey = `${this.cachePrefix}${transferId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(transferId).get();

            if (!doc.exists) {
                throw new NotFoundError('Transfer');
            }

            const transfer = serializeDoc(doc);

            // Cache the result
            await cache.set(cacheKey, transfer, this.cacheTTL);

            return transfer;
        } catch (error) {
            logger.error('Get transfer by ID error:', error);
            throw error;
        }
    }

    /**
     * Get all transfers with filters
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAllTransfers(filters = {}) {
        try {
            const {
                vehicleId,
                status,
                startDate,
                endDate,
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection);

            // Apply filters
            if (vehicleId) {
                query = query.where('vehicleId', '==', vehicleId);
            }
            if (status) {
                query = query.where('status', '==', status);
            }
            if (startDate) {
                query = query.where('createdAt', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('createdAt', '<=', new Date(endDate));
            }

            // Get all matching documents
            const snapshot = await query.get();
            let transfers = serializeDocs(snapshot);

            // Sort transfers
            transfers.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];

                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            // Calculate pagination
            const total = transfers.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedTransfers = transfers.slice(startIndex, endIndex);

            const result = {
                transfers: paginatedTransfers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: endIndex < total,
                    hasPrevPage: page > 1
                }
            };

            // Cache the result
            await cache.set(cacheKey, result, this.cacheTTL);

            return result;
        } catch (error) {
            logger.error('Get all transfers error:', error);
            throw error;
        }
    }

    /**
     * Get collected items for a vehicle (with batch query optimization)
     * Returns a flattened list of items available for sale
     * @param {string} vehicleId
     * @returns {Promise<Array>}
     */
    async getCollectedItems(vehicleId) {
        try {
            const cacheKey = `${this.cachePrefix}collected:${vehicleId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get all transfers that have collected items (fully or partially collected)
            const snapshot = await this.db.collection(this.collection)
                .where('vehicleId', '==', vehicleId)
                .where('status', 'in', ['collected', 'partially_collected'])
                .get();

            const transfers = serializeDocs(snapshot);

            // Extract all unique inventory IDs
            const inventoryIds = new Set();
            transfers.forEach(transfer => {
                transfer.items.forEach(item => {
                    inventoryIds.add(item.inventoryId);
                });
            });

            // BATCH QUERY OPTIMIZATION: Fetch all inventory items at once
            const inventoryMap = {};
            if (inventoryIds.size > 0) {
                const inventoryRefs = Array.from(inventoryIds).map(id =>
                    this.db.collection('inventory').doc(id)
                );
                const inventoryDocs = await this.db.getAll(...inventoryRefs);

                inventoryDocs.forEach(doc => {
                    if (doc.exists) {
                        inventoryMap[doc.id] = serializeDoc(doc);
                    }
                });
            }

            // Flatten transfers into a list of saleable items
            // Only include layers that have been collected
            const flattenedItems = [];
            transfers.forEach(transfer => {
                transfer.items.forEach(item => {
                    item.layers.forEach((layer, layerIndex) => {
                        if (layer.collected && layer.quantity > 0) {
                            const inventoryDetails = inventoryMap[item.inventoryId] || {};
                            flattenedItems.push({
                                inventoryId: item.inventoryId,
                                productName: item.productName || inventoryDetails.productName || 'Unknown Product',
                                unit: layer.unit,
                                quantity: layer.quantity,
                                layerIndex: layer.layerIndex ?? layerIndex,
                                sellingPrice: inventoryDetails.sellingPrice || 0,
                                packagingStructure: inventoryDetails.packagingStructure || [],
                                transferId: transfer.id,
                                transferNumber: transfer.transferNumber
                            });
                        }
                    });
                });
            });

            // Cache for shorter time (2 minutes)
            await cache.set(cacheKey, flattenedItems, 120);

            return flattenedItems;
        } catch (error) {
            logger.error('Get collected items error:', error);
            throw error;
        }
    }
}

module.exports = new TransferService();
