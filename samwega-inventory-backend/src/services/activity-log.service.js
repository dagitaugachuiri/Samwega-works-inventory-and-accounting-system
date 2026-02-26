const { getFirestore } = require('../config/firebase.config');
const admin = require('firebase-admin');
const logger = require('../utils/logger');

class ActivityLogService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'activity_logs';
    }

    /**
     * Log a user activity
     * @param {Object} logData
     * @param {string} logData.userId - ID of the user performing the action
     * @param {string} logData.username - Name/Email of the user
     * @param {string} logData.action - Type of action (e.g., 'CREATE', 'UPDATE', 'DELETE', 'VOID', 'LOGIN')
     * @param {string} logData.resource - Affected resource (e.g., 'invoice', 'sale', 'expense', 'user')
     * @param {string} [logData.resourceId] - ID of the affected resource
     * @param {string} [logData.description] - Human readable description
     * @param {Object} [logData.details] - Additional JSON data
     */
    async log(logData) {
        try {
            const { userId, username, action, resource, resourceId, description, details } = logData;

            if (!userId || !action || !resource) {
                logger.error('Missing required fields for activity log', logData);
                return;
            }

            const docRef = this.db.collection(this.collection).doc();
            const logEntry = {
                userId,
                username: username || 'Unknown',
                action: action.toUpperCase(),
                resource: resource.toLowerCase(),
                resourceId: resourceId || null,
                description: description || `${action} action on ${resource}`,
                details: details || {},
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: new Date()
            };

            await docRef.set(logEntry);
            logger.debug(`Activity logged: ${action} ${resource} by ${username}`);
        } catch (error) {
            logger.error('Error writing activity log:', error);
            // Don't throw - we don't want to break the main flow if logging fails
        }
    }

    /**
     * Get recent logs for admin view
     */
    async getLogs(options = {}) {
        try {
            const { limit = 50, offset = 0, userId, action, resource, startDate, endDate } = options;

            let query = this.db.collection(this.collection).orderBy('timestamp', 'desc');

            if (userId) query = query.where('userId', '==', userId);
            if (action) query = query.where('action', '==', action.toUpperCase());
            if (resource) query = query.where('resource', '==', resource.toLowerCase());

            if (startDate) {
                query = query.where('createdAt', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('createdAt', '<=', new Date(endDate));
            }

            const snapshot = await query.limit(limit).offset(offset).get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || doc.data().createdAt
            }));
        } catch (error) {
            logger.error('Error getting activity logs:', error);
            throw error;
        }
    }
}

module.exports = new ActivityLogService();
