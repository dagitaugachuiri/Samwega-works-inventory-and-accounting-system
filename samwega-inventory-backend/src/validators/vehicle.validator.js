const Joi = require('joi');

/**
 * Create vehicle validation schema
 */
const createVehicleSchema = Joi.object({
    vehicleName: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Vehicle name must be at least 2 characters',
            'string.max': 'Vehicle name cannot exceed 100 characters',
            'any.required': 'Vehicle name is required'
        }),

    vehicleNumber: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.min': 'Vehicle number must be at least 2 characters',
            'string.max': 'Vehicle number cannot exceed 50 characters',
            'any.required': 'Vehicle number is required'
        }),

    assignedUserId: Joi.string()
        .optional()
        .messages({
            'string.base': 'Assigned user ID must be a valid string'
        }),

    isActive: Joi.boolean()
        .default(true)
        .messages({
            'boolean.base': 'isActive must be a boolean value'
        }),

    notes: Joi.string()
        .max(500)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 500 characters'
        })
});

/**
 * Update vehicle validation schema
 */
const updateVehicleSchema = Joi.object({
    vehicleName: Joi.string().min(2).max(100).optional(),
    vehicleNumber: Joi.string().min(2).max(50).optional(),
    assignedUserId: Joi.string().allow(null).optional(),
    isActive: Joi.boolean().optional(),
    notes: Joi.string().max(500).allow('').optional()
}).min(1); // At least one field must be provided

/**
 * Vehicle ID parameter validation
 */
const vehicleIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Vehicle ID is required'
        })
});

/**
 * Search vehicles query validation schema
 */
const searchVehiclesSchema = Joi.object({
    search: Joi.string().optional(),
    assignedUserId: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('vehicleName', 'vehicleNumber', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * Assign user to vehicle validation schema
 */
const assignUserSchema = Joi.object({
    userId: Joi.string()
        .required()
        .messages({
            'any.required': 'User ID is required'
        })
});

module.exports = {
    createVehicleSchema,
    updateVehicleSchema,
    vehicleIdSchema,
    searchVehiclesSchema,
    assignUserSchema
};
