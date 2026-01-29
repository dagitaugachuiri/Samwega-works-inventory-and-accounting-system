const Joi = require('joi');

/**
 * User registration validation schema
 */
const registerSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .min(6)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters long',
            'any.required': 'Password is required'
        }),

    username: Joi.string()
        .min(3)
        .max(50)
        .required()
        .messages({
            'string.min': 'Username must be at least 3 characters long',
            'string.max': 'Username cannot exceed 50 characters',
            'any.required': 'Username is required'
        }),

    role: Joi.string()
        .valid('admin', 'store_manager', 'sales_rep', 'accountant')
        .default('sales_rep')
        .messages({
            'any.only': 'Role must be one of: admin, store_manager, sales_rep, accountant'
        }),

    phone: Joi.string()
        .pattern(/^(\+254|0)[17]\d{8}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Please provide a valid Kenyan phone number'
        })
});

/**
 * User login validation schema
 */
const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});

/**
 * User verification schema
 */
const verifyUserSchema = Joi.object({
    isVerified: Joi.boolean()
        .required()
        .messages({
            'any.required': 'Verification status is required'
        })
});

/**
 * Assign vehicle schema
 */
const assignVehicleSchema = Joi.object({
    vehicleId: Joi.string()
        .allow(null)
        .optional()
        .messages({
            'string.base': 'Vehicle ID must be a string or null'
        })
});

/**
 * Update user schema
 */
const updateUserSchema = Joi.object({
    username: Joi.string()
        .min(3)
        .max(50)
        .optional(),

    phone: Joi.string()
        .pattern(/^(\+254|0)[17]\d{8}$/)
        .optional(),

    role: Joi.string()
        .valid('admin', 'store_manager', 'sales_rep', 'accountant')
        .optional()
}).min(1); // At least one field must be provided

/**
 * User ID parameter schema
 */
const userIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'User ID is required'
        })
});

module.exports = {
    registerSchema,
    loginSchema,
    verifyUserSchema,
    assignVehicleSchema,
    updateUserSchema,
    userIdSchema
};
