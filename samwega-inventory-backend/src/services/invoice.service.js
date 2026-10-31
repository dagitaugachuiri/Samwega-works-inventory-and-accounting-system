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
        return user?.name || user?.displayName || user?.username || user?.email || 'Unknown';
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

            // Invoice numbers only have to be unique per supplier (two suppliers can both issue "001")
            await this._assertInvoiceNumberFree(invoiceData.supplierId, invoiceData.invoiceNumber);

            const items = invoiceData.items || [];
            const calculatedItemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

            // Add Stock creates the invoice at total 0 and links the items afterwards. In that case
            // (no typed total, no items sent) the total follows the items as they are linked
            // (see addItemToInvoice). A typed total always wins.
            const autoTotal = !invoiceData.totalAmount && items.length === 0;
            const resolvedTotal = invoiceData.totalAmount || calculatedItemsTotal;

            // Supplier prices on ETR invoices already include 16% VAT, so nothing is added on top.
            // taxAmount is only stored if someone typed it in.
            const taxAmount = invoiceData.taxAmount || 0;

            const amountPaid = invoiceData.amountPaid || 0;
            if (resolvedTotal > 0 && amountPaid > resolvedTotal + 0.01) {
                throw new ValidationError('Amount paid cannot be more than the invoice total');
            }

            // paymentStatus is worked out here, never trusted from the client
            let paymentStatus = 'pending';
            if (resolvedTotal > 0 && resolvedTotal - amountPaid < 0.01) paymentStatus = 'paid';
            else if (amountPaid > 0) paymentStatus = 'partial';

            const data = {
                ...invoiceData,
                // name is copied from the supplier record, not from the request, and kept on the
                // invoice so it still reads correctly if the supplier is later deactivated/renamed
                supplierName: supplier.name,
                etrStatus: supplier.etrStatus || 'non-etr',
                totalAmount: resolvedTotal,
                autoTotal,
                taxAmount,
                amountPaid,
                paymentStatus,
                itemsTotal: 0, // Will be updated as items are linked
                itemsCount: 0, // Number of linked items
                itemNames: [], // lowercase product names, used for searching
                balanceRemaining: resolvedTotal - amountPaid,
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
        const FV = admin.firestore.FieldValue;
        const invoiceRef = this.db.collection(this.collection).doc(invoiceId);
        let supplierId = null;

        try {
            // Transaction: several items linked in quick succession can no longer overwrite
            // each other's totals, and invoice + supplier totals save together or not at all.
            await this.db.runTransaction(async (tx) => {
                const snap = await tx.get(invoiceRef);
                if (!snap.exists) throw new NotFoundError('Invoice');
                const invoice = snap.data();
                this._assertActive(invoice);
                supplierId = invoice.supplierId;

                const supplierRef = this.db.collection('suppliers').doc(supplierId);
                const supplierSnap = await tx.get(supplierRef);

                const newItemsTotal = (invoice.itemsTotal || 0) + itemCost;
                const updates = {
                    itemsTotal: newItemsTotal,
                    itemsCount: FV.increment(1),
                    updatedAt: FV.serverTimestamp()
                };
                if (productName) {
                    updates.itemNames = FV.arrayUnion(String(productName).toLowerCase());
                }

                // Add Stock invoices start at total 0: the total follows the items. Older invoices
                // saved with a 0 total are picked up here too and fixed as soon as an item is linked.
                let totalDelta = 0;
                if (invoice.autoTotal || !invoice.totalAmount) {
                    const paid = invoice.amountPaid || 0;
                    totalDelta = newItemsTotal - (invoice.totalAmount || 0);
                    updates.totalAmount = newItemsTotal;
                    updates.autoTotal = true;
                    updates.balanceRemaining = newItemsTotal - paid;
                    updates.paymentStatus = newItemsTotal > 0 && newItemsTotal - paid < 0.01
                        ? 'paid' : (paid > 0 ? 'partial' : 'pending');
                }

                tx.update(invoiceRef, updates);
                if (totalDelta !== 0 && supplierSnap.exists) {
                    tx.update(supplierRef, {
                        totalPurchases: FV.increment(totalDelta),
                        outstandingBalance: FV.increment(totalDelta),
                        updatedAt: FV.serverTimestamp()
                    });
                }
            });

            logger.info(`Item added to invoice: ${invoiceId}`, { itemCost });

            await Promise.all([
                cache.del(`${this.cachePrefix}${invoiceId}`),
                cache.delPattern(`${this.cachePrefix}list:*`),
                cache.del(`supplier:${supplierId}`),
                cache.delPattern('supplier:list:*')
            ]);
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
                etrStatus,
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
            // 'unpaid' = anything with money still owing (pending + partial); handled below
            if (paymentStatus && paymentStatus !== 'unpaid') {
                query = query.where('paymentStatus', '==', paymentStatus);
            }

            const [snapshot, supplierOptions] = await Promise.all([
                query.get(),
                supplierService.getSupplierOptions() // cached: no extra Firestore reads per page
            ]);

            // Attach supplier names so the list can show and search them
            const supplierNames = new Map(supplierOptions.map(o => [o.id, o.name]));
            const supplierEtr = new Map(supplierOptions.map(o => [o.id, o.etrStatus]));
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

            if (paymentStatus === 'unpaid') {
                invoices = invoices.filter(inv => (inv.balanceRemaining || 0) > 0.01);
            }
            if (etrStatus) {
                invoices = invoices.filter(inv => (inv.etrStatus || supplierEtr.get(inv.supplierId) || 'non-etr') === etrStatus);
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

            // Totals for everything that matches the filters (not just this page)
            const summary = invoices.reduce((acc, inv) => {
                acc.totalAmount += inv.totalAmount || 0;
                acc.amountPaid += inv.amountPaid || 0;
                acc.balanceRemaining += inv.balanceRemaining || 0;
                return acc;
            }, { totalAmount: 0, amountPaid: 0, balanceRemaining: 0 });

            // Pagination
            const total = invoices.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedInvoices = invoices.slice(startIndex, endIndex);

            const result = {
                invoices: paginatedInvoices,
                summary,
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

            const invoice = { ...doc.data() }; // copy: we compare against the pre-edit values later
            this._assertActive(invoice);

            // Never let a request overwrite system-managed fields
            const safeUpdate = { ...updateData };
            PROTECTED_FIELDS.forEach(f => delete safeUpdate[f]);

            // Moving the invoice to another supplier (e.g. fixing an "Unknown" supplier)
            const supplierChanged = !!safeUpdate.supplierId && safeUpdate.supplierId !== invoice.supplierId;
            let newSupplier = null;
            if (supplierChanged) {
                newSupplier = await supplierService.getSupplierById(safeUpdate.supplierId); // 404 if it doesn't exist
                safeUpdate.supplierName = newSupplier.name;
                safeUpdate.etrStatus = newSupplier.etrStatus || 'non-etr';
            } else {
                delete safeUpdate.supplierId;
            }
            const finalSupplierId = supplierChanged ? safeUpdate.supplierId : invoice.supplierId;
            const finalNumber = safeUpdate.invoiceNumber || invoice.invoiceNumber;
            if (supplierChanged || (safeUpdate.invoiceNumber && safeUpdate.invoiceNumber !== invoice.invoiceNumber)) {
                await this._assertInvoiceNumberFree(finalSupplierId, finalNumber, invoiceId);
            }

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

            // Recalculate balance + status if amount paid or total changed
            if (safeUpdate.amountPaid !== undefined || safeUpdate.totalAmount !== undefined) {
                const newTotal = safeUpdate.totalAmount !== undefined ? safeUpdate.totalAmount : (invoice.totalAmount || 0);
                const newPaid = safeUpdate.amountPaid !== undefined ? safeUpdate.amountPaid : (invoice.amountPaid || 0);
                if (newPaid > newTotal + 0.01) {
                    throw new ValidationError('Amount paid cannot be more than the invoice total');
                }
                updates.balanceRemaining = newTotal - newPaid;
                updates.paymentStatus = newTotal > 0 && newTotal - newPaid < 0.01
                    ? 'paid'
                    : (newPaid > 0 ? 'partial' : 'pending');
            }

            await this.db.collection(this.collection).doc(invoiceId).update(updates);

            // Keep the supplier's running totals equal to the sum of its invoices:
            // adjust by the difference when the total OR the amount paid was edited
            const finalTotal = safeUpdate.totalAmount !== undefined ? safeUpdate.totalAmount : (invoice.totalAmount || 0);
            const finalPaid = safeUpdate.amountPaid !== undefined ? safeUpdate.amountPaid : (invoice.amountPaid || 0);

            if (supplierChanged) {
                // take it off the old supplier (if that record still exists) and put it on the new one
                const oldExists = (await this.db.collection('suppliers').doc(invoice.supplierId).get()).exists;
                if (oldExists) {
                    await supplierService.updateFinancialStats(invoice.supplierId, -(invoice.totalAmount || 0), -(invoice.amountPaid || 0));
                }
                await supplierService.updateFinancialStats(finalSupplierId, finalTotal, finalPaid);

                // payment records follow the invoice
                const pays = await this.db.collection('invoice_payments').where('invoiceId', '==', invoiceId).get();
                if (!pays.empty) {
                    const batch = this.db.batch();
                    pays.docs.forEach(d => batch.update(d.ref, { supplierId: finalSupplierId }));
                    await batch.commit();
                }
                await cache.delPattern('supplier:*');
            } else {
                const totalDelta = finalTotal - (invoice.totalAmount || 0);
                const paidDelta = finalPaid - (invoice.amountPaid || 0);
                if (totalDelta !== 0 || paidDelta !== 0) {
                    await supplierService.updateFinancialStats(invoice.supplierId, totalDelta, paidDelta);
                }
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
    async recordPayment(invoiceId, paymentData, user = null) {
        try {
            const FV = admin.firestore.FieldValue;
            const invoiceRef = this.db.collection(this.collection).doc(invoiceId);
            let supplierId = null;

            // One transaction: two people paying the same invoice at once can no longer
            // both pass the balance check, and invoice, payment and supplier totals
            // either all save or none do.
            await this.db.runTransaction(async (tx) => {
                const snap = await tx.get(invoiceRef);
                if (!snap.exists) throw new NotFoundError('Invoice');
                const invoice = snap.data();
                this._assertActive(invoice);
                supplierId = invoice.supplierId;

                const newAmountPaid = (invoice.amountPaid || 0) + paymentData.amount;
                const newBalance = (invoice.totalAmount || 0) - newAmountPaid;

                if (newBalance < -0.01) {
                    throw new ValidationError('Payment amount exceeds invoice balance');
                }

                let paymentStatus = 'pending';
                if (newBalance < 0.01) paymentStatus = 'paid';
                else if (newAmountPaid > 0) paymentStatus = 'partial';

                tx.update(invoiceRef, {
                    amountPaid: newAmountPaid,
                    balanceRemaining: newBalance,
                    paymentStatus,
                    paymentMethod: paymentData.paymentMethod,
                    updatedAt: FV.serverTimestamp()
                });

                tx.set(this.db.collection('invoice_payments').doc(), {
                    invoiceId,
                    supplierId,
                    amount: paymentData.amount,
                    paymentMethod: paymentData.paymentMethod,
                    paymentDate: paymentData.paymentDate || FV.serverTimestamp(),
                    reference: paymentData.reference || '',
                    notes: paymentData.notes || '',
                    recordedBy: this._userId(user),
                    recordedByName: user ? this._userName(user) : null,
                    createdAt: FV.serverTimestamp()
                });

                tx.update(this.db.collection('suppliers').doc(supplierId), {
                    totalPaid: FV.increment(paymentData.amount),
                    outstandingBalance: FV.increment(-paymentData.amount),
                    updatedAt: FV.serverTimestamp()
                });
            });

            logger.info(`Payment recorded for invoice: ${invoiceId}`, { amount: paymentData.amount });

            await Promise.all([
                cache.del(`${this.cachePrefix}${invoiceId}`),
                cache.delPattern(`${this.cachePrefix}list:*`),
                cache.del(`supplier:${supplierId}`),
                cache.delPattern('supplier:list:*')
            ]);

            return await this.getInvoiceById(invoiceId);
        } catch (error) {
            logger.error('Record payment error:', error);
            throw error;
        }
    }

    async _assertInvoiceNumberFree(supplierId, invoiceNumber, exceptInvoiceId = null) {
        const dup = await this.db.collection(this.collection)
            .where('supplierId', '==', supplierId)
            .where('invoiceNumber', '==', invoiceNumber)
            .limit(2)
            .get();
        if (dup.docs.some(d => d.id !== exceptInvoiceId)) {
            throw new ValidationError('This supplier already has an invoice with that number');
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

                const supplierRef = this.db.collection('suppliers').doc(invoice.supplierId);
                const supplierSnap = await tx.get(supplierRef);

                const plan = await inventoryService.planInvoiceStockReversal(tx, invoiceId, ids);
                if (plan.removedCount !== ids.length) {
                    throw new ValidationError('Some of the selected items were not found on this invoice');
                }

                // ---- work out the new totals BEFORE any write ----
                const newItemsTotal = Math.max(0, (invoice.itemsTotal || 0) - plan.removedCost);
                const paid = invoice.amountPaid || 0;
                // Add Stock invoices: total follows the items. Invoices with a typed total:
                // the total goes down by what was removed. Either way supplier totals follow.
                const newTotal = invoice.autoTotal
                    ? newItemsTotal
                    : Math.max(0, (invoice.totalAmount || 0) - plan.removedCost);
                if (paid > newTotal + 0.01) {
                    throw new ValidationError(
                        `This invoice has KES ${paid.toLocaleString()} paid, which is more than the new total ` +
                        `(KES ${newTotal.toLocaleString()}). Lower the paid amount first (Edit invoice), then remove the items.`
                    );
                }

                // ---- writes ----
                plan.apply(tx, 'delete', userName);
                const invoiceUpdates = {
                    itemsTotal: newItemsTotal,
                    itemsCount: Math.max(0, (invoice.itemsCount || 0) - plan.removedCount),
                    itemNames: plan.remainingNames,
                    totalAmount: newTotal,
                    balanceRemaining: newTotal - paid,
                    paymentStatus: newTotal > 0 && newTotal - paid < 0.01 ? 'paid' : (paid > 0 ? 'partial' : 'pending'),
                    updatedBy: this._userId(user),
                    updatedByName: userName,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                const delta = newTotal - (invoice.totalAmount || 0);
                if (delta !== 0 && supplierSnap.exists) {
                    tx.update(supplierRef, {
                        totalPurchases: admin.firestore.FieldValue.increment(delta),
                        outstandingBalance: admin.firestore.FieldValue.increment(delta),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                tx.update(invoiceRef, invoiceUpdates);

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

    /**
     * Admin clean-up of invoices damaged by the old "total stays 0" bug.
     *  - 'delete-empty'  : delete invoices with no items, no total, no payment and no linked stock
     *  - 'repair-totals' : rebuild items count/total (and the total of Add Stock invoices) from the
     *                      stock actually received on the invoice, and fix the supplier's totals
     * dryRun (default) only reports what WOULD change.
     * @param {{action: string, dryRun?: boolean}} opts
     */
    async cleanupInvoices({ action, dryRun = true }) {
        const FV = admin.firestore.FieldValue;
        const [invSnap, adjSnap] = await Promise.all([
            this.db.collection(this.collection).get(),
            this.db.collection('stock_adjustments').where('reason', '==', 'purchase').get()
        ]);

        // stock really received per invoice (same rule the "items" checklist uses)
        const received = new Map();
        adjSnap.docs.forEach(d => {
            const a = d.data();
            if (!a.invoiceId || !(a.adjustment > 0)) return;
            const g = received.get(a.invoiceId) || { count: 0, cost: 0, names: new Set() };
            g.count += 1;
            g.cost += a.itemCost || ((a.buyingPrice || 0) * (a.adjustment || 0));
            if (a.productName) g.names.add(String(a.productName).toLowerCase());
            received.set(a.invoiceId, g);
        });

        const invoices = invSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
        const label = (i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, supplierName: i.supplierName || '' });
        let affected = [];

        if (action === 'delete-empty') {
            const candidates = invoices.filter(i =>
                !(i.itemsCount > 0) && !(i.totalAmount > 0) && !(i.amountPaid > 0) && !received.has(i.id));
            // payments are the one thing not in the maps above
            for (const inv of candidates) {
                const pay = await this.db.collection('invoice_payments').where('invoiceId', '==', inv.id).limit(1).get();
                if (pay.empty) affected.push(inv);
            }
            if (!dryRun) {
                for (let i = 0; i < affected.length; i += 400) {
                    const batch = this.db.batch();
                    affected.slice(i, i + 400).forEach(inv => batch.delete(inv.ref));
                    await batch.commit();
                }
            }
        } else if (action === 'repair-totals') {
            affected = invoices.filter(i => {
                if (i.status === 'voided') return false;
                const g = received.get(i.id);
                if (!g) return false;
                const wrongItems = (i.itemsCount || 0) !== g.count || Math.abs((i.itemsTotal || 0) - g.cost) > 0.01;
                const zeroTotal = !(i.totalAmount > 0) && g.cost > 0;
                return wrongItems || zeroTotal || (i.autoTotal && Math.abs((i.totalAmount || 0) - g.cost) > 0.01);
            });
            if (!dryRun) {
                for (const inv of affected) {
                    const g = received.get(inv.id);
                    const updates = {
                        itemsCount: g.count,
                        itemsTotal: g.cost,
                        itemNames: [...g.names],
                        updatedAt: FV.serverTimestamp()
                    };
                    let totalDelta = 0;
                    if (inv.autoTotal || !(inv.totalAmount > 0)) {
                        const paid = inv.amountPaid || 0;
                        totalDelta = g.cost - (inv.totalAmount || 0);
                        updates.totalAmount = g.cost;
                        updates.autoTotal = true;
                        updates.balanceRemaining = g.cost - paid;
                        updates.paymentStatus = g.cost > 0 && g.cost - paid < 0.01 ? 'paid' : (paid > 0 ? 'partial' : 'pending');
                    }
                    const batch = this.db.batch();
                    batch.update(inv.ref, updates);
                    if (totalDelta !== 0 && inv.supplierId) {
                        const supRef = this.db.collection('suppliers').doc(inv.supplierId);
                        if ((await supRef.get()).exists) {
                            batch.update(supRef, {
                                totalPurchases: FV.increment(totalDelta),
                                outstandingBalance: FV.increment(totalDelta),
                                updatedAt: FV.serverTimestamp()
                            });
                        }
                    }
                    await batch.commit();
                }
            }
        } else if (action === 'backfill-keyed-by') {
            // Fill "keyed in by" on older invoices from the activity log (who pressed CREATE)
            const activityLogService = require('./activity-log.service');
            const logSnap = await this.db.collection(activityLogService.collection)
                .where('resource', '==', 'invoice')
                .where('action', '==', 'CREATE')
                .get();
            const creators = new Map();
            logSnap.docs.forEach(d => {
                const l = d.data();
                if (l.resourceId && l.username && !creators.has(l.resourceId)) {
                    creators.set(l.resourceId, { userId: l.userId, username: l.username });
                }
            });
            affected = invoices.filter(i => !i.createdByName && creators.has(i.id));
            if (!dryRun) {
                for (let i = 0; i < affected.length; i += 400) {
                    const batch = this.db.batch();
                    affected.slice(i, i + 400).forEach(inv => {
                        const c = creators.get(inv.id);
                        batch.update(inv.ref, { createdBy: c.userId || null, createdByName: c.username });
                    });
                    await batch.commit();
                }
            }
        } else {
            throw new ValidationError('Unknown clean-up action');
        }

        if (!dryRun && affected.length) {
            await Promise.all([
                cache.delPattern(`${this.cachePrefix}*`),
                cache.delPattern('supplier:*')
            ]);
        }
        logger.info(`Invoice cleanup ${action}`, { dryRun, count: affected.length });
        return { action, dryRun, count: affected.length, invoices: affected.slice(0, 50).map(label) };
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
                // The supplier may no longer exist ("Unknown" invoices): then there is nothing to adjust
                const supplierRef = this.db.collection('suppliers').doc(invoice.supplierId || 'none');
                const supplierExists = invoice.supplierId ? (await tx.get(supplierRef)).exists : false;
                plan = alreadyVoided ? null : await inventoryService.planInvoiceStockReversal(tx, invoiceId);

                // ---- writes ----
                if (plan) {
                    plan.apply(tx, mode, userName);
                    const total = invoice.totalAmount || 0;
                    const paid = invoice.amountPaid || 0;
                    if (supplierExists) tx.update(supplierRef, {
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