const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activity-log.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

// All activity log routes are admin-only
router.use(verifyToken);
router.use(requireRole('admin'));

/**
 * GET /api/v1/activity-logs
 * Get all activity logs with filtering
 */
router.get('/', activityLogController.getLogs);

module.exports = router;
