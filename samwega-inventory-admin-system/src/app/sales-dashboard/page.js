"use client";

import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Calendar,
    Truck,
    CreditCard,
    Search,
    ArrowUpRight,
    ArrowDownRight,
    Banknote,
    Smartphone,
    FileText
} from "lucide-react";
import Link from "next/link";

export default function SalesDashboard() {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

    const [stats, setStats] = useState(null);
    const [sales, setSales] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedVehicle, setSelectedVehicle] = useState("");
    const [dateFilter, setDateFilter] = useState("");

    useEffect(() => {
        fetchVehicles();
    }, []);

    useEffect(() => {
        fetchData();
    }, [selectedVehicle, dateFilter]);

    const fetchVehicles = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/vehicles`);
            if (res.ok) {
                const data = await res.json();
                setVehicles(data);
            }
        } catch (err) {
            console.error("Error fetching vehicles:", err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedVehicle) params.append("vehicleId", selectedVehicle);
            if (dateFilter) params.append("date", dateFilter);

            const [statsRes, salesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/sales/stats?${params}`),
                fetch(`${API_BASE_URL}/api/sales?${params}&limit=50`)
            ]);

            if (statsRes.ok && salesRes.ok) {
                const statsData = await statsRes.json();
                const salesData = await salesRes.json();
                setStats(statsData);
                setSales(salesData);
            }
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, subValue, icon: Icon, color }) => (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${color}`}>
                    <Icon size={24} className="text-white" />
                </div>
                {subValue && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
                        <ArrowUpRight size={12} />
                        {subValue}
                    </span>
                )}
            </div>
            <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">{title}</h3>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans">
            <div className="mx-auto max-w-[1600px] space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <LayoutDashboard className="text-sky-600" />
                            Sales Dashboard
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Overview of sales performance and transactions</p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                        <div className="relative">
                            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <select
                                value={selectedVehicle}
                                onChange={(e) => setSelectedVehicle(e.target.value)}
                                className="pl-10 pr-8 py-2 bg-slate-50 border-none rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <option value="">All Vehicles</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.vehicleName}</option>
                                ))}
                            </select>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                            />
                        </div>
                        {(selectedVehicle || dateFilter) && (
                            <button
                                onClick={() => { setSelectedVehicle(""); setDateFilter(""); }}
                                className="text-xs text-rose-500 font-medium hover:text-rose-700 px-2"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Total Revenue"
                        value={`KSh ${stats?.totalRevenue?.toLocaleString() || 0}`}
                        subValue={`${stats?.saleCount || 0} sales`}
                        icon={Banknote}
                        color="bg-sky-500"
                    />
                    <StatCard
                        title="Cash Sales"
                        value={`KSh ${stats?.paymentMethods?.cash?.toLocaleString() || 0}`}
                        icon={Banknote}
                        color="bg-emerald-500"
                    />
                    <StatCard
                        title="M-Pesa Sales"
                        value={`KSh ${stats?.paymentMethods?.mpesa?.toLocaleString() || 0}`}
                        icon={Smartphone}
                        color="bg-violet-500"
                    />
                    <StatCard
                        title="Items Sold"
                        value={stats?.totalItemsSold || 0}
                        icon={FileText}
                        color="bg-amber-500"
                    />
                </div>

                {/* Sales Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900">Recent Transactions</h2>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search sales..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Receipt ID</th>
                                    <th className="px-6 py-4">Date & Time</th>
                                    <th className="px-6 py-4">Vehicle</th>
                                    <th className="px-6 py-4">Items</th>
                                    <th className="px-6 py-4">Payment</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                            Loading sales data...
                                        </td>
                                    </tr>
                                ) : sales.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                            No sales found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map((sale) => {
                                        const vehicle = vehicles.find(v => v.id === sale.vehicleId);
                                        return (
                                            <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-slate-600">
                                                    #{sale.id.substring(0, 8)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-900">
                                                    <div className="font-medium">{sale.date}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {new Date(sale.soldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Truck size={14} className="text-slate-400" />
                                                        <span className="text-slate-700">
                                                            {vehicle ? vehicle.vehicleName : 'Unknown Vehicle'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-slate-700">
                                                        {sale.items.length} items
                                                    </div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[200px]" title={sale.items.map(i => i.productName).join(', ')}>
                                                        {sale.items[0]?.productName} {sale.items.length > 1 && `+${sale.items.length - 1} more`}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                                        ${sale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-800' :
                                                            sale.paymentMethod === 'mpesa' ? 'bg-violet-100 text-violet-800' :
                                                                'bg-amber-100 text-amber-800'}`}>
                                                        {sale.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-900">
                                                    KSh {parseFloat(sale.totalAmount).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
