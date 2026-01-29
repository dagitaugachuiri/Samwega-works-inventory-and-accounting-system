const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');

class WarehouseService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'warehouses';
        this.cachePrefix = 'warehouse:';
        this.cacheTTL = 3600; // 1 hour
    }

    /**
     * Create new warehouse
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createWarehouse(data) {
        try {
            // Check for duplicate name
            const existing = await this.db.collection(this.collection)
                .where('name', '==', data.name)
                .limit(1)
                .get();

            if (!existing.empty) {
                throw new ConflictError('Warehouse with this name already exists');
            }

            const docData = {
                ...data,
                nameLower: data.name.toLowerCase(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(docData);

            logger.info(`Warehouse created: ${data.name}`, { id: docRef.id });

            // Invalidate list cache
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getWarehouseById(docRef.id);
        } catch (error) {
            logger.error('Create warehouse error:', error);
            throw error;
        }
    }

    /**
     * Get warehouse by ID
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async getWarehouseById(id) {
        try {
            const cacheKey = `${this.cachePrefix}${id}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(id).get();

            if (!doc.exists) {
                throw new NotFoundError('Warehouse');
            }

            const warehouse = serializeDoc(doc);
            await cache.set(cacheKey, warehouse, this.cacheTTL);

            return warehouse;
        } catch (error) {
            logger.error('Get warehouse error:', error);
            throw error;
        }
    }

    /**
     * Get all warehouses
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAllWarehouses(filters = {}) {
        try {
            const { search, isActive, page = 1, limit = 20 } = filters;

            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection);

            if (isActive !== undefined) {
                const isActiveBool = isActive === 'true' || isActive === true;
                query = query.where('isActive', '==', isActiveBool);
            }

            const snapshot = await query.get();
            let warehouses = serializeDocs(snapshot);

            // Client-side search
            if (search) {
                const searchLower = search.toLowerCase();
                warehouses = warehouses.filter(w =>
                    w.nameLower?.includes(searchLower) ||
                    w.location?.toLowerCase().includes(searchLower)
                );
            }

            // Sort by name
            warehouses.sort((a, b) => a.name.localeCompare(b.name));

            // Pagination
            const total = warehouses.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedItems = warehouses.slice(startIndex, endIndex);

            const result = {
                warehouses: paginatedItems,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };

            await cache.set(cacheKey, result, this.cacheTTL);
            return result;
        } catch (error) {
            logger.error('Get all warehouses error:', error);
            throw error;
        }
    }

    /**
     * Update warehouse
     * @param {string} id
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateWarehouse(id, updateData) {
        try {
            const doc = await this.db.collection(this.collection).doc(id).get();

            if (!doc.exists) {
                throw new NotFoundError('Warehouse');
            }

            const updates = { ...updateData };
            if (updateData.name) {
                updates.nameLower = updateData.name.toLowerCase();
            }
            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.db.collection(this.collection).doc(id).update(updates);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${id}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getWarehouseById(id);
        } catch (error) {
            logger.error('Update warehouse error:', error);
            throw error;
        }
    }

    /**
     * Delete warehouse
     * @param {string} id
     * @returns {Promise<void>}
     */
    async deleteWarehouse(id) {
        try {
            // Check usage in inventory first (optional safety check)
            const inventoryUsage = await this.db.collection('inventory')
                .where('warehouseId', '==', id)
                .limit(1)
                .get();

            if (!inventoryUsage.empty) {
                throw new ConflictError('Cannot delete warehouse currently used by inventory items.');
            }

            await this.db.collection(this.collection).doc(id).delete();

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${id}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Delete warehouse error:', error);
            throw error;
        }
    }
}

module.exports = new WarehouseService();
