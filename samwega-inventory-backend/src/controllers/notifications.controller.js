const notificationsService = require('../services/notifications.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get notifications
 */
const getNotifications = async (req, res) => {
    try {
        const result = await notificationsService.getNotifications(req.user.uid, req.query);
        return successResponse(res, result, 'Notifications retrieved successfully');
    } catch (error) {
        logger.error('Get notifications controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Mark notification as read
 */
const markAsRead = async (req, res) => {
    try {
        const notification = await notificationsService.markAsRead(req.params.id, req.user.uid);
        return successResponse(res, notification, 'Notification marked as read');
    } catch (error) {
        logger.error('Mark as read controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Delete notification
 */
const deleteNotification = async (req, res) => {
    try {
        await notificationsService.deleteNotification(req.params.id, req.user.uid);
        return successResponse(res, null, 'Notification deleted successfully');
    } catch (error) {
        logger.error('Delete notification controller error:', error);
        return errorResponse(res, error);
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    deleteNotification
};
