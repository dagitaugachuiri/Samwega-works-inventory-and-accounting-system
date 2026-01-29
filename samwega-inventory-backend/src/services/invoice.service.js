const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');
const supplierService = require('./supplier.service');

class InvoiceService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'invoices';
        this.cachePrefix = 'invoice:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Create new invoice (without items)
     * Items will be linked when adding inventory in Phase 3
     * @param {Object} invoiceData
     * @returns {Promise<Object>}
     */
    async createInvoice(invoiceData) {
        try {
            // Verify supplier exists
            await supplierService.getSupplierById(invoiceData.supplierId);

            // Check for duplicate invoice number
            const existingInvoice = await this.db.collection(this.collection)
                .where('invoiceNumber', '==', invoiceData.invoiceNumber)
                .limit(1)
                .get();

            if (!existingInvoice.empty) {
                throw new ValidationError('Invoice number already exists');
            }

            const data = {
                ...invoiceData,
                itemsTotal: 0, // Will be updated as items are linked
                itemsCount: 0, // Number of linked items
                balanceRemaining: invoiceData.totalAmount - (invoiceData.amountPaid || 0),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(data);
            const invoiceId = docRef.id;

            logger.info(`Invoice created: ${invoiceData.invoiceNumber}`, { id: invoiceId });

            // Update supplier financial stats
            await supplierService.updateFinancialStats(
                invoiceData.supplierId,
                invoiceData.totalAmount,
                invoiceData.amountPaid || 0
            );

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}list:*`);

            return await this.getInvoiceById(invoiceId);
        } catch (error) {
            logger.error('Create invoice error:', error);
            throw error;
        }
    }

    /**
     * Update invoice items total when inventory is linked
     * Called from inventory service in Phase 3
     * @param {string} invoiceId
     * @param {number} itemCost
     * @returns {Promise<void>}
     */
    async addItemToInvoice(invoiceId, itemCost) {
        try {
            const invoice = await this.getInvoiceById(invoiceId);

            const newItemsTotal = invoice.itemsTotal + itemCost;

            // Validate that items total doesn't exceed invoice total
            if (newItemsTotal > invoice.totalAmount + 0.01) { // Allow 1 cent tolerance
                throw new ValidationError(
                    `Adding this item (${itemCost}) would exceed invoice total. ` +
                    `Current items total: ${invoice.itemsTotal}, Invoice total: ${invoice.totalAmount}`
                );
            }

            await this.db.collection(this.collection).doc(invoiceId).update({
                itemsTotal: newItemsTotal,
                itemsCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`Item added to invoice: ${invoiceId}`, {
                itemCost,
                newItemsTotal,
                remaining: invoice.totalAmount - newItemsTotal
            });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${invoiceId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Add item to invoice error:', error);
            throw error;
        }
    }

    /**
     * Remove item from invoice when inventory is deleted
     * Called from inventory service in Phase 3
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
                page = 1,
                limit = 20,
                sortBy = 'invoiceDate',
                sortOrder = 'desc'
            } = filters;

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

            const snapshot = await query.get();
            let invoices = serializeDocs(snapshot);

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

            // Sort
            invoices.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];
                return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
            });

            // Pagination
            const total = invoices.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedInvoices = invoices.slice(startIndex, endIndex);

            const result = {
                invoices: paginatedInvoices,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
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
     * @returns {Promise<Object>}
     */
    async updateInvoice(invoiceId, updateData) {
        try {
            const doc = await this.db.collection(this.collection).doc(invoiceId).get();

            if (!doc.exists) {
                throw new NotFoundError('Invoice');
            }

            const invoice = doc.data();

            // If updating total amount, validate against items total
            if (updateData.totalAmount !== undefined) {
                if (updateData.totalAmount < invoice.itemsTotal) {
                    throw new ValidationError(
                        `Cannot set invoice total (${updateData.totalAmount}) below items total (${invoice.itemsTotal})`
                    );
                }
            }

            const updates = {
                ...updateData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Recalculate balance if amount paid or total changed
            if (updateData.amountPaid !== undefined || updateData.totalAmount !== undefined) {
                const newTotal = updateData.totalAmount !== undefined ? updateData.totalAmount : invoice.totalAmount;
                const newPaid = updateData.amountPaid !== undefined ? updateData.amountPaid : invoice.amountPaid;
                updates.balanceRemaining = newTotal - newPaid;
            }

            await this.db.collection(this.collection).doc(invoiceId).update(updates);

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

    /**
     * Delete invoice
     * @param {string} invoiceId
     * @returns {Promise<void>}
     */
    async deleteInvoice(invoiceId) {
        try {
            const doc = await this.db.collection(this.collection).doc(invoiceId).get();

            if (!doc.exists) {
                throw new NotFoundError('Invoice');
            }

            const invoice = doc.data();

            // Check if any payments have been made
            if (invoice.amountPaid > 0) {
                throw new ValidationError('Cannot delete invoice with payments');
            }

            // Check if any items are linked
            if (invoice.itemsCount > 0) {
                throw new ValidationError('Cannot delete invoice with linked items. Remove items first.');
            }

            await this.db.collection(this.collection).doc(invoiceId).delete();

            logger.info(`Invoice deleted: ${invoiceId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${invoiceId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Delete invoice error:', error);
            throw error;
        }
    }
}

module.exports = new InvoiceService();
