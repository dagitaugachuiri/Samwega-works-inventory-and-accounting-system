"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Edit, Trash2, Building2, Calendar, DollarSign, X, CreditCard, RotateCcw } from "lucide-react";
import api from "../../lib/api";
import Link from "next/link";
import PaymentModal from "../../components/PaymentModal";
import AlertContainer, { useAlert } from "../../components/Alert";

export default function InvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [form, setForm] = useState({
        supplierId: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        items: [],
        totalAmount: "",
        paidAmount: "0",
        notes: "",
    });
    
    const [selectedIds, setSelectedIds] = useState([]);
    const [showCleanup, setShowCleanup] = useState(false);
    const EMPTY_FILTERS = { startDate: "", endDate: "", supplierId: "", paymentStatus: "", etrStatus: "", minAmount: "", maxAmount: "", view: "active" };
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [summary, setSummary] = useState(null);
    const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && !(k === "view" && v === "active")).length;
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [paymentModal, setPaymentModal] = useState({ open: false, invoice: null });
    const alert = useAlert();

    const [user, setUser] = useState(null);
    const isAdmin = user?.role === "admin";
    const canCreate = user?.role === "admin" || user?.role === "store_manager";

    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        fetchSuppliers();
        api.getCurrentUser()
            .then((res) => { if (res.success) setUser(res.data); })
            .catch((e) => console.error("Failed to load user:", e));
    }, []);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        setSelectedIds([]); // never keep ticks from another page or search
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch, filters]);

    const fetchSuppliers = async () => {
        try {
            const res = await api.getSupplierOptions();
            if (res.success && res.data) {
                const list = res.data.suppliers || res.data;
                setSuppliers(Array.isArray(list) ? list : []);
            }
        } catch (error) {
            console.error("Failed to fetch suppliers:", error);
        }
    };

    const fetchData = async () => {
        try {
            const params = { page, limit: 20 };
            // dates are whole days in local time (Kenya), so "to" includes the last day fully
            if (filters.startDate) params.startDate = new Date(`${filters.startDate}T00:00:00`).toISOString();
            if (filters.endDate) params.endDate = new Date(`${filters.endDate}T23:59:59`).toISOString();
            if (filters.supplierId) params.supplierId = filters.supplierId;
            if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
            if (filters.etrStatus) params.etrStatus = filters.etrStatus;
            if (filters.minAmount !== "") params.minAmount = filters.minAmount;
            if (filters.maxAmount !== "") params.maxAmount = filters.maxAmount;
            if (filters.view === "reversed") params.status = "voided";
            if (debouncedSearch) params.search = debouncedSearch;
            const res = await api.getInvoices(params);
            if (res.success && res.data) {
                const list = res.data.invoices || res.data;
                setInvoices(Array.isArray(list) ? list : []);
                setPagination(res.pagination || res.data.pagination || null);
                setSummary(res.summary || null);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            alert.error("Failed to load invoices: " + error.message);
        } finally {
            setLoading(false); // only the first load shows the full-page spinner
        }
    };

    // Generate invoice number: ID-[supplier shortcode][date]-[random]
    const generateInvoiceNumber = (supplierId, date) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (!supplier) return "";

        // Create shortcode from supplier name (first 3 letters uppercase)
        const shortcode = supplier.name
            .replace(/[^a-zA-Z]/g, '')
            .substring(0, 3)
            .toUpperCase();

        // Format date as YYYYMMDD
        const dateStr = date.replace(/-/g, '');

        // Add random suffix for uniqueness
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();

        return `ID-${shortcode}${dateStr}-${suffix}`;
    };

    const handleOpenModal = (invoice = null) => {
        if (invoice) {
            setEditingInvoice(invoice);
            setForm({
                supplierId: invoice.supplierId || "",
                invoiceDate: invoice.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0],
                items: invoice.items || [],
                totalAmount: invoice.totalAmount?.toString() || "",
                paidAmount: (invoice.amountPaid || invoice.paidAmount || 0).toString(),
                notes: invoice.notes || "",
            });
        } else {
            setEditingInvoice(null);
            setForm({
                supplierId: "",
                invoiceDate: new Date().toISOString().split('T')[0],
                items: [],
                totalAmount: "",
                paidAmount: "0",
                notes: "",
            });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.supplierId) {
            alert.error("Please select a supplier");
            return;
        }
        if (!form.totalAmount) {
            alert.error("Please enter total amount");
            return;
        }

        setSaving(true);
        try {
            const totalAmount = parseFloat(form.totalAmount);
            const amountPaid = parseFloat(form.paidAmount) || 0;

            if (editingInvoice) {
                // When editing, don't change the invoice number
                const payload = {
                    // only sent when changed: lets you fix an "Unknown" supplier
                    ...(form.supplierId !== editingInvoice.supplierId ? { supplierId: form.supplierId } : {}),
                    invoiceDate: new Date(form.invoiceDate).toISOString(),
                    totalAmount,
                    amountPaid,
                    paymentStatus: amountPaid >= totalAmount ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'),
                    notes: form.notes || undefined,
                };
                await api.updateInvoice(editingInvoice.id, payload);
            } else {
                // Only generate new invoice number for new invoices
                const invoiceNumber = generateInvoiceNumber(form.supplierId, form.invoiceDate);
                const payload = {
                    supplierId: form.supplierId,
                    invoiceNumber,
                    invoiceDate: new Date(form.invoiceDate).toISOString(),
                    items: form.items, //NEW
                    totalAmount,
                    amountPaid,
                    paymentStatus: amountPaid >= totalAmount ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'),
                    notes: form.notes || undefined,
                };
                await api.createInvoice(payload);
            }

            setShowModal(false);
            fetchData();
            alert.success(editingInvoice ? "Invoice updated successfully" : "Invoice created successfully");
        } catch (error) {
            alert.error("Failed to save: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const setFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
    const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); };
    const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const applyPreset = (preset) => {
        const today = new Date();
        let from = new Date(today);
        if (preset === "week") from.setDate(today.getDate() - 6);
        if (preset === "month") from = new Date(today.getFullYear(), today.getMonth(), 1);
        setFilters(f => ({ ...f, startDate: toIso(from), endDate: toIso(today) }));
        setPage(1);
    };

    const handleReverse = async (inv) => {
        const reason = window.prompt(
            `Reverse invoice ${inv.invoiceNumber}?\n\nThe stock it brought in is taken back out of inventory and its amount comes off the supplier. ` +
            `The invoice stays on record under "Reversed".\n\nReason (required):`
        );
        if (reason === null) return;
        if (!reason.trim()) { alert.error("A reason is required"); return; }
        try {
            await api.reverseInvoice(inv.id, reason.trim());
            alert.success("Invoice reversed");
            fetchData();
        } catch (error) {
            alert.error("Failed to reverse: " + error.message);
        }
    };

    // Admin clean-up: always previews first, then asks before changing anything
    const runCleanup = async (action) => {
        const what = action === 'delete-empty'
            ? "delete invoices that have no items, no total and no payments"
            : action === 'backfill-keyed-by'
                ? "fill in who keyed these invoices in, from the activity log"
                : "rebuild item counts and totals from the stock actually received";
        try {
            const preview = await api.cleanupInvoices(action, true);
            const { count, invoices: sample } = preview.data;
            if (!count) { alert.success("Nothing to do - no invoices need this."); return; }
            const names = sample.slice(0, 8).map(i => i.invoiceNumber).join(", ");
            if (!window.confirm(`This will ${what}.\n\n${count} invoice(s): ${names}${count > 8 ? ", ..." : ""}\n\nContinue?`)) return;
            const done = await api.cleanupInvoices(action, false);
            alert.success(`${done.data.count} invoice(s) updated`);
            fetchData();
        } catch (error) {
            alert.error("Clean-up failed: " + error.message);
        }
    };

    const handleDelete = async (id) => {
        const confirmed = window.confirm("Delete this invoice? This action cannot be undone.");
        if (!confirmed) return;

        try {
            await api.deleteInvoice(id);
            fetchData();
            alert.success("Invoice deleted successfully");
        } catch (error) {
            alert.error("Failed to delete: " + error.message);
        }
    };

    const filteredInvoices = invoices;

    const previewInvoiceNumber = form.supplierId && form.invoiceDate
        ? generateInvoiceNumber(form.supplierId, form.invoiceDate)
        : "ID-XXX00000000";

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-600">Loading invoices…</p>
                </div>
            </div>
        );
    }
    const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === filteredInvoices.length ? [] : filteredInvoices.map(i => i.id));
    };
    const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} invoice(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const failed = [];
    for (const id of selectedIds) {
        try { await api.deleteInvoice(id); } catch (e) { failed.push({ id, message: e.message }); }
    }
    setBulkDeleting(false);
    setSelectedIds([]);
    fetchData();
    if (failed.length) {
        alert.error(`${failed.length} could not be deleted: ${failed[0].message}${failed.length > 1 ? ' (+ more)' : ''}`);
    } else {
        alert.success('Selected invoices deleted');
    }
   };

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Purchase Invoices</h1>
                    <p className="text-sm text-slate-500">Manage supplier invoices and procurement records</p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <div className="relative">
                            <button onClick={() => setShowCleanup(v => !v)} className="btn-ghost px-3 py-2 text-sm">
                                Clean up ▾
                            </button>
                            {showCleanup && (
                                <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                    <button onClick={() => { setShowCleanup(false); runCleanup('repair-totals'); }} className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50">
                                        Repair zero totals
                                        <span className="block text-xs text-slate-400">Invoices that show 0 but have items</span>
                                    </button>
                                    <button onClick={() => { setShowCleanup(false); runCleanup('backfill-keyed-by'); }} className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50">
                                        Fill "keyed in by"
                                        <span className="block text-xs text-slate-400">Older invoices, from the activity log</span>
                                    </button>
                                    <button onClick={() => { setShowCleanup(false); runCleanup('delete-empty'); }} className="block w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                                        Delete empty invoices
                                        <span className="block text-xs text-slate-400">No items, no total, no payments</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {canCreate && (
                    <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
                        <Plus size={16} />
                        New Invoice
                    </button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search invoices..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field pl-9 w-full"
                />
            </div>

            {/* Filters */}
            <div className="glass-panel p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-400 mr-1">Date</span>
                    <input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={(e) => setFilter("startDate", e.target.value)} className="input-field py-1.5 text-sm" />
                    <span className="text-slate-400 text-sm">to</span>
                    <input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={(e) => setFilter("endDate", e.target.value)} className="input-field py-1.5 text-sm" />
                    <button onClick={() => applyPreset("today")} className="btn-ghost px-2.5 py-1 text-xs">Today</button>
                    <button onClick={() => applyPreset("week")} className="btn-ghost px-2.5 py-1 text-xs">Last 7 days</button>
                    <button onClick={() => applyPreset("month")} className="btn-ghost px-2.5 py-1 text-xs">This month</button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <select value={filters.supplierId} onChange={(e) => setFilter("supplierId", e.target.value)} className="input-field py-1.5 text-sm">
                        <option value="">All suppliers</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={filters.paymentStatus} onChange={(e) => setFilter("paymentStatus", e.target.value)} className="input-field py-1.5 text-sm">
                        <option value="">Any payment status</option>
                        <option value="unpaid">Unpaid (owing)</option>
                        <option value="pending">Not paid at all</option>
                        <option value="partial">Part paid</option>
                        <option value="paid">Fully paid</option>
                    </select>
                    <select value={filters.etrStatus} onChange={(e) => setFilter("etrStatus", e.target.value)} className="input-field py-1.5 text-sm">
                        <option value="">ETR and non-ETR</option>
                        <option value="etr">ETR only</option>
                        <option value="non-etr">Non-ETR only</option>
                    </select>
                    <input type="number" min="0" placeholder="Min amount" value={filters.minAmount} onChange={(e) => setFilter("minAmount", e.target.value)} className="input-field py-1.5 text-sm" />
                    <input type="number" min="0" placeholder="Max amount" value={filters.maxAmount} onChange={(e) => setFilter("maxAmount", e.target.value)} className="input-field py-1.5 text-sm" />
                    <select value={filters.view} onChange={(e) => setFilter("view", e.target.value)} className="input-field py-1.5 text-sm">
                        <option value="active">Active invoices</option>
                        <option value="reversed">Reversed invoices</option>
                    </select>
                </div>
                {(activeFilterCount > 0 || summary) && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
                        {summary ? (
                            <p className="text-slate-600">
                                {pagination?.total ?? 0} invoice(s) &middot; Total <b>KES {summary.totalAmount.toLocaleString()}</b>
                                &middot; Paid <b className="text-emerald-700">KES {summary.amountPaid.toLocaleString()}</b>
                                &middot; Owing <b className="text-amber-700">KES {summary.balanceRemaining.toLocaleString()}</b>
                            </p>
                        ) : <span />}
                        {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="text-sky-600 hover:underline">Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}</button>
                        )}
                    </div>
                )}
            </div>

            {/* New Supplier Link */}
            {suppliers.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                    <p className="text-sm">
                        No suppliers found. <Link href="/suppliers" className="text-amber-900 font-medium underline">Create a supplier first</Link> before adding invoices.
                    </p>
                </div>
            )}

            {/* Invoices Table */}
            <div className="glass-panel overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                        <tr>
                            <th className="px-4 py-3 font-medium">Invoice #</th>
                            <th className="px-4 py-3 font-medium">Supplier</th>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                            <th className="px-4 py-3 font-medium text-right">Paid</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                    {invoices.length === 0 ? "No invoices yet. Create one to get started." : "No invoices match your search."}
                                </td>
                            </tr>
                        ) : (
                            filteredInvoices.map((inv) => (
                                <tr
                                    key={inv.id}
                                    onClick={() => router.push(`/invoices/${inv.id}`)}
                                    className="hover:bg-slate-50 cursor-pointer"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-slate-400" />
                                            <span className="font-mono text-sm font-medium text-slate-900">
                                                {inv.invoiceNumber || inv.id}
                                            </span>
                                            {(inv.itemsCount || 0) === 0 && !(inv.totalAmount > 0) && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-600 border border-rose-200" title="No items, no total - safe to delete">
                                                    Empty
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                        {inv.supplierName || inv.supplier?.name || "Unknown"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                        {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : "N/A"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-medium">
                                        KES {(inv.totalAmount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                        KES {(inv.amountPaid || inv.paidAmount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        {inv.status === 'voided' ? (
                                            <span
                                                className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                                                title={`Reversed${inv.voidedByName ? ` by ${inv.voidedByName}` : ''}${inv.voidReason ? `: ${inv.voidReason}` : ''}`}
                                            >
                                                Reversed
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${inv.paymentStatus === 'paid'
                                                ? 'bg-green-100 text-green-700'
                                                : inv.paymentStatus === 'partial'
                                                    ? 'bg-sky-100 text-sky-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {inv.paymentStatus === 'paid' ? 'Paid' : inv.paymentStatus === 'partial' ? 'Part paid' : 'Pending'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                            {inv.status !== 'voided' && (inv.balanceRemaining || 0) > 0 && (
                                                <button
                                                    onClick={() => setPaymentModal({ open: true, invoice: inv })}
                                                    className="p-1.5 rounded hover:bg-green-50 text-green-600"
                                                    title="Record Payment"
                                                >
                                                    <CreditCard size={14} />
                                                </button>
                                            )}
                                            {inv.status !== 'voided' && (
                                                <button
                                                    onClick={() => handleOpenModal(inv)}
                                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                                                    title="Edit invoice"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            )}
                                            {isAdmin && inv.status !== 'voided' && (
                                                <button
                                                    onClick={() => handleReverse(inv)}
                                                    className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                                                    title="Reverse invoice (keeps it on record)"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                            )}
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDelete(inv.id)}
                                                    className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                                                    title="Delete invoice"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {/* Pagination */}
                {pagination && (
                    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                        <span>
                            {pagination.total
                                ? `Showing ${(page - 1) * pagination.limit + 1}-${(page - 1) * pagination.limit + filteredInvoices.length} of ${pagination.total}`
                                : "No invoices"}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="btn-ghost px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Prev
                            </button>
                            <span>Page {page} of {pagination.totalPages || 1}</span>
                            <button
                                onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                                disabled={page >= (pagination.totalPages || 1)}
                                className="btn-ghost px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingInvoice ? "Edit Invoice" : "New Invoice"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Invoice Number Preview */}
                            <div className="bg-slate-50 rounded-lg p-4 text-center">
                                <p className="text-xs text-slate-500 mb-1">Invoice Number</p>
                                <p className="text-xl font-mono font-bold text-slate-900">
                                    {previewInvoiceNumber}
                                </p>
                            </div>

                            {/* Supplier */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Building2 size={14} className="inline mr-1" />
                                    Supplier *
                                </label>
                                <select
                                    value={form.supplierId}
                                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                                    className="input-field w-full"
                                >
                                    <option value="">Select supplier...</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                {form.supplierId && (() => {
                                    const selectedSupplier = suppliers.find(s => s.id === form.supplierId);
                                    if (selectedSupplier) {
                                        const hasETR = selectedSupplier.etrStatus === 'etr';
                                        return (
                                            <div className={`mt-2 text-xs flex items-center gap-2 px-3 py-2 rounded-lg border ${hasETR ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                                <div className={`w-2 h-2 rounded-full ${hasETR ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                                <span className="font-medium">
                                                    {hasETR ? 'ETR Enabled' : 'No ETR'}
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                            {/* Items */}
                         <div>
                         <label className="block text-sm font-medium text-slate-700 mb-2">
                           Items
                         </label>
                        {editingInvoice && (
                            <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                Changing items here does not change stock. To take wrongly received items out of inventory,
                                open the invoice and use <b>Remove items</b>.
                            </p>
                        )}
                        <div className="space-y-2">
                         {form.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                    <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => {
                        const items = [...form.items];
                        items[idx] = { ...items[idx], description: e.target.value };
                        setForm({ ...form, items });
                    }}
                    className="input-field flex-1 text-sm"
                     />
                    <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => {
                        const items = [...form.items];
                        items[idx] = { ...items[idx], quantity: parseFloat(e.target.value) || 0 };
                        setForm({ ...form, items });
                    }}
                    className="input-field w-20 text-sm"
                    />
                     <input
                    type="number"
                    placeholder="Unit price"
                    value={item.unitPrice}
                    onChange={(e) => {
                    const items = [...form.items];
                    items[idx] = { ...items[idx], unitPrice: parseFloat(e.target.value) || 0 };
                    const newTotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
                    setForm({ ...form, items, totalAmount: newTotal.toString() });
            }}
                    className="input-field w-28 text-sm"
                  />
                   <button
                    type="button"
                    onClick={() => {
                        const items = form.items.filter((_, i) => i !== idx);
                        const newTotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
                        setForm({ ...form, items, totalAmount: newTotal.toString() });
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded"
                    >
                    <X size={16} />
                   </button>
                      </div>
                  ))}
                  <button
            type="button"
            onClick={() => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, unitPrice: 0 }] })}
            className="text-sm text-sky-600 hover:underline flex items-center gap-1"
                >
            <Plus size={14} /> Add item
              </button>
                    </div>
               {form.items.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                Items total: KES {form.items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0).toLocaleString()}
                   </p>
                      )}
                      </div>

                            {/* Invoice Date */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Calendar size={14} className="inline mr-1" />
                                    Invoice Date *
                                </label>
                                <input
                                    type="date"
                                    value={form.invoiceDate}
                                    onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                                    className="input-field w-full"
                                />
                            </div>

                            {/* Amounts */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        <DollarSign size={14} className="inline mr-1" />
                                        Total Amount *
                                    </label>
                                    <input
                                        type="number"
                                        value={form.totalAmount}
                                        onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                                        className="input-field w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Paid Amount
                                    </label>
                                    <input
                                        type="number"
                                        value={form.paidAmount}
                                        onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                                        className="input-field w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    className="input-field w-full"
                                    rows={2}
                                    placeholder="Procurement details, delivery info, etc."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="btn-primary flex-1"
                            >
                                {saving ? "Saving..." : (editingInvoice ? "Update" : "Create Invoice")}
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn-ghost px-6"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            <PaymentModal
                isOpen={paymentModal.open}
                onClose={() => setPaymentModal({ open: false, invoice: null })}
                invoice={paymentModal.invoice}
                onSuccess={() => {
                    fetchData();
                    setPaymentModal({ open: false, invoice: null });
                    alert.success("Payment recorded successfully");
                }}
            />

            {/* Alert Container */}
            <AlertContainer alerts={alert.alerts} onClose={alert.hideAlert} />
        </div>  
        
        );
        
}
