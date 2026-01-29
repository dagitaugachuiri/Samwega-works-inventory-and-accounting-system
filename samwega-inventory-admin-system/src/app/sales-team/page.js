"use client";

import { useEffect, useState } from "react";
import { Users, CheckCircle, XCircle, Truck, ArrowLeft } from "lucide-react";
import Link from "next/link";

import api from "../../lib/api";

export default function SalesTeamPage() {
    const [users, setUsers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [usersRes, vehiclesRes] = await Promise.all([
                api.getUsers({ role: 'sales_rep' }), // Filter for sales reps
                api.getVehicles()
            ]);

            if (usersRes.success) {
                setUsers(usersRes.data);
            }

            if (vehiclesRes.success) {
                setVehicles(vehiclesRes.data.vehicles || []);
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleVerification = async (userId, currentStatus) => {
        setUpdating(userId);
        try {
            const res = await api.verifyUser(userId, !currentStatus);
            if (res.success) {
                await fetchData();
            } else {
                alert('Failed to update verification status');
            }
        } catch (err) {
            console.error('Error updating verification:', err);
            alert('Error updating verification');
        } finally {
            setUpdating(null);
        }
    };

    const assignVehicle = async (userId, vehicleId) => {
        setUpdating(userId);
        try {
            const res = await api.assignVehicle(userId, vehicleId || null);
            if (res.success) {
                await fetchData();
            } else {
                alert(res.error || 'Failed to assign vehicle');
            }
        } catch (err) {
            console.error('Error assigning vehicle:', err);
            alert('Error assigning vehicle');
        } finally {
            setUpdating(null);
        }
    };

    const getUnassignedVehicles = () => {
        const assignedVehicleIds = users.map(u => u.assignedVehicleId).filter(Boolean);
        return vehicles.filter(v => !assignedVehicleIds.includes(v.id));
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600" />
                    <p className="text-sm text-slate-500">Loading sales team...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="btn-ghost text-xs">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Sales Team Management</h1>
                        <p className="text-xs text-slate-500">Manage user verification and vehicle assignments</p>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">User</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Email</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Assigned Vehicle</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {users.map((user) => {
                                const assignedVehicle = vehicles.find(v => v.id === user.assignedVehicleId);
                                const unassignedVehicles = getUnassignedVehicles();
                                const isUpdating = updating === user.id;

                                return (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                                                    <Users size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{user.username}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Joined {new Date(user.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-slate-700">{user.email}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleVerification(user.id, user.isVerified)}
                                                disabled={isUpdating}
                                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${user.isVerified
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                    } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {user.isVerified ? (
                                                    <>
                                                        <CheckCircle size={14} />
                                                        Verified
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle size={14} />
                                                        Pending
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            {assignedVehicle ? (
                                                <div className="flex items-center gap-2">
                                                    <Truck size={16} className="text-sky-600" />
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {assignedVehicle.vehicleName || 'Unnamed'}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{assignedVehicle.registrationNumber}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-400">No vehicle assigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={user.assignedVehicleId || ''}
                                                onChange={(e) => assignVehicle(user.id, e.target.value)}
                                                disabled={isUpdating}
                                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none disabled:opacity-50"
                                            >
                                                <option value="">Unassign</option>
                                                {assignedVehicle && (
                                                    <option value={assignedVehicle.id}>
                                                        {assignedVehicle.vehicleName || assignedVehicle.registrationNumber} (Current)
                                                    </option>
                                                )}
                                                {unassignedVehicles.map((vehicle) => (
                                                    <option key={vehicle.id} value={vehicle.id}>
                                                        {vehicle.vehicleName || vehicle.registrationNumber}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {users.length === 0 && (
                    <div className="py-12 text-center">
                        <Users size={48} className="mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-500">No sales team members yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}
