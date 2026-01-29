const warehouseService = require('../services/warehouse.service');
const { successResponse } = require('../utils/response');

class WarehouseController {
    async createWarehouse(req, res, next) {
        try {
            const warehouse = await warehouseService.createWarehouse(req.body);
            res.status(201).json(successResponse(warehouse, 'Warehouse created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getWarehouses(req, res, next) {
        try {
            const result = await warehouseService.getAllWarehouses(req.query);
            res.json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async getWarehouseById(req, res, next) {
        try {
            const warehouse = await warehouseService.getWarehouseById(req.params.id);
            res.json(successResponse(warehouse));
        } catch (error) {
            next(error);
        }
    }

    async updateWarehouse(req, res, next) {
        try {
            const warehouse = await warehouseService.updateWarehouse(
                req.params.id,
                req.body
            );
            res.json(successResponse(warehouse, 'Warehouse updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteWarehouse(req, res, next) {
        try {
            await warehouseService.deleteWarehouse(req.params.id);
            res.json(successResponse(null, 'Warehouse deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new WarehouseController();
