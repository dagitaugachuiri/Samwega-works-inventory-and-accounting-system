const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicle.controller');
const transferController = require('../controllers/transfer.controller');
const { verifyToken, requireRole, requireVerified, logActivity } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const {
    createVehicleSchema,
    updateVehicleSchema,
    vehicleIdSchema,
    searchVehiclesSchema,
    assignUserSchema
} = require('../validators/vehicle.validator');

/**
 * @route   POST /api/v1/vehicles
 * @desc    Create new vehicle
 * @access  Admin, Store Manager
 */
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('CREATE', 'vehicle'),
    writeLimiter,
    validateBody(createVehicleSchema),
    vehicleController.createVehicle
);

/**
 * @route   GET /api/v1/vehicles
 * @desc    Get all vehicles
 * @access  All verified users
 */
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchVehiclesSchema),
    vehicleController.getAllVehicles
);

/**
 * @route   GET /api/v1/vehicles/:id
 * @desc    Get vehicle by ID
 * @access  All verified users
 */
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(vehicleIdSchema),
    vehicleController.getVehicleById
);

/**
 * @route   PUT /api/v1/vehicles/:id
 * @desc    Update vehicle
 * @access  Admin, Store Manager
 */
router.put(
    '/:id',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('UPDATE', 'vehicle'),
    writeLimiter,
    validateParams(vehicleIdSchema),
    validateBody(updateVehicleSchema),
    vehicleController.updateVehicle
);

/**
 * @route   DELETE /api/v1/vehicles/:id
 * @desc    Delete vehicle (soft delete)
 * @access  Admin only
 */
router.delete(
    '/:id',
    verifyToken,
    requireRole('admin'),
    logActivity('DELETE', 'vehicle'),
    validateParams(vehicleIdSchema),
    vehicleController.deleteVehicle
);

/**
 * @route   POST /api/v1/vehicles/:id/assign-user
 * @desc    Assign user to vehicle
 * @access  Admin, Store Manager
 */
router.post(
    '/:id/assign-user',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('ASSIGN_USER', 'vehicle'),
    writeLimiter,
    validateParams(vehicleIdSchema),
    validateBody(assignUserSchema),
    vehicleController.assignUser
);

/**
 * @route   GET /api/v1/vehicles/:id/inventory
 * @desc    Get vehicle inventory
 * @access  All verified users
 */
router.get(
    '/:id/inventory',
    verifyToken,
    requireVerified,
    validateParams(vehicleIdSchema),
    vehicleController.getVehicleInventory
);

/**
 * @route   GET /api/v1/vehicles/:id/issuances
 * @desc    Get vehicle issuances (stock history)
 * @access  All verified users
 */
router.get(
    '/:id/issuances',
    verifyToken,
    requireVerified,
    validateParams(vehicleIdSchema),
    vehicleController.getVehicleIssuances
);

/**
 * @route   GET /api/v1/vehicles/:id/collected-items
 * @desc    Get collected items for a vehicle
 * @access  All verified users
 */
router.get(
    '/:id/collected-items',
    verifyToken,
    requireVerified,
    validateParams(vehicleIdSchema),
    transferController.getCollectedItems
);

module.exports = router;
