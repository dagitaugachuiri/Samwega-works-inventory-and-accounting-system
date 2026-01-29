const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation.middleware');
const { verifyToken, requireRole, requireVerified } = require('../middleware/auth.middleware');
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
 * Public/Read routes (authenticated users)
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
 * Write routes (admin/store_manager only)
 */

// Create new inventory item
router.post(
    '/',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    validateBody(createInventorySchema),
    inventoryController.createItem
);

// Bulk import inventory items
router.post(
    '/bulk-import',
    verifyToken,
    requireRole('admin', 'store_manager'),
    validateBody(bulkImportSchema),
    inventoryController.bulkImport
);

// Update inventory item
router.put(
    '/:id',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    validateParams(inventoryIdSchema),
    validateBody(updateInventorySchema),
    inventoryController.updateItem
);

// Adjust stock level
router.patch(
    '/:id/adjust-stock',
    verifyToken,
    requireRole('admin', 'store_manager'),
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
    validateParams(inventoryIdSchema),
    inventoryController.deleteItem
);

// Replenish item stock with new invoice
router.post(
    '/:id/replenish',
    verifyToken,
    requireRole('admin', 'store_manager'),
    writeLimiter,
    validateParams(inventoryIdSchema),
    inventoryController.replenishItem
);

// Generate SKU
router.get(
    '/generate-sku',
    verifyToken,
    requireVerified,
    inventoryController.generateSKU
);

module.exports = router;
