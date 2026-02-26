"use client";

import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Calendar,
    Wallet,
    Package,
    Users,
    AlertCircle
} from "lucide-react";
import api from "../../lib/api";

export default function AccountingDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, roi, inventory, receivable, team, trends

    // Date range filter (default last 30 days)
    const getLast30Days = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    };

    const defaultRange = getLast30Days();
    const [startDate, setStartDate] = useState(defaultRange.start);
    const [endDate, setEndDate] = useState(defaultRange.end);

    useEffect(() => {
        fetchStats();
    }, [startDate, endDate]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const filters = { startDate, endDate };
            const response = await api.getAccountingStats(filters);
            if (response.success) {
                setStats(response.data);
            }
        } catch (err) {
            console.error("Error fetching accounting stats:", err);
        } finally {
            setLoading(false);
        }
    };

    const ProgressBar = ({ label, value, max, color, subText }) => (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-600">{label}</span>
                <span className="text-slate-900 font-bold">{value.toLocaleString()}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 ${color}`}
                    style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%` }}
                />
            </div>
            {subText && <p className="text-[10px] text-slate-400 italic">{subText}</p>}
        </div>
    );

    const ChartContainer = ({ title, subtitle, children }) => (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
            <div className="relative">
                {children}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <div className="p-6">
                <div className="mx-auto max-w-7xl space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Wallet className="text-violet-600" />
                                Performance
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">Deep insights into business profitability and efficiency</p>
                        </div>

                        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className="text-slate-400 ml-2" size={16} />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-2 py-1.5 bg-slate-50 border-none rounded text-xs focus:ring-1 focus:ring-violet-500 outline-none w-32"
                                />
                                <span className="text-slate-400 text-xs">to</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-2 py-1.5 bg-slate-50 border-none rounded text-xs focus:ring-1 focus:ring-violet-500 outline-none w-32"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex flex-wrap gap-2 border-b border-slate-200">
                        {[
                            { id: 'overview', name: 'Overview', icon: LayoutDashboard },
                            { id: 'inventory', name: 'Stock Health', icon: Package },
                            { id: 'team', name: 'Rep Performance', icon: Users },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative
                                    ${activeTab === tab.id ? 'text-violet-600' : 'text-slate-500 hover:text-slate-700'}
                                `}
                            >
                                <tab.icon size={16} />
                                {tab.name}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />
                                )}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin" />
                            <p className="text-slate-500 text-sm animate-pulse">Calculating performance...</p>
                        </div>
                    ) : (
                        <div className="transition-all duration-300">
                            {/* OVERVIEW TAB */}
                            {activeTab === 'overview' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                            <h3 className="font-semibold text-slate-900">Top Selling Products</h3>
                                        </div>
                                        <div className="p-6 space-y-6">
                                            {stats?.topSellingItems?.map((item, i) => (
                                                <ProgressBar
                                                    key={i}
                                                    label={item.name}
                                                    value={item.revenue}
                                                    max={Math.max(...(stats?.topSellingItems?.map(x => x.revenue) || [1]))}
                                                    color="bg-emerald-500"
                                                    subText={`${item.qty} units sold`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="p-6 border-b border-slate-100">
                                            <h3 className="font-semibold text-slate-900">Expense Breakdown</h3>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            {stats?.topExpenses?.map((expense, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                                                            {i + 1}
                                                        </div>
                                                        <span className="font-semibold text-slate-700 capitalize">{expense.category}</span>
                                                    </div>
                                                    <span className="text-lg font-bold text-slate-900">KSh {expense.amount?.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}


                            {/* INVENTORY TAB */}
                            {activeTab === 'inventory' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <ChartContainer title="Slow Moving & Dead Stock" subtitle="Items with 0 sales in selected period">
                                        <div className="divide-y divide-slate-100">
                                            {stats?.inventoryHealth?.deadStock?.map((item, i) => (
                                                <div key={i} className="py-4 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <AlertCircle className="text-rose-400" size={18} />
                                                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-bold text-slate-900">{item.stock}</span>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">In Stock</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!stats?.inventoryHealth?.deadStock || stats.inventoryHealth.deadStock.length === 0) && (
                                                <div className="py-12 text-center text-emerald-600 text-sm font-medium">All stock is moving well!</div>
                                            )}
                                        </div>
                                    </ChartContainer>

                                    <ChartContainer title="Highest Velocity Items" subtitle="Stock turnover by quantity sold">
                                        <div className="space-y-6">
                                            {stats?.inventoryHealth?.turnover?.map((item, i) => (
                                                <ProgressBar
                                                    key={i}
                                                    label={item.name}
                                                    value={item.qtySold}
                                                    max={Math.max(...(stats?.inventoryHealth?.turnover?.map(x => x.qtySold) || [1]))}
                                                    color="bg-violet-500"
                                                    subText={`Rev: KSh ${item.revenue.toLocaleString()}`}
                                                />
                                            ))}
                                        </div>
                                    </ChartContainer>
                                </div>
                            )}


                            {/* TEAM PERFORMANCE TAB */}
                            {activeTab === 'team' && (
                                <ChartContainer title="Sales Rep Profitability" subtitle="Net profit contribution by representative">
                                    <div className="space-y-8 mt-4">
                                        {stats?.teamPerformance?.map((rep, i) => (
                                            <div key={i} className="relative">
                                                <div className="flex justify-between text-sm mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900">{rep.name}</span>
                                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-bold">{rep.sales} sales</span>
                                                    </div>
                                                    <span className="font-extrabold text-emerald-600">KSh {rep.profit.toLocaleString()} profit</span>
                                                </div>
                                                <div className="h-6 w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000"
                                                        style={{ width: `${(rep.profit / (stats.teamPerformance[0]?.profit || 1)) * 100}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1">Total Revenue: KSh {rep.revenue.toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                </ChartContainer>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
