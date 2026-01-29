const reconciliationService = require('../services/reconciliation.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Create daily reconciliation
 */
const createDailyReconciliation = async (req, res) => {
    try {
        const reconciliation = await reconciliationService.createDailyReconciliation(req.body, req.user.uid);
        return successResponse(res, reconciliation, 'Reconciliation created successfully', 201);
    } catch (error) {
        logger.error('Create reconciliation controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Approve or reject reconciliation
 */
const approveDailyReconciliation = async (req, res) => {
    try {
        const { approved, rejectionReason, notes } = req.body;
        const reconciliation = await reconciliationService.approveDailyReconciliation(
            req.params.id,
            approved,
            req.user.uid,
            rejectionReason,
            notes
        );
        return successResponse(res, reconciliation, `Reconciliation ${approved ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
        logger.error('Approve reconciliation controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Get reconciliation by ID
 */
const getReconciliationById = async (req, res) => {
    try {
        const reconciliation = await reconciliationService.getReconciliationById(req.params.id);
        return successResponse(res, reconciliation, 'Reconciliation retrieved successfully');
    } catch (error) {
        logger.error('Get reconciliation by ID controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Get all reconciliations
 */
const getAllReconciliations = async (req, res) => {
    try {
        const result = await reconciliationService.getAllReconciliations(req.query, req.user.uid, req.user.role);
        return successResponse(res, result, 'Reconciliations retrieved successfully');
    } catch (error) {
        logger.error('Get all reconciliations controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Get reconciliation report
 */
const getReconciliationReport = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate } = req.query;
        const report = await reconciliationService.getReconciliationReport(vehicleId, startDate, endDate);
        return successResponse(res, report, 'Reconciliation report retrieved successfully');
    } catch (error) {
        logger.error('Get reconciliation report controller error:', error);
        return errorResponse(res, error);
    }
};

module.exports = {
    createDailyReconciliation,
    approveDailyReconciliation,
    getReconciliationById,
    getAllReconciliations,
    getReconciliationReport
};
