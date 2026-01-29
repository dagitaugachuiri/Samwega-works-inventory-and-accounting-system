const express = require('express');
const router = express.Router();
const posController = require('../controllers/pos.controller');
const { verifyToken, requireVerified } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const { validateParams, validateQuery, validateBody } = require('../middleware/validation.middleware');
const { createSaleSchema } = require('../validators/sales.validator');
const { searchCustomersSchema } = require('../validators/customer.validator');
const { createExpenseSchema } = require('../validators/expense.validator');

/**
 * @route   GET /api/v1/pos/vehicle-inventory/:vehicleId
 * @desc    Get vehicle inventory with current stock
 * @access  Sales reps (assigned vehicle), Admin, Store Manager
 */
router.get(
    '/vehicle-inventory/:vehicleId',
    verifyToken,
    requireVerified,
    posController.getVehicleInventory
);

/**
 * @route   GET /api/v1/pos/inventory-report/:vehicleId
 * @desc    Generate vehicle inventory report
 * @access  Sales reps (assigned vehicle), Admin, Store Manager
 */
router.get(
    '/inventory-report/:vehicleId',
    verifyToken,
    requireVerified,
    posController.getInventoryReport
);

/**
 * @route   POST /api/v1/pos/sales
 * @desc    Create new sale (POS endpoint)
 * @access  Sales reps (assigned vehicle), Admin, Store Manager
 */
router.post(
    '/sales',
    verifyToken,
    requireVerified,
    writeLimiter,
    validateBody(createSaleSchema),
    posController.createSale
);

/**
 * @route   GET /api/v1/pos/customers/search
 * @desc    Search customers (autocomplete)
 * @access  All verified users
 */
router.get(
    '/customers/search',
    verifyToken,
    requireVerified,
    validateQuery(searchCustomersSchema),
    posController.searchCustomers
);

/**
 * @route   POST /api/v1/pos/receipts/:saleId/print
 * @desc    Generate receipt for printing (thermal format)
 * @access  All verified users
 */
router.post(
    '/receipts/:saleId/print',
    verifyToken,
    requireVerified,
    posController.generateReceipt
);

/**
 * @route   POST /api/v1/pos/expenses
 * @desc    Submit expense (sales rep)
 * @access  All verified users
 */
router.post(
    '/expenses',
    verifyToken,
    requireVerified,
    writeLimiter,
    validateBody(createExpenseSchema),
    posController.submitExpense
);

module.exports = router;
