"use client"
import { useState, useEffect } from "react";
import { Plus, Search, DollarSign, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import api from "../../lib/api";

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [stats, setStats] = useState({
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0
    });

    const [formData, setFormData] = useState({
        category: "",
        amount: "",
        description: "",
        vehicleId: "",
        receiptUrl: ""
    });

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const response = await api.getExpenses();
            if (response.success && response.data) {
                setExpenses(response.data);
                calculateStats(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch expenses:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (expensesData) => {
        const approved = expensesData.filter(e => e.status === "approved").reduce((sum, e) => sum + e.amount, 0);
        const pending = expensesData.filter(e => e.status === "pending").reduce((sum, e) => sum + e.amount, 0);
        const rejected = expensesData.filter(e => e.status === "rejected").reduce((sum, e) => sum + e.amount, 0);

        setStats({
            total: approved + pending,
            approved,
            pending,
            rejected
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.createExpense(formData);
            setShowAddModal(false);
            setFormData({ category: "", amount: "", description: "", vehicleId: "", receiptUrl: "" });
            fetchExpenses();
        } catch (error) {
            console.error("Failed to create expense:", error);
            alert("Failed to create expense");
        }
    };

    const handleApprove = async (id) => {
        try {
            await api.approveExpense(id, { status: "approved" });
            fetchExpenses();
        } catch (error) {
            console.error("Failed to approve expense:", error);
            alert("Failed to approve expense");
        }
    };

    const handleReject = async (id) => {
        const reason = prompt("Reason for rejection:");
        if (!reason) return;

        try {
            await api.approveExpense(id, { status: "rejected", rejectionReason: reason });
            fetchExpenses();
        } catch (error) {
            console.error("Failed to reject expense:", error);
            alert("Failed to reject expense");
        }
    };

    const filteredExpenses = expenses.filter(expense => {
        const matchesFilter = filter === "all" || expense.status === filter;
        const matchesSearch = !search ||
            expense.description?.toLowerCase().includes(search.toLowerCase()) ||
            expense.category?.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
                    <p className="text-sm text-slate-300">Loading expenses…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage business expenses</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="btn-primary">
                    <Plus className="mr-2" size={16} />
                    New Expense
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-600">Total</p>
                    <p className="text-2xl font-semibold text-slate-900 mt-2">KSh {stats.total.toLocaleString()}</p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Approved</p>
                    <p className="text-2xl font-semibold text-emerald-700 mt-2">KSh {stats.approved.toLocaleString()}</p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Pending</p>
                    <p className="text-2xl font-semibold text-amber-700 mt-2">KSh {stats.pending.toLocaleString()}</p>
                </div>
                <div className="glass-panel px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-rose-600">Rejected</p>
                    <p className="text-2xl font-semibold text-rose-700 mt-2">KSh {stats.rejected.toLocaleString()}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-panel px-5 py-5">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search expenses..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-field pl-9 w-full"
                        />
                    </div>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="input-field"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Expenses List */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Description</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredExpenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm text-slate-900">
                                        {new Date(expense.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-900">{expense.description}</td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                        KSh {expense.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {expense.status === "approved" && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-xs">
                                                <CheckCircle size={12} />
                                                Approved
                                            </span>
                                        )}
                                        {expense.status === "pending" && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs">
                                                <Clock size={12} />
                                                Pending
                                            </span>
                                        )}
                                        {expense.status === "rejected" && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-100 text-rose-800 text-xs">
                                                <XCircle size={12} />
                                                Rejected
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {expense.status === "pending" && (
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleApprove(expense.id)}
                                                    className="text-emerald-600 hover:text-emerald-700 text-xs"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReject(expense.id)}
                                                    className="text-rose-600 hover:text-rose-700 text-xs"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Expense Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="glass-panel p-6 max-w-md w-full mx-4">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4">New Expense</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="input-field w-full"
                                    required
                                >
                                    <option value="">Select category</option>
                                    <option value="fuel">Fuel</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="salary">Salary</option>
                                    <option value="rent">Rent</option>
                                    <option value="utilities">Utilities</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="input-field w-full"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="input-field w-full"
                                    rows="3"
                                    required
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary flex-1">
                                    Create Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
