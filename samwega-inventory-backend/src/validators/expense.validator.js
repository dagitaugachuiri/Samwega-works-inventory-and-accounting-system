const Joi = require('joi');

/**
 * Expense categories
 */
const EXPENSE_CATEGORIES = [
    'fuel',
    'maintenance',
    'supplies',
    'utilities',
    'salaries',
    'rent',
    'marketing',
    'other'
];

/**
 * Create expense validation schema
 */
const createExpenseSchema = Joi.object({
    category: Joi.string()
        .valid(...EXPENSE_CATEGORIES)
        .required()
        .messages({
            'any.only': 'Category must be one of: fuel, maintenance, supplies, utilities, salaries, rent, marketing, other',
            'any.required': 'Category is required'
        }),

    description: Joi.string()
        .min(5)
        .max(500)
        .required()
        .messages({
            'string.min': 'Description must be at least 5 characters',
            'string.max': 'Description cannot exceed 500 characters',
            'any.required': 'Description is required'
        }),

    amount: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Amount must be positive',
            'any.required': 'Amount is required'
        }),

    currency: Joi.string()
        .valid('KES', 'USD', 'EUR')
        .default('KES')
        .messages({
            'any.only': 'Currency must be KES, USD, or EUR'
        }),

    expenseDate: Joi.date()
        .iso()
        .required()
        .messages({
            'any.required': 'Expense date is required'
        }),

    vehicleId: Joi.string()
        .optional()
        .messages({
            'string.base': 'Vehicle ID must be a string'
        }),

    receiptUrl: Joi.string()
        .uri()
        .optional()
        .messages({
            'string.uri': 'Receipt URL must be a valid URI'
        }),

    receiptPublicId: Joi.string()
        .optional(),

    notes: Joi.string()
        .max(1000)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 1000 characters'
        })
});

/**
 * Update expense validation schema
 */
const updateExpenseSchema = Joi.object({
    category: Joi.string().valid(...EXPENSE_CATEGORIES).optional(),
    description: Joi.string().min(5).max(500).optional(),
    amount: Joi.number().positive().optional(),
    currency: Joi.string().valid('KES', 'USD', 'EUR').optional(),
    expenseDate: Joi.date().iso().optional(),
    vehicleId: Joi.string().optional(),
    receiptUrl: Joi.string().uri().optional(),
    receiptPublicId: Joi.string().optional(),
    notes: Joi.string().max(1000).optional()
}).min(1); // At least one field must be provided

/**
 * Approve expense validation schema
 */
const approveExpenseSchema = Joi.object({
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
 * Expense ID parameter validation
 */
const expenseIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Expense ID is required'
        })
});

/**
 * Search expenses query validation schema
 */
const searchExpensesSchema = Joi.object({
    category: Joi.string().valid(...EXPENSE_CATEGORIES).optional(),
    status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
    submittedBy: Joi.string().optional(),
    vehicleId: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    minAmount: Joi.number().positive().optional(),
    maxAmount: Joi.number().positive().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('expenseNumber', 'amount', 'expenseDate', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * Category summary query validation schema
 */
const categorySummarySchema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required()
});

module.exports = {
    createExpenseSchema,
    updateExpenseSchema,
    approveExpenseSchema,
    expenseIdSchema,
    searchExpensesSchema,
    categorySummarySchema,
    EXPENSE_CATEGORIES
};
