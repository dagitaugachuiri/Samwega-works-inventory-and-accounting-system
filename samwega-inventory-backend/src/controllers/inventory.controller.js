const inventoryService = require('../services/inventory.service');
const { successResponse, paginatedResponse } = require('../utils/response');
const logger = require('../utils/logger');

class InventoryController {
    /**
     * Create new inventory item
     * POST /api/v1/inventory
     */
    async createItem(req, res, next) {
        try {
            const item = await inventoryService.createItem(req.body);

            res.status(201).json(successResponse(
                item,
                'Inventory item created successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all inventory items
     * GET /api/v1/inventory
     */
    async getAllItems(req, res, next) {
        try {
            const result = await inventoryService.getAllItems(req.query);

            res.json(paginatedResponse(
                result.items,
                result.pagination.page,
                result.pagination.limit,
                result.pagination.total
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get inventory item by ID
     * GET /api/v1/inventory/:id
     */
    async getItemById(req, res, next) {
        try {
            const item = await inventoryService.getItemById(req.params.id);

            res.json(successResponse(
                item,
                'Inventory item retrieved successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update inventory item
     * PUT /api/v1/inventory/:id
     */
    async updateItem(req, res, next) {
        try {
            const item = await inventoryService.updateItem(req.params.id, req.body);

            res.json(successResponse(
                item,
                'Inventory item updated successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete inventory item
     * DELETE /api/v1/inventory/:id
     */
    async deleteItem(req, res, next) {
        try {
            await inventoryService.deleteItem(req.params.id);

            res.json(successResponse(
                null,
                'Inventory item deleted successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Adjust stock level
     * PATCH /api/v1/inventory/:id/adjust-stock
     */
    async adjustStock(req, res, next) {
        try {
            const { adjustment, reason, notes } = req.body;
            const item = await inventoryService.adjustStock(
                req.params.id,
                adjustment,
                reason,
                notes
            );

            res.json(successResponse(
                item,
                'Stock adjusted successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Bulk import inventory items
     * POST /api/v1/inventory/bulk-import
     */
    async bulkImport(req, res, next) {
        try {
            const results = await inventoryService.bulkImport(req.body.items);

            res.json(successResponse(
                results,
                `Bulk import completed: ${results.success.length} items imported, ${results.failed.length} failed`
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get low stock items
     * GET /api/v1/inventory/low-stock
     */
    async getLowStockItems(req, res, next) {
        try {
            const threshold = parseInt(req.query.threshold) || 10;
            const items = await inventoryService.getLowStockItems(threshold);

            res.json(successResponse(
                items,
                'Low stock items retrieved successfully',
                { count: items.length, threshold }
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Search by barcode
     * GET /api/v1/inventory/barcode/:barcode
     */
    async searchByBarcode(req, res, next) {
        try {
            const item = await inventoryService.searchByBarcode(req.params.barcode);

            if (!item) {
                return res.status(404).json(successResponse(
                    null,
                    'No item found with this barcode'
                ));
            }

            res.json(successResponse(
                item,
                'Item found'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Replenish item stock with new invoice
     * POST /api/v1/inventory/:id/replenish
     */
    async replenishItem(req, res, next) {
        try {
            const replenishData = {
                ...req.body,
                userId: req.user?.uid
            };
            const item = await inventoryService.replenishItem(req.params.id, replenishData);

            res.json(successResponse(
                item,
                'Stock replenished successfully'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generate SKU for new item
     * GET /api/v1/inventory/generate-sku
     */
    async generateSKU(req, res, next) {
        try {
            const { category } = req.query;
            const sku = inventoryService.generateSKU(category);

            res.json(successResponse(
                { sku },
                'SKU generated successfully'
            ));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new InventoryController();
