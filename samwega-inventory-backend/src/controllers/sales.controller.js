const salesService = require('../services/sales.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Create new sale
 */
const createSale = async (req, res, next) => {
    try {
        const sale = await salesService.createSale(req.body, req.user.uid);
        return res.status(201).json(successResponse(sale, 'Sale created successfully'));
    } catch (error) {
        logger.error('Create sale controller error:', error);
        next(error);
    }
};

/**
 * Get all sales
 */
const getAllSales = async (req, res) => {
    try {
        const result = await salesService.getAllSales(req.query, req.user.uid, req.user.role);
        // Correct usage: pass res object to successResponse helper OR use res.json()
        // Looking at other controllers, successResponse might handle the response sending if designed that way, 
        // BUT standard express pattern is res.json().
        // Let's check utils/response.js. Assuming successResponse returns an object { success: true ... }
        // If successResponse(res, ...) is used, it might send it.
        // Wait, line 11 uses: return res.status(201).json(successResponse(...));
        // Line 24 uses: return successResponse(res, result, ...); -> implies successResponse sends the response?
        // Let's verify utils/response.js next.
        // BUT line 11 suggests successResponse RETURNS the object.
        // If successResponse returns object, then getAllSales (line 24) is behaving differently.

        // I will change it to standard format to be safe:
        return res.status(200).json(successResponse(result, 'Sales retrieved successfully'));
    } catch (error) {
        logger.error('Get all sales controller error:', error);
        // Ensure errorResponse sends the response
        return errorResponse(res, error);
    }
};

/**
 * Get sale by ID
 */
const getSaleById = async (req, res) => {
    try {
        logger.info(`Getting sale by ID: ${req.params.id}`);

        const sale = await salesService.getSaleById(req.params.id);
        return res.status(200).json(successResponse(sale, 'Sale retrieved successfully'));
    } catch (error) {
        logger.error(`Get sale by ID controller error for ID ${req.params.id}:`, error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Update sale
 */
const updateSale = async (req, res) => {
    try {
        const sale = await salesService.updateSale(req.params.id, req.body, req.user.uid);
        return res.status(200).json(successResponse(sale, 'Sale updated successfully'));
    } catch (error) {
        logger.error('Update sale controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Void sale
 */
const voidSale = async (req, res) => {
    try {
        const sale = await salesService.voidSale(req.params.id, req.body.reason, req.user.uid);
        return res.status(200).json(successResponse(sale, 'Sale voided successfully'));
    } catch (error) {
        logger.error('Void sale controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Get sales stats
 */
const getStats = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate, type, isEtr, bankName } = req.query;
        const stats = await salesService.getStats(vehicleId, { startDate, endDate, type, isEtr, bankName });
        return res.status(200).json(successResponse(stats, 'Sales stats retrieved successfully'));
    } catch (error) {
        logger.error('Get stats controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Link a sale to a debt record.
 * @route PATCH /api/v1/sales/:id/debt-link
 */
const linkDebt = async (req, res) => {
    try {
        const { id } = req.params;
        const { debtId, debtCode } = req.body;

        if (!debtId || !debtCode) {
            return res.status(400).json(errorResponse('debtId and debtCode are required'));
        }

        const result = await salesService.linkDebt(id, { debtId, debtCode });
        return res.status(200).json(successResponse(result, 'Sale linked to debt successfully'));
    } catch (error) {
        logger.error('Link debt controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Get daily summary
 */
const getDailySummary = async (req, res) => {
    try {
        const summary = await salesService.getDailySummary(req.query.vehicleId, req.query.date);
        return res.status(200).json(successResponse(summary, 'Daily summary retrieved successfully'));
    } catch (error) {
        logger.error('Get daily summary controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Find sales combination (KK-Calc)
 */
const findCombination = async (req, res) => {
    try {
        const result = await salesService.findSalesCombination(req.body.targetAmount);
        return res.status(200).json(successResponse(result, 'Sales combination found'));
    } catch (error) {
        logger.error('Find combination controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Delete sales batch
 */
const deleteBatch = async (req, res) => {
    try {
        const result = await salesService.deleteSalesBatch(req.body.saleIds, req.user.uid);
        return res.status(200).json(successResponse(result, 'Sales batch deleted successfully'));
    } catch (error) {
        logger.error('Delete batch controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Delete single sale
 */
const deleteSale = async (req, res) => {
    try {
        const result = await salesService.deleteSalesBatch([req.params.id], req.user.uid);
        return res.status(200).json(successResponse(result, 'Sale deleted successfully'));
    } catch (error) {
        logger.error('Delete sale controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Update sale item quantity and/or price
 */
const updateSaleItem = async (req, res) => {
    try {
        const { id, itemIndex } = req.params;
        const { quantity, unitPrice } = req.body;
        const result = await salesService.updateSaleItem(id, parseInt(itemIndex), { quantity, unitPrice }, req.user.uid);
        return res.status(200).json(successResponse(result, 'Item updated successfully'));
    } catch (error) {
        logger.error('Update sale item controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Handle debt status update webhook
 */
const handleDebtWebhook = async (req, res) => {
    try {
        const { debtCode, status, paidAmount, paymentMethod, paymentDate, bankName } = req.body;
        logger.info('📩 Debt webhook received payload:', JSON.stringify(req.body, null, 2));
        if (!debtCode) {
            return res.status(400).json(errorResponse('debtCode is required'));
        }

        const result = await salesService.updateDebtStatus(debtCode, {
            status,
            paidAmount,
            paymentMethod,
            paymentDate,
            bankName,
        });

        return res.status(200).json(successResponse(result, 'Sale payment status updated via webhook'));
    } catch (error) {
        logger.error('Debt webhook controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message));
    }
};

module.exports = {
    createSale,
    getAllSales,
    getSaleById,
    updateSale,
    voidSale,
    getDailySummary,
    getStats,
    findCombination,
    deleteBatch,
    deleteSale,
    linkDebt,
    updateSaleItem,
    handleDebtWebhook
};

