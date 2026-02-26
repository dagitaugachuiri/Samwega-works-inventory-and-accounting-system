const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateBody, validateParams } = require('../middleware/validation.middleware');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const {
    registerSchema,
    loginSchema,
    verifyUserSchema,
    assignVehicleSchema,
    updateUserSchema,
    userIdSchema
} = require('../validators/auth.validator');

/**
 * Public routes (no authentication required)
 */

// Register new user
router.post(
    '/register',
    authLimiter,
    validateBody(registerSchema),
    authController.register
);

// Login
router.post(
    '/login',
    authLimiter,
    validateBody(loginSchema),
    authController.login
);

/**
 * Protected routes (authentication required)
 */

// Get current user
router.get(
    '/me',
    verifyToken,
    authController.getCurrentUser
);

// Update current user
router.patch(
    '/me',
    verifyToken,
    validateBody(updateUserSchema),
    authController.updateCurrentUser
);

/**
 * User management routes (admin/store_manager only)
 */

// Get all users
router.get(
    '/users',
    verifyToken,
    requireRole('admin', 'store_manager'),
    authController.getAllUsers
);

// Get user by ID
router.get(
    '/users/:id',
    verifyToken,
    requireRole('admin', 'store_manager'),
    validateParams(userIdSchema),
    authController.getUserById
);

// Verify user
router.patch(
    '/users/:id/verify',
    verifyToken,
    requireRole('admin'),
    validateParams(userIdSchema),
    validateBody(verifyUserSchema),
    authController.verifyUser
);

// Assign vehicle to user
router.patch(
    '/users/:id/assign-vehicle',
    verifyToken,
    requireRole('admin', 'store_manager'),
    validateParams(userIdSchema),
    validateBody(assignVehicleSchema),
    authController.assignVehicle
);

// Update user
router.patch(
    '/users/:id',
    verifyToken,
    requireRole('admin', 'store_manager'),
    validateParams(userIdSchema),
    validateBody(updateUserSchema),
    authController.updateUser
);

module.exports = router;
