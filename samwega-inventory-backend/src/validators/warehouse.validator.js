const Joi = require('joi');

/**
 * Create warehouse validation schema
 */
const createWarehouseSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Warehouse name must be at least 2 characters',
            'string.max': 'Warehouse name cannot exceed 100 characters',
            'any.required': 'Warehouse name is required'
        }),

    location: Joi.string()
        .max(200)
        .optional()
        .allow(''),

    description: Joi.string()
        .max(500)
        .optional()
        .allow(''),

    isActive: Joi.boolean()
        .default(true)
}).options({ stripUnknown: true });

/**
 * Update warehouse validation schema
 */
const updateWarehouseSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    location: Joi.string().max(200).optional().allow(''),
    description: Joi.string().max(500).optional().allow(''),
    isActive: Joi.boolean().optional()
}).min(1).options({ stripUnknown: true });

/**
 * Warehouse ID parameter validation
 */
const warehouseIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Warehouse ID is required'
        })
});

/**
 * Search/filter query validation schema
 */
const searchWarehouseSchema = Joi.object({
    search: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = {
    createWarehouseSchema,
    updateWarehouseSchema,
    warehouseIdSchema,
    searchWarehouseSchema
};
