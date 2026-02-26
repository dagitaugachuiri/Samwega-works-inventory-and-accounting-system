"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Calendar, ArrowRight, User, CreditCard } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SalesReportPage() {
    const [sales, setSales] = useState([]);
    const [summary, setSummary] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState("");

    useEffect(() => {
        // Set default dates (current month)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);

        // Fetch Vehicles
        api.getVehicles().then(res => {
            if (res.success || Array.isArray(res.data) || Array.isArray(res)) {
                let vData = Array.isArray(res) ? res : (res.data || []);
                if (!Array.isArray(vData)) vData = [];
                setVehicles(vData);
            }
        }).catch(err => console.error(err));
    }, []);



    const fetchData = async () => {
        try {
            setLoading(true);

            // Prepare filters
            const filters = {
                startDate,
                endDate: `${endDate}T23:59:59`, // Ensure full day is included
                groupBy: '' // Explicitly disable grouping to get flat list
            };
            if (selectedVehicle) {
                filters.vehicleId = selectedVehicle;
            }

            // Parallel fetch for Sales Data and BI Data (Top Products)
            // Note: getProductPerformance doesn't support vehicle filtering yet, so we skip it or ignore it if filtering by vehicle
            const [salesRes, productsRes] = await Promise.all([
                api.getSalesReport(filters),
                !selectedVehicle ? api.getProductPerformance(startDate, `${endDate}T23:59:59`, 5) : Promise.resolve({ topProducts: [] })
            ]);

            if (salesRes.success || salesRes.sales) {
                // Handle different response structures if needed
                const data = salesRes.data || salesRes;
                setSales(Array.isArray(data.sales) ? data.sales : []);
                setSummary(data.summary || null);
            }

            if (productsRes.success || productsRes.topProducts) {
                const pData = productsRes.data || productsRes;
                setTopProducts(Array.isArray(pData.topProducts) ? pData.topProducts : []);
            }

        } catch (error) {
            console.error("Failed to fetch sales report:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate, selectedVehicle]);

    // Filters Component
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
            <div className="w-full md:w-48">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Vehicle</label>
                <select
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 bg-white h-[40px] transition-all"
                >
                    <option value="">All Vehicles</option>
                    {Array.isArray(vehicles) && vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.vehicleName}</option>
                    ))}
                </select>
            </div>
            <button
                onClick={fetchData}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors h-[40px]"
            >
                Apply
            </button>
        </div>
    );

    // Actions Component
    // Actions Component
    const downloadPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Comprehensive Sales Report", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 33);

        // Summary Box
        if (summary) {
            doc.setDrawColor(200);
            doc.setFillColor(245, 245, 245);
            doc.rect(14, 38, 180, 20, 'FD');
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text(`Total Revenue: KES ${summary.totalSales?.toLocaleString()}`, 20, 50);
            doc.setFontSize(10);
            doc.text(`Transactions: ${summary.totalTransactions} | Avg Sale: ${Math.round(summary.averageSaleValue || 0).toLocaleString()}`, 20, 56);
        }

        if (selectedVehicle) {
            const v = vehicles.find(v => v.id === selectedVehicle);
            const vName = v ? v.vehicleName : selectedVehicle;
            doc.text(`Vehicle Filter: ${vName}`, 14, 62);
        }

        let finalY = selectedVehicle ? 68 : 65;

        // Top Products Section
        if (topProducts.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(0, 100, 0);
            doc.text("Top High-Velocity Products", 14, finalY);

            const productRows = topProducts.map((p, i) => [
                i + 1,
                p.productName,
                p.totalQuantitySold,
                p.totalRevenue?.toLocaleString()
            ]);

            autoTable(doc, {
                head: [['Rank', 'Product', 'Qty Sold', 'Revenue']],
                body: productRows,
                startY: finalY + 5,
                theme: 'plain',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [220, 255, 220], textColor: [0, 50, 0], fontStyle: 'bold' },
                columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } }
            });

            finalY = doc.lastAutoTable.finalY + 15;
        }

        // Detailed Transactions Table
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("Detailed Transactions", 14, finalY);

        const tableColumn = ["Date/Receipt", "Customer", "Item", "Qty", "Price", "Total"];
        const tableRows = [];

        sales.forEach(sale => {
            const dateStr = new Date(sale.saleDate?._seconds * 1000 || sale.saleDate).toLocaleDateString();
            const timeStr = new Date(sale.saleDate?._seconds * 1000 || sale.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const receipt = sale.receiptNumber || (sale.id ? sale.id.substring(0, 8).toUpperCase() : 'N/A');
            const customer = sale.customerName || 'Walk-in';
            const payment = sale.paymentMethod;

            // Header Row for Sale
            tableRows.push([
                { content: `${dateStr} ${timeStr}\n#${receipt}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: `${customer} (${payment})`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
            ]);

            // Item Rows
            if (sale.items && sale.items.length > 0) {
                sale.items.forEach(item => {
                    const price = parseFloat(item.unitPrice || item.sellingPrice || 0);
                    const total = parseFloat(item.totalPrice || 0);

                    // Infer price if missing but total exists
                    const inferredPrice = price || (item.quantity ? total / item.quantity : 0);

                    tableRows.push([
                        "",
                        "",
                        item.productName,
                        item.quantity,
                        inferredPrice.toLocaleString(),
                        total.toLocaleString()
                    ]);
                });
            } else {
                tableRows.push(["", "", "No item details", "-", "-", parseFloat(sale.grandTotal).toLocaleString()]);
            }

            // Footer Row for Sale
            tableRows.push([
                { content: "", colSpan: 5, styles: { cellPadding: 1 } },
                { content: parseFloat(sale.grandTotal).toLocaleString(), styles: { fontStyle: 'bold', fillColor: [250, 250, 250] } }
            ]);
        });

        // Add spacer rows aren't natively supported easily, but the header row acts as separator

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: finalY + 5,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 40 },
                3: { halign: 'center' },
                4: { halign: 'right' },
                5: { halign: 'right' }
            }
        });

        doc.save(`detailed-sales-report-${startDate}-${endDate}.pdf`);
    };

    const actions = (
        <button
            onClick={downloadPDF}
            disabled={loading || sales.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm font-medium"
        >
            <Download size={16} />
            Download PDF
        </button>
    );

    // BI Section: Top Selling Items (Visualized as a mini-table/bar layout)
    // BI Section removed as per user request to hide metric cards in preview
    const biSection = null;

    return (
        <ReportLayout
            title="Sales Performance Report"
            description="Detailed breakdown of sales transactions by vehicle, revenue, and product performance."
            loading={loading}
            onRefresh={fetchData}
            filters={filters}
            actions={actions}
            chartSection={biSection} // Using chartSection for BI visualization
        >
            {/* Main Data Table */}
            <div className="min-w-full inline-block align-middle">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date/Time</th>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Receipt #</th>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer / Route</th>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payment</th>
                                <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount (KES)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sales.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        No sales records found for this period.
                                    </td>
                                </tr>
                            ) : (
                                sales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="text-slate-900 font-medium">
                                                {new Date(sale.saleDate?._seconds * 1000 || sale.saleDate).toLocaleDateString()}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium uppercase">
                                                {new Date(sale.saleDate?._seconds * 1000 || sale.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                                            {sale.receiptNumber || (sale.id ? sale.id.slice(0, 8) : 'N/A')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800">{sale.customerName || 'Walk-in Customer'}</span>
                                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{sale.vehicleName || sale.salesRepName || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                                                ${sale.paymentMethod === 'cash' ? 'bg-slate-100 text-slate-700' :
                                                    sale.paymentMethod === 'mpesa' ? 'bg-indigo-50 text-indigo-700' :
                                                        sale.paymentMethod === 'credit' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-400'}`}>
                                                {sale.paymentMethod === 'mpesa' ? 'M-Pesa' : sale.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-bold">
                                            {parseFloat(sale.grandTotal || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>

                        {/* Table Footer Summary */}
                        {sales.length > 0 && summary && (
                            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                                <tr>
                                    <td colSpan="4" className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">
                                        Total Sales Revenue:
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                                        KES {summary.totalSales?.toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan="4" className="px-6 py-2 text-[10px] text-slate-400 text-right font-medium uppercase tracking-tight">
                                        Transactions: {summary.totalTransactions} | Avg. Sale: KES {Math.round(summary.averageSaleValue || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-2"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </ReportLayout>
    );
}
