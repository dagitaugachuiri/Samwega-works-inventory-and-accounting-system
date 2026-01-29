const morgan = require('morgan');
const logger = require('../utils/logger');
const config = require('../config/environment');

// Create custom token for user ID
morgan.token('user-id', (req) => {
    return req.user?.uid || 'anonymous';
});

// Create custom token for response time in ms
morgan.token('response-time-ms', (req, res) => {
    const responseTime = res.getHeader('X-Response-Time');
    return responseTime ? `${responseTime}ms` : '-';
});

// Define log format
const logFormat = config.NODE_ENV === 'production'
    ? ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms'
    : ':method :url :status :response-time ms - :res[content-length]';

// Create Morgan middleware with Winston integration
const morganMiddleware = morgan(logFormat, {
    stream: {
        write: (message) => {
            // Remove trailing newline
            logger.http(message.trim());
        }
    },
    skip: (req, res) => {
        // Skip logging for health check endpoints
        return req.url === '/health' || req.url === '/ping';
    }
});

/**
 * Request logger middleware - adds request ID and timing
 */
const requestLogger = (req, res, next) => {
    // Generate request ID
    req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log request start
    const startTime = Date.now();

    // Log response
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        // Only set header if headers haven't been sent yet
        if (!res.headersSent) {
            res.setHeader('X-Response-Time', duration);
        }

        logger.info('Request completed', {
            requestId: req.id,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.uid || 'anonymous',
            ip: req.ip
        });
    });

    next();
};

module.exports = {
    morganMiddleware,
    requestLogger
};
