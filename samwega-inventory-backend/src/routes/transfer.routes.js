const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transfer.controller');
const { verifyToken, requireRole, requireVerified } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const {
    createTransferSchema,
    transferIdSchema,
    confirmTransferSchema,
    breakUnitSchema,
    searchTransfersSchema,
    collectParamSchema
} = require('../validators/transfer.validator');

/**
 * @route   POST /api/v1/transfers
 * @desc    Create new transfer
 * @access  Admin, Store Manager
 */
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    validateBody(createTransferSchema),
    transferController.createTransfer
);

/**
 * @route   GET /api/v1/transfers
 * @desc    Get all transfers
 * @access  All verified users
 */
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchTransfersSchema),
    transferController.getAllTransfers
);

/**
 * @route   GET /api/v1/transfers/pending
 * @desc    Get pending transfers
 * @access  Admin, Store Manager
 */
router.get(
    '/pending',
    verifyToken,
    requireRole('admin', 'store_manager'),
    transferController.getPendingTransfers
);

/**
 * @route   GET /api/v1/transfers/:id
 * @desc    Get transfer by ID
 * @access  All verified users
 */
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(transferIdSchema),
    transferController.getTransferById
);

/**
 * @route   POST /api/v1/transfers/:id/approve
 * @desc    Approve transfer
 * @access  Admin, Store Manager
 */
router.post(
    '/:id/approve',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    validateParams(transferIdSchema),
    transferController.approveTransfer
);

/**
 * @route   POST /api/v1/transfers/:id/confirm
 * @desc    Confirm transfer (sales rep only)
 * @access  Assigned sales rep
 */
router.post(
    '/:id/confirm',
    verifyToken,
    requireVerified,
    validateParams(transferIdSchema),
    validateBody(confirmTransferSchema),
    transferController.confirmTransfer
);

/**
 * @route   PATCH /api/v1/stock-issuance/:id/item/:itemIndex/layer/:layerIndex/collect
 * @desc    Collect specific layer of an item
 * @access  Assigned sales rep
 */
router.patch(
    '/:id/item/:itemIndex/layer/:layerIndex/collect',
    verifyToken,
    requireVerified,
    validateParams(collectParamSchema),
    transferController.collectTransferLayer
);

/**
 * @route   POST /api/v1/vehicles/:id/break-unit
 * @desc    Break unit from one layer to another
 * @access  Assigned sales rep
 */
router.post(
    '/vehicles/:id/break-unit',
    verifyToken,
    requireVerified,
    writeLimiter,
    validateParams(transferIdSchema),
    validateBody(breakUnitSchema),
    transferController.breakUnit
);

/**
 * @route   GET /api/v1/vehicles/:id/collected-items
 * @desc    Get collected items for a vehicle
 * @access  All verified users
 */
router.get(
    '/vehicles/:id/collected-items',
    verifyToken,
    requireVerified,
    validateParams(transferIdSchema),
    transferController.getCollectedItems
);

module.exports = router;
