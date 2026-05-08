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
    X,
    CreditCard,
    CheckCircle,
    Clock,
    AlertCircle,
    Activity
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

const StatCard = ({ title, value, subValue, tag }) => (
    <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300">
        <div className="flex items-start justify-between mb-3">
            <h3 className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {title}
            </h3>
            {tag && (
                <span className="bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-medium border border-slate-100 uppercase tracking-tight">
                    {tag}
                </span>
            )}
        </div>

        <div className="space-y-1">
            <p className="text-2xl font-medium tracking-tight text-slate-900">
                {value}
            </p>
            {subValue && (
                <p className="text-[11px] font-normal text-slate-400">
                    {subValue}
                </p>
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

const DebtStatusBadge = ({ sale }) => {
    if (!sale) return null;

    // Calculate actual amounts from payments array for accurate display
    const totalPaid = (sale.payments || []).reduce((sum, p) => {
        const method = (p.method || p.paymentMethod || '').toLowerCase();
        if (method !== 'credit' && method !== 'debt') {
            return sum + (Number(p.amount) || 0);
        }
        return sum;
    }, 0);
    
    const remainingAmount = Math.max(0, (sale.grandTotal || 0) - totalPaid);

    // Map backend status to frontend keys
    let status = sale.paymentStatus || (remainingAmount === 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid'));
    if (status === 'partially_paid') status = 'partial';
    if (status === 'pending') status = 'unpaid';

    const config = {
        paid: {
            bg: "bg-emerald-50",
            text: "text-emerald-700",
            border: "border-emerald-100",
            icon: <CheckCircle size={10} />,
            label: "Paid"
        },
        partial: {
            bg: "bg-amber-50",
            text: "text-amber-700",
            border: "border-amber-100",
            icon: <Clock size={10} />,
            label: `Partial: KSh ${fmt(remainingAmount)}`
        },
        overdue: {
            bg: "bg-rose-50",
            text: "text-rose-700",
            border: "border-rose-100",
            icon: <AlertCircle size={10} />,
            label: "Overdue"
        },
        unpaid: {
            bg: "bg-slate-100",
            text: "text-slate-600",
            border: "border-slate-200",
            icon: <Clock size={10} />,
            label: `Unpaid: KSh ${fmt(remainingAmount)}`
        },
    };

    const style = config[status] || config.unpaid;

    return (
        <div className="flex flex-col gap-1 mt-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold border ${style.bg} ${style.text} ${style.border} uppercase tracking-tight`}>
                {style.icon}
                {style.label}
            </span>
        </div>
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
    const [selectedDate, setSelectedDate] = useState("");
    const [etrFilter, setEtrFilter] = useState("");
    const [debtFilter, setDebtFilter] = useState(false);
    const [search, setSearch] = useState(""); // searches receipt#, customer, items
    const [walletFilter, setWalletFilter] = useState(""); // filters by Cash, Mpesa, or Bank Name

    // Transactions-mode specific
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedSales, setSelectedSales] = useState([]);

    // Edit Item state
    const [editingItem, setEditingItem] = useState(null); // { saleId, itemIndex, field, value }
    const [isUpdatingQty, setIsUpdatingQty] = useState(false);

    // ── Fetch ────────────────────────────────────────────────────────────────

    useEffect(() => { fetchVehicles(); }, []);
    useEffect(() => { fetchData(); }, [selectedVehicle, selectedDate, etrFilter, debtFilter]);

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
            if (selectedDate) {
                filters.startDate = selectedDate;
                filters.endDate = selectedDate;
                filters.type = "custom";
            } else {
                filters.type = "all";
            }
            if (selectedVehicle) filters.vehicleId = selectedVehicle;
            if (etrFilter) filters.isEtr = etrFilter;

            const [statsData, salesData] = await Promise.all([
                api.getSalesStats(filters),
                api.getSales({ ...filters, limit: 2000 }) // Sufficient limit for dashboard view and aggregation fallback
            ]);

            if (statsData.success && statsData.data) {
                setStats(statsData.data);
            } else {
                setStats({ totalRevenue: 0, totalTransactions: 0, totalItemsSold: 0, paymentMethods: {} });
            }


            let fetchedSales = [];
            if (salesData.success && Array.isArray(salesData.data?.sales)) {
                fetchedSales = salesData.data.sales;
            } else if (salesData.success && Array.isArray(salesData.data)) {
                fetchedSales = salesData.data;
            }

            // Exclude voided sales from dashboard view
            fetchedSales = fetchedSales.filter(s => s.status !== 'voided');

            setSales(fetchedSales);

            setSales(fetchedSales);

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

            const items = sale.items || [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const qty = Number(item.quantity || item.qty || 0);
                const buyingPrice = Number(item.buyingPrice || item.costPrice || item.cost || 0);
                const sellingPrice = Number(item.sellingPrice || item.unitPrice || item.price || 0);
                const totalCost = buyingPrice * qty;
                const totalIncome = sellingPrice * qty;
                const margin = totalIncome - totalCost;

                rows.push({
                    saleId: sale.id,
                    itemIndex: i,
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
        let result = sales;

        // Apply debt filter sidebar/btn if active
        if (debtFilter) {
            result = result.filter(s =>
                s.paymentMethod === 'credit' ||
                s.paymentMethod === 'debt' ||
                (s.paymentMethod === 'mixed' && Array.isArray(s.payments) && s.payments.some(p => p.method === 'credit' || p.method === 'debt'))
            );
        }

        // Apply wallet filter (Cash, Mpesa, or specific Bank)
        if (walletFilter) {
            const filter = walletFilter.toLowerCase();
            result = result.filter(s => {
                const method = (s.paymentMethod || "").toLowerCase();
                const bank = (s.bankName || "").toLowerCase();

                // 1. Check primary method/bank
                let matches = false;
                if (filter === 'cash') matches = method === 'cash';
                else if (filter === 'mpesa') matches = method.includes('mpesa') || method.includes('mobile');
                else matches = bank.includes(filter) || method.includes(filter);

                if (matches) return true;

                // 2. Check payments array (includes original parts and webhook updates)
                if (Array.isArray(s.payments)) {
                    return s.payments.some(p => {
                        const pm = (p.method || p.paymentMethod || "").toLowerCase();
                        const pb = (p.bankName || "").toLowerCase();
                        if (filter === 'cash') return pm === 'cash';
                        if (filter === 'mpesa') return pm.includes('mpesa') || pm.includes('mobile');
                        return pb.includes(filter) || pm.includes(filter);
                    });
                }
                return false;
            });
        }

        if (!search.trim()) return result;
        const q = search.toLowerCase();
        return result.filter(
            (s) =>
                (s.receiptNumber || "").toLowerCase().includes(q) ||
                (s.customerName || "").toLowerCase().includes(q) ||
                (s.customer?.name || "").toLowerCase().includes(q) ||
                (s.items || []).some((i) => (i.productName || "").toLowerCase().includes(q))
        );
    }, [sales, search, debtFilter, walletFilter]);

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

    const displayStats = useMemo(() => {
        if (!stats) return { totalRevenue: 0, totalTransactions: 0, cash: 0, mpesa: 0, debt: 0, banks: {} };

        return {
            totalRevenue: stats.totalRevenue || 0,
            totalTransactions: stats.totalTransactions || 0,
            cash: stats.paymentMethods?.cash?.amount || 0,
            mpesa: stats.paymentMethods?.mpesa?.amount || 0,
            debt: stats.paymentMethods?.credit?.amount || 0,
            banks: stats.paymentMethods?.bank?.breakdown || {}
        };
    }, [stats]);

    const resetFilters = () => {
        setSelectedVehicle("");
        setSelectedDate("");
        setEtrFilter("");
        setDebtFilter(false);
        setWalletFilter("");
        setSearch("");
    };

    const handleItemUpdate = async () => {
        if (!editingItem || isUpdatingQty) return;

        const { saleId, itemIndex, field, value } = editingItem;
        const newValue = parseFloat(value);

        if (isNaN(newValue) || newValue <= 0) {
            setEditingItem(null);
            return;
        }

        try {
            setIsUpdatingQty(true);
            const payload = { [field === 'qty' ? 'quantity' : 'unitPrice']: newValue };
            const res = await api.updateSaleItem(saleId, itemIndex, payload);
            if (res.success) {
                // Refresh data to reflect changes
                fetchData();
                setEditingItem(null);
            }
        } catch (err) {
            console.error(`Failed to update ${field}:`, err);
            alert(err.message || `Failed to update ${field}`);
        } finally {
            setIsUpdatingQty(false);
        }
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

                            {/* View Voided Sales Link */}
                            <button
                                onClick={() => router.push('/voided-sales')}
                                className="flex items-center gap-2 bg-white text-slate-600 px-3 py-1.5 rounded border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                                <Activity size={14} className="text-slate-400" />
                                Reversed Sales
                            </button>

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

                            {/* Debt Toggle Filter */}
                            <button
                                onClick={() => setDebtFilter(!debtFilter)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm font-medium transition-colors ${debtFilter
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                            >
                                <CreditCard size={14} className={debtFilter ? "text-amber-600" : "text-slate-400"} />
                                Debt
                            </button>


                            {/* Wallet filter */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-3 py-1.5">
                                <CreditCard size={14} className="text-slate-400" />
                                <select
                                    value={walletFilter}
                                    onChange={(e) => setWalletFilter(e.target.value)}
                                    className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer appearance-none outline-none"
                                >
                                    <option value="">All Wallets</option>
                                    <option value="cash">Cash Wallet</option>
                                    <option value="mpesa">M-Pesa Wallet</option>
                                    {Object.keys(displayStats.banks || {}).map(bank => (
                                        <option key={bank} value={bank}>{bank}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Single Date Picker */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-3 py-1.5 text-sm">
                                <span className="text-slate-400 text-xs font-medium uppercase mr-1">Date:</span>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent border-none text-slate-700 focus:ring-0 cursor-pointer w-40"
                                />
                            </div>

                            {(selectedVehicle || selectedDate || etrFilter || debtFilter || search) && (
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
                    <div className="space-y-6">
                        {/* Primary Wallets */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Total Revenue"
                                value={`KSh ${displayStats.totalRevenue.toLocaleString()}`}
                                subValue={`${displayStats.totalTransactions} transactions`}
                            />
                            <StatCard
                                title="Cash Sales"
                                value={`KSh ${displayStats.cash.toLocaleString()}`}
                            />
                            <StatCard
                                title="M-Pesa Sales"
                                value={`KSh ${displayStats.mpesa.toLocaleString()}`}
                            />
                            <StatCard
                                title="Outstanding Debt"
                                value={`KSh ${displayStats.debt.toLocaleString()}`}
                                tag={debtFilter ? "FILTERED" : null}
                            />
                        </div>

                        {/* Bank Wallets Section */}
                        {Object.keys(displayStats.banks || {}).length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider px-1">
                                    <div className="w-1 h-3 bg-slate-300 rounded-full"></div>
                                    Bank Wallets
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    {Object.entries(displayStats.banks).map(([name, amount]) => (
                                        <StatCard
                                            key={name}
                                            title={name}
                                            value={`KSh ${amount.toLocaleString()}`}
                                            tag="BANK"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
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
                                        ) : (filteredSales.length === 0 && (!stats?.collectionRecords || stats.collectionRecords.length === 0)) ? (
                                            <tr>
                                                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">No transactions found.</td>
                                            </tr>
                                        ) : (
                                            <>
                                                {/* ── Collection Records (Settlements) ── */}
                                                {(stats?.collectionRecords || []).map((record) => (
                                                    <tr key={`coll-${record.id}`} className="bg-amber-50/30 hover:bg-amber-50/50 transition-colors">
                                                        <td className="px-5 py-3" />
                                                        <td className="px-5 py-3 font-mono text-slate-500 text-xs whitespace-nowrap">
                                                            <div>{record.debtCode}</div>
                                                            <div className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded w-fit mt-1 uppercase tracking-tight">DEBT COLLECTION</div>
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <div className="text-slate-800">{convertTimestamp(record.date)?.toLocaleDateString() || "—"}</div>
                                                            <div className="text-xs text-slate-400">Settlement</div>
                                                        </td>
                                                        <td className="px-5 py-3 text-slate-700 whitespace-nowrap">{record.vehiclePlate}</td>
                                                        <td className="px-5 py-3 text-slate-700 whitespace-nowrap">{record.customerName}</td>
                                                        <td className="px-5 py-3 text-slate-500 italic text-xs">Payment toward outstanding debt</td>
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-1.5 text-[10px]">
                                                                <PaymentBadge method={record.method} />
                                                                <span className="text-slate-700 font-medium">KSh {fmtInt(record.amount)}</span>
                                                                {record.bankName && (
                                                                    <span className="text-sky-600 text-[9px] font-bold uppercase">({record.bankName})</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                                                            {fmt(record.amount)}
                                                        </td>
                                                    </tr>
                                                ))}

                                                {/* ── Sale Records ── */}
                                                {filteredSales.map((sale) => {
                                                const vehicle = vehicles.find((v) => v.id === sale.vehicleId);
                                                const isSelected = selectedSales.includes(sale.id);
                                                const date = convertTimestamp(sale.saleDate);
                                                const consolidated = new Map();
                                                const addPayment = (method, bank, amount) => {
                                                    if (!method) return;
                                                    const m = method.toLowerCase();
                                                    const b = (bank || "").toLowerCase();
                                                    const key = `${m}|${b}`;
                                                    const existing = consolidated.get(key) || { method: m, bank: b, amount: 0 };
                                                    consolidated.set(key, { ...existing, amount: existing.amount + Number(amount || 0) });
                                                };

                                                if (Array.isArray(sale.payments)) {
                                                    sale.payments.forEach(p => addPayment(p.method || p.paymentMethod, p.bankName, p.amount));
                                                } else if (sale.paymentMethod !== 'credit' && sale.paymentMethod !== 'debt') {
                                                    addPayment(sale.paymentMethod, sale.bankName, sale.grandTotal);
                                                }

                                                const paymentItems = Array.from(consolidated.values()).filter(i => i.amount > 0);

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
                                                            <div className="flex flex-col gap-0.5">
                                                                {paymentItems.length > 0 ? (
                                                                    paymentItems.map((item, idx) => (
                                                                        <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                                                                            <PaymentBadge method={item.method} />
                                                                            <span className="text-slate-700 font-medium">KSh {fmtInt(item.amount)}</span>
                                                                            {item.bank && (
                                                                                <span className="text-sky-600 text-[9px] font-bold uppercase">({item.bank})</span>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <PaymentBadge method={sale.paymentMethod} />
                                                                )}
                                                                <DebtStatusBadge sale={sale} />
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-right font-semibold text-slate-900 whitespace-nowrap" onClick={() => router.push(`/sales/${sale.id}`)}>
                                                            {fmt(sale.grandTotal)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </>
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
                                                filteredPnlRows.map((row, idx) => {
                                                    const isEditing = editingItem?.saleId === row.saleId && editingItem?.itemIndex === row.itemIndex;

                                                    return (
                                                        <tr
                                                            key={`${row.saleId}-${row.itemIndex}`}
                                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${isEditing ? "bg-sky-50" : ""}`}
                                                            onClick={() => !isEditing && router.push(`/sales/${row.saleId}`)}
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
                                                            <td
                                                                className="px-4 py-2.5 text-right text-slate-700 font-mono"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!isUpdatingQty) {
                                                                        setEditingItem({ saleId: row.saleId, itemIndex: row.itemIndex, field: 'qty', value: row.qty });
                                                                    }
                                                                }}
                                                            >
                                                                {editingItem?.saleId === row.saleId && editingItem?.itemIndex === row.itemIndex && editingItem?.field === 'qty' ? (
                                                                    <div className="flex justify-end items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            autoFocus
                                                                            value={editingItem.value}
                                                                            onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') handleItemUpdate();
                                                                                if (e.key === 'Escape') setEditingItem(null);
                                                                            }}
                                                                            className="w-16 px-1.5 py-0.5 border border-sky-400 rounded text-right focus:outline-none"
                                                                            disabled={isUpdatingQty}
                                                                        />
                                                                        {isUpdatingQty && (
                                                                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="group flex justify-end items-center gap-1.5 cursor-text hover:text-sky-600">
                                                                        {fmtInt(row.qty)}
                                                                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                                {fmt(row.buyingPrice)}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                                {fmt(row.totalCost)}
                                                            </td>
                                                            <td
                                                                className="px-4 py-2.5 text-right text-slate-700 font-mono"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!isUpdatingQty) {
                                                                        setEditingItem({ saleId: row.saleId, itemIndex: row.itemIndex, field: 'sellingPrice', value: row.sellingPrice });
                                                                    }
                                                                }}
                                                            >
                                                                {editingItem?.saleId === row.saleId && editingItem?.itemIndex === row.itemIndex && editingItem?.field === 'sellingPrice' ? (
                                                                    <div className="flex justify-end items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            autoFocus
                                                                            value={editingItem.value}
                                                                            onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') handleItemUpdate();
                                                                                if (e.key === 'Escape') setEditingItem(null);
                                                                            }}
                                                                            className="w-24 px-1.5 py-0.5 border border-sky-400 rounded text-right focus:outline-none"
                                                                            disabled={isUpdatingQty}
                                                                        />
                                                                        {isUpdatingQty && (
                                                                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="group flex justify-end items-center gap-1.5 cursor-text hover:text-sky-600">
                                                                        {fmt(row.sellingPrice)}
                                                                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                                {fmt(row.totalIncome)}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-slate-700 font-mono">
                                                                {fmt(row.margin)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
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
