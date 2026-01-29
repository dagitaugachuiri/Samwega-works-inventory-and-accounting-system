const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');

class StoreLocationService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'storeLocations';
        this.cachePrefix = 'store:';
        this.cacheTTL = 600; // 10 minutes
    }

    /**
     * Create new store location
     * @param {Object} locationData - { name, description, isActive }
     * @returns {Promise<Object>}
     */
    async createLocation(locationData) {
        try {
            // Check for duplicate name
            const existing = await this.db.collection(this.collection)
                .where('name', '==', locationData.name)
                .limit(1)
                .get();

            if (!existing.empty) {
                throw new ConflictError('Store location with this name already exists');
            }

            const data = {
                ...locationData,
                nameLower: locationData.name.toLowerCase(),
                isActive: locationData.isActive !== undefined ? locationData.isActive : true,
                itemCount: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(data);

            logger.info(`Store location created: ${locationData.name}`, { id: docRef.id });

            await cache.delPattern(`${this.cachePrefix}*`);

            return await this.getLocationById(docRef.id);
        } catch (error) {
            logger.error('Create store location error:', error);
            throw error;
        }
    }

    /**
     * Get location by ID
     * @param {string} locationId
     * @returns {Promise<Object>}
     */
    async getLocationById(locationId) {
        try {
            const cacheKey = `${this.cachePrefix}${locationId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(locationId).get();

            if (!doc.exists) {
                throw new NotFoundError('Store location not found');
            }

            const data = serializeDoc(doc);
            await cache.set(cacheKey, data, this.cacheTTL);

            return data;
        } catch (error) {
            logger.error('Get store location error:', error);
            throw error;
        }
    }

    /**
     * Get all locations
     * @param {Object} filters - { isActive }
     * @returns {Promise<Array>}
     */
    async getAllLocations(filters = {}) {
        try {
            let query = this.db.collection(this.collection);

            if (filters.isActive !== undefined) {
                query = query.where('isActive', '==', filters.isActive);
            }

            query = query.orderBy('name', 'asc');

            const snapshot = await query.get();
            return serializeDocs(snapshot);
        } catch (error) {
            logger.error('Get all locations error:', error);
            throw error;
        }
    }

    /**
     * Update location
     * @param {string} locationId
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateLocation(locationId, updateData) {
        try {
            await this.getLocationById(locationId);

            const data = {
                ...updateData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (updateData.name) {
                data.nameLower = updateData.name.toLowerCase();
            }

            await this.db.collection(this.collection).doc(locationId).update(data);

            logger.info(`Store location updated: ${locationId}`);

            await cache.del(`${this.cachePrefix}${locationId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getLocationById(locationId);
        } catch (error) {
            logger.error('Update store location error:', error);
            throw error;
        }
    }

    /**
     * Delete location
     * @param {string} locationId
     * @returns {Promise<void>}
     */
    async deleteLocation(locationId) {
        try {
            const location = await this.getLocationById(locationId);

            // Check if location has items
            if (location.itemCount > 0) {
                throw new ConflictError('Cannot delete location with existing items');
            }

            await this.db.collection(this.collection).doc(locationId).delete();

            logger.info(`Store location deleted: ${locationId}`);

            await cache.del(`${this.cachePrefix}${locationId}`);
            await cache.delPattern(`${this.cachePrefix}*`);
        } catch (error) {
            logger.error('Delete store location error:', error);
            throw error;
        }
    }

    /**
     * Increment item count for location
     * @param {string} locationId
     * @param {number} delta
     */
    async updateItemCount(locationId, delta = 1) {
        try {
            await this.db.collection(this.collection).doc(locationId).update({
                itemCount: admin.firestore.FieldValue.increment(delta),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            await cache.del(`${this.cachePrefix}${locationId}`);
        } catch (error) {
            logger.error('Update item count error:', error);
            // Don't throw - this is a stats update
        }
    }
}

module.exports = new StoreLocationService();
