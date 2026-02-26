const { getFirestore } = require('../config/firebase.config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { serializeDocs } = require('../utils/serializer');

class AnalyticsService {
    constructor() {
        this.db = getFirestore();
        this.cachePrefix = 'analytics:';
        this.cacheTTL = 120; // 2 minutes for real-time feel
    }

    /**
     * Get dashboard overview
     * @returns {Promise<Object>}
     */
    async getDashboardOverview() {
        try {
            const cacheKey = `${this.cachePrefix}dashboard:overview`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const today = new Date().toISOString().split('T')[0];
            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));

            // Get today's sales
            const salesSnapshot = await this.db.collection('sales')
                .where('status', '==', 'completed')
                .where('saleDate', '>=', startOfDay)
                .get();
            const todaySales = serializeDocs(salesSnapshot);

            const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.grandTotal, 0);
            const todayTransactions = todaySales.length;
            const todayProfit = todaySales.reduce((sum, sale) => {
                return sum + sale.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0);
            }, 0);

            // Get active vehicles
            const vehiclesSnapshot = await this.db.collection('vehicles')
                .where('isActive', '==', true)
                .get();
            const activeVehicles = vehiclesSnapshot.size;

            // Get low stock items
            const inventorySnapshot = await this.db.collection('inventory')
                .where('isActive', '==', true)
                .get();
            const inventory = serializeDocs(inventorySnapshot);
            const lowStockItems = inventory.filter(item =>
                item.stock <= (item.reorderLevel || 10)
            ).length;

            // Get pending reconciliations
            const reconciliationsSnapshot = await this.db.collection('daily_reconciliations')
                .where('status', '==', 'pending')
                .get();
            const pendingReconciliations = reconciliationsSnapshot.size;

            // Get top products today
            const productMap = {};
            todaySales.forEach(sale => {
                sale.items.forEach(item => {
                    if (!productMap[item.inventoryId]) {
                        productMap[item.inventoryId] = {
                            productName: item.productName,
                            quantity: 0,
                            revenue: 0
                        };
                    }
                    productMap[item.inventoryId].quantity += item.quantity;
                    productMap[item.inventoryId].revenue += item.totalPrice;
                });
            });

            const topProducts = Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            // Get sales trend (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const trendSnapshot = await this.db.collection('sales')
                .where('status', '==', 'completed')
                .where('saleDate', '>=', sevenDaysAgo)
                .get();
            const trendSales = serializeDocs(trendSnapshot);

            const salesByDay = {};
            trendSales.forEach(sale => {
                const date = new Date(sale.saleDate).toISOString().split('T')[0];
                if (!salesByDay[date]) {
                    salesByDay[date] = { revenue: 0, transactions: 0 };
                }
                salesByDay[date].revenue += sale.grandTotal;
                salesByDay[date].transactions += 1;
            });

            const salesTrend = Object.keys(salesByDay)
                .sort()
                .map(date => ({
                    date,
                    revenue: salesByDay[date].revenue,
                    transactions: salesByDay[date].transactions
                }));

            const overview = {
                today: {
                    revenue: todayRevenue,
                    transactions: todayTransactions,
                    profit: todayProfit,
                    averageSaleValue: todayTransactions > 0 ? todayRevenue / todayTransactions : 0
                },
                metrics: {
                    activeVehicles,
                    lowStockItems,
                    pendingReconciliations
                },
                topProducts,
                salesTrend,
                lastUpdated: new Date()
            };

            // Cache for 2 minutes
            await cache.set(cacheKey, overview, this.cacheTTL);

            return overview;
        } catch (error) {
            logger.error('Get dashboard overview error:', error);
            throw error;
        }
    }

    /**
     * Get sales analytics
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getSalesAnalytics(filters = {}) {
        try {
            const { startDate, endDate, groupBy = 'day', vehicleId } = filters;

            const cacheKey = `${this.cachePrefix}sales:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let query = this.db.collection('sales').where('status', '==', 'completed');

            if (startDate) {
                query = query.where('saleDate', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('saleDate', '<=', new Date(endDate));
            }
            if (vehicleId) {
                query = query.where('vehicleId', '==', vehicleId);
            }

            const snapshot = await query.get();
            const sales = serializeDocs(snapshot);

            // Calculate metrics
            const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
            const totalTransactions = sales.length;
            const totalProfit = sales.reduce((sum, s) => {
                return sum + s.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0);
            }, 0);
            const averageSaleValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

            // Payment method distribution
            const paymentMethods = {
                cash: 0,
                mpesa: 0,
                bank: 0,
                credit: 0,
                mixed: 0
            };

            sales.forEach(sale => {
                if (paymentMethods[sale.paymentMethod] !== undefined) {
                    paymentMethods[sale.paymentMethod] += sale.grandTotal;
                }
            });

            // Group sales by time period
            const grouped = this.groupSalesByPeriod(sales, groupBy);

            const analytics = {
                summary: {
                    totalRevenue,
                    totalTransactions,
                    totalProfit,
                    averageSaleValue,
                    profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
                },
                paymentMethods,
                trend: grouped,
                filters
            };

            // Cache for 2 minutes
            await cache.set(cacheKey, analytics, this.cacheTTL);

            return analytics;
        } catch (error) {
            logger.error('Get sales analytics error:', error);
            throw error;
        }
    }

    /**
     * Get inventory analytics
     * @returns {Promise<Object>}
     */
    async getInventoryAnalytics() {
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

            // Calculate stock by category
            const stockByCategory = {};
            inventory.forEach(item => {
                const category = item.category || 'Uncategorized';
                if (!stockByCategory[category]) {
                    stockByCategory[category] = {
                        items: 0,
                        totalStock: 0,
                        totalValue: 0
                    };
                }
                stockByCategory[category].items += 1;
                stockByCategory[category].totalStock += item.stock;
                stockByCategory[category].totalValue += item.stock * (item.sellingPrice || 0);
            });

            const analytics = {
                summary: {
                    totalItems,
                    totalValue,
                    lowStockCount: lowStockItems.length,
                    outOfStockCount: outOfStockItems.length
                },
                lowStockItems: lowStockItems.slice(0, 10).map(item => ({
                    id: item.id,
                    productName: item.productName,
                    stock: item.stock,
                    reorderLevel: item.reorderLevel || 10
                })),
                stockByCategory,
                lastUpdated: new Date()
            };

            // Cache for 2 minutes
            await cache.set(cacheKey, analytics, this.cacheTTL);

            return analytics;
        } catch (error) {
            logger.error('Get inventory analytics error:', error);
            throw error;
        }
    }

    /**
     * Get vehicle analytics
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getVehicleAnalytics(filters = {}) {
        try {
            const { startDate, endDate } = filters;

            const cacheKey = `${this.cachePrefix}vehicles:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get all active vehicles
            const vehiclesSnapshot = await this.db.collection('vehicles')
                .where('isActive', '==', true)
                .get();
            const vehicles = serializeDocs(vehiclesSnapshot);

            // Get sales for the period
            let salesQuery = this.db.collection('sales').where('status', '==', 'completed');
            if (startDate) {
                salesQuery = salesQuery.where('saleDate', '>=', new Date(startDate));
            }
            if (endDate) {
                salesQuery = salesQuery.where('saleDate', '<=', new Date(endDate));
            }

            const salesSnapshot = await salesQuery.get();
            const sales = serializeDocs(salesSnapshot);

            // Calculate sales by vehicle
            const vehiclePerformance = vehicles.map(vehicle => {
                const vehicleSales = sales.filter(s => s.vehicleId === vehicle.id);
                const revenue = vehicleSales.reduce((sum, s) => sum + s.grandTotal, 0);
                const transactions = vehicleSales.length;

                return {
                    vehicleId: vehicle.id,
                    vehicleName: vehicle.vehicleName,
                    vehicleNumber: vehicle.vehicleNumber,
                    assignedUser: vehicle.assignedUserName,
                    revenue,
                    transactions,
                    averageSaleValue: transactions > 0 ? revenue / transactions : 0
                };
            }).sort((a, b) => b.revenue - a.revenue);

            const totalRevenue = vehiclePerformance.reduce((sum, v) => sum + v.revenue, 0);
            const averageRevenuePerVehicle = vehicles.length > 0 ? totalRevenue / vehicles.length : 0;

            const analytics = {
                summary: {
                    totalVehicles: vehicles.length,
                    totalRevenue,
                    averageRevenuePerVehicle
                },
                vehiclePerformance,
                filters
            };

            // Cache for 2 minutes
            await cache.set(cacheKey, analytics, this.cacheTTL);

            return analytics;
        } catch (error) {
            logger.error('Get vehicle analytics error:', error);
            throw error;
        }
    }

    /**
     * Get sales rep analytics
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getSalesRepAnalytics(filters = {}) {
        try {
            const { startDate, endDate } = filters;

            const cacheKey = `${this.cachePrefix}salesreps:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            // Get sales for the period
            let query = this.db.collection('sales').where('status', '==', 'completed');
            if (startDate) {
                query = query.where('saleDate', '>=', new Date(startDate));
            }
            if (endDate) {
                query = query.where('saleDate', '<=', new Date(endDate));
            }

            const snapshot = await query.get();
            const sales = serializeDocs(snapshot);

            // Group by sales rep
            const repMap = {};
            sales.forEach(sale => {
                if (!repMap[sale.salesRepId]) {
                    repMap[sale.salesRepId] = {
                        salesRepId: sale.salesRepId,
                        salesRepName: sale.salesRepName,
                        revenue: 0,
                        transactions: 0,
                        profit: 0
                    };
                }

                const saleProfit = sale.items.reduce((sum, item) => sum + (item.profit || 0), 0);
                repMap[sale.salesRepId].revenue += sale.grandTotal;
                repMap[sale.salesRepId].transactions += 1;
                repMap[sale.salesRepId].profit += saleProfit;
            });

            const leaderboard = Object.values(repMap).map(rep => ({
                ...rep,
                averageSaleValue: rep.transactions > 0 ? rep.revenue / rep.transactions : 0
            })).sort((a, b) => b.revenue - a.revenue);

            const analytics = {
                leaderboard,
                summary: {
                    totalReps: leaderboard.length,
                    totalRevenue: leaderboard.reduce((sum, r) => sum + r.revenue, 0),
                    totalTransactions: leaderboard.reduce((sum, r) => sum + r.transactions, 0)
                },
                filters
            };

            // Cache for 2 minutes
            await cache.set(cacheKey, analytics, this.cacheTTL);

            return analytics;
        } catch (error) {
            logger.error('Get sales rep analytics error:', error);
            throw error;
        }
    }

    /**
     * Get profit analytics
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getProfitAnalytics(filters = {}) {
        try {
            const { startDate, endDate } = filters;

            const cacheKey = `${this.cachePrefix}profit:${JSON.stringify(filters)}`;
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

            const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
            const totalProfit = sales.reduce((sum, s) => {
                return sum + s.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0);
            }, 0);

            // Profit by product
            const productProfitMap = {};
            sales.forEach(sale => {
                sale.items.forEach(item => {
                    if (!productProfitMap[item.inventoryId]) {
                        productProfitMap[item.inventoryId] = {
                            productName: item.productName,
                            revenue: 0,
                            profit: 0,
                            quantity: 0
                        };
                    }
                    productProfitMap[item.inventoryId].revenue += item.totalPrice;
                    productProfitMap[item.inventoryId].profit += (item.profit || 0);
                    productProfitMap[item.inventoryId].quantity += item.quantity;
                });
            });

            const profitByProduct = Object.values(productProfitMap).map(p => ({
                ...p,
                profitMargin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
            })).sort((a, b) => b.profit - a.profit).slice(0, 20);

            const analytics = {
                summary: {
                    totalRevenue,
                    totalProfit,
                    overallProfitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
                },
                profitByProduct,
                filters
            };

            // Cache for 2 minutes
            await cache.set(cacheKey, analytics, this.cacheTTL);

            return analytics;
        } catch (error) {
            logger.error('Get profit analytics error:', error);
            throw error;
        }
    }

    /**
     * Get accounting stats
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAccountingStats(filters = {}) {
        try {
            const { startDate, endDate } = filters;
            const cacheKey = `${this.cachePrefix}accounting:${JSON.stringify(filters)}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            logger.info('Starting getAccountingStats...');

            // Range setup
            const start = startDate ? this.parseDate(startDate) : null;
            if (start) start.setHours(0, 0, 0, 0);

            const end = endDate ? new Date(endDate) : null;
            if (end) end.setHours(23, 59, 59, 999);

            // 1. Get Sales (Revenue & Selling Items)
            // Query all completed sales first to avoid composite index issues with date range
            logger.info('Fetching sales for accounting...');
            const salesSnapshot = await this.db.collection('sales').where('status', '==', 'completed').get();
            logger.info(`Sales fetched: ${salesSnapshot.size} docs`);

            const sales = [];
            salesSnapshot.forEach(doc => {
                const sale = doc.data();
                const saleDate = this.parseDate(sale.saleDate);

                let include = true;
                if (start && (!saleDate || saleDate < start)) include = false;
                if (end && (!saleDate || saleDate > end)) include = false;

                if (include) {
                    sales.push(sale);
                }
            });
            logger.info(`Sales after filtering: ${sales.length} docs`);

            const totalRevenue = sales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

            // Top Selling Items Logic
            const productMap = {};
            sales.forEach(sale => {
                if (sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach(item => {
                        const id = item.inventoryId;
                        if (!productMap[id]) {
                            productMap[id] = {
                                id,
                                name: item.productName || 'Unknown Product',
                                qty: 0,
                                revenue: 0
                            };
                        }
                        productMap[id].qty += (item.quantity || 0);
                        productMap[id].revenue += (item.totalPrice || 0);
                    });
                }
            });
            const topSellingItems = Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            // 2. Get Expenses (Expenses & Top Expense Categories)
            // Match ExpenseService: Client-side filtering to avoid index issues.
            logger.info('Fetching expenses for accounting...');
            const expensesSnapshot = await this.db.collection('expenses').get();
            logger.info(`Expenses fetched: ${expensesSnapshot.size} docs`);

            const expenses = [];
            expensesSnapshot.forEach(doc => {
                const expense = doc.data();
                if (expense.status === 'rejected') return; // Exclude rejected

                const expenseDate = this.parseDate(expense.expenseDate || expense.createdAt);

                let include = true;
                if (start && (!expenseDate || expenseDate < start)) include = false;
                if (end && (!expenseDate || expenseDate > end)) include = false;

                if (include) {
                    expenses.push(expense);
                }
            });
            logger.info(`Expenses after filtering: ${expenses.length} docs`);

            const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

            // Top Expense Categories
            const expenseCategoryMap = {};
            expenses.forEach(e => {
                const category = e.category || 'Other';
                if (!expenseCategoryMap[category]) {
                    expenseCategoryMap[category] = 0;
                }
                expenseCategoryMap[category] += (e.amount || 0);
            });
            const topExpenses = Object.entries(expenseCategoryMap)
                .map(([category, amount]) => ({ category, amount }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);

            // 3. Get Invoices (Supplier Payments)
            logger.info('Fetching invoices for accounting...');
            const invoicesSnapshot = await this.db.collection('invoices').get();
            logger.info(`Invoices fetched: ${invoicesSnapshot.size} docs`);

            const invoices = [];
            invoicesSnapshot.forEach(doc => {
                const invoice = doc.data();
                const invoiceDate = this.parseDate(invoice.createdAt || invoice.date);

                let include = true;
                if (start && (!invoiceDate || invoiceDate < start)) include = false;
                if (end && (!invoiceDate || invoiceDate > end)) include = false;

                if (include) {
                    invoices.push(invoice);
                }
            });
            logger.info(`Invoices after filtering: ${invoices.length} docs`);

            const totalInvoices = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

            // 4. Advanced BI Calculations
            const nowTime = new Date();

            // Vehicle ROI
            const vehicleROIMap = {};

            // 1. Initialize with all active vehicles to ensure complete analysis
            const vehiclesSnapshot = await this.db.collection('vehicles').where('isActive', '==', true).get();
            vehiclesSnapshot.forEach(doc => {
                const v = doc.data();
                vehicleROIMap[doc.id] = {
                    id: doc.id,
                    name: v.vehicleName || v.name || v.registrationNumber || 'Unknown Vehicle',
                    revenue: 0,
                    expenses: 0,
                    profit: 0
                };
            });

            // 2. Add Revenue from Sales
            sales.forEach(s => {
                if (s.vehicleId) {
                    if (!vehicleROIMap[s.vehicleId]) {
                        vehicleROIMap[s.vehicleId] = { id: s.vehicleId, name: s.vehicleName, revenue: 0, expenses: 0, profit: 0 };
                    }
                    vehicleROIMap[s.vehicleId].revenue += (s.grandTotal || 0);
                    const saleProfit = s.items?.reduce((sum, item) => sum + (item.profit || 0), 0) || 0;
                    vehicleROIMap[s.vehicleId].profit += saleProfit;
                }
            });

            // 3. Add Expenses
            expenses.forEach(e => {
                if (e.vehicleId) {
                    if (!vehicleROIMap[e.vehicleId]) {
                        vehicleROIMap[e.vehicleId] = { id: e.vehicleId, name: e.vehicleName || 'Other Vehicle', revenue: 0, expenses: 0, profit: 0 };
                    }
                    vehicleROIMap[e.vehicleId].expenses += (e.amount || 0);
                }
            });

            const vehicleROI = Object.values(vehicleROIMap).map(v => ({
                ...v,
                netROI: v.revenue - v.expenses
            })).sort((a, b) => b.netROI - a.netROI);

            // Inventory Health (Turnover & Dead Stock)
            // Note: Turnover requires COGS which we approximate from sales profits
            const inventorySnapshot = await this.db.collection('inventory').where('isActive', '==', true).get();
            const inventoryHealth = {
                deadStock: [],
                turnover: []
            };
            inventorySnapshot.forEach(doc => {
                const item = doc.data();
                const salesForItem = Object.values(productMap).find(p => p.id === doc.id);
                if (!salesForItem || salesForItem.qty === 0) {
                    inventoryHealth.deadStock.push({ id: doc.id, name: item.productName, stock: item.stock });
                } else {
                    inventoryHealth.turnover.push({ id: doc.id, name: item.productName, qtySold: salesForItem.qty, revenue: salesForItem.revenue });
                }
            });
            inventoryHealth.deadStock = inventoryHealth.deadStock.slice(0, 10);
            inventoryHealth.turnover = inventoryHealth.turnover.sort((a, b) => b.qtySold - a.qtySold).slice(0, 10);

            // Accounts Receivable (MPESA/Mixed payments that are pending or aging)
            // approximating from sales with specific statuses if any, or just aging bucketing
            const aging = { '0-7 days': 0, '8-30 days': 0, '30+ days': 0 };
            sales.forEach(s => {
                if (s.paymentMethod === 'credit' || s.paymentMethod === 'mixed') {
                    const date = this.parseDate(s.saleDate);
                    if (!date) return; // Skip if invalid
                    const diffDays = Math.ceil((nowTime - date) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 7) aging['0-7 days'] += s.grandTotal;
                    else if (diffDays <= 30) aging['8-30 days'] += s.grandTotal;
                    else aging['30+ days'] += s.grandTotal;
                }
            });

            // Team Performance
            const teamPerformance = {};
            sales.forEach(s => {
                const repId = s.salesRepId || 'unknown';
                if (!teamPerformance[repId]) {
                    teamPerformance[repId] = { id: repId, name: s.salesRepName || 'Unknown', revenue: 0, profit: 0, sales: 0 };
                }
                teamPerformance[repId].revenue += (s.grandTotal || 0);
                teamPerformance[repId].sales += 1;
                teamPerformance[repId].profit += s.items?.reduce((sum, item) => sum + (item.profit || 0), 0) || 0;
            });

            // Operating Margins (Trends)
            // Using the existing grouping logic for revenue vs expenses
            const marginTrends = this.groupSalesByPeriod(sales, 'day').map(s => {
                const dailyExpenses = expenses.filter(e => {
                    const d = this.parseDate(e.expenseDate || e.createdAt);
                    return d && d.toISOString().split('T')[0] === s.period;
                }).reduce((sum, e) => sum + (e.amount || 0), 0);
                return {
                    date: s.period,
                    revenue: s.revenue,
                    expenses: dailyExpenses,
                    margin: s.revenue > 0 ? ((s.revenue - dailyExpenses) / s.revenue) * 100 : 0
                };
            });

            // 5. Net Profit Calculation
            const netProfit = totalRevenue - (totalExpenses + totalInvoices);
            logger.info('Accounting stats calculated successfully.');

            const stats = {
                totalRevenue,
                totalExpenses,
                totalInvoices,
                netProfit,
                topSellingItems,
                topExpenses,
                vehicleROI,
                inventoryHealth,
                accountsReceivable: aging,
                teamPerformance: Object.values(teamPerformance).sort((a, b) => b.profit - a.profit),
                marginTrends,
                lastUpdated: new Date()
            };

            await cache.set(cacheKey, stats, this.cacheTTL);
            return stats;

        } catch (error) {
            logger.error('Get accounting stats error:', error);
            throw error;
        }
    }

    /**
     * Group sales by period
     * @param {Array} sales
     * @param {string} groupBy
     * @returns {Array}
     */
    groupSalesByPeriod(sales, groupBy) {
        const grouped = {};

        sales.forEach(sale => {
            const date = this.parseDate(sale.saleDate);

            // Skip invalid dates to prevent RangeError: Invalid time value
            if (!date || isNaN(date.getTime())) {
                logger.warn(`Skipping sale ${sale.id} in groupSalesByPeriod due to invalid date:`, sale.saleDate);
                return;
            }

            let key;

            if (groupBy === 'hour') {
                key = `${date.toISOString().split('T')[0]} ${String(date.getHours()).padStart(2, '0')}:00`;
            } else if (groupBy === 'day') {
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
                    revenue: 0,
                    transactions: 0,
                    profit: 0
                };
            }

            const saleProfit = sale.items.reduce((sum, item) => sum + (item.profit || 0), 0);
            grouped[key].revenue += sale.grandTotal;
            grouped[key].transactions += 1;
            grouped[key].profit += saleProfit;
        });

        return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
    }

    /**
     * Robust date parser for various formats (Firestore Timestamp, Date object, string)
     * @param {*} dateField 
     * @returns {Date|null}
     */
    parseDate(dateField) {
        if (!dateField) return null;
        if (dateField instanceof Date) return dateField;
        if (dateField.toDate && typeof dateField.toDate === 'function') return dateField.toDate();
        if (dateField._seconds) return new Date(dateField._seconds * 1000);

        const d = new Date(dateField);
        return isNaN(d.getTime()) ? null : d;
    }
}

module.exports = new AnalyticsService();
