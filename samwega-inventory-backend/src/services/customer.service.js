const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const { optOutService } = require('./optout.service');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');

class CustomerService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'customers';
        this.cachePrefix = 'customer:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Create new customer
     * @param {Object} customerData
     * @param {string} userId - User creating the customer
     * @returns {Promise<Object>}
     */
    async createCustomer(customerData, userId) {
        try {
            const { customerName, customerPhone, storeName, customerIdNumber, customerEmail, notes = '' } = customerData;

            // Check if customer with same phone already exists
            if (customerPhone) {
                const existingCustomer = await this.db.collection(this.collection)
                    .where('customerPhone', '==', customerPhone)
                    .limit(1)
                    .get();

                if (!existingCustomer.empty) {
                    throw new ConflictError('Customer with this phone number already exists');
                }
            }

            const data = {
                customerName,
                customerNameLower: customerName.toLowerCase(),
                customerPhone: customerPhone || null,
                storeName: storeName || null,
                storeNameLower: storeName ? storeName.toLowerCase() : null,
                customerIdNumber: customerIdNumber || null,
                customerEmail: customerEmail || null,
                notes,
                totalPurchases: 0,
                totalDebt: 0,
                lastPurchaseDate: null,
                createdBy: userId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                messagesStopped: await optOutService.isStopped(customerPhone),
            };

            const docRef = await this.db.collection(this.collection).add(data);

            logger.info(`Customer created: ${customerName}`, { id: docRef.id, phone: customerPhone });

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);

            return await this.getCustomerById(docRef.id);
        } catch (error) {
            logger.error('Create customer error:', error);
            throw error;
        }
    }

    /**
     * Get customer by ID
     * @param {string} customerId
     * @returns {Promise<Object>}
     */
    async getCustomerById(customerId) {
        try {
            const cacheKey = `${this.cachePrefix}${customerId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(customerId).get();

            if (!doc.exists) {
                throw new NotFoundError('Customer');
            }

            const customer = serializeDoc(doc);

            // Cache the result
            await cache.set(cacheKey, customer, this.cacheTTL);

            return customer;
        } catch (error) {
            logger.error('Get customer by ID error:', error);
            throw error;
        }
    }

        async attachLastVehicle(customers) {
        const ids = customers.map((c) => c.id).filter(Boolean);
        const latest = new Map();

        for (let i = 0; i < ids.length; i += 10) {
            const chunk = ids.slice(i, i + 10);
            const snap = await this.db.collection('sales')
                .where('customerId', 'in', chunk)
                .get();

            snap.docs.forEach((doc) => {
                const s = doc.data();
                if (s.status === 'voided') return;
                const d = this.toDate(s.saleDate);
                if (!d) return;
                const current = latest.get(s.customerId);
                if (!current || d > current.date) {
                    latest.set(s.customerId, { date: d, vehicleName: s.vehicleName });
                }
            });
        }

        return customers.map((c) => ({
            ...c,
            lastVehicle: latest.get(c.id)?.vehicleName ?? null
        }));
    }

    /**
     * Get all customers with filters and pagination
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAllCustomers(filters = {}) {
        try {
            const {
                search,
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection);

            // Get all documents
            const snapshot = await query.get();
            let customers = serializeDocs(snapshot);

            // Apply search filter (client-side for flexibility)
            if (search) {
                const searchLower = search.toLowerCase();
                customers = customers.filter(customer =>
                    customer.customerNameLower?.includes(searchLower) ||
                    customer.storeNameLower?.includes(searchLower) ||
                    customer.customerPhone?.includes(search) ||
                    customer.customerIdNumber?.includes(search)
                );
            }

            // Sort customers
            customers.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];

                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            // Calculate pagination
            const total = customers.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedCustomers = await this.attachLastVehicle(customers.slice(startIndex, endIndex));

            const result = {
                customers: paginatedCustomers,
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
            logger.error('Get all customers error:', error);
            throw error;
        }
    }
    toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const d = new Date(value);
    return isNaN(d) ? null : d;
}
    /**
     * Get customers grouped by vehicle, with stats for each customer
     * @param {string} query - Search query
     * @param {number} limit - Max results to return
     * @returns {Promise<Array>}
     */
    /**
     * Customers grouped by vehicle. Built from sales; names, phones and store
     * come from the current customer record. Cached for 5 minutes, and
     * concurrent callers share one build instead of each reading every sale.
     * @returns {Promise<Array>}
     */
    async getCustomersGroupedByVehicle() {
        const cacheKey = `${this.cachePrefix}by-vehicle`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        if (!this.byVehicleInFlight) {
            this.byVehicleInFlight = this.buildCustomersByVehicle(cacheKey)
                .finally(() => { this.byVehicleInFlight = null; });
        }
        return this.byVehicleInFlight;
    }

    async buildCustomersByVehicle(cacheKey) {
        // Only the fields we need, to keep the read small
        const snap = await this.db.collection('sales')
            .select('customerId', 'customerName', 'customerPhone', 'vehicleId', 'vehicleName',
                    'status', 'grandTotal', 'paymentStatus', 'saleDate')
            .get();

        const vehicles = new Map();

        snap.docs.forEach((doc) => {
            const s = doc.data();
            if (!s.customerId || !s.vehicleId) return; // walk-in sales are skipped

            if (!vehicles.has(s.vehicleId)) {
                vehicles.set(s.vehicleId, {
                    vehicleId: s.vehicleId,
                    vehicleName: s.vehicleName || 'Unknown vehicle',
                    customers: new Map()
                });
            }
            const vehicle = vehicles.get(s.vehicleId);

            if (!vehicle.customers.has(s.customerId)) {
                vehicle.customers.set(s.customerId, {
                    customerId: s.customerId,
                    customerName: s.customerName || 'Unknown',
                    customerPhone: s.customerPhone || null,
                    completedSales: 0,
                    reversedSales: 0,
                    totalPurchases: 0,
                    salesOwing: 0,
                    lastSaleDate: null
                });
            }
            const row = vehicle.customers.get(s.customerId);

            if (s.status === 'voided') {
                row.reversedSales++;
                return;
            }

            row.completedSales++;
            row.totalPurchases += Number(s.grandTotal || 0);
            if (s.paymentStatus === 'pending' || s.paymentStatus === 'partially_paid') {
                row.salesOwing++;
            }

            const saleDate = this.toDate(s.saleDate);
            if (saleDate && (!row.lastSaleDate || saleDate > new Date(row.lastSaleDate))) {
                row.lastSaleDate = saleDate.toISOString();
            }
        });

        // Customers assigned to a vehicle show there even before their first sale
        const assignedSnap = await this.db.collection(this.collection)
            .where('assignedVehicleId', '!=', null)
            .get();
        assignedSnap.docs.forEach((d) => {
            const c = d.data();
            if (!vehicles.has(c.assignedVehicleId)) {
                vehicles.set(c.assignedVehicleId, {
                    vehicleId: c.assignedVehicleId,
                    vehicleName: c.assignedVehicleName || 'Unknown vehicle',
                    customers: new Map()
                });
            }
            const v = vehicles.get(c.assignedVehicleId);
            if (!v.customers.has(d.id)) {
                v.customers.set(d.id, {
                    customerId: d.id,
                    customerName: c.customerName || 'Unknown',
                    customerPhone: c.customerPhone || null,
                    completedSales: 0,
                    reversedSales: 0,
                    totalPurchases: 0,
                    salesOwing: 0,
                    lastSaleDate: null
                });
            }
        });

        // One batched read for every customer record that appears in sales
        const ids = [...new Set([...vehicles.values()].flatMap((v) => [...v.customers.keys()]))];
        const info = new Map();
        if (ids.length) {
            const refs = ids.map((id) => this.db.collection(this.collection).doc(id));
            const docs = await this.db.getAll(...refs);
            docs.forEach((d) => {
                if (d.exists) info.set(d.id, d.data());
            });
        }

        const result = [...vehicles.values()]
            .map((v) => ({
                vehicleId: v.vehicleId,
                vehicleName: v.vehicleName,
                customers: [...v.customers.values()]
                    // Deleted customers drop out of the vehicle lists
                    .filter((c) => info.has(c.customerId))
                    .map((c) => {
                        const cust = info.get(c.customerId);
                        return {
                            ...c,
                            customerName: cust.customerName || c.customerName,
                            customerPhone: cust.customerPhone ?? c.customerPhone,
                            storeName: cust.storeName || null,
                            totalDebt: Number(cust.totalDebt || 0),
                            messagesStopped: Boolean(cust.messagesStopped)
                        };
                    })
                    .sort((a, b) => b.totalPurchases - a.totalPurchases)
            }))
            .filter((v) => v.customers.length > 0)
            .sort((a, b) => a.vehicleName.localeCompare(b.vehicleName));

        await cache.set(cacheKey, result, 300);
        return result;
    }

    /**
     * Get summary of customers and vehicles
     * @returns {Promise<Object>}
     */    
        async getSummary() {
        const [totalSnap, optedOutSnap] = await Promise.all([
            this.db.collection(this.collection).count().get(),
            this.db.collection(this.collection).where('messagesStopped', '==', true).count().get(),
        ]);

        const vehicles = await this.getCustomersGroupedByVehicle();

        return {
            totalCustomers: totalSnap.data().count,
            optedOutCustomers: optedOutSnap.data().count,
            vehicleCount: vehicles.length,
        };
     }

    /**
     * Unpaid sales for one customer (pending or partly paid), newest first.
     * The customer's totalDebt is the balance; this shows the sales it comes from.
     * @param {string} customerId
     * @returns {Promise<{totalDebt: number, sales: Array}>}
     */
    async getUnpaidSales(customerId) {
        const doc = await this.db.collection(this.collection).doc(customerId).get();
        if (!doc.exists) throw new NotFoundError('Customer');

        const snap = await this.db.collection('sales')
            .where('customerId', '==', customerId)
            .get();

        const sales = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((s) => s.status !== 'voided' &&
                (s.paymentStatus === 'pending' || s.paymentStatus === 'partially_paid'))
            .sort((a, b) => (this.toDate(b.saleDate)?.getTime() || 0) - (this.toDate(a.saleDate)?.getTime() || 0))
            .map((s) => ({
                saleId: s.id,
                receiptNumber: s.receiptNumber || s.id,
                saleDate: this.toDate(s.saleDate)?.toISOString() || null,
                vehicleName: s.vehicleName || null,
                grandTotal: Number(s.grandTotal || 0),
                paymentStatus: s.paymentStatus
            }));

        return { totalDebt: Number(doc.data().totalDebt || 0), sales };
    }

    /**
     * Search customers (autocomplete).
     * With vehicleId, the search covers that vehicle's customers (bought from it or
     * assigned to it) plus every customer the signed-in user created.
     * @param {string} query
     * @param {number} limit
     * @param {string|null} vehicleId
     * @param {string|null} userId
     * @returns {Promise<Array>}
     */
    async searchCustomers(query, limit = 10, vehicleId = null, userId = null) {
        try {
            if (!query || query.length < 2) {
                return [];
            }

            const cacheKey = `${this.cachePrefix}search:${vehicleId || 'all'}:${userId || '-'}:${query}:${limit}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const q = query.toLowerCase();
            let results;

            if (vehicleId) {
                const candidates = new Map();

                const vehicles = await this.getCustomersGroupedByVehicle();
                const vehicle = vehicles.find((v) => v.vehicleId === vehicleId);
                (vehicle ? vehicle.customers : []).forEach((c) => {
                    candidates.set(c.customerId, {
                        id: c.customerId,
                        customerId: c.customerId,
                        customerName: c.customerName,
                        customerPhone: c.customerPhone,
                        storeName: c.storeName,
                        totalDebt: c.totalDebt,
                        messagesStopped: c.messagesStopped
                    });
                });

                if (userId) {
                    const mine = await this.db.collection(this.collection)
                        .where('createdBy', '==', userId)
                        .get();
                    mine.docs.forEach((d) => {
                        if (candidates.has(d.id)) return;
                        const c = d.data();
                        candidates.set(d.id, {
                            id: d.id,
                            customerId: d.id,
                            customerName: c.customerName,
                            customerPhone: c.customerPhone,
                            storeName: c.storeName || null,
                            totalDebt: Number(c.totalDebt || 0),
                            messagesStopped: Boolean(c.messagesStopped)
                        });
                    });
                }

                results = [...candidates.values()]
                    .filter((c) =>
                        (c.customerName || '').toLowerCase().includes(q) ||
                        (c.storeName || '').toLowerCase().includes(q) ||
                        (c.customerPhone || '').includes(query)
                    )
                    .slice(0, limit);
            } else {
                const snapshot = await this.db.collection(this.collection).get();
                const customers = serializeDocs(snapshot);
                results = customers.filter(customer =>
                    customer.customerNameLower?.startsWith(q) ||
                    customer.storeNameLower?.startsWith(q) ||
                    customer.customerPhone?.startsWith(query)
                ).slice(0, limit);
            }

            // Short cache: this is real-time search
            await cache.set(cacheKey, results, 60);

            return results;
        } catch (error) {
            logger.error('Search customers error:', error);
            throw error;
        }
    }


        async updateCustomer(customerId, updateData) {
        const ref = this.db.collection(this.collection).doc(customerId);
        const doc = await ref.get();
        if (!doc.exists) throw new NotFoundError('Customer');
        const before = doc.data();

        // Only allow these fields, so the request can't set totalDebt or totalPurchases
        const updates = {};
        for (const key of ['customerName', 'storeName', 'customerPhone', 'customerIdNumber', 'customerEmail', 'notes']) {
            if (updateData[key] !== undefined) updates[key] = updateData[key];
        }
        if (updates.customerName !== undefined) {
            updates.customerNameLower = updates.customerName.toLowerCase();
        }
        if (updates.storeName !== undefined) {
            updates.storeNameLower = updates.storeName ? updates.storeName.toLowerCase() : null;
        }

        const phoneChanged = updates.customerPhone !== undefined && updates.customerPhone !== before.customerPhone;
        if (phoneChanged && updates.customerPhone) {
            const dup = await this.db.collection(this.collection)
                .where('customerPhone', '==', updates.customerPhone)
                .limit(1)
                .get();
            if (!dup.empty && dup.docs[0].id !== customerId) {
                throw new ConflictError('Customer with this phone number already exists');
            }
            updates.messagesStopped = await optOutService.isStopped(updates.customerPhone);
        }

        if (updateData.assignedVehicleId !== undefined) {
            if (updateData.assignedVehicleId) {
                const vDoc = await this.db.collection('vehicles').doc(updateData.assignedVehicleId).get();
                if (!vDoc.exists) throw new NotFoundError('Vehicle');
                updates.assignedVehicleId = vDoc.id;
                updates.assignedVehicleName = vDoc.data().vehicleName || null;
            } else {
                updates.assignedVehicleId = null;
                updates.assignedVehicleName = null;
            }
        }

        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        await ref.update(updates);   // this is the write that was missing

        if (phoneChanged && before.customerPhone && updates.customerPhone) {
            await this.repointSalesPhone(before.customerPhone, updates.customerPhone);
        }

        logger.info(`Customer updated: ${customerId}`);
        await cache.delPattern(`${this.cachePrefix}*`);

        return await this.getCustomerById(customerId);
    }

    /**
     * Point existing sales at a customer's new phone number
     */
    async repointSalesPhone(oldPhone, newPhone) {
        const salesSnap = await this.db.collection('sales')
            .where('customerPhone', '==', oldPhone)
            .get();

        for (let i = 0; i < salesSnap.docs.length; i += 450) {
            const batch = this.db.batch();
            salesSnap.docs.slice(i, i + 450).forEach((saleDoc) => {
                batch.update(saleDoc.ref, {
                    customerPhone: newPhone,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
        }

        await cache.delPattern('sale:*');
        logger.info(`Updated ${salesSnap.size} sales from ${oldPhone} to ${newPhone}`);
    }

    /**
     * Delete customer
     * @param {string} customerId
     * @returns {Promise<void>}
     */
    async deleteCustomer(customerId) {
        try {
            const doc = await this.db.collection(this.collection).doc(customerId).get();

            if (!doc.exists) {
                throw new NotFoundError('Customer');
            }

            const customerData = doc.data();

            // Check if customer has outstanding debt
            if (customerData.totalDebt > 0) {
                throw new ValidationError('Cannot delete customer with outstanding debt');
            }

            await this.db.collection(this.collection).doc(customerId).delete();

            logger.info(`Customer deleted: ${customerId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${customerId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
            await cache.delPattern(`${this.cachePrefix}search:*`);
            await cache.delPattern(`${this.cachePrefix}*`);
        } catch (error) {
            logger.error('Delete customer error:', error);
            throw error;
        }
    }

    /**
     * Update customer purchase stats
     * Called internally when a sale is made
     * @param {string} customerId
     * @param {number} amount
     * @param {boolean} isCredit
     * @returns {Promise<void>}
     */
    async updatePurchaseStats(customerId, amount, isCredit = false) {
        try {
            const updates = {
                totalPurchases: admin.firestore.FieldValue.increment(amount),
                lastPurchaseDate: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (isCredit) {
                updates.totalDebt = admin.firestore.FieldValue.increment(amount);
            }

            await this.db.collection(this.collection).doc(customerId).update(updates);

            logger.info(`Customer purchase stats updated: ${customerId}`, { amount, isCredit });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${customerId}`);
        } catch (error) {
            logger.error('Update customer purchase stats error:', error);
            throw error;
        }
    }

    /**
     * Record customer payment (reduces debt)
     * @param {string} customerId
     * @param {number} amount
     * @returns {Promise<Object>}
     */
    /**
     * Debt still owed on one sale. Credit amount minus settlement payments.
     * Voided sales owe nothing.
     */
    outstandingForSale(s) {
        if (s.status === 'voided') return 0;
        const payments = Array.isArray(s.payments) ? s.payments : [];
        const isCredit = (p) => p.method === 'credit' || p.method === 'debt';
        const credit = payments.length
            ? payments.filter(isCredit).reduce((t, p) => t + Number(p.amount || 0), 0)
            : ((s.paymentMethod === 'credit' || s.paymentMethod === 'debt') ? Number(s.grandTotal || 0) : 0);
        const settled = payments
            .filter((p) => p.settlement === true || p.webhookUpdate === true)
            .reduce((t, p) => t + Number(p.amount || 0), 0);
        return Math.max(0, credit - settled);
    }

    /**
     * Recalculate one customer's debt from their sales and store it on the customer.
     * @returns {Promise<number>} the outstanding amount
     */
    async recalculateCustomerDebt(customerId) {
        const snap = await this.db.collection('sales').where('customerId', '==', customerId).get();
        const total = snap.docs.reduce((t, d) => t + this.outstandingForSale(d.data()), 0);

        await this.db.collection(this.collection).doc(customerId).update({
            totalDebt: total,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await cache.delPattern(`${this.cachePrefix}*`);
        return total;
    }

    /**
     * Recalculate every customer's debt from the sales records, in one pass.
     * @returns {Promise<{customers: number, withDebt: number}>}
     */
    async recalculateAllDebts() {
        const salesSnap = await this.db.collection('sales').get();
        const totals = new Map();
        salesSnap.docs.forEach((d) => {
            const s = d.data();
            if (!s.customerId) return;
            totals.set(s.customerId, (totals.get(s.customerId) || 0) + this.outstandingForSale(s));
        });

        const customersSnap = await this.db.collection(this.collection).select().get();
        let batch = this.db.batch();
        let pending = 0;
        for (const c of customersSnap.docs) {
            batch.update(c.ref, {
                totalDebt: Math.round((totals.get(c.id) || 0) * 100) / 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            pending++;
            if (pending === 450) {
                await batch.commit();
                batch = this.db.batch();
                pending = 0;
            }
        }
        if (pending > 0) await batch.commit();

        await cache.delPattern(`${this.cachePrefix}*`);
        const withDebt = [...totals.values()].filter((v) => v > 0).length;
        logger.info(`Debt recalculated for ${customersSnap.size} customers, ${withDebt} with debt`);
        return { customers: customersSnap.size, withDebt };
    }

    /**
     * Record a payment against a customer's debt. The amount is applied to their
     * unpaid sales, oldest first, and each sale keeps a record of it.
     * @param {string} customerId
     * @param {number} amount
     * @param {string} method e.g. cash, mpesa, bank
     * @param {string|null} userId who recorded it
     * @returns {Promise<Object>} the updated customer
     */
    async recordPayment(customerId, amount, method = 'cash', userId = null) {
        try {
            const pay = Number(amount);
            if (!(pay > 0)) throw new ValidationError('Payment amount must be positive');

            const customerDoc = await this.db.collection(this.collection).doc(customerId).get();
            if (!customerDoc.exists) throw new NotFoundError('Customer');

            const snap = await this.db.collection('sales').where('customerId', '==', customerId).get();
            const open = snap.docs
                .map((d) => ({ ref: d.ref, data: d.data(), due: this.outstandingForSale(d.data()) }))
                .filter((x) => x.due > 0)
                .sort((a, b) => (this.toDate(a.data.saleDate)?.getTime() || 0) - (this.toDate(b.data.saleDate)?.getTime() || 0));

            const owing = open.reduce((t, x) => t + x.due, 0);
            if (pay > owing + 0.001) {
                throw new ValidationError(`Payment exceeds outstanding debt of KES ${owing.toLocaleString()}`);
            }

            let left = pay;
            const batch = this.db.batch();
            for (const x of open) {
                if (left <= 0) break;
                const apply = Math.min(x.due, left);
                left = Math.round((left - apply) * 100) / 100;
                const remainingAfter = Math.round((x.due - apply) * 100) / 100;
                batch.update(x.ref, {
                    payments: admin.firestore.FieldValue.arrayUnion({
                        method,
                        amount: apply,
                        paidAt: new Date(),
                        settlement: true,
                        recordedBy: userId
                    }),
                    paymentStatus: remainingAfter > 0 ? 'partially_paid' : 'paid',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            await batch.commit();

            await this.recalculateCustomerDebt(customerId);
            logger.info(`Customer payment recorded: ${customerId}`, { amount: pay, method });

            await cache.del(`${this.cachePrefix}${customerId}`);
            return await this.getCustomerById(customerId);
        } catch (error) {
            logger.error('Record customer payment error:', error);
            throw error;
        }
    }
        /**
     * Stop or resume messages for a customer's phone number
     */
    async setMessagesStopped(customerId, stopped, userId) {
        if (typeof stopped !== 'boolean') {
            throw new ValidationError('stopped must be true or false');
        }

        const ref = this.db.collection(this.collection).doc(customerId);
        const snap = await ref.get();
        if (!snap.exists) throw new NotFoundError('Customer');

        const phone = snap.data().customerPhone;
        if (!phone) throw new ValidationError('Customer has no phone number');

        await optOutService.setStopped(phone, stopped, userId);
        await ref.update({
            messagesStopped: stopped,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`Messages ${stopped ? 'stopped' : 'resumed'} for customer ${customerId} by ${userId}`);

        await cache.del(`${this.cachePrefix}${customerId}`);
        await cache.delPattern(`${this.cachePrefix}list:*`);
        await cache.delPattern(`${this.cachePrefix}search:*`);
        await cache.delPattern(`${this.cachePrefix}*`);

        return await this.getCustomerById(customerId);
    }

}
module.exports = new CustomerService();
