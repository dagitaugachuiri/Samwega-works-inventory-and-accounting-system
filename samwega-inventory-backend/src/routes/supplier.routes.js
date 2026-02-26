const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const { verifyToken, requireRole, requireVerified, logActivity } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const {
    createSupplierSchema,
    updateSupplierSchema,
    supplierIdSchema,
    searchSuppliersSchema
} = require('../validators/supplier.validator');

// Get all suppliers
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchSuppliersSchema),
    supplierController.getAllSuppliers
);

// Get supplier by ID
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(supplierIdSchema),
    supplierController.getSupplierById
);

// Create supplier
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager', 'accountant'),
    logActivity('CREATE', 'supplier'),
    writeLimiter,
    validateBody(createSupplierSchema),
    supplierController.createSupplier
);

// Update supplier
router.put(
    '/:id',
    verifyToken,
    requireRole('admin', 'store_manager', 'accountant'),
    logActivity('UPDATE', 'supplier'),
    writeLimiter,
    validateParams(supplierIdSchema),
    validateBody(updateSupplierSchema),
    supplierController.updateSupplier
);

// Delete supplier
router.delete(
    '/:id',
    verifyToken,
    requireRole('admin'),
    logActivity('DELETE', 'supplier'),
    validateParams(supplierIdSchema),
    supplierController.deleteSupplier
);

module.exports = router;
