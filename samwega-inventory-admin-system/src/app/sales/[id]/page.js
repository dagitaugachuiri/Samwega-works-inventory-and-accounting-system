"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Calendar,
    Truck,
    User,
    CreditCard,
    Package,
    Receipt,
    AlertCircle,
    CheckCircle,
    XCircle
} from "lucide-react";
import api from "../../../lib/api";

export default function SaleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const saleId = params.id;

    const [sale, setSale] = useState(null);
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Helper function to convert Firestore timestamp to Date
    const convertTimestamp = (timestamp) => {
        if (!timestamp) return null;
        if (timestamp._seconds) {
            return new Date(timestamp._seconds * 1000);
        }
        if (timestamp instanceof Date) {
            return timestamp;
        }
        if (typeof timestamp === 'string') {
            return new Date(timestamp);
        }
        return null;
    };

    useEffect(() => {
        fetchSaleDetails();
    }, [saleId]);

    const fetchSaleDetails = async () => {
        try {
            setLoading(true);
            const response = await api.getSaleById(saleId);

            if (response.success) {
                setSale(response.data);

                // Fetch vehicle details if vehicleId exists
                if (response.data.vehicleId) {
                    const vehicleResponse = await api.getVehicleById(response.data.vehicleId);
                    if (vehicleResponse.success) {
                        setVehicle(vehicleResponse.data);
                    }
                }
            }
        } catch (err) {
            console.error("Error fetching sale details:", err);
            setError(err.message || "Failed to load sale details");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
                <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-500">Loading sale details...</p>
                </div>
            </div>
        );
    }

    if (error || !sale) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
                <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm text-center max-w-md">
                    <AlertCircle className="mx-auto mb-4 text-rose-500" size={48} />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Sale Not Found</h2>
                    <p className="text-sm text-slate-500 mb-6">{error || "The sale you're looking for doesn't exist."}</p>
                    <button
                        onClick={() => router.push("/sales-dashboard")}
                        className="btn-primary"
                    >
                        <ArrowLeft size={16} className="mr-2" />
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const statusConfig = {
        completed: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", label: "Completed" },
        voided: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", label: "Voided" },
        draft: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Draft" }
    };

    const status = statusConfig[sale.status] || statusConfig.completed;
    const StatusIcon = status.icon;

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-5xl space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push("/sales-dashboard")}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to Dashboard</span>
                    </button>
                </div>

                {/* Sale Header Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Receipt className="text-sky-600" size={28} />
                                <h1 className="text-2xl font-bold text-slate-900">
                                    {sale.receiptNumber || `Receipt #${sale.id.substring(0, 8).toUpperCase()}`}
                                </h1>
                            </div>
                            <p className="text-sm text-slate-500">Sale ID: {sale.id}</p>
                        </div>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${status.bg}`}>
                            <StatusIcon className={status.color} size={20} />
                            <span className={`font-semibold ${status.color}`}>{status.label}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-sky-50 rounded-lg">
                                <Calendar className="text-sky-600" size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Date & Time</p>
                                <p className="font-semibold text-slate-900">
                                    {convertTimestamp(sale.saleDate)?.toLocaleDateString() || 'N/A'}
                                </p>
                                <p className="text-sm text-slate-600">
                                    {convertTimestamp(sale.saleDate)?.toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    }) || ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-violet-50 rounded-lg">
                                <Truck className="text-violet-600" size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Vehicle</p>
                                <p className="font-semibold text-slate-900">
                                    {vehicle ? vehicle.vehicleName : 'Loading...'}
                                </p>
                                <p className="text-sm text-slate-600">
                                    {vehicle ? vehicle.plateNumber : ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <User className="text-emerald-600" size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sales Rep</p>
                                <p className="font-semibold text-slate-900">
                                    {sale.salesRepName || 'N/A'}
                                </p>
                                <p className="text-sm text-slate-600">
                                    {sale.salesRepId ? `ID: ${sale.salesRepId.substring(0, 8)}` : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Package size={20} className="text-sky-600" />
                            Items Sold
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left">Product</th>
                                    <th className="px-6 py-4 text-center">Quantity</th>
                                    <th className="px-6 py-4 text-right">Unit Price</th>
                                    <th className="px-6 py-4 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sale.items.map((item, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{item.productName}</div>
                                            {item.sku && (
                                                <div className="text-xs text-slate-500 font-mono">SKU: {item.sku}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 rounded-full font-semibold text-slate-900">
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-slate-900">
                                            KSh {parseFloat(item.unitPrice).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                                            KSh {(item.quantity * item.unitPrice).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Payment Summary */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                        <CreditCard size={20} className="text-sky-600" />
                        Payment Summary
                    </h2>

                    <div className="space-y-4">
                        {/* Payment Method Row */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                            <span className="text-slate-600">Payment Method</span>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold capitalize
                                ${sale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-800' :
                                    sale.paymentMethod === 'mpesa' ? 'bg-violet-100 text-violet-800' :
                                        sale.paymentMethod === 'bank' ? 'bg-blue-100 text-blue-800' :
                                            sale.paymentMethod === 'credit' || sale.paymentMethod === 'debt' ? 'bg-rose-100 text-rose-800' :
                                                'bg-amber-100 text-amber-800'}`}>
                                {sale.paymentMethod === 'credit' ? 'Debt' : sale.paymentMethod}
                            </span>
                        </div>

                        {/* Mixed Payment Breakdown */}
                        {sale.paymentMethod === 'mixed' && Array.isArray(sale.payments) && sale.payments.length > 0 && (
                            <div className="pb-4 border-b border-slate-200">
                                <p className="text-sm text-slate-500 mb-3">Payment Breakdown</p>
                                <div className="space-y-2">
                                    {sale.payments.map((payment, idx) => {
                                        const method = (payment.method || '').toLowerCase();
                                        const badgeClass =
                                            method === 'cash' ? 'bg-emerald-100 text-emerald-800' :
                                                method === 'mpesa' || method.includes('mobile') ? 'bg-violet-100 text-violet-800' :
                                                    method.includes('bank') || method.includes('card') ? 'bg-blue-100 text-blue-800' :
                                                        method === 'credit' || method === 'debt' ? 'bg-rose-100 text-rose-800' :
                                                            'bg-slate-100 text-slate-700';
                                        const label = method === 'credit' ? 'Debt' : method.charAt(0).toUpperCase() + method.slice(1);

                                        return (
                                            <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
                                                    {label}
                                                </span>
                                                <span className="font-semibold text-slate-900">
                                                    KSh {parseFloat(payment.amount || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {sale.customerPhone && (
                            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                                <span className="text-slate-600">Customer Phone</span>
                                <span className="font-semibold text-slate-900">{sale.customerPhone}</span>
                            </div>
                        )}

                        {sale.customerName && (
                            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                                <span className="text-slate-600">Customer Name</span>
                                <span className="font-semibold text-slate-900">{sale.customerName}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                            <span className="text-slate-600">Subtotal</span>
                            <span className="font-semibold text-slate-900">
                                KSh {parseFloat(sale.grandTotal).toLocaleString()}
                            </span>
                        </div>

                        {sale.amountPaid && (
                            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                                <span className="text-slate-600">Amount Paid</span>
                                <span className="font-semibold text-slate-900">
                                    KSh {parseFloat(sale.amountPaid).toLocaleString()}
                                </span>
                            </div>
                        )}

                        {sale.change > 0 && (
                            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                                <span className="text-slate-600">Change</span>
                                <span className="font-semibold text-emerald-600">
                                    KSh {parseFloat(sale.change).toLocaleString()}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-lg font-bold text-slate-900">Total Amount</span>
                            <span className="text-2xl font-bold text-sky-600">
                                KSh {parseFloat(sale.grandTotal).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                {(sale.notes || sale.voidReason) && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Additional Information</h2>
                        {sale.notes && (
                            <div className="mb-4">
                                <p className="text-sm text-slate-500 mb-1">Notes</p>
                                <p className="text-slate-900">{sale.notes}</p>
                            </div>
                        )}
                        {sale.voidReason && (
                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                                <p className="text-sm font-semibold text-rose-900 mb-1">Void Reason</p>
                                <p className="text-rose-800">{sale.voidReason}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
