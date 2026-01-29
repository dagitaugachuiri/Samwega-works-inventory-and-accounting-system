const reportsService = require('../services/reports.service');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');
const pdfService = require('../services/pdf.service');

/**
 * Helper function to send PDF as download
 */
const sendPDFDownload = (res, pdfBuffer, filename) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
};

/**
 * Get sales report
 */
const getSalesReport = async (req, res, next) => {
    try {
        const report = await reportsService.getSalesReport(req.query);
        res.json(successResponse(report, 'Sales report retrieved successfully'));
    } catch (error) {
        logger.error('Get sales report controller error:', error);
        next(error);
    }
};

/**
 * Get product performance report
 */
const getProductPerformance = async (req, res, next) => {
    try {
        const { startDate, endDate, limit } = req.query;
        const report = await reportsService.getProductPerformance(startDate, endDate, parseInt(limit) || 20);
        res.json(successResponse(report, 'Product performance report retrieved successfully'));
    } catch (error) {
        logger.error('Get product performance controller error:', error);
        next(error);
    }
};

/**
 * Get sales rep performance report
 */
const getSalesRepPerformance = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await reportsService.getSalesRepPerformance(startDate, endDate);
        res.json(successResponse(report, 'Sales rep performance report retrieved successfully'));
    } catch (error) {
        logger.error('Get sales rep performance controller error:', error);
        next(error);
    }
};

/**
 * Get payment method report
 */
const getPaymentMethodReport = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await reportsService.getPaymentMethodReport(startDate, endDate);
        res.json(successResponse(report, 'Payment method report retrieved successfully'));
    } catch (error) {
        logger.error('Get payment method report controller error:', error);
        next(error);
    }
};

/**
 * Generate Sales Report PDF
 */
const generateSalesPDF = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        const reportData = await reportsService.generateComprehensiveSalesReport(startDate, endDate);
        const pdfBuffer = await pdfService.generateSalesReportPDF(reportData);
        const reportName = `sales-report-${startDate}-${endDate}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate sales PDF controller error:', error);
        next(error);
    }
};

/**
 * Generate Inventory Report PDF
 */
const generateInventoryPDF = async (req, res, next) => {
    try {
        const reportData = await reportsService.generateInventoryReport();
        const pdfBuffer = await pdfService.generateInventoryReportPDF(reportData);
        const reportName = `inventory-report-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate inventory PDF controller error:', error);
        next(error);
    }
};

/**
 * Generate Profit & Loss PDF
 */
const generateProfitLossPDF = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        const reportData = await reportsService.generateProfitLossReport(startDate, endDate);
        const pdfBuffer = await pdfService.generateProfitLossPDF(reportData);
        const reportName = `profit-loss-${startDate}-${endDate}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate P&L PDF controller error:', error);
        next(error);
    }
};

/**
 * Generate Expense Report PDF
 */
const generateExpensePDF = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        const reportData = await reportsService.generateExpenseReport(startDate, endDate);
        const pdfBuffer = await pdfService.generateExpenseReportPDF(reportData);
        const reportName = `expense-report-${startDate}-${endDate}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate expense PDF controller error:', error);
        next(error);
    }
};

/**
 * Generate Credit Sales & Debts PDF
 */
const generateCreditSalesPDF = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        const reportData = await reportsService.generateCreditSalesReport(startDate, endDate);
        const pdfBuffer = await pdfService.generateCreditSalesPDF(reportData);
        const reportName = `credit-sales-${startDate}-${endDate}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate credit sales PDF error:', error);
        next(error);
    }
};

/**
 * Generate Customer Sales PDF
 */
const generateCustomerSalesPDF = async (req, res, next) => {
    try {
        const { customerPhone, startDate, endDate } = req.body;
        const reportData = await reportsService.generateCustomerSalesReport(customerPhone, startDate, endDate);
        const pdfBuffer = await pdfService.generateCustomerSalesPDF(reportData);
        const reportName = `customer-sales-${customerPhone}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate customer sales PDF error:', error);
        next(error);
    }
};

/**
 * Generate Trip Sales PDF
 */
const generateTripSalesPDF = async (req, res, next) => {
    try {
        const { vehicleId, tripDate } = req.body;
        const reportData = await reportsService.generateTripSalesReport(vehicleId, tripDate);
        const pdfBuffer = await pdfService.generateTripSalesPDF(reportData);
        const reportName = `trip-sales-${vehicleId}-${tripDate}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate trip sales PDF error:', error);
        next(error);
    }
};

/**
 * Generate Vehicle Trip History PDF
 */
const generateVehicleTripHistoryPDF = async (req, res, next) => {
    try {
        const { vehicleId, startDate, endDate } = req.body;
        const reportData = await reportsService.generateVehicleTripHistory(vehicleId, startDate, endDate);
        const pdfBuffer = await pdfService.generateVehicleTripHistoryPDF(reportData);
        const reportName = `vehicle-trip-history-${vehicleId}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate vehicle trip history PDF error:', error);
        next(error);
    }
};

/**
 * Generate Stock Movement PDF
 */
const generateStockMovementPDF = async (req, res, next) => {
    try {
        const { startDate, endDate, filters } = req.body;
        const reportData = await reportsService.generateStockMovementReport(startDate, endDate, filters);
        const pdfBuffer = await pdfService.generateStockMovementPDF(reportData);
        const reportName = `stock-movement-${startDate}-${endDate}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate stock movement PDF error:', error);
        next(error);
    }
};

/**
 * Generate Inventory Turnover PDF
 */
const generateInventoryTurnoverPDF = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        const reportData = await reportsService.generateInventoryTurnoverReport(startDate, endDate);
        const pdfBuffer = await pdfService.generateInventoryTurnoverPDF(reportData);
        const reportName = `inventory-turnover-${startDate}-${endDate}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate inventory turnover PDF error:', error);
        next(error);
    }
};

/**
 * Generate Enhanced Vehicle Inventory PDF
 */
const generateEnhancedVehicleInventoryPDF = async (req, res, next) => {
    try {
        const { vehicleId } = req.body;
        const reportData = await reportsService.generateEnhancedVehicleInventoryReport(vehicleId);
        const pdfBuffer = await pdfService.generateEnhancedVehicleInventoryPDF(reportData);
        const reportName = `vehicle-inventory-${vehicleId}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate vehicle inventory PDF error:', error);
        next(error);
    }
};

/**
 * Generate Supplier Performance PDF
 */
const generateSupplierPerformancePDF = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        const reportData = await reportsService.generateSupplierPerformanceReport(startDate, endDate);
        const pdfBuffer = await pdfService.generateSupplierPerformancePDF(reportData);
        const reportName = `supplier-performance-${startDate}-${endDate}-${Date.now()}.pdf`;
        sendPDFDownload(res, pdfBuffer, reportName);
    } catch (error) {
        logger.error('Generate supplier performance PDF error:', error);
        next(error);
    }
};

module.exports = {
    getSalesReport,
    getProductPerformance,
    getSalesRepPerformance,
    getPaymentMethodReport,
    generateSalesPDF,
    generateInventoryPDF,
    generateProfitLossPDF,
    generateExpensePDF,
    generateCreditSalesPDF,
    generateCustomerSalesPDF,
    generateTripSalesPDF,
    generateVehicleTripHistoryPDF,
    generateStockMovementPDF,
    generateInventoryTurnoverPDF,
    generateEnhancedVehicleInventoryPDF,
    generateSupplierPerformancePDF
};
