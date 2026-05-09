const express = require('express');
const router = express.Router();
const debtController = require('../controllers/debt.controller');
const { verifyToken, requireVerified } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/debt/dashboard-summary
 * @desc    Get live outstanding debt totals from the debt API
 * @access  Verified users
 */
router.get(
    '/dashboard-summary',
    verifyToken,
    requireVerified,
    debtController.getDashboardSummary
);

/**
 * @route   POST /api/v1/debt/enrich-sales
 * @desc    Batch-fetch debt status for a list of sale IDs
 * @body    { saleIds: string[] }
 * @access  Verified users
 */
router.post(
    '/enrich-sales',
    verifyToken,
    requireVerified,
    debtController.enrichSales
);

/**
 * @route   GET /api/v1/debt/code/:code
 * @desc    Fetch a single debt record by its debtCode
 * @access  Verified users
 */
router.get(
    '/code/:code',
    verifyToken,
    requireVerified,
    debtController.getDebtByCode
);

/**
 * @route   GET /api/v1/debt/:id
 * @desc    Fetch a single debt record by its ID
 * @access  Verified users
 */
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    debtController.getDebtById
);

/**
 * @route   POST /api/v1/debt
 * @desc    Create a new debt record in the external system
 * @access  Verified users
 */
router.post(
    '/',
    verifyToken,
    requireVerified,
    debtController.createDebt
);

module.exports = router;
