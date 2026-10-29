const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activity-log.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

// Viewing the log: admin and store manager (read-only; nothing here can change anything)
router.use(verifyToken);
router.use(requireRole('admin', 'store_manager'));

/**
 * GET /api/v1/activity-logs
 * Get all activity logs with filtering
 */
router.get('/', activityLogController.getLogs);

module.exports = router;
