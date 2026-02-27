"use client";

import { useEffect, useState, useMemo } from "react";
import {
    Search,
    ArrowUpRight,
    Trash2,
    BarChart2,
    List,
    ChevronDown,
    Receipt,
    X
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "../../lib/api";
import DeleteSaleModal from "../../components/KKCalcModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const convertTimestamp = (ts) => {
    if (!ts) return null;
    if (ts._seconds) return new Date(ts._seconds * 1000);
    if (ts instanceof Date) return ts;
    if (typeof ts === "string") return new Date(ts);
    return null;
};

const fmt = (n) => Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n || 0).toLocaleString();

const getLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
    };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ title, value, subValue }) => (
    <div className="bg-white p-4 rounded-lg border border-slate-200">
        <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex items-baseline justify-between">
            <p className="text-2xl font-semibold text-slate-900">{value}</p>
            {subValue && (
                <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
                    <ArrowUpRight size={12} />
                    {subValue}
                </span>
            )}
        </div>
    </div>
);

const PaymentBadge = ({ method }) => {
    const styles = {
        cash: "bg-emerald-50 text-emerald-700 border-emerald-100",
        mpesa: "bg-violet-50 text-violet-700 border-violet-100",
        bank: "bg-blue-50 text-blue-700 border-blue-100",
        credit: "bg-amber-50 text-amber-700 border-amber-100",
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize border ${styles[method] || "bg-slate-50 text-slate-700 border-slate-100"}`}>
            {method}
        </span>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SalesDashboard() {
    const router = useRouter();

    // Data
    const [stats, setStats] = useState(null);
    const [sales, setSales] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    // Table mode: "transactions" | "pnl"
    const [tableMode, setTableMode] = useState("transactions");

    // Filters (shared between both views)
    const [selectedVehicle, setSelectedVehicle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [etrFilter, setEtrFilter] = useState("");
    const [search, setSearch] = useState(""); // searches receipt#, customer, items

    // Transactions-mode specific
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedSales, setSelectedSales] = useState([]);

    // ── Fetch ────────────────────────────────────────────────────────────────

    useEffect(() => { fetchVehicles(); }, []);
    useEffect(() => { fetchData(); }, [selectedVehicle, startDate, endDate, etrFilter]);

    const fetchVehicles = async () => {
        try {
            const res = await api.getVehicles();
            if (res.success && res.data?.vehicles) setVehicles(res.data.vehicles);
            else if (res.success && Array.isArray(res.data)) setVehicles(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const filters = {};
            if (startDate && endDate) {
                filters.startDate = startDate;
                filters.endDate = endDate;
                filters.type = "custom";
            } else {
                filters.type = "all";
            }
            if (selectedVehicle) filters.vehicleId = selectedVehicle;
            if (etrFilter) filters.isEtr = etrFilter;

            const [statsData, salesData] = await Promise.all([
                api.getSalesStats(filters),
                api.getSales({ ...filters, limit: 200 }),
            ]);

            if (statsData.success && statsData.data) {
                setStats(statsData.data);
            } else {
                setStats({ totalRevenue: 0, totalTransactions: 0, totalItemsSold: 0, paymentMethods: {} });
            }

            if (salesData.success && Array.isArray(salesData.data?.sales)) {
                setSales(salesData.data.sales);
            } else if (salesData.success && Array.isArray(salesData.data)) {
                setSales(salesData.data);
            } else {
                setSales([]);
            }

            const userRes = await api.getCurrentUser();
            if (userRes.success) {
                setUser(userRes.data);
            }
        } catch (e) {
            console.error(e);
            setSales([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSuccess = () => { setSelectedSales([]); fetchData(); };
    const toggleSaleSelection = (id) =>
        setSelectedSales((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
    const toggleSelectAll = () =>
        setSelectedSales(selectedSales.length === sales.length ? [] : sales.map((s) => s.id));

    // ── Derived: P&L rows ─────────────────────────────────────────────────────
    // Flatten each sale's items into individual rows, applying search filter
    const pnlRows = useMemo(() => {
        const rows = [];
        for (const sale of sales) {
            const vehicle = vehicles.find((v) => v.id === sale.vehicleId);
            const customerName = sale.customerName || sale.customer?.name || "Walk-in";
            const receiptNumber = sale.receiptNumber || `#${sale.id?.substring(0, 8)}`;
            const date = convertTimestamp(sale.saleDate);

            for (const item of sale.items || []) {
                const qty = Number(item.quantity || item.qty || 0);
                const buyingPrice = Number(item.buyingPrice || item.costPrice || item.cost || 0);
                const sellingPrice = Number(item.sellingPrice || item.unitPrice || item.price || 0);
                const totalCost = buyingPrice * qty;
                const totalIncome = sellingPrice * qty;
                const margin = totalIncome - totalCost;

                rows.push({
                    saleId: sale.id,
                    date,
                    vehicleName: vehicle?.vehicleName || "-",
                    customerName,
                    receiptNumber,
                    productName: item.productName || item.name || "-",
                    qty,
                    buyingPrice,
                    totalCost,
                    sellingPrice,
                    totalIncome,
                    margin,
                });
            }
        }
        return rows;
    }, [sales, vehicles]);

    const filteredPnlRows = useMemo(() => {
        if (!search.trim()) return pnlRows;
        const q = search.toLowerCase();
        return pnlRows.filter(
            (r) =>
                r.productName.toLowerCase().includes(q) ||
                r.customerName.toLowerCase().includes(q) ||
                r.receiptNumber.toLowerCase().includes(q)
        );
    }, [pnlRows, search]);

    // ── Derived: transactions search ──────────────────────────────────────────
    const filteredSales = useMemo(() => {
        if (!search.trim()) return sales;
        const q = search.toLowerCase();
        return sales.filter(
            (s) =>
                (s.receiptNumber || "").toLowerCase().includes(q) ||
                (s.customerName || "").toLowerCase().includes(q) ||
                (s.customer?.name || "").toLowerCase().includes(q) ||
                (s.items || []).some((i) => (i.productName || "").toLowerCase().includes(q))
        );
    }, [sales, search]);

    // ── P&L Totals ────────────────────────────────────────────────────────────
    const pnlTotals = useMemo(() => {
        return filteredPnlRows.reduce(
            (acc, r) => ({
                totalCost: acc.totalCost + r.totalCost,
                totalIncome: acc.totalIncome + r.totalIncome,
                totalMargin: acc.totalMargin + r.margin,
            }),
            { totalCost: 0, totalIncome: 0, totalMargin: 0 }
        );
    }, [filteredPnlRows]);

    const resetFilters = () => {
        setSelectedVehicle("");
        setStartDate("");
        setEndDate("");
        setEtrFilter("");
        setSearch("");
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <div className="p-4 lg:p-6">
                <div className="mx-auto max-w-[1700px] space-y-5">

                    {/* ── Header ── */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900">Sales Dashboard</h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {loading ? "Loading..." : `${sales.length} transactions`}
                                {selectedVehicle && ` · ${vehicles.find(v => v.id === selectedVehicle)?.vehicleName}`}
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Delete button (only in transactions mode) */}
                            {tableMode === "transactions" && user?.role !== 'accountant' && (
                                <button
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    disabled={selectedSales.length === 0}
                                    className="flex items-center gap-2 bg-white text-rose-600 px-3 py-1.5 rounded border border-rose-200 text-sm font-medium hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Trash2 size={14} />
                                    Delete {selectedSales.length > 0 ? `(${selectedSales.length})` : ""}
                                </button>
                            )}

                            {/* Vehicle filter */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-3 py-1.5">
                                <ChevronDown size={14} className="text-slate-400" />
                                <select
                                    value={selectedVehicle}
                                    onChange={(e) => setSelectedVehicle(e.target.value)}
                                    className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer"
                                >
                                    <option value="">All Vehicles</option>
                                    {vehicles.map((v) => (
                                        <option key={v.id} value={v.id}>{v.vehicleName || v.registrationNumber}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ETR filter */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-3 py-1.5 relative overflow-hidden">
                                <Receipt size={14} className="text-slate-400" />
                                <select
                                    value={etrFilter}
                                    onChange={(e) => setEtrFilter(e.target.value)}
                                    className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer appearance-none pr-4 outline-none"
                                >
                                    <option value="">All Types</option>
                                    <option value="true">ETR Sales</option>
                                    <option value="false">Non-ETR Sales</option>
                                </select>
                            </div>

                            {/* Date range */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-3 py-1.5 text-sm">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent border-none text-slate-700 focus:ring-0 cursor-pointer w-32"
                                />
                                <span className="text-slate-300">–</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent border-none text-slate-700 focus:ring-0 cursor-pointer w-32"
                                />
                            </div>

                            {(selectedVehicle || startDate || endDate || etrFilter || search) && (
                                <button
                                    onClick={resetFilters}
                                    className="flex items-center gap-1 text-xs text-rose-500 font-medium hover:text-rose-700 bg-white border border-rose-200 rounded px-2 py-1.5"
                                >
                                    <X size={12} /> Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Stats ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatCard
                            title="Total Revenue"
                            value={`KSh ${stats?.totalRevenue?.toLocaleString() || 0}`}
                            subValue={`${stats?.totalTransactions || 0} sales`}
                        />
                        <StatCard
                            title="Cash Sales"
                            value={`KSh ${(typeof stats?.paymentMethods?.cash === 'object' ? stats.paymentMethods.cash.amount : (stats?.paymentMethods?.cash || 0)).toLocaleString()}`}
                        />
                        <StatCard
                            title="M-Pesa Sales"
                            value={`KSh ${(typeof stats?.paymentMethods?.mpesa === 'object' ? stats.paymentMethods.mpesa.amount : (stats?.paymentMethods?.mpesa || 0)).toLocaleString()}`}
                        />
                        <StatCard
                            title="Bank Sales"
                            value={`KSh ${(typeof stats?.paymentMethods?.bank === 'object' ? stats.paymentMethods.bank.amount : (stats?.paymentMethods?.bank || 0)).toLocaleString()}`}
                        />
                        <StatCard
                            title="Debt Sales"
                            value={`KSh ${(typeof stats?.paymentMethods?.credit === 'object' ? stats.paymentMethods.credit.amount : (stats?.paymentMethods?.credit || 0)).toLocaleString()}`}
                        />
                    </div>

                    {/* ── Table Panel ── */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-6">

                        {/* Panel header with mode switch + search */}
                        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Mode Toggle */}
                            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1 w-fit">
                                <button
                                    onClick={() => setTableMode("transactions")}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tableMode === "transactions"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    <List size={15} />
                                    Transactions
                                </button>
                                <button
                                    onClick={() => setTableMode("pnl")}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tableMode === "pnl"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    <BarChart2 size={15} />
                                    Profit &amp; Loss
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={tableMode === "pnl" ? "Search item, customer, receipt…" : "Search receipt, customer, item…"}
                                    className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-sky-400"
                                />
                                {search && (
                                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── TRANSACTIONS TABLE ── */}
                        {tableMode === "transactions" && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSales.length === sales.length && sales.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 rounded border-slate-300 text-slate-600 cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-5 py-3 whitespace-nowrap">Receipt</th>
                                            <th className="px-5 py-3 whitespace-nowrap">Date</th>
                                            <th className="px-5 py-3 whitespace-nowrap">Vehicle</th>
                                            <th className="px-5 py-3 whitespace-nowrap">Customer</th>
                                            <th className="px-5 py-3 whitespace-nowrap">Items</th>
                                            <th className="px-5 py-3 whitespace-nowrap">Payment</th>
                                            <th className="px-5 py-3 text-right whitespace-nowrap">Amount (KSh)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                                                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500 mb-2" />
                                                    Loading sales…
                                                </td>
                                            </tr>
                                        ) : filteredSales.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">No transactions found.</td>
                                            </tr>
                                        ) : (
                                            filteredSales.map((sale) => {
                                                const vehicle = vehicles.find((v) => v.id === sale.vehicleId);
                                                const isSelected = selectedSales.includes(sale.id);
                                                const date = convertTimestamp(sale.saleDate);
                                                return (
                                                    <tr
                                                        key={sale.id}
                                                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? "bg-sky-50/60" : ""}`}
                                                    >
                                                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleSaleSelection(sale.id)}
                                                                className="w-4 h-4 rounded border-slate-300 text-slate-600 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="px-5 py-3 font-mono text-slate-500 text-xs whitespace-nowrap" onClick={() => router.push(`/sales/${sale.id}`)}>
                                                            <div>{sale.receiptNumber || `#${sale.id?.substring(0, 8)}`}</div>
                                                            {sale.isEtr && (
                                                                <div className="text-[9px] bg-sky-100 text-sky-700 font-bold px-1.5 py-0.5 rounded w-fit mt-1 uppercase tracking-tight">ETR COMPLIANT</div>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap" onClick={() => router.push(`/sales/${sale.id}`)}>
                                                            <div className="text-slate-800">{date?.toLocaleDateString() || "—"}</div>
                                                            <div className="text-xs text-slate-400">{date?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || ""}</div>
                                                        </td>
                                                        <td className="px-5 py-3 text-slate-700 whitespace-nowrap" onClick={() => router.push(`/sales/${sale.id}`)}>
                                                            {vehicle?.vehicleName || "—"}
                                                        </td>
                                                        <td className="px-5 py-3 text-slate-700 whitespace-nowrap" onClick={() => router.push(`/sales/${sale.id}`)}>
                                                            {sale.customerName || sale.customer?.name || "Walk-in"}
                                                        </td>
                                                        <td className="px-5 py-3 max-w-[200px]" onClick={() => router.push(`/sales/${sale.id}`)}>
                                                            <div className="text-slate-700 truncate" title={(sale.items || []).map((i) => i.productName).join(", ")}>
                                                                {sale.items?.[0]?.productName}
                                                                {sale.items?.length > 1 && <span className="ml-1 text-slate-400 text-xs">+{sale.items.length - 1}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3" onClick={() => router.push(`/sales/${sale.id}`)}>
                                                            <PaymentBadge method={sale.paymentMethod} />
                                                        </td>
                                                        <td className="px-5 py-3 text-right font-semibold text-slate-900 whitespace-nowrap" onClick={() => router.push(`/sales/${sale.id}`)}>
                                                            {fmt(sale.grandTotal)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── PROFIT & LOSS TABLE ── */}
                        {tableMode === "pnl" && (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Vehicle</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Receipt #</th>
                                                <th className="px-4 py-3 whitespace-nowrap">Product</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap">Qty</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap">Buy Price</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap">Total Cost</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap">Sell Price</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap">Total Income</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap">Margin</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                                                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500 mb-2" />
                                                        Loading…
                                                    </td>
                                                </tr>
                                            ) : filteredPnlRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">No data found.</td>
                                                </tr>
                                            ) : (
                                                filteredPnlRows.map((row, idx) => (
                                                    <tr
                                                        key={`${row.saleId}-${idx}`}
                                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                        onClick={() => router.push(`/sales/${row.saleId}`)}
                                                    >
                                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 text-xs">
                                                            {row.date?.toLocaleDateString() || "—"}
                                                        </td>
                                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                                                            {row.vehicleName}
                                                        </td>
                                                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 max-w-[140px] truncate">
                                                            {row.customerName}
                                                        </td>
                                                        <td className="px-4 py-2.5 whitespace-nowrap font-mono text-slate-500 text-xs">
                                                            <div>{row.receiptNumber}</div>
                                                            {sales.find(s => s.id === row.saleId)?.isEtr && (
                                                                <div className="text-[8px] bg-sky-50 text-sky-600 font-bold px-1 rounded w-fit mt-0.5 uppercase">ETR</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-slate-900 font-medium max-w-[180px] truncate" title={row.productName}>
                                                            {row.productName}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                            {fmtInt(row.qty)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                            {fmt(row.buyingPrice)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                            {fmt(row.totalCost)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                            {fmt(row.sellingPrice)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                            {fmt(row.totalIncome)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                            {fmt(row.margin)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* P&L Summary Footer */}
                                {!loading && filteredPnlRows.length > 0 && (
                                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center gap-6">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Totals ({filteredPnlRows.length} items)
                                        </span>
                                        <div className="flex items-center gap-1 text-sm">
                                            <span className="text-slate-500">Total Cost:</span>
                                            <span className="font-semibold text-slate-700">KSh {fmt(pnlTotals.totalCost)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-sm">
                                            <span className="text-slate-500">Total Income:</span>
                                            <span className="font-semibold text-slate-700">KSh {fmt(pnlTotals.totalIncome)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                                            Net Margin: KSh {fmt(pnlTotals.totalMargin)}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
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
