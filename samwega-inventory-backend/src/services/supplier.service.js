const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ConflictError } = require('../utils/errors');
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
            // Check if supplier with same name exists
            const existingSupplier = await this.db.collection(this.collection)
                .where('name', '==', supplierData.name)
                .limit(1)
                .get();

            if (!existingSupplier.empty) {
                throw new ConflictError('Supplier with this name already exists');
            }

            const data = {
                ...supplierData,
                nameLower: supplierData.name.toLowerCase(),
                totalPurchases: 0,
                totalPaid: 0,
                outstandingBalance: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection(this.collection).add(data);

            logger.info(`Supplier created: ${supplierData.name}`, { id: docRef.id });

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}list:*`);

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
            suppliers.sort((a, b) => a.name.localeCompare(b.name));

            // Pagination
            const total = suppliers.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedSuppliers = suppliers.slice(startIndex, endIndex);

            const result = {
                suppliers: paginatedSuppliers,
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

            const updates = { ...updateData };
            if (updateData.name) {
                updates.nameLower = updateData.name.toLowerCase();
            }
            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.db.collection(this.collection).doc(supplierId).update(updates);

            logger.info(`Supplier updated: ${supplierId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${supplierId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);

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
                throw new ConflictError('Cannot delete supplier with existing invoices. Deactivate instead.');
            }

            await this.db.collection(this.collection).doc(supplierId).delete();

            logger.info(`Supplier deleted: ${supplierId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${supplierId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
        } catch (error) {
            logger.error('Delete supplier error:', error);
            throw error;
        }
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
