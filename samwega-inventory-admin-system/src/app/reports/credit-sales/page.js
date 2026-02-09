"use client";

import { useState, useEffect } from "react";
import { Download, Calendar, Users, Briefcase, FileText, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";

export default function CreditSalesReportPage() {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [activeTab, setActiveTab] = useState("customers");

    useEffect(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    }, []);

    const fetchData = async () => {
        if (!startDate || !endDate) return;

        try {
            setLoading(true);
            const res = await api.getCreditSalesReport(startDate, endDate);
            if (res.success) {
                setReportData(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch credit sales report:", error);
            setReportData(null);
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
            const res = await api.generateCreditSalesPDF(startDate, endDate);
            if (res.success && res.data?.pdfUrl) {
                const link = document.createElement('a');
                link.href = res.data.pdfUrl;
                link.download = res.data.reportName || `credit-sales-${startDate}-${endDate}.pdf`;
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

    const kpiCards = reportData ? (
        <>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Total Credit Sales</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    KES {reportData.summary.totalCredit?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm border-l-4 border-l-red-500">
                <p className="text-sm font-medium text-slate-500">Outstanding Debt</p>
                <h3 className="text-2xl font-bold text-red-700 mt-1">
                    KES {reportData.summary.outstanding?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm border-l-4 border-l-emerald-500">
                <p className="text-sm font-medium text-slate-500">Collected</p>
                <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                    KES {reportData.summary.totalPaid?.toLocaleString() || 0}
                </h3>
            </div>
            <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-blue-500">
                <p className="text-sm font-medium text-slate-500">Total Debtors</p>
                <h3 className="text-2xl font-bold text-blue-700 mt-1">
                    {reportData.summary.totalCustomers || 0}
                </h3>
            </div>
        </>
    ) : null;

    const chartSection = reportData ? (
        <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-slate-900">Aging Analysis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <p className="text-xs text-emerald-600 font-medium uppercase">Current (0-30 Days)</p>
                    <p className="text-lg font-bold text-emerald-800 mt-1">KES {reportData.aging.current?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-xs text-amber-600 font-medium uppercase">31-60 Days</p>
                    <p className="text-lg font-bold text-amber-800 mt-1">KES {reportData.aging.days31to60?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                    <p className="text-xs text-orange-600 font-medium uppercase">61-90 Days</p>
                    <p className="text-lg font-bold text-orange-800 mt-1">KES {reportData.aging.days61to90?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-xs text-red-600 font-medium uppercase">Over 90 Days</p>
                    <p className="text-lg font-bold text-red-800 mt-1">KES {reportData.aging.over90?.toLocaleString()}</p>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <ReportLayout
            title="Credit Sales & Debts"
            description="Track outstanding payments, debtors, and debt aging."
            loading={loading}
            onRefresh={fetchData}
            filters={filters}
            actions={actions}
            kpiCards={kpiCards}
            chartSection={chartSection}
        >
            <div className="min-w-full inline-block align-middle">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4 px-6 pt-4">
                    <button
                        className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'customers'
                                ? 'border-sky-500 text-sky-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('customers')}
                    >
                        Customer Balances
                    </button>
                    <button
                        className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transactions'
                                ? 'border-sky-500 text-sky-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('transactions')}
                    >
                        Recent Credit Transactions
                    </button>
                </div>

                {activeTab === 'customers' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Credit</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData?.customers?.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                            No outstanding balances found.
                                        </td>
                                    </tr>
                                ) : (
                                    reportData?.customers?.map((customer, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {customer.customerName || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {customer.customerPhone || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {customer.totalCredit.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 text-right">
                                                {customer.totalPaid.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-bold text-right">
                                                {customer.outstanding.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (KES)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData?.transactions?.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                            No credit transactions found.
                                        </td>
                                    </tr>
                                ) : (
                                    reportData?.transactions?.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {new Date(sale.saleDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {sale.customerName || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                                {sale.items?.length || 0} items
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                                    ${sale.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                                        sale.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-800' :
                                                            'bg-red-100 text-red-800'}`}>
                                                    {sale.paymentStatus || 'unpaid'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                {sale.grandTotal.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </ReportLayout>
    );
}
