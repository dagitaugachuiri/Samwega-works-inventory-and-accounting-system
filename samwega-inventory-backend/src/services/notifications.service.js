const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const { NotFoundError } = require('../utils/errors');

class NotificationsService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'notifications';
        this.cachePrefix = 'notification:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Create notification
     * @param {string} userId
     * @param {string} type
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createNotification(userId, type, data) {
        try {
            const notification = {
                userId,
                type,
                title: data.title,
                message: data.message,
                data: data.data || {},
                isRead: false,
                readAt: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(notification);

            logger.info(`Notification created for user ${userId}`, { type, id: docRef.id });

            // Invalidate user's notification cache
            await cache.delPattern(`${this.cachePrefix}user:${userId}*`);

            return await this.getNotificationById(docRef.id);
        } catch (error) {
            logger.error('Create notification error:', error);
            throw error;
        }
    }

    /**
     * Get notification by ID
     * @param {string} notificationId
     * @returns {Promise<Object>}
     */
    async getNotificationById(notificationId) {
        try {
            const doc = await this.db.collection(this.collection).doc(notificationId).get();

            if (!doc.exists) {
                throw new NotFoundError('Notification');
            }

            return serializeDoc(doc);
        } catch (error) {
            logger.error('Get notification by ID error:', error);
            throw error;
        }
    }

    /**
     * Get notifications for user
     * @param {string} userId
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getNotifications(userId, filters = {}) {
        try {
            const { type, isRead, page = 1, limit = 20 } = filters;

            const cacheKey = `${this.cachePrefix}user:${userId}:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection)
                .where('userId', '==', userId);

            if (type) {
                query = query.where('type', '==', type);
            }
            if (isRead !== undefined) {
                query = query.where('isRead', '==', isRead);
            }

            query = query.orderBy('createdAt', 'desc');

            const snapshot = await query.get();
            let notifications = serializeDocs(snapshot);

            // Pagination
            const total = notifications.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedNotifications = notifications.slice(startIndex, endIndex);

            const result = {
                notifications: paginatedNotifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: endIndex < total,
                    hasPrevPage: page > 1
                },
                unreadCount: notifications.filter(n => !n.isRead).length
            };

            // Cache for 5 minutes
            await cache.set(cacheKey, result, this.cacheTTL);

            return result;
        } catch (error) {
            logger.error('Get notifications error:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     * @param {string} notificationId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async markAsRead(notificationId, userId) {
        try {
            const notification = await this.getNotificationById(notificationId);

            if (notification.userId !== userId) {
                throw new NotFoundError('Notification');
            }

            await this.db.collection(this.collection).doc(notificationId).update({
                isRead: true,
                readAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`Notification marked as read: ${notificationId}`);

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}user:${userId}*`);

            return await this.getNotificationById(notificationId);
        } catch (error) {
            logger.error('Mark as read error:', error);
            throw error;
        }
    }

    /**
     * Delete notification
     * @param {string} notificationId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async deleteNotification(notificationId, userId) {
        try {
            const notification = await this.getNotificationById(notificationId);

            if (notification.userId !== userId) {
                throw new NotFoundError('Notification');
            }

            await this.db.collection(this.collection).doc(notificationId).delete();

            logger.info(`Notification deleted: ${notificationId}`);

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}user:${userId}*`);
        } catch (error) {
            logger.error('Delete notification error:', error);
            throw error;
        }
    }

    /**
     * Send low stock alert
     * @param {Object} item
     * @returns {Promise<void>}
     */
    async sendLowStockAlert(item) {
        try {
            // Get admin and store manager users
            const usersSnapshot = await this.db.collection('users')
                .where('role', 'in', ['admin', 'store_manager'])
                .get();
            const users = serializeDocs(usersSnapshot);

            // Create notification for each admin/manager
            for (const user of users) {
                await this.createNotification(user.id, 'low_stock', {
                    title: 'Low Stock Alert',
                    message: `${item.productName} is running low (${item.stock} units remaining)`,
                    data: {
                        itemId: item.id,
                        productName: item.productName,
                        currentStock: item.stock,
                        reorderLevel: item.reorderLevel || 10
                    }
                });
            }

            logger.info(`Low stock alerts sent for ${item.productName}`);
        } catch (error) {
            logger.error('Send low stock alert error:', error);
            throw error;
        }
    }

    /**
     * Send reconciliation reminder
     * @param {string} vehicleId
     * @param {string} salesRepId
     * @returns {Promise<void>}
     */
    async sendReconciliationReminder(vehicleId, salesRepId) {
        try {
            const vehicleDoc = await this.db.collection('vehicles').doc(vehicleId).get();
            if (!vehicleDoc.exists) return;

            const vehicle = serializeDoc(vehicleDoc);

            await this.createNotification(salesRepId, 'reconciliation_reminder', {
                title: 'Daily Reconciliation Reminder',
                message: `Please submit your daily reconciliation for ${vehicle.vehicleName}`,
                data: {
                    vehicleId,
                    vehicleName: vehicle.vehicleName
                }
            });

            logger.info(`Reconciliation reminder sent for vehicle ${vehicleId}`);
        } catch (error) {
            logger.error('Send reconciliation reminder error:', error);
            throw error;
        }
    }

    /**
     * Send sales milestone notification
     * @param {string} userId
     * @param {Object} milestone
     * @returns {Promise<void>}
     */
    async sendSalesMilestone(userId, milestone) {
        try {
            await this.createNotification(userId, 'sales_milestone', {
                title: 'Sales Milestone Achieved!',
                message: milestone.message,
                data: milestone.data
            });

            logger.info(`Sales milestone notification sent to user ${userId}`);
        } catch (error) {
            logger.error('Send sales milestone error:', error);
            throw error;
        }
    }
}

module.exports = new NotificationsService();
