const { getFirestore } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { serializeDocs } = require('../utils/serializer');

class ReportsService {
    constructor() {
        this.db = getFirestore();
        this.cachePrefix = 'report:';
        this.cacheTTL = 300; // 5 minutes
    }

    /**
     * Get sales report
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getSalesReport(filters = {}) {
        try {
            const { vehicleId, salesRepId, startDate, endDate, groupBy = 'day' } = filters;

            const cacheKey = `${this.cachePrefix}sales:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('sales').where('status', '==', 'completed');

            // Apply filters
            if (vehicleId) {
                query = query.where('vehicleId', '==', vehicleId);
            }
            if (salesRepId) {
                query = query.where('salesRepId', '==', salesRepId);
            }
            if (startDate) {
                query = query.where('saleDate', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('saleDate', '<=', new Date(endDate));
            }

            const snapshot = await query.get();
            const sales = serializeDocs(snapshot);

            // Calculate summary statistics
            const summary = {
                totalSales: sales.reduce((sum, s) => sum + s.grandTotal, 0),
                totalTransactions: sales.length,
                totalProfit: sales.reduce((sum, s) => {
                    const saleProfit = s.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0);
                    return sum + saleProfit;
                }, 0),
                averageSaleValue: sales.length > 0 ? sales.reduce((sum, s) => sum + s.grandTotal, 0) / sales.length : 0,

                // Payment method breakdown
                paymentMethods: {
                    cash: sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.grandTotal, 0),
                    mpesa: sales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + s.grandTotal, 0),
                    bank: sales.filter(s => s.paymentMethod === 'bank').reduce((sum, s) => sum + s.grandTotal, 0),
                    credit: sales.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.grandTotal, 0),
                    mixed: sales.filter(s => s.paymentMethod === 'mixed').reduce((sum, s) => sum + s.grandTotal, 0)
                }
            };

            const report = {
                filters,
                summary,
                sales: groupBy ? this.groupSales(sales, groupBy) : sales
            };

            // Cache the result
            await cache.set(cacheKey, report, this.cacheTTL);

            return report;
        } catch (error) {
            logger.error('Get sales report error:', error);
            throw error;
        }
    }

    /**
     * Get product performance report
     * @param {string} startDate
     * @param {string} endDate
     * @param {number} limit
     * @returns {Promise<Object>}
     */
    async getProductPerformance(startDate, endDate, limit = 20) {
        try {
            const cacheKey = `${this.cachePrefix}products:${startDate}:${endDate}:${limit}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('sales').where('status', '==', 'completed');

            if (startDate) {
                query = query.where('saleDate', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('saleDate', '<=', new Date(endDate));
            }

            const snapshot = await query.get();
            const sales = serializeDocs(snapshot);

            // Aggregate product data
            const productMap = {};
            sales.forEach(sale => {
                sale.items.forEach(item => {
                    if (!productMap[item.inventoryId]) {
                        productMap[item.inventoryId] = {
                            inventoryId: item.inventoryId,
                            productName: item.productName,
                            totalQuantitySold: 0,
                            totalRevenue: 0,
                            totalProfit: 0,
                            transactionCount: 0
                        };
                    }

                    productMap[item.inventoryId].totalQuantitySold += item.quantity;
                    productMap[item.inventoryId].totalRevenue += item.totalPrice;
                    productMap[item.inventoryId].totalProfit += (item.profit || 0);
                    productMap[item.inventoryId].transactionCount += 1;
                });
            });

            // Convert to array and sort by revenue
            const products = Object.values(productMap)
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, limit);

            const report = {
                startDate,
                endDate,
                topProducts: products,
                summary: {
                    totalProducts: Object.keys(productMap).length,
                    totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
                    totalProfit: products.reduce((sum, p) => sum + p.totalProfit, 0)
                }
            };

            // Cache the result
            await cache.set(cacheKey, report, this.cacheTTL);

            return report;
        } catch (error) {
            logger.error('Get product performance error:', error);
            throw error;
        }
    }

    /**
     * Get sales rep performance report
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async getSalesRepPerformance(startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}salesreps:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('sales').where('status', '==', 'completed');

            if (startDate) {
                query = query.where('saleDate', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('saleDate', '<=', new Date(endDate));
            }

            const snapshot = await query.get();
            const sales = serializeDocs(snapshot);

            // Aggregate sales rep data
            const repMap = {};
            sales.forEach(sale => {
                if (!repMap[sale.salesRepId]) {
                    repMap[sale.salesRepId] = {
                        salesRepId: sale.salesRepId,
                        salesRepName: sale.salesRepName,
                        vehicleId: sale.vehicleId,
                        vehicleName: sale.vehicleName,
                        totalSales: 0,
                        totalTransactions: 0,
                        totalProfit: 0,
                        averageSaleValue: 0
                    };
                }

                const saleProfit = sale.items.reduce((sum, item) => sum + (item.profit || 0), 0);
                repMap[sale.salesRepId].totalSales += sale.grandTotal;
                repMap[sale.salesRepId].totalTransactions += 1;
                repMap[sale.salesRepId].totalProfit += saleProfit;
            });

            // Calculate averages and sort
            const salesReps = Object.values(repMap).map(rep => ({
                ...rep,
                averageSaleValue: rep.totalTransactions > 0 ? rep.totalSales / rep.totalTransactions : 0
            })).sort((a, b) => b.totalSales - a.totalSales);

            const report = {
                startDate,
                endDate,
                salesReps,
                summary: {
                    totalSalesReps: salesReps.length,
                    totalRevenue: salesReps.reduce((sum, r) => sum + r.totalSales, 0),
                    totalProfit: salesReps.reduce((sum, r) => sum + r.totalProfit, 0),
                    totalTransactions: salesReps.reduce((sum, r) => sum + r.totalTransactions, 0)
                }
            };

            // Cache the result
            await cache.set(cacheKey, report, this.cacheTTL);

            return report;
        } catch (error) {
            logger.error('Get sales rep performance error:', error);
            throw error;
        }
    }

    /**
     * Get payment method report
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async getPaymentMethodReport(startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}payments:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('sales').where('status', '==', 'completed');

            if (startDate) {
                query = query.where('saleDate', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('saleDate', '<=', new Date(endDate));
            }

            const snapshot = await query.get();
            const sales = serializeDocs(snapshot);

            // Aggregate payment method data
            const paymentMethods = {
                cash: { count: 0, total: 0 },
                mpesa: { count: 0, total: 0 },
                bank: { count: 0, total: 0 },
                credit: { count: 0, total: 0 },
                mixed: { count: 0, total: 0 }
            };

            sales.forEach(sale => {
                if (paymentMethods[sale.paymentMethod]) {
                    paymentMethods[sale.paymentMethod].count += 1;
                    paymentMethods[sale.paymentMethod].total += sale.grandTotal;
                }
            });

            const totalSales = sales.reduce((sum, s) => sum + s.grandTotal, 0);

            // Calculate percentages
            Object.keys(paymentMethods).forEach(method => {
                paymentMethods[method].percentage = totalSales > 0
                    ? (paymentMethods[method].total / totalSales) * 100
                    : 0;
            });

            const report = {
                startDate,
                endDate,
                paymentMethods,
                summary: {
                    totalTransactions: sales.length,
                    totalRevenue: totalSales,
                    creditOutstanding: paymentMethods.credit.total
                }
            };

            // Cache the result
            await cache.set(cacheKey, report, this.cacheTTL);

            return report;
        } catch (error) {
            logger.error('Get payment method report error:', error);
            throw error;
        }
    }

    /**
     * Generate Profit & Loss Report
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async generateProfitLossReport(startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}pl:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get sales data
            let salesQuery = this.db.collection('sales').where('status', '==', 'completed');
            if (startDate) salesQuery = salesQuery.where('saleDate', '>=', new Date(startDate));
            if (endDate) salesQuery = salesQuery.where('saleDate', '<=', new Date(endDate));

            const salesSnapshot = await salesQuery.get();
            const sales = serializeDocs(salesSnapshot);

            const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
            const totalProfit = sales.reduce((sum, s) => {
                return sum + s.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0);
            }, 0);

            // Get expenses data
            let expensesQuery = this.db.collection('expenses').where('status', '==', 'approved');
            if (startDate) expensesQuery = expensesQuery.where('expenseDate', '>=', new Date(startDate));
            if (endDate) expensesQuery = expensesQuery.where('expenseDate', '<=', new Date(endDate));

            const expensesSnapshot = await expensesQuery.get();
            const expenses = serializeDocs(expensesSnapshot);

            // Aggregate expenses by category
            const expensesByCategory = {};
            expenses.forEach(expense => {
                if (!expensesByCategory[expense.category]) {
                    expensesByCategory[expense.category] = 0;
                }
                expensesByCategory[expense.category] += expense.amount;
            });

            const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
            const netProfit = totalRevenue - totalExpenses;
            const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

            const report = {
                reportType: 'profit-loss',
                period: { startDate, endDate },
                revenue: {
                    sales: totalRevenue,
                    total: totalRevenue
                },
                expenses: {
                    ...expensesByCategory,
                    total: totalExpenses
                },
                netProfit,
                profitMargin,
                grossProfit: totalProfit
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate profit & loss report error:', error);
            throw error;
        }
    }

    /**
     * Generate Inventory Report
     * @returns {Promise<Object>}
     */
    async generateInventoryReport() {
        try {
            const cacheKey = `${this.cachePrefix}inventory`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const snapshot = await this.db.collection('inventory')
                .where('isActive', '==', true)
                .get();
            const inventory = serializeDocs(snapshot);

            const totalItems = inventory.length;
            const totalValue = inventory.reduce((sum, item) =>
                sum + (item.stock * (item.sellingPrice || 0)), 0
            );

            const lowStockItems = inventory.filter(item =>
                item.stock <= (item.reorderLevel || 10)
            );

            const outOfStockItems = inventory.filter(item => item.stock === 0);

            // Group by category
            const byCategory = {};
            inventory.forEach(item => {
                const category = item.category || 'Uncategorized';
                if (!byCategory[category]) {
                    byCategory[category] = {
                        items: 0,
                        totalStock: 0,
                        totalValue: 0
                    };
                }
                byCategory[category].items += 1;
                byCategory[category].totalStock += item.stock;
                byCategory[category].totalValue += item.stock * (item.sellingPrice || 0);
            });

            const report = {
                reportType: 'inventory',
                generatedAt: new Date(),
                summary: {
                    totalItems,
                    totalValue,
                    lowStockCount: lowStockItems.length,
                    outOfStockCount: outOfStockItems.length
                },
                lowStockItems: lowStockItems.map(item => ({
                    id: item.id,
                    productName: item.productName,
                    stock: item.stock,
                    reorderLevel: item.reorderLevel || 10
                })),
                byCategory: Object.entries(byCategory).map(([category, data]) => ({
                    category,
                    ...data
                }))
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate inventory report error:', error);
            throw error;
        }
    }

    /**
     * Generate Comprehensive Sales Report
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async generateComprehensiveSalesReport(startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}comprehensive:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get all reports
            const [salesReport, productReport, salesRepReport, paymentReport] = await Promise.all([
                this.getSalesReport({ startDate, endDate }),
                this.getProductPerformance(startDate, endDate),
                this.getSalesRepPerformance(startDate, endDate),
                this.getPaymentMethodReport(startDate, endDate)
            ]);

            const report = {
                reportType: 'comprehensive-sales',
                startDate,
                endDate,
                summary: salesReport.summary,
                topProducts: productReport.topProducts,
                salesRepPerformance: salesRepReport.salesReps,
                paymentMethods: paymentReport.paymentMethods,
                trend: salesReport.sales
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate comprehensive sales report error:', error);
            throw error;
        }
    }

    /**
     * Generate Expense Report
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async generateExpenseReport(startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}expenses:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('expenses');
            if (startDate) query = query.where('expenseDate', '>=', new Date(startDate));
            if (endDate) query = query.where('expenseDate', '<=', new Date(endDate));

            const snapshot = await query.get();
            const expenses = serializeDocs(snapshot);

            const approved = expenses.filter(e => e.status === 'approved');
            const pending = expenses.filter(e => e.status === 'pending');
            const rejected = expenses.filter(e => e.status === 'rejected');

            // By category
            const byCategory = {};
            approved.forEach(expense => {
                if (!byCategory[expense.category]) {
                    byCategory[expense.category] = {
                        category: expense.category,
                        totalAmount: 0,
                        count: 0
                    };
                }
                byCategory[expense.category].totalAmount += expense.amount;
                byCategory[expense.category].count += 1;
            });

            const report = {
                reportType: 'expense',
                period: { startDate, endDate },
                summary: {
                    totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
                    approvedExpenses: approved.reduce((sum, e) => sum + e.amount, 0),
                    pendingExpenses: pending.reduce((sum, e) => sum + e.amount, 0),
                    rejectedExpenses: rejected.reduce((sum, e) => sum + e.amount, 0)
                },
                byCategory: Object.values(byCategory)
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate expense report error:', error);
            throw error;
        }
    }

    /**
     * Group sales by time period
     * @param {Array} sales
     * @param {string} groupBy - 'day', 'week', 'month'
     * @returns {Array}
     */
    groupSales(sales, groupBy) {
        const grouped = {};

        sales.forEach(sale => {
            const date = new Date(sale.saleDate);
            let key;

            if (groupBy === 'day') {
                key = date.toISOString().split('T')[0];
            } else if (groupBy === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
            } else if (groupBy === 'month') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!grouped[key]) {
                grouped[key] = {
                    period: key,
                    sales: [],
                    totalSales: 0,
                    totalTransactions: 0
                };
            }

            grouped[key].sales.push(sale);
            grouped[key].totalSales += sale.grandTotal;
            grouped[key].totalTransactions += 1;
        });

        return Object.values(grouped).sort((a, b) => b.period.localeCompare(a.period));
    }

    /**
     * Generate Credit Sales & Debts Report
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async generateCreditSalesReport(startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}credit:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('sales')
                .where('paymentMethod', '==', 'credit');

            if (startDate) query = query.where('saleDate', '>=', new Date(startDate));
            if (endDate) query = query.where('saleDate', '<=', new Date(endDate));

            const snapshot = await query.get();
            const creditSales = serializeDocs(snapshot);

            // Calculate totals
            const totalCredit = creditSales.reduce((sum, s) => sum + s.grandTotal, 0);
            const paidSales = creditSales.filter(s => s.paymentStatus === 'paid');
            const totalPaid = paidSales.reduce((sum, s) => sum + s.grandTotal, 0);
            const outstanding = totalCredit - totalPaid;

            // Group by customer
            const customerMap = {};
            creditSales.forEach(sale => {
                const key = sale.customerPhone || sale.customerName || 'Unknown';
                if (!customerMap[key]) {
                    customerMap[key] = {
                        customerName: sale.customerName,
                        customerPhone: sale.customerPhone,
                        customerEmail: sale.customerEmail,
                        totalCredit: 0,
                        totalPaid: 0,
                        outstanding: 0,
                        transactions: 0
                    };
                }
                customerMap[key].totalCredit += sale.grandTotal;
                if (sale.paymentStatus === 'paid') {
                    customerMap[key].totalPaid += sale.grandTotal;
                }
                customerMap[key].outstanding = customerMap[key].totalCredit - customerMap[key].totalPaid;
                customerMap[key].transactions += 1;
            });

            // Aging analysis
            const now = new Date();
            const aging = {
                current: 0,      // 0-30 days
                days31to60: 0,   // 31-60 days
                days61to90: 0,   // 61-90 days
                over90: 0        // 90+ days
            };

            creditSales.filter(s => s.paymentStatus !== 'paid').forEach(sale => {
                const saleDate = new Date(sale.saleDate);
                const daysDiff = Math.floor((now - saleDate) / (1000 * 60 * 60 * 24));

                if (daysDiff <= 30) aging.current += sale.grandTotal;
                else if (daysDiff <= 60) aging.days31to60 += sale.grandTotal;
                else if (daysDiff <= 90) aging.days61to90 += sale.grandTotal;
                else aging.over90 += sale.grandTotal;
            });

            const report = {
                reportType: 'credit-sales',
                period: { startDate, endDate },
                summary: {
                    totalCredit,
                    totalPaid,
                    outstanding,
                    collectionRate: totalCredit > 0 ? (totalPaid / totalCredit) * 100 : 0,
                    totalCustomers: Object.keys(customerMap).length
                },
                aging,
                customers: Object.values(customerMap).sort((a, b) => b.outstanding - a.outstanding)
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate credit sales report error:', error);
            throw error;
        }
    }

    /**
     * Generate Customer Sales Report
     * @param {string} customerPhone
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async generateCustomerSalesReport(customerPhone, startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}customer:${customerPhone}:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('sales')
                .where('customerPhone', '==', customerPhone)
                .where('status', '==', 'completed');

            if (startDate) query = query.where('saleDate', '>=', new Date(startDate));
            if (endDate) query = query.where('saleDate', '<=', new Date(endDate));

            const snapshot = await query.get();
            const sales = serializeDocs(snapshot);

            const totalPurchases = sales.reduce((sum, s) => sum + s.grandTotal, 0);
            const creditSales = sales.filter(s => s.paymentMethod === 'credit');
            const totalCredit = creditSales.reduce((sum, s) => sum + s.grandTotal, 0);
            const paidCredit = creditSales.filter(s => s.paymentStatus === 'paid')
                .reduce((sum, s) => sum + s.grandTotal, 0);

            const report = {
                reportType: 'customer-sales',
                period: { startDate, endDate },
                customer: sales.length > 0 ? {
                    name: sales[0].customerName,
                    phone: sales[0].customerPhone,
                    email: sales[0].customerEmail,
                    idNumber: sales[0].customerIdNumber
                } : null,
                summary: {
                    totalPurchases,
                    totalTransactions: sales.length,
                    averagePurchase: sales.length > 0 ? totalPurchases / sales.length : 0,
                    totalCredit,
                    outstandingCredit: totalCredit - paidCredit
                },
                transactions: sales.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate))
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate customer sales report error:', error);
            throw error;
        }
    }

    /**
     * Generate Trip Sales Report
     * @param {string} vehicleId
     * @param {string} tripDate
     * @returns {Promise<Object>}
     */
    async generateTripSalesReport(vehicleId, tripDate) {
        try {
            const cacheKey = `${this.cachePrefix}trip:${vehicleId}:${tripDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get vehicle details
            const vehicleDoc = await this.db.collection('vehicles').doc(vehicleId).get();
            if (!vehicleDoc.exists) {
                throw new Error('Vehicle not found');
            }
            const vehicle = vehicleDoc.data();

            // Get sales for the trip date
            const startOfDay = new Date(tripDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(tripDate);
            endOfDay.setHours(23, 59, 59, 999);

            const salesSnapshot = await this.db.collection('sales')
                .where('vehicleId', '==', vehicleId)
                .where('status', '==', 'completed')
                .where('saleDate', '>=', startOfDay)
                .where('saleDate', '<=', endOfDay)
                .get();

            const sales = serializeDocs(salesSnapshot);

            // Calculate totals
            const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
            const totalProfit = sales.reduce((sum, s) => {
                return sum + s.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0);
            }, 0);

            // Payment breakdown
            const cashCollected = sales.filter(s => s.paymentMethod === 'cash' || s.paymentMethod === 'mpesa' || s.paymentMethod === 'bank')
                .reduce((sum, s) => sum + s.grandTotal, 0);

            // Extract route from locations
            const locations = sales.filter(s => s.location).map(s => ({
                latitude: s.location.latitude,
                longitude: s.location.longitude,
                saleAmount: s.grandTotal,
                time: s.saleDate
            }));

            const report = {
                reportType: 'trip-sales',
                tripDate,
                vehicle: {
                    id: vehicleId,
                    name: vehicle.vehicleName,
                    registrationNumber: vehicle.registrationNumber
                },
                summary: {
                    totalRevenue,
                    totalProfit,
                    totalTransactions: sales.length,
                    cashCollected,
                    creditSales: totalRevenue - cashCollected,
                    averageSaleValue: sales.length > 0 ? totalRevenue / sales.length : 0
                },
                sales: sales.sort((a, b) => new Date(a.saleDate) - new Date(b.saleDate)),
                route: locations
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate trip sales report error:', error);
            throw error;
        }
    }

    /**
     * Generate Vehicle Trip History
     * @param {string} vehicleId
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async generateVehicleTripHistory(vehicleId, startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}trip-history:${vehicleId}:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get vehicle details
            const vehicleDoc = await this.db.collection('vehicles').doc(vehicleId).get();
            if (!vehicleDoc.exists) {
                throw new Error('Vehicle not found');
            }
            const vehicle = vehicleDoc.data();

            // Get all sales in date range
            let query = this.db.collection('sales')
                .where('vehicleId', '==', vehicleId)
                .where('status', '==', 'completed');

            if (startDate) query = query.where('saleDate', '>=', new Date(startDate));
            if (endDate) query = query.where('saleDate', '<=', new Date(endDate));

            const snapshot = await query.get();
            const sales = serializeDocs(snapshot);

            // Group by date (trip)
            const tripMap = {};
            sales.forEach(sale => {
                const tripDate = new Date(sale.saleDate).toISOString().split('T')[0];
                if (!tripMap[tripDate]) {
                    tripMap[tripDate] = {
                        date: tripDate,
                        sales: [],
                        revenue: 0,
                        profit: 0,
                        transactions: 0
                    };
                }
                tripMap[tripDate].sales.push(sale);
                tripMap[tripDate].revenue += sale.grandTotal;
                tripMap[tripDate].profit += sale.items.reduce((sum, item) => sum + (item.profit || 0), 0);
                tripMap[tripDate].transactions += 1;
            });

            const trips = Object.values(tripMap).sort((a, b) => b.date.localeCompare(a.date));

            const report = {
                reportType: 'vehicle-trip-history',
                period: { startDate, endDate },
                vehicle: {
                    id: vehicleId,
                    name: vehicle.vehicleName,
                    registrationNumber: vehicle.registrationNumber
                },
                summary: {
                    totalTrips: trips.length,
                    totalRevenue: trips.reduce((sum, t) => sum + t.revenue, 0),
                    totalProfit: trips.reduce((sum, t) => sum + t.profit, 0),
                    averageRevenuePerTrip: trips.length > 0 ? trips.reduce((sum, t) => sum + t.revenue, 0) / trips.length : 0
                },
                trips
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate vehicle trip history error:', error);
            throw error;
        }
    }

    /**
     * Generate Stock Movement Report
     * @param {string} startDate
     * @param {string} endDate
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async generateStockMovementReport(startDate, endDate, filters = {}) {
        try {
            const { productId, transactionType } = filters;
            const cacheKey = `${this.cachePrefix}stock-movement:${startDate}:${endDate}:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get transfers
            let transferQuery = this.db.collection('transfers');
            if (startDate) transferQuery = transferQuery.where('createdAt', '>=', new Date(startDate));
            if (endDate) transferQuery = transferQuery.where('createdAt', '<=', new Date(endDate));

            const transfersSnapshot = await transferQuery.get();
            const transfers = serializeDocs(transfersSnapshot);

            // Get sales
            let salesQuery = this.db.collection('sales').where('status', '==', 'completed');
            if (startDate) salesQuery = salesQuery.where('saleDate', '>=', new Date(startDate));
            if (endDate) salesQuery = salesQuery.where('saleDate', '<=', new Date(endDate));

            const salesSnapshot = await salesQuery.get();
            const sales = serializeDocs(salesSnapshot);

            // Compile movements
            const movements = [];

            // Add transfers
            transfers.forEach(transfer => {
                transfer.items.forEach(item => {
                    if (!productId || item.inventoryId === productId) {
                        movements.push({
                            type: 'transfer',
                            date: transfer.createdAt,
                            product: item.productName,
                            quantity: item.quantity,
                            from: 'Warehouse',
                            to: transfer.vehicleName,
                            reference: transfer.transferNumber,
                            status: transfer.status
                        });
                    }
                });
            });

            // Add sales
            sales.forEach(sale => {
                sale.items.forEach(item => {
                    if (!productId || item.inventoryId === productId) {
                        movements.push({
                            type: 'sale',
                            date: sale.saleDate,
                            product: item.productName,
                            quantity: -item.quantity,
                            from: sale.vehicleName,
                            to: 'Customer',
                            reference: sale.receiptNumber,
                            status: 'completed'
                        });
                    }
                });
            });

            // Sort by date
            movements.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Filter by type if specified
            const filteredMovements = transactionType
                ? movements.filter(m => m.type === transactionType)
                : movements;

            const report = {
                reportType: 'stock-movement',
                period: { startDate, endDate },
                filters,
                summary: {
                    totalMovements: filteredMovements.length,
                    totalIn: movements.filter(m => m.quantity > 0).reduce((sum, m) => sum + m.quantity, 0),
                    totalOut: Math.abs(movements.filter(m => m.quantity < 0).reduce((sum, m) => sum + m.quantity, 0))
                },
                movements: filteredMovements
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate stock movement report error:', error);
            throw error;
        }
    }

    /**
     * Generate Inventory Turnover Report
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async generateInventoryTurnoverReport(startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}turnover:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get current inventory
            const inventorySnapshot = await this.db.collection('inventory')
                .where('isActive', '==', true)
                .get();
            const inventory = serializeDocs(inventorySnapshot);

            // Get sales in period
            let salesQuery = this.db.collection('sales').where('status', '==', 'completed');
            if (startDate) salesQuery = salesQuery.where('saleDate', '>=', new Date(startDate));
            if (endDate) salesQuery = salesQuery.where('saleDate', '<=', new Date(endDate));

            const salesSnapshot = await salesQuery.get();
            const sales = serializeDocs(salesSnapshot);

            // Calculate COGS and turnover by product
            const productTurnover = {};

            sales.forEach(sale => {
                sale.items.forEach(item => {
                    if (!productTurnover[item.inventoryId]) {
                        const invItem = inventory.find(i => i.id === item.inventoryId);
                        productTurnover[item.inventoryId] = {
                            productName: item.productName,
                            quantitySold: 0,
                            cogs: 0,
                            currentStock: invItem?.stock || 0,
                            averageInventory: invItem?.stock || 0,
                            buyingPrice: invItem?.buyingPrice || 0
                        };
                    }
                    productTurnover[item.inventoryId].quantitySold += item.quantity;
                    productTurnover[item.inventoryId].cogs += (item.costPrice || 0) * item.quantity;
                });
            });

            // Calculate turnover ratios
            const daysDiff = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
            const products = Object.values(productTurnover).map(p => {
                const avgInventoryValue = p.averageInventory * p.buyingPrice;
                const turnoverRatio = avgInventoryValue > 0 ? p.cogs / avgInventoryValue : 0;
                const daysInInventory = turnoverRatio > 0 ? daysDiff / turnoverRatio : 0;

                return {
                    ...p,
                    turnoverRatio,
                    daysInInventory,
                    category: daysInInventory < 30 ? 'fast-moving' : daysInInventory < 90 ? 'medium-moving' : 'slow-moving'
                };
            });

            const totalCOGS = products.reduce((sum, p) => sum + p.cogs, 0);
            const totalAvgInventory = products.reduce((sum, p) => sum + (p.averageInventory * p.buyingPrice), 0);
            const overallTurnover = totalAvgInventory > 0 ? totalCOGS / totalAvgInventory : 0;

            const report = {
                reportType: 'inventory-turnover',
                period: { startDate, endDate },
                summary: {
                    overallTurnoverRatio: overallTurnover,
                    averageDaysInInventory: overallTurnover > 0 ? daysDiff / overallTurnover : 0,
                    fastMoving: products.filter(p => p.category === 'fast-moving').length,
                    mediumMoving: products.filter(p => p.category === 'medium-moving').length,
                    slowMoving: products.filter(p => p.category === 'slow-moving').length
                },
                products: products.sort((a, b) => b.turnoverRatio - a.turnoverRatio)
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate inventory turnover report error:', error);
            throw error;
        }
    }

    /**
     * Generate Enhanced Vehicle Inventory Report
     * @param {string} vehicleId
     * @returns {Promise<Object>}
     */
    async generateEnhancedVehicleInventoryReport(vehicleId) {
        try {
            const cacheKey = `${this.cachePrefix}vehicle-inventory:${vehicleId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get vehicle details
            const vehicleDoc = await this.db.collection('vehicles').doc(vehicleId).get();
            if (!vehicleDoc.exists) {
                throw new Error('Vehicle not found');
            }
            const vehicle = vehicleDoc.data();

            // Get vehicle inventory
            const vehicleInventorySnapshot = await this.db.collection('vehicle_inventory')
                .where('vehicleId', '==', vehicleId)
                .get();
            const vehicleInventory = serializeDocs(vehicleInventorySnapshot);

            // Calculate totals
            let totalStock = 0;
            let totalValue = 0;
            const products = [];

            for (const invItem of vehicleInventory) {
                // Get product details
                const productDoc = await this.db.collection('inventory').doc(invItem.inventoryId).get();
                const product = productDoc.exists ? productDoc.data() : {};

                // Calculate stock from layers
                const layers = invItem.layers || [];
                const productStock = layers.reduce((sum, layer) => sum + layer.quantity, 0);
                const productValue = productStock * (product.sellingPrice || 0);

                totalStock += productStock;
                totalValue += productValue;

                products.push({
                    productName: invItem.productName,
                    stock: productStock,
                    value: productValue,
                    sellingPrice: product.sellingPrice || 0,
                    layers: layers.map(l => ({
                        unit: l.unit,
                        quantity: l.quantity,
                        soldStock: l.soldStock || 0
                    }))
                });
            }

            // Get last transfer date
            const lastTransferSnapshot = await this.db.collection('transfers')
                .where('vehicleId', '==', vehicleId)
                .where('status', '==', 'completed')
                .orderBy('completedAt', 'desc')
                .limit(1)
                .get();

            const lastTransferDate = !lastTransferSnapshot.empty
                ? lastTransferSnapshot.docs[0].data().completedAt
                : null;

            // Calculate capacity utilization
            const capacity = vehicle.capacity || 1000; // Default capacity
            const capacityUtilization = (totalStock / capacity) * 100;

            const report = {
                reportType: 'enhanced-vehicle-inventory',
                generatedAt: new Date(),
                vehicle: {
                    id: vehicleId,
                    name: vehicle.vehicleName,
                    registrationNumber: vehicle.registrationNumber,
                    capacity: vehicle.capacity,
                    assignedUser: vehicle.assignedUserName
                },
                summary: {
                    totalProducts: products.length,
                    totalStock,
                    totalValue,
                    capacityUtilization,
                    lastTransferDate
                },
                products: products.sort((a, b) => b.value - a.value)
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate enhanced vehicle inventory report error:', error);
            throw error;
        }
    }

    /**
     * Generate Supplier Performance Report
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Object>}
     */
    async generateSupplierPerformanceReport(startDate, endDate) {
        try {
            const cacheKey = `${this.cachePrefix}supplier:${startDate}:${endDate}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get all inventory items with supplier info
            const inventorySnapshot = await this.db.collection('inventory')
                .where('isActive', '==', true)
                .get();
            const inventory = serializeDocs(inventorySnapshot);

            // Get purchases in date range (from inventory history)
            let purchaseQuery = this.db.collection('inventory_history')
                .where('transactionType', '==', 'purchase');

            if (startDate) purchaseQuery = purchaseQuery.where('createdAt', '>=', new Date(startDate));
            if (endDate) purchaseQuery = purchaseQuery.where('createdAt', '<=', new Date(endDate));

            const purchaseSnapshot = await purchaseQuery.get();
            const purchases = serializeDocs(purchaseSnapshot);

            // Aggregate by supplier
            const supplierMap = {};

            inventory.forEach(item => {
                const supplier = item.supplier || 'Unknown';
                if (!supplierMap[supplier]) {
                    supplierMap[supplier] = {
                        supplierName: supplier,
                        totalProducts: 0,
                        totalPurchases: 0,
                        totalValue: 0,
                        products: []
                    };
                }
                supplierMap[supplier].totalProducts += 1;
                supplierMap[supplier].products.push({
                    productName: item.productName,
                    stock: item.stock,
                    buyingPrice: item.buyingPrice
                });
            });

            // Add purchase data
            purchases.forEach(purchase => {
                const item = inventory.find(i => i.id === purchase.inventoryId);
                if (item) {
                    const supplier = item.supplier || 'Unknown';
                    if (supplierMap[supplier]) {
                        supplierMap[supplier].totalPurchases += purchase.quantity || 0;
                        supplierMap[supplier].totalValue += (purchase.quantity || 0) * (item.buyingPrice || 0);
                    }
                }
            });

            const suppliers = Object.values(supplierMap)
                .sort((a, b) => b.totalValue - a.totalValue);

            const report = {
                reportType: 'supplier-performance',
                period: { startDate, endDate },
                summary: {
                    totalSuppliers: suppliers.length,
                    totalPurchaseValue: suppliers.reduce((sum, s) => sum + s.totalValue, 0),
                    totalProductsSupplied: suppliers.reduce((sum, s) => sum + s.totalProducts, 0)
                },
                suppliers
            };

            await cache.set(cacheKey, report, this.cacheTTL);
            return report;
        } catch (error) {
            logger.error('Generate supplier performance report error:', error);
            throw error;
        }
    }
}

module.exports = new ReportsService();
