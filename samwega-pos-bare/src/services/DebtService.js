import api from './api';

/**
 * DebtService — routes all debt requests through the inventory backend (proxy).
 * This enforces the server-to-server information pipeline mandate.
 */
const DebtService = {
    /**
     * Create a new debt record in the debt management system.
     * Proxied through Inventory Backend: POST /api/v1/debt
     */
    create: async (debtData) => {
        try {
            console.log('[DebtService] Creating debt record (via proxy):', debtData);
            const response = await api.post('/debt', debtData);
            // Backend successResponse structure: { success: true, data: { ... } }
            const debtRecord = response.data?.data || response.data || response;
            console.log('[DebtService] Debt created. ID:', debtRecord?.id, 'Code:', debtRecord?.debtCode);
            return debtRecord;
        } catch (error) {
            console.error('[DebtService] Error creating debt:', error);
            throw error;
        }
    },

    /**
     * Fetch a debt record by its debtCode (6-digit account number).
     * Proxied through Inventory Backend: GET /api/v1/debt/code/:code
     */
    fetchByCode: async (debtCode) => {
        try {
            const response = await api.get(`/debt/code/${debtCode}`);
            return response.data?.data || response.data || null;
        } catch (error) {
            console.error('[DebtService] Error fetching debt by code:', error);
            return null;
        }
    },

    /**
     * Fetch a debt record by its Firestore document ID.
     * Proxied through Inventory Backend: GET /api/v1/debt/:id
     */
    fetchById: async (debtId) => {
        try {
            const response = await api.get(`/debt/${debtId}`);
            return response.data?.data || response.data || null;
        } catch (error) {
            console.error('[DebtService] Error fetching debt by id:', error);
            return null;
        }
    },
};

export default DebtService;
