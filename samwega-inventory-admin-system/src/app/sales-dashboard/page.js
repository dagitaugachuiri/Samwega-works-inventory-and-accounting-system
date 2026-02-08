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
    Landmark,
    Clock,
    Trash2,
    Sparkles
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../../lib/api";
import Header from "../../components/Header";
import DeleteSaleModal from "../../components/KKCalcModal";


export default function SalesDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState(null);
    const [sales, setSales] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedSales, setSelectedSales] = useState([]);

    // Filters
    const [selectedVehicle, setSelectedVehicle] = useState("");

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
    // Default to All Time (empty dates)
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");


    useEffect(() => {
        fetchVehicles();
    }, []);

    useEffect(() => {
        fetchData();
    }, [selectedVehicle, startDate, endDate]);

    const fetchVehicles = async () => {
        try {
            const response = await api.getVehicles();
            // Backend returns { success: true, data: { vehicles: [...], pagination: {...} } }
            if (response.success && response.data && Array.isArray(response.data.vehicles)) {
                setVehicles(response.data.vehicles);
            } else if (response.success && Array.isArray(response.data)) {
                // Fallback in case structure changes
                setVehicles(response.data);
            } else {
                setVehicles([]);
            }
        } catch (err) {
            console.error("Error fetching vehicles:", err);
            setVehicles([]);
        }
    };

    // Helper function to convert Firestore timestamp to Date
    const convertTimestamp = (timestamp) => {
        if (!timestamp) return null;
        // Handle Firestore Timestamp object
        if (timestamp._seconds) {
            return new Date(timestamp._seconds * 1000);
        }
        // Handle already converted date
        if (timestamp instanceof Date) {
            return timestamp;
        }
        // Handle string dates
        if (typeof timestamp === 'string') {
            return new Date(timestamp);
        }
        return null;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const filters = {};
            if (startDate && endDate) {
                filters.startDate = startDate;
                filters.endDate = endDate;
                filters.type = 'custom';
            } else {
                filters.type = 'all';
            }

            if (selectedVehicle) filters.vehicleId = selectedVehicle;

            // For stats, we need to aggregate all vehicles if no specific vehicle selected
            // The backend expects vehicleId, so we'll fetch stats for the first vehicle or handle differently
            let statsPromise;
            if (selectedVehicle) {
                statsPromise = api.getSalesStats(filters);
            } else {
                // When no vehicle selected, try to get stats without vehicleId filter
                // or aggregate from all sales
                statsPromise = api.getSalesStats(filters);
            }

            const [statsData, salesData] = await Promise.all([
                statsPromise,
                api.getSales({ ...filters, limit: 50 })
            ]);

            console.log('=== STATS DEBUG ===');
            console.log('Stats API Response:', statsData);
            console.log('Stats Data:', statsData?.data);
            console.log('Sales API Response:', salesData);
            console.log('Number of sales returned:', salesData?.data?.sales?.length);
            if (salesData?.data?.sales?.length > 0) {
                console.log('First sale date:', salesData.data.sales[0].saleDate);
                console.log('First sale grandTotal:', salesData.data.sales[0].grandTotal);
                console.log('First sale paymentMethod:', salesData.data.sales[0].paymentMethod);
            }

            if (statsData.success && statsData.data) {
                console.log('Setting stats to:', statsData.data);
                setStats(statsData.data);
            } else {
                console.warn('Stats API failed, using defaults');
                // Set default stats if API fails
                setStats({
                    totalRevenue: 0,
                    totalTransactions: 0,
                    totalItemsSold: 0,
                    paymentMethods: { cash: 0, mpesa: 0, bank: 0, credit: 0, mixed: 0 }
                });
            }


            if (salesData.success && salesData.data && Array.isArray(salesData.data.sales)) {
                setSales(salesData.data.sales);
            } else if (salesData.success && Array.isArray(salesData.data)) {
                // Fallback in case structure changes
                setSales(salesData.data);
            } else {
                setSales([]);
            }
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            // Check if it's a token expiration error

            setSales([]);
        } finally {
            setLoading(false);
        }
    };

    const toggleSaleSelection = (saleId) => {
        setSelectedSales(prev =>
            prev.includes(saleId)
                ? prev.filter(id => id !== saleId)
                : [...prev, saleId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedSales.length === sales.length) {
            setSelectedSales([]);
        } else {
            setSelectedSales(sales.map(s => s.id));
        }
    };

    const handleDeleteSuccess = () => {
        setSelectedSales([]);
        fetchData();
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
        <div className="min-h-screen bg-slate-50 font-sans">
            <Header />
            <div className="p-6">
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

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(true)}
                                disabled={selectedSales.length === 0}
                                className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-lg font-medium hover:bg-rose-100 transition-colors border border-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={16} />
                                Delete {selectedSales.length > 0 ? `(${selectedSales.length})` : 'Sale'}
                            </button>

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
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer hover:bg-slate-100 transition-colors w-40"
                                            placeholder="From"
                                        />
                                    </div>
                                    <span className="text-slate-400 text-sm">to</span>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="pl-4 pr-4 py-2 bg-slate-50 border-none rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer hover:bg-slate-100 transition-colors w-40"
                                            placeholder="To"
                                        />
                                    </div>
                                </div>
                                {(selectedVehicle || startDate || endDate) && (
                                    <button
                                        onClick={() => {
                                            setSelectedVehicle("");
                                            const reset = getLast30Days();
                                            setStartDate(reset.start);
                                            setEndDate(reset.end);
                                        }}
                                        className="text-xs text-rose-500 font-medium hover:text-rose-700 px-2"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
                            title="Bank Sales"
                            value={`KSh ${stats?.paymentMethods?.bank?.toLocaleString() || 0}`}
                            icon={Landmark}
                            color="bg-blue-500"
                        />
                        <StatCard
                            title="Debt Sales"
                            value={`KSh ${stats?.paymentMethods?.credit?.toLocaleString() || 0}`}
                            icon={Clock}
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
                                        <th className="px-6 py-4 w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedSales.length === sales.length && sales.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-6 py-4">Receipt Number</th>
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
                                            <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                                                Loading sales data...
                                            </td>
                                        </tr>
                                    ) : sales.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                                                No sales found matching your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        sales.map((sale) => {
                                            const vehicle = vehicles.find(v => v.id === sale.vehicleId);
                                            const isSelected = selectedSales.includes(sale.id);
                                            return (
                                                <tr
                                                    key={sale.id}
                                                    className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-rose-50' : ''}`}
                                                >
                                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSaleSelection(sale.id)}
                                                            className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td
                                                        className="px-6 py-4 font-mono text-slate-600 cursor-pointer"
                                                        onClick={() => router.push(`/sales/${sale.id}`)}
                                                    >
                                                        {sale.receiptNumber || `#${sale.id.substring(0, 8)}`}
                                                    </td>
                                                    <td
                                                        className="px-6 py-4 text-slate-900 cursor-pointer"
                                                        onClick={() => router.push(`/sales/${sale.id}`)}
                                                    >
                                                        <div className="font-medium">
                                                            {convertTimestamp(sale.saleDate)?.toLocaleDateString() || 'N/A'}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {convertTimestamp(sale.saleDate)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-6 py-4 cursor-pointer"
                                                        onClick={() => router.push(`/sales/${sale.id}`)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Truck size={14} className="text-slate-400" />
                                                            <span className="text-slate-700">
                                                                {vehicle ? vehicle.vehicleName : 'Unknown Vehicle'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-6 py-4 cursor-pointer"
                                                        onClick={() => router.push(`/sales/${sale.id}`)}
                                                    >
                                                        <div className="text-slate-700">
                                                            {sale.items.length} items
                                                        </div>
                                                        <div className="text-xs text-slate-500 truncate max-w-[200px]" title={sale.items.map(i => i.productName).join(', ')}>
                                                            {sale.items[0]?.productName} {sale.items.length > 1 && `+${sale.items.length - 1} more`}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-6 py-4 cursor-pointer"
                                                        onClick={() => router.push(`/sales/${sale.id}`)}
                                                    >
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                                        ${sale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-800' :
                                                                sale.paymentMethod === 'mpesa' ? 'bg-violet-100 text-violet-800' :
                                                                    'bg-amber-100 text-amber-800'}`}>
                                                            {sale.paymentMethod}
                                                        </span>
                                                    </td>
                                                    <td
                                                        className="px-6 py-4 text-right font-bold text-slate-900 cursor-pointer"
                                                        onClick={() => router.push(`/sales/${sale.id}`)}
                                                    >
                                                        KSh {parseFloat(sale.grandTotal).toLocaleString()}
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

                <DeleteSaleModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onSuccess={handleDeleteSuccess}
                    selectedSales={selectedSales}
                    sales={sales}
                />
            </div>
        </div>
    );
}
