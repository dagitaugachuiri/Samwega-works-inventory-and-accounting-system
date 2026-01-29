const Joi = require('joi');

/**
 * Stock discrepancy validation schema
 */
const stockDiscrepancySchema = Joi.object({
    inventoryId: Joi.string().required(),
    productName: Joi.string().required(),
    layerIndex: Joi.number().integer().valid(0, 1, 2).required(),
    unit: Joi.string().valid('carton', 'box', 'piece').required(),
    systemStock: Joi.number().integer().min(0).required(),
    physicalStock: Joi.number().integer().min(0).required(),
    variance: Joi.number().integer().required(),
    reason: Joi.string().max(500).optional()
});

/**
 * Create daily reconciliation validation schema
 */
const createReconciliationSchema = Joi.object({
    vehicleId: Joi.string()
        .required()
        .messages({
            'any.required': 'Vehicle ID is required'
        }),

    date: Joi.date()
        .iso()
        .required()
        .messages({
            'any.required': 'Date is required'
        }),

    // Cash reconciliation
    expectedCash: Joi.number()
        .min(0)
        .required()
        .messages({
            'number.min': 'Expected cash cannot be negative',
            'any.required': 'Expected cash is required'
        }),

    actualCash: Joi.number()
        .min(0)
        .required()
        .messages({
            'number.min': 'Actual cash cannot be negative',
            'any.required': 'Actual cash is required'
        }),

    cashVariance: Joi.number()
        .required()
        .messages({
            'any.required': 'Cash variance is required'
        }),

    varianceReason: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Variance reason cannot exceed 500 characters'
        }),

    // Stock discrepancies
    stockDiscrepancies: Joi.array()
        .items(stockDiscrepancySchema)
        .default([])
        .messages({
            'array.base': 'Stock discrepancies must be an array'
        }),

    notes: Joi.string()
        .max(1000)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 1000 characters'
        })
});

/**
 * Approve reconciliation validation schema
 */
const approveReconciliationSchema = Joi.object({
    approved: Joi.boolean()
        .required()
        .messages({
            'any.required': 'Approval status is required'
        }),

    rejectionReason: Joi.when('approved', {
        is: false,
        then: Joi.string().min(10).max(500).required().messages({
            'string.min': 'Rejection reason must be at least 10 characters',
            'string.max': 'Rejection reason cannot exceed 500 characters',
            'any.required': 'Rejection reason is required when rejecting'
        }),
        otherwise: Joi.string().optional()
    }),

    notes: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 500 characters'
        })
});

/**
 * Reconciliation ID parameter validation
 */
const reconciliationIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Reconciliation ID is required'
        })
});

/**
 * Search reconciliations query validation schema
 */
const searchReconciliationsSchema = Joi.object({
    vehicleId: Joi.string().optional(),
    salesRepId: Joi.string().optional(),
    status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('date', 'createdAt', 'totalSales').default('date'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
    createReconciliationSchema,
    approveReconciliationSchema,
    reconciliationIdSchema,
    searchReconciliationsSchema,
    stockDiscrepancySchema
};
