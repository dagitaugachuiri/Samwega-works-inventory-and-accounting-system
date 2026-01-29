const rateLimit = require('express-rate-limit');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT.WINDOW_MS,
    max: config.RATE_LIMIT.MAX_REQUESTS,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: config.RATE_LIMIT.WINDOW_MS / 1000
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.',
            retryAfter: Math.ceil(config.RATE_LIMIT.WINDOW_MS / 1000)
        });
    }
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: 900 // 15 minutes in seconds
    },
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req, res) => {
        logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            error: 'Too many authentication attempts, please try again in 15 minutes.',
            retryAfter: 900
        });
    }
});

/**
 * Moderate rate limiter for write operations
 */
const writeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
        success: false,
        error: 'Too many write requests, please slow down.',
        retryAfter: 60
    },
    handler: (req, res) => {
        logger.warn(`Write rate limit exceeded for IP: ${req.ip}, User: ${req.user?.email || 'anonymous'}`);
        res.status(429).json({
            success: false,
            error: 'Too many write requests, please slow down.',
            retryAfter: 60
        });
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    writeLimiter
};
