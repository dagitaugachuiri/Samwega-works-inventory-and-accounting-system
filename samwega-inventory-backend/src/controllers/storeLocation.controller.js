const storeLocationService = require('../services/storeLocation.service');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');

class StoreLocationController {
    async createLocation(req, res, next) {
        try {
            const location = await storeLocationService.createLocation(req.body);
            res.status(201).json(successResponse(location, 'Store location created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getAllLocations(req, res, next) {
        try {
            const locations = await storeLocationService.getAllLocations(req.query);
            res.json(successResponse(locations, 'Store locations retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getLocationById(req, res, next) {
        try {
            const location = await storeLocationService.getLocationById(req.params.id);
            res.json(successResponse(location, 'Store location retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateLocation(req, res, next) {
        try {
            const location = await storeLocationService.updateLocation(req.params.id, req.body);
            res.json(successResponse(location, 'Store location updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteLocation(req, res, next) {
        try {
            await storeLocationService.deleteLocation(req.params.id);
            res.json(successResponse(null, 'Store location deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new StoreLocationController();
