"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Building2, Calendar, Package } from "lucide-react";
import api from "../../../lib/api";

export default function InvoiceDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchInvoice();
    }, [id]);

    const fetchInvoice = async () => {
        try {
            setLoading(true);
            const res = await api.getInvoiceById(id);
            if (res.success && res.data) {
                setInvoice(res.data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-600">Loading invoice…</p>
                </div>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="glass-panel p-8 text-center">
                <p className="text-rose-600">Failed to load invoice: {error || "Not found"}</p>
                <button onClick={() => router.back()} className="mt-4 text-sky-600 hover:underline">
                    Go back
                </button>
            </div>
        );
    }

    const items = invoice.items || [];

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 font-mono">
                        {invoice.invoiceNumber}
                    </h1>
                    <p className="text-sm text-slate-500">Invoice details</p>
                </div>
            </div>

            <div className="glass-panel p-6 grid grid-cols-2 gap-6">
                <div>
                    <p className="text-xs text-slate-400 uppercase flex items-center gap-1">
                        <Building2 size={12} /> Supplier
                    </p>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                        {invoice.supplierName || "Unknown"}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase flex items-center gap-1">
                        <Calendar size={12} /> Date
                    </p>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                        {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : "N/A"}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase">Total Amount</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                        KES {(invoice.totalAmount || 0).toLocaleString()}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase">Balance Remaining</p>
                    <p className="text-lg font-bold text-amber-700 mt-1">
                        KES {(invoice.balanceRemaining || 0).toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="glass-panel overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <Package size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-900">Items ({items.length})</h2>
                </div>
                {items.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-400 text-center">
                        No items recorded for this invoice.
                    </p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs text-slate-500">
                            <tr>
                                <th className="px-4 py-2">Description</th>
                                <th className="px-4 py-2 text-right">Qty</th>
                                <th className="px-4 py-2 text-right">Unit Price</th>
                                <th className="px-4 py-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="px-4 py-2">{item.description}</td>
                                    <td className="px-4 py-2 text-right">{item.quantity}</td>
                                    <td className="px-4 py-2 text-right">KES {item.unitPrice.toLocaleString()}</td>
                                    <td className="px-4 py-2 text-right font-medium">
                                        KES {(item.quantity * item.unitPrice).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {invoice.notes && (
                <div className="glass-panel p-4">
                    <p className="text-xs text-slate-400 uppercase mb-1">Notes</p>
                    <p className="text-sm text-slate-700">{invoice.notes}</p>
                </div>
            )}
        </div>
    );
}