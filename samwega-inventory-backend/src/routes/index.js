const express = require('express');
const router = express.Router();

// API version
const API_VERSION = 'v1';

// Welcome message
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to Samwega Inventory & POS API',
        version: API_VERSION,
        documentation: '/api/docs',
        endpoints: {
            health: '/health',
            auth: '/api/v1/auth',
            users: '/api/v1/auth/users',
            suppliers: '/api/v1/suppliers',
            invoices: '/api/v1/invoices',
            inventory: '/api/v1/inventory',
            vehicles: '/api/v1/vehicles',
            transfers: '/api/v1/transfers',
            sales: '/api/v1/sales',
            reconciliations: '/api/v1/reconciliations',
            reports: '/api/v1/reports',
            analytics: '/api/v1/analytics',
            notifications: '/api/v1/notifications',
            expenses: '/api/v1/expenses',
            storeLocations: '/api/v1/store-locations',
            warehouses: '/api/v1/warehouses',
            customers: '/api/v1/customers',
            pos: '/api/v1/pos'
        }
    });
});

// Import route modules
const authRoutes = require('./auth.routes');
const supplierRoutes = require('./supplier.routes');
const invoiceRoutes = require('./invoice.routes');
const inventoryRoutes = require('./inventory.routes');
const vehicleRoutes = require('./vehicle.routes');
const transferRoutes = require('./transfer.routes');
const salesRoutes = require('./sales.routes');
const reconciliationRoutes = require('./reconciliation.routes');
const reportsRoutes = require('./reports.routes');
const analyticsRoutes = require('./analytics.routes');
const notificationsRoutes = require('./notifications.routes');
const expenseRoutes = require('./expense.routes');
const storeLocationRoutes = require('./storeLocation.routes');

const warehouseRoutes = require('./warehouse.routes');
const customerRoutes = require('./customer.routes');
const posRoutes = require('./pos.routes');

// Mount routes
router.use(`/${API_VERSION}/auth`, authRoutes);
router.use(`/${API_VERSION}/suppliers`, supplierRoutes);
router.use(`/${API_VERSION}/invoices`, invoiceRoutes);
router.use(`/${API_VERSION}/inventory`, inventoryRoutes);
router.use(`/${API_VERSION}/vehicles`, vehicleRoutes);
router.use(`/${API_VERSION}/transfers`, transferRoutes);
// Alias for POS app
router.use(`/${API_VERSION}/stock-issuance`, transferRoutes);
router.use(`/${API_VERSION}/sales`, salesRoutes);
router.use(`/${API_VERSION}/reconciliations`, reconciliationRoutes);
router.use(`/${API_VERSION}/reports`, reportsRoutes);
router.use(`/${API_VERSION}/analytics`, analyticsRoutes);
router.use(`/${API_VERSION}/notifications`, notificationsRoutes);
router.use(`/${API_VERSION}/expenses`, expenseRoutes);
router.use(`/${API_VERSION}/store-locations`, storeLocationRoutes);
router.use(`/${API_VERSION}/warehouses`, warehouseRoutes);
router.use(`/${API_VERSION}/customers`, customerRoutes);
router.use(`/${API_VERSION}/pos`, posRoutes);

module.exports = router;
