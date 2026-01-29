"use client"
import { useState, useEffect } from "react";
import { Plus, CheckCircle, AlertTriangle, DollarSign } from "lucide-react";
import api from "../../lib/api";

export default function ReconciliationPage() {
    const [reconciliations, setReconciliations] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedVehicle, setSelectedVehicle] = useState("");

    useEffect(() => {
        fetchReconciliations();
        fetchVehicles();
    }, []);

    const fetchReconciliations = async () => {
        try {
            setLoading(true);
            const response = await api.getReconciliations();
            if (response.success && response.data) {
                setReconciliations(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch reconciliations:", error);
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

    const handleCreateReconciliation = async () => {
        if (!selectedVehicle || !selectedDate) {
            alert("Please select vehicle and date");
            return;
        }

        try {
            await api.createReconciliation({
                vehicleId: selectedVehicle,
                date: selectedDate
            });
            setShowCreateModal(false);
            fetchReconciliations();
        } catch (error) {
            console.error("Failed to create reconciliation:", error);
            alert("Failed to create reconciliation");
        }
    };

    const handleApprove = async (id) => {
        try {
            await api.approveReconciliation(id, { status: "approved" });
            fetchReconciliations();
        } catch (error) {
            console.error("Failed to approve reconciliation:", error);
            alert("Failed to approve reconciliation");
        }
    };

    const pendingCount = reconciliations.filter(r => r.status === "pending").length;
    const approvedCount = reconciliations.filter(r => r.status === "approved").length;

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-300">Loading reconciliations…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Daily Reconciliation</h1>
                    <p className="text-sm text-slate-500 mt-1">Reconcile daily sales and cash</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                    <Plus className="mr-2" size={16} />
                    New Reconciliation
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-600">Total</p>
                    <p className="text-2xl font-semibold text-slate-900 mt-2">{reconciliations.length}</p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Pending</p>
                    <p className="text-2xl font-semibold text-amber-700 mt-2">{pendingCount}</p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Approved</p>
                    <p className="text-2xl font-semibold text-emerald-700 mt-2">{approvedCount}</p>
                </div>
            </div>

            {/* Reconciliations List */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Vehicle</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Expected</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Actual</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Variance</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reconciliations.map((recon) => {
                                const variance = (recon.actualCash || 0) - (recon.expectedCash || 0);
                                const hasDiscrepancy = Math.abs(variance) > 0;

                                return (
                                    <tr key={recon.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-sm text-slate-900">
                                            {new Date(recon.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900">
                                            {vehicles.find(v => v.id === recon.vehicleId)?.vehicleName || recon.vehicleId}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                            KSh {(recon.expectedCash || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                            KSh {(recon.actualCash || 0).toLocaleString()}
                                        </td>
                                        <td className={`px-4 py-3 text-right text-sm font-semibold ${variance > 0 ? "text-emerald-700" : variance < 0 ? "text-rose-700" : "text-slate-900"
                                            }`}>
                                            {variance > 0 ? "+" : ""}{variance.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {recon.status === "approved" ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-xs">
                                                    <CheckCircle size={12} />
                                                    Approved
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs">
                                                    <AlertTriangle size={12} />
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {recon.status === "pending" && (
                                                <button
                                                    onClick={() => handleApprove(recon.id)}
                                                    className="text-emerald-600 hover:text-emerald-700 text-xs"
                                                >
                                                    Approve
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="glass-panel p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4">New Reconciliation</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Vehicle</label>
                                <select
                                    value={selectedVehicle}
                                    onChange={(e) => setSelectedVehicle(e.target.value)}
                                    className="input-field w-full"
                                >
                                    <option value="">Select vehicle</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.vehicleName} - {v.registrationNumber}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="input-field w-full"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowCreateModal(false)} className="btn-ghost flex-1">
                                    Cancel
                                </button>
                                <button onClick={handleCreateReconciliation} className="btn-primary flex-1">
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
