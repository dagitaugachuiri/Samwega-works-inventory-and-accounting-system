/**
 * Debt Service — proxy for the external Samwega Debt Management API.
 * Base URL: https://smwoks-kzpo.onrender.com/api
 *
 * This service does NOT write to the debt system — it reads only.
 * It is used to enrich sale records with live debt status on dashboard refresh.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const DEBT_API_BASE = process.env.DEBT_API_URL || 'https://smwoks-kzpo.onrender.com/api';
const DEBT_API_TIMEOUT = 60000; // 60s to allow for Render cold starts

const debtApi = axios.create({
    baseURL: DEBT_API_BASE,
    timeout: DEBT_API_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
});

/**
 * Determine display status from a debt record.
 * The debt API has no explicit "partially_paid" status, so we infer it.
 */
const resolveDebtDisplayStatus = (debt) => {
    if (!debt) return 'unknown';
    if (debt.status === 'paid') return 'paid';
    if (debt.paidAmount > 0 && debt.remainingAmount > 0) return 'partial';
    if (debt.status === 'overdue') return 'overdue';
    return 'unpaid'; // pending
};

/**
 * Fetch a single debt record by its Firestore document ID.
 * @param {string} debtId
 * @returns {object|null}
 */
const getDebtById = async (debtId) => {
    try {
        const response = await debtApi.get(`/debts/${debtId}`);
        const debt = response.data?.data || response.data;
        return debt ? { ...debt, displayStatus: resolveDebtDisplayStatus(debt) } : null;
    } catch (error) {
        logger.warn(`[DebtService] Failed to fetch debt ${debtId}: ${error.message}`);
        return null;
    }
};

/**
 * Batch-fetch debt records by an array of debt IDs.
 * Runs requests in parallel (limited concurrency to avoid rate limits).
 * Returns a map: { debtId → debtRecord }
 * @param {string[]} debtIds
 * @returns {Object}
 */
const getDebtsByIds = async (debtIds) => {
    if (!debtIds || debtIds.length === 0) return {};

    const uniqueIds = [...new Set(debtIds.filter(Boolean))];
    const BATCH_SIZE = 10; // max concurrent requests

    const result = {};

    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        const batch = uniqueIds.slice(i, i + BATCH_SIZE);
        const promises = batch.map((id) => getDebtById(id).then((debt) => ({ id, debt })));
        const settled = await Promise.allSettled(promises);
        settled.forEach((item) => {
            if (item.status === 'fulfilled' && item.value.debt) {
                result[item.value.id] = item.value.debt;
            }
        });
    }

    return result;
};

/**
 * Get dashboard summary: total outstanding debt amount + counts.
 * Fetches all non-paid debts and aggregates remainingAmount.
 * Optional filters: vehiclePlate, startDate, endDate.
 * @param {object} filters
 * @returns {{ totalOutstanding, debtCount, unpaidCount, overdueCount, partialCount }}
 */
const getDashboardSummary = async (filters = {}) => {
    try {
        const params = { limit: 1000, offset: 0 };
        if (filters.vehiclePlate) params.vehiclePlate = filters.vehiclePlate;

        // Fetch all debts matching the filter
        const response = await debtApi.get('/debts', { params });
        const debts = response.data?.data || [];

        let totalOutstanding = 0;
        let debtCount = 0;
        let unpaidCount = 0;
        let overdueCount = 0;
        let partialCount = 0;

        // Collections aggregation (for payment method transfer to stats cards)
        const collections = {
            cash: 0,
            mpesa: 0,
            bank: 0
        };

        const targetBank = filters.bankName ? String(filters.bankName).toLowerCase() : null;

        for (const debt of debts) {
            if (filters.startDate || filters.endDate) {
                const issued = debt.dateIssued;
                const issuedSeconds = issued?.seconds || issued?._seconds;
                if (!issuedSeconds) continue;
                const issuedMs = issuedSeconds * 1000;
                if (filters.startDate && issuedMs < new Date(filters.startDate).getTime()) continue;
                if (filters.endDate && issuedMs > new Date(filters.endDate).getTime()) continue;
            }

            debtCount++;
            const remaining = Number(debt.remainingAmount || 0);
            const paid = Number(debt.paidAmount || 0);
            totalOutstanding += remaining;

            // Aggregate collections if there's a paid amount
            if (paid > 0) {
                const method = String(debt.paidPaymentMethod || '').toLowerCase();
                const isBank = method.includes('bank') || method.includes('card') || method.includes('cheque');

                // If a specific bank is requested, only count if it matches
                if (targetBank) {
                    const debtBank = String(debt.bankName || '').toLowerCase();
                    const match = debtBank.includes(targetBank) || method.includes(targetBank);

                    if (isBank && match) collections.bank += paid;
                } else {
                    if (method === 'cash') collections.cash += paid;
                    else if (method.includes('mpesa') || method.includes('mobile')) collections.mpesa += paid;
                    else if (isBank) collections.bank += paid;
                    else collections.cash += paid; // default fallback
                }
            }

            if (debt.status === 'paid' && remaining === 0) {
                // fully paid — not outstanding
            } else if (paid > 0 && remaining > 0) {
                partialCount++;
            } else if (debt.status === 'overdue') {
                overdueCount++;
            } else if (debt.status !== 'paid') {
                unpaidCount++;
            }
        }

        return {
            totalOutstanding,
            debtCount,
            unpaidCount,
            overdueCount,
            partialCount,
            collections
        };
    } catch (error) {
        logger.error(`[DebtService] Failed to get dashboard summary: ${error.message}`);
        return {
            totalOutstanding: 0,
            debtCount: 0,
            unpaidCount: 0,
            overdueCount: 0,
            partialCount: 0,
            collections: { cash: 0, mpesa: 0, bank: 0 }
        };
    }
};

/**
 * Batch-fetch debt records for a list of sale IDs.
 * First resolves the debtId for each sale from Firestore, then fetches live records.
 * @param {string[]} saleIds
 * @returns {Promise<Object>} Map of { saleId -> debtRecord }
 */
const getDebtsBySaleIds = async (saleIds) => {
    if (!saleIds || saleIds.length === 0) return {};

    const { getFirestore } = require('../config/firebase.config');
    const db = getFirestore();
    const salesRef = db.collection('sales');

    const saleSnapshots = await Promise.allSettled(
        saleIds.map((id) => salesRef.doc(id).get())
    );

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

    const debtMap = await getDebtsByIds(debtIds);

    const result = {};
    for (const [debtId, debtRecord] of Object.entries(debtMap)) {
        const saleId = debtIdToSaleId[debtId];
        if (saleId) {
            result[saleId] = debtRecord;
        }
    }

    return result;
};

module.exports = { getDebtById, getDebtsByIds, getDashboardSummary, getDebtsBySaleIds, resolveDebtDisplayStatus };
