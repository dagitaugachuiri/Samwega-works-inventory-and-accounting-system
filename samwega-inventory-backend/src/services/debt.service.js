/**
 * Debt Service — proxy for the external Samwega Debt Management API.
 * Base URL: https://smwoks-kzpo.onrender.com/api
 *
 * This service does NOT write to the debt system — it reads only.
 * It is used to enrich sale records with live debt status on dashboard refresh.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const DEBT_API_BASE = process.env.DEBT_API_URL
const DEBT_API_TIMEOUT = 60000; // 60s to allow for Render cold starts

const debtApi = axios.create({
    baseURL: DEBT_API_BASE.endsWith('/') ? DEBT_API_BASE : `${DEBT_API_BASE}/`,
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

// Simple in-memory cache for debt records
const debtCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch a single debt record by its Firestore document ID.
 * @param {string} debtId
 * @returns {object|null}
 */
const getDebtById = async (debtId) => {
    try {
        // Check cache first
        if (debtCache.has(debtId)) {
            const cached = debtCache.get(debtId);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return cached.data;
            }
            debtCache.delete(debtId);
        }

        const response = await debtApi.get(`debts/${debtId}`);
        const debt = response.data?.data || response.data;
        if (!debt) return null;

        const enrichedDebt = { ...debt, displayStatus: resolveDebtDisplayStatus(debt) };

        // Update cache
        debtCache.set(debtId, { data: enrichedDebt, timestamp: Date.now() });

        return enrichedDebt;
    } catch (error) {
        logger.warn(`[DebtService] Failed to fetch debt ${debtId}: ${error.message}`);
        return null;
    }
};

/**
 * Batch-fetch debt records by an array of debt IDs.
 * Uses the new batch endpoint to reduce HTTP overhead by 99%.
 * @param {string[]} debtIds
 * @returns {Object} Map: { debtId → debtRecord }
 */
const getDebtsByIds = async (debtIds) => {
    if (!debtIds || debtIds.length === 0) return {};

    const uniqueIds = [...new Set(debtIds.filter(Boolean))];
    const result = {};
    const idsToFetch = [];

    // Check cache first
    uniqueIds.forEach(id => {
        if (debtCache.has(id)) {
            const cached = debtCache.get(id);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                result[id] = cached.data;
                return;
            }
            debtCache.delete(id);
        }
        idsToFetch.push(id);
    });

    if (idsToFetch.length === 0) return result;

    try {
        logger.info(`[DebtService] Batch fetching ${idsToFetch.length} debts...`);

        // Fetch in chunks of 100 to avoid huge payloads
        const CHUNK_SIZE = 100;
        for (let i = 0; i < idsToFetch.length; i += CHUNK_SIZE) {
            const chunk = idsToFetch.slice(i, i + CHUNK_SIZE);
            const response = await debtApi.post('debts/batch', { ids: chunk });

            const debts = response.data?.data || [];
            debts.forEach(debt => {
                if (debt && debt.id) {
                    const enrichedDebt = {
                        ...debt,
                        displayStatus: resolveDebtDisplayStatus(debt)
                    };
                    result[debt.id] = enrichedDebt;

                    // Update cache
                    debtCache.set(debt.id, { data: enrichedDebt, timestamp: Date.now() });
                }
            });
        }
    } catch (error) {
        logger.error(`[DebtService] Batch fetch failed: ${error.message}`);

        // Fallback for small batches if the batch endpoint fails
        if (idsToFetch.length < 5) {
            for (const id of idsToFetch) {
                const debt = await getDebtById(id);
                if (debt) result[id] = debt;
            }
        }
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
        const params = {};
        if (filters.vehiclePlate) params.vehiclePlate = filters.vehiclePlate;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        if (filters.bankName) params.bankName = filters.bankName;

        // Always compute the full collections breakdown locally (the external API
        // /debts/summary endpoint never returns per-bank/per-method breakdown).
        // This is the source of truth for the wallet transfer logic in getStats.
        const legacySummary = await legacyGetDashboardSummary(filters);
        return legacySummary;

    } catch (error) {
        const status = error.response?.status;
        const message = error.message;

        if (status === 502 || status === 504 || message.includes('timeout')) {
            logger.error(`[DebtService] External API unavailable (${status || 'timeout'}): ${message}`);
        } else {
            logger.error(`[DebtService] Failed to get dashboard summary: ${message}`);
        }

        return {
            totalOutstanding: 0,
            debtCount: 0,
            unpaidCount: 0,
            overdueCount: 0,
            partialCount: 0,
            collections: { cash: 0, mpesa: 0, bank: 0, bankBreakdown: {}, records: [] }
        };
    }
};

/**
 * Legacy summary calculation (fetches up to 1000 debts and aggregates in-memory).
 * Used as a fallback if the /summary endpoint fails.
 */
const legacyGetDashboardSummary = async (filters = {}) => {
    try {
        const params = { limit: 1000, offset: 0 };
        if (filters.vehiclePlate) params.vehiclePlate = filters.vehiclePlate;

        const response = await debtApi.get('debts', { params });
        const debts = response.data?.data || [];

        let totalOutstanding = 0;
        let debtCount = 0;
        let unpaidCount = 0;
        let overdueCount = 0;
        let partialCount = 0;

        // Collections aggregation
        const collections = {
            cash: 0,
            mpesa: 0,
            bank: 0,
            bankBreakdown: {},
            records: [] // Individual collection records for the UI
        };

        const targetBank = filters.bankName ? String(filters.bankName).toLowerCase() : null;

        for (const debt of debts) {
            // Filter: Ignore any debt that is not linked to a sale
            const description = String(debt.description || '').toLowerCase();
            const isLinkedByDescription = description.includes('receipt #');
            const isLinkedByList = filters.linkedDebtIds && filters.linkedDebtIds.includes(debt.id);

            if (!isLinkedByDescription && !isLinkedByList) {
                // If it doesn't look like a sale-linked debt, ignore it
                continue;
            }

            if (filters.startDate || filters.endDate) {
                const issued = debt.dateIssued;
                const issuedSeconds = issued?.seconds || issued?._seconds;
                if (!issuedSeconds) continue;
                const issuedMs = issuedSeconds * 1000;
                if (filters.startDate && issuedMs < new Date(filters.startDate).getTime()) continue;
                if (filters.endDate) {
                    const end = new Date(filters.endDate);
                    end.setHours(23, 59, 59, 999);
                    if (issuedMs > end.getTime()) continue;
                }
            }

            debtCount++;
            const remaining = Number(debt.remainingAmount || 0);
            const paid = Number(debt.paidAmount || 0);
            totalOutstanding += remaining;

            // Aggregate collections if there's a paid amount
            if (paid > 0) {
                const rawMethod = String(debt.paidPaymentMethod || debt.paymentMethod || '').toLowerCase();
                // 'manual_mpesa' is used by the payment endpoint for mpesa payments
                const isMpesa = rawMethod.includes('mpesa') || rawMethod.includes('mobile');
                const isBank = !isMpesa && (rawMethod.includes('bank') || rawMethod.includes('card') || rawMethod.includes('cheque'));
                const isCash = !isMpesa && !isBank;

                // Extract bank name: payment endpoint saves it in bankDetails array
                // Fall back to top-level bankName for older records
                let resolvedBankName = debt.bankName || null;
                if (isBank) {
                    const bankDetailsArr = debt.bankDetails || [];
                    if (bankDetailsArr.length > 0) {
                        // Most recent payment's bank name
                        const lastEntry = bankDetailsArr[bankDetailsArr.length - 1];
                        resolvedBankName = lastEntry?.bankName || resolvedBankName || 'Other';
                    } else {
                        resolvedBankName = resolvedBankName || 'Other';
                    }
                }

                let shouldCount = true;
                if (targetBank) {
                    const debtBank = String(resolvedBankName || '').toLowerCase();
                    shouldCount = isBank && (debtBank.includes(targetBank) || rawMethod.includes(targetBank));
                }

                if (shouldCount) {
                    if (isCash) collections.cash += paid;
                    else if (isMpesa) collections.mpesa += paid;
                    else if (isBank) {
                        collections.bank += paid;
                        const bName = resolvedBankName || 'Other';
                        collections.bankBreakdown[bName] = (collections.bankBreakdown[bName] || 0) + paid;
                    }

                    // Add to records for UI display
                    collections.records.push({
                        id: debt.id,
                        debtCode: debt.debtCode,
                        customerName: debt.storeOwner?.name || 'Unknown',
                        vehiclePlate: debt.vehiclePlate || '—',
                        amount: paid,
                        method: isMpesa ? 'mpesa' : (isBank ? 'bank' : 'cash'),
                        bankName: isBank ? resolvedBankName : null,
                        date: debt.dateIssued,
                        isCollection: true
                    });
                }
            }

            if (debt.status === 'paid' && remaining === 0) {
                // fully paid
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

/**
 * Create a new debt record in the external debt system.
 * @param {object} debtData
 * @returns {Promise<object|null>}
 */
const createDebt = async (debtData) => {
    try {
        logger.info(`[DebtService] Creating debt in external API for ${debtData.customerName || 'customer'}...`);

        const response = await debtApi.post('debts', debtData);
        const result = response.data?.data || response.data;

        if (result && (result.id || result.debtCode)) {
            logger.info(`[DebtService] Successfully created debt. External ID: ${result.id}, Code: ${result.debtCode}`);
            return result;
        }

        logger.warn('[DebtService] Create debt returned unexpected response format');
        return result;
    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;
        logger.error(`[DebtService] Failed to create debt (${status || 'error'}): ${error.message}`, data);
        throw error;
    }
};

module.exports = {
    getDebtById,
    getDebtsByIds,
    getDashboardSummary,
    getDebtsBySaleIds,
    resolveDebtDisplayStatus,
    createDebt
};
