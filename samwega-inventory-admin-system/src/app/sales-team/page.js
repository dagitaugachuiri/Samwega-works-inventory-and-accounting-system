"use client";

import { useEffect, useState } from "react";
import { Users, CheckCircle, XCircle, Truck, ArrowLeft, Plus, Shield, Lock, X, Key, GraduationCap, User, Activity, Search, Filter, Calendar, RotateCw } from "lucide-react";
import Link from "next/link";

import api from "../../lib/api";

export default function SalesTeamPage() {
    const [users, setUsers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'admins', 'accounting', or 'activity'

    // Add Admin Modal State
    const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
    const [adminFormData, setAdminFormData] = useState({
        username: '',
        email: '',
        phone: '',
        password: '',
        role: 'admin'
    });
    const [submittingAdmin, setSubmittingAdmin] = useState(false);

    // Password Change Modal State
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [passwordTarget, setPasswordTarget] = useState(null); // { id, name }
    const [newPassword, setNewPassword] = useState('');
    const [updatingPassword, setUpdatingPassword] = useState(false);

    // Activity Log State
    const [activityLogs, setActivityLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logFilters, setLogFilters] = useState({
        userId: '',
        action: '',
        resource: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [usersRes, vehiclesRes, currentUserRes] = await Promise.all([
                api.getUsers({}),
                api.getVehicles(),
                api.getCurrentUser()
            ]);

            if (usersRes.success) {
                setUsers(usersRes.data || []);
            }

            if (vehiclesRes.success) {
                setVehicles(vehiclesRes.data.vehicles || []);
            }

            if (currentUserRes.success) {
                setCurrentUser(currentUserRes.data);
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivityLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await api.getActivityLogs(logFilters);
            if (res.success) {
                setActivityLogs(res.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch activity logs", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'activity') {
            fetchActivityLogs();
        }
    }, [activeTab, logFilters]);

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

    const handleAddAdmin = async (e) => {
        e.preventDefault();
        setSubmittingAdmin(true);
        try {
            const res = await api.register(adminFormData);

            if (res.success) {
                setIsAddAdminOpen(false);
                setAdminFormData({
                    username: '',
                    email: '',
                    phone: '',
                    password: '',
                    role: 'admin'
                });
                await fetchData();
                alert('User added successfully');
            } else {
                alert(res.error || 'Failed to add user');
            }
        } catch (err) {
            console.error('Failed to add user:', err);
            alert('Failed to add user: ' + (err.message || 'Unknown error'));
        } finally {
            setSubmittingAdmin(false);
        }
    };

    const openPasswordModal = (user) => {
        setPasswordTarget({
            id: user.id,
            name: user.username
        });
        setNewPassword('');
        setPasswordModalOpen(true);
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (!passwordTarget || !newPassword) return;

        setUpdatingPassword(true);
        try {
            const res = await api.updateUser(passwordTarget.id, {
                password: newPassword
            });

            if (res.success) {
                alert(`Password updated successfully for ${passwordTarget.name}`);
                setPasswordModalOpen(false);
                setPasswordTarget(null);
                setNewPassword('');
            } else {
                alert(res.error || 'Failed to update password');
            }
        } catch (err) {
            console.error('Error updating password:', err);
            alert('Error updating password: ' + (err.message || 'Unknown error'));
        } finally {
            setUpdatingPassword(false);
        }
    };

    const getUnassignedVehicles = () => {
        const assignedVehicleIds = users.map(u => u.assignedVehicleId).filter(Boolean);
        return vehicles.filter(v => !assignedVehicleIds.includes(v.id));
    };

    // Filter Lists
    const admins = users.filter(u => ['admin', 'store_manager'].includes(u.role));
    const accountingTeam = users.filter(u => u.role === 'accountant');
    const salesTeam = users.filter(u => u.role === 'sales_rep');

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-sky-600" />
                    <p className="text-sm text-slate-500">Loading team data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="btn-ghost text-xs">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
                        <p className="text-xs text-slate-500">Manage admins, sales reps, and assignments</p>
                    </div>
                </div>

                {currentUser && (
                    <div className="flex items-center gap-4">
                        {currentUser.role === 'admin' && (
                            <button
                                onClick={() => setIsAddAdminOpen(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus size={16} />
                                Add Member
                            </button>
                        )}
                        <div className="flex items-center gap-3 rounded-full bg-white px-4 py-1.5 shadow-sm border border-slate-100">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                                <User size={16} className="text-slate-600" />
                            </div>
                            <div className="text-xs">
                                <p className="font-semibold text-slate-900">You ({currentUser.username})</p>
                                <button
                                    onClick={() => openPasswordModal(currentUser)}
                                    className="text-sky-600 hover:underline"
                                >
                                    Change Password
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-slate-200">
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${activeTab === 'sales'
                            ? 'border-sky-600 text-sky-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Sales Team ({salesTeam.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${activeTab === 'admins'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Administrators ({admins.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('accounting')}
                        className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${activeTab === 'accounting'
                            ? 'border-emerald-600 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Accounting ({accountingTeam.length})
                    </button>
                    {currentUser?.role === 'admin' && (
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${activeTab === 'activity'
                                ? 'border-emerald-600 text-emerald-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            User Activity
                        </button>
                    )}
                </div>
            </div>

            {/* Activity Log View */}
            {activeTab === 'activity' && (
                <div className="glass-panel overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm flex-1 max-w-xs">
                                <Search size={16} className="text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Filter by Resource (sale, invoice...)"
                                    className="bg-transparent border-none focus:outline-none text-sm w-full"
                                    value={logFilters.resource}
                                    onChange={(e) => setLogFilters({ ...logFilters, resource: e.target.value })}
                                />
                            </div>
                            <select
                                className="bg-white rounded-lg border border-slate-200 px-3 py-1.5 shadow-sm text-sm focus:outline-none"
                                value={logFilters.action}
                                onChange={(e) => setLogFilters({ ...logFilters, action: e.target.value })}
                            >
                                <option value="">All Actions</option>
                                <option value="CREATE">CREATE</option>
                                <option value="UPDATE">UPDATE</option>
                                <option value="DELETE">DELETE</option>
                                <option value="VOID">VOID</option>
                                <option value="APPROVE">APPROVE</option>
                            </select>
                            <button
                                onClick={fetchActivityLogs}
                                className="p-2 text-slate-500 hover:text-sky-600 transition-colors"
                                title="Refresh Logs"
                            >
                                <RotateCw size={18} className={loadingLogs ? "animate-spin" : ""} />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-slate-200 bg-slate-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Timestamp</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Action</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Resource</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loadingLogs ? (
                                    <tr>
                                        <td colSpan="5" className="py-12 text-center text-slate-500">Loading logs...</td>
                                    </tr>
                                ) : activityLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-12 text-center text-slate-500">No activity logs found</td>
                                    </tr>
                                ) : (
                                    activityLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                {log.timestamp ? new Date(log.timestamp.seconds * 1000 || log.timestamp).toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-slate-100 rounded-full p-1">
                                                        <User size={12} className="text-slate-600" />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700">{log.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider
                                                    ${log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                                                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                            log.action === 'DELETE' ? 'bg-rose-100 text-rose-700' :
                                                                log.action === 'VOID' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-slate-100 text-slate-700'}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 capitalize">
                                                {log.resource}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {log.description}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Users Table */}
            {activeTab !== 'activity' && (
                <div className="glass-panel overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-slate-200 bg-slate-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Contact</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Status</th>
                                    {activeTab === 'sales' && (
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Assigned Vehicle</th>
                                    )}
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {(activeTab === 'sales' ? salesTeam : activeTab === 'admins' ? admins : accountingTeam).map((user) => {
                                    const assignedVehicle = vehicles.find(v => v.id === user.assignedVehicleId);
                                    const unassignedVehicles = getUnassignedVehicles();
                                    const isUpdating = updating === user.id;
                                    const isAdmin = user.role === 'admin';
                                    const isCurrentUser = currentUser && currentUser.id === user.id;

                                    return (
                                        <tr key={user.id} className={`hover:bg-slate-50 ${isCurrentUser ? 'bg-slate-50/50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>
                                                        {isAdmin ? <Shield size={20} /> : <Users size={20} />}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">
                                                            {user.username} {isCurrentUser && <span className="text-xs text-slate-400">(You)</span>}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Joined {new Date(user.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium 
                                                ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                        user.role === 'store_manager' ? 'bg-indigo-100 text-indigo-800' :
                                                            user.role === 'accountant' ? 'bg-emerald-100 text-emerald-800' :
                                                                'bg-blue-100 text-blue-800'}`}>
                                                    {user.role === 'sales_rep' ? 'Sales Rep' :
                                                        user.role === 'store_manager' ? 'Manager' :
                                                            user.role === 'accountant' ? 'Accountant' : 'Admin'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-700">{user.email}</p>
                                                <p className="text-xs text-slate-400">{user.phone || '-'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => toggleVerification(user.id, user.isVerified)}
                                                    disabled={isUpdating || isAdmin} // Admins usually auto-verified
                                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${user.isVerified
                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                        } ${(isUpdating || isAdmin) ? 'opacity-80 cursor-default' : ''}`}
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
                                            {activeTab === 'sales' && (
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={user.assignedVehicleId || ''}
                                                        onChange={(e) => assignVehicle(user.id, e.target.value)}
                                                        disabled={isUpdating}
                                                        className="w-full max-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none disabled:opacity-50 disabled:bg-slate-100"
                                                    >
                                                        <option value="">Unassigned</option>
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
                                                    {assignedVehicle && (
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            <Truck size={12} className="mr-1 inline" />
                                                            {assignedVehicle.registrationNumber}
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => openPasswordModal(user)}
                                                        className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                                        title="Change Password"
                                                    >
                                                        <Key size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {(activeTab === 'sales' ? salesTeam : activeTab === 'admins' ? admins : accountingTeam).length === 0 && (
                        <div className="py-12 text-center">
                            <Users size={48} className="mx-auto mb-4 text-slate-300" />
                            <p className="text-slate-500">No {activeTab} members found</p>
                        </div>
                    )}
                </div>
            )}

            {/* Add Admin Modal */}
            {isAddAdminOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">Add New Member</h2>
                            <button
                                onClick={() => setIsAddAdminOpen(false)}
                                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddAdmin} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                        <Users size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={adminFormData.username}
                                        onChange={(e) => setAdminFormData({ ...adminFormData, username: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={adminFormData.email}
                                    onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
                                <input
                                    type="tel"
                                    value={adminFormData.phone}
                                    onChange={(e) => setAdminFormData({ ...adminFormData, phone: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    placeholder="0712345678"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                                <select
                                    required
                                    value={adminFormData.role}
                                    onChange={(e) => setAdminFormData({ ...adminFormData, role: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="store_manager">Store Manager</option>
                                    <option value="accountant">Accountant</option>
                                    <option value="sales_rep">Sales Rep</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={adminFormData.password}
                                        onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={submittingAdmin}
                                    className="btn-primary w-full justify-center py-2.5 bg-purple-600 hover:bg-purple-700"
                                >
                                    {submittingAdmin ? 'Creating Member...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Password Change Modal */}
            {passwordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">Change Password</h2>
                            <button
                                onClick={() => setPasswordModalOpen(false)}
                                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="mb-4 text-sm text-slate-600">
                            Updating password for <span className="font-semibold text-slate-900">{passwordTarget?.name}</span>
                        </p>

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        placeholder="Enter new password"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={updatingPassword}
                                    className="btn-primary w-full justify-center py-2.5"
                                >
                                    {updatingPassword ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
