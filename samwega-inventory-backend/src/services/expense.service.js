const { getFirestore } = require('../config/firebase.config');
const { admin } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { NotFoundError, ValidationError, UnauthorizedError } = require('../utils/errors');
const { serializeDoc, serializeDocs } = require('../utils/serializer');


const CATEGORY_NAMES = {
    fuel: "Fuel",
    maintenance: "Maintenance",
    salaries: "Salaries & Allowances",
    rent: "Rent & Rates",
    utilities: "Utilities (Water/Elec)",
    supplies: "Supplies & Consumables",
    insurance: "Insurance",
    taxes: "Taxes (KRA/VAT)",
    licenses: "Licenses & Permits",
    permits: "Permits",
    marketing: "Marketing & Promo",
    travel: "Travel & Transport",
    meals: "Meals & Entertainment",
    communication: "Communication & Airtime",
    office: "Office Expenses",
    legal: "Legal Fees",
    professional_fees: "Professional Fees",
    bank_charges: "Bank Charges",
    fines: "Fines & Penalties",
    security: "Security",
    equipment: "Equipment & Assets",
    loans: "Loan Repayments",
    other: "Other Expenses"
};

class ExpenseService {
    constructor() {
        this.db = getFirestore();
        this.collection = 'expenses';
        this.cachePrefix = 'expense:';
        this.cacheTTL = 300; // 5 minutes
    }

    canApprove(approverRole, approverId, submitterId, submitterRole) {
    if (approverRole === 'admin') return true;
    if (approverRole === 'accountant') {
        return submitterId !== approverId &&
               submitterRole !== 'accountant' &&
               submitterRole !== 'admin';
    }
    return false;
   }

    /**
     * Generate expense number
     * @returns {Promise<string>}
     */
    async generateExpenseNumber() {
        const year = new Date().getFullYear();
        const snapshot = await this.db.collection(this.collection)
            .where('expenseNumber', '>=', `EXP-${year}-`)
            .where('expenseNumber', '<', `EXP-${year + 1}-`)
            .orderBy('expenseNumber', 'desc')
            .limit(1)
            .get();

        let nextNumber = 1;
        if (!snapshot.empty) {
            const lastNumber = snapshot.docs[0].data().expenseNumber;
            const match = lastNumber.match(/EXP-\d{4}-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        return `EXP-${year}-${String(nextNumber).padStart(4, '0')}`;
    }

    /**
     * Create expense
     * @param {Object} expenseData
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async createExpense(expenseData, userId) {
        try {
            const { category, description, amount, currency = 'KES', expenseDate,
                vehicleId, receiptUrl, receiptPublicId, notes = '' } = expenseData;

            // Get user details
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }
            const userData = userDoc.data();

            // Get vehicle details if provided
            let vehicleName = null;
            if (vehicleId) {
                const vehicleDoc = await this.db.collection('vehicles').doc(vehicleId).get();
                if (vehicleDoc.exists) {
                    vehicleName = vehicleDoc.data().vehicleName;
                }
            }

            // Generate expense number
            const expenseNumber = await this.generateExpenseNumber();

            const expense = {
                expenseNumber,
                submittedBy: userId,
                submittedByName: userData.fullName || userData.email,
                submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                category,
                description,
                amount: parseFloat(amount),
                currency,
                expenseDate: new Date(expenseDate),
                vehicleId: vehicleId || null,
                vehicleName,
                receiptUrl: receiptUrl || null,
                receiptPublicId: receiptPublicId || null,
                status: 'pending',
                approvedBy: null,
                approvedByName: null,
                approvedAt: null,
                rejectionReason: null,
                approvalHistory: [
                    {
                        action: 'submitted',
                        by: userId,
                        byName: userData.fullName || userData.email,
                        at: new Date()
                    }
                ],
                notes,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                
            };
             const parsedAmount = parseFloat(amount);
             if (!(parsedAmount > 0)) throw new ValidationError('Amount must be greater than 0');

            const docRef = await this.db.collection(this.collection).add(expense);

            logger.info(`Expense created: ${expenseNumber}`, { id: docRef.id, amount, category });

        

            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);

            return await this.getExpenseById(docRef.id);
        } catch (error) {
            logger.error('Create expense error:', error);
            throw error;
        }
    }

    /**
     * Create multiple expenses at once (Batch)
     * @param {Object} batchData { expenses: [], expenseDate }
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async createExpenseBatch(batchData, userId) {
        try {
            const { expenses, expenseDate } = batchData;
            
            // Get user details
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                throw new NotFoundError('User');
            }
            const userData = userDoc.data();
            const userName = userData.fullName || userData.email;

            const results = [];
            let totalAmount = 0;
            
            // Start a Firestore batch
            const batch = this.db.batch();
            
            // Get starting expense number
            let lastExpNum = await this.generateExpenseNumber();
            let baseNum = parseInt(lastExpNum.split('-')[2]);
            const year = new Date().getFullYear();

            const amount = parseFloat(item.amount);
            if (!(amount > 0)) throw new ValidationError(`Row ${i + 1}: amount must be greater than 0`);

            for (let i = 0; i < expenses.length; i++) {
                const item = expenses[i];
                const expNum = `EXP-${year}-${String(baseNum + i).padStart(4, '0')}`;
                
                let vehicleName = null;
                if (item.vehicleId) {
                    const vehicleDoc = await this.db.collection('vehicles').doc(item.vehicleId).get();
                    if (vehicleDoc.exists) {
                        vehicleName = vehicleDoc.data().vehicleName;
                    }
                }

                const expense = {
                    expenseNumber: expNum,
                    submittedBy: userId,
                    submittedByName: userName,
                    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                    category: item.category,
                    description: item.description,
                    amount: parsedAmount,
                    currency: item.currency || 'KES',
                    expenseDate: new Date(expenseDate || item.expenseDate),
                    vehicleId: item.vehicleId || null,
                    vehicleName,
                    status: 'pending',
                    approvalHistory: [
                        {
                            action: 'submitted',
                            by: userId,
                            byName: userName,
                            at: new Date()
                        }
                    ],
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                const parsedAmount = parseFloat(amount);
                if (!(parsedAmount > 0)) throw new ValidationError('Amount must be greater than 0');

                const docRef = this.db.collection(this.collection).doc();
                batch.set(docRef, expense);
                
                results.push({ id: docRef.id, ...expense });
                totalAmount += expense.amount;
            }

            await batch.commit();
            logger.info(`Batch expenses created by ${userName}: ${results.length} items, Total: ${totalAmount}`);



            // Invalidate cache
            await cache.delPattern(`${this.cachePrefix}*`);

            return results;
        } catch (error) {
            logger.error('Create expense batch error:', error);
            throw error;
        }
    }

    /**
     * Get expense by ID
     * @param {string} expenseId
     * @returns {Promise<Object>}
     */
    async getExpenseById(expenseId) {
        try {
            const cacheKey = `${this.cachePrefix}${expenseId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const doc = await this.db.collection(this.collection).doc(expenseId).get();

            if (!doc.exists) {
                throw new NotFoundError('Expense');
            }

            const expense = serializeDoc(doc);

            // Cache the result
            await cache.set(cacheKey, expense, this.cacheTTL);

            return expense;
        } catch (error) {
            logger.error('Get expense by ID error:', error);
            throw error;
        }
    }

    /**
     * Get all expenses with filters
     * @param {Object} filters
     * @param {string} userId
     * @param {string} userRole
     * @returns {Promise<Object>}
     */
    async getAllExpenses(filters = {}, userId, userRole) {
        try {
            logger.info('[ExpenseService] getAllExpenses called', { filters, userId, userRole });

            const {
                category,
                status,
                submittedBy,
                vehicleId,
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

            // Apply role-based filtering -  only query by vehicleId to avoid composite indexes
            if (vehicleId) {
                logger.info('[ExpenseService] Querying by vehicleId:', vehicleId);
                query = query.where('vehicleId', '==', vehicleId);
            } else if (userRole !== 'admin' && userRole !== 'store_manager' && userRole !== 'accountant') {
                logger.info('[ExpenseService] Querying by submittedBy (sales rep):', userId);
                query = query.where('submittedBy', '==', userId);
            } else if (submittedBy) {
                logger.info('[ExpenseService] Querying by submittedBy (admin):', submittedBy);
                query = query.where('submittedBy', '==', submittedBy);
            }

            logger.info('[ExpenseService] Executing Firestore query...');
            const snapshot = await query.get();
            logger.info('[ExpenseService] Query complete, docs found:', snapshot.size);

            let expenses = [];
            try {
                logger.info('[ExpenseService] Starting serialization...');
                expenses = serializeDocs(snapshot);
                logger.info('[ExpenseService] Serialization complete, count:', expenses.length);
            } catch (serError) {
                logger.error('[ExpenseService] Serialization error:', serError);
                throw serError;
            }
            if (!['admin', 'store_manager', 'accountant'].includes(userRole)) {
            expenses = expenses.filter(e => e.submittedBy === userId);
            }

            // Apply additional filters client-side to avoid Firestore composite index requirements
            if (category) {
                expenses = expenses.filter(exp => exp.category === category);
            }
            if (status) {
                expenses = expenses.filter(exp => exp.status === status);
            }
            if (startDate) {
                const start = new Date(startDate);
                expenses = expenses.filter(exp => new Date(exp.expenseDate) >= start);
            }
            if (endDate) {
                const end = new Date(endDate);
                expenses = expenses.filter(exp => new Date(exp.expenseDate) <= end);
            }

            // Apply amount filters (client-side)
            if (minAmount !== undefined) {
                expenses = expenses.filter(exp => exp.amount >= minAmount);
            }
            if (maxAmount !== undefined) {
                expenses = expenses.filter(exp => exp.amount <= maxAmount);
            }

            // Sort expenses
            expenses.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];

                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            // Pagination
            const total = expenses.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedExpenses = expenses.slice(startIndex, endIndex);

            const roleMap = new Map();
            const ids = [...new Set(paginatedExpenses.map(e => e.submittedBy).filter(Boolean))];
            if (ids.length) {
            const docs = await this.db.getAll(...ids.map(id => this.db.collection('users').doc(id)));
            docs.forEach(d => { if (d.exists) roleMap.set(d.id, d.data().role); });
            }
           const expensesWithFlags = paginatedExpenses.map(e => ({
           ...e,
           canApprove: e.status === 'pending' &&
           this.canApprove(userRole, userId, e.submittedBy, roleMap.get(e.submittedBy))
          }));

            console.log('[ExpenseService] Building result object...');
            const result = {
                expenses: expensesWithFlags,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: endIndex < total,
                    hasPrevPage: page > 1
                }
            };

            console.log('[ExpenseService] Setting cache...');
            // Cache the result
            await cache.set(cacheKey, result, this.cacheTTL);

            console.log('[ExpenseService] Returning result, expense count:', paginatedExpenses.length);
            return result;
        } catch (error) {
            logger.error('Get all expenses error:', error);
            throw error;
        }
    }

    /**
     * Update expense (only pending expenses)
     * @param {string} expenseId
     * @param {Object} updateData
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async updateExpense(expenseId, updateData, userId) {
        try {
            const expense = await this.getExpenseById(expenseId);

            if (expense.status !== 'pending') {
                throw new ValidationError('Only pending expenses can be updated');
            }

            if (expense.submittedBy !== userId) {
                throw new UnauthorizedError('You can only update your own expenses');
            }

            const updates = { ...updateData };
            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.db.collection(this.collection).doc(expenseId).update(updates);

            logger.info(`Expense updated: ${expenseId}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${expenseId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
            await cache.delPattern(`${this.cachePrefix}category:*`);

            return await this.getExpenseById(expenseId);
        } catch (error) {
            logger.error('Update expense error:', error);
            throw error;
        }
    }

    /**
     * Approve or reject expense
     * @param {string} expenseId
     * @param {boolean} approved
     * @param {string} approverId
     * @param {string} rejectionReason
     * @param {string} notes
     * @returns {Promise<Object>}
     */
    async approveExpense(expenseId, approved, approverId, rejectionReason = '', notes = '') {
        try {
            const expense = await this.getExpenseById(expenseId);

            if (expense.status !== 'pending') {
                throw new ValidationError(`Expense is already ${expense.status}`);
            }

            // Get approver details
            const approverDoc = await this.db.collection('users').doc(approverId).get();
            if (!approverDoc.exists) {
                throw new NotFoundError('Approver');
            }
            const approverData = approverDoc.data();
            if (!['admin', 'accountant'].includes(approverData.role)) {
            throw new UnauthorizedError('Only admins or accountants can approve expenses');
            }
            if (expense.submittedBy === approverId && approverData.role !== 'admin') {
            throw new UnauthorizedError('You cannot approve your own expense');
           }

            const approverName = approverData.fullName || approverData.email;
            const submitterDoc = await this.db.collection('users').doc(expense.submittedBy).get();
            const submitterRole = submitterDoc.exists ? submitterDoc.data().role : null;

            if (!this.canApprove(approverData.role, approverId, expense.submittedBy, submitterRole)) {
            throw new UnauthorizedError('You are not allowed to approve this expense');
            }


            // Update expense
            const updates = {
                status: approved ? 'approved' : 'rejected',
                approvedBy: approverId,
                approvedByName: approverName,
                approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                rejectionReason: approved ? null : rejectionReason,
                approvalNotes: notes,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                approvalHistory: admin.firestore.FieldValue.arrayUnion({
                    action: approved ? 'approved' : 'rejected',
                    by: approverId,
                    byName: approverName,
                    reason: rejectionReason || null,
                    notes: notes || null,
                    at: new Date()
                })
            };

            await this.db.collection(this.collection).doc(expenseId).update(updates);

            logger.info(`Expense ${approved ? 'approved' : 'rejected'}: ${expense.expenseNumber}`, { approverId });



            // Invalidate cache
            await cache.del(`${this.cachePrefix}${expenseId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
            await cache.delPattern(`${this.cachePrefix}category:*`);

            return await this.getExpenseById(expenseId);
        } catch (error) {
            logger.error('Approve expense error:', error);
            throw error;
        }
    }

    /**
     * Delete expense (only pending expenses)
     * @param {string} expenseId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async deleteExpense(expenseId, userId) {
        try {
            const expense = await this.getExpenseById(expenseId);

            if (expense.status !== 'pending') {
                throw new ValidationError('Only pending expenses can be deleted');
            }

            if (expense.submittedBy !== userId) {
                throw new UnauthorizedError('You can only delete your own expenses');
            }

            await this.db.collection(this.collection).doc(expenseId).delete();

            logger.info(`Expense deleted: ${expense.expenseNumber}`);

            // Invalidate cache
            await cache.del(`${this.cachePrefix}${expenseId}`);
            await cache.delPattern(`${this.cachePrefix}list:*`);
            await cache.delPattern(`${this.cachePrefix}category:*`);
        } catch (error) {
            logger.error('Delete expense error:', error);
            throw error;
        }
    }

    async getExpensesByCategory(startDate, endDate, vehicleId = null, userId = null, userRole = null) {
    try {
        const privileged = ['admin', 'store_manager', 'accountant'].includes(userRole);
        const cacheKey = `${this.cachePrefix}category:${startDate}:${endDate}:${vehicleId || 'all'}:${privileged ? 'all' : userId}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        let query = this.db.collection(this.collection);
        if (vehicleId) {
            query = query.where('vehicleId', '==', vehicleId);
        }

        const snapshot = await query.get();
        let expenses = serializeDocs(snapshot);

        if (!privileged) {
            expenses = expenses.filter(e => e.submittedBy === userId);
        }
        if (startDate) {
            const start = new Date(startDate);
            expenses = expenses.filter(exp => new Date(exp.expenseDate) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            expenses = expenses.filter(exp => new Date(exp.expenseDate) <= end);
        }
        expenses = expenses.filter(e => e.status !== 'rejected');

        const categoryMap = {};
        expenses.forEach(expense => {
            if (!categoryMap[expense.category]) {
                categoryMap[expense.category] = { category: expense.category, totalAmount: 0, count: 0 };
            }
            categoryMap[expense.category].totalAmount += expense.amount;
            categoryMap[expense.category].count += 1;
        });

        const summary = {
            categories: Object.values(categoryMap),
            totalExpenses: expenses.reduce((sum, exp) => sum + exp.amount, 0),
            totalCount: expenses.length,
            startDate,
            endDate
        };

        await cache.set(cacheKey, summary, this.cacheTTL);
        return summary;
    } catch (error) {
        logger.error('Get expenses by category error:', error);
        throw error;
    }
}


}

module.exports = new ExpenseService();
