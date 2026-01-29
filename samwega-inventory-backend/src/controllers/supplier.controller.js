const supplierService = require('../services/supplier.service');
const { successResponse, paginatedResponse } = require('../utils/response');

class SupplierController {
    async createSupplier(req, res, next) {
        try {
            const supplier = await supplierService.createSupplier(req.body);
            res.status(201).json(successResponse(supplier, 'Supplier created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getAllSuppliers(req, res, next) {
        try {
            const result = await supplierService.getAllSuppliers(req.query);
            res.json(paginatedResponse(result.suppliers, result.pagination.page, result.pagination.limit, result.pagination.total));
        } catch (error) {
            next(error);
        }
    }

    async getSupplierById(req, res, next) {
        try {
            const supplier = await supplierService.getSupplierById(req.params.id);
            res.json(successResponse(supplier, 'Supplier retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateSupplier(req, res, next) {
        try {
            const supplier = await supplierService.updateSupplier(req.params.id, req.body);
            res.json(successResponse(supplier, 'Supplier updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteSupplier(req, res, next) {
        try {
            await supplierService.deleteSupplier(req.params.id);
            res.json(successResponse(null, 'Supplier deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SupplierController();
