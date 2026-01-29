"use client"
import { useState, useEffect } from "react";
import { Search, Eye, XCircle, Calendar, DollarSign } from "lucide-react";
import api from "../../lib/api";

export default function SalesPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        startDate: "",
        endDate: "",
        vehicleId: "",
        paymentMethod: "all"
    });
    const [vehicles, setVehicles] = useState([]);
    const [selectedSale, setSelectedSale] = useState(null);

    useEffect(() => {
        fetchSales();
        fetchVehicles();

        // Set default dates
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setFilter(f => ({
            ...f,
            startDate: firstDay.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0]
        }));
    }, []);

    const fetchSales = async () => {
        try {
            setLoading(true);
            const response = await api.getSales(filter);
            if (response.success && response.data) {
                setSales(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch sales:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchVehicles = async () => {
        try {
            const response = await api.getVehicles();
            if (response.success && response.data) {
                setVehicles(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch vehicles:", error);
        }
    };

    const handleVoidSale = async (id) => {
        const reason = prompt("Reason for voiding this sale:");
        if (!reason) return;

        try {
            await api.voidSale(id, reason);
            fetchSales();
            setSelectedSale(null);
        } catch (error) {
            console.error("Failed to void sale:", error);
            alert("Failed to void sale");
        }
    };

    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Sales History</h1>
                    <p className="text-sm text-slate-500 mt-1">View and manage all sales</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-600">Total Sales</p>
                    <p className="text-2xl font-semibold text-slate-900 mt-2">{sales.length}</p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Revenue</p>
                    <p className="text-2xl font-semibold text-emerald-700 mt-2">KSh {totalRevenue.toLocaleString()}</p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-violet-600">Profit</p>
                    <p className="text-2xl font-semibold text-violet-700 mt-2">KSh {totalProfit.toLocaleString()}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel px-5 py-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-2">Start Date</label>
                        <input
                            type="date"
                            value={filter.startDate}
                            onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                            className="input-field w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-2">End Date</label>
                        <input
                            type="date"
                            value={filter.endDate}
                            onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                            className="input-field w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-2">Vehicle</label>
                        <select
                            value={filter.vehicleId}
                            onChange={(e) => setFilter({ ...filter, vehicleId: e.target.value })}
                            className="input-field w-full"
                        >
                            <option value="">All Vehicles</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.vehicleName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-2">Payment Method</label>
                        <select
                            value={filter.paymentMethod}
                            onChange={(e) => setFilter({ ...filter, paymentMethod: e.target.value })}
                            className="input-field w-full"
                        >
                            <option value="all">All Methods</option>
                            <option value="cash">Cash</option>
                            <option value="mpesa">M-Pesa</option>
                            <option value="bank">Bank</option>
                            <option value="credit">Credit</option>
                        </select>
                    </div>
                </div>
                <button onClick={fetchSales} className="btn-primary mt-3">
                    Apply Filters
                </button>
            </div>

            {/* Sales Table */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Receipt #</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Customer</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Payment</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm font-mono text-slate-900">{sale.receiptNumber}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900">
                                        {new Date(sale.saleDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-900">
                                        {sale.customerName || "Walk-in"}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                        KSh {sale.grandTotal.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                                            {sale.paymentMethod}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-xs px-2 py-1 rounded ${sale.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                                                sale.status === "voided" ? "bg-rose-100 text-rose-800" :
                                                    "bg-amber-100 text-amber-800"
                                            }`}>
                                            {sale.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => setSelectedSale(sale)}
                                                className="text-sky-600 hover:text-sky-700 text-xs"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            {sale.status === "completed" && (
                                                <button
                                                    onClick={() => handleVoidSale(sale.id)}
                                                    className="text-rose-600 hover:text-rose-700 text-xs"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sale Details Modal */}
            {selectedSale && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="glass-panel p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4">Sale Details</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500">Receipt Number</p>
                                    <p className="font-mono font-semibold">{selectedSale.receiptNumber}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Date</p>
                                    <p className="font-semibold">{new Date(selectedSale.saleDate).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Customer</p>
                                    <p className="font-semibold">{selectedSale.customerName || "Walk-in"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Payment Method</p>
                                    <p className="font-semibold">{selectedSale.paymentMethod}</p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="font-semibold mb-2">Items</h3>
                                <div className="space-y-2">
                                    {selectedSale.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span>{item.productName} x {item.quantity}</span>
                                            <span>KSh {item.totalPrice.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t pt-4 space-y-2">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>KSh {selectedSale.subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tax:</span>
                                    <span>KSh {selectedSale.taxAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Discount:</span>
                                    <span>KSh {selectedSale.discountAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-lg">
                                    <span>Grand Total:</span>
                                    <span>KSh {selectedSale.grandTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            <button onClick={() => setSelectedSale(null)} className="btn-ghost w-full">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
