const vehicleService = require('../services/vehicle.service');
const salesService = require('../services/sales.service');
const customerService = require('../services/customer.service');
const expenseService = require('../services/expense.service');
const receiptService = require('../services/receipt.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get vehicle inventory with current stock
 */
const getVehicleInventory = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const inventory = await vehicleService.getVehicleInventory(vehicleId);
        return successResponse(res, { inventory }, 'Vehicle inventory retrieved successfully');
    } catch (error) {
        logger.error('Get vehicle inventory controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Generate vehicle inventory report
 */
const getInventoryReport = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        // Get vehicle details
        const vehicle = await vehicleService.getVehicleById(vehicleId);

        // Get vehicle inventory
        const inventory = await vehicleService.getVehicleInventory(vehicleId);

        // Calculate totals
        let totalItems = 0;
        let totalValue = 0;

        const inventoryWithDetails = inventory.map(item => {
            const layers = item.layers || [];
            const totalQuantity = layers.reduce((sum, layer) => sum + (layer.quantity || 0), 0);
            const itemValue = totalQuantity * (item.sellingPrice || 0);

            totalItems += totalQuantity;
            totalValue += itemValue;

            return {
                ...item,
                totalQuantity,
                itemValue
            };
        });

        const report = {
            vehicle: {
                id: vehicle.id,
                name: vehicle.vehicleName,
                number: vehicle.vehicleNumber,
                assignedUser: vehicle.assignedUserName
            },
            inventory: inventoryWithDetails,
            summary: {
                totalItems,
                totalValue,
                itemCount: inventory.length,
                generatedAt: new Date().toISOString()
            }
        };

        return successResponse(res, report, 'Inventory report generated successfully');
    } catch (error) {
        logger.error('Get inventory report controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Create sale (POS endpoint)
 */
const createSale = async (req, res) => {
    try {
        const sale = await salesService.createSale(req.body, req.user.uid);

        // Update customer stats if customer is provided
        if (req.body.customerName && sale.customerId) {
            const isCredit = req.body.paymentMethod === 'credit';
            await customerService.updatePurchaseStats(sale.customerId, sale.grandTotal, isCredit);
        }

        return successResponse(res, sale, 'Sale created successfully', 201);
    } catch (error) {
        logger.error('Create sale (POS) controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Search customers (autocomplete)
 */
const searchCustomers = async (req, res) => {
    try {
        const { q, limit } = req.query;
        const customers = await customerService.searchCustomers(q, limit);
        return successResponse(res, { customers }, 'Customers found successfully');
    } catch (error) {
        logger.error('Search customers (POS) controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Generate receipt for printing
 */
const generateReceipt = async (req, res) => {
    try {
        const { saleId } = req.params;
        const { width = 48 } = req.query;

        const thermalReceipt = await receiptService.generateThermalReceipt(saleId, parseInt(width));

        return successResponse(res, {
            receipt: thermalReceipt,
            saleId,
            width: parseInt(width)
        }, 'Receipt generated successfully');
    } catch (error) {
        logger.error('Generate receipt (POS) controller error:', error);
        return errorResponse(res, error);
    }
};

/**
 * Submit expense (sales rep)
 */
const submitExpense = async (req, res) => {
    try {
        const expense = await expenseService.createExpense(req.body, req.user.uid);
        return successResponse(res, expense, 'Expense submitted successfully', 201);
    } catch (error) {
        logger.error('Submit expense (POS) controller error:', error);
        return errorResponse(res, error);
    }
};

module.exports = {
    getVehicleInventory,
    getInventoryReport,
    createSale,
    searchCustomers,
    generateReceipt,
    submitExpense
};
