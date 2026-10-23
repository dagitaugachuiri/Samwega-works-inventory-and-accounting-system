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
    searchInvoicesSchema,
    reverseInvoiceSchema,
    removeInvoiceItemsSchema      // NEW: add this to invoice.validator.js (snippet in chat)
} = require('../validators/invoice.validator');

/**
 * READ routes: any verified, logged-in user
 */

// Get all invoices (supports ?search=, e.g. supplier name, product name, invoice number)
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchInvoicesSchema),
    invoiceController.getAllInvoices
);

// NEW: items on an invoice (for the checklist)
router.get(
    '/:id/items',
    verifyToken,
    requireVerified,
    validateParams(invoiceIdSchema),
    invoiceController.getInvoiceItems
);

// Get invoice by ID
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(invoiceIdSchema),
    invoiceController.getInvoiceById
);

/**
 * KEYING IN a new invoice: admin and store_manager only
 * (the invoice records who keyed it in). Accountants are read-only.
 */
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('CREATE', 'invoice'),
    writeLimiter,
    validateBody(createInvoiceSchema),
    invoiceController.createInvoice
);

/**
 * EDIT / DELETE routes: admin only
 */

// Update invoice
router.put(
    '/:id',
    verifyToken,
    requireRole('admin'),
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
    requireRole('admin'),
    logActivity('RECORD_PAYMENT', 'invoice'),
    writeLimiter,
    validateParams(invoiceIdSchema),
    validateBody(recordPaymentSchema),
    invoiceController.recordPayment
);

// NEW: remove ticked items from an invoice (reverses their stock)
router.post(
    '/:id/remove-items',
    verifyToken,
    requireRole('admin'),
    logActivity('REMOVE_ITEMS', 'invoice'),
    writeLimiter,
    validateParams(invoiceIdSchema),
    validateBody(removeInvoiceItemsSchema),
    invoiceController.removeInvoiceItems
);

// Reverse (void) invoice
router.post(
    '/:id/reverse',
    verifyToken,
    requireRole('admin'),
    logActivity('REVERSE', 'invoice'),
    writeLimiter,
    validateParams(invoiceIdSchema),
    validateBody(reverseInvoiceSchema),
    invoiceController.reverseInvoice
);

// Delete invoice
router.delete(
    '/:id',
    verifyToken,
    requireRole('admin'),
    logActivity('DELETE', 'invoice'),
    writeLimiter,
    validateParams(invoiceIdSchema),
    invoiceController.deleteInvoice
);

module.exports = router;