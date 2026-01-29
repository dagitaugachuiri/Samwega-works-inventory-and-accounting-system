const express = require('express');
const router = express.Router();
const reconciliationController = require('../controllers/reconciliation.controller');
const { verifyToken, requireRole, requireVerified } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const {
    createReconciliationSchema,
    approveReconciliationSchema,
    reconciliationIdSchema,
    searchReconciliationsSchema
} = require('../validators/reconciliation.validator');

/**
 * @route   POST /api/v1/reconciliations
 * @desc    Create daily reconciliation
 * @access  Sales rep (assigned vehicle), Admin, Store Manager
 */
router.post(
    '/',
    verifyToken,
    requireVerified,
    writeLimiter,
    validateBody(createReconciliationSchema),
    reconciliationController.createDailyReconciliation
);

/**
 * @route   GET /api/v1/reconciliations
 * @desc    Get all reconciliations
 * @access  All verified users (sales reps see only their own)
 */
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchReconciliationsSchema),
    reconciliationController.getAllReconciliations
);

/**
 * @route   GET /api/v1/reconciliations/report
 * @desc    Get reconciliation report
 * @access  Admin, Store Manager
 */
router.get(
    '/report',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reconciliationController.getReconciliationReport
);

/**
 * @route   GET /api/v1/reconciliations/:id
 * @desc    Get reconciliation by ID
 * @access  All verified users
 */
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(reconciliationIdSchema),
    reconciliationController.getReconciliationById
);

/**
 * @route   POST /api/v1/reconciliations/:id/approve
 * @desc    Approve or reject reconciliation
 * @access  Admin, Store Manager only
 */
router.post(
    '/:id/approve',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    validateParams(reconciliationIdSchema),
    validateBody(approveReconciliationSchema),
    reconciliationController.approveDailyReconciliation
);

module.exports = router;
