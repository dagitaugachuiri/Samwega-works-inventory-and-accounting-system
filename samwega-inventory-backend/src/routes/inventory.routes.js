const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const { verifyToken, requireRole, requireVerified, logActivity } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const {
    createInventorySchema,
    updateInventorySchema,
    bulkImportSchema,
    searchQuerySchema,
    inventoryIdSchema,
    stockAdjustmentSchema
} = require('../validators/inventory.validator');

/**
 * READ routes: any verified, logged-in user
 * NOTE: fixed paths (/low-stock, /barcode/:barcode, /generate-sku) must stay ABOVE '/:id',
 * otherwise '/:id' swallows them. /generate-sku used to sit below it and never matched.
 */

// Get all inventory items with filters and pagination
router.get(
    '/',
    verifyToken,
    requireVerified,
    validateQuery(searchQuerySchema),
    inventoryController.getAllItems
);

// Get low stock items
router.get(
    '/low-stock',
    verifyToken,
    requireVerified,
    inventoryController.getLowStockItems
);

// Generate SKU (moved above '/:id')
router.get(
    '/generate-sku',
    verifyToken,
    requireVerified,
    inventoryController.generateSKU
);

// Search by barcode
router.get(
    '/barcode/:barcode',
    verifyToken,
    requireVerified,
    inventoryController.searchByBarcode
);

// Get inventory item by ID
router.get(
    '/:id',
    verifyToken,
    requireVerified,
    validateParams(inventoryIdSchema),
    inventoryController.getItemById
);

/**
 * ADD routes (keying in stock): unchanged, admin / store_manager.
 * Make these requireRole('admin') too if you want adding to be admin-only as well.
 */

// Create new inventory item
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('CREATE', 'inventory'),
    writeLimiter,
    validateBody(createInventorySchema),
    inventoryController.createItem
);

// Replenish item stock with new invoice
router.post(
    '/:id/replenish',
    verifyToken,
    requireRole('admin', 'store_manager'),
    logActivity('REPLENISH', 'inventory'),
    writeLimiter,
    validateParams(inventoryIdSchema),
    inventoryController.replenishItem
);

/**
 * EDIT / DELETE routes: admin only
 */

// Bulk import inventory items
router.post(
    '/bulk-import',
    verifyToken,
    requireRole('admin'),
    logActivity('BULK_IMPORT', 'inventory'),
    writeLimiter,
    validateBody(bulkImportSchema),
    inventoryController.bulkImport
);

// Update inventory item
router.put(
    '/:id',
    verifyToken,
    requireRole('admin'),
    logActivity('UPDATE', 'inventory'),
    writeLimiter,
    validateParams(inventoryIdSchema),
    validateBody(updateInventorySchema),
    inventoryController.updateItem
);

// Adjust stock level
router.patch(
    '/:id/adjust-stock',
    verifyToken,
    requireRole('admin'),
    logActivity('ADJUST_STOCK', 'inventory'),
    writeLimiter,
    validateParams(inventoryIdSchema),
    validateBody(stockAdjustmentSchema),
    inventoryController.adjustStock
);

// Delete inventory item
router.delete(
    '/:id',
    verifyToken,
    requireRole('admin'),
    logActivity('DELETE', 'inventory'),
    writeLimiter,
    validateParams(inventoryIdSchema),
    inventoryController.deleteItem
);

module.exports = router;