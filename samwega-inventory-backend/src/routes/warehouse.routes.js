const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouse.controller');
const { validate } = require('../middleware/validation.middleware');
const {
    createWarehouseSchema,
    updateWarehouseSchema,
    warehouseIdSchema,
    searchWarehouseSchema
} = require('../validators/warehouse.validator');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

// Apply authentication to all routes
router.use(verifyToken);

// Read routes - accessible to all authenticated users
router.get(
    '/',
    validate(searchWarehouseSchema, 'query'),
    warehouseController.getWarehouses
);

router.get(
    '/:id',
    validate(warehouseIdSchema, 'params'),
    warehouseController.getWarehouseById
);

// Write routes - restricted to admin and store managers
router.use(requireRole('admin', 'store_manager', 'manager'));

router.post(
    '/',
    validate(createWarehouseSchema),
    warehouseController.createWarehouse
);

router.put(
    '/:id',
    validate(warehouseIdSchema, 'params'),
    validate(updateWarehouseSchema),
    warehouseController.updateWarehouse
);

router.delete(
    '/:id',
    validate(warehouseIdSchema, 'params'),
    warehouseController.deleteWarehouse
);

module.exports = router;
