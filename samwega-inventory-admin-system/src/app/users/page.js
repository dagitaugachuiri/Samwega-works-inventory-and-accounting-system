"use client"
import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Users, Shield } from "lucide-react";
import api from "../../lib/api";

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");

    useEffect(() => {
        fetchUsers();
        fetchVehicles();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.getUsers();
            if (response.success && response.data) {
                setUsers(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch users:", error);
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

    const handleDelete = async (id) => {
        if (!confirm("Delete this user?")) return;
        try {
            await api.deleteUser(id);
            fetchUsers();
        } catch (error) {
            console.error("Failed to delete user:", error);
            alert("Failed to delete user");
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = !search ||
            user.fullName?.toLowerCase().includes(search.toLowerCase()) ||
            user.email?.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const getRoleBadge = (role) => {
        const badges = {
            admin: "bg-rose-100 text-rose-800",
            store_manager: "bg-violet-100 text-violet-800",
            sales_rep: "bg-sky-100 text-sky-800"
        };
        return badges[role] || "bg-slate-100 text-slate-800";
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-300">Loading users…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Users & Team</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage team members and permissions</p>
                </div>
                <button className="btn-primary">
                    <Plus className="mr-2" size={16} />
                    Add User
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-600">Total Users</p>
                    <p className="text-2xl font-semibold text-slate-900 mt-2">{users.length}</p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-rose-600">Admins</p>
                    <p className="text-2xl font-semibold text-rose-700 mt-2">
                        {users.filter(u => u.role === "admin").length}
                    </p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-violet-600">Managers</p>
                    <p className="text-2xl font-semibold text-violet-700 mt-2">
                        {users.filter(u => u.role === "store_manager").length}
                    </p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-sky-600">Sales Reps</p>
                    <p className="text-2xl font-semibold text-sky-700 mt-2">
                        {users.filter(u => u.role === "sales_rep").length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel px-5 py-5">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-field pl-9 w-full"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="input-field"
                    >
                        <option value="all">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="store_manager">Store Manager</option>
                        <option value="sales_rep">Sales Rep</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Role</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Vehicle</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => {
                                const assignedVehicle = vehicles.find(v => v.assignedUserId === user.id);
                                return (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                                                    <Users className="text-sky-600" size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{user.fullName}</p>
                                                    <p className="text-xs text-slate-500">{user.phoneNumber}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900">{user.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded ${getRoleBadge(user.role)}`}>
                                                {user.role?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900">
                                            {assignedVehicle ? assignedVehicle.vehicleName : "-"}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button className="text-sky-600 hover:text-sky-700">
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id)}
                                                    className="text-rose-600 hover:text-rose-700"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
