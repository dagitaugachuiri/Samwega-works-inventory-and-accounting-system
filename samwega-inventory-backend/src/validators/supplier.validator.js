const Joi = require('joi');

/**
 * Create supplier validation schema
 */
const createSupplierSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(200)
        .required()
        .messages({
            'string.min': 'Supplier name must be at least 2 characters',
            'string.max': 'Supplier name cannot exceed 200 characters',
            'any.required': 'Supplier name is required'
        }),

    contactPerson: Joi.string()
        .min(2)
        .max(100)
        .optional(),

    email: Joi.string()
        .email()
        .optional()
        .messages({
            'string.email': 'Please provide a valid email address'
        }),

    phone: Joi.string()
        .pattern(/^(\+254|0)[17]\d{8}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Please provide a valid Kenyan phone number'
        }),

    alternativePhone: Joi.string()
        .pattern(/^(\+254|0)[17]\d{8}$/)
        .optional(),

    address: Joi.string()
        .max(500)
        .optional(),

    city: Joi.string()
        .max(100)
        .optional(),

    kraPin: Joi.string()
        .optional(),

    paymentTerms: Joi.string()
        .valid('cash', 'credit_7days', 'credit_14days', 'credit_30days', 'credit_60days')
        .default('cash'),

    creditLimit: Joi.number()
        .min(0)
        .optional(),

    notes: Joi.string()
        .max(1000)
        .optional(),

    etrStatus: Joi.string()
        .valid('etr', 'non-etr')
        .default('non-etr'),

    isActive: Joi.boolean()
        .default(true)
});

/**
 * Update supplier validation schema
 */
const updateSupplierSchema = Joi.object({
    name: Joi.string().min(2).max(200).optional(),
    contactPerson: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^(\+254|0)[17]\d{8}$/).optional(),
    alternativePhone: Joi.string().pattern(/^(\+254|0)[17]\d{8}$/).optional(),
    address: Joi.string().max(500).optional(),
    city: Joi.string().max(100).optional(),
    kraPin: Joi.string().optional(),
    paymentTerms: Joi.string().valid('cash', 'credit_7days', 'credit_14days', 'credit_30days', 'credit_60days').optional(),
    creditLimit: Joi.number().min(0).optional(),
    notes: Joi.string().max(1000).optional(),
    isActive: Joi.boolean().optional(),
    etrStatus: Joi.string().valid('etr', 'non-etr').optional()
}).min(1);

/**
 * Supplier ID parameter validation
 */
const supplierIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Supplier ID is required'
        })
});

/**
 * Search suppliers query validation
 */
const searchSuppliersSchema = Joi.object({
    search: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    paymentTerms: Joi.string().valid('cash', 'credit_7days', 'credit_14days', 'credit_30days', 'credit_60days').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = {
    createSupplierSchema,
    updateSupplierSchema,
    supplierIdSchema,
    searchSuppliersSchema
};
