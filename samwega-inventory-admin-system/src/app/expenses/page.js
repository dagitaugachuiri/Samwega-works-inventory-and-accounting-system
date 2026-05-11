"use client"
import { useState, useEffect } from "react";
import { Plus, Search, CheckCircle, XCircle, Clock, Calendar, Filter, Truck, User, Fuel, Wrench, Briefcase, Calculator, Trash2, DollarSign, Loader2 } from "lucide-react";
import api from "../../lib/api";

const CATEGORY_NAMES = {
    fuel: "Fuel",
    maintenance: "Maintenance",
    salaries: "Salaries & Allowances",
    rent: "Rent & Rates",
    utilities: "Utilities (Water/Elec)",
    supplies: "Supplies & Consumables",
    insurance: "Insurance",
    taxes: "Taxes (KRA/VAT)",
    licenses: "Licenses & Permits",
    permits: "Permits",
    marketing: "Marketing & Promo",
    travel: "Travel & Transport",
    meals: "Meals & Entertainment",
    communication: "Communication & Airtime",
    office: "Office Expenses",
    legal: "Legal Fees",
    professional_fees: "Professional Fees",
    bank_charges: "Bank Charges",
    fines: "Fines & Penalties",
    security: "Security",
    equipment: "Equipment & Assets",
    loans: "Loan Repayments",
    other: "Other Expenses"
};

const CATEGORY_ICONS = {
    fuel: Fuel,
    maintenance: Wrench,
    salary: User,
    rent: Briefcase,
    utilities: Calculator,
    other: DollarSignIcon
};

function DollarSignIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" x2="12" y1="2" y2="22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    )
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Filters
    const [vehicleFilter, setVehicleFilter] = useState("");
    const [search, setSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Data
    const [vehicles, setVehicles] = useState([]);
    const [categoryStats, setCategoryStats] = useState(null);

    // Batch Form State
    const [expenseRows, setExpenseRows] = useState([
        { id: Date.now(), category: "", amount: "", description: "", vehicleId: "" }
    ]);
    const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchVehicles();
        // Default to all-time (empty dates)
    }, []);

    useEffect(() => {
        // Fetch data whenever filters change
        fetchExpenses();
        fetchCategoryStats();
    }, [startDate, endDate, vehicleFilter]);

    const fetchVehicles = async () => {
        try {
            const response = await api.getVehicles();
            setVehicles(response?.data?.vehicles || response?.vehicles || []);
        } catch (error) {
            console.error("Failed to fetch vehicles:", error);
        }
    };

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const filters = {};

            // Only add filters if they have values
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;
            if (vehicleFilter) filters.vehicleId = vehicleFilter;

            const response = await api.getExpenses(filters);
            if (response.success && response.data) {
                // Handle different response structures (pagination wrapper vs direct array)
                const expensesList = response.data.expenses || response.data || [];
                setExpenses(expensesList);
            }
        } catch (error) {
            console.error("Failed to fetch expenses:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategoryStats = async () => {
        try {
            // If no dates selected, use a wide range for "all time" stats
            // or default to current year/context if prefered, but "all time" requested.
            const statsStartDate = startDate || '2020-01-01';
            const statsEndDate = endDate || new Date().toISOString().split('T')[0];

            const response = await api.getExpensesByCategory(statsStartDate, statsEndDate);
            if (response.success) {
                setCategoryStats(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch category stats:", error);
        }
    };

    const addRow = () => {
        setExpenseRows([...expenseRows, { id: Date.now(), category: "", amount: "", description: "", vehicleId: "" }]);
    };

    const removeRow = (id) => {
        if (expenseRows.length > 1) {
            setExpenseRows(expenseRows.filter(row => row.id !== id));
        }
    };

    const updateRow = (id, field, value) => {
        setExpenseRows(expenseRows.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Filter out empty rows
        const activeRows = expenseRows.filter(row => row.category && row.amount);
        
        if (activeRows.length === 0) {
            alert("Please fill in at least one expense row");
            return;
        }

        try {
            setIsSubmitting(true);
            
            // Use batch creation API to send only one request
            const batchPayload = {
                expenses: activeRows.map(row => ({
                    category: row.category,
                    amount: parseFloat(row.amount),
                    description: row.description,
                    vehicleId: row.vehicleId || null
                })),
                expenseDate: batchDate
            };
            
            await api.createExpenseBatch(batchPayload);

            setShowAddModal(false);
            // Reset to initial state
            setExpenseRows([{ id: Date.now(), category: "", amount: "", description: "", vehicleId: "" }]);
            setBatchDate(new Date().toISOString().split('T')[0]);
            
            // Refresh data
            fetchExpenses();
            fetchCategoryStats();
        } catch (error) {
            console.error("Failed to create expenses:", error);
            alert("Failed to record some expenses. Please check your data and try again.");
        } finally {
            setIsSubmitting(false);
        }
    };



    const filteredExpenses = expenses.filter(expense => {
        const matchesSearch = !search ||
            expense.description?.toLowerCase().includes(search.toLowerCase()) ||
            expense.category?.toLowerCase().includes(search.toLowerCase()) ||
            expense.vehicleName?.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage all money-out records</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="btn-primary">
                    <Plus className="mr-2" size={16} />
                    New Expense
                </button>
            </div>

            {/* Stats Overview */}
            {categoryStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-panel px-5 py-5 border-l-4 border-l-sky-500">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Expenses</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">KSh {categoryStats.totalExpenses.toLocaleString()}</p>
                        <p className="text-xs text-slate-400 mt-2">{categoryStats.totalCount} records</p>
                    </div>
                    {categoryStats.categories.slice(0, 3).map((cat) => {
                        const Icon = CATEGORY_ICONS[cat.category.toLowerCase()] || DollarSignIcon;
                        return (
                            <div key={cat.category} className="glass-panel px-5 py-5">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{cat.category}</p>
                                    <Icon size={16} className="text-slate-400" />
                                </div>
                                <p className="text-xl font-semibold text-slate-900">KSh {cat.totalAmount.toLocaleString()}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filters */}
            <div className="glass-panel p-5 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="input-field w-full text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="input-field w-full text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle</label>
                            <select
                                value={vehicleFilter}
                                onChange={(e) => setVehicleFilter(e.target.value)}
                                className="input-field w-full text-sm"
                            >
                                <option value="">All Vehicles</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.vehicleName}</option>
                                ))}
                            </select>
                        </div>

                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search description, category or vehicle..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-field pl-9 w-full"
                    />
                </div>
            </div>

            {/* Expenses List */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Entity / Vehicle</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Description</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount</th>

                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredExpenses.length > 0 ? (
                                filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                                            {new Date(expense.expenseDate || expense.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900">
                                            {expense.vehicleName ? (
                                                <span className="flex items-center gap-1.5 text-slate-700">
                                                    <Truck size={14} className="text-slate-400" />
                                                    {expense.vehicleName}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-slate-500 italic">
                                                    <User size={14} />
                                                    {expense.submittedByName || 'Admin'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200 uppercase">
                                                {CATEGORY_NAMES[expense.category] || expense.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate" title={expense.description}>
                                            {expense.description}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 whitespace-nowrap">
                                            KSh {expense.amount.toLocaleString()}
                                        </td>

                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                                        No expenses found for the selected period
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Expense Modal - Batch Mode */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="glass-panel p-0 max-w-5xl w-full animate-in fade-in zoom-in-95 duration-200 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Record Multiple Expenses</h2>
                                <p className="text-xs text-slate-500 mt-1">Add details for all expenses incurred. You can add multiple rows.</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                            <div className="mb-6 flex items-center gap-4">
                                <div className="w-48">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expense Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="date"
                                            value={batchDate}
                                            onChange={(e) => setBatchDate(e.target.value)}
                                            className="input-field pl-9 w-full text-sm font-medium"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex-1"></div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Amount</p>
                                    <p className="text-2xl font-black text-sky-600">
                                        KSh {expenseRows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-3">
                                    {expenseRows.map((row, index) => (
                                        <div key={row.id} className="flex flex-col md:flex-row gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-sky-200 transition-all group">
                                            <div className="w-full md:w-1/4">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                                                <select
                                                    value={row.category}
                                                    onChange={(e) => updateRow(row.id, 'category', e.target.value)}
                                                    className="input-field w-full text-sm"
                                                    required
                                                >
                                                    <option value="">Select Category</option>
                                                    <option value="fuel">Fuel</option>
                                                    <option value="maintenance">Maintenance</option>
                                                    <option value="salaries">Salaries & Allowances</option>
                                                    <option value="rent">Rent & Rates</option>
                                                    <option value="utilities">Utilities (Water/Elec)</option>
                                                    <option value="supplies">Supplies & Consumables</option>
                                                    <option value="insurance">Insurance</option>
                                                    <option value="taxes">Taxes (KRA/VAT)</option>
                                                    <option value="licenses">Licenses & Permits</option>
                                                    <option value="marketing">Marketing & Promo</option>
                                                    <option value="travel">Travel & Transport</option>
                                                    <option value="meals">Meals & Entertainment</option>
                                                    <option value="communication">Communication & Airtime</option>
                                                    <option value="office">Office Expenses</option>
                                                    <option value="professional_fees">Professional Fees</option>
                                                    <option value="bank_charges">Bank Charges</option>
                                                    <option value="fines">Fines & Penalties</option>
                                                    <option value="security">Security</option>
                                                    <option value="equipment">Equipment & Assets</option>
                                                    <option value="loans">Loan Repayments</option>
                                                    <option value="other">Other Expenses</option>
                                                </select>
                                            </div>

                                            <div className="w-full md:w-1/5">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (KSh)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">KSh</span>
                                                    <input
                                                        type="number"
                                                        value={row.amount}
                                                        onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                                                        className="input-field pl-10 w-full text-sm font-semibold"
                                                        placeholder="0.00"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="w-full md:w-1/4">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vehicle (Optional)</label>
                                                <select
                                                    value={row.vehicleId}
                                                    onChange={(e) => updateRow(row.id, 'vehicleId', e.target.value)}
                                                    className="input-field w-full text-sm"
                                                >
                                                    <option value="">General Expense</option>
                                                    {vehicles.map(v => (
                                                        <option key={v.id} value={v.id}>{v.vehicleName}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                                                <input
                                                    type="text"
                                                    value={row.description}
                                                    onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                                                    className="input-field w-full text-sm"
                                                    placeholder="Enter details..."
                                                    required
                                                />
                                            </div>

                                            <div className="flex items-end pb-1">
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(row.id)}
                                                    disabled={expenseRows.length === 1}
                                                    className="p-2 text-slate-300 hover:text-rose-500 disabled:opacity-0 transition-colors"
                                                    title="Remove Row"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addRow}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-sky-600 hover:border-sky-300 hover:bg-sky-50/50 transition-all flex items-center justify-center gap-2 font-medium"
                                >
                                    <Plus size={18} />
                                    Add Another Expense Row
                                </button>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="btn-ghost flex-1 py-3"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                className="btn-primary flex-[2] py-3 shadow-lg shadow-sky-200 flex items-center justify-center gap-2"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Recording {expenseRows.filter(r => r.category && r.amount).length} Expenses...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={18} />
                                        Record All Expenses
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
