const Joi = require('joi');

/**
 * Sale item validation schema
 */
const saleItemSchema = Joi.object({
    inventoryId: Joi.string()
        .required()
        .messages({
            'any.required': 'Inventory ID is required'
        }),

    productName: Joi.string()
        .required()
        .messages({
            'any.required': 'Product name is required'
        }),

    layerIndex: Joi.number()
        .integer()
        .valid(0, 1, 2)
        .required()
        .messages({
            'any.only': 'Layer index must be 0 (carton), 1 (box), or 2 (piece)',
            'any.required': 'Layer index is required'
        }),

    unit: Joi.string()
        .valid('carton', 'box', 'piece')
        .required()
        .messages({
            'any.only': 'Unit must be carton, box, or piece',
            'any.required': 'Unit is required'
        }),

    quantity: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.positive': 'Quantity must be positive',
            'any.required': 'Quantity is required'
        }),

    unitPrice: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Unit price must be positive',
            'any.required': 'Unit price is required'
        }),

    totalPrice: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Total price must be positive',
            'any.required': 'Total price is required'
        }),

    costPrice: Joi.number()
        .positive()
        .optional()
        .messages({
            'number.positive': 'Cost price must be positive'
        })
});

/**
 * Payment validation schema
 */
const paymentSchema = Joi.object({
    method: Joi.string()
        .valid('cash', 'mpesa', 'bank', 'credit', 'mixed')
        .required()
        .messages({
            'any.only': 'Payment method must be cash, mpesa, bank, credit, or mixed',
            'any.required': 'Payment method is required'
        }),

    amount: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Payment amount must be positive',
            'any.required': 'Payment amount is required'
        }),

    reference: Joi.string()
        .optional()
        .messages({
            'string.base': 'Reference must be a string'
        }),

    notes: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 500 characters'
        })
});

/**
 * Create sale validation schema
 */
const createSaleSchema = Joi.object({
    vehicleId: Joi.string()
        .required()
        .messages({
            'any.required': 'Vehicle ID is required'
        }),

    items: Joi.array()
        .items(saleItemSchema)
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'At least one item is required',
            'array.max': 'Cannot sell more than 100 items at once',
            'any.required': 'Items array is required'
        }),

    // Payment details
    paymentMethod: Joi.string()
        .valid('cash', 'mpesa', 'bank', 'credit', 'mixed')
        .required()
        .messages({
            'any.only': 'Payment method must be cash, mpesa, bank, credit, or mixed',
            'any.required': 'Payment method is required'
        }),

    payments: Joi.array()
        .items(paymentSchema)
        .when('paymentMethod', {
            is: 'mixed',
            then: Joi.array().items(paymentSchema).min(2).required(),
            otherwise: Joi.array().items(paymentSchema).optional()
        })
        .messages({
            'array.min': 'Mixed payment requires at least 2 payment methods'
        }),

    // Customer details (required for credit sales)
    customerName: Joi.when('paymentMethod', {
        is: 'credit',
        then: Joi.string().required().messages({
            'any.required': 'Customer name is required for credit sales'
        }),
        otherwise: Joi.string().optional()
    }),

    customerPhone: Joi.when('paymentMethod', {
        is: 'credit',
        then: Joi.string().pattern(/^[0-9]{10,15}$/).required().messages({
            'any.required': 'Customer phone is required for credit sales',
            'string.pattern.base': 'Customer phone must be 10-15 digits'
        }),
        otherwise: Joi.string().optional()
    }),

    customerIdNumber: Joi.when('paymentMethod', {
        is: 'credit',
        then: Joi.string().required().messages({
            'any.required': 'Customer ID number is required for credit sales'
        }),
        otherwise: Joi.string().optional()
    }),

    customerEmail: Joi.string()
        .email()
        .optional()
        .messages({
            'string.email': 'Invalid email format'
        }),

    storeName: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Store name must be at least 2 characters',
            'string.max': 'Store name cannot exceed 100 characters'
        }),

    // Pricing
    subtotal: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Subtotal must be positive',
            'any.required': 'Subtotal is required'
        }),

    taxAmount: Joi.number()
        .min(0)
        .default(0)
        .messages({
            'number.min': 'Tax amount cannot be negative'
        }),

    discountAmount: Joi.number()
        .min(0)
        .default(0)
        .messages({
            'number.min': 'Discount amount cannot be negative'
        }),

    grandTotal: Joi.number()
        .positive()
        .required()
        .messages({
            'number.positive': 'Grand total must be positive',
            'any.required': 'Grand total is required'
        }),

    notes: Joi.string()
        .max(500)
        .allow('')
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 500 characters'
        }),

    // Location tracking for route analysis
    location: Joi.object({
        latitude: Joi.number()
            .min(-90)
            .max(90)
            .required()
            .messages({
                'number.min': 'Latitude must be between -90 and 90',
                'number.max': 'Latitude must be between -90 and 90',
                'any.required': 'Latitude is required for location tracking'
            }),
        longitude: Joi.number()
            .min(-180)
            .max(180)
            .required()
            .messages({
                'number.min': 'Longitude must be between -180 and 180',
                'number.max': 'Longitude must be between -180 and 180',
                'any.required': 'Longitude is required for location tracking'
            }),
        accuracy: Joi.number()
            .positive()
            .optional()
            .messages({
                'number.positive': 'Accuracy must be positive'
            }),
        address: Joi.string()
            .max(500)
            .optional()
            .messages({
                'string.max': 'Address cannot exceed 500 characters'
            })
    }).optional(),

    status: Joi.string()
        .valid('draft', 'completed')
        .default('completed')
        .messages({
            'any.only': 'Status must be draft or completed'
        })
});

/**
 * Update sale validation schema
 */
const updateSaleSchema = Joi.object({
    items: Joi.array().items(saleItemSchema).min(1).optional(),
    paymentMethod: Joi.string().valid('cash', 'mpesa', 'bank', 'credit', 'mixed').optional(),
    payments: Joi.array().items(paymentSchema).optional(),
    customerName: Joi.string().optional(),
    customerPhone: Joi.string().pattern(/^[0-9]{10,15}$/).optional(),
    customerIdNumber: Joi.string().optional(),
    customerEmail: Joi.string().email().optional(),
    subtotal: Joi.number().positive().optional(),
    taxAmount: Joi.number().min(0).optional(),
    discountAmount: Joi.number().min(0).optional(),
    grandTotal: Joi.number().positive().optional(),
    notes: Joi.string().max(500).optional(),
    status: Joi.string().valid('draft', 'completed').optional()
}).min(1); // At least one field must be provided

/**
 * Sale ID parameter validation
 */
const saleIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Sale ID is required'
        })
});

/**
 * Void sale validation schema
 */
const voidSaleSchema = Joi.object({
    reason: Joi.string()
        .min(10)
        .max(500)
        .required()
        .messages({
            'string.min': 'Void reason must be at least 10 characters',
            'string.max': 'Void reason cannot exceed 500 characters',
            'any.required': 'Void reason is required'
        })
});

/**
 * Search sales query validation schema
 */
const searchSalesSchema = Joi.object({
    vehicleId: Joi.string().optional(),
    salesRepId: Joi.string().optional(),
    paymentMethod: Joi.string().valid('cash', 'mpesa', 'bank', 'credit', 'mixed').optional(),
    status: Joi.string().valid('draft', 'completed', 'voided').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    minAmount: Joi.number().positive().optional(),
    maxAmount: Joi.number().positive().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('receiptNumber', 'grandTotal', 'saleDate', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * Daily summary query validation schema
 */
const dailySummarySchema = Joi.object({
    vehicleId: Joi.string().required(),
    date: Joi.date().iso().required()
});

module.exports = {
    createSaleSchema,
    updateSaleSchema,
    saleIdSchema,
    voidSaleSchema,
    searchSalesSchema,
    dailySummarySchema,
    saleItemSchema,
    paymentSchema
};
