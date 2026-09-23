const Joi = require('joi');

/**
 * Create invoice validation schema (simplified - no items)
 */
const createInvoiceSchema = Joi.object({
    supplierId: Joi.string()
        .required()
        .messages({
            'any.required': 'Supplier ID is required'
        }),

    invoiceNumber: Joi.string()
        .required()
        .messages({
            'any.required': 'Invoice number is required'
        }),

    invoiceDate: Joi.date()
        .iso()
        .required()
        .messages({
            'any.required': 'Invoice date is required'
        }),itesms
        //Added items to the schema to allow for invoice items to be included in the creation of an invoice. Each item must have a description, quantity, and unit price.
    items: Joi.array().items(
    Joi.object({
        description: Joi.string().required(),
        quantity: Joi.number().positive().required(),
        unitPrice: Joi.number().min(0).required()
    })
    ).optional(),

    dueDate: Joi.date()
        .iso()
        .optional(),

    totalAmount: Joi.number()
        .min(0)
        .optional()
        .messages({
            'number.min': 'Total amount must be zero or positive'
        }),

    taxAmount: Joi.number()
        .min(0)
        .default(0),

    discountAmount: Joi.number()
        .min(0)
        .default(0),

    paymentStatus: Joi.string()
        .valid('pending', 'partial', 'paid')
        .default('pending'),

    amountPaid: Joi.number()
        .min(0)
        .default(0),

    paymentMethod: Joi.string()
        .valid('cash', 'mpesa', 'bank_transfer', 'cheque', 'credit')
        .optional(),

    entryStatus: Joi.string()
        .valid('draft', 'finalized')
        .default('draft'),

    notes: Joi.string()
        .max(1000)
        .optional(),

    attachments: Joi.array()
        .items(Joi.string())
        .optional()
});

/**
 * Update invoice validation schema
 */
const updateInvoiceSchema = Joi.object({
    invoiceNumber: Joi.string().optional(),
    invoiceDate: Joi.date().iso().optional(),
    dueDate: Joi.date().iso().optional(),
    totalAmount: Joi.number().min(0).optional(),
    taxAmount: Joi.number().min(0).optional(),
    discountAmount: Joi.number().min(0).optional(),
    paymentStatus: Joi.string().valid('pending', 'partial', 'paid').optional(),
    amountPaid: Joi.number().min(0).optional(),
    paymentMethod: Joi.string().valid('cash', 'mpesa', 'bank_transfer', 'cheque', 'credit').optional(),
    entryStatus: Joi.string().valid('draft', 'finalized').optional(),
    notes: Joi.string().max(1000).optional()


}).min(1);

/**
 * Record payment validation schema
 */
const recordPaymentSchema = Joi.object({
    amount: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Payment amount must be positive',
            'any.required': 'Payment amount is required'
        }),

    paymentMethod: Joi.string()
        .valid('cash', 'mpesa', 'bank_transfer', 'cheque')
        .required()
        .messages({
            'any.required': 'Payment method is required'
        }),

    paymentDate: Joi.date()
        .default(() => new Date()),

    reference: Joi.string()
        .allow('')
        .optional(),

    notes: Joi.string()
        .allow('')
        .max(500)
        .optional()
});

/**
 * Invoice ID parameter validation
 */
const invoiceIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Invoice ID is required'
        })
});

/**
 * Search invoices query validation
 */
const searchInvoicesSchema = Joi.object({
    supplierId: Joi.string().optional(),
    paymentStatus: Joi.string().valid('pending', 'partial', 'paid').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    minAmount: Joi.number().min(0).optional(),
    maxAmount: Joi.number().min(0).optional(),
    hasItems: Joi.boolean().optional(), // Filter by whether invoice has linked items
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('invoiceDate', 'totalAmount', 'createdAt').default('invoiceDate'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
    createInvoiceSchema,
    updateInvoiceSchema,
    recordPaymentSchema,
    invoiceIdSchema,
    searchInvoicesSchema
};
