"use client";

import { useState } from "react";
import { X, DollarSign, Calendar, FileText } from "lucide-react";
import api from "../lib/api";

export default function PaymentModal({ isOpen, onClose, invoice, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        amount: "",
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: "cash",
        reference: "",
        notes: "",
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const amount = parseFloat(form.amount);
        if (!amount || amount <= 0) {
            setError("Please enter a valid payment amount");
            return;
        }

        const remainingBalance = invoice?.balanceRemaining || 0;
        if (amount > remainingBalance) {
            setError(`Amount cannot exceed remaining balance (KES ${remainingBalance.toLocaleString()})`);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await api.recordInvoicePayment(invoice.id, {
                amount,
                paymentDate: form.paymentDate,
                paymentMethod: form.paymentMethod,
                reference: form.reference,
                notes: form.notes,
            });

            if (response.success) {
                onSuccess?.(response.data);
                onClose();
                setForm({
                    amount: "",
                    paymentDate: new Date().toISOString().split('T')[0],
                    paymentMethod: "cash",
                    reference: "",
                    notes: "",
                });
            } else {
                setError(response.message || "Failed to record payment");
            }
        } catch (err) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !invoice) return null;

    const remainingBalance = invoice.balanceRemaining || 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">Record Payment</h2>
                                <p className="text-blue-100 text-sm">
                                    Invoice #{invoice.invoiceNumber}
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

                {/* Invoice Summary */}
                <div className="bg-blue-50 border-b border-blue-100 px-5 py-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                            <div className="text-blue-600 text-xs">Total</div>
                            <div className="font-semibold text-blue-900">
                                KES {invoice.totalAmount?.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="text-blue-600 text-xs">Paid</div>
                            <div className="font-semibold text-green-700">
                                KES {invoice.amountPaid?.toLocaleString()}
                            </div>
                        </div>
                        <div>
                            <div className="text-blue-600 text-xs">Remaining</div>
                            <div className="font-semibold text-amber-700">
                                KES {remainingBalance.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Row 1: Amount and Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Payment Amount <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="amount"
                                value={form.amount}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                max={remainingBalance}
                                placeholder="0.00"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Max: KES {remainingBalance.toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Payment Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                name="paymentDate"
                                value={form.paymentDate}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Row 2: Method and Reference */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Payment Method
                            </label>
                            <select
                                name="paymentMethod"
                                value={form.paymentMethod}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="cash">Cash</option>
                                <option value="mpesa">M-Pesa</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reference Number
                            </label>
                            <input
                                type="text"
                                name="reference"
                                value={form.reference}
                                onChange={handleChange}
                                placeholder="M-Pesa code, cheque #..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Notes - full width */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            value={form.notes}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Optional notes..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                    </div>

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
                            disabled={loading || !form.amount}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Recording...
                                </>
                            ) : (
                                <>
                                    <DollarSign className="w-4 h-4" />
                                    Record Payment
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
