import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Placeholder for the new Debt API URL - User to update
const DEBT_API_URL = 'http://192.168.100.5:5000/api';

const apiService = axios.create({
    baseURL: DEBT_API_URL.endsWith('/') ? DEBT_API_URL : `${DEBT_API_URL}/`,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiService.interceptors.request.use(async (config) => {
    try {
        const token = await AsyncStorage.getItem('firebaseToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('[DebtService] Request URL:', (config.baseURL || '') + config.url);
    } catch (error) {
        console.error('[DebtAPI] Error fetching token:', error);
    }
    return config;
});

const DebtService = {
    /**
     * Create a new debt record in the debt management system.
     * Returns the full debt object including `id` (Firestore doc ID) and `debtCode` (6-digit code).
     */
    create: async (debtData) => {
        try {
            console.log('[DebtService] Creating debt record:', debtData);
            const response = await apiService.post('debts', debtData);
            // response.data structure: { success: true, data: { id, debtCode, ... } }
            const debtRecord = response.data?.data || response.data;
            console.log('[DebtService] Debt created. ID:', debtRecord?.id, 'Code:', debtRecord?.debtCode);
            return debtRecord;
        } catch (error) {
            console.error('[DebtService] Error creating debt:', error);
            if (error.response) {
                console.error('[DebtService] Response data:', error.response.data);
            }
            throw error;
        }
    },

    /**
     * Fetch a debt record by its debtCode (6-digit account number).
     */
    fetchByCode: async (debtCode) => {
        try {
            const response = await apiService.get(`debts?debtCode=${debtCode}&limit=1`);
            const debts = response.data?.data || [];
            return debts.length > 0 ? debts[0] : null;
        } catch (error) {
            console.error('[DebtService] Error fetching debt by code:', error);
            return null;
        }
    },

    /**
     * Fetch a debt record by its Firestore document ID.
     */
    fetchById: async (debtId) => {
        try {
            const response = await apiService.get(`debts/${debtId}`);
            return response.data?.data || response.data;
        } catch (error) {
            console.error('[DebtService] Error fetching debt by id:', error);
            return null;
        }
    },
};

export default DebtService;
