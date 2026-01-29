"use client"
import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, Building2, Phone, Mail, X, FileText } from "lucide-react";
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
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
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
                contactPerson: supplier.contactPerson || "",
                email: supplier.email || "",
                phone: supplier.phone || "",
                address: supplier.address || "",
                etrStatus: supplier.etrStatus || "non-etr",
            });
        } else {
            setEditingSupplier(null);
            setForm({ name: "", contactPerson: "", email: "", phone: "", address: "", etrStatus: "non-etr" });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { alert("Supplier name is required"); return; }
        if (!form.phone.trim()) { alert("Phone number is required"); return; }

        setSaving(true);
        try {
            let phone = form.phone.trim();
            if (phone.startsWith("254")) phone = "+" + phone;

            const payload = { ...form, phone };
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

            {/* Suppliers Grid */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSuppliers.map((supplier) => {
                        return (
                            <div key={supplier.id} className="glass-panel p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                            {(supplier.name || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900">{supplier.name}</h3>
                                            {supplier.contactPerson && (
                                                <p className="text-xs text-slate-500">{supplier.contactPerson}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleOpenModal(supplier)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                                            <Edit size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(supplier.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="space-y-1 text-sm mb-3">
                                    {supplier.phone && (
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Phone size={14} className="text-slate-400" />
                                            <span>{supplier.phone}</span>
                                        </div>
                                    )}
                                    {supplier.email && (
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Mail size={14} className="text-slate-400" />
                                            <span className="truncate">{supplier.email}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Financial Summary - Using Backend-Calculated Values */}
                                <div className="border-t border-slate-100 pt-3 mt-3">
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-slate-50 rounded p-2">
                                            <p className="text-[10px] text-slate-400 uppercase">Total</p>
                                            <p className="text-sm font-medium text-slate-700">
                                                {(supplier.totalPurchases || 0) > 0
                                                    ? (supplier.totalPurchases >= 10000
                                                        ? `${(supplier.totalPurchases / 1000).toFixed(0)}K`
                                                        : supplier.totalPurchases.toLocaleString())
                                                    : '-'}
                                            </p>
                                        </div>
                                        <div className="bg-emerald-50 rounded p-2">
                                            <p className="text-[10px] text-emerald-600 uppercase">Paid</p>
                                            <p className="text-sm font-medium text-emerald-700">
                                                {(supplier.totalPaid || 0) > 0
                                                    ? (supplier.totalPaid >= 10000
                                                        ? `${(supplier.totalPaid / 1000).toFixed(0)}K`
                                                        : supplier.totalPaid.toLocaleString())
                                                    : '-'}
                                            </p>
                                        </div>
                                        <div className={`rounded p-2 ${(supplier.outstandingBalance || 0) > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                            <p className={`text-[10px] uppercase ${(supplier.outstandingBalance || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Due</p>
                                            <p className={`text-sm font-medium ${(supplier.outstandingBalance || 0) > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                                                {(supplier.outstandingBalance || 0) > 0
                                                    ? (supplier.outstandingBalance >= 10000
                                                        ? `${(supplier.outstandingBalance / 1000).toFixed(0)}K`
                                                        : supplier.outstandingBalance.toLocaleString())
                                                    : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                                <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="input-field w-full" placeholder="e.g., John Doe" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field w-full" placeholder="0700000000" />
                                    <p className="text-xs text-slate-400 mt-1">Format: 07XX or 01XX</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field w-full" placeholder="email@example.com" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field w-full" rows={2} placeholder="Physical address" />
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
