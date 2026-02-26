const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const { verifyToken, requireRole, requireVerified, logActivity } = require('../middleware/auth.middleware');
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
    requireRole('admin', 'store_manager', 'accountant'),
    logActivity('CREATE', 'invoice'),
    writeLimiter,
    validateBody(createInvoiceSchema),
    invoiceController.createInvoice
);

// Update invoice
router.put(
    '/:id',
    verifyToken,
    requireRole('admin', 'store_manager', 'accountant'),
    logActivity('UPDATE', 'invoice'),
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
    logActivity('RECORD_PAYMENT', 'invoice'),
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
    logActivity('DELETE', 'invoice'),
    validateParams(invoiceIdSchema),
    invoiceController.deleteInvoice
);

module.exports = router;
