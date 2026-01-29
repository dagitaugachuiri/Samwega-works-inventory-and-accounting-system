const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const { verifyToken, requireRole, requireVerified } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const {
    createInvoiceSchema,
    updateInvoiceSchema,
    recordPaymentSchema,
    invoiceIdSchema,
    searchInvoicesSchema
} = require('../validators/invoice.validator');

// Get all invoices
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchInvoicesSchema),
    invoiceController.getAllInvoices
);

// Get invoice by ID
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(invoiceIdSchema),
    invoiceController.getInvoiceById
);

// Create invoice
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    validateBody(createInvoiceSchema),
    invoiceController.createInvoice
);

// Update invoice
router.put(
    '/:id',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    validateParams(invoiceIdSchema),
    validateBody(updateInvoiceSchema),
    invoiceController.updateInvoice
);

// Record payment
router.post(
    '/:id/payments',
    verifyToken,
    requireRole('admin', 'store_manager', 'accountant'),
    writeLimiter,
    validateParams(invoiceIdSchema),
    validateBody(recordPaymentSchema),
    invoiceController.recordPayment
);

// Delete invoice
router.delete(
    '/:id',
    verifyToken,
    requireRole('admin'),
    validateParams(invoiceIdSchema),
    invoiceController.deleteInvoice
);

module.exports = router;
