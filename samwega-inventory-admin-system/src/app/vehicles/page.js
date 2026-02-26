"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, Truck, X, User, ArrowRight, ArrowLeft, FileText, CheckCircle } from "lucide-react";
import Link from "next/link";
import api from "../../lib/api";

export default function VehiclesPage() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ vehicleName: "", vehicleNumber: "" });
    const [submitting, setSubmitting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [user, setUser] = useState(null);

    const fetchVehicles = async () => {
        try {
            const response = await api.getVehicles();
            // Unified extraction logic
            const vList = response?.data?.vehicles || response?.vehicles || (Array.isArray(response?.data) ? response.data : []);
            setVehicles(Array.isArray(vList) ? vList : []);
        } catch (err) {
            console.error("Failed to fetch vehicles", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUser = async () => {
        try {
            const res = await api.getCurrentUser();
            if (res.success) {
                setUser(res.data);
            }
        } catch (error) {
            console.error("Error fetching user:", error);
        }
    };

    // Fetch vehicles
    useEffect(() => {
        fetchVehicles();
        fetchUser();
    }, []);

    const showNotification = (message) => {
        setNotification(message);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleAddVehicle = async (e) => {
        e.preventDefault();


        if (!formData.vehicleNumber) {
            alert("Please enter a vehicle number");
            return;
        }

        setSubmitting(true);
        try {
            await api.createVehicle({
                vehicleName: (formData.vehicleName || formData.vehicleNumber).toUpperCase(),
                vehicleNumber: formData.vehicleNumber.toUpperCase()
            });

            showNotification("Vehicle created successfully!");

            // Refresh vehicles list
            await fetchVehicles();
            setFormData({ vehicleName: "", vehicleNumber: "" });
            setShowModal(false);
        } catch (err) {
            console.error("Error adding vehicle", err);
            alert(err.message || "Failed to add vehicle");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600" />
                    <p className="text-sm text-slate-500">Loading vehicles…</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Notification Toast */}
            {notification && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-800">
                        <CheckCircle size={18} className="text-emerald-400" />
                        <span className="text-sm font-medium">{notification}</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-4 text-slate-900">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Sales Vehicles</h1>
                    <p className="text-sm text-slate-500">Manage your fleet and track stock issuances</p>
                </div>
                {user?.role !== 'accountant' && (
                    <div className="hidden items-center gap-2 md:flex">
                        <button
                            onClick={() => setShowModal(true)}
                            className="ml-2 btn-primary text-xs shadow-lg shadow-sky-200 hover:shadow-sky-300 transition-all"
                        >
                            <Plus size={14} className="mr-1" />
                            Add Vehicle
                        </button>
                    </div>
                )}
            </div>

            {/* Vehicles Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                        {/* Card Header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                            <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center">
                                <Truck size={16} className="text-slate-500" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-semibold text-sm text-slate-900 truncate">{vehicle.vehicleName || vehicle.vehicleNumber}</h3>
                                <p className="text-xs text-slate-400 font-mono">{vehicle.vehicleNumber}</p>
                            </div>
                        </div>

                        {/* Driver */}
                        <div className="px-4 py-3 flex items-center gap-2 text-sm text-slate-600">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate text-xs">{vehicle.assignedUserName || "No driver assigned"}</span>
                        </div>

                        {/* Footer */}
                        <div className="px-4 pb-3">
                            <Link
                                href={`/vehicles/${vehicle.id}`}
                                className="flex items-center justify-between w-full px-3 py-1.5 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 rounded-md text-xs font-medium text-slate-600 transition-colors border border-slate-100"
                            >
                                <span>View Details</span>
                                <ArrowRight size={13} />
                            </Link>
                        </div>
                    </div>
                ))}

                {/* Empty State / Add New Card */}
                {vehicles.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                        <Truck size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium text-slate-600">No vehicles found</p>
                        <p className="text-sm mb-6">Get started by adding your first vehicle</p>
                        {user?.role !== 'accountant' && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="btn-primary text-sm"
                            >
                                <Plus size={18} className="mr-2" />
                                Add Vehicle
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Add Vehicle Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-lg font-bold text-slate-900">Add New Vehicle</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddVehicle} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Vehicle Name (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Van A"
                                    value={formData.vehicleName}
                                    onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value.toUpperCase() })}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Vehicle Number *
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. KDV 123B"
                                    value={formData.vehicleNumber}
                                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all uppercase"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-200 hover:bg-sky-700 disabled:opacity-70 transition-all"
                                >
                                    {submitting ? "Saving..." : "Save Vehicle"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
