const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { verifyToken, requireRole, requireVerified } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/v1/reports/sales
 * @desc    Get sales report
 * @access  All verified users
 */
router.get(
    '/sales',
    verifyToken,
    requireVerified,
    reportsController.getSalesReport
);

/**
 * @route   GET /api/v1/reports/products
 * @desc    Get product performance report
 * @access  Admin, Store Manager
 */
router.get(
    '/products',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.getProductPerformance
);

/**
 * @route   GET /api/v1/reports/salesreps
 * @desc    Get sales rep performance report
 * @access  Admin, Store Manager
 */
router.get(
    '/salesreps',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.getSalesRepPerformance
);

/**
 * @route   GET /api/v1/reports/payments
 * @desc    Get payment method report
 * @access  Admin, Store Manager
 */
router.get(
    '/payments',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.getPaymentMethodReport
);

/**
 * @route   GET /api/v1/reports/vehicle-inventory
 * @desc    Get vehicle inventory report (Live View)
 * @access  Admin, Store Manager
 */
router.get(
    '/vehicle-inventory',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.getVehicleInventoryReport
);

/**
 * @route   GET /api/v1/reports/customer-sales
 * @desc    Get customer sales report (JSON)
 * @access  All verified users
 */
router.get(
    '/customer-sales',
    verifyToken,
    requireVerified,
    reportsController.getCustomerSalesReport
);

/**
 * @route   GET /api/v1/reports/profit-loss
 * @desc    Get profit & loss report (JSON)
 * @access  Admin only
 */
router.get(
    '/profit-loss',
    verifyToken,
    requireRole('admin'),
    reportsController.getProfitLossReport
);

/**
 * @route   GET /api/v1/reports/expense
 * @desc    Get expense report (JSON)
 * @access  Admin, Store Manager
 */
router.get(
    '/expense',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.getExpenseReport
);



/**
 * @route   POST /api/v1/reports/generate/sales-pdf
 * @desc    Generate sales report PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/sales-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateSalesPDF
);

/**
 * @route   GET /api/v1/reports/generate/sales-pdf
 * @desc    Generate sales report PDF (Download via browser)
 * @access  Admin, Store Manager
 */
router.get(
    '/generate/sales-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateSalesPDF
);

/**
 * @route   POST /api/v1/reports/generate/inventory-pdf
 * @desc    Generate inventory report PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/inventory-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateInventoryPDF
);

/**
 * @route   POST /api/v1/reports/generate/profit-loss-pdf
 * @desc    Generate profit & loss PDF
 * @access  Admin only
 */
router.post(
    '/generate/profit-loss-pdf',
    verifyToken,
    requireRole('admin'),
    reportsController.generateProfitLossPDF
);

/**
 * @route   POST /api/v1/reports/generate/expense-pdf
 * @desc    Generate expense report PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/expense-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateExpensePDF
);

/**
 * @route   POST /api/v1/reports/generate/credit-sales-pdf
 * @desc    Generate credit sales & debts PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/credit-sales-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateCreditSalesPDF
);

/**
 * @route   POST /api/v1/reports/generate/customer-sales-pdf
 * @desc    Generate customer sales PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/customer-sales-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateCustomerSalesPDF
);

/**
 * @route   POST /api/v1/reports/generate/trip-sales-pdf
 * @desc    Generate trip sales PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/trip-sales-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateTripSalesPDF
);

/**
 * @route   POST /api/v1/reports/generate/vehicle-trip-history-pdf
 * @desc    Generate vehicle trip history PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/vehicle-trip-history-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateVehicleTripHistoryPDF
);

/**
 * @route   POST /api/v1/reports/generate/stock-movement-pdf
 * @desc    Generate stock movement PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/stock-movement-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateStockMovementPDF
);

/**
 * @route   GET /api/v1/reports/stock-movement
 * @desc    Get stock movement report (Live View)
 * @access  Admin, Store Manager
 */
router.get(
    '/stock-movement',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.getStockMovementReport
);

/**
 * @route   POST /api/v1/reports/generate/inventory-turnover-pdf
 * @desc    Generate inventory turnover PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/inventory-turnover-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateInventoryTurnoverPDF
);

/**
 * @route   GET /api/v1/reports/inventory-turnover
 * @desc    Get inventory turnover report (Live View)
 * @access  Admin, Store Manager
 */
router.get(
    '/inventory-turnover',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.getInventoryTurnoverReport
);

/**
 * @route   POST /api/v1/reports/generate/vehicle-inventory-pdf
 * @desc    Generate enhanced vehicle inventory PDF
 * @access  Admin, Store Manager
 */
router.post(
    '/generate/vehicle-inventory-pdf',
    verifyToken,
    requireRole('admin', 'store_manager'),
    reportsController.generateEnhancedVehicleInventoryPDF
);



module.exports = router;
