const authService = require('../services/auth.service');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');

class AuthController {
    /**
     * Register a new user
     * POST /api/v1/auth/register
     */
    async register(req, res, next) {
        try {
            const result = await authService.register(req.body);

            res.status(201).json(successResponse(
                result,
                'User registered successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Login user
     * POST /api/v1/auth/login
     */
    async login(req, res, next) {
        try {
            const result = await authService.login(req.body.email, req.body.password);

            res.json(successResponse(
                result,
                'Login successful'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all users
     * GET /api/v1/users
     */
    async getAllUsers(req, res, next) {
        try {
            const filters = {
                role: req.query.role,
                isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined
            };

            const users = await authService.getAllUsers(filters);

            res.json(successResponse(
                users,
                'Users retrieved successfully',
                { count: users.length }
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user by ID
     * GET /api/v1/users/:id
     */
    async getUserById(req, res, next) {
        try {
            const user = await authService.getUserById(req.params.id);

            res.json(successResponse(
                user,
                'User retrieved successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Verify user
     * PATCH /api/v1/users/:id/verify
     */
    async verifyUser(req, res, next) {
        try {
            const user = await authService.verifyUser(req.params.id, req.body.isVerified);

            res.json(successResponse(
                user,
                `User ${req.body.isVerified ? 'verified' : 'unverified'} successfully`
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Assign vehicle to user
     * PATCH /api/v1/users/:id/assign-vehicle
     */
    async assignVehicle(req, res, next) {
        try {
            const user = await authService.assignVehicle(req.params.id, req.body.vehicleId);

            res.json(successResponse(
                user,
                'Vehicle assigned successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update user
     * PATCH /api/v1/users/:id
     */
    async updateUser(req, res, next) {
        try {
            const user = await authService.updateUser(req.params.id, req.body);

            res.json(successResponse(
                user,
                'User updated successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get current user
     * GET /api/v1/auth/me
     */
    async getCurrentUser(req, res, next) {
        try {
            const user = await authService.getUserById(req.user.uid);

            res.json(successResponse(
                user,
                'Current user retrieved successfully'
            ));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
