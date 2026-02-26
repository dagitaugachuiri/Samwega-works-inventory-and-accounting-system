"use client"
import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, Building2, X, FileText } from "lucide-react";
import api from "../../lib/api";

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [search, setSearch] = useState("");
    const [etrFilter, setEtrFilter] = useState("all"); // all, etr, non-etr
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [form, setForm] = useState({
        name: "",
        etrStatus: "non-etr",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [suppliersRes, invoicesRes] = await Promise.all([
                api.getSuppliers(),
                api.getInvoices()
            ]);

            if (suppliersRes.success && suppliersRes.data) {
                setSuppliers(suppliersRes.data.suppliers || suppliersRes.data || []);
            }
            if (invoicesRes.success && invoicesRes.data) {
                setInvoices(invoicesRes.data.invoices || invoicesRes.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };


    // Calculate overall totals from all suppliers (backend-calculated values)
    const overallTotals = {
        totalSuppliers: suppliers.length,
        totalPurchases: suppliers.reduce((sum, s) => sum + (s.totalPurchases || 0), 0),
        totalPaid: suppliers.reduce((sum, s) => sum + (s.totalPaid || 0), 0),
        outstandingBalance: suppliers.reduce((sum, s) => sum + (s.outstandingBalance || 0), 0)
    };

    const handleOpenModal = (supplier = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setForm({
                name: supplier.name || "",
                etrStatus: supplier.etrStatus || "non-etr",
            });
        } else {
            setEditingSupplier(null);
            setForm({ name: "", etrStatus: "non-etr" });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { alert("Supplier name is required"); return; }

        setSaving(true);
        try {
            const payload = { ...form };
            if (editingSupplier) {
                await api.updateSupplier(editingSupplier.id, payload);
            } else {
                await api.createSupplier(payload);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            alert("Failed to save: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this supplier?")) return;
        try {
            await api.deleteSupplier(id);
            fetchData();
        } catch (error) {
            alert("Failed to delete: " + error.message);
        }
    };

    const filteredSuppliers = suppliers.filter(supplier =>
        (supplier.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (supplier.contactPerson || "").toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
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
                <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
                    <Plus size={16} />
                    Add Supplier
                </button>
            </div>

            {/* Stats - Backend Calculated */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Suppliers</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{overallTotals.totalSuppliers}</p>
                </div>
                <div className="glass-panel px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Purchases</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">KES {overallTotals.totalPurchases.toLocaleString()}</p>
                </div>
                <div className="glass-panel px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Paid</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                        KES {overallTotals.totalPaid.toLocaleString()}
                    </p>
                </div>
                <div className="glass-panel px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Outstanding</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                        KES {overallTotals.outstandingBalance.toLocaleString()}
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
                                                <span className="font-medium text-slate-900">{supplier.name}</span>
                                            </div>
                                        </td>

                                        {/* ETR */}
                                        <td className="px-5 py-3">
                                            {supplier.etrStatus === 'etr'
                                                ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">ETR</span>
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
                                                <button onClick={() => handleOpenModal(supplier)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                                    <Edit size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(supplier.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>

                            {/* Totals footer */}
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                                        KES {overallTotals.totalPurchases.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                                        KES {overallTotals.totalPaid.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-bold text-amber-700">
                                        KES {overallTotals.outstandingBalance.toLocaleString()}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
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
