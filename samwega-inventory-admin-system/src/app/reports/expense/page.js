"use client";

import { useState, useEffect } from "react";
import { Download, Calendar, Filter, FileText } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";

export default function ExpenseReportPage() {
    const [expenses, setExpenses] = useState([]);
    const [summary, setSummary] = useState(null);
    const [byCategory, setByCategory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        // Set default dates (current month)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    }, []);

    const fetchData = async () => {
        if (!startDate || !endDate) return;

        try {
            setLoading(true);
            const res = await api.getExpenseReport(startDate, endDate);
            if (res.success) {
                // Ensure we have arrays
                setExpenses(Array.isArray(res.data.expenses) ? res.data.expenses : []);
                setSummary(res.data.summary || {});
                setByCategory(Array.isArray(res.data.byCategory) ? res.data.byCategory : []);
            }
        } catch (error) {
            console.error("Failed to fetch expense report:", error);
            setExpenses([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate]);

    const downloadPDF = async () => {
        setDownloading(true);
        try {
            const res = await api.generateExpensePDF(startDate, endDate);
            if (res.success && res.data?.pdfUrl) {
                const link = document.createElement('a');
                link.href = res.data.pdfUrl;
                link.download = res.data.reportName || `expense-report-${startDate}-${endDate}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (e) {
            alert("Failed to download PDF");
        } finally {
            setDownloading(false);
        }
    };

    const filters = (
        <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field py-1.5 text-sm"
            />
            <span className="text-slate-400">to</span>
            <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field py-1.5 text-sm"
            />
            <button
                onClick={fetchData}
                className="btn-secondary py-1.5 px-3 text-sm ml-2"
            >
                Apply
            </button>
        </div>
    );

    const actions = (
        <button
            className="btn-primary flex items-center gap-2"
            onClick={downloadPDF}
            disabled={downloading}
        >
            <Download size={18} />
            {downloading ? "Generating..." : "Download PDF"}
        </button>
    );

    const kpiCards = summary ? (
        <>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Total Expenses</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    KES {summary.totalExpenses?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm border-l-4 border-l-green-500">
                <p className="text-sm font-medium text-slate-500">Approved</p>
                <h3 className="text-2xl font-bold text-green-700 mt-1">
                    KES {summary.approvedExpenses?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm border-l-4 border-l-amber-500">
                <p className="text-sm font-medium text-slate-500">Pending</p>
                <h3 className="text-2xl font-bold text-amber-700 mt-1">
                    KES {summary.pendingExpenses?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm border-l-4 border-l-red-500">
                <p className="text-sm font-medium text-slate-500">Rejected</p>
                <h3 className="text-2xl font-bold text-red-700 mt-1">
                    KES {summary.rejectedExpenses?.toLocaleString() || 0}
                </h3>
            </div>
        </>
    ) : null;

    return (
        <ReportLayout
            title="Expense Report"
            description="Detailed breakdown of operational expenses by category and status."
            loading={loading}
            onRefresh={fetchData}
            filters={filters}
            actions={actions}
            kpiCards={kpiCards}
        >
            <div className="min-w-full inline-block align-middle">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (KES)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {expenses.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                                        No expenses recorded for this period.
                                    </td>
                                </tr>
                            ) : (
                                expenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(expense.expenseDate?._seconds * 1000 || expense.expenseDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                            {expense.description || expense.reason || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                {expense.category || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                            {parseFloat(expense.amount || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>

                        {/* Categorical Summary Footer */}
                        {byCategory.length > 0 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan="4" className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-slate-200">
                                        Summary by Category
                                    </td>
                                </tr>
                                {byCategory.map((cat, idx) => (
                                    <tr key={idx} className="bg-slate-50">
                                        <td colSpan="1" className="px-6 py-2 text-sm text-gray-600 pl-10">
                                            {cat.category}
                                        </td>
                                        <td colSpan="2" className="px-6 py-2 text-sm text-gray-500 text-right">
                                            {cat.count} transactions
                                        </td>
                                        <td className="px-6 py-2 text-sm font-medium text-gray-900 text-right">
                                            KES {cat.totalAmount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </ReportLayout>
    );
}
