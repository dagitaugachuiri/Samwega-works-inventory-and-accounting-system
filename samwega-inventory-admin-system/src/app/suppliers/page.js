"use client"
import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, Building2, X, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../lib/api";

const KRA_PIN_REGEX = /^[AP]\d{9}[A-Z]$/;
const PAGE_SIZE = 20;
const PAYMENT_TERMS = [
    ["cash", "Cash"],
    ["credit_7days", "Credit - 7 days"],
    ["credit_14days", "Credit - 14 days"],
    ["credit_30days", "Credit - 30 days"],
    ["credit_60days", "Credit - 60 days"],
];
const EMPTY_FORM = {
    name: "", etrStatus: "non-etr", kraPin: "",
    contactPerson: "", phone: "", email: "", address: "", paymentTerms: "cash",
};

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [summary, setSummary] = useState({ totalSuppliers: 0, totalPurchases: 0, totalPaid: 0, outstandingBalance: 0 });
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);

    // Same role rules as the backend (the backend is what actually enforces them)
    const isAdmin = user?.role === "admin";
    const canManage = user?.role === "admin" || user?.role === "store_manager"; // add + edit
    const canDelete = isAdmin;

    useEffect(() => {
        api.getCurrentUser()
            .then((res) => { if (res.success) setUser(res.data); })
            .catch((e) => console.error("Failed to load user:", e));
    }, []);

    // search is done by the server so it covers ALL suppliers, not just the visible page
    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = { page, limit: PAGE_SIZE };
            if (debouncedSearch) params.search = debouncedSearch;
            const res = await api.getSuppliers(params);
            if (res.success && res.data) {
                const list = res.data.suppliers || res.data;
                setSuppliers(Array.isArray(list) ? list : []);
                setPagination(res.pagination || null);
                if (res.summary) setSummary(res.summary);
            }
        } catch (error) {
            console.error("Failed to fetch suppliers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (supplier = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setForm({
                name: supplier.name || "",
                etrStatus: supplier.etrStatus || "non-etr",
                kraPin: supplier.kraPin || "",
                contactPerson: supplier.contactPerson || "",
                phone: supplier.phone || "",
                email: supplier.email || "",
                address: supplier.address || "",
                paymentTerms: supplier.paymentTerms || "cash",
            });
        } else {
            setEditingSupplier(null);
            setForm(EMPTY_FORM);
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { alert("Supplier name is required"); return; }

        const pin = form.kraPin.trim().toUpperCase();
        if (form.etrStatus === "etr") {
            if (!pin) { alert("Enter the supplier's KRA PIN - it is required for ETR suppliers."); return; }
            if (!KRA_PIN_REGEX.test(pin)) { alert("KRA PIN must look like P051234567Q (a letter, 9 digits, a letter)."); return; }
        } else if (pin && !KRA_PIN_REGEX.test(pin)) {
            alert("KRA PIN must look like P051234567Q (a letter, 9 digits, a letter)."); return;
        }

        // Only send fields that have a value (the backend rejects empty phone/email)
        const payload = { name: form.name.trim(), etrStatus: form.etrStatus, paymentTerms: form.paymentTerms };
        if (pin) payload.kraPin = pin;
        ["contactPerson", "phone", "email", "address"].forEach((k) => {
            if (form[k].trim()) payload[k] = form[k].trim();
        });

        setSaving(true);
        try {
            if (editingSupplier) {
                await api.updateSupplier(editingSupplier.id, payload);
            } else {
                await api.createSupplier(payload);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            const detail = error.details?.map((d) => d.message).join(", ");
            alert("Failed to save: " + (detail || error.message));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (supplier) => {
        if (!confirm(`Delete "${supplier.name}"? This cannot be undone.`)) return;
        try {
            await api.deleteSupplier(supplier.id);
            // deleting the last row of a page would leave an empty page
            if (suppliers.length === 1 && page > 1) setPage(page - 1); else fetchData();
        } catch (error) {
            if (error.statusCode === 409) {
                // It has invoices: those are accounting records, so offer to deactivate instead
                if (confirm(`"${supplier.name}" has invoices, so it can't be deleted.\n\nDeactivate it instead? Its invoices and history stay, and it won't appear in the Add Stock supplier list.`)) {
                    try { await api.updateSupplier(supplier.id, { isActive: false }); fetchData(); }
                    catch (e) { alert("Failed to deactivate: " + e.message); }
                }
            } else {
                alert("Failed to delete: " + error.message);
            }
        }
    };

    const handleToggleActive = async (supplier) => {
        const activating = supplier.isActive === false;
        if (!confirm(`${activating ? "Reactivate" : "Deactivate"} "${supplier.name}"?`)) return;
        try {
            await api.updateSupplier(supplier.id, { isActive: activating });
            fetchData();
        } catch (error) {
            alert("Failed: " + error.message);
        }
    };

    const handleRecalculate = async (supplier) => {
        if (!confirm(`Rebuild "${supplier.name}" totals from its invoices (reversed invoices are ignored)?`)) return;
        try {
            const res = await api.recalculateSupplier(supplier.id);
            if (res.success) alert(`Done. ${res.data.invoices} invoice(s) counted. Total purchases: KES ${res.data.totalPurchases.toLocaleString()}`);
            fetchData();
        } catch (error) {
            alert("Failed to recalculate: " + error.message);
        }
    };

    const totalPages = pagination?.totalPages || 1;
    const filteredSuppliers = suppliers;

    if (loading && suppliers.length === 0 && !debouncedSearch) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-600">Loading suppliers…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Suppliers</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your suppliers and track payments</p>
                </div>
                {canManage && (
                    <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
                        <Plus size={16} />
                        Add Supplier
                    </button>
                )}
            </div>

            {/* Stats - Backend Calculated */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Suppliers</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalSuppliers}</p>
                </div>
                <div className="glass-panel px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Purchases</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">KES {summary.totalPurchases.toLocaleString()}</p>
                </div>
                <div className="glass-panel px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Paid</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                        KES {summary.totalPaid.toLocaleString()}
                    </p>
                </div>
                <div className="glass-panel px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Outstanding</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                        KES {summary.outstandingBalance.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search suppliers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field pl-9 w-full"
                />
            </div>

            {/* Suppliers Table */}
            {filteredSuppliers.length === 0 ? (
                <div className="glass-panel p-10 text-center">
                    <Building2 size={40} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">
                        {suppliers.length === 0
                            ? "No suppliers yet. Add your first supplier to get started."
                            : "No suppliers match your search."}
                    </p>
                </div>
            ) : (
                <div className="glass-panel overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Supplier</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ETR</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Total Purchases</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Total Paid</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding</th>
                                    <th className="px-5 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredSuppliers.map((supplier) => (
                                    <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                                        {/* Name */}
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                    {(supplier.name || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`font-medium ${supplier.isActive === false ? "text-slate-400" : "text-slate-900"}`}>{supplier.name}</span>
                                                {supplier.isActive === false && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* ETR */}
                                        <td className="px-5 py-3">
                                            {supplier.etrStatus === 'etr'
                                                ? <div className="flex flex-col items-start gap-0.5">
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">ETR</span>
                                                    {supplier.kraPin
                                                        ? <span className="font-mono text-xs text-slate-500">{supplier.kraPin}</span>
                                                        : <span className="text-xs text-red-500">PIN missing</span>}
                                                  </div>
                                                : <span className="text-slate-400 text-xs">—</span>
                                            }
                                        </td>

                                        {/* Total Purchases */}
                                        <td className="px-5 py-3 text-right font-mono text-slate-700">
                                            {(supplier.totalPurchases || 0) > 0
                                                ? `KES ${(supplier.totalPurchases).toLocaleString()}`
                                                : <span className="text-slate-400">—</span>}
                                        </td>

                                        {/* Total Paid */}
                                        <td className="px-5 py-3 text-right font-mono text-slate-700">
                                            {(supplier.totalPaid || 0) > 0
                                                ? `KES ${(supplier.totalPaid).toLocaleString()}`
                                                : <span className="text-slate-400">—</span>}
                                        </td>

                                        {/* Outstanding */}
                                        <td className="px-5 py-3 text-right font-mono">
                                            {(supplier.outstandingBalance || 0) > 0
                                                ? <span className="font-semibold text-amber-700">KES {(supplier.outstandingBalance).toLocaleString()}</span>
                                                : <span className="text-slate-400">—</span>}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {canManage && (
                                                    <button title="Edit" onClick={() => handleOpenModal(supplier)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Edit size={14} />
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button title="Rebuild totals from invoices" onClick={() => handleRecalculate(supplier)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                                        <RefreshCw size={14} />
                                                    </button>
                                                )}
                                                {canManage && (
                                                    <button title={supplier.isActive === false ? "Reactivate" : "Deactivate"} onClick={() => handleToggleActive(supplier)} className="px-1.5 py-1 rounded hover:bg-slate-100 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                                                        {supplier.isActive === false ? "Activate" : "Deactivate"}
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button title="Delete" onClick={() => handleDelete(supplier)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>

                            {/* Totals footer */}
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        All {summary.totalSuppliers} supplier{summary.totalSuppliers !== 1 ? 's' : ''}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                                        KES {summary.totalPurchases.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                                        KES {summary.totalPaid.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-bold text-amber-700">
                                        KES {summary.outstandingBalance.toLocaleString()}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
                        <span>
                            Showing {(page - 1) * PAGE_SIZE + 1}-{(page - 1) * PAGE_SIZE + filteredSuppliers.length} of {pagination?.total ?? filteredSuppliers.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1 || loading}
                                className="btn-ghost flex items-center gap-1 px-3 py-1 disabled:opacity-40"
                            >
                                <ChevronLeft size={14} /> Prev
                            </button>
                            <span>Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages || loading}
                                className="btn-ghost flex items-center gap-1 px-3 py-1 disabled:opacity-40"
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingSupplier ? "Edit Supplier" : "Add Supplier"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name *</label>
                                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field w-full" placeholder="e.g., ABC Distributors" />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="etrStatus"
                                    checked={form.etrStatus === "etr"}
                                    onChange={(e) => setForm({ ...form, etrStatus: e.target.checked ? "etr" : "non-etr" })}
                                    className="w-4 h-4 text-sky-500 rounded focus:ring-sky-500 border-slate-300"
                                />
                                <label htmlFor="etrStatus" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                                    Has ETR?
                                </label>
                            </div>

                            {/* The PIN appears as soon as ETR is ticked, and is required for ETR suppliers */}
                            {form.etrStatus === "etr" && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">KRA PIN *</label>
                                    <input
                                        type="text"
                                        value={form.kraPin}
                                        maxLength={11}
                                        onChange={(e) => setForm({ ...form, kraPin: e.target.value.toUpperCase().replace(/\s/g, "") })}
                                        className="input-field w-full font-mono"
                                        placeholder="P051234567Q"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">A letter, 9 digits, a letter. 16% VAT is added automatically on this supplier's invoices.</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact person</label>
                                    <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="input-field w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field w-full" placeholder="0712345678" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Payment terms</label>
                                <select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} className="input-field w-full">
                                    {PAYMENT_TERMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                                {saving ? "Saving..." : (editingSupplier ? "Update" : "Add Supplier")}
                            </button>
                            <button onClick={() => setShowModal(false)} className="btn-ghost px-6">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
