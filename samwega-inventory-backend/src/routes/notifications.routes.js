const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');
const { verifyToken, requireVerified } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user notifications
 * @access  All verified users
 */
router.get(
    '/',
    verifyToken,
    requireVerified,
    notificationsController.getNotifications
);

/**
 * @route   POST /api/v1/notifications/:id/read
 * @desc    Mark notification as read
 * @access  All verified users
 */
router.post(
    '/:id/read',
    verifyToken,
    requireVerified,
    notificationsController.markAsRead
);

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete notification
 * @access  All verified users
 */
router.delete(
    '/:id',
    verifyToken,
    requireVerified,
    notificationsController.deleteNotification
);

module.exports = router;
