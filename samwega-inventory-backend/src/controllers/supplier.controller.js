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
            const base = paginatedResponse(result.suppliers, result.pagination.page, result.pagination.limit, result.pagination.total);
            // same shape the invoices list uses (res.pagination), plus totals across ALL suppliers
            res.json({ ...base, pagination: { ...result.pagination }, summary: result.summary });
        } catch (error) {
            next(error);
        }
    }

    async getSupplierOptions(req, res, next) {
        try {
            const options = await supplierService.getSupplierOptions();
            res.json(successResponse(options, 'Supplier options retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async recalculateFinancials(req, res, next) {
        try {
            const totals = await supplierService.recalculateFinancials(req.params.id);
            res.json(successResponse(totals, 'Supplier totals recalculated from invoices'));
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
