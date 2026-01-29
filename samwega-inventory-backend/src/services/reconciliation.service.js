const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError, UnauthorizedError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const vehicleService = require('./vehicle.service');
const salesService = require('./sales.service');

class ReconciliationService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'daily_reconciliations';
        this.cachePrefix = 'reconciliation:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Create daily reconciliation
     * @param {Object} reconciliationData
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async createDailyReconciliation(reconciliationData, userId) {
        try {
            const { vehicleId, date, expectedCash, actualCash, cashVariance,
                varianceReason = '', stockDiscrepancies = [], notes = '' } = reconciliationData;

            // Get user details
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }
            const userData = userDoc.data();

            // Verify vehicle exists and user is assigned
            const vehicle = await vehicleService.getVehicleById(vehicleId);
            if (vehicle.assignedUserId !== userId && userData.role !== 'admin' && userData.role !== 'store_manager') {
                throw new UnauthorizedError('You can only create reconciliations for your assigned vehicle');
            }

            // Check if reconciliation already exists for this date
            const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
            const existingSnapshot = await this.db.collection(this.collection)
                .where('vehicleId', '==', vehicleId)
                .where('date', '==', dateStr)
                .limit(1)
                .get();

            if (!existingSnapshot.empty) {
                throw new ValidationError(`Reconciliation already exists for ${dateStr}`);
            }

            // Get daily summary
            const dailySummary = await salesService.getDailySummary(vehicleId, dateStr);

            // Create reconciliation record
            const reconciliationData = {
                vehicleId,
                vehicleName: vehicle.vehicleName,
                salesRepId: userId,
                salesRepName: userData.fullName || userData.email,
                date: dateStr,

                // Sales summary
                totalSales: dailySummary.totalSales || 0,
                totalTransactions: dailySummary.totalTransactions || 0,
                cashSales: dailySummary.cashSales || 0,
                mpesaSales: dailySummary.mpesaSales || 0,
                bankSales: dailySummary.bankSales || 0,
                creditSales: dailySummary.creditSales || 0,
                mixedSales: dailySummary.mixedSales || 0,

                // Cash reconciliation
                expectedCash,
                actualCash,
                cashVariance,
                varianceReason,

                // Stock discrepancies
                stockDiscrepancies,

                // Status
                status: 'pending',
                submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                approvedBy: null,
                approvedByName: null,
                approvedAt: null,
                rejectionReason: null,

                notes,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(reconciliationData);

            logger.info(`Reconciliation created for ${vehicleId} on ${dateStr}`, { id: docRef.id });

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);

            return await this.getReconciliationById(docRef.id);
        } catch (error) {
            logger.error('Create daily reconciliation error:', error);
            throw error;
        }
    }

    /**
     * Approve or reject daily reconciliation
     * @param {string} reconciliationId
     * @param {boolean} approved
     * @param {string} managerId
     * @param {string} rejectionReason
     * @param {string} notes
     * @returns {Promise<Object>}
     */
    async approveDailyReconciliation(reconciliationId, approved, managerId, rejectionReason = '', notes = '') {
        try {
            const reconciliation = await this.getReconciliationById(reconciliationId);

            if (reconciliation.status !== 'pending') {
                throw new ValidationError(`Reconciliation is already ${reconciliation.status}`);
            }

            // Get manager details
            const managerDoc = await this.db.collection('users').doc(managerId).get();
            if (!managerDoc.exists) {
                throw new NotFoundError('Manager');
            }
            const managerData = managerDoc.data();
            const managerName = managerData.fullName || managerData.email;

            // If approved and there are stock discrepancies, update vehicle inventory
            if (approved && reconciliation.stockDiscrepancies.length > 0) {
                await this.db.runTransaction(async (transaction) => {
                    for (const discrepancy of reconciliation.stockDiscrepancies) {
                        const vehicleInventoryQuery = await this.db.collection('vehicle_inventory')
                            .where('vehicleId', '==', reconciliation.vehicleId)
                            .where('inventoryId', '==', discrepancy.inventoryId)
                            .limit(1)
                            .get();

                        if (!vehicleInventoryQuery.empty) {
                            const vehicleInventoryDoc = vehicleInventoryQuery.docs[0];
                            const vehicleInventoryData = vehicleInventoryDoc.data();
                            const layers = vehicleInventoryData.layers || [];

                            // Update layer with physical stock count
                            const updatedLayers = layers.map(layer => {
                                if (layer.layerIndex === discrepancy.layerIndex) {
                                    return {
                                        ...layer,
                                        quantity: discrepancy.physicalStock
                                    };
                                }
                                return layer;
                            });

                            transaction.update(vehicleInventoryDoc.ref, {
                                layers: updatedLayers,
                                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    }

                    // Update reconciliation status
                    const reconciliationRef = this.db.collection(this.collection).doc(reconciliationId);
                    transaction.update(reconciliationRef, {
                        status: approved ? 'approved' : 'rejected',
                        approvedBy: managerId,
                        approvedByName: managerName,
                        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                        rejectionReason: approved ? null : rejectionReason,
                        approvalNotes: notes,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
            } else {
                // Just update status without inventory changes
                await this.db.collection(this.collection).doc(reconciliationId).update({
                    status: approved ? 'approved' : 'rejected',
                    approvedBy: managerId,
                    approvedByName: managerName,
                    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                    rejectionReason: approved ? null : rejectionReason,
                    approvalNotes: notes,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            logger.info(`Reconciliation ${approved ? 'approved' : 'rejected'}: ${reconciliationId}`, { managerId });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${reconciliationId}`);
            await cache.delPattern(`${this.cachePrefix}*`);
            if (approved && reconciliation.stockDiscrepancies.length > 0) {
                await cache.delPattern(`vehicle:inventory:${reconciliation.vehicleId}*`);
            }

            return await this.getReconciliationById(reconciliationId);
        } catch (error) {
            logger.error('Approve daily reconciliation error:', error);
            throw error;
        }
    }

    /**
     * Get reconciliation by ID
     * @param {string} reconciliationId
     * @returns {Promise<Object>}
     */
    async getReconciliationById(reconciliationId) {
        try {
            const cacheKey = `${this.cachePrefix}${reconciliationId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(reconciliationId).get();

            if (!doc.exists) {
                throw new NotFoundError('Reconciliation');
            }

            const reconciliation = serializeDoc(doc);

            // Cache the result
            await cache.set(cacheKey, reconciliation, this.cacheTTL);

            return reconciliation;
        } catch (error) {
            logger.error('Get reconciliation by ID error:', error);
            throw error;
        }
    }

    /**
     * Get all reconciliations with filters
     * @param {Object} filters
     * @param {string} userId
     * @param {string} userRole
     * @returns {Promise<Object>}
     */
    async getAllReconciliations(filters = {}, userId, userRole) {
        try {
            const {
                vehicleId,
                salesRepId,
                status,
                startDate,
                endDate,
                page = 1,
                limit = 20,
                sortBy = 'date',
                sortOrder = 'desc'
            } = filters;

            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}:${userId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection);

            // Apply role-based filtering
            if (userRole === 'sales_rep') {
                query = query.where('salesRepId', '==', userId);
            } else if (salesRepId) {
                query = query.where('salesRepId', '==', salesRepId);
            }

            // Apply filters
            if (vehicleId) {
                query = query.where('vehicleId', '==', vehicleId);
            }
            if (status) {
                query = query.where('status', '==', status);
            }
            if (startDate) {
                query = query.where('date', '>=', startDate);
            }
            if (endDate) {
                query = query.where('date', '<=', endDate);
            }

            // Get all matching documents
            const snapshot = await query.get();
            let reconciliations = serializeDocs(snapshot);

            // Sort reconciliations
            reconciliations.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];

                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            // Calculate pagination
            const total = reconciliations.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedReconciliations = reconciliations.slice(startIndex, endIndex);

            const result = {
                reconciliations: paginatedReconciliations,
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
            logger.error('Get all reconciliations error:', error);
            throw error;
        }
    }

    /**
     * Get reconciliation report for a vehicle
     * @param {string} vehicleId
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async getReconciliationReport(vehicleId, startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}report:${vehicleId}:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const snapshot = await this.db.collection(this.collection)
                .where('vehicleId', '==', vehicleId)
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .orderBy('date', 'desc')
                .get();

            const reconciliations = serializeDocs(snapshot);

            // Calculate summary statistics
            const summary = {
                totalReconciliations: reconciliations.length,
                approved: reconciliations.filter(r => r.status === 'approved').length,
                pending: reconciliations.filter(r => r.status === 'pending').length,
                rejected: reconciliations.filter(r => r.status === 'rejected').length,
                totalSales: reconciliations.reduce((sum, r) => sum + (r.totalSales || 0), 0),
                totalCashVariance: reconciliations.reduce((sum, r) => sum + (r.cashVariance || 0), 0),
                totalStockDiscrepancies: reconciliations.reduce((sum, r) => sum + (r.stockDiscrepancies?.length || 0), 0)
            };

            const report = {
                vehicleId,
                startDate,
                endDate,
                summary,
                reconciliations
            };

            // Cache the result
            await cache.set(cacheKey, report, this.cacheTTL);

            return report;
        } catch (error) {
            logger.error('Get reconciliation report error:', error);
            throw error;
        }
    }
}

module.exports = new ReconciliationService();
