const expenseService = require('../services/expense.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Create expense
 */
const createExpense = async (req, res) => {
    try {
        const expense = await expenseService.createExpense(req.body, req.user.uid);
        return res.status(201).json(successResponse(expense, 'Expense created successfully'));
    } catch (error) {
        logger.error('Create expense controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Get all expenses
 */
const getAllExpenses = async (req, res) => {
    try {
        console.log('[ExpenseController] getAllExpenses called');
        const result = await expenseService.getAllExpenses(req.query, req.user.uid, req.user.role);
        console.log('[ExpenseController] Service returned, sending response...');
        return res.status(200).json(successResponse(result, 'Expenses retrieved successfully'));
    } catch (error) {
        console.log('[ExpenseController] Error occurred:', error.message);
        logger.error('Get all expenses controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Get expense by ID
 */
const getExpenseById = async (req, res) => {
    try {
        const expense = await expenseService.getExpenseById(req.params.id);
        return res.status(200).json(successResponse(expense, 'Expense retrieved successfully'));
    } catch (error) {
        logger.error('Get expense by ID controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Update expense
 */
const updateExpense = async (req, res) => {
    try {
        const expense = await expenseService.updateExpense(req.params.id, req.body, req.user.uid);
        return res.status(200).json(successResponse(expense, 'Expense updated successfully'));
    } catch (error) {
        logger.error('Update expense controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Approve or reject expense
 */
const approveExpense = async (req, res) => {
    try {
        const { approved, rejectionReason, notes } = req.body;
        const expense = await expenseService.approveExpense(
            req.params.id,
            approved,
            req.user.uid,
            rejectionReason,
            notes
        );
        return res.status(200).json(successResponse(expense, `Expense ${approved ? 'approved' : 'rejected'} successfully`));
    } catch (error) {
        logger.error('Approve expense controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Delete expense
 */
const deleteExpense = async (req, res) => {
    try {
        await expenseService.deleteExpense(req.params.id, req.user.uid);
        return res.status(200).json(successResponse(null, 'Expense deleted successfully'));
    } catch (error) {
        logger.error('Delete expense controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

/**
 * Get expenses by category
 */
const getExpensesByCategory = async (req, res) => {
    try {
        const { startDate, endDate, vehicleId } = req.query;
        const summary = await expenseService.getExpensesByCategory(startDate, endDate, vehicleId);
        return res.status(200).json(successResponse(summary, 'Category summary retrieved successfully'));
    } catch (error) {
        logger.error('Get expenses by category controller error:', error);
        return res.status(error.statusCode || 500).json(errorResponse(error.message, error.details));
    }
};

module.exports = {
    createExpense,
    getAllExpenses,
    getExpenseById,
    updateExpense,
    approveExpense,
    deleteExpense,
    getExpensesByCategory
};
