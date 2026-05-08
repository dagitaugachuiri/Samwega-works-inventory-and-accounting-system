import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import sessionManager from '../utils/sessionManager';

// Backend API URL - Updated for local development
// const BASE_URL = 'http://192.168.100.5:8080/api/v1';
const BASE_URL = 'https://samwega-works-inventory-and-accounting-ef5a.onrender.com/api/v1';

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 60000, // 60 seconds to allow for backend + debt API cold starts
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to add the auth token and log requests
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('[API Request]', config.method.toUpperCase(), config.url, config.params || '');
        return config;
    },
    (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
    }
);

// Add a response interceptor to log errors and successes
api.interceptors.response.use(
    (response) => {
        console.log(`[API Response] ${response.status} ${response.config.url}`);
        return response;
    },
    (error) => {
        // If it's a timeout
        if (error.code === 'ECONNABORTED') {
            console.error('[API Timeout]', error.message);
        }

        // Check for 401 Unauthorized (token invalid or required)
        if (error.response?.status === 401) {
            console.error('[API 401 Unauthorized] Authentication required or token invalid');
            // Trigger session expired event
            sessionManager.triggerSessionExpired();
        }

        console.error('[API Response Error]', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        return Promise.reject(error);
    }
);

export const register = async (email, password, username, phone, role = 'sales_rep') => {
    const response = await api.post('/auth/register', {
        email,
        password,
        username,
        phone,
        role
    });
    return response.data;
};

export const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
};

export const collectLayer = async (issuanceId, itemIndex, layerIndex) => {
    const response = await api.patch(`/stock-issuance/${issuanceId}/item/${itemIndex}/layer/${layerIndex}/collect`);
    return response.data;
};

export const confirmTransfer = async (issuanceId) => {
    const response = await api.post(`/transfers/${issuanceId}/confirm`, {});
    return response.data;
};

export const getCollectedItems = async (vehicleId) => {
    const response = await api.get(`/vehicles/${vehicleId}/collected-items`);
    return response.data;
};

export const getVehicles = async () => {
    const response = await api.get('/vehicles');
    return response.data;
};

export const getIssuances = async (vehicleId) => {
    // Note: This endpoint was just added to the backend!
    const response = await api.get(`/vehicles/${vehicleId}/issuances`);
    return response.data;
};

export const breakVehicleUnit = async (vehicleId, inventoryId, unit, quantityToBreak, targetUnit) => {
    const response = await api.post(`/vehicles/${vehicleId}/break-unit`, { inventoryId, unit, quantityToBreak, targetUnit });
    return response.data;
};

export const recordSale = async (saleData) => {
    const response = await api.post('/sales', saleData);
    return response.data;
};

export const getSalesStats = async (params) => {
    const response = await api.get('/sales/dashboard-stats', { params });
    return response.data;
};

export const getSales = async (params) => {
    const response = await api.get('/sales', { params });
    return response.data;
};

export const getSaleById = async (saleId) => {
    const response = await api.get(`/sales/${saleId}`);
    return response.data;
};

/**
 * Patch sale record with debt system link fields (debtId, debtCode).
 * Called after a debt record is successfully created in the debt management server.
 */
export const patchSaleDebtLink = async (saleId, { debtId, debtCode }) => {
    const response = await api.patch(`/sales/${saleId}/debt-link`, { debtId, debtCode });
    return response.data;
};


export const searchCustomers = async (query) => {
    const response = await api.get('/customers/search', { params: { q: query, limit: 10 } });
    return response.data;
};

export const createCustomer = async (customerData) => {
    const response = await api.post('/customers', customerData);
    return response.data;
};

export const getVehicleInventory = async (vehicleId) => {
    const response = await api.get(`/vehicles/${vehicleId}/inventory`);
    return response.data;
};

export const getVehicleInventoryReport = async (vehicleId) => {
    const response = await api.get(`/reports/vehicle-inventory`, { params: { vehicleId } });
    return response.data;
};

export const getVehicleById = async (vehicleId) => {
    const response = await api.get(`/vehicles/${vehicleId}`);
    return response.data;
};

export const getInventory = async (params = {}) => {
    const response = await api.get('/inventory', { params });
    return response.data;
};

// Expenses
export const createExpense = async (expenseData) => {
    const response = await api.post('/expenses', expenseData);
    return response.data;
};

export const getExpenses = async (params = {}) => {
    const response = await api.get('/expenses', { params });
    return response.data;
};

export const getExpensesByCategory = async (params = {}) => {
    const response = await api.get('/expenses/summary/category', { params });
    return response.data;
};

export default api;
