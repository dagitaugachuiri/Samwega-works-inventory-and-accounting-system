const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
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
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
            const paginatedCustomers = customers.slice(startIndex, endIndex);

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

    /**
     * Search customers (autocomplete)
     * @param {string} query - Search query
     * @param {number} limit - Max results to return
     * @returns {Promise<Array>}
     */
    async searchCustomers(query, limit = 10) {
        try {
            if (!query || query.length < 2) {
                return [];
            }

            const cacheKey = `${this.cachePrefix}search:${query}:${limit}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const queryLower = query.toLowerCase();

            // Get all customers (consider adding index for better performance)
            const snapshot = await this.db.collection(this.collection).get();
            let customers = serializeDocs(snapshot);

            // Filter by name, store name, or phone
            const results = customers.filter(customer =>
                customer.customerNameLower?.startsWith(queryLower) ||
                customer.storeNameLower?.startsWith(queryLower) ||
                customer.customerPhone?.startsWith(query)
            ).slice(0, limit);

            // Cache for shorter time (1 minute) as this is real-time search
            await cache.set(cacheKey, results, 60);

            return results;
        } catch (error) {
            logger.error('Search customers error:', error);
            throw error;
        }
    }

    /**
     * Update customer
     * @param {string} customerId
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateCustomer(customerId, updateData) {
        try {
            const doc = await this.db.collection(this.collection).doc(customerId).get();

            if (!doc.exists) {
                throw new NotFoundError('Customer');
            }

            const updates = { ...updateData };

            // Update lowercase fields if name or store name is being updated
            if (updateData.customerName) {
                updates.customerNameLower = updateData.customerName.toLowerCase();
            }
            if (updateData.storeName) {
                updates.storeNameLower = updateData.storeName.toLowerCase();
            }

            // Check for phone number conflicts if updating phone
            if (updateData.customerPhone) {
                const existingCustomer = await this.db.collection(this.collection)
                    .where('customerPhone', '==', updateData.customerPhone)
                    .limit(1)
                    .get();

                if (!existingCustomer.empty && existingCustomer.docs[0].id !== customerId) {
                    throw new ConflictError('Customer with this phone number already exists');
                }
            }

            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.db.collection(this.collection).doc(customerId).update(updates);

            logger.info(`Customer updated: ${customerId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${customerId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
            await cache.delPattern(`${this.cachePrefix}search:*`);

            return await this.getCustomerById(customerId);
        } catch (error) {
            logger.error('Update customer error:', error);
            throw error;
        }
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
    async recordPayment(customerId, amount) {
        try {
            const customer = await this.getCustomerById(customerId);

            if (amount > customer.totalDebt) {
                throw new ValidationError('Payment amount exceeds outstanding debt');
            }

            await this.db.collection(this.collection).doc(customerId).update({
                totalDebt: admin.firestore.FieldValue.increment(-amount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`Customer payment recorded: ${customerId}`, { amount });

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${customerId}`);

            return await this.getCustomerById(customerId);
        } catch (error) {
            logger.error('Record customer payment error:', error);
            throw error;
        }
    }
}

module.exports = new CustomerService();
