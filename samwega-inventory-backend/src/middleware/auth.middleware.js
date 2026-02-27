const { getAuth } = require('../config/firebase.config');
const { getFirestore } = require('../config/firebase.config');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Verify JWT token
 */
const verifyToken = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthenticationError('No token provided');
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify custom JWT token
        const jwt = require('jsonwebtoken');
        const config = require('../config/environment');

        let decodedToken;
        try {
            decodedToken = jwt.verify(token, config.JWT.SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new AuthenticationError('Token expired');
            }
            throw new AuthenticationError('Invalid token');
        }

        // Get user data from Firestore
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();

        if (!userDoc.exists) {
            throw new AuthenticationError('User not found');
        }

        const userData = userDoc.data();

        // Attach user to request
        req.user = {
            uid: decodedToken.uid,
            email: userData.email,
            username: userData.username,
            role: userData.role || 'sales_rep',
            isVerified: userData.isVerified,
            assignedVehicleId: userData.assignedVehicleId
        };

        logger.debug(`User authenticated: ${req.user.email}`);
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify custom JWT token
        const jwt = require('jsonwebtoken');
        const config = require('../config/environment');
        const decodedToken = jwt.verify(token, config.JWT.SECRET);

        const db = getFirestore();
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            req.user = {
                uid: decodedToken.uid,
                email: userData.email,
                username: userData.username,
                role: userData.role || 'sales_rep',
                isVerified: userData.isVerified,
                assignedVehicleId: userData.assignedVehicleId
            };
        }

        next();
    } catch (error) {
        // Ignore errors for optional auth
        next();
    }
};

/**
 * Require specific roles
 * @param {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AuthenticationError('Authentication required'));
        }

        if (!roles.includes(req.user.role)) {
            logger.warn(`Authorization failed: User ${req.user.email} with role ${req.user.role} attempted to access resource requiring roles: ${roles.join(', ')}`);
            return next(new AuthorizationError(`Access denied. Required roles: ${roles.join(', ')}`));
        }

        next();
    };
};

/**
 * Require user to be verified
 */
const requireVerified = (req, res, next) => {
    if (!req.user) {
        return next(new AuthenticationError('Authentication required'));
    }

    if (!req.user.isVerified) {
        return next(new AuthorizationError('Account not verified. Please contact administrator.'));
    }

    next();
};

/**
 * Require user to have assigned vehicle (for sales reps)
 */
const requireVehicle = (req, res, next) => {
    if (!req.user) {
        return next(new AuthenticationError('Authentication required'));
    }

    if (!req.user.assignedVehicleId) {
        return next(new AuthorizationError('No vehicle assigned. Please contact administrator.'));
    }

    next();
};

/**
 * Log specific actions to activity_logs collection
 * @param {string} action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {string} resource - Resource name
 */
const logActivity = (action, resource) => {
    return async (req, res, next) => {
        // Capture the original send and json methods to intercept the response body
        const originalSend = res.send;
        const originalJson = res.json;
        let responseBody;

        res.send = function (body) {
            responseBody = body;
            return originalSend.apply(res, arguments);
        };

        res.json = function (body) {
            responseBody = body;
            return originalJson.apply(res, arguments);
        };

        // We log after the request is successful
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const activityLogService = require('../services/activity-log.service');

                    // 1. Determine local resourceId (from params or body)
                    let resourceId = req.params.id || req.body.id || null;

                    // 2. Try to extract ID from response body if local is missing (common for CREATE)
                    if (!resourceId && responseBody) {
                        try {
                            // Handle both string and object bodies
                            const parsedBody = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
                            // Check for ID in various common locations
                            resourceId = parsedBody.data?.id || parsedBody.id || parsedBody.data?.uid || null;

                            // IF data is just a string, it might be the ID itself
                            if (!resourceId && typeof parsedBody.data === 'string' && parsedBody.data.length > 5) {
                                resourceId = parsedBody.data;
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }

                    // 3. Extract a helpful identifier from the request body or response
                    let identifier = '';
                    if (req.body) {
                        identifier = req.body.vehicleName ||
                            req.body.registrationNumber ||
                            req.body.name ||
                            req.body.fullName ||
                            req.body.username ||
                            req.body.invoiceNumber ||
                            req.body.reference ||
                            req.body.receiptNumber ||
                            '';
                    }

                    // If identifier is still empty, check the response body
                    if (!identifier && responseBody) {
                        try {
                            const parsedBody = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
                            const data = parsedBody.data || parsedBody;
                            identifier = data.invoiceNumber || data.receiptNumber || data.name || '';
                        } catch (e) { }
                    }

                    const description = `${action} ${resource}${identifier ? `: ${identifier}` : (resourceId ? ` (${resourceId})` : '')} by ${req.user.username || req.user.email}`;

                    await activityLogService.log({
                        userId: req.user.uid,
                        username: req.user.username || req.user.email,
                        action,
                        resource,
                        resourceId: resourceId ? String(resourceId) : null,
                        description,
                        details: {
                            method: req.method,
                            url: req.originalUrl,
                            params: req.params,
                            identifier: identifier || null,
                            statusCode: res.statusCode
                            // body: req.body // Be careful with sensitive data
                        }
                    });
                } catch (error) {
                    logger.error('Failed to log activity in middleware:', error);
                }
            }
        });
        next();
    };
};

module.exports = {
    verifyToken,
    optionalAuth,
    requireRole,
    requireVerified,
    requireVehicle,
    logActivity
};
