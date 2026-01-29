const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError, UnauthorizedError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const vehicleService = require('./vehicle.service');
const inventoryService = require('./inventory.service');

class SalesService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'sales';
        this.cachePrefix = 'sale:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Generate receipt number
     * @returns {Promise<string>}
     */
    async generateReceiptNumber() {
        const year = new Date().getFullYear();
        const snapshot = await this.db.collection(this.collection)
            .where('receiptNumber', '>=', `RCP-${year}-`)
            .where('receiptNumber', '<', `RCP-${year + 1}-`)
            .orderBy('receiptNumber', 'desc')
            .limit(1)
            .get();

        let nextNumber = 1;
        if (!snapshot.empty) {
            const lastNumber = snapshot.docs[0].data().receiptNumber;
            const match = lastNumber.match(/RCP-\d{4}-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        return `RCP-${year}-${String(nextNumber).padStart(4, '0')}`;
    }

    /**
     * Create new sale
     * @param {Object} saleData
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async createSale(saleData, userId) {
        try {
            const { vehicleId, items, paymentMethod, payments, customerName, customerPhone,
                customerIdNumber, customerEmail, storeName, subtotal, taxAmount = 0, discountAmount = 0,
                grandTotal, notes = '', status = 'completed', location } = saleData;

            // Get user details
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }
            const userData = userDoc.data();

            // Verify vehicle exists and user is assigned
            const vehicle = await vehicleService.getVehicleById(vehicleId);
            if (vehicle.assignedUserId !== userId && userData.role !== 'admin' && userData.role !== 'store_manager') {
                throw new UnauthorizedError('You can only create sales for your assigned vehicle');
            }

            // Validate all items and check stock availability
            const validatedItems = [];
            let calculatedSubtotal = 0;

            for (const item of items) {
                const inventoryItem = await inventoryService.getItemById(item.inventoryId);

                // Validate minimum selling price
                const minimumPrice = inventoryItem.sellingPrice || 0;
                if (item.unitPrice < minimumPrice) {
                    throw new ValidationError(
                        `Price for ${item.productName} (${item.unitPrice}) is below minimum selling price (${minimumPrice})`
                    );
                }

                // Get vehicle inventory
                const vehicleInventorySnapshot = await this.db.collection('vehicle_inventory')
                    .where('vehicleId', '==', vehicleId)
                    .where('inventoryId', '==', item.inventoryId)
                    .limit(1)
                    .get();

                if (vehicleInventorySnapshot.empty) {
                    throw new ValidationError(`Product ${item.productName} not found in vehicle inventory`);
                }

                const vehicleInventoryData = vehicleInventorySnapshot.docs[0].data();
                const layers = vehicleInventoryData.layers || [];
                const layer = layers.find(l => l.layerIndex === item.layerIndex);

                if (!layer || layer.quantity < item.quantity) {
                    throw new ValidationError(
                        `Insufficient stock for ${item.productName} at layer ${item.layerIndex}. Available: ${layer?.quantity || 0}, Needed: ${item.quantity}`
                    );
                }

                // Calculate profit
                const costPrice = item.costPrice || inventoryItem.buyingPrice || 0;
                const profit = (item.unitPrice - costPrice) * item.quantity;

                validatedItems.push({
                    inventoryId: item.inventoryId,
                    productName: item.productName,
                    layerIndex: item.layerIndex,
                    unit: item.unit,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    costPrice,
                    profit
                });

                calculatedSubtotal += item.totalPrice;
            }

            // Validate totals
            if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
                throw new ValidationError('Subtotal does not match sum of item prices');
            }

            const calculatedGrandTotal = subtotal + taxAmount - discountAmount;
            if (Math.abs(calculatedGrandTotal - grandTotal) > 0.01) {
                throw new ValidationError('Grand total calculation error');
            }

            // Validate payment amount
            let totalPayment = 0;
            if (paymentMethod === 'mixed' && payments) {
                totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
            } else if (paymentMethod !== 'credit') {
                totalPayment = grandTotal;
            }

            if (paymentMethod !== 'credit' && Math.abs(totalPayment - grandTotal) > 0.01) {
                throw new ValidationError('Payment amount does not match grand total');
            }

            // Generate receipt number
            const receiptNumber = await this.generateReceiptNumber();

            // Prepare payment records
            let paymentRecords = [];
            if (paymentMethod === 'mixed' && payments) {
                paymentRecords = payments.map(p => ({
                    method: p.method,
                    amount: p.amount,
                    reference: p.reference || null,
                    notes: p.notes || '',
                    paidAt: new Date()
                }));
            } else if (paymentMethod !== 'credit') {
                paymentRecords = [{
                    method: paymentMethod,
                    amount: grandTotal,
                    reference: saleData.paymentReference || null,
                    notes: '',
                    paidAt: new Date()
                }]
            }

            // Handle customer creation/lookup
            let customerId = null;
            if (customerName && customerPhone) {
                // Try to find existing customer by phone
                const customerSnapshot = await this.db.collection('customers')
                    .where('customerPhone', '==', customerPhone)
                    .limit(1)
                    .get();

                if (!customerSnapshot.empty) {
                    // Existing customer found
                    customerId = customerSnapshot.docs[0].id;
                } else {
                    // Create new customer
                    const customerData = {
                        customerName,
                        customerNameLower: customerName.toLowerCase(),
                        customerPhone,
                        storeName: saleData.storeName || null,
                        storeNameLower: saleData.storeName ? saleData.storeName.toLowerCase() : null,
                        customerIdNumber: customerIdNumber || null,
                        customerEmail: customerEmail || null,
                        notes: '',
                        totalPurchases: 0,
                        totalDebt: 0,
                        lastPurchaseDate: null,
                        createdBy: userId,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    const newCustomerRef = await this.db.collection('customers').add(customerData);
                    customerId = newCustomerRef.id;
                    logger.info(`New customer created during sale: ${customerName}`, { customerId });
                }
            }

            // Pre-fetch vehicle inventory document references and current data to use in transaction
            const inventoryUpdates = [];

            for (const item of validatedItems) {
                const vehicleInventorySnapshot = await this.db.collection('vehicle_inventory')
                    .where('vehicleId', '==', vehicleId)
                    .where('inventoryId', '==', item.inventoryId)
                    .limit(1)
                    .get();

                if (vehicleInventorySnapshot.empty) {
                    throw new ValidationError(`Product ${item.productName} not found in vehicle inventory`);
                }

                inventoryUpdates.push({
                    item,
                    docRef: vehicleInventorySnapshot.docs[0].ref
                });
            }

            // Begin Firestore transaction
            const saleId = await this.db.runTransaction(async (transaction) => {
                // READ PHASE
                // 1. Read daily summary
                const today = new Date().toISOString().split('T')[0];
                const summaryRef = this.db.collection('daily_sales_summary').doc(`${vehicleId}_${today}`);
                const summaryDoc = await transaction.get(summaryRef);

                // 2. Read latest inventory state for all items
                const inventoryDocs = await Promise.all(
                    inventoryUpdates.map(update => transaction.get(update.docRef))
                );

                // WRITE PHASE
                // 1. Deduct stock from vehicle inventory
                inventoryDocs.forEach((doc, index) => {
                    const { item } = inventoryUpdates[index];

                    if (!doc.exists) {
                        throw new ValidationError(`Inventory for ${item.productName} disappeared`);
                    }

                    const vehicleInventoryData = doc.data();
                    const layers = vehicleInventoryData.layers || [];
                    const layer = layers.find(l => l.layerIndex === item.layerIndex);

                    if (!layer || layer.quantity < item.quantity) {
                        throw new ValidationError(
                            `Insufficient stock for ${item.productName} during transaction. Available: ${layer?.quantity || 0}, Needed: ${item.quantity}`
                        );
                    }

                    // Update layer quantity and soldStock
                    const updatedLayers = layers.map(layer => {
                        if (layer.layerIndex === item.layerIndex) {
                            return {
                                ...layer,
                                quantity: layer.quantity - item.quantity,
                                soldStock: (layer.soldStock || 0) + item.quantity
                            };
                        }
                        return layer;
                    });

                    transaction.update(doc.ref, {
                        layers: updatedLayers,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                });

                // Create sale record
                const saleRef = this.db.collection(this.collection).doc();
                const saleData = {
                    receiptNumber,
                    vehicleId,
                    vehicleName: vehicle.vehicleName,
                    salesRepId: userId,
                    salesRepName: userData.fullName || userData.email,
                    items: validatedItems,
                    subtotal,
                    taxAmount,
                    discountAmount,
                    grandTotal,
                    paymentMethod,
                    paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid',
                    payments: paymentRecords,
                    customerId: customerId || null,
                    customerName: customerName || null,
                    customerPhone: customerPhone || null,
                    storeName: storeName || null,
                    customerIdNumber: customerIdNumber || null,
                    customerEmail: customerEmail || null,
                    location: location ? {
                        latitude: location.latitude,
                        longitude: location.longitude,
                        accuracy: location.accuracy || null,
                        address: location.address || null,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    } : null,
                    status,
                    voidedBy: null,
                    voidedAt: null,
                    voidReason: null,
                    notes,
                    saleDate: admin.firestore.FieldValue.serverTimestamp(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.set(saleRef, saleData);

                // Update customer purchase stats if customer exists
                if (customerId) {
                    const customerRef = this.db.collection('customers').doc(customerId);
                    const isCredit = paymentMethod === 'credit';

                    transaction.update(customerRef, {
                        totalPurchases: admin.firestore.FieldValue.increment(grandTotal),
                        totalDebt: isCredit ? admin.firestore.FieldValue.increment(grandTotal) : admin.firestore.FieldValue.increment(0),
                        lastPurchaseDate: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // Update daily summary
                if (summaryDoc.exists) {
                    const summaryData = summaryDoc.data();
                    transaction.update(summaryRef, {
                        totalSales: summaryData.totalSales + grandTotal,
                        totalTransactions: summaryData.totalTransactions + 1,
                        [`${paymentMethod}Sales`]: (summaryData[`${paymentMethod}Sales`] || 0) + grandTotal,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    transaction.set(summaryRef, {
                        vehicleId,
                        vehicleName: vehicle.vehicleName,
                        salesRepId: userId,
                        salesRepName: userData.fullName || userData.email,
                        date: today,
                        totalSales: grandTotal,
                        totalTransactions: 1,
                        cashSales: paymentMethod === 'cash' ? grandTotal : 0,
                        mpesaSales: paymentMethod === 'mpesa' ? grandTotal : 0,
                        bankSales: paymentMethod === 'bank' ? grandTotal : 0,
                        creditSales: paymentMethod === 'credit' ? grandTotal : 0,
                        mixedSales: paymentMethod === 'mixed' ? grandTotal : 0,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                return saleRef.id;
            });

            logger.info(`Sale created: ${receiptNumber}`, { id: saleId, vehicleId, grandTotal });

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);
            await cache.delPattern(`vehicle:inventory:${vehicleId}*`);

            return await this.getSaleById(saleId);
        } catch (error) {
            logger.error('Create sale error:', error);
            throw error;
        }
    }

    /**
     * Get sale by ID
     * @param {string} saleId
     * @returns {Promise<Object>}
     */
    async getSaleById(saleId) {
        try {
            const cacheKey = `${this.cachePrefix}${saleId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(saleId).get();

            if (!doc.exists) {
                throw new NotFoundError('Sale');
            }

            const sale = serializeDoc(doc);

            // Cache the result
            await cache.set(cacheKey, sale, this.cacheTTL);

            return sale;
        } catch (error) {
            logger.error('Get sale by ID error:', error);
            throw error;
        }
    }

    /**
     * Get all sales with filters
     * @param {Object} filters
     * @param {string} userId
     * @param {string} userRole
     * @returns {Promise<Object>}
     */
    async getAllSales(filters = {}, userId, userRole) {
        try {
            const {
                vehicleId,
                salesRepId,
                customerId,
                paymentMethod,
                status,
                startDate,
                endDate,
                minAmount,
                maxAmount,
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}:${userId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection);

            // Apply role-based filtering
            if (userRole === 'sales_rep') {
                query = query.where('salesRepId', '==', userId);
            } else if (salesRepId) {
                query = query.where('salesRepId', '==', salesRepId);
            }

            // Apply filters
            if (vehicleId) {
                query = query.where('vehicleId', '==', vehicleId);
            }
            if (customerId) {
                query = query.where('customerId', '==', customerId);
            }
            if (paymentMethod) {
                query = query.where('paymentMethod', '==', paymentMethod);
            }
            if (status) {
                query = query.where('status', '==', status);
            }

            // Text search (Customer Name)
            // Note: This requires 'search' param and conflicts with other range filters (dates)
            // if search is present, we prioritize it over date range for now or handle client side if needed.
            // But Firestore allows Equality (vehicleId) + Range (customerName).
            if (filters.search) {
                const searchTerm = filters.search.trim();
                // Case sensitive search unless we store lowercase. We store customerNameLower in CUSTOMER, 
                // but checking if we store it in SALE... createSale doesn't seems to store customerNameLower in Sale doc.
                // We will search by customerName (Case Sensitive) for now.
                query = query.where('customerName', '>=', searchTerm)
                    .where('customerName', '<=', searchTerm + '\uf8ff');
            } else {
                // Only apply date filters if NOT searching (to avoid multiple range inequality error)
                if (startDate) {
                    query = query.where('saleDate', '>=', new Date(startDate));
                }
                if (endDate) {
                    query = query.where('saleDate', '<=', new Date(endDate));
                }
            }

            // Apply sorting at DB level if no amount filters (which require post-processing)
            // Note: This requires relevant indexes in Firestore. If missing, it will throw an error.
            if (minAmount === undefined && maxAmount === undefined) {
                // Firestore Restriction: If you include a filter with a range comparison (<, <=, >, >=), 
                // your first ordering must be on the same field.

                let effectiveSortBy = sortBy;
                let effectiveSortOrder = sortOrder;

                if (filters.search) {
                    // If searching by text (Range on customerName), we MUST sort by customerName first
                    effectiveSortBy = 'customerName';
                    effectiveSortOrder = 'asc'; // Search is usually asc
                } else if (startDate || endDate) {
                    // If filtering by date range, we MUST sort by saleDate first
                    effectiveSortBy = 'saleDate';
                    // Keep requested order if reasonable, or default to desc for dates
                    if (sortBy !== 'saleDate') {
                        effectiveSortOrder = 'desc';
                    }
                }

                query = query.orderBy(effectiveSortBy, effectiveSortOrder);

                // If it's the first page, we can use limit
                // For later pages, we would need startAfter (cursor), but offset is okay for small offsets
                if (page === 1) {
                    query = query.limit(parseInt(limit));
                }
            }

            // Get documents
            const snapshot = await query.get();
            let sales = serializeDocs(snapshot);

            // If we did DB-level limit
            if (minAmount === undefined && maxAmount === undefined && page === 1) {
                // We don't have total count readily available without a separate count query or aggregation
                // For now, let's assume if we got 'limit' items, there might be more.
                // This is a trade-off for performance. To get real total, we need snapshot.size of a count() query.

                const result = {
                    sales: sales,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: sales.length, // Approximate/Partial
                        totalPages: 1, // Unknown
                        hasNextPage: sales.length === parseInt(limit),
                        hasPrevPage: false
                    }
                };

                await cache.set(cacheKey, result, this.cacheTTL);
                return result;
            }

            // Fallback to in-memory processing for complex queries or page > 1 (if we don't implement cursors yet)

            // Apply amount filters (client-side)
            if (minAmount !== undefined) {
                sales = sales.filter(sale => sale.grandTotal >= minAmount);
            }
            if (maxAmount !== undefined) {
                sales = sales.filter(sale => sale.grandTotal <= maxAmount);
            }

            // Sort if not sorted by DB
            if (minAmount !== undefined || maxAmount !== undefined) {
                sales.sort((a, b) => {
                    const aVal = a[sortBy];
                    const bVal = b[sortBy];

                    if (sortOrder === 'asc') {
                        return aVal > bVal ? 1 : -1;
                    } else {
                        return aVal < bVal ? 1 : -1;
                    }
                });
            }

            // Calculate pagination
            const total = sales.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedSales = sales.slice(startIndex, endIndex);

            const result = {
                sales: paginatedSales,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: endIndex < total,
                    hasPrevPage: page > 1
                }
            };

            // Cache the result
            await cache.set(cacheKey, result, this.cacheTTL);

            return result;
        } catch (error) {
            logger.error('Get all sales error:', error);
            throw error;
        }
    }

    /**
     * Update sale (only for draft sales)
     * @param {string} saleId
     * @param {Object} updateData
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async updateSale(saleId, updateData, userId) {
        try {
            const sale = await this.getSaleById(saleId);

            if (sale.status !== 'draft') {
                throw new ValidationError('Only draft sales can be updated');
            }

            if (sale.salesRepId !== userId) {
                throw new UnauthorizedError('You can only update your own sales');
            }

            const updates = { ...updateData };
            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.db.collection(this.collection).doc(saleId).update(updates);

            logger.info(`Sale updated: ${saleId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${saleId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getSaleById(saleId);
        } catch (error) {
            logger.error('Update sale error:', error);
            throw error;
        }
    }

    /**
     * Void sale
     * @param {string} saleId
     * @param {string} reason
     * @param {string} managerId
     * @returns {Promise<Object>}
     */
    async voidSale(saleId, reason, managerId) {
        try {
            const sale = await this.getSaleById(saleId);

            if (sale.status === 'voided') {
                throw new ValidationError('Sale is already voided');
            }

            // Get manager details
            const managerDoc = await this.db.collection('users').doc(managerId).get();
            if (!managerDoc.exists) {
                throw new NotFoundError('Manager');
            }
            const managerData = managerDoc.data();
            const managerName = managerData.fullName || managerData.email;

            // Begin transaction to restore inventory
            await this.db.runTransaction(async (transaction) => {
                // Restore vehicle inventory
                for (const item of sale.items) {
                    const vehicleInventoryQuery = await this.db.collection('vehicle_inventory')
                        .where('vehicleId', '==', sale.vehicleId)
                        .where('inventoryId', '==', item.inventoryId)
                        .limit(1)
                        .get();

                    if (!vehicleInventoryQuery.empty) {
                        const vehicleInventoryDoc = vehicleInventoryQuery.docs[0];
                        const vehicleInventoryData = vehicleInventoryDoc.data();
                        const layers = vehicleInventoryData.layers || [];

                        const updatedLayers = layers.map(layer => {
                            if (layer.layerIndex === item.layerIndex) {
                                return {
                                    ...layer,
                                    quantity: layer.quantity + item.quantity,
                                    soldStock: (layer.soldStock || 0) - item.quantity
                                };
                            }
                            return layer;
                        });

                        transaction.update(vehicleInventoryDoc.ref, {
                            layers: updatedLayers,
                            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }

                // Update sale status
                const saleRef = this.db.collection(this.collection).doc(saleId);
                transaction.update(saleRef, {
                    status: 'voided',
                    voidedBy: managerId,
                    voidedByName: managerName,
                    voidedAt: admin.firestore.FieldValue.serverTimestamp(),
                    voidReason: reason,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            logger.info(`Sale voided: ${sale.receiptNumber}`, { saleId, managerId, reason });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${saleId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
            await cache.delPattern(`vehicle:inventory:${sale.vehicleId}*`);

            return await this.getSaleById(saleId);
        } catch (error) {
            logger.error('Void sale error:', error);
            throw error;
        }
    }

    /**
     * Get sales stats
     * @param {string} vehicleId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async getStats(vehicleId, options = {}) {
        try {
            const { startDate, endDate, type = 'daily' } = options;

            if (type === 'today' || type === 'daily') {
                const today = new Date().toISOString().split('T')[0];
                const summary = await this.getDailySummary(vehicleId, today);

                return {
                    totalRevenue: summary.totalSales,
                    totalTransactions: summary.totalTransactions,
                    totalItemsSold: 0, // Not currently tracked in daily summary
                    paymentMethods: {
                        cash: summary.cashSales,
                        mpesa: summary.mpesaSales,
                        bank: summary.bankSales,
                        credit: summary.creditSales,
                        mixed: summary.mixedSales
                    },
                    period: 'today'
                };
            } else {
                // Aggregated stats (All time or date range)
                let query = this.db.collection('daily_sales_summary')
                    .where('vehicleId', '==', vehicleId);

                if (startDate) {
                    query = query.where('date', '>=', startDate);
                }
                if (endDate) {
                    query = query.where('date', '<=', endDate);
                }

                const snapshot = await query.get();

                const stats = {
                    totalRevenue: 0,
                    totalTransactions: 0,
                    totalItemsSold: 0,
                    paymentMethods: {
                        cash: 0,
                        mpesa: 0,
                        bank: 0,
                        credit: 0,
                        mixed: 0
                    },
                    period: type === 'all' ? 'all_time' : 'custom_range'
                };

                if (snapshot.empty) {
                    return stats;
                }

                snapshot.forEach(doc => {
                    const data = doc.data();
                    stats.totalRevenue += (data.totalSales || 0);
                    stats.totalTransactions += (data.totalTransactions || 0);
                    // stats.totalItemsSold += (data.totalItemsSold || 0); // If we track this later

                    stats.paymentMethods.cash += (data.cashSales || 0);
                    stats.paymentMethods.mpesa += (data.mpesaSales || 0);
                    stats.paymentMethods.bank += (data.bankSales || 0);
                    stats.paymentMethods.credit += (data.creditSales || 0);
                    stats.paymentMethods.mixed += (data.mixedSales || 0);
                });

                return stats;
            }
        } catch (error) {
            logger.error('Get stats error:', error);
            throw error;
        }
    }

    /**
     * Get daily summary
     * @param {string} vehicleId
     * @param {string} date
     * @returns {Promise<Object>}
     */
    async getDailySummary(vehicleId, date) {
        try {
            const cacheKey = `${this.cachePrefix}summary:${vehicleId}:${date}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const summaryDoc = await this.db.collection('daily_sales_summary')
                .doc(`${vehicleId}_${date}`)
                .get();

            if (!summaryDoc.exists) {
                return {
                    vehicleId,
                    date,
                    totalSales: 0,
                    totalTransactions: 0,
                    cashSales: 0,
                    mpesaSales: 0,
                    bankSales: 0,
                    creditSales: 0,
                    mixedSales: 0
                };
            }

            const summary = serializeDoc(summaryDoc);

            // Cache for shorter time (2 minutes)
            await cache.set(cacheKey, summary, 120);

            return summary;
        } catch (error) {
            logger.error('Get daily summary error:', error);
            throw error;
        }
    }

}

module.exports = new SalesService();
