const invoiceService = require('../services/invoice.service');
const { successResponse, paginatedResponse } = require('../utils/response');

class InvoiceController {
    async createInvoice(req, res, next) {
        try {
            const invoice = await invoiceService.createInvoice(req.body, req.user);
            res.status(201).json(successResponse(invoice, 'Invoice created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getAllInvoices(req, res, next) {
        try {
            const result = await invoiceService.getAllInvoices(req.query);
            const base = paginatedResponse(
                result.invoices,
                result.pagination.page,
                result.pagination.limit,
                result.pagination.total
            );
            // keep your usual response shape, but guarantee the full pagination info is present
            res.json({ ...base, pagination: { ...(base.pagination || {}), ...result.pagination }, summary: result.summary });
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

    async getInvoiceItems(req, res, next) {
        try {
            const items = await invoiceService.getInvoiceItems(req.params.id);
            res.json(successResponse(items, 'Invoice items retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateInvoice(req, res, next) {
        try {
            const invoice = await invoiceService.updateInvoice(req.params.id, req.body, req.user);
            res.json(successResponse(invoice, 'Invoice updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async recordPayment(req, res, next) {
        try {
            const invoice = await invoiceService.recordPayment(req.params.id, req.body, req.user);
            res.json(successResponse(invoice, 'Payment recorded successfully'));
        } catch (error) {
            next(error);
        }
    }

    async removeInvoiceItems(req, res, next) {
        try {
            const result = await invoiceService.removeItems(req.params.id, req.body.adjustmentIds, req.user);
            res.json(successResponse(result, 'Items removed from invoice'));
        } catch (error) {
            next(error);
        }
    }

    async reverseInvoice(req, res, next) {
        try {
            const result = await invoiceService.reverseInvoice(req.params.id, req.body.reason, req.user);
            res.json(successResponse(result, 'Invoice reversed successfully'));
        } catch (error) {
            next(error);
        }
    }

    async cleanupInvoices(req, res, next) {
        try {
            const result = await invoiceService.cleanupInvoices(req.body);
            const msg = result.dryRun
                ? `${result.count} invoice(s) would be affected (nothing changed yet)`
                : `${result.count} invoice(s) updated`;
            res.json(successResponse(result, msg));
        } catch (error) {
            next(error);
        }
    }

    async deleteInvoice(req, res, next) {
        try {
            await invoiceService.deleteInvoice(req.params.id, req.user);
            res.json(successResponse(null, 'Invoice deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new InvoiceController();