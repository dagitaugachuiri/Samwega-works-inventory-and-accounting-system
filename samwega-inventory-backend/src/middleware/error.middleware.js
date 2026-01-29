const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const config = require('../config/environment');

/**
 * Global error handling middleware
 * Must be placed after all routes
 */
const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.uid || 'anonymous'
    });

    // Default error
    let statusCode = 500;
    let message = 'Internal server error';
    let details = null;

    // Handle operational errors
    if (err.isOperational) {
        statusCode = err.statusCode;
        message = err.message;

        if (err.field) {
            details = [{ field: err.field, message: err.message }];
        }
    }

    // Handle Joi validation errors
    if (err.isJoi || (err.name === 'ValidationError' && err.details)) {
        statusCode = 400;
        message = 'Validation failed';
        if (err.details && Array.isArray(err.details)) {
            details = err.details.map(detail => ({
                field: detail.path ? detail.path.join('.') : 'unknown',
                message: detail.message || err.message
            }));
        } else {
            details = [{ field: 'unknown', message: err.message }];
        }
    }

    // Handle Firebase errors
    if (err.code && typeof err.code === 'string' && err.code.startsWith('auth/')) {
        statusCode = 401;
        message = err.message;
    }

    // Handle Firestore errors (numeric codes)
    if (err.code && typeof err.code === 'number') {
        statusCode = 500;
        message = err.message || 'Database error';
    }

    // Build and send error response
    const response = {
        success: false,
        error: message,
        statusCode
    };

    if (details) {
        response.details = details;
    }

    // Include stack trace in development
    if (config.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);

    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.originalUrl} not found`,
        statusCode: 404
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};
