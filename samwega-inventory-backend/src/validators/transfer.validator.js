const Joi = require('joi');

/**
 * Transfer layer validation schema
 */
const transferLayerSchema = Joi.object({
    layerIndex: Joi.number()
        .integer()
        .valid(0, 1, 2)
        .required()
        .messages({
            'any.only': 'Layer index must be 0 (carton), 1 (box), or 2 (piece)',
            'any.required': 'Layer index is required'
        }),

    quantity: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.positive': 'Quantity must be positive',
            'any.required': 'Quantity is required'
        }),

    unit: Joi.string()
        .valid('carton', 'box', 'piece')
        .required()
        .messages({
            'any.only': 'Unit must be carton, box, or piece',
            'any.required': 'Unit is required'
        })
});

/**
 * Transfer item validation schema
 */
const transferItemSchema = Joi.object({
    inventoryId: Joi.string()
        .required()
        .messages({
            'any.required': 'Inventory ID is required'
        }),

    layers: Joi.array()
        .items(transferLayerSchema)
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one layer is required',
            'any.required': 'Layers array is required'
        })
});

/**
 * Create transfer validation schema
 */
const createTransferSchema = Joi.object({
    vehicleId: Joi.string()
        .required()
        .messages({
            'any.required': 'Vehicle ID is required'
        }),

    items: Joi.array()
        .items(transferItemSchema)
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'At least one item is required',
            'array.max': 'Cannot transfer more than 100 items at once',
            'any.required': 'Items array is required'
        }),

    notes: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 500 characters'
        })
});

/**
 * Transfer ID parameter validation
 */
const transferIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Transfer ID is required'
        })
});

/**
 * Collect item param validation
 */
const collectParamSchema = Joi.object({
    id: Joi.string().required(),
    itemIndex: Joi.number().integer().min(0).required(),
    layerIndex: Joi.number().integer().min(0).required()
});

/**
 * Confirm transfer validation schema
 */
const confirmTransferSchema = Joi.object({
    confirmedItems: Joi.array()
        .items(Joi.object({
            inventoryId: Joi.string().required(),
            layerIndex: Joi.number().integer().valid(0, 1, 2).required(),
            confirmedQty: Joi.number().integer().positive().required()
        }))
        .optional()
        .messages({
            'array.base': 'Confirmed items must be an array'
        })
});

/**
 * Break unit validation schema
 */
const breakUnitSchema = Joi.object({
    inventoryId: Joi.string()
        .required()
        .messages({
            'any.required': 'Inventory ID is required'
        }),

    fromLayer: Joi.number()
        .integer()
        .valid(0, 1)
        .required()
        .messages({
            'any.only': 'From layer must be 0 (carton) or 1 (box)',
            'any.required': 'From layer is required'
        }),

    toLayer: Joi.number()
        .integer()
        .valid(1, 2)
        .required()
        .messages({
            'any.only': 'To layer must be 1 (box) or 2 (piece)',
            'any.required': 'To layer is required'
        }),

    quantity: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.positive': 'Quantity must be positive',
            'any.required': 'Quantity is required'
        })
}).custom((value, helpers) => {
    // Ensure fromLayer < toLayer
    if (value.fromLayer >= value.toLayer) {
        return helpers.error('any.invalid', {
            message: 'From layer must be smaller than to layer (e.g., carton to box)'
        });
    }
    return value;
});

/**
 * Search transfers query validation schema
 */
const searchTransfersSchema = Joi.object({
    vehicleId: Joi.string().optional(),
    status: Joi.string().valid('pending', 'approved', 'collected', 'cancelled').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('transferNumber', 'createdAt', 'approvedAt').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
    createTransferSchema,
    transferIdSchema,
    confirmTransferSchema,
    breakUnitSchema,
    searchTransfersSchema,
    transferItemSchema,
    transferLayerSchema,
    collectParamSchema
};
