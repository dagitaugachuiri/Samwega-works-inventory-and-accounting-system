"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2, Package, Hash, CreditCard, Tag, Landmark, FileText } from "lucide-react";
import api from "@/lib/api";

export default function InventoryItemModal({ isOpen, onClose, item, onSuccess }) {
    const isEdit = !!item;
    const [saving, setSaving] = useState(false);
    const [invoices, setInvoices] = useState([]);

    const [form, setForm] = useState({
        productName: "",
        category: "misc",
        buyingPrice: "",
        sellingPrice: "",
        stock: "",
        invoiceId: "",
        warehouseId: "",
        warehouseName: "",
    });

    useEffect(() => {
        if (isOpen) {
            if (item) {
                setForm({
                    productName: item.productName || "",
                    category: item.category || "misc",
                    buyingPrice: item.buyingPrice || item.buyingPricePerUnit || "",
                    sellingPrice: item.sellingPrice || item.sellingPricePerPiece || "",
                    stock: item.stock || "0",
                    invoiceId: item.invoiceId || "",
                    warehouseId: item.warehouseId || "",
                    warehouseName: item.warehouseName || "",
                });
            } else {
                setForm({
                    productName: "",
                    category: "misc",
                    buyingPrice: "",
                    sellingPrice: "",
                    stock: "0",
                    invoiceId: "",
                    warehouseId: "",
                    warehouseName: "",
                });
            }
            fetchInvoices();
        }
    }, [isOpen, item]);

    const fetchInvoices = async () => {
        try {
            const res = await api.getInvoices();
            const data = res.success && res.data ? (res.data.invoices || res.data) : [];
            setInvoices(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch invoices:", error);
        }
    };

    const handleSave = async () => {
        if (!form.productName.trim()) return alert("Product name is required");
        if (!form.invoiceId) return alert("Invoice is required");

        setSaving(true);
        try {
            const payload = {
                ...form,
                buyingPrice: Number(form.buyingPrice),
                sellingPrice: Number(form.sellingPrice),
                stock: Number(form.stock),
                // Ensure legacy fields are synced
                buyingPricePerUnit: Number(form.buyingPrice),
                sellingPricePerPiece: Number(form.sellingPrice),
                minimumPrice: Number(form.sellingPrice) * 0.9,
            };

            if (isEdit) {
                await api.updateInventoryItem(item.id, payload);
            } else {
                await api.createInventoryItem(payload);
            }
            onSuccess();
            onClose();
        } catch (error) {
            alert("Failed to save: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const FormRow = ({ label, icon: Icon, children }) => (
        <div className="flex border-b border-slate-50 last:border-0 py-3 items-center group transition-colors hover:bg-slate-50/50">
            <div className="w-1/3 flex items-center gap-2 text-slate-500 font-medium text-xs uppercase tracking-wider pl-2">
                <Icon size={14} className="text-slate-400" />
                {label}
            </div>
            <div className="w-2/3 pr-2">
                {children}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Package size={16} className="text-sky-600" />
                        {isEdit ? "Edit Item Detail" : "New Inventory Item"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Table Form Body */}
                <div className="p-2">
                    <FormRow label="Product Name" icon={Tag}>
                        <input
                            type="text"
                            value={form.productName}
                            onChange={e => setForm({ ...form, productName: e.target.value })}
                            className="w-full bg-transparent border-none focus:ring-0 text-slate-900 font-semibold p-1 placeholder:text-slate-300"
                            placeholder="e.g., Cement 50kg"
                        />
                    </FormRow>

                    <FormRow label="Invoice" icon={FileText}>
                        <select
                            value={form.invoiceId}
                            onChange={e => setForm({ ...form, invoiceId: e.target.value })}
                            className="w-full bg-transparent border-none focus:ring-0 text-slate-700 text-sm p-1 cursor-pointer"
                        >
                            <option value="">Select Invoice...</option>
                            {invoices.map(inv => (
                                <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - {inv.supplierName || "Supplier"}</option>
                            ))}
                        </select>
                    </FormRow>

                    <FormRow label="Stock Level" icon={Hash}>
                        <input
                            type="number"
                            value={form.stock}
                            onChange={e => setForm({ ...form, stock: e.target.value })}
                            className="w-full bg-transparent border-none focus:ring-0 text-slate-900 font-mono p-1"
                        />
                    </FormRow>

                    <FormRow label="Buying Price" icon={CreditCard}>
                        <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-xs font-mono">KES</span>
                            <input
                                type="number"
                                value={form.buyingPrice}
                                onChange={e => setForm({ ...form, buyingPrice: e.target.value })}
                                className="w-full bg-transparent border-none focus:ring-0 text-slate-900 font-mono p-1"
                            />
                        </div>
                    </FormRow>

                    <FormRow label="Retail Price" icon={Tag}>
                        <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-xs font-mono">KES</span>
                            <input
                                type="number"
                                value={form.sellingPrice}
                                onChange={e => setForm({ ...form, sellingPrice: e.target.value })}
                                className="w-full bg-transparent border-none focus:ring-0 text-emerald-700 font-mono font-bold p-1"
                            />
                        </div>
                    </FormRow>

                    <FormRow label="Category" icon={Landmark}>
                        <select
                            value={form.category}
                            onChange={e => setForm({ ...form, category: e.target.value })}
                            className="w-full bg-transparent border-none focus:ring-0 text-slate-600 text-sm p-1"
                        >
                            <option value="Building Materials">Building Materials</option>
                            <option value="Hardware">Hardware</option>
                            <option value="Electrical">Electrical</option>
                            <option value="Plumbing">Plumbing</option>
                            <option value="Farming">Farming</option>
                            <option value="misc">Miscellaneous</option>
                        </select>
                    </FormRow>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors px-3 py-2"
                        disabled={saving}
                    >
                        DISCARD
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-slate-900 text-white text-xs font-bold px-5 py-2 rounded-lg hover:bg-slate-800 shadow-sm transition-all flex items-center gap-2"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isEdit ? "UPDATE ITEM" : "CREATE ITEM"}
                    </button>
                </div>
            </div>
        </div>
    );
}
