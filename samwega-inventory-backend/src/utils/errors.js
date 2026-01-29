/**
 * Base Error Class
 */
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation Error (400)
 */
class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 400);
        this.name = 'ValidationError';
        this.field = field;
    }
}

/**
 * Authentication Error (401)
 */
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization Error (403)
 */
class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403);
        this.name = 'AuthorizationError';
    }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}

/**
 * Database Error (500)
 */
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500);
        this.name = 'DatabaseError';
    }
}

/**
 * External Service Error (502)
 */
class ExternalServiceError extends AppError {
    constructor(service, message = 'External service unavailable') {
        super(`${service}: ${message}`, 502);
        this.name = 'ExternalServiceError';
        this.service = service;
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    DatabaseError,
    ExternalServiceError
};
