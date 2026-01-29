const vehicleService = require('../services/vehicle.service');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Create new vehicle
 */
const createVehicle = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.createVehicle(req.body);
        res.status(201).json(successResponse(vehicle, 'Vehicle created successfully'));
    } catch (error) {
        logger.error('Create vehicle controller error:', error);
        next(error);
    }
};

/**
 * Get all vehicles
 */
const getAllVehicles = async (req, res, next) => {
    logger.info('getAllVehicles: Controller started', { query: req.query });
    try {
        logger.info('getAllVehicles: Calling service...');
        const result = await vehicleService.getAllVehicles(req.query);
        logger.info('getAllVehicles: Service returned', { vehicleCount: result?.vehicles?.length || 0 });
        res.json(successResponse(result, 'Vehicles retrieved successfully'));
    } catch (error) {
        logger.error('Get all vehicles controller error:', error);
        next(error);
    }
};

/**
 * Get vehicle by ID
 */
const getVehicleById = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.getVehicleById(req.params.id);
        res.json(successResponse(vehicle, 'Vehicle retrieved successfully'));
    } catch (error) {
        logger.error('Get vehicle by ID controller error:', error);
        next(error);
    }
};

/**
 * Update vehicle
 */
const updateVehicle = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.updateVehicle(req.params.id, req.body);
        res.json(successResponse(vehicle, 'Vehicle updated successfully'));
    } catch (error) {
        logger.error('Update vehicle controller error:', error);
        next(error);
    }
};

/**
 * Delete vehicle
 */
const deleteVehicle = async (req, res, next) => {
    try {
        await vehicleService.deleteVehicle(req.params.id);
        res.json(successResponse(null, 'Vehicle deleted successfully'));
    } catch (error) {
        logger.error('Delete vehicle controller error:', error);
        next(error);
    }
};

/**
 * Assign user to vehicle
 */
const assignUser = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.assignUser(req.params.id, req.body.userId);
        res.json(successResponse(vehicle, 'User assigned to vehicle successfully'));
    } catch (error) {
        logger.error('Assign user controller error:', error);
        next(error);
    }
};

/**
 * Get vehicle inventory
 */
const getVehicleInventory = async (req, res, next) => {
    try {
        const inventory = await vehicleService.getVehicleInventory(req.params.id);
        res.json(successResponse(inventory, 'Vehicle inventory retrieved successfully'));
    } catch (error) {
        logger.error('Get vehicle inventory controller error:', error);
        next(error);
    }
};

/**
 * Get vehicle issuances
 */
const getVehicleIssuances = async (req, res, next) => {
    try {
        const issuances = await vehicleService.getVehicleIssuances(req.params.id);
        res.json(successResponse(issuances, 'Vehicle issuances retrieved successfully'));
    } catch (error) {
        logger.error('Get vehicle issuances controller error:', error);
        next(error);
    }
};

module.exports = {
    createVehicle,
    getAllVehicles,
    getVehicleById,
    updateVehicle,
    deleteVehicle,
    assignUser,
    getVehicleInventory,
    getVehicleIssuances
};
