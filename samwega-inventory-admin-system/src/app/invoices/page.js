"use client";
import { useState, useEffect } from "react";
import { FileText, Plus, Search, Edit, Trash2, Building2, Calendar, DollarSign, X, CreditCard } from "lucide-react";
import api from "../../lib/api";
import Link from "next/link";
import PaymentModal from "../../components/PaymentModal";
import AlertContainer, { useAlert } from "../../components/Alert";

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [form, setForm] = useState({
        supplierId: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        totalAmount: "",
        paidAmount: "0",
        notes: "",
    });
    const [saving, setSaving] = useState(false);
    const [paymentModal, setPaymentModal] = useState({ open: false, invoice: null });
    const alert = useAlert();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [invoicesRes, suppliersRes] = await Promise.all([
                api.getInvoices(),
                api.getSuppliers()
            ]);

            // Process suppliers first
            let supplierData = [];
            if (suppliersRes.success && suppliersRes.data) {
                supplierData = suppliersRes.data.suppliers || suppliersRes.data;
                setSuppliers(Array.isArray(supplierData) ? supplierData : []);
            }

            // Process invoices with supplier names
            if (invoicesRes.success && invoicesRes.data) {
                const invoiceData = invoicesRes.data.invoices || invoicesRes.data;

                // Create supplier lookup map
                const supplierMap = {};
                if (Array.isArray(supplierData)) {
                    supplierData.forEach(s => {
                        supplierMap[s.id] = s.name;
                    });
                }

                // Merge supplier names into invoices
                const invoicesWithSuppliers = Array.isArray(invoiceData)
                    ? invoiceData.map(inv => ({
                        ...inv,
                        supplierName: inv.supplierName || supplierMap[inv.supplierId] || "Unknown Supplier"
                    }))
                    : [];

                setInvoices(invoicesWithSuppliers);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            alert.error("Failed to load invoices: " + error.message);
        } finally {
            setLoading(false);
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
                totalAmount: invoice.totalAmount?.toString() || "",
                paidAmount: (invoice.amountPaid || invoice.paidAmount || 0).toString(),
                notes: invoice.notes || "",
            });
        } else {
            setEditingInvoice(null);
            setForm({
                supplierId: "",
                invoiceDate: new Date().toISOString().split('T')[0],
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

    const filteredInvoices = invoices.filter(inv =>
        (inv.invoiceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (inv.supplierName || "").toLowerCase().includes(search.toLowerCase())
    );

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

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Purchase Invoices</h1>
                    <p className="text-sm text-slate-500">Manage supplier invoices and procurement records</p>
                </div>
                <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
                    <Plus size={16} />
                    New Invoice
                </button>
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
                                <tr key={inv.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-slate-400" />
                                            <span className="font-mono text-sm font-medium text-slate-900">
                                                {inv.invoiceNumber || inv.id}
                                            </span>
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
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(inv.paymentStatus || inv.status) === 'paid'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {(inv.paymentStatus || inv.status) === 'paid' ? 'Paid' : 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            {(inv.balanceRemaining || 0) > 0 && (
                                                <button
                                                    onClick={() => setPaymentModal({ open: true, invoice: inv })}
                                                    className="p-1.5 rounded hover:bg-green-50 text-green-600"
                                                    title="Record Payment"
                                                >
                                                    <CreditCard size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleOpenModal(inv)}
                                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(inv.id)}
                                                className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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
