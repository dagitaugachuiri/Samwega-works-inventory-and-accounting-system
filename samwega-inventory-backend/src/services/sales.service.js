const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const vehicleService = require('./vehicle.service');
const inventoryService = require('./inventory.service');
const debtService = require('./debt.service');
const smsService = require('./sms.service');

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
                throw new AuthorizationError('You can only create sales for your assigned vehicle');
            }

            // Validate all items and check stock availability
            const validatedItems = [];
            let calculatedSubtotal = 0;

            for (const item of items) {
                const inventoryItem = await inventoryService.getItemById(item.inventoryId);

                // Validate minimum selling price - Skip for WORKSHOP vehicle
                const minimumPrice = inventoryItem.sellingPrice || 0;
                if (vehicle.vehicleName !== 'WORKSHOP' && item.unitPrice < minimumPrice) {
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
            if (payments && Array.isArray(payments)) {
                paymentRecords = payments.map(p => ({
                    method: p.method,
                    amount: p.amount,
                    reference: p.reference || null,
                    bankName: p.bankName || null,
                    notes: p.notes || '',
                    paidAt: new Date()
                }));
            } else if (paymentMethod !== 'credit') {
                paymentRecords = [{
                    method: paymentMethod,
                    amount: grandTotal,
                    reference: saleData.paymentReference || null,
                    bankName: saleData.bankName || null,
                    notes: '',
                    paidAt: new Date()
                }]
            }

            // Extract bankName from payments if not already at top level
            let finalizedBankName = saleData.bankName || null;
            if (!finalizedBankName) {
                const bankPayment = paymentRecords.find(p => p.method === 'bank' && p.bankName);
                if (bankPayment) finalizedBankName = bankPayment.bankName;
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
                const saleDoc = {
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
                    paymentStatus: (paymentMethod === 'credit' || paymentMethod === 'debt') 
                        ? 'pending' 
                        : (paymentMethod === 'mixed' && paymentRecords.some(p => {
                            const m = String(p.method || '').toLowerCase();
                            return m === 'credit' || m === 'debt';
                        }))
                            ? 'partially_paid'
                            : 'paid',
                    payments: paymentRecords,
                    customerId: customerId || null,
                    customerName: customerName || null,
                    customerPhone: customerPhone || null,
                    storeName: storeName || null,
                    customerIdNumber: customerIdNumber || null,
                    customerEmail: customerEmail || null,
                    isEtr: Boolean(isEtr),
                    bankName: finalizedBankName,
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

                transaction.set(saleRef, saleDoc);

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

            // ── Automated Debt Creation ──
            // If the sale has a credit portion, create the debt record in the external system.
            // Doing this on the backend avoids Firebase token audience mismatch issues.
            const debtPayment = paymentRecords.find(p => p.method === 'credit' || p.method === 'debt');
            if (debtPayment && debtPayment.amount > 0) {
                try {
                    logger.info(`[SalesService] Initiating automated debt creation for receipt: ${receiptNumber}`);
                    
                    // Format phone for external API
                    const formatPhone = (phone) => {
                        if (!phone) return '+254700000000';
                        let p = phone.toString().replace(/\s+/g, '');
                        if (p.startsWith('+254')) return p;
                        if (p.startsWith('254')) return '+' + p;
                        if (p.startsWith('0')) return '+254' + p.substring(1);
                        return '+254' + p;
                    };

                    const debtData = {
                        storeOwner: {
                            name: customerName || 'Unknown Customer',
                            phoneNumber: formatPhone(customerPhone),
                            email: customerEmail || ""
                        },
                        store: {
                            name: storeName || customerName || 'No Store Name',
                            location: location?.address || 'Unknown Location'
                        },
                        vehiclePlate: vehicle.vehicleName || 'Unknown Vehicle',
                        salesRep: (userData.fullName || userData.email || 'Sales Rep').trim(),
                        salesRepEmail: userData.email || '',
                        amount: Number(debtPayment.amount),
                        remainingAmount: Number(debtPayment.amount),
                        paidAmount: 0,
                        status: "pending",
                        manualPaymentRequested: false,
                        dateIssued: new Date().toISOString(),
                        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        paymentMethod: 'cheque', // Placeholder for credit sales in external API
                        description: `Credit sale for receipt #${receiptNumber}`,
                        createdBy: userData.fullName || userData.email || 'Sales Rep',
                        locationCoordinates: location ? { 
                            latitude: location.latitude || 0, 
                            longitude: location.longitude || 0 
                        } : { latitude: 0, longitude: 0 },
                    };

                    const createdDebt = await debtService.createDebt(debtData);
                    
                    if (createdDebt && (createdDebt.id || createdDebt._id)) {
                        const debtId = createdDebt.id || createdDebt._id;
                        const debtCode = createdDebt.debtCode;
                        
                        logger.info(`[SalesService] Debt created successfully. ID: ${debtId}, Code: ${debtCode}`);
                        
                        // Link the debt back to the sale record in Firestore
                        await this.db.collection(this.collection).doc(saleId).update({
                            debtId: debtId,
                            debtCode: debtCode,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        
                        logger.info(`[SalesService] Sale ${receiptNumber} linked to debt ${debtCode}`);
                    }
                } catch (debtError) {
                    // Non-fatal error for the sale itself
                    logger.error(`[SalesService] Automated debt creation failed for ${receiptNumber}:`, debtError.message);
                }
            }

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);
            await cache.delPattern(`vehicle:inventory:${vehicleId}*`);

            const sale = await this.getSaleById(saleId);

            // Send automated SMS confirmation to customer
            if (sale.customerPhone) {
                // Run in background via SmsService
                smsService.sendSaleConfirmationSMS(sale).catch(err => 
                    logger.error(`[SalesService] Error in background SMS task: ${err.message}`)
                );
            }

            return sale;
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
                bankName,
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
            if (filters.isEtr !== undefined && filters.isEtr !== '') {
                const isEtrBool = filters.isEtr === 'true' || filters.isEtr === true;
                query = query.where('isEtr', '==', isEtrBool);
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
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    query = query.where('saleDate', '<=', end);
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

            // Default exclusion of voided sales
            if (!status) {
                sales = sales.filter(sale => sale.status !== 'voided');
            }

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
                throw new AuthorizationError('You can only update your own sales');
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

            // Prepare summary ref and date first
            const saleDateISO = sale.saleDate;
            const saleDateObj = saleDateISO ? new Date(saleDateISO) : new Date();
            const saleDateStr = saleDateObj.toISOString().split('T')[0];
            const summaryRef = this.db.collection('daily_sales_summary').doc(`${sale.vehicleId}_${saleDateStr}`);

            // Pre-fetch all necessary inventory document references
            // Group by inventoryId to handle multiple items per document
            const inventoryGroups = new Map();
            for (const item of sale.items) {
                if (!inventoryGroups.has(item.inventoryId)) {
                    inventoryGroups.set(item.inventoryId, { items: [], ref: null });
                }
                inventoryGroups.get(item.inventoryId).items.push(item);
            }

            for (const [inventoryId, group] of inventoryGroups.entries()) {
                const vehicleInventoryQuery = await this.db.collection('vehicle_inventory')
                    .where('vehicleId', '==', sale.vehicleId)
                    .where('inventoryId', '==', inventoryId)
                    .limit(1)
                    .get();

                if (!vehicleInventoryQuery.empty) {
                    group.ref = vehicleInventoryQuery.docs[0].ref;
                }
            }

            // Begin transaction to restore inventory and update status
            await this.db.runTransaction(async (transaction) => {
                // 1. ALL READS FIRST
                const summaryDoc = await transaction.get(summaryRef);

                // Get all inventory docs at once
                const validGroupEntries = Array.from(inventoryGroups.entries()).filter(([_, g]) => g.ref);
                const inventorySnapshots = await Promise.all(
                    validGroupEntries.map(([_, g]) => transaction.get(g.ref))
                );

                // 2. NOW ALL WRITES

                // Restore vehicle inventory
                for (let i = 0; i < validGroupEntries.length; i++) {
                    const [inventoryId, group] = validGroupEntries[i];
                    const inventoryDoc = inventorySnapshots[i];

                    if (inventoryDoc.exists) {
                        const inventoryData = inventoryDoc.data();
                        let updatedLayers = [...(inventoryData.layers || [])];

                        // Process all items for this inventory document
                        for (const item of group.items) {
                            updatedLayers = updatedLayers.map(layer => {
                                if (layer.layerIndex === item.layerIndex) {
                                    return {
                                        ...layer,
                                        quantity: layer.quantity + item.quantity,
                                        soldStock: (layer.soldStock || 0) - item.quantity
                                    };
                                }
                                return layer;
                            });
                        }

                        transaction.update(inventoryDoc.ref, {
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

                // Update daily summary
                if (summaryDoc.exists) {
                    let summaryMethod = (sale.paymentMethod || 'cash').toLowerCase();
                    if (summaryMethod === 'debt') summaryMethod = 'credit';
                    const key = `${summaryMethod}Sales`;
                    const grandTotal = sale.grandTotal || 0;

                    transaction.update(summaryRef, {
                        totalSales: admin.firestore.FieldValue.increment(-grandTotal),
                        totalTransactions: admin.firestore.FieldValue.increment(-1),
                        [key]: admin.firestore.FieldValue.increment(-grandTotal),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // Update customer stats
                if (sale.customerId) {
                    const customerRef = this.db.collection('customers').doc(sale.customerId);
                    const grandTotal = sale.grandTotal || 0;
                    const isCredit = sale.paymentMethod === 'credit' || sale.paymentMethod === 'debt';

                    transaction.update(customerRef, {
                        totalPurchases: admin.firestore.FieldValue.increment(-grandTotal),
                        totalDebt: isCredit ? admin.firestore.FieldValue.increment(-grandTotal) : admin.firestore.FieldValue.increment(0),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
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
            const { startDate, endDate, type = 'daily', useFallback = true, isEtr, bankName } = options;

            // Normalise isEtr to a boolean or undefined
            let isEtrFilter;
            if (isEtr === 'true' || isEtr === true) isEtrFilter = true;
            else if (isEtr === 'false' || isEtr === false) isEtrFilter = false;
            // else isEtrFilter remains undefined => no filter

            // When filtering by ETR status or specific Bank, the daily_sales_summary doesn't have that breakdown,
            // so we must always go straight to the fallback aggregation.
            const forceFallback = isEtrFilter !== undefined || !!bankName;

            // Resolve vehiclePlate from vehicleId if provided (for debt enrichment)
            let vehiclePlate;
            if (vehicleId) {
                try {
                    const vehicle = await vehicleService.getVehicleById(vehicleId);
                    vehiclePlate = vehicle?.plateNumber || vehicle?.vehiclePlate;
                } catch (_) {
                    // non-fatal
                }
            }

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
                    bank: { amount: 0, count: 0, breakdown: {} },
                    credit: { amount: 0, count: 0 },
                    mixed: { amount: 0, count: 0 }
                },
                period: type === 'all' ? 'all_time' : (startDate && endDate ? `${startDate} to ${endDate}` : 'today')
            };

            // If we have summary data, try to use it
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
                    // Summary path: transfers are baked into summary already.
                    // No external debt service call needed.
                    return stats;
                }

                logger.info(`Summary data incomplete or has mixed payments (Revenue=${stats.totalRevenue}, PM Sum=${pmSum}, Mixed=${stats.paymentMethods.mixed.amount}). Proceeding to fallback...`);
                
                // RESET STATS BEFORE FALLBACK TO AVOID DOUBLE COUNTING
                stats.totalRevenue = 0;
                stats.totalTransactions = 0;
                stats.totalItemsSold = 0;
                stats.paymentMethods = {
                    cash: { amount: 0, count: 0 },
                    mpesa: { amount: 0, count: 0 },
                    bank: { amount: 0, count: 0, breakdown: {} },
                    credit: { amount: 0, count: 0 },
                    mixed: { amount: 0, count: 0 }
                };
            }

            // 2. Fallback: Aggregate directly from sales collection
            let salesSnapshot = null;
            if (useFallback) {
                logger.info('Performing deep aggregation from sales collection...');
                let salesQuery = this.db.collection(this.collection).where('status', '==', 'completed');

                if (vehicleId) {
                    salesQuery = salesQuery.where('vehicleId', '==', vehicleId);
                }

                // Apply ETR filter
                if (isEtrFilter !== undefined) {
                    salesQuery = salesQuery.where('isEtr', '==', isEtrFilter);
                }

                // Apply bank filter
                if (bankName) {
                    salesQuery = salesQuery.where('bankName', '==', bankName);
                }

                if (startDate && endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    salesQuery = salesQuery.where('saleDate', '>=', new Date(startDate))
                        .where('saleDate', '<=', end);
                } else if (type === 'daily' || type === 'today') {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    salesQuery = salesQuery.where('saleDate', '>=', today);
                }

                salesSnapshot = await salesQuery.get();

                salesSnapshot.forEach(doc => {
                    const sale = doc.data();
                    const grandTotal = Number(sale.grandTotal || 0);
                    if (grandTotal === 0) return;

                    const mainMethod = String(sale.paymentMethod || 'cash').toLowerCase();

                    if (bankName) {
                        // Special handling for Bank filter: only count the portion belonging to this bank
                        let bankPortion = 0;
                        if (mainMethod === 'mixed' && Array.isArray(sale.payments)) {
                            sale.payments.forEach(p => {
                                if ((String(p.method || '').toLowerCase().includes('bank')) && p.bankName === bankName) {
                                    bankPortion += Number(p.amount || 0);
                                }
                            });
                        } else if (mainMethod.includes('bank') && sale.bankName === bankName) {
                            bankPortion = grandTotal;
                        }

                        if (bankPortion > 0) {
                            stats.totalRevenue += bankPortion;
                            stats.totalTransactions += 1;
                            stats.paymentMethods.bank.amount += bankPortion;
                            stats.paymentMethods.bank.count += 1;
                        }
                    } else {
                        // Regular aggregation
                        stats.totalRevenue += grandTotal;
                        stats.totalTransactions += 1;

                        // Aggregate from payments array (includes mixed, credit payments, etc.)
                        if (Array.isArray(sale.payments) && sale.payments.length > 0) {
                            // First pass: accumulate all payment amounts by method
                            let saleCredit = 0;
                            let saleWebhookSettled = 0;

                            sale.payments.forEach(p => {
                                const pMethod = String(p.method || '').toLowerCase();
                                const pAmount = Number(p.amount || 0);
                                const isWebhook = Boolean(p.webhookUpdate);

                                if (pMethod === 'cash') {
                                    stats.paymentMethods.cash.amount += pAmount;
                                    stats.paymentMethods.cash.count += 1;
                                } else if (pMethod.includes('mpesa') || pMethod.includes('mobile')) {
                                    stats.paymentMethods.mpesa.amount += pAmount;
                                    stats.paymentMethods.mpesa.count += 1;
                                } else if (pMethod.includes('bank') || pMethod.includes('card') || pMethod.includes('cheque')) {
                                    stats.paymentMethods.bank.amount += pAmount;
                                    stats.paymentMethods.bank.count += 1;
                                    const bName = p.bankName || sale.bankName || 'Other';
                                    stats.paymentMethods.bank.breakdown[bName] = (stats.paymentMethods.bank.breakdown[bName] || 0) + pAmount;
                                } else if (pMethod === 'credit' || pMethod === 'debt') {
                                    saleCredit += pAmount;
                                }

                                // Track total settled via webhook (debt repayments already counted in bank/mpesa/cash above)
                                if (isWebhook) {
                                    saleWebhookSettled += pAmount;
                                }
                            });

                            // Net credit = original credit minus what was settled via webhook
                            // This implements the "transfer": settled amount moves from credit to bank/mpesa/cash
                            const netCredit = Math.max(0, saleCredit - saleWebhookSettled);
                            if (netCredit > 0) {
                                stats.paymentMethods.credit.amount += netCredit;
                                stats.paymentMethods.credit.count += 1;
                            }
                        } else {
                            // Single payment method or initial credit
                            if (mainMethod === 'cash') { stats.paymentMethods.cash.amount += grandTotal; stats.paymentMethods.cash.count += 1; }
                            else if (mainMethod.includes('mpesa') || mainMethod.includes('mobile')) { stats.paymentMethods.mpesa.amount += grandTotal; stats.paymentMethods.mpesa.count += 1; }
                            else if (mainMethod.includes('bank') || mainMethod.includes('card') || mainMethod.includes('cheque')) {
                                stats.paymentMethods.bank.amount += grandTotal;
                                stats.paymentMethods.bank.count += 1;
                                const bName = sale.bankName || 'Other';
                                stats.paymentMethods.bank.breakdown[bName] = (stats.paymentMethods.bank.breakdown[bName] || 0) + grandTotal;
                            }
                            else if (mainMethod === 'credit' || mainMethod === 'debt') { stats.paymentMethods.credit.amount += grandTotal; stats.paymentMethods.credit.count += 1; }
                            else { stats.paymentMethods.cash.amount += grandTotal; stats.paymentMethods.cash.count += 1; }
                        }
                    }
                });
            }

            logger.info('Stats aggregated successfully from sales records.');
            // Note: Debt settlement transfers (credit → bank/mpesa/cash) are handled
            // directly in the payment aggregation loop above via 'webhookUpdate: true' markers.
            // No external debt service call needed here — the sale record is the source of truth.

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

    /**
     * Link a sale record to a debt record.
     * @param {string} saleId
     * @param {object} debtInfo { debtId, debtCode }
     * @returns {Promise<Object>}
     */
    async linkDebt(saleId, { debtId, debtCode }) {
        try {
            logger.info(`Linking sale ${saleId} to debt ${debtId} (${debtCode})`);

            const saleRef = this.db.collection(this.collection).doc(saleId);
            const saleDoc = await saleRef.get();

            if (!saleDoc.exists) {
                throw new Error('Sale not found');
            }

            const updateData = {
                debtId,
                debtCode,
                updatedAt: new Date()
            };

            await saleRef.update(updateData);

            // Invalidate cache for this sale
            await cache.delPattern(`${this.cachePrefix}*`);

            return { success: true, saleId, debtId, debtCode };
        } catch (error) {
            logger.error(`Error linking sale ${saleId} to debt:`, error);
            throw error;
        }
    }

    /**
     * Update quantity and/or price of an item in a sale
     * @param {string} saleId
     * @param {number} itemIndex
     * @param {object} updates { quantity, unitPrice }
     * @param {string} userId
     */
    async updateSaleItem(saleId, itemIndex, updates, userId) {
        try {
            const sale = await this.getSaleById(saleId);

            if (sale.status === 'voided') {
                throw new ValidationError('Cannot update item in a voided sale');
            }

            if (!sale.items || !sale.items[itemIndex]) {
                throw new ValidationError('Item index out of bounds');
            }

            const item = sale.items[itemIndex];
            const oldQuantity = Number(item.quantity || 0);
            const newQuantity = updates.quantity !== undefined ? Number(updates.quantity) : oldQuantity;
            const delta = newQuantity - oldQuantity;

            const oldUnitPrice = Number(item.unitPrice || 0);
            const newUnitPrice = updates.unitPrice !== undefined ? Number(updates.unitPrice) : oldUnitPrice;

            const oldTotalPrice = Number(item.totalPrice || 0);
            const newTotalPrice = newQuantity * newUnitPrice;
            const priceDiff = newTotalPrice - oldTotalPrice;

            // Recalculate profit for the item
            const costPrice = Number(item.costPrice || 0);
            const newProfit = (newUnitPrice - costPrice) * newQuantity;

            // Prepare inventory update (only if quantity changed)
            let vehicleInventoryRef = null;
            if (delta !== 0) {
                const vehicleInventorySnapshot = await this.db.collection('vehicle_inventory')
                    .where('vehicleId', '==', sale.vehicleId)
                    .where('inventoryId', '==', item.inventoryId)
                    .limit(1)
                    .get();

                if (vehicleInventorySnapshot.empty) {
                    throw new ValidationError(`Product ${item.productName} not found in vehicle inventory`);
                }
                vehicleInventoryRef = vehicleInventorySnapshot.docs[0].ref;
            }

            // Core transaction
            await this.db.runTransaction(async (transaction) => {
                // READ PHASE
                const saleRef = this.db.collection(this.collection).doc(saleId);
                let vehicleInvDoc = null;
                if (vehicleInventoryRef) {
                    vehicleInvDoc = await transaction.get(vehicleInventoryRef);
                }

                const saleDateISO = sale.saleDate;
                const saleDateObj = saleDateISO ? new Date(saleDateISO) : new Date();
                const saleDateStr = saleDateObj.toISOString().split('T')[0];
                const summaryRef = this.db.collection('daily_sales_summary').doc(`${sale.vehicleId}_${saleDateStr}`);
                const summaryDoc = await transaction.get(summaryRef);

                // WRITE PHASE
                // 1. Update vehicle inventory (if quantity changed)
                if (vehicleInvDoc && vehicleInvDoc.exists) {
                    const invData = vehicleInvDoc.data();
                    const updatedLayers = (invData.layers || []).map(l => {
                        if (l.layerIndex === item.layerIndex) {
                            return {
                                ...l,
                                quantity: l.quantity - delta,
                                soldStock: (l.soldStock || 0) + delta
                            };
                        }
                        return l;
                    });
                    transaction.update(vehicleInventoryRef, {
                        layers: updatedLayers,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // 2. Update sale document
                const updatedItems = [...sale.items];
                updatedItems[itemIndex] = {
                    ...item,
                    quantity: newQuantity,
                    unitPrice: newUnitPrice,
                    totalPrice: newTotalPrice,
                    profit: newProfit
                };

                const newSubtotal = Number(sale.subtotal || 0) + priceDiff;
                const newGrandTotal = Number(sale.grandTotal || 0) + priceDiff;

                const saleUpdates = {
                    items: updatedItems,
                    subtotal: newSubtotal,
                    grandTotal: newGrandTotal,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                transaction.update(saleRef, saleUpdates);

                // 3. Update daily summary
                if (summaryDoc.exists) {
                    const method = (sale.paymentMethod || 'cash').toLowerCase();
                    const key = `${method === 'debt' ? 'credit' : (method === 'mixed' ? 'mixed' : method)}Sales`;

                    transaction.update(summaryRef, {
                        totalSales: admin.firestore.FieldValue.increment(priceDiff),
                        [key]: admin.firestore.FieldValue.increment(priceDiff),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // 4. Update customer stats
                if (sale.customerId) {
                    const customerRef = this.db.collection('customers').doc(sale.customerId);
                    transaction.update(customerRef, {
                        totalPurchases: admin.firestore.FieldValue.increment(priceDiff),
                        totalDebt: (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debt')
                            ? admin.firestore.FieldValue.increment(priceDiff)
                            : admin.firestore.FieldValue.increment(0),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${saleId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
            if (delta !== 0) {
                await cache.delPattern(`vehicle:inventory:${sale.vehicleId}*`);
            }

            return await this.getSaleById(saleId);
        } catch (error) {
            logger.error('Update sale item error:', error);
            throw error;
        }
    }

    /**
     * Update debt status in a sale record via webhook
     * @param {string} debtCode
     * @param {object} updateData { status, paidAmount, paymentMethod, paymentDate }
     */
    async updateDebtStatus(debtCode, updateData) {
        try {
            logger.info(`Webhook: Updating debt status for ${debtCode}`, updateData);

            // Find the sale by debtCode
            const snapshot = await this.db.collection(this.collection)
                .where('debtCode', '==', debtCode)
                .limit(1)
                .get();

            if (snapshot.empty) {
                logger.warn(`Sale with debtCode ${debtCode} not found for webhook update`);
                return { success: false, message: 'Sale not found' };
            }

            const saleDoc = snapshot.docs[0];
            const saleId = saleDoc.id;
            const sale = saleDoc.data();

            // Map status if needed (e.g. 'partially_paid' -> 'partially_paid', 'paid' -> 'paid')
            const newPaymentStatus = updateData.status === 'paid' ? 'paid' : (updateData.status === 'partially_paid' ? 'partially_paid' : 'pending');
            
            const updates = {
                paymentStatus: newPaymentStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // If payment info provided, append to payments array
            if (updateData.paidAmount > 0) {
                const newPayment = {
                    method: updateData.paymentMethod || 'manual',
                    amount: updateData.paidAmount,
                    paidAt: updateData.paymentDate ? new Date(updateData.paymentDate) : new Date(),
                    webhookUpdate: true,
                    // Preserve bank name so wallet breakdown is accurate
                    ...(updateData.bankName ? { bankName: updateData.bankName } : {})
                };

                updates.payments = admin.firestore.FieldValue.arrayUnion(newPayment);
            }

            await saleDoc.ref.update(updates);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${saleId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return { success: true, saleId, debtCode, newStatus: newPaymentStatus };
        } catch (error) {
            logger.error('Update debt status webhook error:', error);
            throw error;
        }
    }
}

module.exports = new SalesService();
