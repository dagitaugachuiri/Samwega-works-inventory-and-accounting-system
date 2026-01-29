const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { verifyToken, requireRole, requireVerified } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get dashboard overview
 * @access  All verified users
 */
router.get(
    '/dashboard',
    verifyToken,
    requireVerified,
    analyticsController.getDashboardOverview
);

/**
 * @route   GET /api/v1/analytics/sales
 * @desc    Get sales analytics
 * @access  Admin, Store Manager
 */
router.get(
    '/sales',
    verifyToken,
    requireRole('admin', 'store_manager'),
    analyticsController.getSalesAnalytics
);

/**
 * @route   GET /api/v1/analytics/inventory
 * @desc    Get inventory analytics
 * @access  Admin, Store Manager
 */
router.get(
    '/inventory',
    verifyToken,
    requireRole('admin', 'store_manager'),
    analyticsController.getInventoryAnalytics
);

/**
 * @route   GET /api/v1/analytics/vehicles
 * @desc    Get vehicle analytics
 * @access  Admin, Store Manager
 */
router.get(
    '/vehicles',
    verifyToken,
    requireRole('admin', 'store_manager'),
    analyticsController.getVehicleAnalytics
);

/**
 * @route   GET /api/v1/analytics/salesreps
 * @desc    Get sales rep analytics
 * @access  Admin, Store Manager
 */
router.get(
    '/salesreps',
    verifyToken,
    requireRole('admin', 'store_manager'),
    analyticsController.getSalesRepAnalytics
);

/**
 * @route   GET /api/v1/analytics/profit
 * @desc    Get profit analytics
 * @access  Admin only
 */
router.get(
    '/profit',
    verifyToken,
    requireRole('admin'),
    analyticsController.getProfitAnalytics
);

module.exports = router;
