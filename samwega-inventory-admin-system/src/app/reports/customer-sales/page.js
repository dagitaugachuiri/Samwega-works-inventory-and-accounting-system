"use client"
import { useState, useEffect } from "react";
import { FileText, Download, Calendar, Search, ArrowLeft, Printer } from "lucide-react";
import api from "../../../lib/api";
import Link from "next/link";

export default function CustomerSalesPage() {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);

    // Customer Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        // Set default dates
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2) {
                performSearch();
            } else {
                setSearchResults([]);
                setShowResults(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const performSearch = async () => {
        try {
            const res = await api.searchCustomers(searchQuery);
            if (res.success || res.customers || res.data) {
                const results = res.data?.customers || res.customers || [];
                setSearchResults(Array.isArray(results) ? results : []);
                if (results.length > 0) setShowResults(true);
            }
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    const fetchReport = async () => {
        if (!customerPhone) {
            alert("Please select a customer first");
            return;
        }

        setLoading(true);
        try {
            const res = await api.getCustomerSalesReport(customerPhone, startDate, endDate);
            if (res.success || res.data) {
                setReportData(res.data || res);
            } else {
                alert("Failed to fetch report data");
            }
        } catch (error) {
            console.error("Error fetching report:", error);
            alert("Error fetching report: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        setLoading(true);
        try {
            const res = await api.generateCustomerSalesPDF(customerPhone, startDate, endDate);
            if (res.success && res.data?.pdfUrl) {
                const link = document.createElement('a');
                link.href = res.data.pdfUrl;
                link.download = res.data.reportName || `customer-sales-${customerPhone}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (e) {
            alert("Failed to download PDF");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/reports" className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mb-2">
                        <ArrowLeft size={16} className="mr-1" /> Back to Reports
                    </Link>
                    <h1 className="text-2xl font-semibold text-slate-900">Customer Sales Report</h1>
                    <p className="text-sm text-slate-500 mt-1">View and download customer purchase history</p>
                </div>
                {reportData && (
                    <button
                        onClick={downloadPDF}
                        disabled={loading}
                        className="btn-primary flex items-center gap-2"
                    >
                        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Download size={16} />}
                        Download PDF
                    </button>
                )}
            </div>

            {/* Filter Section */}
            <div className="glass-panel p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* Customer Search */}
                    <div className="relative md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Search Customer
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    if (e.target.value !== customerPhone) {
                                        setCustomerPhone("");
                                    }
                                }}
                                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                                placeholder="Search by name or phone..."
                                className="input-field w-full pl-9"
                            />
                        </div>

                        {showResults && searchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {searchResults.map((c) => {
                                    const displayName = c.customerName || c.name || "Unknown";
                                    const displayPhone = c.customerPhone || c.phoneNumber || c.phone || "";

                                    return (
                                        <button
                                            key={c.id}
                                            className="w-full text-left p-3 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0 transition-colors block bg-white"
                                            onMouseDown={() => {
                                                setCustomerPhone(displayPhone);
                                                setSearchQuery(`${displayName} (${displayPhone})`);
                                                setShowResults(false);
                                            }}
                                        >
                                            <div className="font-medium text-slate-900">{displayName}</div>
                                            <div className="text-xs text-slate-500">{displayPhone}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {customerPhone && (
                            <div className="mt-2 text-xs text-emerald-600 font-medium">
                                Selected: {customerPhone}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            <Calendar className="inline mr-1" size={14} /> Start Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="input-field w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            <Calendar className="inline mr-1" size={14} /> End Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="input-field w-full"
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        onClick={fetchReport}
                        disabled={loading || !customerPhone}
                        className="btn-primary"
                    >
                        {loading ? 'Loading...' : 'View Report'}
                    </button>
                </div>
            </div>

            {/* Report Preview */}
            {reportData ? (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <h2 className="text-lg font-bold text-slate-800">Report Preview</h2>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 gap-2">
                            <p className="text-sm text-slate-600">
                                For: <span className="font-semibold text-slate-900">{reportData.customer?.name || "Unknown"}</span> ({reportData.customer?.phone})
                            </p>
                            <p className="text-sm text-slate-500">
                                Period: {startDate} to {endDate}
                            </p>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-white border-b border-slate-100">
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <p className="text-xs text-slate-500 uppercase font-semibold">Total Purchases</p>
                            <p className="text-xl font-bold text-slate-900 mt-1">KES {reportData.summary?.totalPurchases?.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <p className="text-xs text-slate-500 uppercase font-semibold">Total Transactions</p>
                            <p className="text-xl font-bold text-slate-900 mt-1">{reportData.summary?.totalTransactions}</p>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-lg">
                            <p className="text-xs text-amber-600 uppercase font-semibold">Total Credit</p>
                            <p className="text-xl font-bold text-amber-700 mt-1">KES {reportData.summary?.totalCredit?.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg">
                            <p className="text-xs text-red-600 uppercase font-semibold">Outstanding</p>
                            <p className="text-xl font-bold text-red-700 mt-1">KES {reportData.summary?.outstandingCredit?.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Detailed Transactions Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Receipt #</th>
                                    <th className="px-6 py-3">Items</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                    <th className="px-6 py-3 text-center">Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportData.transactions?.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                                            No transactions found for this period.
                                        </td>
                                    </tr>
                                ) : (
                                    reportData.transactions?.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium whitespace-nowrap">
                                                {new Date(sale.saleDate?._seconds * 1000 || sale.saleDate).toLocaleDateString()}
                                                <div className="text-xs text-slate-400">
                                                    {new Date(sale.saleDate?._seconds * 1000 || sale.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-500">
                                                {sale.receiptNumber}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {sale.items?.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-xs border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                                                            <span>{item.quantity}x {item.productName}</span>
                                                            <span className="text-slate-400">@{item.unitPrice?.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-800">
                                                KES {sale.grandTotal?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                                                    ${sale.paymentMethod === 'credit' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}
                                                `}>
                                                    {sale.paymentMethod}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-slate-400 glass-panel">
                    <FileText size={48} className="mx-auto mb-3 opacity-30" />
                    <p>Select a customer and date range to view report</p>
                </div>
            )}
        </div>
    );
}
