const Joi = require('joi');

/**
 * Create inventory item validation schema
 * Updated to accept frontend field names
 */
const createInventorySchema = Joi.object({
    productName: Joi.string()
        .min(2)
        .max(200)
        .required()
        .messages({
            'string.min': 'Product name must be at least 2 characters',
            'string.max': 'Product name cannot exceed 200 characters',
            'any.required': 'Product name is required'
        }),

    category: Joi.string()
        .required()
        .messages({
            'any.required': 'Category is required'
        }),

    supplier: Joi.string()
        .required()
        .messages({
            'any.required': 'Supplier is required'
        }),

    // Support both field names
    buyingPrice: Joi.number().positive().optional(),
    buyingPricePerUnit: Joi.number().min(0).optional(),

    // Selling price - either direct or per piece
    sellingPrice: Joi.number().positive().optional(),
    sellingPricePerPiece: Joi.number().min(0).optional(),

    // Minimum price optional
    minimumPrice: Joi.number().positive().optional(),

    // Stock fields - multiple formats accepted
    stock: Joi.number().integer().min(0).optional(),
    stockInSupplierUnits: Joi.number().integer().min(0).optional(),

    unit: Joi.string().optional(),
    supplierUnit: Joi.string().optional(),
    supplierUnitQuantity: Joi.number().integer().min(1).optional(),

    // Link to invoice
    invoiceId: Joi.string()
        .optional()
        .messages({
            'string.base': 'Invoice ID must be a valid string'
        }),

    // Warehouse info
    warehouseId: Joi.string().optional().allow(''),
    warehouseName: Joi.string().optional().allow(''),

    // Packaging structure - accepts array format from frontend
    packagingStructure: Joi.alternatives().try(
        // Array format from frontend
        Joi.array().items(Joi.object({
            qty: Joi.number().integer().required(),
            unit: Joi.string().required(),
            sellingPrice: Joi.number().allow(null).optional(),
            stock: Joi.number().integer().allow(null).optional()
        })),
        // Object format (legacy)
        Joi.object({
            cartonSize: Joi.number().integer().positive().optional(),
            packetSize: Joi.number().integer().positive().optional(),
            pieceSize: Joi.number().integer().positive().default(1)
        })
    ).optional(),

    // Optional fields
    barcode: Joi.string().optional().allow(''),
    description: Joi.string().max(500).optional().allow(''),
    reorderLevel: Joi.number().integer().min(0).optional(),
    lowStockAlert: Joi.number().integer().min(0).optional(),
    location: Joi.string().optional().allow(''),
    expiryDate: Joi.date().iso().optional().allow(null),
    isActive: Joi.boolean().default(true)
}).options({ stripUnknown: true });

/**
 * Update inventory item validation schema
 */
const updateInventorySchema = Joi.object({
    productName: Joi.string().min(2).max(200).optional(),
    category: Joi.string().optional(),
    supplier: Joi.string().optional(),
    buyingPrice: Joi.number().positive().optional(),
    buyingPricePerUnit: Joi.number().min(0).optional(),
    sellingPrice: Joi.number().positive().optional(),
    sellingPricePerPiece: Joi.number().min(0).optional(),
    minimumPrice: Joi.number().positive().optional(),
    stock: Joi.number().integer().min(0).optional(),
    stockInSupplierUnits: Joi.number().integer().min(0).optional(),
    unit: Joi.string().optional(),
    supplierUnit: Joi.string().optional(),
    supplierUnitQuantity: Joi.number().integer().min(1).optional(),
    invoiceId: Joi.string().optional(),
    warehouseId: Joi.string().optional().allow(''),
    warehouseName: Joi.string().optional().allow(''),
    packagingStructure: Joi.alternatives().try(
        Joi.array().items(Joi.object({
            qty: Joi.number().integer().required(),
            unit: Joi.string().required(),
            sellingPrice: Joi.number().allow(null).optional(),
            stock: Joi.number().integer().allow(null).optional()
        })),
        Joi.object({
            cartonSize: Joi.number().integer().positive().optional(),
            packetSize: Joi.number().integer().positive().optional(),
            pieceSize: Joi.number().integer().positive().optional()
        })
    ).optional(),
    barcode: Joi.string().optional().allow(''),
    description: Joi.string().max(500).optional().allow(''),
    reorderLevel: Joi.number().integer().min(0).optional(),
    lowStockAlert: Joi.number().integer().min(0).optional(),
    location: Joi.string().optional().allow(''),
    expiryDate: Joi.date().iso().optional().allow(null),
    isActive: Joi.boolean().optional()
}).min(1).options({ stripUnknown: true });

/**
 * Bulk import validation schema
 */
const bulkImportSchema = Joi.object({
    items: Joi.array()
        .items(createInventorySchema)
        .min(1)
        .max(1000)
        .required()
        .messages({
            'array.min': 'At least one item is required',
            'array.max': 'Cannot import more than 1000 items at once',
            'any.required': 'Items array is required'
        })
});

/**
 * Search/filter query validation schema
 */
const searchQuerySchema = Joi.object({
    search: Joi.string().optional(),
    category: Joi.string().optional(),
    supplier: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    minStock: Joi.number().integer().min(0).optional(),
    maxStock: Joi.number().integer().min(0).optional(),
    minPrice: Joi.number().positive().optional(),
    maxPrice: Joi.number().positive().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(20),
    sortBy: Joi.string().valid('productName', 'stock', 'sellingPrice', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * Inventory ID parameter validation
 */
const inventoryIdSchema = Joi.object({
    id: Joi.string()
        .required()
        .messages({
            'any.required': 'Inventory ID is required'
        })
});

/**
 * Stock adjustment validation schema
 */
const stockAdjustmentSchema = Joi.object({
    adjustment: Joi.number()
        .integer()
        .required()
        .messages({
            'any.required': 'Stock adjustment value is required'
        }),

    reason: Joi.string()
        .valid('sale', 'purchase', 'return', 'damage', 'theft', 'correction', 'transfer')
        .required()
        .messages({
            'any.only': 'Invalid adjustment reason',
            'any.required': 'Adjustment reason is required'
        }),

    invoiceId: Joi.when('reason', {
        is: 'purchase',
        then: Joi.string().required().messages({
            'any.required': 'Invoice ID is required for purchase adjustments'
        }),
        otherwise: Joi.string().optional()
    }),

    buyingPrice: Joi.when('reason', {
        is: 'purchase',
        then: Joi.number().positive().required().messages({
            'number.positive': 'Buying price must be positive',
            'any.required': 'Buying price is required for purchase adjustments'
        }),
        otherwise: Joi.number().positive().optional()
    }),

    notes: Joi.string().max(500).optional()
});

module.exports = {
    createInventorySchema,
    updateInventorySchema,
    bulkImportSchema,
    searchQuerySchema,
    inventoryIdSchema,
    stockAdjustmentSchema
};
