"use client";

import { useState } from "react";
import { X, Trash2, AlertCircle } from "lucide-react";
import api from "@/lib/api";

export default function DeleteSaleModal({ isOpen, onClose, onSuccess, selectedSales = [], sales = [] }) {
    const [deleting, setDeleting] = useState(false);

    if (!isOpen) return null;

    // Get full sale details for selected IDs
    const selectedSaleDetails = sales.filter(sale => selectedSales.includes(sale.id));
    const totalAmount = selectedSaleDetails.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);

    const handleDelete = async () => {
        if (selectedSales.length === 0) return;

        const confirmMessage = selectedSales.length === 1
            ? `Are you sure you want to delete this sale?\n\nReceipt: ${selectedSaleDetails[0].receiptNumber}\nAmount: KSh ${selectedSaleDetails[0].grandTotal?.toLocaleString()}\n\nThis action cannot be undone.`
            : `Are you sure you want to delete ${selectedSales.length} sales?\n\nTotal Amount: KSh ${totalAmount.toLocaleString()}\n\nThis action cannot be undone.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        setDeleting(true);
        try {
            // Use batch delete for multiple sales, single delete for one
            if (selectedSales.length === 1) {
                const response = await api.deleteSale(selectedSales[0]);
                if (response.success) {
                    alert("Sale deleted successfully.");
                    onSuccess();
                    onClose();
                } else {
                    alert("Failed to delete sale: " + response.message);
                }
            } else {
                const response = await api.deleteSalesBatch(selectedSales);
                if (response.success) {
                    alert(`${selectedSales.length} sales deleted successfully.`);
                    onSuccess();
                    onClose();
                } else {
                    alert("Failed to delete sales: " + response.message);
                }
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("An error occurred while deleting the sale(s).");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">
                                Delete {selectedSales.length} Sale{selectedSales.length !== 1 ? 's' : ''}
                            </h2>
                            <p className="text-xs text-slate-500">Review and confirm deletion</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {selectedSales.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertCircle className="mx-auto text-slate-400 mb-4" size={48} />
                            <p className="text-slate-600 font-medium">No sales selected</p>
                            <p className="text-sm text-slate-500 mt-2">Please select sales from the table to delete</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary Card */}
                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-rose-600 uppercase font-bold tracking-wider mb-1">Selected Sales</p>
                                        <p className="text-2xl font-bold text-rose-900">{selectedSales.length}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-rose-600 uppercase font-bold tracking-wider mb-1">Total Amount</p>
                                        <p className="text-2xl font-bold text-rose-900">KSh {totalAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Sales List */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Sales to be deleted:</h3>
                                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
                                    {selectedSaleDetails.map((sale) => (
                                        <div key={sale.id} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <p className="font-mono font-bold text-slate-900 text-sm mb-1">
                                                        {sale.receiptNumber || `#${sale.id.substring(0, 8)}`}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(sale.saleDate || sale.createdAt).toLocaleDateString()} • {new Date(sale.saleDate || sale.createdAt).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-900">KSh {sale.grandTotal?.toLocaleString()}</p>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize mt-1
                                                        ${sale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-800' :
                                                            sale.paymentMethod === 'mpesa' ? 'bg-violet-100 text-violet-800' :
                                                                'bg-amber-100 text-amber-800'}`}>
                                                        {sale.paymentMethod}
                                                    </span>
                                                </div>
                                            </div>
                                            {sale.customerName && (
                                                <p className="text-xs text-slate-600">
                                                    <span className="font-medium">Customer:</span> {sale.customerName}
                                                </p>
                                            )}
                                            <p className="text-xs text-slate-600">
                                                <span className="font-medium">Items:</span> {sale.items?.length || 0} item(s)
                                                {sale.items?.length > 0 && ` - ${sale.items[0].productName}${sale.items.length > 1 ? ` +${sale.items.length - 1} more` : ''}`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Warning */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
                                <div>
                                    <p className="text-sm font-semibold text-amber-900">Warning</p>
                                    <p className="text-sm text-amber-700">
                                        This action cannot be undone. {selectedSales.length > 1 ? 'These sales' : 'This sale'} will be permanently deleted from the system.
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 py-3 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={18} />
                                    {deleting ? 'Deleting...' : `Delete ${selectedSales.length} Sale${selectedSales.length !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
