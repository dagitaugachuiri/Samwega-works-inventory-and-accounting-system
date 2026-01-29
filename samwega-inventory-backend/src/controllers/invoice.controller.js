const invoiceService = require('../services/invoice.service');
const { successResponse, paginatedResponse } = require('../utils/response');

class InvoiceController {
    async createInvoice(req, res, next) {
        try {
            const invoice = await invoiceService.createInvoice(req.body);
            res.status(201).json(successResponse(invoice, 'Invoice created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getAllInvoices(req, res, next) {
        try {
            const result = await invoiceService.getAllInvoices(req.query);
            res.json(paginatedResponse(result.invoices, result.pagination.page, result.pagination.limit, result.pagination.total));
        } catch (error) {
            next(error);
        }
    }

    async getInvoiceById(req, res, next) {
        try {
            const invoice = await invoiceService.getInvoiceById(req.params.id);
            res.json(successResponse(invoice, 'Invoice retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateInvoice(req, res, next) {
        try {
            const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
            res.json(successResponse(invoice, 'Invoice updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async recordPayment(req, res, next) {
        try {
            const invoice = await invoiceService.recordPayment(req.params.id, req.body);
            res.json(successResponse(invoice, 'Payment recorded successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteInvoice(req, res, next) {
        try {
            await invoiceService.deleteInvoice(req.params.id);
            res.json(successResponse(null, 'Invoice deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new InvoiceController();
