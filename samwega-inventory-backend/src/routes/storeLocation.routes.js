const express = require('express');
const router = express.Router();
const storeLocationController = require('../controllers/storeLocation.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');

// Get all locations (all authenticated users)
router.get(
    '/',
    verifyToken,
    storeLocationController.getAllLocations
);

// Get location by ID
router.get(
    '/:id',
    verifyToken,
    storeLocationController.getLocationById
);

// Create location (admin/store_manager only)
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    storeLocationController.createLocation
);

// Update location
router.put(
    '/:id',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    storeLocationController.updateLocation
);

// Delete location
router.delete(
    '/:id',
    verifyToken,
    requireRole('admin'),
    storeLocationController.deleteLocation
);

module.exports = router;
