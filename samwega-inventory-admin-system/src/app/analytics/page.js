"use client"
import { useState, useEffect } from "react";
import { TrendingUp, Package, DollarSign, Users, ShoppingCart, AlertTriangle } from "lucide-react";
import api from "../../lib/api";

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState({
        totalRevenue: 0,
        totalProfit: 0,
        totalSales: 0,
        totalProducts: 0,
        lowStockCount: 0,
        totalVehicles: 0
    });
    const [salesData, setSalesData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);

            // Fetch inventory
            const inventoryRes = await api.getInventory();
            if (inventoryRes.success && inventoryRes.data) {
                const lowStock = inventoryRes.data.filter(item => item.stock <= item.reorderLevel).length;
                setOverview(prev => ({
                    ...prev,
                    totalProducts: inventoryRes.data.length,
                    lowStockCount: lowStock
                }));
            }

            // Fetch sales
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const salesRes = await api.getSales({
                startDate: firstDay.toISOString().split('T')[0],
                endDate: now.toISOString().split('T')[0]
            });
            if (salesRes.success && salesRes.data) {
                const totalRevenue = salesRes.data.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
                const totalProfit = salesRes.data.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);
                setOverview(prev => ({
                    ...prev,
                    totalRevenue,
                    totalProfit,
                    totalSales: salesRes.data.length
                }));
                setSalesData(salesRes.data);
            }

            // Fetch product performance
            const productsRes = await api.getProductPerformance(
                firstDay.toISOString().split('T')[0],
                now.toISOString().split('T')[0],
                5
            );
            if (productsRes.success && productsRes.data) {
                setTopProducts(productsRes.data);
            }

            // Fetch vehicles
            const vehiclesRes = await api.getVehicles();
            if (vehiclesRes.success && vehiclesRes.data) {
                setOverview(prev => ({
                    ...prev,
                    totalVehicles: vehiclesRes.data.length
                }));
            }

        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-300">Loading analytics…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Analytics Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Business performance overview</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="glass-panel p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Revenue (MTD)</p>
                            <p className="text-3xl font-semibold text-emerald-700 mt-2">
                                KSh {overview.totalRevenue.toLocaleString()}
                            </p>
                        </div>
                        <DollarSign className="text-emerald-400" size={32} />
                    </div>
                </div>

                <div className="glass-panel p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-violet-600">Profit (MTD)</p>
                            <p className="text-3xl font-semibold text-violet-700 mt-2">
                                KSh {overview.totalProfit.toLocaleString()}
                            </p>
                        </div>
                        <TrendingUp className="text-violet-400" size={32} />
                    </div>
                </div>

                <div className="glass-panel p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-sky-600">Total Sales</p>
                            <p className="text-3xl font-semibold text-sky-700 mt-2">
                                {overview.totalSales}
                            </p>
                        </div>
                        <ShoppingCart className="text-sky-400" size={32} />
                    </div>
                </div>

                <div className="glass-panel p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-slate-600">Products</p>
                            <p className="text-3xl font-semibold text-slate-900 mt-2">
                                {overview.totalProducts}
                            </p>
                        </div>
                        <Package className="text-slate-400" size={32} />
                    </div>
                </div>

                <div className="glass-panel p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Low Stock</p>
                            <p className="text-3xl font-semibold text-amber-700 mt-2">
                                {overview.lowStockCount}
                            </p>
                        </div>
                        <AlertTriangle className="text-amber-400" size={32} />
                    </div>
                </div>

                <div className="glass-panel p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-slate-600">Vehicles</p>
                            <p className="text-3xl font-semibold text-slate-900 mt-2">
                                {overview.totalVehicles}
                            </p>
                        </div>
                        <Users className="text-slate-400" size={32} />
                    </div>
                </div>
            </div>

            {/* Top Products */}
            <div className="glass-panel p-5">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Selling Products (MTD)</h2>
                <div className="space-y-3">
                    {topProducts.map((product, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-semibold text-sm">
                                    {idx + 1}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">{product.productName}</p>
                                    <p className="text-xs text-slate-500">{product.quantity} units sold</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-emerald-700">KSh {product.revenue.toLocaleString()}</p>
                                <p className="text-xs text-slate-500">Revenue</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-panel p-5">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Sales</h2>
                <div className="space-y-2">
                    {salesData.slice(0, 5).map((sale, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{sale.receiptNumber}</p>
                                <p className="text-xs text-slate-500">{new Date(sale.saleDate).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">KSh {sale.grandTotal.toLocaleString()}</p>
                                <p className="text-xs text-slate-500">{sale.paymentMethod}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
