const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

/**
 * Validate request data against Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // Return all errors
            stripUnknown: true // Remove unknown keys
        });

        if (error) {
            const details = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/"/g, '')
            }));

            // Log validation errors for debugging
            console.error('Validation Error Details:', JSON.stringify(details, null, 2));

            const validationError = new ValidationError('Validation failed');
            validationError.details = details;
            validationError.isJoi = true;

            return next(validationError);
        }

        // Replace request data with validated and sanitized data
        req[property] = value;
        next();
    };
};

/**
 * Validate request body
 * @param {Joi.Schema} schema
 * @returns {Function}
 */
const validateBody = (schema) => validate(schema, 'body');

/**
 * Validate query parameters
 * @param {Joi.Schema} schema
 * @returns {Function}
 */
const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validate URL parameters
 * @param {Joi.Schema} schema
 * @returns {Function}
 */
const validateParams = (schema) => validate(schema, 'params');

module.exports = {
    validate,
    validateBody,
    validateQuery,
    validateParams
};
