const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { verifyToken, requireRole, requireVerified } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const {
    createCustomerSchema,
    updateCustomerSchema,
    customerIdSchema,
    searchCustomersSchema,
    getAllCustomersSchema,
    recordPaymentSchema
} = require('../validators/customer.validator');

/**
 * @route   POST /api/v1/customers
 * @desc    Create new customer
 * @access  All verified users
 */
router.post(
    '/',
    verifyToken,
    requireVerified,
    writeLimiter,
    validateBody(createCustomerSchema),
    customerController.createCustomer
);

/**
 * @route   GET /api/v1/customers/search
 * @desc    Search customers (autocomplete)
 * @access  All verified users
 */
router.get(
    '/search',
    verifyToken,
    requireVerified,
    validateQuery(searchCustomersSchema),
    customerController.searchCustomers
);
router.get(
    '/by-vehicle',
    verifyToken,
    requireVerified,
    customerController.getCustomersByVehicle
);

router.get(
    '/summary',
    verifyToken,
    requireVerified,
    customerController.getSummary
);


/**
 * @route   GET /api/v1/customers/:id
 * @desc    Get customer by ID
 * @access  All verified users
 */
router.get(
    '/:id/unpaid-sales',
    verifyToken,
    requireVerified,
    validateParams(customerIdSchema),
    customerController.getUnpaidSales
);

router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(customerIdSchema),
    customerController.getCustomerById
);

/**
 * @route   PUT /api/v1/customers/:id
 * @desc    Update customer
 * @access  Admin only
 */
router.put(
    '/:id',
    verifyToken,
    requireRole('admin'),
    writeLimiter,
    validateParams(customerIdSchema),
    validateBody(updateCustomerSchema),
    customerController.updateCustomer
);

router.patch(
    '/:id/messages',
    verifyToken,
    requireRole('admin'),
    writeLimiter,
    validateParams(customerIdSchema),
    customerController.setMessagesStopped
);

/**
 * @route   DELETE /api/v1/customers/:id
 * @desc    Delete customer
 * @access  Admin only
 */
router.delete(
    '/:id',
    verifyToken,
    requireRole('admin'),
    writeLimiter,
    validateParams(customerIdSchema),
    customerController.deleteCustomer
);

/**
 * @route   POST /api/v1/customers/:id/payment
 * @desc    Record customer payment (reduce debt)
 * @access  All verified users
 */
router.post(
    '/:id/payment',
    verifyToken,
    requireVerified,
    writeLimiter,
    validateParams(customerIdSchema),
    validateBody(recordPaymentSchema),
    customerController.recordPayment
);

module.exports = router;
