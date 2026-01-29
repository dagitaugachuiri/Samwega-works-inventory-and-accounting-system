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
     * Group sales by period
     * @param {Array} sales
     * @param {string} groupBy
     * @returns {Array}
     */
    groupSalesByPeriod(sales, groupBy) {
        const grouped = {};

        sales.forEach(sale => {
            const date = new Date(sale.saleDate);
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
}

module.exports = new AnalyticsService();
