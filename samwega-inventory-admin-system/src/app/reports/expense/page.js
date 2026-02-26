"use client";

import { useState, useEffect } from "react";
import { Download, Calendar, Filter, FileText } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
        try {
            setDownloading(true);
            const doc = new jsPDF();

            // Brand Header
            doc.setFontSize(22);
            doc.setTextColor(15, 23, 42); // slate-900
            doc.setFont(undefined, 'bold');
            doc.text("SAMWEGA WORKS LTD", 14, 20);

            // Report Title & Meta
            doc.setFontSize(14);
            doc.setTextColor(71, 85, 105); // slate-600
            doc.setFont(undefined, 'normal');
            doc.text("Expense Report", 14, 30);

            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
            doc.text(`Reporting Period: ${startDate} to ${endDate}`, 14, 43);

            // Table setup
            const tableColumn = ["Date", "Description", "Category", "Amount (KES)"];
            const tableRows = expenses.map(expense => [
                new Date(expense.expenseDate?._seconds * 1000 || expense.expenseDate).toLocaleDateString(),
                (expense.description || expense.reason || 'N/A').toUpperCase(),
                (expense.category || 'Uncategorized').toUpperCase(),
                parseFloat(expense.amount || 0).toLocaleString()
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 55,
                theme: 'striped',
                styles: {
                    fontSize: 8,
                    cellPadding: 4,
                    valign: 'middle',
                },
                headStyles: {
                    fillColor: [15, 23, 42], // slate-900
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'left'
                },
                columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 40 },
                    3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252] // slate-50
                }
            });

            // Summary section
            if (summary) {
                const finalY = doc.lastAutoTable.finalY + 15;

                // Totals box
                doc.setDrawColor(226, 232, 240);
                doc.setFillColor(248, 250, 252);
                doc.rect(14, finalY, 182, 35, 'FD');

                doc.setFontSize(10);
                doc.setTextColor(15, 23, 42);
                doc.setFont(undefined, 'bold');
                doc.text("EXPENDITURE SUMMARY", 20, finalY + 10);

                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(71, 85, 105);
                doc.text(`Total Operational Expenses:`, 20, finalY + 18);
                doc.text(`Approved Expenditure:`, 20, finalY + 24);
                doc.text(`Pending Approvals:`, 20, finalY + 30);

                doc.setFont(undefined, 'bold');
                doc.setTextColor(15, 23, 42);
                doc.text(`KES ${summary.totalExpenses?.toLocaleString() || 0}`, 100, finalY + 18);
                doc.setTextColor(5, 150, 105); // emerald-600
                doc.text(`KES ${summary.approvedExpenses?.toLocaleString() || 0}`, 100, finalY + 24);
                doc.setTextColor(217, 119, 6); // amber-600
                doc.text(`KES ${summary.pendingExpenses?.toLocaleString() || 0}`, 100, finalY + 30);
            }

            doc.save(`expense-report-${startDate}-${endDate}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("Failed to download PDF");
        } finally {
            setDownloading(false);
        }
    };

    const filters = (
        <div className="flex flex-wrap gap-4 w-full md:w-auto items-end">
            <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Start Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 h-[40px] transition-all"
                    />
                </div>
            </div>
            <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">End Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 h-[40px] transition-all"
                    />
                </div>
            </div>
            <button
                onClick={fetchData}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors h-[40px]"
            >
                Apply
            </button>
        </div>
    );

    const actions = (
        <button
            onClick={downloadPDF}
            disabled={downloading || loading || expenses.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm font-medium h-[40px]"
        >
            <Download size={16} />
            {downloading ? "Generating..." : "Download PDF"}
        </button>
    );

    const kpiCards = summary ? (
        <>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Expenses</p>
                <h3 className="text-2xl font-bold text-slate-900">
                    KES {summary.totalExpenses?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 border-l-4 border-l-emerald-500">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Approved</p>
                <h3 className="text-2xl font-bold text-emerald-600">
                    KES {summary.approvedExpenses?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 border-l-4 border-l-amber-500">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pending</p>
                <h3 className="text-2xl font-bold text-amber-600">
                    KES {summary.pendingExpenses?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 border-l-4 border-l-rose-500">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rejected</p>
                <h3 className="text-2xl font-bold text-rose-600">
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
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
                                <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount (KES)</th>
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
                                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                                            {new Date(expense.expenseDate?._seconds * 1000 || expense.expenseDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-semibold text-slate-800 max-w-xs truncate">
                                            {expense.description || expense.reason || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                                {expense.category || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-bold">
                                            {parseFloat(expense.amount || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>

                        {/* Categorical Summary Footer */}
                        {byCategory.length > 0 && (
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                                <tr>
                                    <td colSpan="4" className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                                        Summary by Category
                                    </td>
                                </tr>
                                {byCategory.map((cat, idx) => (
                                    <tr key={idx} className="bg-slate-50 font-medium text-slate-700">
                                        <td colSpan="1" className="px-6 py-2 text-xs font-semibold text-slate-600 pl-10 uppercase tracking-tight">
                                            {cat.category}
                                        </td>
                                        <td colSpan="2" className="px-6 py-2 text-[10px] text-slate-400 text-right uppercase font-bold tracking-tight">
                                            {cat.count} Trans.
                                        </td>
                                        <td className="px-6 py-2 text-sm font-bold text-slate-900 text-right">
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
