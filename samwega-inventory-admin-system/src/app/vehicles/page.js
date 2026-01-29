"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, Truck, X, User, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import api from "../../lib/api";

export default function VehiclesPage() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ vehicleName: "", vehicleNumber: "" });
    const [submitting, setSubmitting] = useState(false);

    // Fetch vehicles
    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                const response = await api.getVehicles();
                console.log("Raw API response:", response);
                // Response is: { success, message, data: { vehicles: [...], pagination: {...} } }
                const vList = response?.data?.vehicles || response?.vehicles || response?.data || [];
                console.log("Extracted vehicles:", vList);
                setVehicles(Array.isArray(vList) ? vList : []);
            } catch (err) {
                console.error("Failed to fetch vehicles", err);
            } finally {
                setLoading(false);
            }
        };
        fetchVehicles();
    }, []);

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        alert("Form submitted with: " + formData.vehicleNumber);  // Debug

        if (!formData.vehicleNumber) {
            alert("Please enter a vehicle number");
            return;
        }

        setSubmitting(true);
        try {
            console.log("Creating vehicle:", formData);
            const newVehicle = await api.createVehicle({
                vehicleName: formData.vehicleName || formData.vehicleNumber,
                vehicleNumber: formData.vehicleNumber
            });
            console.log("Vehicle created:", newVehicle);
            alert("Vehicle created successfully!");

            // Refresh vehicles list
            const data = await api.getVehicles();
            console.log("Fetched vehicles data:", data);
            const vList = data?.vehicles || data?.data || data || [];
            console.log("Extracted vehicles list:", vList);
            alert("Fetched " + vList.length + " vehicles");
            setVehicles(Array.isArray(vList) ? vList : []);
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
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-7xl space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link href="/dashboard" className="btn-ghost text-xs text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Sales Vehicles</h1>
                        <p className="text-sm text-slate-500">Manage your fleet and track stock issuances</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn-primary text-sm shadow-lg shadow-sky-200 hover:shadow-sky-300 transition-all"
                    >
                        <Plus size={18} className="mr-2" />
                        Add Vehicle
                    </button>
                </div>

                {/* Vehicles Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="group relative overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                            <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-sky-50 rounded-lg text-sky-600 group-hover:bg-sky-100 transition-colors">
                                        <Truck size={24} />
                                    </div>
                                    <div className="px-2 py-1 bg-slate-100 rounded text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                                        ID: {vehicle.id}
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 mb-1">{vehicle.vehicleName}</h3>
                                <p className="text-sm font-mono text-slate-500 mb-4">{vehicle.vehicleNumber}</p>

                                <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
                                    <User size={14} className="text-slate-400" />
                                    <span>{vehicle.assignedUserName || "No driver assigned"}</span>
                                </div>

                                <Link
                                    href={`/vehicles/${vehicle.id}`}
                                    className="flex items-center justify-between w-full px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-700 transition-colors group-hover:text-sky-700"
                                >
                                    <span>Issue History</span>
                                    <ArrowRight size={16} />
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
                            <button
                                onClick={() => setShowModal(true)}
                                className="btn-primary text-sm"
                            >
                                <Plus size={18} className="mr-2" />
                                Add Vehicle
                            </button>
                        </div>
                    )}
                </div>
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
                                    onChange={(e) => setFormData({ ...formData, vehicleName: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
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
                                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
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
        </div>
    );
}
