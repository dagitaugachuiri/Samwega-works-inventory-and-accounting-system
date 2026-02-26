const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');
const { verifyToken, requireRole, requireVerified, logActivity } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const {
    createExpenseSchema,
    updateExpenseSchema,
    approveExpenseSchema,
    expenseIdSchema,
    searchExpensesSchema,
    categorySummarySchema
} = require('../validators/expense.validator');

/**
 * @route   POST /api/v1/expenses
 * @desc    Create expense
 * @access  All verified users
 */
router.post(
    '/',
    verifyToken,
    requireVerified,
    logActivity('CREATE', 'expense'),
    writeLimiter,
    validateBody(createExpenseSchema),
    expenseController.createExpense
);

/**
 * @route   GET /api/v1/expenses
 * @desc    Get all expenses (filtered by role)
 * @access  All verified users
 */
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchExpensesSchema),
    expenseController.getAllExpenses
);

/**
 * @route   GET /api/v1/expenses/summary/category
 * @desc    Get expenses by category
 * @access  All verified users (filtered by role in controller)
 */
router.get(
    '/summary/category',
    verifyToken,
    requireVerified,
    validateQuery(categorySummarySchema),
    expenseController.getExpensesByCategory
);

/**
 * @route   GET /api/v1/expenses/:id
 * @desc    Get expense by ID
 * @access  All verified users
 */
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(expenseIdSchema),
    expenseController.getExpenseById
);

/**
 * @route   PUT /api/v1/expenses/:id
 * @desc    Update expense (only pending)
 * @access  Expense submitter
 */
router.put(
    '/:id',
    verifyToken,
    requireVerified,
    logActivity('UPDATE', 'expense'),
    writeLimiter,
    validateParams(expenseIdSchema),
    validateBody(updateExpenseSchema),
    expenseController.updateExpense
);

/**
 * @route   POST /api/v1/expenses/:id/approve
 * @desc    Approve or reject expense
 * @access  Admin, Store Manager
 */
router.post(
    '/:id/approve',
    verifyToken,
    requireRole('admin', 'store_manager', 'accountant'),
    logActivity('APPROVE', 'expense'),
    writeLimiter,
    validateParams(expenseIdSchema),
    validateBody(approveExpenseSchema),
    expenseController.approveExpense
);

/**
 * @route   DELETE /api/v1/expenses/:id
 * @desc    Delete expense (only pending)
 * @access  Expense submitter
 */
router.delete(
    '/:id',
    verifyToken,
    requireVerified,
    logActivity('DELETE', 'expense'),
    writeLimiter,
    validateParams(expenseIdSchema),
    expenseController.deleteExpense
);

module.exports = router;
