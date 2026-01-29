const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const invoiceService = require('./invoice.service');

class InventoryService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'inventory';
        this.cachePrefix = 'inventory:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Create new inventory item
     * @param {Object} itemData
     * @returns {Promise<Object>}
     */
    async createItem(itemData) {
        try {
            // If invoice ID provided, validate and update invoice
            if (itemData.invoiceId) {
                const itemCost = itemData.buyingPrice * itemData.stock;
                await invoiceService.addItemToInvoice(itemData.invoiceId, itemCost);
            }

            const data = {
                ...itemData,
                productNameLower: (itemData.productName || '').toLowerCase(),
                isActive: itemData.isActive !== undefined ? itemData.isActive : true,
                stock: itemData.stock || 0,
                itemCost: itemData.invoiceId ? itemData.buyingPrice * itemData.stock : null,
                lastPurchaseInvoiceId: itemData.invoiceId || null,
                warehouseId: itemData.warehouseId || null,
                warehouseName: itemData.warehouseName || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(data);

            logger.info(`Inventory item created: ${itemData.productName}`, {
                id: docRef.id,
                invoiceId: itemData.invoiceId
            });

            // Invalidate list cache
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getItemById(docRef.id);
        } catch (error) {
            logger.error('Create inventory item error:', error);
            throw error;
        }
    }

    /**
     * Get inventory item by ID
     * @param {string} itemId
     * @returns {Promise<Object>}
     */
    async getItemById(itemId) {
        try {
            // Always fetch fresh from DB (no caching) to ensure price validation uses latest data
            const doc = await this.db.collection(this.collection).doc(itemId).get();

            if (!doc.exists) {
                throw new NotFoundError('Inventory item');
            }

            const item = serializeDoc(doc);

            return item;
        } catch (error) {
            logger.error('Get inventory item error:', error);
            throw error;
        }
    }

    /**
     * Get all inventory items with filters and pagination
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAllItems(filters = {}) {
        try {
            const {
                search,
                category,
                supplier,
                isActive,
                minStock,
                maxStock,
                minPrice,
                maxPrice,
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            // Create cache key from filters
            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection);

            // Apply filters
            if (category) {
                query = query.where('category', '==', category);
            }
            if (supplier) {
                query = query.where('supplier', '==', supplier);
            }
            if (isActive !== undefined) {
                query = query.where('isActive', '==', isActive);
            }

            // Stock range filters
            if (minStock !== undefined) {
                query = query.where('stock', '>=', minStock);
            }
            if (maxStock !== undefined) {
                query = query.where('stock', '<=', maxStock);
            }

            // Get all matching documents for filtering and counting
            const snapshot = await query.get();
            let items = serializeDocs(snapshot);

            // Apply search filter (client-side for flexibility)
            if (search) {
                const searchLower = search.toLowerCase();
                items = items.filter(item =>
                    item.productNameLower?.includes(searchLower) ||
                    item.barcode?.includes(search)
                );
            }

            // Apply price range filters (client-side)
            if (minPrice !== undefined) {
                items = items.filter(item => item.sellingPrice >= minPrice);
            }
            if (maxPrice !== undefined) {
                items = items.filter(item => item.sellingPrice <= maxPrice);
            }

            // Sort items
            items.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];

                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            // Calculate pagination
            const total = items.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedItems = items.slice(startIndex, endIndex);

            const result = {
                items: paginatedItems,
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
            logger.error('Get all inventory items error:', error);
            throw error;
        }
    }

    /**
     * Update inventory item
     * @param {string} itemId
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateItem(itemId, updateData) {
        try {
            const doc = await this.db.collection(this.collection).doc(itemId).get();

            if (!doc.exists) {
                throw new NotFoundError('Inventory item');
            }

            const updates = { ...updateData };

            // Update productNameLower if productName is being updated
            if (updateData.productName) {
                updates.productNameLower = updateData.productName.toLowerCase();
            }

            if (updateData.warehouseId !== undefined) updates.warehouseId = updateData.warehouseId;
            if (updateData.warehouseName !== undefined) updates.warehouseName = updateData.warehouseName;

            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.db.collection(this.collection).doc(itemId).update(updates);

            logger.info(`Inventory item updated: ${itemId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${itemId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getItemById(itemId);
        } catch (error) {
            logger.error('Update inventory item error:', error);
            throw error;
        }
    }

    /**
     * Delete inventory item
     * @param {string} itemId
     * @returns {Promise<void>}
     */
    async deleteItem(itemId) {
        try {
            const doc = await this.db.collection(this.collection).doc(itemId).get();

            if (!doc.exists) {
                throw new NotFoundError('Inventory item');
            }

            await this.db.collection(this.collection).doc(itemId).delete();

            logger.info(`Inventory item deleted: ${itemId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${itemId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Delete inventory item error:', error);
            throw error;
        }
    }

    /**
     * Adjust stock level
     * @param {string} itemId
     * @param {number} adjustment
     * @param {string} reason
     * @param {string} notes
     * @returns {Promise<Object>}
     */
    async adjustStock(itemId, adjustmentData) {
        try {
            const { adjustment, reason, notes = '', invoiceId, buyingPrice } = adjustmentData;

            const doc = await this.db.collection(this.collection).doc(itemId).get();

            if (!doc.exists) {
                throw new NotFoundError('Inventory item');
            }

            const currentData = doc.data();
            const newStock = currentData.stock + adjustment;

            if (newStock < 0) {
                throw new ValidationError('Stock cannot be negative');
            }

            // If purchase adjustment with invoice, validate and update invoice
            let itemCost = null;
            if (reason === 'purchase' && invoiceId && buyingPrice) {
                itemCost = buyingPrice * adjustment;
                await invoiceService.addItemToInvoice(invoiceId, itemCost);
            }

            // Prepare update data
            const updates = {
                stock: newStock,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Update buying price and invoice reference for purchases
            if (reason === 'purchase' && buyingPrice) {
                updates.buyingPrice = buyingPrice;
                updates.lastPurchaseInvoiceId = invoiceId;
            }

            await this.db.collection(this.collection).doc(itemId).update(updates);

            // Log stock adjustment
            await this.db.collection('stock_adjustments').add({
                inventoryId: itemId,
                productName: currentData.productName,
                previousStock: currentData.stock,
                adjustment,
                newStock,
                reason,
                invoiceId: invoiceId || null,
                buyingPrice: buyingPrice || null,
                itemCost: itemCost,
                notes,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`Stock adjusted for ${itemId}: ${adjustment}`, {
                reason,
                newStock,
                invoiceId
            });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${itemId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getItemById(itemId);
        } catch (error) {
            logger.error('Adjust stock error:', error);
            throw error;
        }
    }

    /**
     * Bulk import inventory items
     * @param {Array} items
     * @returns {Promise<Object>}
     */
    async bulkImport(items) {
        try {
            const batch = this.db.batch();
            const results = {
                success: [],
                failed: []
            };

            for (const itemData of items) {
                try {
                    const data = {
                        ...itemData,
                        productNameLower: (itemData.productName || '').toLowerCase(),
                        isActive: itemData.isActive !== undefined ? itemData.isActive : true,
                        stock: itemData.stock || 0,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    const docRef = this.db.collection(this.collection).doc();
                    batch.set(docRef, data);

                    results.success.push({
                        id: docRef.id,
                        productName: itemData.productName
                    });
                } catch (error) {
                    results.failed.push({
                        productName: itemData.productName,
                        error: error.message
                    });
                }
            }

            await batch.commit();

            logger.info(`Bulk import completed: ${results.success.length} success, ${results.failed.length} failed`);

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return results;
        } catch (error) {
            logger.error('Bulk import error:', error);
            throw error;
        }
    }

    /**
     * Get low stock items
     * @param {number} threshold
     * @returns {Promise<Array>}
     */
    async getLowStockItems(threshold = 10) {
        try {
            const cacheKey = `${this.cachePrefix}lowstock:${threshold}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const snapshot = await this.db.collection(this.collection)
                .where('stock', '<=', threshold)
                .where('isActive', '==', true)
                .get();

            const items = serializeDocs(snapshot);

            // Cache for shorter time (2 minutes) as stock changes frequently
            await cache.set(cacheKey, items, 120);

            return items;
        } catch (error) {
            logger.error('Get low stock items error:', error);
            throw error;
        }
    }

    /**
     * Search inventory by barcode
     * @param {string} barcode
     * @returns {Promise<Object|null>}
     */
    async searchByBarcode(barcode) {
        try {
            const snapshot = await this.db.collection(this.collection)
                .where('barcode', '==', barcode)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            return serializeDoc(snapshot.docs[0]);
        } catch (error) {
            logger.error('Search by barcode error:', error);
            throw error;
        }
    }

    /**
     * Get stock by layer (for multi-layer packaging)
     * @param {string} itemId
     * @param {number} layerIndex - 0 (carton), 1 (box), 2 (piece)
     * @returns {Promise<number>}
     */
    async getStockByLayer(itemId, layerIndex) {
        try {
            const item = await this.getItemById(itemId);
            const packagingStructure = item.packagingStructure || {};
            const totalStock = item.stock || 0;

            if (layerIndex === 2) {
                // Piece level - return total stock
                return totalStock;
            } else if (layerIndex === 1) {
                // Box level
                const packetSize = packagingStructure.packetSize || 1;
                return Math.floor(totalStock / packetSize);
            } else if (layerIndex === 0) {
                // Carton level
                const cartonSize = packagingStructure.cartonSize || 1;
                const packetSize = packagingStructure.packetSize || 1;
                return Math.floor(totalStock / (cartonSize * packetSize));
            }

            return 0;
        } catch (error) {
            logger.error('Get stock by layer error:', error);
            throw error;
        }
    }

    /**
     * Adjust stock for specific layer
     * @param {string} itemId
     * @param {number} layerIndex
     * @param {number} quantity
     * @param {string} reason
     * @returns {Promise<Object>}
     */
    async adjustStockByLayer(itemId, layerIndex, quantity, reason) {
        try {
            const item = await this.getItemById(itemId);
            const packagingStructure = item.packagingStructure || {};

            // Convert layer quantity to base units (pieces)
            let baseQuantity = quantity;
            if (layerIndex === 0) {
                // Carton
                const cartonSize = packagingStructure.cartonSize || 1;
                const packetSize = packagingStructure.packetSize || 1;
                baseQuantity = quantity * cartonSize * packetSize;
            } else if (layerIndex === 1) {
                // Box
                const packetSize = packagingStructure.packetSize || 1;
                baseQuantity = quantity * packetSize;
            }

            // Use existing adjustStock method
            return await this.adjustStock(itemId, {
                adjustment: baseQuantity,
                reason,
                notes: `Layer ${layerIndex} adjustment: ${quantity} units`
            });
        } catch (error) {
            logger.error('Adjust stock by layer error:', error);
            throw error;
        }
    }

    /**
     * Replenish stock for existing item with new invoice
     * Adds stock to existing item, links to new invoice, tracks batch history
     * @param {string} itemId
     * @param {Object} replenishData - { invoiceId, quantity, buyingPrice, notes }
     * @returns {Promise<Object>}
     */
    async replenishItem(itemId, replenishData) {
        try {
            const { invoiceId, quantity, buyingPrice, notes, layerIndex = 0 } = replenishData;

            if (!invoiceId) {
                throw new ValidationError('Invoice ID is required for replenishment');
            }
            if (!quantity || quantity <= 0) {
                throw new ValidationError('Quantity must be greater than 0');
            }

            // Get existing item
            const item = await this.getItemById(itemId);

            // Calculate item cost for this batch
            const itemCost = (buyingPrice || item.buyingPrice || 0) * quantity;

            // Validate and update invoice
            await invoiceService.addItemToInvoice(invoiceId, itemCost);

            // Calculate new stock based on layer
            let stockToAdd = quantity;
            const packagingStructure = item.packagingStructure || [];

            if (Array.isArray(packagingStructure) && packagingStructure.length > layerIndex) {
                // If adding at layer level (e.g., cartons), multiply by contained units
                for (let i = layerIndex; i < packagingStructure.length - 1; i++) {
                    const layer = packagingStructure[i];
                    if (layer.contains) {
                        stockToAdd *= layer.contains;
                    }
                }
            }

            // Create replenishment record
            const replenishmentRecord = {
                invoiceId,
                quantity,
                layerIndex,
                buyingPrice: buyingPrice || item.buyingPrice,
                itemCost,
                notes: notes || '',
                replenishedAt: new Date().toISOString(),
                replenishedBy: replenishData.userId || null
            };

            // Update item with new stock and replenishment history
            const currentStock = item.stock || 0;
            const replenishmentHistory = item.replenishmentHistory || [];
            replenishmentHistory.push(replenishmentRecord);

            // Update packaging structure stock if applicable
            let updatedPackagingStructure = packagingStructure;
            if (Array.isArray(packagingStructure) && packagingStructure.length > layerIndex) {
                updatedPackagingStructure = packagingStructure.map((layer, idx) => {
                    if (idx === layerIndex) {
                        return {
                            ...layer,
                            stock: (layer.stock || 0) + quantity
                        };
                    }
                    return layer;
                });
            }

            await this.db.collection(this.collection).doc(itemId).update({
                stock: currentStock + stockToAdd,
                packagingStructure: updatedPackagingStructure,
                lastPurchaseInvoiceId: invoiceId,
                lastReplenishedAt: admin.firestore.FieldValue.serverTimestamp(),
                replenishmentHistory,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`Item replenished: ${item.productName}`, {
                itemId,
                invoiceId,
                quantityAdded: quantity,
                newTotalStock: currentStock + stockToAdd
            });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${itemId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getItemById(itemId);
        } catch (error) {
            logger.error('Replenish item error:', error);
            throw error;
        }
    }

    /**
     * Generate SKU for inventory item
     * Format: [CAT]-[YYYYMMDD]-[RANDOM4]
     * @param {string} category
     * @returns {string}
     */
    generateSKU(category = 'MISC') {
        const catCode = category.substring(0, 3).toUpperCase();
        const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${catCode}-${dateCode}-${random}`;
    }
}

module.exports = new InventoryService();
