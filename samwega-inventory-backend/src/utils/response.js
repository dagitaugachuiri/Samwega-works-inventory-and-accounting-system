/**
 * Standard success response
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {Object} meta - Additional metadata (pagination, etc.)
 * @returns {Object}
 */
const successResponse = (data, message = 'Success', meta = null) => {
    const response = {
        success: true,
        message,
        data
    };

    if (meta) {
        response.meta = meta;
    }

    return response;
};

/**
 * Standard error response
 * @param {string} message - Error message
 * @param {Array} details - Error details
 * @param {number} statusCode - HTTP status code
 * @returns {Object}
 */
const errorResponse = (message, details = null, statusCode = 500) => {
    const response = {
        success: false,
        error: message,
        statusCode
    };

    if (details) {
        response.details = details;
    }

    return response;
};

/**
 * Paginated response
 * @param {Array} data - Response data
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object}
 */
const paginatedResponse = (data, page, limit, total) => {
    return {
        success: true,
        data,
        meta: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(total),
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1
        }
    };
};

module.exports = {
    successResponse,
    errorResponse,
    paginatedResponse
};
