"use client";

import { useState, useEffect } from "react";
import { X, Package, FileText, Plus } from "lucide-react";
import api from "@/lib/api";

export default function ReplenishModal({ isOpen, onClose, item, onSuccess }) {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingInvoices, setLoadingInvoices] = useState(true);
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        invoiceId: "",
        quantity: "",
        buyingPrice: "",
        layerIndex: 0,
        notes: "",
    });

    useEffect(() => {
        if (isOpen) {
            fetchInvoices();
            // Pre-fill buying price from item
            if (item?.buyingPricePerUnit) {
                setForm((f) => ({ ...f, buyingPrice: item.buyingPricePerUnit.toString() }));
            }
        }
    }, [isOpen, item]);

    const fetchInvoices = async () => {
        try {
            setLoadingInvoices(true);
            const [invoicesRes, suppliersRes] = await Promise.all([
                api.getInvoices(),
                api.getSuppliers()
            ]);

            const invoiceData = invoicesRes.success && invoicesRes.data
                ? (invoicesRes.data.invoices || invoicesRes.data)
                : [];
            const supplierData = suppliersRes.success && suppliersRes.data
                ? (suppliersRes.data.suppliers || suppliersRes.data)
                : [];

            const supplierMap = {};
            if (Array.isArray(supplierData)) {
                supplierData.forEach((s) => (supplierMap[s.id] = s.name));
            }

            const invoicesWithSuppliers = Array.isArray(invoiceData)
                ? invoiceData.map((inv) => ({
                    ...inv,
                    supplierName: inv.supplierName || supplierMap[inv.supplierId] || "Unknown",
                    remainingAmount: inv.totalAmount - (inv.itemsTotal || 0),
                }))
                : [];

            // Filter to show invoices with remaining amount
            const availableInvoices = invoicesWithSuppliers.filter(
                (inv) => inv.remainingAmount > 0.01
            );

            setInvoices(availableInvoices);
        } catch (err) {
            console.error("Failed to fetch invoices:", err);
        } finally {
            setLoadingInvoices(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.invoiceId) {
            setError("Please select an invoice");
            return;
        }
        if (!form.quantity || parseFloat(form.quantity) <= 0) {
            setError("Quantity must be greater than 0");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await api.replenishItem(item.id, {
                invoiceId: form.invoiceId,
                quantity: parseFloat(form.quantity),
                buyingPrice: form.buyingPrice ? parseFloat(form.buyingPrice) : undefined,
                layerIndex: parseInt(form.layerIndex),
                notes: form.notes,
            });

            if (response.success) {
                onSuccess?.(response.data);
                onClose();
                setForm({
                    invoiceId: "",
                    quantity: "",
                    buyingPrice: "",
                    layerIndex: 0,
                    notes: "",
                });
            } else {
                setError(response.message || "Failed to replenish stock");
            }
        } catch (err) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const selectedInvoice = invoices.find((inv) => inv.id === form.invoiceId);
    const packagingLayers = item?.packagingStructure || [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Plus className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">Add Stock</h2>
                                <p className="text-green-100 text-sm truncate max-w-[250px]">
                                    {item?.productName}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Current Stock Info */}
                <div className="bg-green-50 border-b border-green-100 px-5 py-3">
                    <div className="flex items-center gap-2 text-green-700">
                        <Package className="w-4 h-4" />
                        <span className="text-sm font-medium">
                            Current Stock: {item?.stock || 0} units
                        </span>
                    </div>
                </div>

                {/* Form */}
                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Invoice Selection - Full Width */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Source Invoice <span className="text-red-500">*</span>
                        </label>
                        {loadingInvoices ? (
                            <div className="p-3 bg-gray-50 rounded-lg text-gray-500 text-sm">
                                Loading invoices...
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                                No invoices with remaining balance. Create a new invoice first.
                            </div>
                        ) : (
                            <select
                                name="invoiceId"
                                value={form.invoiceId}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="">-- Select Invoice --</option>
                                {invoices.map((inv) => (
                                    <option key={inv.id} value={inv.id}>
                                        {inv.invoiceNumber} - {inv.supplierName} (Rem: KES {inv.remainingAmount?.toLocaleString()})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Selected Invoice Info */}
                    {selectedInvoice && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-sm">
                            <div className="text-blue-600 grid grid-cols-3 gap-2 text-xs">
                                <span>Total: KES {selectedInvoice.totalAmount?.toLocaleString()}</span>
                                <span>Used: KES {selectedInvoice.itemsTotal?.toLocaleString()}</span>
                                <span className="text-green-600 font-medium">
                                    Available: KES {selectedInvoice.remainingAmount?.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Left Column */}
                        <div className="space-y-4">
                            {/* Quantity */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Quantity <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={form.quantity}
                                    onChange={handleChange}
                                    min="1"
                                    step="1"
                                    placeholder="0"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>

                            {/* Unit Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Unit Type
                                </label>
                                <select
                                    name="layerIndex"
                                    value={form.layerIndex}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                >
                                    {packagingLayers.length > 0 ? (
                                        packagingLayers.map((layer, idx) => (
                                            <option key={idx} value={idx}>
                                                {layer.unit || `Level ${idx + 1}`}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="0">Pieces</option>
                                    )}
                                </select>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            {/* Buying Price */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Buying Price (per unit)
                                </label>
                                <input
                                    type="number"
                                    name="buyingPrice"
                                    value={form.buyingPrice}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.01"
                                    placeholder={item?.buyingPricePerUnit?.toString() || "0.00"}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Notes
                                </label>
                                <textarea
                                    name="notes"
                                    value={form.notes}
                                    onChange={handleChange}
                                    rows={1}
                                    placeholder="Optional notes..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !form.invoiceId || !form.quantity}
                            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    Add Stock
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
