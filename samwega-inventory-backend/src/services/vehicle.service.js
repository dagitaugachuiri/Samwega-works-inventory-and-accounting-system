const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');

class VehicleService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'vehicles';
        this.cachePrefix = 'vehicle:';
        this.cacheTTL = 300; // 5 minutes
        this.inventoryCacheTTL = 120; // 2 minutes for inventory
    }

    /**
     * Create new vehicle
     * @param {Object} vehicleData
     * @returns {Promise<Object>}
     */
    async createVehicle(vehicleData) {
        try {
            // Check if vehicle number already exists
            const existingVehicle = await this.db.collection(this.collection)
                .where('vehicleNumber', '==', vehicleData.vehicleNumber)
                .limit(1)
                .get();

            if (!existingVehicle.empty) {
                throw new ValidationError('Vehicle number already exists');
            }

            // If user is assigned, get user details
            let assignedUserName = null;
            if (vehicleData.assignedUserId) {
                const userDoc = await this.db.collection('users').doc(vehicleData.assignedUserId).get();
                if (!userDoc.exists) {
                    throw new NotFoundError('Assigned user');
                }
                const userData = userDoc.data();
                assignedUserName = userData.fullName || userData.email;
            }

            const data = {
                vehicleName: vehicleData.vehicleName,
                vehicleNumber: vehicleData.vehicleNumber,
                assignedUserId: vehicleData.assignedUserId || null,
                assignedUserName: assignedUserName,
                isActive: vehicleData.isActive !== undefined ? vehicleData.isActive : true,
                notes: vehicleData.notes || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(data);

            logger.info(`Vehicle created: ${vehicleData.vehicleName}`, { id: docRef.id });

            // Invalidate list cache
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getVehicleById(docRef.id);
        } catch (error) {
            logger.error('Create vehicle error:', error);
            throw error;
        }
    }

    /**
     * Get vehicle by ID
     * @param {string} vehicleId
     * @returns {Promise<Object>}
     */
    async getVehicleById(vehicleId) {
        try {
            // Try cache first
            const cacheKey = `${this.cachePrefix}${vehicleId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(vehicleId).get();

            if (!doc.exists) {
                throw new NotFoundError('Vehicle');
            }

            const vehicle = serializeDoc(doc);

            // Cache the result
            await cache.set(cacheKey, vehicle, this.cacheTTL);

            return vehicle;
        } catch (error) {
            logger.error('Get vehicle error:', error);
            throw error;
        }
    }

    /**
     * Get all vehicles with filters and pagination
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAllVehicles(filters = {}) {
        try {
            logger.info('VehicleService.getAllVehicles: Starting...', { filters });
            const {
                search,
                assignedUserId,
                isActive,
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            // Create cache key from filters
            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) {
                logger.info('VehicleService.getAllVehicles: Returning cached result');
                return cached;
            }

            logger.info('VehicleService.getAllVehicles: Building query...');
            let query = this.db.collection(this.collection);

            // Apply filters
            if (assignedUserId) {
                query = query.where('assignedUserId', '==', assignedUserId);
            }
            if (isActive !== undefined) {
                query = query.where('isActive', '==', isActive);
            }

            // Get all matching documents
            logger.info('VehicleService.getAllVehicles: Executing Firestore query...');
            const snapshot = await query.get();
            logger.info('VehicleService.getAllVehicles: Query complete', { docCount: snapshot.size });
            let vehicles = serializeDocs(snapshot);

            // Apply search filter (client-side)
            if (search) {
                const searchLower = search.toLowerCase();
                vehicles = vehicles.filter(vehicle =>
                    vehicle.vehicleName?.toLowerCase().includes(searchLower) ||
                    vehicle.vehicleNumber?.toLowerCase().includes(searchLower) ||
                    vehicle.assignedUserName?.toLowerCase().includes(searchLower)
                );
            }

            // Sort vehicles
            vehicles.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];

                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            // Calculate pagination
            const total = vehicles.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedVehicles = vehicles.slice(startIndex, endIndex);

            const result = {
                vehicles: paginatedVehicles,
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
            logger.error('Get all vehicles error:', error);
            throw error;
        }
    }

    /**
     * Update vehicle
     * @param {string} vehicleId
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateVehicle(vehicleId, updateData) {
        try {
            const doc = await this.db.collection(this.collection).doc(vehicleId).get();

            if (!doc.exists) {
                throw new NotFoundError('Vehicle');
            }

            // If updating vehicle number, check for duplicates
            if (updateData.vehicleNumber) {
                const existingVehicle = await this.db.collection(this.collection)
                    .where('vehicleNumber', '==', updateData.vehicleNumber)
                    .limit(1)
                    .get();

                if (!existingVehicle.empty && existingVehicle.docs[0].id !== vehicleId) {
                    throw new ValidationError('Vehicle number already exists');
                }
            }

            const updates = { ...updateData };

            // If updating assigned user, get user details
            if (updateData.assignedUserId) {
                const userDoc = await this.db.collection('users').doc(updateData.assignedUserId).get();
                if (!userDoc.exists) {
                    throw new NotFoundError('Assigned user');
                }
                const userData = userDoc.data();
                updates.assignedUserName = userData.fullName || userData.email;
            } else if (updateData.assignedUserId === null) {
                updates.assignedUserName = null;
            }

            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.db.collection(this.collection).doc(vehicleId).update(updates);

            logger.info(`Vehicle updated: ${vehicleId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${vehicleId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
            await cache.delPattern(`${this.cachePrefix}inventory:${vehicleId}*`);

            return await this.getVehicleById(vehicleId);
        } catch (error) {
            logger.error('Update vehicle error:', error);
            throw error;
        }
    }

    /**
     * Delete vehicle (soft delete)
     * @param {string} vehicleId
     * @returns {Promise<void>}
     */
    async deleteVehicle(vehicleId) {
        try {
            const doc = await this.db.collection(this.collection).doc(vehicleId).get();

            if (!doc.exists) {
                throw new NotFoundError('Vehicle');
            }

            // Check if vehicle has active transfers
            const activeTransfers = await this.db.collection('stock_transfers')
                .where('vehicleId', '==', vehicleId)
                .where('status', 'in', ['pending', 'approved'])
                .limit(1)
                .get();

            if (!activeTransfers.empty) {
                throw new ValidationError('Cannot delete vehicle with active transfers');
            }

            // Soft delete by setting isActive to false
            await this.db.collection(this.collection).doc(vehicleId).update({
                isActive: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`Vehicle deleted (soft): ${vehicleId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${vehicleId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Delete vehicle error:', error);
            throw error;
        }
    }

    /**
     * Assign user to vehicle
     * @param {string} vehicleId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async assignUser(vehicleId, userId) {
        try {
            const vehicleDoc = await this.db.collection(this.collection).doc(vehicleId).get();

            if (!vehicleDoc.exists) {
                throw new NotFoundError('Vehicle');
            }

            const userDoc = await this.db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }

            const userData = userDoc.data();
            const assignedUserName = userData.fullName || userData.email;

            await this.db.collection(this.collection).doc(vehicleId).update({
                assignedUserId: userId,
                assignedUserName: assignedUserName,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`User ${userId} assigned to vehicle ${vehicleId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${vehicleId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getVehicleById(vehicleId);
        } catch (error) {
            logger.error('Assign user to vehicle error:', error);
            throw error;
        }
    }

    /**
     * Unassign user from vehicle
     * @param {string} vehicleId
     * @returns {Promise<void>}
     */
    async unassignUser(vehicleId) {
        try {
            const docRef = this.db.collection(this.collection).doc(vehicleId);
            const doc = await docRef.get();

            if (!doc.exists) {
                logger.warn(`Attempted to unassign user from non-existent vehicle: ${vehicleId}`);
                return;
            }

            await docRef.update({
                assignedUserId: null,
                assignedUserName: null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`User unassigned from vehicle ${vehicleId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${vehicleId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Unassign user from vehicle error:', error);
            throw error;
        }
    }

    /**
     * Get vehicle inventory
     * @param {string} vehicleId
     * @returns {Promise<Array>}
     */
    async getVehicleInventory(vehicleId) {
        try {
            // Verify vehicle exists
            const vehicleDoc = await this.db.collection(this.collection).doc(vehicleId).get();
            if (!vehicleDoc.exists) {
                throw new NotFoundError('Vehicle');
            }

            // Try cache first
            const cacheKey = `${this.cachePrefix}inventory:${vehicleId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const snapshot = await this.db.collection('vehicle_inventory')
                .where('vehicleId', '==', vehicleId)
                .get();

            const inventory = serializeDocs(snapshot);
            return inventory;
        } catch (error) {
            logger.error('Get vehicle inventory error:', error);
            throw error;
        }
    }

    /**
     * Get vehicle issuances (stock transfers history)
     * @param {string} vehicleId
     * @returns {Promise<Array>}
     */
    async getVehicleIssuances(vehicleId) {
        try {
            // Verify vehicle exists
            const vehicleDoc = await this.db.collection(this.collection).doc(vehicleId).get();
            if (!vehicleDoc.exists) {
                throw new NotFoundError('Vehicle');
            }

            // Try cache first
            const cacheKey = `${this.cachePrefix}issuances:${vehicleId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Query stock_transfers where vehicleId matches
            // We want all transfers that are NOT collected yet? Or all history?
            // StockScreen uses it for "Recent Issuances" list and stats.
            // Let's return all transfers for this vehicle ordered by date
            const snapshot = await this.db.collection('stock_transfers')
                .where('vehicleId', '==', vehicleId)
                .orderBy('issuedAt', 'desc')
                .limit(20) // Limit to last 20 for performance
                .get();

            const issuances = serializeDocs(snapshot);

            // Cache result
            await cache.set(cacheKey, issuances, this.cacheTTL);

            return issuances;
        } catch (error) {
            logger.error('Get vehicle issuances error:', error);
            throw error;
        }
    }
}

module.exports = new VehicleService();
