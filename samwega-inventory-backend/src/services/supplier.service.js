const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');

class SupplierService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'suppliers';
        this.cachePrefix = 'supplier:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Create new supplier
     * @param {Object} supplierData
     * @returns {Promise<Object>}
     */
    async createSupplier(supplierData) {
        try {
            const name = supplierData.name.trim();
            const nameLower = name.toLowerCase();

            // Same name (any capitalisation) already exists?
            const existingSupplier = await this.db.collection(this.collection)
                .where('nameLower', '==', nameLower)
                .limit(1)
                .get();

            if (!existingSupplier.empty) {
                throw new ConflictError('Supplier with this name already exists');
            }

            await this._assertKraPinFree(supplierData.kraPin);

            const data = {
                ...supplierData,
                name,
                nameLower,
                totalPurchases: 0,
                totalPaid: 0,
                outstandingBalance: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(data);

            logger.info(`Supplier created: ${supplierData.name}`, { id: docRef.id });

            await this._invalidate();

            return await this.getSupplierById(docRef.id);
        } catch (error) {
            logger.error('Create supplier error:', error);
            throw error;
        }
    }

    /**
     * Get supplier by ID
     * @param {string} supplierId
     * @returns {Promise<Object>}
     */
    async getSupplierById(supplierId) {
        try {
            const cacheKey = `${this.cachePrefix}${supplierId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(supplierId).get();

            if (!doc.exists) {
                throw new NotFoundError('Supplier');
            }

            const supplier = serializeDoc(doc);
            await cache.set(cacheKey, supplier, this.cacheTTL);

            return supplier;
        } catch (error) {
            logger.error('Get supplier error:', error);
            throw error;
        }
    }

    /**
     * Get all suppliers with filters
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAllSuppliers(filters = {}) {
        try {
            const {
                search,
                isActive,
                paymentTerms,
                etrStatus,
                page = 1,
                limit = 20
            } = filters;

            const cacheKey = `${this.cachePrefix}list:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection(this.collection);

            if (isActive !== undefined) {
                query = query.where('isActive', '==', isActive);
            }
            if (paymentTerms) {
                query = query.where('paymentTerms', '==', paymentTerms);
            }
            if (etrStatus) {
                query = query.where('etrStatus', '==', etrStatus);
            }

            const snapshot = await query.get();
            let suppliers = serializeDocs(snapshot);

            // Client-side search
            if (search) {
                const searchLower = search.toLowerCase();
                suppliers = suppliers.filter(s =>
                    s.nameLower?.includes(searchLower) ||
                    s.phone?.includes(search) ||
                    s.email?.toLowerCase().includes(searchLower)
                );
            }

            // Sort by name
            suppliers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            // Summary cards cover EVERY matching supplier, not just the visible page
            const summary = suppliers.reduce((acc, s) => {
                acc.totalPurchases += s.totalPurchases || 0;
                acc.totalPaid += s.totalPaid || 0;
                acc.outstandingBalance += s.outstandingBalance || 0;
                return acc;
            }, { totalPurchases: 0, totalPaid: 0, outstandingBalance: 0 });

            // Pagination
            const total = suppliers.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedSuppliers = suppliers.slice(startIndex, endIndex);

            const result = {
                suppliers: paginatedSuppliers,
                summary: { totalSuppliers: total, ...summary },
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
            logger.error('Get all suppliers error:', error);
            throw error;
        }
    }

    /**
     * Every supplier, light fields only, for dropdowns / name lookups.
     * Not paginated on purpose: the Add Stock dropdown and invoice filters must see ALL suppliers.
     * One cached read per 5 minutes, so it does not add Firestore cost per page view.
     * @returns {Promise<Array>}
     */
    async getSupplierOptions() {
        const cacheKey = `${this.cachePrefix}options`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const snapshot = await this.db.collection(this.collection).get();
        const options = snapshot.docs
            .map(d => {
                const x = d.data();
                return {
                    id: d.id,
                    name: x.name || '',
                    etrStatus: x.etrStatus || 'non-etr',
                    isActive: x.isActive !== false
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        await cache.set(cacheKey, options, this.cacheTTL);
        return options;
    }

    async _assertKraPinFree(kraPin, exceptId = null) {
        if (!kraPin) return;
        const dup = await this.db.collection(this.collection)
            .where('kraPin', '==', kraPin)
            .limit(2)
            .get();
        if (dup.docs.some(d => d.id !== exceptId)) {
            throw new ConflictError('Another supplier already uses this KRA PIN');
        }
    }

    async _invalidate(supplierId = null) {
        if (supplierId) await cache.del(`${this.cachePrefix}${supplierId}`);
        await cache.del(`${this.cachePrefix}options`);
        await cache.delPattern(`${this.cachePrefix}list:*`);
    }

    /**
     * Update supplier
     * @param {string} supplierId
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateSupplier(supplierId, updateData) {
        try {
            const doc = await this.db.collection(this.collection).doc(supplierId).get();

            if (!doc.exists) {
                throw new NotFoundError('Supplier');
            }

            const current = doc.data();
            const updates = { ...updateData };

            if (updateData.name) {
                updates.name = updateData.name.trim();
                updates.nameLower = updates.name.toLowerCase();
                if (updates.nameLower !== current.nameLower) {
                    const clash = await this.db.collection(this.collection)
                        .where('nameLower', '==', updates.nameLower)
                        .limit(2)
                        .get();
                    if (clash.docs.some(d => d.id !== supplierId)) {
                        throw new ConflictError('Supplier with this name already exists');
                    }
                }
            }

            // After this edit the supplier must still have a valid PIN if it is ETR
            const finalEtr = updates.etrStatus ?? current.etrStatus;
            const finalPin = updates.kraPin !== undefined ? updates.kraPin : current.kraPin;
            if (finalEtr === 'etr' && !finalPin) {
                throw new ValidationError('KRA PIN is required for ETR suppliers');
            }
            if (updates.kraPin) await this._assertKraPinFree(updates.kraPin, supplierId);

            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.db.collection(this.collection).doc(supplierId).update(updates);

            logger.info(`Supplier updated: ${supplierId}`);

            await this._invalidate(supplierId);

            return await this.getSupplierById(supplierId);
        } catch (error) {
            logger.error('Update supplier error:', error);
            throw error;
        }
    }

    /**
     * Delete supplier
     * @param {string} supplierId
     * @returns {Promise<void>}
     */
    async deleteSupplier(supplierId) {
        try {
            const doc = await this.db.collection(this.collection).doc(supplierId).get();

            if (!doc.exists) {
                throw new NotFoundError('Supplier');
            }

            // Check if supplier has invoices
            const invoices = await this.db.collection('invoices')
                .where('supplierId', '==', supplierId)
                .limit(1)
                .get();

            if (!invoices.empty) {
                // Invoices (and the stock/payments behind them) are accounting records.
                // They keep pointing at this supplier, so it can only be deactivated.
                throw new ConflictError(
                    'This supplier has invoices, so it cannot be deleted. Deactivate it instead - its invoices and history stay intact.'
                );
            }

            await this.db.collection(this.collection).doc(supplierId).delete();

            logger.info(`Supplier deleted: ${supplierId}`);

            await this._invalidate(supplierId);
        } catch (error) {
            logger.error('Delete supplier error:', error);
            throw error;
        }
    }

    /**
     * Rebuild a supplier's totals from its invoices (voided invoices are ignored).
     * Totals are derived numbers, so this is how a wrong figure (e.g. a stray 60M) is corrected:
     * fix or reverse the bad invoice, then recalculate. Admin only (see routes).
     * @param {string} supplierId
     * @returns {Promise<Object>} the new totals
     */
    async recalculateFinancials(supplierId) {
        const ref = this.db.collection(this.collection).doc(supplierId);
        const doc = await ref.get();
        if (!doc.exists) throw new NotFoundError('Supplier');

        const snap = await this.db.collection('invoices').where('supplierId', '==', supplierId).get();
        let totalPurchases = 0;
        let totalPaid = 0;
        snap.docs.forEach(d => {
            const inv = d.data();
            if (inv.status === 'voided') return;
            totalPurchases += inv.totalAmount || 0;
            totalPaid += inv.amountPaid || 0;
        });

        const totals = {
            totalPurchases,
            totalPaid,
            outstandingBalance: totalPurchases - totalPaid
        };
        await ref.update({ ...totals, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        await this._invalidate(supplierId);

        logger.info(`Supplier financials recalculated: ${supplierId}`, totals);
        return { id: supplierId, invoices: snap.size, ...totals };
    }

    /**
     * Update supplier financial stats
     * @param {string} supplierId
     * @param {number} purchaseAmount
     * @param {number} paidAmount
     * @returns {Promise<void>}
     */
    async updateFinancialStats(supplierId, purchaseAmount, paidAmount = 0) {
        try {
            await this.db.collection(this.collection).doc(supplierId).update({
                totalPurchases: admin.firestore.FieldValue.increment(purchaseAmount),
                totalPaid: admin.firestore.FieldValue.increment(paidAmount),
                outstandingBalance: admin.firestore.FieldValue.increment(purchaseAmount - paidAmount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${supplierId}`);
        } catch (error) {
            logger.error('Update supplier financial stats error:', error);
            throw error;
        }
    }
}

module.exports = new SupplierService();
