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
                grandTotal, notes = '', status = 'completed', location, isEtr = false } = saleData;

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
                    isEtr: Boolean(isEtr),
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
                // Normalize payment method for summary keys
                let summaryMethod = (paymentMethod || 'cash').toLowerCase();
                if (summaryMethod === 'debt') summaryMethod = 'credit';

                if (summaryDoc.exists) {
                    const summaryData = summaryDoc.data();
                    const key = `${summaryMethod}Sales`;
                    // Handle legacy keys if they exist in the doc but we want to merge into normalized key
                    // This simple update assumes we are moving forward with normalized keys.
                    transaction.update(summaryRef, {
                        totalSales: summaryData.totalSales + grandTotal,
                        totalTransactions: summaryData.totalTransactions + 1,
                        [key]: (summaryData[key] || 0) + grandTotal,
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
                        cashSales: summaryMethod === 'cash' ? grandTotal : 0,
                        mpesaSales: summaryMethod === 'mpesa' ? grandTotal : 0,
                        bankSales: summaryMethod === 'bank' ? grandTotal : 0,
                        creditSales: summaryMethod === 'credit' ? grandTotal : 0,
                        mixedSales: summaryMethod === 'mixed' ? grandTotal : 0,
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
            const { startDate, endDate, type = 'daily', useFallback = true } = options;

            logger.info(`=== STATS CALCULATION (${type}) ===`);

            // 1. Try to get from daily_sales_summary first
            let summaryQuery = this.db.collection('daily_sales_summary');

            if (vehicleId) {
                summaryQuery = summaryQuery.where('vehicleId', '==', vehicleId);
            }

            if (startDate && endDate) {
                const startStr = new Date(startDate).toISOString().split('T')[0];
                const endStr = new Date(endDate).toISOString().split('T')[0];
                summaryQuery = summaryQuery.where('date', '>=', startStr).where('date', '<=', endStr);
            } else if (type === 'daily' || type === 'today') {
                const today = new Date().toISOString().split('T')[0];
                summaryQuery = summaryQuery.where('date', '==', today);
            }

            const snapshot = await summaryQuery.get();

            // Define core stats structure
            const stats = {
                totalRevenue: 0,
                totalTransactions: 0,
                totalItemsSold: 0,
                paymentMethods: {
                    cash: { amount: 0, count: 0 },
                    mpesa: { amount: 0, count: 0 },
                    bank: { amount: 0, count: 0 },
                    credit: { amount: 0, count: 0 },
                    mixed: { amount: 0, count: 0 }
                },
                period: type === 'all' ? 'all_time' : (startDate && endDate ? `${startDate} to ${endDate}` : 'today')
            };

            // If we have summary data, use it
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    stats.totalRevenue += Number(data.totalSales || 0);
                    stats.totalTransactions += Number(data.totalTransactions || 0);
                    stats.paymentMethods.cash.amount += Number(data.cashSales || 0);
                    stats.paymentMethods.mpesa.amount += Number(data.mpesaSales || 0);
                    stats.paymentMethods.bank.amount += Number(data.bankSales || 0);
                    stats.paymentMethods.credit.amount += Number(data.creditSales || 0);
                    stats.paymentMethods.mixed.amount += Number(data.mixedSales || 0);
                    // Summary data does not provide transaction counts per payment method, only totalTransactions
                });

                // Validate if summary breakdown matches total revenue AND has no 'mixed' bucket 
                // (since mixed bucket isn't displayed on dashboard)
                const pmSum = stats.paymentMethods.cash.amount +
                    stats.paymentMethods.mpesa.amount +
                    stats.paymentMethods.bank.amount +
                    stats.paymentMethods.credit.amount;

                const isComplete = stats.totalRevenue > 0 &&
                    stats.paymentMethods.mixed.amount === 0 &&
                    Math.abs(stats.totalRevenue - pmSum) < 0.01;

                if (isComplete && !options.forceFallback) {
                    logger.info(`Stats from summary: Total=${stats.totalRevenue}, Count=${stats.totalTransactions}`);
                    return stats;
                }

                logger.info(`Summary data incomplete or has mixed payments (Revenue=${stats.totalRevenue}, PM Sum=${pmSum}, Mixed=${stats.paymentMethods.mixed.amount}). Proceeding to fallback...`);
            }

            // 2. Fallback: Aggregate directly from sales collection
            if (useFallback) {
                logger.info('Performing deep aggregation from sales collection...');
                let salesQuery = this.db.collection(this.collection).where('status', '==', 'completed');

                if (vehicleId) {
                    salesQuery = salesQuery.where('vehicleId', '==', vehicleId);
                }

                if (startDate && endDate) {
                    salesQuery = salesQuery.where('saleDate', '>=', new Date(startDate))
                        .where('saleDate', '<=', new Date(endDate));
                } else if (type === 'daily' || type === 'today') {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    salesQuery = salesQuery.where('saleDate', '>=', today);
                }

                const salesSnapshot = await salesQuery.get();

                // Reset stats to ensure we don't double count or mix with summary data
                stats.totalRevenue = 0;
                stats.totalTransactions = 0;
                stats.paymentMethods = {
                    cash: { amount: 0, count: 0 },
                    mpesa: { amount: 0, count: 0 },
                    bank: { amount: 0, count: 0 },
                    credit: { amount: 0, count: 0 },
                    mixed: { amount: 0, count: 0 }
                };

                salesSnapshot.forEach(doc => {
                    const sale = doc.data();
                    const amount = Number(sale.grandTotal || 0);
                    if (amount === 0) return;

                    stats.totalRevenue += amount;
                    stats.totalTransactions += 1;

                    const mainMethod = String(sale.paymentMethod || 'cash').toLowerCase();

                    if (mainMethod === 'mixed' && Array.isArray(sale.payments) && sale.payments.length > 0) {
                        sale.payments.forEach(p => {
                            const pMethod = String(p.method || '').toLowerCase();
                            const pAmount = Number(p.amount || 0);

                            if (pMethod === 'cash') { stats.paymentMethods.cash.amount += pAmount; stats.paymentMethods.cash.count += 1; }
                            else if (pMethod.includes('mpesa') || pMethod.includes('mobile')) { stats.paymentMethods.mpesa.amount += pAmount; stats.paymentMethods.mpesa.count += 1; }
                            else if (pMethod.includes('bank') || pMethod.includes('card') || pMethod.includes('cheque')) { stats.paymentMethods.bank.amount += pAmount; stats.paymentMethods.bank.count += 1; }
                            else if (pMethod === 'credit' || pMethod === 'debt') { stats.paymentMethods.credit.amount += pAmount; stats.paymentMethods.credit.count += 1; }
                            else { stats.paymentMethods.cash.amount += pAmount; stats.paymentMethods.cash.count += 1; } // Default sub-payment to cash
                        });
                    } else {
                        // Single payment method or mixed without payment details
                        if (mainMethod === 'cash') { stats.paymentMethods.cash.amount += amount; stats.paymentMethods.cash.count += 1; }
                        else if (mainMethod.includes('mpesa') || mainMethod.includes('mobile')) { stats.paymentMethods.mpesa.amount += amount; stats.paymentMethods.mpesa.count += 1; }
                        else if (mainMethod.includes('bank') || mainMethod.includes('card') || mainMethod.includes('cheque')) { stats.paymentMethods.bank.amount += amount; stats.paymentMethods.bank.count += 1; }
                        else if (mainMethod === 'credit' || mainMethod === 'debt') { stats.paymentMethods.credit.amount += amount; stats.paymentMethods.credit.count += 1; }
                        else { stats.paymentMethods.cash.amount += amount; stats.paymentMethods.cash.count += 1; } // Default to cash for everything else
                    }
                });
            }

            return stats;
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

    /**
     * Find sales combination that matches a target amount (KK-Calc Greedy Approach)
     * @param {number} targetAmount
     * @returns {Promise<Object>}
     */
    async findSalesCombination(targetAmount) {
        try {
            logger.info(`Finding sales combination for amount: ${targetAmount}`);

            // Fetch all completed sales
            // Optimization: Limit to reasonable time window if needed, but for now fetch all "completed"
            // We need to fetch enough potential candidates.
            const snapshot = await this.db.collection(this.collection)
                .where('status', '==', 'completed')
                .get();

            let sales = serializeDocs(snapshot);

            // Sort by amount DESC, then by date DESC (prefer removing recent large sales)
            sales.sort((a, b) => {
                if (b.grandTotal !== a.grandTotal) {
                    return b.grandTotal - a.grandTotal;
                }
                return new Date(b.saleDate) - new Date(a.saleDate);
            });

            const selectedSales = [];
            let currentSum = 0;
            let remainingTarget = targetAmount;

            for (const sale of sales) {
                if (sale.grandTotal <= remainingTarget) {
                    selectedSales.push(sale);
                    currentSum += sale.grandTotal;
                    remainingTarget -= sale.grandTotal;
                }

                if (remainingTarget === 0) break;
            }

            return {
                targetAmount,
                foundAmount: currentSum,
                difference: targetAmount - currentSum,
                count: selectedSales.length,
                sales: selectedSales
            };

        } catch (error) {
            logger.error('Find sales combination error:', error);
            throw error;
        }
    }

    /**
     * Delete batch of sales
     * @param {Array<string>} saleIds
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async deleteSalesBatch(saleIds, userId) {
        try {
            logger.info(`Deleting batch of ${saleIds.length} sales by user ${userId}`);

            const batch = this.db.batch();
            const deletedIds = [];

            for (const id of saleIds) {
                const ref = this.db.collection(this.collection).doc(id);
                // We could verify existence, but for batch performance we might skip reading if we trust the IDs
                // However, to be safe and maybe restore inventory (if that's desired), we should read.
                // The user just said "delete", and usually "deletion" in this context (adjusting revenue) 
                // might NOT want to mess with inventory if it's just financial adjustment, 
                // BUT "Delete Sales" usually implies reversing the transaction.
                // Given "KK-Calc" is likely for fixing "inflated revenue" (stuff that shouldn't exist), 
                // simply deleting the record is the request. 
                // I will perform a hard delete for now as per "delete".
                batch.delete(ref);
                deletedIds.push(id);
            }

            await batch.commit();

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);

            return {
                success: true,
                deletedCount: deletedIds.length,
                deletedIds
            };
        } catch (error) {
            logger.error('Delete sales batch error:', error);
            throw error;
        }
    }
}

module.exports = new SalesService();
