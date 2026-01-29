const Joi = require('joi');

/**
 * Create customer validation schema
 */
const createCustomerSchema = Joi.object({
    customerName: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Customer name must be at least 2 characters',
            'string.max': 'Customer name cannot exceed 100 characters',
            'any.required': 'Customer name is required'
        }),

    customerPhone: Joi.string()
        .pattern(/^[0-9]{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Customer phone must be 10-15 digits',
            'any.required': 'Customer phone is required'
        }),

    storeName: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Store name must be at least 2 characters',
            'string.max': 'Store name cannot exceed 100 characters'
        }),

    customerIdNumber: Joi.string()
        .max(50)
        .optional()
        .messages({
            'string.max': 'ID number cannot exceed 50 characters'
        }),

    customerEmail: Joi.string()
        .email()
        .optional()
        .messages({
            'string.email': 'Invalid email format'
        }),

    notes: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 500 characters'
        })
});

/**
 * Update customer validation schema
 */
const updateCustomerSchema = Joi.object({
    customerName: Joi.string().min(2).max(100).optional(),
    customerPhone: Joi.string().pattern(/^[0-9]{10,15}$/).optional(),
    storeName: Joi.string().min(2).max(100).optional(),
    customerIdNumber: Joi.string().max(50).optional(),
    customerEmail: Joi.string().email().optional(),
    notes: Joi.string().max(500).optional()
}).min(1); // At least one field must be provided

/**
 * Customer ID parameter validation
 */
const customerIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Customer ID is required'
        })
});

/**
 * Search customers query validation schema
 */
const searchCustomersSchema = Joi.object({
    q: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Search query must be at least 2 characters',
            'string.max': 'Search query cannot exceed 100 characters',
            'any.required': 'Search query is required'
        }),
    limit: Joi.number()
        .integer()
        .min(1)
        .max(50)
        .default(10)
        .messages({
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 50'
        })
});

/**
 * Get all customers query validation schema
 */
const getAllCustomersSchema = Joi.object({
    search: Joi.string().max(100).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('customerName', 'storeName', 'totalPurchases', 'totalDebt', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

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
        })
});

module.exports = {
    createCustomerSchema,
    updateCustomerSchema,
    customerIdSchema,
    searchCustomersSchema,
    getAllCustomersSchema,
    recordPaymentSchema
};
