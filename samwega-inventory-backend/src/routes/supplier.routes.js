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

// All suppliers, light fields, for dropdowns (must stay above '/:id')
router.get(
    '/options',
    verifyToken,
    requireVerified,
    supplierController.getSupplierOptions
);

// Get supplier by ID
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(supplierIdSchema),
    supplierController.getSupplierById
);

// Create supplier: admin and store manager only
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('CREATE', 'supplier'),
    writeLimiter,
    validateBody(createSupplierSchema),
    supplierController.createSupplier
);

// Update supplier details: admin and store manager (accountants only handle payments, on invoices)
router.put(
    '/:id',
    verifyToken,
    requireRole('admin', 'store_manager'),
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
    writeLimiter,
    validateParams(supplierIdSchema),
    supplierController.deleteSupplier
);

// Rebuild a supplier's totals from its (non-voided) invoices: admin only
router.post(
    '/:id/recalculate',
    verifyToken,
    requireRole('admin'),
    logActivity('RECALCULATE', 'supplier'),
    writeLimiter,
    validateParams(supplierIdSchema),
    supplierController.recalculateFinancials
);

module.exports = router;
