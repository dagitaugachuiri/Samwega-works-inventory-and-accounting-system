const analyticsService = require('../services/analytics.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get dashboard overview
 */
const getDashboardOverview = async (req, res) => {
    try {
        const overview = await analyticsService.getDashboardOverview();
        return successResponse(res, overview, 'Dashboard overview retrieved successfully');
    } catch (error) {
        logger.error('Get dashboard overview controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Get sales analytics
 */
const getSalesAnalytics = async (req, res) => {
    try {
        const analytics = await analyticsService.getSalesAnalytics(req.query);
        return successResponse(res, analytics, 'Sales analytics retrieved successfully');
    } catch (error) {
        logger.error('Get sales analytics controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Get inventory analytics
 */
const getInventoryAnalytics = async (req, res) => {
    try {
        const analytics = await analyticsService.getInventoryAnalytics();
        return successResponse(res, analytics, 'Inventory analytics retrieved successfully');
    } catch (error) {
        logger.error('Get inventory analytics controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Get vehicle analytics
 */
const getVehicleAnalytics = async (req, res) => {
    try {
        const analytics = await analyticsService.getVehicleAnalytics(req.query);
        return successResponse(res, analytics, 'Vehicle analytics retrieved successfully');
    } catch (error) {
        logger.error('Get vehicle analytics controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Get sales rep analytics
 */
const getSalesRepAnalytics = async (req, res) => {
    try {
        const analytics = await analyticsService.getSalesRepAnalytics(req.query);
        return successResponse(res, analytics, 'Sales rep analytics retrieved successfully');
    } catch (error) {
        logger.error('Get sales rep analytics controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Get profit analytics
 */
const getProfitAnalytics = async (req, res) => {
    try {
        const analytics = await analyticsService.getProfitAnalytics(req.query);
        return successResponse(res, analytics, 'Profit analytics retrieved successfully');
    } catch (error) {
        logger.error('Get profit analytics controller error:', error);
        return errorResponse(res, error);
    }
};

module.exports = {
    getDashboardOverview,
    getSalesAnalytics,
    getInventoryAnalytics,
    getVehicleAnalytics,
    getSalesRepAnalytics,
    getProfitAnalytics
};
