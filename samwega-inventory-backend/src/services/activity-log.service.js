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
     * Activity log with real pagination and search.
     *
     * Firestore cannot search inside text, so we read the newest entries in a DATE WINDOW
     * (last 30 days unless dates are given), capped at MAX_SCAN, and filter/search those here.
     * Only one field (createdAt) is queried, so no extra Firestore indexes are needed.
     * @returns {Promise<{logs: Array, pagination: Object, truncated: boolean, since: string}>}
     */
    async getLogs(options = {}) {
        try {
            const MAX_SCAN = 5000;
            const page = Math.max(1, parseInt(options.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 30));
            const { userId, action, resource, search } = options;

            const since = options.startDate
                ? new Date(options.startDate)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            let query = this.db.collection(this.collection).where('createdAt', '>=', since);
            if (options.endDate) query = query.where('createdAt', '<=', new Date(options.endDate));
            query = query.orderBy('createdAt', 'desc').limit(MAX_SCAN);

            const snapshot = await query.get();
            const toTime = (v) => {
                if (!v) return null;
                if (typeof v.toDate === 'function') return v.toDate();
                if (v._seconds !== undefined) return new Date(v._seconds * 1000);
                return new Date(v);
            };

            let logs = snapshot.docs.map(doc => {
                const x = doc.data();
                const when = toTime(x.createdAt) || toTime(x.timestamp);
                return { id: doc.id, ...x, createdAt: when, timestamp: when };
            });

            if (userId) logs = logs.filter(l => l.userId === userId);
            if (action) logs = logs.filter(l => l.action === String(action).toUpperCase());
            if (resource) logs = logs.filter(l => l.resource === String(resource).toLowerCase());
            if (search && String(search).trim()) {
                const terms = String(search).toLowerCase().split(/\s+/).filter(Boolean);
                logs = logs.filter(l => {
                    const hay = [l.username, l.description, l.action, l.resource, l.details && l.details.identifier]
                        .filter(Boolean).join(' ').toLowerCase();
                    return terms.every(t => hay.includes(t));
                });
            }

            const total = logs.length;
            const start = (page - 1) * limit;
            return {
                logs: logs.slice(start, start + limit),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.max(1, Math.ceil(total / limit)),
                    hasNextPage: start + limit < total,
                    hasPrevPage: page > 1
                },
                truncated: snapshot.size >= MAX_SCAN,
                since: since.toISOString()
            };
        } catch (error) {
            logger.error('Error getting activity logs:', error);
            throw error;
        }
    }
}

module.exports = new ActivityLogService();
