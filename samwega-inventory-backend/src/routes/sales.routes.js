const express = require('express');
const router = express.Router();
const Joi = require('joi');
const salesController = require('../controllers/sales.controller');
const { verifyToken, requireRole, requireVerified, logActivity } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const logger = require('../utils/logger'); // Import logger

const {
    createSaleSchema,
    updateSaleSchema,
    saleIdSchema,
    voidSaleSchema,
    searchSalesSchema,
    dailySummarySchema
} = require('../validators/sales.validator');

// Logging middleware
router.use((req, res, next) => {
    logger.info(`Sales Route Hit: ${req.method} ${req.path}`);
    next();
});

/**
 * @route   POST /api/v1/sales
 * @desc    Create new sale
 * @access  Sales rep (assigned vehicle), Admin, Store Manager
 */
router.post(
    '/',
    verifyToken,
    requireVerified,
    logActivity('CREATE', 'sale'),
    writeLimiter,
    validateBody(createSaleSchema),
    salesController.createSale
);

/**
 * @route   GET /api/v1/sales
 * @desc    Get all sales
 * @access  All verified users (sales reps see only their own)
 */
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchSalesSchema),
    salesController.getAllSales
);

/**
 * @route   GET /api/v1/sales/stats
 * @desc    Get sales stats
 * @access  All verified users
 */
router.get(
    '/dashboard-stats',
    verifyToken,
    requireVerified,
    salesController.getStats
);

/**
 * @route   GET /api/v1/sales/summary/daily
 * @desc    Get daily summary
 * @access  All verified users
 */
router.get(
    '/summary/daily',
    verifyToken,
    requireVerified,
    validateQuery(dailySummarySchema),
    salesController.getDailySummary
);

/**
 * @route   GET /api/v1/sales/:id
 * @desc    Get sale by ID
 * @access  All verified users
 */
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(saleIdSchema),
    salesController.getSaleById
);

/**
 * @route   PUT /api/v1/sales/:id
 * @desc    Update sale (draft only)
 * @access  Sales rep (own sales), Admin, Store Manager
 */
router.put(
    '/:id',
    verifyToken,
    requireVerified,
    logActivity('UPDATE', 'sale'),
    writeLimiter,
    validateParams(saleIdSchema),
    validateBody(updateSaleSchema),
    salesController.updateSale
);

/**
 * @route   POST /api/v1/sales/:id/void
 * @desc    Void sale
 * @access  Admin, Store Manager only
 */
router.post(
    '/:id/void',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('VOID', 'sale'),
    writeLimiter,
    validateParams(saleIdSchema),
    validateBody(voidSaleSchema),
    salesController.voidSale
);

/**
 * @route   POST /api/v1/sales/find-combination
 * @desc    Find sales combination matching amount
 * @access  Admin, Store Manager only
 */
router.post(
    '/find-combination',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('FIND_COMBINATION', 'sale'),
    validateBody(require('../validators/sales.validator').findCombinationSchema),
    salesController.findCombination
);

/**
 * @route   POST /api/v1/sales/delete-batch
 * @desc    Delete batch of sales
 * @access  Admin only
 */
router.post(
    '/delete-batch',
    verifyToken,
    requireRole('admin'),
    logActivity('DELETE_BATCH', 'sale'),
    validateBody(require('../validators/sales.validator').deleteBatchSchema),
    salesController.deleteBatch
);

/**
 * @route   DELETE /api/v1/sales/:id
 * @desc    Delete single sale
 * @access  Admin only
 */
router.delete(
    '/:id',
    verifyToken,
    requireRole('admin'),
    logActivity('DELETE', 'sale'),
    validateParams(saleIdSchema),
    salesController.deleteSale
);

/**
 * @route   PATCH /api/v1/sales/:id/debt-link
 * @desc    Link sale to debt record
 * @access  Verified users
 */
router.patch(
    '/:id/debt-link',
    verifyToken,
    requireVerified,
    salesController.linkDebt
);

/**
 * @route   PATCH /api/v1/sales/:id/items/:itemIndex
 * @desc    Update item quantity and/or price in a sale
 * @access  Admin, Store Manager
 */
router.patch(
    '/:id/items/:itemIndex',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('UPDATE_ITEM', 'sale'),
    writeLimiter,
    validateParams(Joi.object({
        id: Joi.string().required(),
        itemIndex: Joi.number().integer().min(0).required()
    })),
    validateBody(require('../validators/sales.validator').updateItemSchema),
    salesController.updateSaleItem
);

/**
 * @route   POST /api/v1/sales/webhook/debt-update
 * @desc    Webhook for debt system to update sale payment status
 * @access  Internal (simplified for now)
 */
router.post(
    '/webhook/debt-update',
    salesController.handleDebtWebhook
);

module.exports = router;

