"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Package, UserCheck, Wallet } from "lucide-react";
import api from "../../../lib/api";

const money = (n) => `KES ${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const STATUS_STYLE = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
    pending: "bg-slate-100 text-slate-600 border-slate-200",
    voided: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function InvoiceDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [invoice, setInvoice] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchInvoice();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchInvoice = async () => {
        try {
            setLoading(true);
            // the invoice itself, and the stock that came in on it (a failure on one must not hide the other)
            const [invRes, itemsRes] = await Promise.all([
                api.getInvoiceById(id),
                api.getInvoiceItems(id).catch(() => null),
            ]);
            if (invRes.success && invRes.data) {
                setInvoice(invRes.data);
                const received = itemsRes?.data?.items || itemsRes?.data;
                if (Array.isArray(received) && received.length) {
                    setItems(received.map((r) => ({
                        name: r.productName,
                        quantity: r.quantity,
                        unitPrice: r.buyingPrice || (r.quantity ? (r.itemCost || 0) / r.quantity : 0),
                        lineTotal: r.itemCost || (r.buyingPrice || 0) * r.quantity,
                    })));
                } else if (Array.isArray(invRes.data.items)) {
                    // older invoices that stored their items on the invoice itself
                    setItems(invRes.data.items.map((r) => ({
                        name: r.description || r.productName,
                        quantity: r.quantity,
                        unitPrice: r.unitPrice || 0,
                        lineTotal: (r.quantity || 0) * (r.unitPrice || 0),
                    })));
                }
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
                <button onClick={() => router.back()} className="mt-4 text-sky-600 hover:underline">Go back</button>
            </div>
        );
    }

    const status = invoice.status === "voided" ? "voided" : (invoice.paymentStatus || "pending");
    const keyedAt = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : null;
    const itemsSum = items.reduce((sum, i) => sum + (i.lineTotal || 0), 0);

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Top: invoice number, status, and who keyed it in */}
            <div className="flex items-start gap-4">
                <button onClick={() => router.back()} className="mt-1 p-2 hover:bg-slate-100 rounded-lg">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold text-slate-900 font-mono">{invoice.invoiceNumber}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full border text-xs font-medium capitalize ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>
                            {status === "voided" ? "Reversed" : status}
                        </span>
                        {invoice.etrStatus === "etr" && (
                            <span className="px-2.5 py-0.5 rounded-full border text-xs font-medium bg-sky-50 text-sky-700 border-sky-200">
                                ETR · VAT included
                            </span>
                        )}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                        <UserCheck size={14} className="text-slate-400" />
                        Keyed in by <span className="font-medium text-slate-700">{invoice.createdByName || "not recorded"}</span>
                        {keyedAt && <span className="text-slate-400">· {keyedAt}</span>}
                    </p>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="glass-panel p-5">
                    <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-400"><Building2 size={12} /> Supplier</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{invoice.supplierName || "Unknown"}</p>
                </div>
                <div className="glass-panel p-5">
                    <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-400"><Calendar size={12} /> Invoice date</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                        {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : "N/A"}
                    </p>
                </div>
                <div className="glass-panel p-5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total</p>
                    <p className="mt-2 text-lg font-bold text-slate-900 tabular-nums">{money(invoice.totalAmount)}</p>
                </div>
                <div className="glass-panel p-5">
                    <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-400"><Wallet size={12} /> Paid / Balance</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-700 tabular-nums">{money(invoice.amountPaid)}</p>
                    <p className="text-sm font-semibold text-amber-700 tabular-nums">{money(invoice.balanceRemaining)} due</p>
                </div>
            </div>

            {/* Items */}
            <div className="glass-panel overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
                    <Package size={16} className="text-sky-500" />
                    <h2 className="text-sm font-semibold text-slate-900">Items received</h2>
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">{items.length}</span>
                </div>

                {items.length === 0 ? (
                    <p className="px-6 py-10 text-center text-sm text-slate-400">No items recorded on this invoice.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead className="bg-sky-50/70 text-left text-[11px] uppercase tracking-wider text-sky-700">
                                <tr>
                                    <th className="px-6 py-3 font-semibold w-12">#</th>
                                    <th className="px-6 py-3 font-semibold">Product</th>
                                    <th className="px-6 py-3 font-semibold text-right">Qty</th>
                                    <th className="px-6 py-3 font-semibold text-right">Buying price</th>
                                    <th className="px-6 py-3 font-semibold text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item, idx) => (
                                    <tr key={idx} className="even:bg-slate-50/60 hover:bg-sky-50/40 transition-colors">
                                        <td className="px-6 py-3.5 text-slate-400">{idx + 1}</td>
                                        <td className="px-6 py-3.5 font-medium text-slate-800">{item.name || "-"}</td>
                                        <td className="px-6 py-3.5 text-right tabular-nums text-slate-700">{item.quantity}</td>
                                        <td className="px-6 py-3.5 text-right tabular-nums text-slate-600">{money(item.unitPrice)}</td>
                                        <td className="px-6 py-3.5 text-right tabular-nums font-semibold text-slate-900">{money(item.lineTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-slate-200 bg-slate-50">
                                    <td colSpan={4} className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</td>
                                    <td className="px-6 py-3.5 text-right tabular-nums font-bold text-slate-900">{money(itemsSum)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {invoice.notes && (
                <div className="glass-panel p-5">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">Notes</p>
                    <p className="text-sm text-slate-700">{invoice.notes}</p>
                </div>
            )}
        </div>
    );
}
