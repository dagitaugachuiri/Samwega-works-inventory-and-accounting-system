const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

class APIClient {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = null;
    }

    setToken(token) {
        this.token = token;
        if (typeof window !== 'undefined') {
            localStorage.setItem('authToken', token);
        }
    }

    getToken() {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('authToken');
        }
        return this.token;
    }

    clearToken() {
        this.token = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('authToken');
        }
    }

    logout() {
        this.clearToken();
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        };

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers,
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                // Response wasn't JSON
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                return { success: true };
            }

            if (!response.ok) {
                // Create a rich error object with message and details from backend
                const error = new Error(data.message || data.error || 'API request failed');
                error.statusCode = response.status;
                error.details = data.details || null;
                error.data = data;
                error.isValidation = response.status >= 400 && response.status < 500;
                throw error;
            }

            return data;
        } catch (error) {
            // Log as warning for validation errors, error for others
            if (error.isValidation) {
                console.warn('Validation:', error.message);
            } else {
                console.error('API Error:', error.message);
            }
            throw error;
        }
    }

    // ==================== AUTH ====================
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async login(email, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (response.data?.token) {
            this.setToken(response.data.token);
        }
        return response;
    }

    async logout() {
        this.clearToken();
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    // ==================== INVENTORY ====================
    async getInventory(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/inventory${query ? `?${query}` : ''}`);
    }

    async getInventoryById(id) {
        return this.request(`/inventory/${id}`);
    }

    async createInventoryItem(data) {
        return this.request('/inventory', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateInventoryItem(id, data) {
        return this.request(`/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteInventoryItem(id) {
        return this.request(`/inventory/${id}`, {
            method: 'DELETE',
        });
    }

    async adjustStock(id, data) {
        return this.request(`/inventory/${id}/adjust`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async getLowStockItems() {
        return this.request('/inventory/low-stock');
    }

    async replenishItem(id, data) {
        return this.request(`/inventory/${id}/replenish`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async generateSKU(category) {
        return this.request(`/inventory/generate-sku?category=${category || ''}`);
    }

    async recordInvoicePayment(invoiceId, paymentData) {
        return this.request(`/invoices/${invoiceId}/payments`, {
            method: 'POST',
            body: JSON.stringify(paymentData),
        });
    }

    // ==================== STORE LOCATIONS ====================
    async getStoreLocations(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/store-locations${query ? `?${query}` : ''}`);
    }

    async createStoreLocation(data) {
        return this.request('/store-locations', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateStoreLocation(id, data) {
        return this.request(`/store-locations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteStoreLocation(id) {
        return this.request(`/store-locations/${id}`, {
            method: 'DELETE',
        });
    }

    // ==================== VEHICLES ====================
    async getVehicles(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/vehicles${query ? `?${query}` : ''}`);
    }

    async getVehicleById(id) {
        return this.request(`/vehicles/${id}`);
    }

    async createVehicle(data) {
        return this.request('/vehicles', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateVehicle(id, data) {
        return this.request(`/vehicles/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteVehicle(id) {
        return this.request(`/vehicles/${id}`, {
            method: 'DELETE',
        });
    }

    async getVehicleInventory(id) {
        return this.request(`/vehicles/${id}/inventory`);
    }

    // ==================== TRANSFERS ====================
    async getTransfers(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/transfers${query ? `?${query}` : ''}`);
    }

    async getTransferById(id) {
        return this.request(`/transfers/${id}`);
    }

    async createTransfer(data) {
        return this.request('/transfers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async approveTransfer(id, data) {
        return this.request(`/transfers/${id}/approve`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async completeTransfer(id, data) {
        return this.request(`/transfers/${id}/complete`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async cancelTransfer(id, reason) {
        return this.request(`/transfers/${id}/cancel`, {
            method: 'PUT',
            body: JSON.stringify({ reason }),
        });
    }

    // ==================== SALES ====================
    async getSales(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/sales${query ? `?${query}` : ''}`);
    }

    async getSaleById(id) {
        return this.request(`/sales/${id}`);
    }

    async createSale(data) {
        return this.request('/sales', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async voidSale(id, reason) {
        return this.request(`/sales/${id}/void`, {
            method: 'PUT',
            body: JSON.stringify({ reason }),
        });
    }

    async getDailySummary(vehicleId, date) {
        return this.request(`/sales/daily-summary?vehicleId=${vehicleId}&date=${date}`);
    }

    // ==================== RECONCILIATION ====================
    async getReconciliations(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/reconciliation${query ? `?${query}` : ''}`);
    }

    async getReconciliationById(id) {
        return this.request(`/reconciliation/${id}`);
    }

    async createReconciliation(data) {
        return this.request('/reconciliation', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async approveReconciliation(id, data) {
        return this.request(`/reconciliation/${id}/approve`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // ==================== EXPENSES ====================
    async getExpenses(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/expenses${query ? `?${query}` : ''}`);
    }

    async getExpenseById(id) {
        return this.request(`/expenses/${id}`);
    }

    async createExpense(data) {
        return this.request('/expenses', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateExpense(id, data) {
        return this.request(`/expenses/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async approveExpense(id, data) {
        return this.request(`/expenses/${id}/approve`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteExpense(id) {
        return this.request(`/expenses/${id}`, {
            method: 'DELETE',
        });
    }

    async getExpensesByCategory(startDate, endDate) {
        return this.request(`/expenses/category-summary?startDate=${startDate}&endDate=${endDate}`);
    }

    // ==================== REPORTS ====================
    async getSalesReport(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/reports/sales${query ? `?${query}` : ''}`);
    }

    async getProductPerformance(startDate, endDate, limit = 20) {
        return this.request(`/reports/products?startDate=${startDate}&endDate=${endDate}&limit=${limit}`);
    }

    async getSalesRepPerformance(startDate, endDate) {
        return this.request(`/reports/salesreps?startDate=${startDate}&endDate=${endDate}`);
    }

    async getPaymentMethodReport(startDate, endDate) {
        return this.request(`/reports/payments?startDate=${startDate}&endDate=${endDate}`);
    }

    // PDF Generation - Helper for blob downloads
    async pdfRequest(endpoint, body = {}) {
        const token = this.getToken();
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Failed to generate PDF: ${response.status}`);
        }

        const blob = await response.blob();
        const pdfUrl = URL.createObjectURL(blob);

        const contentDisposition = response.headers.get('Content-Disposition');
        let reportName = `report-${Date.now()}.pdf`;
        if (contentDisposition) {
            const matches = contentDisposition.match(/filename="?(.+)"?/);
            if (matches && matches[1]) {
                reportName = matches[1];
            }
        }

        return { success: true, data: { pdfUrl, reportName, isBlob: true } };
    }

    async generateSalesPDF(startDate, endDate) {
        return this.pdfRequest('/reports/generate/sales-pdf', { startDate, endDate });
    }

    async generateInventoryPDF() {
        return this.pdfRequest('/reports/generate/inventory-pdf', {});
    }

    async generateProfitLossPDF(startDate, endDate) {
        return this.pdfRequest('/reports/generate/profit-loss-pdf', { startDate, endDate });
    }

    async generateExpensePDF(startDate, endDate) {
        return this.pdfRequest('/reports/generate/expense-pdf', { startDate, endDate });
    }

    async generateCreditSalesPDF(startDate, endDate) {
        return this.pdfRequest('/reports/generate/credit-sales-pdf', { startDate, endDate });
    }

    async generateCustomerSalesPDF(customerPhone, startDate, endDate) {
        return this.pdfRequest('/reports/generate/customer-sales-pdf', { customerPhone, startDate, endDate });
    }

    async generateTripSalesPDF(vehicleId, tripDate) {
        return this.pdfRequest('/reports/generate/trip-sales-pdf', { vehicleId, tripDate });
    }

    async generateVehicleTripHistoryPDF(vehicleId, startDate, endDate) {
        return this.pdfRequest('/reports/generate/vehicle-trip-history-pdf', { vehicleId, startDate, endDate });
    }

    async generateStockMovementPDF(startDate, endDate, filters = {}) {
        return this.pdfRequest('/reports/generate/stock-movement-pdf', { startDate, endDate, filters });
    }

    async generateInventoryTurnoverPDF(startDate, endDate) {
        return this.pdfRequest('/reports/generate/inventory-turnover-pdf', { startDate, endDate });
    }

    async generateVehicleInventoryPDF(vehicleId) {
        return this.pdfRequest('/reports/generate/vehicle-inventory-pdf', { vehicleId });
    }

    async generateSupplierPerformancePDF(startDate, endDate) {
        return this.pdfRequest('/reports/generate/supplier-performance-pdf', { startDate, endDate });
    }

    // ==================== ANALYTICS ====================
    async getDashboardOverview() {
        return this.request('/analytics/dashboard');
    }

    async getSalesAnalytics(startDate, endDate) {
        return this.request(`/analytics/sales?startDate=${startDate}&endDate=${endDate}`);
    }

    async getInventoryAnalytics() {
        return this.request('/analytics/inventory');
    }

    async getVehicleAnalytics(vehicleId) {
        return this.request(`/analytics/vehicle/${vehicleId}`);
    }

    async getSalesRepAnalytics(salesRepId, startDate, endDate) {
        return this.request(`/analytics/salesrep/${salesRepId}?startDate=${startDate}&endDate=${endDate}`);
    }

    async getProfitAnalytics(startDate, endDate) {
        return this.request(`/analytics/profit?startDate=${startDate}&endDate=${endDate}`);
    }

    // ==================== NOTIFICATIONS ====================
    async getNotifications(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/notifications${query ? `?${query}` : ''}`);
    }

    async markNotificationAsRead(id) {
        return this.request(`/notifications/${id}/read`, {
            method: 'PUT',
        });
    }

    async markAllNotificationsAsRead() {
        return this.request('/notifications/read-all', {
            method: 'PUT',
        });
    }

    async deleteNotification(id) {
        return this.request(`/notifications/${id}`, {
            method: 'DELETE',
        });
    }

    // ==================== USERS ====================
    async getUsers(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/auth/users${query ? `?${query}` : ''}`);
    }

    async getUserById(id) {
        return this.request(`/auth/users/${id}`);
    }

    async updateUser(id, data) {
        return this.request(`/auth/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteUser(id) {
        return this.request(`/auth/users/${id}`, {
            method: 'DELETE',
        });
    }

    async verifyUser(id, isVerified) {
        return this.request(`/auth/users/${id}/verify`, {
            method: 'PATCH',
            body: JSON.stringify({ isVerified }),
        });
    }

    async assignVehicle(id, vehicleId) {
        return this.request(`/auth/users/${id}/assign-vehicle`, {
            method: 'PATCH',
            body: JSON.stringify({ vehicleId }),
        });
    }

    // ==================== SUPPLIERS ====================
    async getSuppliers(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/suppliers${query ? `?${query}` : ''}`);
    }

    async getSupplierById(id) {
        return this.request(`/suppliers/${id}`);
    }

    async createSupplier(data) {
        return this.request('/suppliers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateSupplier(id, data) {
        return this.request(`/suppliers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteSupplier(id) {
        return this.request(`/suppliers/${id}`, {
            method: 'DELETE',
        });
    }

    // ==================== INVOICES ====================
    async getInvoices(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/invoices${query ? `?${query}` : ''}`);
    }

    async getInvoiceById(id) {
        return this.request(`/invoices/${id}`);
    }

    async createInvoice(data) {
        return this.request('/invoices', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateInvoice(id, data) {
        return this.request(`/invoices/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async recordInvoicePayment(id, paymentData) {
        return this.request(`/invoices/${id}/payments`, {
            method: 'POST',
            body: JSON.stringify(paymentData),
        });
    }

    async deleteInvoice(id) {
        return this.request(`/invoices/${id}`, {
            method: 'DELETE',
        });
    }

    // ==================== WAREHOUSES ====================
    async getWarehouses(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/warehouses${query ? `?${query}` : ''}`);
    }

    async createWarehouse(data) {
        return this.request('/warehouses', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
}

export default new APIClient();
