const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const supplierService = require('./supplier.service');

// Fields a client must never be able to set through an update request
const PROTECTED_FIELDS = [
    'createdBy', 'createdByName', 'createdAt',
    'status', 'voidedAt', 'voidReason', 'voidedBy', 'voidedByName',
    'itemsTotal', 'itemsCount', 'itemNames'
];

class InvoiceService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'invoices';
        this.cachePrefix = 'invoice:';
        this.cacheTTL = 300; // 5 minutes
    }

    _userName(user) {
        return user?.name || user?.displayName || user?.email || 'Unknown';
    }

    _userId(user) {
        return user?.uid || user?.id || null;
    }

    /**
     * Create new invoice (without items)
     * Items will be linked when adding inventory in Phase 3
     * @param {Object} invoiceData
     * @param {Object} user - req.user, recorded as who keyed the invoice in
     * @returns {Promise<Object>}
     */
    async createInvoice(invoiceData, user = null) {
        try {
            // Verify supplier exists — now stored, so we can check ETR status below
            const supplier = await supplierService.getSupplierById(invoiceData.supplierId);

            // Check for duplicate invoice number
            const existingInvoice = await this.db.collection(this.collection)
                .where('invoiceNumber', '==', invoiceData.invoiceNumber)
                .limit(1)
                .get();

            if (!existingInvoice.empty) {
                throw new ValidationError('Invoice number already exists');
            }

            const items = invoiceData.items || [];
            const calculatedItemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

            // NEW — Total Amount defaults to the real items total when not explicitly typed
            // (Add Stock always sends 0; Invoices-page sends a real typed value, which wins)
            const resolvedTotal = invoiceData.totalAmount || calculatedItemsTotal;

            // NEW — automatic 16% VAT, only for ETR-registered suppliers
            const VAT_RATE = 0.16;
            const taxAmount = supplier.etrStatus === 'etr'
                ? calculatedItemsTotal * VAT_RATE
                : 0;

            const autoTotal = !invoiceData.totalAmount;

            const data = {
                ...invoiceData,
                totalAmount: invoiceData.totalAmount || 0,
                itemsTotal: 0, // Will be updated as items are linked
                itemsCount: 0, // Number of linked items
                itemNames: [], // lowercase product names, used for searching
                balanceRemaining: (invoiceData.totalAmount || 0) - (invoiceData.amountPaid || 0),
                // set AFTER the spread so a client can't spoof who keyed it in
                createdBy: this._userId(user),
                createdByName: user ? this._userName(user) : null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(data);
            const invoiceId = docRef.id;

            const inventoryService = require('./inventory.service');
            for (const item of items) {
                if (item.inventoryId) {
                    await inventoryService.replenishItem(item.inventoryId, {
                        invoiceId,
                        quantity: item.quantity,
                        buyingPrice: item.unitPrice,
                        notes: `From invoice ${invoiceData.invoiceNumber}`
                    });
                }
            }

            logger.info(`Invoice created: ${invoiceData.invoiceNumber}`, { id: invoiceId });

            // Update supplier financial stats — use resolvedTotal, matching what was actually saved
            await supplierService.updateFinancialStats(
                invoiceData.supplierId,
                resolvedTotal,
                invoiceData.amountPaid || 0
            );

            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getInvoiceById(invoiceId);
        } catch (error) {
            logger.error('Create invoice error:', error);
            throw error;
        }
    }

    /**
     * Update invoice items total when inventory is linked
     * Called from inventory service
     * @param {string} invoiceId
     * @param {number} itemCost
     * @param {string} [productName] - saved (lowercase) on the invoice so it can be searched by item
     * @returns {Promise<void>}
     */
    async addItemToInvoice(invoiceId, itemCost, productName = null) {
        try {
            const invoice = await this.getInvoiceById(invoiceId);
            this._assertActive(invoice);

            const newItemsTotal = (invoice.itemsTotal || 0) + itemCost;

            const updates = {
                itemsTotal: newItemsTotal,
                itemsCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (productName) {
                updates.itemNames = admin.firestore.FieldValue.arrayUnion(productName.toLowerCase());
            }

            await this.db.collection(this.collection).doc(invoiceId).update(updates);

            logger.info(`Item added to invoice: ${invoiceId}`, {
                itemCost,
                newItemsTotal
            });

            await cache.del(`${this.cachePrefix}${invoiceId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Add item to invoice error:', error);
            throw error;
        }
    }

    /**
     * Remove item from invoice when inventory is deleted
     * @param {string} invoiceId
     * @param {number} itemCost
     * @returns {Promise<void>}
     */
    async removeItemFromInvoice(invoiceId, itemCost) {
        try {
            const invoice = await this.getInvoiceById(invoiceId);

            await this.db.collection(this.collection).doc(invoiceId).update({
                itemsTotal: invoice.itemsTotal - itemCost,
                itemsCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`Item removed from invoice: ${invoiceId}`, { itemCost });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${invoiceId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Remove item from invoice error:', error);
            throw error;
        }
    }

    /**
     * Get invoice by ID
     * @param {string} invoiceId
     * @returns {Promise<Object>}
     */
    async getInvoiceById(invoiceId) {
        try {
            const cacheKey = `${this.cachePrefix}${invoiceId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(invoiceId).get();

            if (!doc.exists) {
                throw new NotFoundError('Invoice');
            }

            const invoice = serializeDoc(doc);

            // Get supplier details
            const supplier = await supplierService.getSupplierById(invoice.supplierId);
            invoice.supplierName = supplier.name;

            invoice.etrStatus = supplier.etrStatus || null;

            // Calculate remaining amount that can be allocated to items
            invoice.remainingToAllocate = invoice.totalAmount - invoice.itemsTotal;

            await cache.set(cacheKey, invoice, this.cacheTTL);
            return invoice;
        } catch (error) {
            logger.error('Get invoice error:', error);
            throw error;
        }
    }

    /**
     * Items that came in on an invoice (powers the "remove items" checklist).
     * Source of truth is stock_adjustments, so invoices whose stock was added before
     * stock-in logging existed will not list those items.
     * @param {string} invoiceId
     * @returns {Promise<Array>}
     */
    async getInvoiceItems(invoiceId) {
        try {
            await this.getInvoiceById(invoiceId); // 404 if the invoice doesn't exist

            const snap = await this.db.collection('stock_adjustments')
                .where('invoiceId', '==', invoiceId)
                .get();

            return serializeDocs(snap)
                .filter(a => a.reason === 'purchase' && a.adjustment > 0)
                .map(a => ({
                    id: a.id, // pass these ids to removeItems
                    inventoryId: a.inventoryId,
                    productName: a.productName,
                    quantity: a.adjustment,
                    buyingPrice: a.buyingPrice || null,
                    itemCost: a.itemCost || 0,
                    type: a.type || null,
                    createdAt: a.createdAt || null
                }));
        } catch (error) {
            logger.error('Get invoice items error:', error);
            throw error;
        }
    }

    /**
     * Get all invoices with filters
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAllInvoices(filters = {}) {
        try {
            const {
                supplierId,
                paymentStatus,
                startDate,
                endDate,
                minAmount,
                maxAmount,
                hasItems,
                status,
                search,
                sortBy = 'invoiceDate',
                sortOrder = 'desc'
            } = filters;

            // Query-string values arrive as strings. "20" + 20 === "2020" in JS, which used to make
            // slice() return everything after the first page and produced repeated invoices.
            const page = Math.max(1, parseInt(filters.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));

            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection);

            if (supplierId) {
                query = query.where('supplierId', '==', supplierId);
            }
            if (paymentStatus) {
                query = query.where('paymentStatus', '==', paymentStatus);
            }

            const [snapshot, supplierSnap] = await Promise.all([
                query.get(),
                this.db.collection('suppliers').get()
            ]);

            // Attach supplier names so the list can show and search them
            const supplierNames = new Map(supplierSnap.docs.map(d => [d.id, d.data().name || '']));
            let invoices = serializeDocs(snapshot).map(inv => ({
                ...inv,
                supplierName: supplierNames.get(inv.supplierId) || inv.supplierName || ''
            }));

            // Keyword search: invoice number, supplier name, who keyed it in, product names.
            // Every word typed must match somewhere ("sugar kevian" finds Kevian's invoices with sugar).
            if (search && String(search).trim()) {
                const terms = String(search).toLowerCase().split(/\s+/).filter(Boolean);
                invoices = invoices.filter(inv => {
                    const haystack = [
                        inv.invoiceNumber,
                        inv.supplierName,
                        inv.createdByName,
                        ...(inv.itemNames || [])
                    ].join(' ').toLowerCase();
                    return terms.every(t => haystack.includes(t));
                });
            }

            // Client-side filtering
            if (startDate) {
                invoices = invoices.filter(inv => new Date(inv.invoiceDate) >= new Date(startDate));
            }
            if (endDate) {
                invoices = invoices.filter(inv => new Date(inv.invoiceDate) <= new Date(endDate));
            }
            if (minAmount !== undefined) {
                invoices = invoices.filter(inv => inv.totalAmount >= minAmount);
            }
            if (maxAmount !== undefined) {
                invoices = invoices.filter(inv => inv.totalAmount <= maxAmount);
            }
            if (hasItems !== undefined) {
                invoices = invoices.filter(inv => hasItems ? inv.itemsCount > 0 : inv.itemsCount === 0);
            }

            // Status filter
            invoices = status === 'voided'
                ? invoices.filter(i => i.status === 'voided')
                : invoices.filter(i => i.status !== 'voided');

            // Sort. The comparator must return 0 for ties and then fall back to the id,
            // otherwise invoices with the same date can swap places between page requests.
            const compare = (a, b) => {
                const av = a[sortBy];
                const bv = b[sortBy];
                if (av === bv) return 0;
                if (av === undefined || av === null) return 1;
                if (bv === undefined || bv === null) return -1;
                return av > bv ? 1 : -1;
            };
            invoices.sort((a, b) => {
                const c = sortOrder === 'asc' ? compare(a, b) : -compare(a, b);
                if (c !== 0) return c;
                return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
            });

            // Pagination
            const total = invoices.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedInvoices = invoices.slice(startIndex, endIndex);

            const result = {
                invoices: paginatedInvoices,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: endIndex < total,
                    hasPrevPage: page > 1
                }
            };

            await cache.set(cacheKey, result, this.cacheTTL);
            return result;
        } catch (error) {
            logger.error('Get all invoices error:', error);
            throw error;
        }
    }

    /**
     * Update invoice
     * @param {string} invoiceId
     * @param {Object} updateData
     * @param {Object} user - req.user
     * @returns {Promise<Object>}
     */
    async updateInvoice(invoiceId, updateData, user = null) {
        try {
            const doc = await this.db.collection(this.collection).doc(invoiceId).get();

            if (!doc.exists) {
                throw new NotFoundError('Invoice');
            }

            const invoice = doc.data();
            this._assertActive(invoice);

            // Never let a request overwrite system-managed fields
            const safeUpdate = { ...updateData };
            PROTECTED_FIELDS.forEach(f => delete safeUpdate[f]);

            // If updating total amount, validate against items total
            if (safeUpdate.totalAmount !== undefined) {
                if (safeUpdate.totalAmount < invoice.itemsTotal) {
                    throw new ValidationError(
                        `Cannot set invoice total (${safeUpdate.totalAmount}) below items total (${invoice.itemsTotal})`
                    );
                }
            }

            const updates = {
                ...safeUpdate,
                updatedBy: this._userId(user),
                updatedByName: user ? this._userName(user) : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Recalculate balance if amount paid or total changed
            if (safeUpdate.amountPaid !== undefined || safeUpdate.totalAmount !== undefined) {
                const newTotal = safeUpdate.totalAmount !== undefined ? safeUpdate.totalAmount : invoice.totalAmount;
                const newPaid = safeUpdate.amountPaid !== undefined ? safeUpdate.amountPaid : invoice.amountPaid;
                updates.balanceRemaining = newTotal - newPaid;
            }

            await this.db.collection(this.collection).doc(invoiceId).update(updates);

            // NEW — if totalAmount changed, adjust the supplier's running total by the difference
            if (updateData.totalAmount !== undefined && updateData.totalAmount !== invoice.totalAmount) {
                const totalDelta = updateData.totalAmount - (invoice.totalAmount || 0);
                await supplierService.updateFinancialStats(invoice.supplierId, totalDelta, 0);
            }


            logger.info(`Invoice updated: ${invoiceId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${invoiceId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getInvoiceById(invoiceId);
        } catch (error) {
            logger.error('Update invoice error:', error);
            throw error;
        }
    }

    /**
     * Record payment for invoice
     * @param {string} invoiceId
     * @param {Object} paymentData
     * @returns {Promise<Object>}
     */
    async recordPayment(invoiceId, paymentData) {
        try {
            const invoice = await this.getInvoiceById(invoiceId);
            this._assertActive(invoice);

            const newAmountPaid = invoice.amountPaid + paymentData.amount;
            const newBalance = invoice.totalAmount - newAmountPaid;

            if (newBalance < -0.01) {
                throw new ValidationError('Payment amount exceeds invoice balance');
            }

            // Determine new payment status
            let paymentStatus = 'pending';
            if (newBalance < 0.01) {
                paymentStatus = 'paid';
            } else if (newAmountPaid > 0) {
                paymentStatus = 'partial';
            }

            // Update invoice
            await this.db.collection(this.collection).doc(invoiceId).update({
                amountPaid: newAmountPaid,
                balanceRemaining: newBalance,
                paymentStatus,
                paymentMethod: paymentData.paymentMethod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Record payment transaction
            await this.db.collection('invoice_payments').add({
                invoiceId,
                supplierId: invoice.supplierId,
                amount: paymentData.amount,
                paymentMethod: paymentData.paymentMethod,
                paymentDate: paymentData.paymentDate || admin.firestore.FieldValue.serverTimestamp(),
                reference: paymentData.reference || '',
                notes: paymentData.notes || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update supplier financial stats
            await supplierService.updateFinancialStats(
                invoice.supplierId,
                0,
                paymentData.amount
            );

            logger.info(`Payment recorded for invoice: ${invoiceId}`, { amount: paymentData.amount });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${invoiceId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getInvoiceById(invoiceId);
        } catch (error) {
            logger.error('Record payment error:', error);
            throw error;
        }
    }

    _assertActive(invoice) {
        if (invoice.status === 'voided') {
            throw new ValidationError('This invoice has been reversed and can no longer be changed');
        }
    }

    async reverseInvoice(invoiceId, reason, user) {
        if (!reason || !reason.trim()) throw new ValidationError('A reason is required');
        return this._undoInvoice(invoiceId, { mode: 'void', reason: reason.trim(), user });
    }

    async deleteInvoice(invoiceId, user) {
        return this._undoInvoice(invoiceId, { mode: 'delete', user });
    }

    /**
     * Remove ticked items from an invoice: puts their stock back out of inventory,
     * lowers the invoice's items total/count, and keeps the invoice itself.
     * Refuses if any of that stock has already been sold or adjusted.
     * @param {string} invoiceId
     * @param {string[]} adjustmentIds - ids from getInvoiceItems()
     * @param {Object} user
     */
    async removeItems(invoiceId, adjustmentIds, user = null) {
        const ids = [...new Set(adjustmentIds || [])];
        if (!ids.length) throw new ValidationError('Select at least one item to remove');

        const inventoryService = require('./inventory.service'); // lazy, avoids circular require
        const invoiceRef = this.db.collection(this.collection).doc(invoiceId);
        const userName = this._userName(user);
        let supplierId = null;
        let touchedItemIds = [];
        let removed = 0;

        try {
            await this.db.runTransaction(async (tx) => {
                // ---- reads first ----
                const snap = await tx.get(invoiceRef);
                if (!snap.exists) throw new NotFoundError('Invoice');
                const invoice = snap.data();
                this._assertActive(invoice);
                supplierId = invoice.supplierId;

                const plan = await inventoryService.planInvoiceStockReversal(tx, invoiceId, ids);
                if (plan.removedCount !== ids.length) {
                    throw new ValidationError('Some of the selected items were not found on this invoice');
                }

                // ---- writes ----
                plan.apply(tx, 'delete', userName);
                tx.update(invoiceRef, {
                    itemsTotal: Math.max(0, (invoice.itemsTotal || 0) - plan.removedCost),
                    itemsCount: Math.max(0, (invoice.itemsCount || 0) - plan.removedCount),
                    itemNames: plan.remainingNames,
                    updatedBy: this._userId(user),
                    updatedByName: userName,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                touchedItemIds = plan.touchedItemIds;
                removed = plan.removedCount;
            });
        } catch (error) {
            logger.error('Remove invoice items error:', error);
            throw error;
        }

        await Promise.all([
            cache.del(`${this.cachePrefix}${invoiceId}`),
            cache.delPattern(`${this.cachePrefix}list:*`),
            cache.delPattern('inventory:list:*'),
            cache.delPattern('inventory:lowstock:*'),
            ...touchedItemIds.map(id => cache.del(`inventory:${id}`))
        ]);

        logger.info(`Items removed from invoice ${invoiceId}`, { removed, by: userName });
        return { id: invoiceId, itemsRemoved: removed };
    }

    async _undoInvoice(invoiceId, { mode, reason = '', user = null }) {
        const inventoryService = require('./inventory.service'); // lazy, avoids circular require
        const FV = admin.firestore.FieldValue;
        const invoiceRef = this.db.collection(this.collection).doc(invoiceId);
        const userName = user?.name || user?.displayName || user?.email || 'Unknown';
        let invoice, plan = null;

        try {
            await this.db.runTransaction(async (tx) => {
                // ---- reads first ----
                const snap = await tx.get(invoiceRef);
                if (!snap.exists) throw new NotFoundError('Invoice');
                invoice = snap.data();

                const alreadyVoided = invoice.status === 'voided';
                if (mode === 'void' && alreadyVoided) throw new ValidationError('Invoice is already reversed');

                const paymentsSnap = await tx.get(
                    this.db.collection('invoice_payments').where('invoiceId', '==', invoiceId)
                );
                plan = alreadyVoided ? null : await inventoryService.planInvoiceStockReversal(tx, invoiceId);

                // ---- writes ----
                if (plan) {
                    plan.apply(tx, mode, userName);
                    const total = invoice.totalAmount || 0;
                    const paid = invoice.amountPaid || 0;
                    tx.update(this.db.collection('suppliers').doc(invoice.supplierId), {
                        totalPurchases: FV.increment(-total),
                        totalPaid: FV.increment(-paid),
                        outstandingBalance: FV.increment(-(total - paid)),
                        updatedAt: FV.serverTimestamp()
                    });
                }

                if (mode === 'delete') {
                    paymentsSnap.docs.forEach(d => tx.delete(d.ref));
                    tx.delete(invoiceRef);
                } else {
                    paymentsSnap.docs.forEach(d => tx.update(d.ref, { reversed: true, reversedAt: FV.serverTimestamp() }));
                    tx.update(invoiceRef, {
                        status: 'voided',
                        voidedAt: FV.serverTimestamp(),
                        voidReason: reason,
                        voidedBy: user?.uid || user?.id || null,
                        voidedByName: userName,
                        updatedAt: FV.serverTimestamp()
                    });
                }
            });
        } catch (error) {
            logger.error(`Invoice ${mode} error:`, error);
            throw error;
        }

        await Promise.all([
            cache.del(`${this.cachePrefix}${invoiceId}`),
            cache.delPattern(`${this.cachePrefix}list:*`),
            cache.del(`supplier:${invoice.supplierId}`),
            cache.delPattern('supplier:list:*'),
            cache.delPattern('inventory:list:*'),
            cache.delPattern('inventory:lowstock:*'),
            ...(plan ? plan.touchedItemIds.map(id => cache.del(`inventory:${id}`)) : [])
        ]);

        const warnings = [];
        if (plan && !plan.touchedItemIds.length && invoice.itemsCount > 0) {
            warnings.push('No stock records were found for this invoice, so inventory was left unchanged. Check its products manually.');
        }
        logger.info(`Invoice ${mode === 'delete' ? 'deleted' : 'reversed'}: ${invoiceId}`);
        return { id: invoiceId, mode, productsReversed: plan?.touchedItemIds.length || 0, warnings };
    }
}

module.exports = new InvoiceService();