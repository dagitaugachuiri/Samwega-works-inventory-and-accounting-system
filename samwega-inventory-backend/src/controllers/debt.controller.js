/**
 * Debt Controller — exposes debt API proxy endpoints for the admin dashboard.
 *
 * Routes:
 *   GET  /api/v1/debt/dashboard-summary   → outstanding debt totals
 *   POST /api/v1/debt/enrich-sales        → batch-fetch debt records for a list of saleIds
 */

const debtService = require('../services/debt.service');
const salesService = require('../services/sales.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * GET /api/v1/debt/dashboard-summary
 * Returns live outstanding debt totals for the dashboard Debt card.
 * Query params: vehicleId (optional), startDate, endDate
 */
const getDashboardSummary = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate } = req.query;

        // Resolve vehiclePlate from vehicleId if provided
        let vehiclePlate;
        if (vehicleId) {
            try {
                const vehicle = await salesService.getVehicleById?.(vehicleId);
                vehiclePlate = vehicle?.plateNumber || vehicle?.vehiclePlate || undefined;
            } catch (_) {
                // non-fatal — proceed without vehicle filter
            }
        }

        const summary = await debtService.getDashboardSummary({ vehiclePlate, startDate, endDate });
        return res.status(200).json(successResponse(summary, 'Debt summary retrieved successfully'));
    } catch (error) {
        logger.error('Debt dashboard summary error:', error);
        return res.status(500).json(errorResponse('Failed to retrieve debt summary'));
    }
};

/**
 * POST /api/v1/debt/enrich-sales
 * Body: { saleIds: string[] }
 *
 * For each saleId, looks up the sale's debtId from Firestore, then fetches the live
 * debt record from the debt API. Returns a map of { saleId → debtRecord }.
 *
 * This is called once per dashboard load to enrich the sales table with debt status.
 */
const enrichSales = async (req, res) => {
    try {
        const { saleIds } = req.body;
        if (!Array.isArray(saleIds) || saleIds.length === 0) {
            return res.status(200).json(successResponse({}, 'No sales to enrich'));
        }

        // Fetch the debtId for each sale from Firestore (batch)
        const db = require('../config/firebase.config').getFirestore();
        const salesRef = db.collection('sales');

        const saleSnapshots = await Promise.allSettled(
            saleIds.map((id) => salesRef.doc(id).get())
        );

        // Build debtId → saleId map
        const debtIdToSaleId = {};
        const debtIds = [];

        saleSnapshots.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.exists) {
                const data = result.value.data();
                const debtId = data?.debtId;
                if (debtId) {
                    debtIdToSaleId[debtId] = saleIds[index];
                    debtIds.push(debtId);
                }
            }
        });

        // Batch-fetch debt records from external debt API
        const debtMap = await debtService.getDebtsByIds(debtIds);

        // Remap from debtId → saleId
        const result = {};
        for (const [debtId, debtRecord] of Object.entries(debtMap)) {
            const saleId = debtIdToSaleId[debtId];
            if (saleId) {
                result[saleId] = debtRecord;
            }
        }

        return res.status(200).json(successResponse(result, 'Sales enriched with debt data'));
    } catch (error) {
        logger.error('Enrich sales error:', error);
        return res.status(500).json(errorResponse('Failed to enrich sales with debt data'));
    }
};

module.exports = { getDashboardSummary, enrichSales };
