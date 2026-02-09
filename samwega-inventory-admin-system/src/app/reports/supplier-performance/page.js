"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Calendar } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SupplierPerformancePage() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        // Set default dates (last 30 days)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if (startDate && endDate) {
            fetchReport();
        }
    }, [startDate, endDate]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const filters = {
                startDate,
                endDate
            };
            const res = await api.getSupplierPerformanceReport(filters);

            if (res.success || Array.isArray(res.data) || Array.isArray(res)) {
                let data = res.data || res;
                // Ensure data is array
                if (!Array.isArray(data) && data.suppliers) {
                    data = data.suppliers;
                }
                setReportData(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to fetch supplier performance report:", error);
            setReportData([]);
        } finally {
            setLoading(false);
        }
    };

    const filters = (
        <div className="flex flex-wrap gap-4 w-full md:w-auto items-end">
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">End Date</label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>
            <button
                onClick={fetchReport}
                className="btn-secondary h-[38px] px-4"
            >
                Apply
            </button>
        </div>
    );

    const exportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Supplier Performance Report", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 33);

        const tableColumn = ["Supplier", "Products", "Units Purchased", "Total Value"];
        const tableRows = reportData.map(row => [
            row.supplierName || 'Unknown',
            row.totalProducts,
            row.totalPurchases,
            parseFloat(row.totalValue || 0).toLocaleString()
        ]);

        // Add Total Row
        const totalProducts = reportData.reduce((sum, r) => sum + (r.totalProducts || 0), 0);
        const totalPurchases = reportData.reduce((sum, r) => sum + (r.totalPurchases || 0), 0);
        const totalValue = reportData.reduce((sum, r) => sum + (r.totalValue || 0), 0);

        tableRows.push(["TOTALS", totalProducts, totalPurchases, parseFloat(totalValue).toLocaleString()]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            didParseCell: function (data) {
                if (data.row.index === tableRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        doc.save(`supplier-performance-${startDate}-${endDate}.pdf`);
    };

    const actions = (
        <button
            className="btn-primary flex items-center gap-2"
            onClick={exportPDF}
        >
            <Download size={18} />
            Export PDF
        </button>
    );

    return (
        <ReportLayout
            title="Supplier Performance Report"
            description="Analyze supplier reliability and purchase history."
            loading={loading}
            onRefresh={fetchReport}
            filters={filters}
            actions={actions}
        >
            <div className="min-w-full inline-block align-middle">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier Name</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Products Count</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Units Purchased</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                                        No supplier performance records found for the selected period.
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {row.supplierName || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                            {row.totalProducts}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                            {row.totalPurchases}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600 text-right">
                                            KES {parseFloat(row.totalValue || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {reportData.length > 0 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-gray-900">
                                <tr>
                                    <td className="px-6 py-4 text-right">TOTALS:</td>
                                    <td className="px-6 py-4 text-right">
                                        {reportData.reduce((sum, r) => sum + (r.totalProducts || 0), 0)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {reportData.reduce((sum, r) => sum + (r.totalPurchases || 0), 0)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-emerald-700">
                                        KES {reportData.reduce((sum, r) => sum + (r.totalValue || 0), 0).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </ReportLayout>
    );
}
