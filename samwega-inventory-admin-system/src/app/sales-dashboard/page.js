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
    AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { debtDb } from "../../lib/debtFirebase";
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

const DebtStatusBadge = ({ debt }) => {
    if (!debt) return null;

    // Use displayStatus from backend or derive it
    const status = debt.displayStatus || (
        debt.remainingAmount === 0 ? 'paid' :
            (debt.paidAmount > 0 ? 'partial' :
                (debt.status === 'overdue' ? 'overdue' : 'unpaid'))
    );

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
            label: `Partial: KSh ${fmt(debt.remainingAmount)}`
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
            label: "Unpaid"
        },
    };

    const style = config[status] || config.unpaid;

    return (
        <div className="flex flex-col gap-1 mt-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold border ${style.bg} ${style.text} ${style.border} uppercase tracking-tight`}>
                {style.icon}
                {style.label}
            </span>
            {status === 'paid' && debt.paidPaymentMethod && (
                <span className="text-[9px] text-slate-400 font-medium px-0.5 italic">
                    via {debt.paidPaymentMethod}
                </span>
            )}
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
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [etrFilter, setEtrFilter] = useState("");
    const [debtFilter, setDebtFilter] = useState(false);
    const [debtEnrichment, setDebtEnrichment] = useState({});
    const [paymentLogsMap, setPaymentLogsMap] = useState({});
    const [debtSummary, setDebtSummary] = useState(null);
    const [search, setSearch] = useState(""); // searches receipt#, customer, items
    const [walletFilter, setWalletFilter] = useState(""); // filters by Cash, Mpesa, or Bank Name
    const [isEnriching, setIsEnriching] = useState(false); // track async calculations (debt/logs)

    // Transactions-mode specific
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedSales, setSelectedSales] = useState([]);

    // ── Fetch ────────────────────────────────────────────────────────────────

    useEffect(() => { fetchVehicles(); }, []);
    useEffect(() => { fetchData(); }, [selectedVehicle, startDate, endDate, etrFilter, debtFilter]);

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

            const [statsData, salesData, debtSumData] = await Promise.all([
                api.getSalesStats(filters),
                api.getSales({ ...filters, limit: 2000 }), // Increased limit for accurate dashboard aggregation
                api.getDebtDashboardSummary(filters)
            ]);

            if (statsData.success && statsData.data) {
                setStats(statsData.data);
            } else {
                setStats({ totalRevenue: 0, totalTransactions: 0, totalItemsSold: 0, paymentMethods: {} });
            }

            if (debtSumData.success) {
                setDebtSummary(debtSumData.data);
            }

            let fetchedSales = [];
            if (salesData.success && Array.isArray(salesData.data?.sales)) {
                fetchedSales = salesData.data.sales;
            } else if (salesData.success && Array.isArray(salesData.data)) {
                fetchedSales = salesData.data;
            }

            setSales(fetchedSales);

            // Fetch live debt records for enrichment if there are credit/mixed sales
            const creditSaleIds = fetchedSales
                .filter(s => s.paymentMethod === 'credit' || s.paymentMethod === 'mixed')
                .map(s => s.id);

            if (creditSaleIds.length > 0) {
                try {
                    setIsEnriching(true);
                    const enrichRes = await api.enrichSalesWithDebt(creditSaleIds);
                    if (enrichRes.success) {
                        setDebtEnrichment(enrichRes.data);

                        // Fetch payment logs from Debt System (Client SDK approach)
                        const debtIds = Object.values(enrichRes.data).map(d => d.id).filter(Boolean);
                        if (debtIds.length > 0) {
                            const logsMap = {};
                            // Use limit or batch if there are many, but for now fetch for all debtIds
                            // Firestore "in" query limited to 30 items
                            for (let i = 0; i < debtIds.length; i += 30) {
                                const batch = debtIds.slice(i, i + 30);
                                const q = query(
                                    collection(debtDb, "payment_logs"),
                                    where("debtId", "in", batch),
                                    where("success", "==", true)
                                );
                                const querySnapshot = await getDocs(q);
                                querySnapshot.forEach(docSnap => {
                                    const log = docSnap.data();
                                    if (!logsMap[log.debtId]) logsMap[log.debtId] = [];
                                    logsMap[log.debtId].push({ id: docSnap.id, ...log });
                                });
                            }
                            setPaymentLogsMap(logsMap);
                        }
                    }
                } catch (err) {
                    console.warn("Failed to enrich sales with debt data:", err);
                } finally {
                    setIsEnriching(false);
                }
            } else {
                setIsEnriching(false);
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
        let result = sales;

        // Apply debt filter sidebar/btn if active
        if (debtFilter) {
            result = result.filter(s =>
                s.paymentMethod === 'credit' ||
                s.paymentMethod === 'debt' ||
                (s.paymentMethod === 'mixed' && Array.isArray(s.payments) && s.payments.some(p => p.method === 'credit' || p.method === 'debt'))
            );
        }

        // Apply wallet filter (Cash, Mpesa, specific Bank)
        if (walletFilter) {
            const filter = walletFilter.toLowerCase();
            result = result.filter(s => {
                // 1. Check original payments
                const method = (s.paymentMethod || "").toLowerCase();
                const bank = (s.bankName || "").toLowerCase();

                let matchesOriginal = false;
                if (method === 'mixed' && Array.isArray(s.payments)) {
                    matchesOriginal = s.payments.some(p => {
                        const pm = (p.method || p.paymentMethod || "").toLowerCase();
                        const pb = (p.bankName || "").toLowerCase();
                        if (filter === 'cash') return pm === 'cash';
                        if (filter === 'mpesa') return pm.includes('mpesa') || pm.includes('mobile');
                        return pb.includes(filter) || pm.includes(filter);
                    });
                } else {
                    if (filter === 'cash') matchesOriginal = method === 'cash';
                    else if (filter === 'mpesa') matchesOriginal = method.includes('mpesa') || method.includes('mobile');
                    else matchesOriginal = bank.includes(filter) || method.includes(filter);
                }
                if (matchesOriginal) return true;

                // 2. Check debt enrichment / logs
                const enrichment = debtEnrichment[s.id];
                if (enrichment) {
                    const logs = paymentLogsMap[enrichment.id] || [];
                    const matchesLogs = logs.some(log => {
                        const lm = (log.paymentMethod || "").toLowerCase();
                        const lb = (log.bankName || "").toLowerCase();
                        if (filter === 'cash') return lm === 'cash';
                        if (filter === 'mpesa') return lm.includes('mpesa') || lm.includes('mobile');
                        return lb.includes(filter) || lm.includes(filter);
                    });
                    if (matchesLogs) return true;

                    // Check enrichment summary paid info if logs missing
                    if (logs.length === 0 && enrichment.paidAmount > 0) {
                        const pm = (enrichment.paidPaymentMethod || "").toLowerCase();
                        const pb = (enrichment.bankName || "").toLowerCase();
                        if (filter === 'cash') return pm === 'cash';
                        if (filter === 'mpesa') return pm.includes('mpesa') || pm.includes('mobile');
                        return pb.includes(filter) || pm.includes(filter);
                    }
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
    }, [sales, search, debtFilter, walletFilter, debtEnrichment, paymentLogsMap]);

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

    const computedStats = useMemo(() => {
        const stats = {
            totalRevenue: 0,
            totalTransactions: filteredSales.length,
            cash: 0,
            mpesa: 0,
            banks: {}, // breakdown by bank name
            debt: 0
        };

        // Helper for bank identification and naming
        const getBankName = (method = "", bankName = "") => {
            const m = String(method || "").toLowerCase();
            const b = String(bankName || "").toLowerCase();

            // Priority list of known banks for normalization
            const knownBanks = ['Equity', 'KCB', 'Absa', 'Family', 'Stanchart', 'Coop', 'DTB'];
            for (const name of knownBanks) {
                if (m.includes(name.toLowerCase()) || b.includes(name.toLowerCase())) {
                    // Try to preserve sub-names like "Old KCB" / "New KCB" if they exist in the literal strings
                    if (b.toLowerCase().includes(name.toLowerCase())) return bankName;
                    return name;
                }
            }

            if (m.includes('bank') || m.includes('card') || m.includes('cheque')) {
                return bankName || 'Other Bank';
            }
            return null;
        };

        const checkIsMpesa = (method = "") => {
            const m = String(method || "").toLowerCase();
            return m.includes('mpesa') || m.includes('mobile');
        };

        filteredSales.forEach(sale => {
            const amount = Number(sale.grandTotal || 0);
            stats.totalRevenue += amount;

            // 1. Initial Payment Breakdown
            const method = (sale.paymentMethod || 'cash').toLowerCase();

            if (method === 'mixed' && Array.isArray(sale.payments)) {
                sale.payments.forEach(p => {
                    const pMethod = (p.method || p.paymentMethod || '').toLowerCase();
                    const pAmount = Number(p.amount || 0);
                    const pBank = p.bankName || '';

                    if (pMethod === 'cash') stats.cash += pAmount;
                    else if (checkIsMpesa(pMethod)) stats.mpesa += pAmount;
                    else {
                        const bName = getBankName(pMethod, pBank);
                        if (bName) stats.banks[bName] = (stats.banks[bName] || 0) + pAmount;
                    }
                });
            } else if (method === 'cash') {
                stats.cash += amount;
            } else if (checkIsMpesa(method)) {
                stats.mpesa += amount;
            } else {
                const bName = getBankName(method, sale.bankName);
                if (bName) stats.banks[bName] = (stats.banks[bName] || 0) + amount;
            }

            // 2. Debt & Collections breakdown
            const enrichment = debtEnrichment[sale.id];
            if (enrichment) {
                // The current outstanding debt goes to the debt wallet
                stats.debt += Number(enrichment.remainingAmount || 0);

                // For collections, use the payment logs history (most accurate)
                // enrichment.id is the debt system's document ID
                const logs = paymentLogsMap[enrichment.id] || [];
                if (logs.length > 0) {
                    logs.forEach(log => {
                        const logAmount = Number(log.amount || 0);
                        const logMethod = (log.paymentMethod || '').toLowerCase();
                        const logBank = log.bankName || '';

                        if (logMethod === 'cash') stats.cash += logAmount;
                        else if (checkIsMpesa(logMethod)) stats.mpesa += logAmount;
                        else {
                            const bName = getBankName(logMethod, logBank);
                            if (bName) stats.banks[bName] = (stats.banks[bName] || 0) + logAmount;
                            else stats.cash += logAmount; // fallback
                        }
                    });
                } else if (enrichment.paidAmount > 0) {
                    // Fallback to enrichment summary ONLY if logs haven't loaded yet
                    const paid = Number(enrichment.paidAmount);
                    const pMethod = (enrichment.paidPaymentMethod || '').toLowerCase();
                    const pBank = enrichment.bankName || '';

                    if (pMethod === 'cash') stats.cash += paid;
                    else if (checkIsMpesa(pMethod)) stats.mpesa += paid;
                    else {
                        const bName = getBankName(pMethod, pBank);
                        if (bName) stats.banks[bName] = (stats.banks[bName] || 0) + paid;
                        else stats.cash += paid;
                    }
                }
            } else if (method === 'credit' || method === 'debt') {
                stats.debt += amount;
            } else if (method === 'mixed' && Array.isArray(sale.payments)) {
                const creditPortion = sale.payments
                    .filter(p => p.method === 'credit' || p.method === 'debt')
                    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
                stats.debt += creditPortion;
            }
        });

        return stats;
    }, [filteredSales, debtEnrichment, paymentLogsMap]);

    const resetFilters = () => {
        setSelectedVehicle("");
        setStartDate("");
        setEndDate("");
        setEtrFilter("");
        setDebtFilter(false);
        setWalletFilter("");
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
                                    {Object.keys(computedStats.banks || {}).map(bank => (
                                        <option key={bank} value={bank}>{bank}</option>
                                    ))}
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

                            {(selectedVehicle || startDate || endDate || etrFilter || debtFilter || search) && (
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
                                value={isEnriching ? "..." : `KSh ${computedStats.totalRevenue.toLocaleString()}`}
                                subValue={`${computedStats.totalTransactions} transactions`}
                            />
                            <StatCard
                                title="Cash Sales"
                                value={isEnriching ? "..." : `KSh ${computedStats.cash.toLocaleString()}`}
                            />
                            <StatCard
                                title="M-Pesa Sales"
                                value={isEnriching ? "..." : `KSh ${computedStats.mpesa.toLocaleString()}`}
                            />
                            <StatCard
                                title="Outstanding Debt"
                                value={isEnriching ? "..." : `KSh ${computedStats.debt.toLocaleString()}`}
                                tag={debtFilter ? "FILTERED" : null}
                            />
                        </div>

                        {/* Bank Wallets Section */}
                        {Object.keys(computedStats.banks || {}).length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider px-1">
                                    <div className="w-1 h-3 bg-slate-300 rounded-full"></div>
                                    Bank Wallets
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    {Object.entries(computedStats.banks).map(([name, amount]) => (
                                        <StatCard
                                            key={name}
                                            title={name}
                                            value={isEnriching ? "..." : `KSh ${amount.toLocaleString()}`}
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
                                                            <div className="flex flex-col gap-0.5">
                                                                {(() => {
                                                                    const enrichment = debtEnrichment[sale.id];
                                                                    const logs = enrichment ? (paymentLogsMap[enrichment.id] || []) : [];

                                                                    // Map to consolidate: key = "method|bank"
                                                                    const consolidated = new Map();

                                                                    const addPayment = (method, bank, amount) => {
                                                                        if (!method) return;
                                                                        const m = method.toLowerCase();
                                                                        const b = (bank || "").toLowerCase();
                                                                        const key = `${m}|${b}`;
                                                                        const existing = consolidated.get(key) || { method: m, bank: b, amount: 0 };
                                                                        consolidated.set(key, { ...existing, amount: existing.amount + Number(amount || 0) });
                                                                    };

                                                                    // 1. Add original payments
                                                                    if (sale.paymentMethod === 'mixed' && Array.isArray(sale.payments)) {
                                                                        sale.payments.forEach(p => addPayment(p.method || p.paymentMethod, p.bankName, p.amount));
                                                                    } else if (sale.paymentMethod !== 'credit' && sale.paymentMethod !== 'debt') {
                                                                        // For non-mixed/non-credit, the entire paid part (total - remaining) is the original method
                                                                        const paidOrig = sale.grandTotal - (sale.remainingAmount || 0);
                                                                        if (paidOrig > 0) addPayment(sale.paymentMethod, sale.bankName, paidOrig);
                                                                    }

                                                                    // 2. Add collection logs
                                                                    logs.forEach(log => addPayment(log.paymentMethod, log.bankName, log.amount));

                                                                    // If no logs but paidAmount exists in enrichment summary
                                                                    if (enrichment && logs.length === 0 && enrichment.paidAmount > 0) {
                                                                        addPayment(enrichment.paidPaymentMethod, enrichment.bankName, enrichment.paidAmount);
                                                                    }

                                                                    const items = Array.from(consolidated.values()).filter(i => i.amount > 0);

                                                                    return (
                                                                        <>
                                                                            {items.length > 0 ? (
                                                                                items.map((item, idx) => (
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
                                                                            {enrichment && <DebtStatusBadge debt={enrichment} />}
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
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
