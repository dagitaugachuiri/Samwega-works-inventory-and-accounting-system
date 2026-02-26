"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Truck, Filter } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function VehicleInventoryReportPage() {
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState("");
    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Fetch initial data (vehicles)
    useEffect(() => {
        fetchVehicles();
        // Removed auto-fetch of report on mount as vehicle selection is now mandatory
    }, []);

    // Re-fetch when filter changes
    useEffect(() => {
        if (selectedVehicle) {
            fetchReport();
        } else {
            setReportData([]);
            setSummary(null);
            setLoading(false);
        }
    }, [selectedVehicle, startDate, endDate]);

    const fetchVehicles = async () => {
        try {
            const res = await api.getVehicles();
            if (res.success) {
                setVehicles(res.data.vehicles || res.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch vehicles:", error);
        }
    };

    const fetchReport = async () => {
        if (!selectedVehicle) return;

        try {
            setLoading(true);
            const res = await api.getVehicleInventoryReport({
                vehicleId: selectedVehicle,
                startDate,
                endDate
            });

            if (res.success || res.data) {
                const data = res.data || res;
                setReportData(Array.isArray(data.data) ? data.data : []); // data.data contains rows
                setSummary(data.summary || null);
            }
        } catch (error) {
            console.error("Failed to fetch vehicle inventory report:", error);
            setReportData([]);
        } finally {
            setLoading(false);
        }
    };

    const filters = (
        <div className="flex flex-wrap gap-4 w-full md:w-auto items-end">
            <div className="w-full md:w-64">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Vehicle</label>
                <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select
                        value={selectedVehicle}
                        onChange={(e) => setSelectedVehicle(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 bg-white text-sm text-slate-700 outline-none transition-all appearance-none h-[40px]"
                    >
                        <option value="">-- Select Vehicle --</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.vehicleName} ({v.vehicleNumber})</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="w-full md:w-40">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Start Date</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 bg-white text-sm text-slate-700 outline-none h-[40px]"
                />
            </div>
            <div className="w-full md:w-40">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">End Date</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 bg-white text-sm text-slate-700 outline-none h-[40px]"
                />
            </div>
        </div>
    );

    const downloadPDF = async () => {
        try {
            setGeneratingPdf(true);
            const doc = new jsPDF();

            doc.setFontSize(18);
            doc.text("Vehicle Inventory Report", 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            doc.text(`Period: ${startDate} to ${endDate}`, 14, 33);

            if (selectedVehicle) {
                const v = vehicles.find(v => v.id === selectedVehicle);
                const vNameAndNumber = v ? `${v.vehicleName} - ${v.vehicleNumber}` : selectedVehicle;
                doc.text(`Vehicle: ${vNameAndNumber}`, 14, 38);
            }

            const tableColumn = ["Item Name", "Loaded", "Sold", "Rem.", "Unit Cost"];
            const tableRows = reportData.map(row => [
                row.itemName,
                row.quantityLoaded,
                row.quantitySold,
                row.quantityRemaining,
                parseFloat(row.unitCost || 0).toLocaleString()
            ]);

            // Add Summary Row if summary exists
            // Note: Summary totals might need adjustment as we removed Value Rem column.
            // Assuming user wants visuals cleaned.
            // The summary object still has totalValueRemaining, we just don't show it in table columns if undesired.

            if (summary) {
                // Optional: Add a summary row for Totals if relevant to displayed columns
                // Since we removed 'Value Rem', maybe we don't show monetary totals in the table footer?
                // Or we just show "TOTALS" label.
            }

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: selectedVehicle ? 45 : 40,
                theme: 'plain',
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [250, 250, 250] },
                columnStyles: {
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right' }
                }
            });

            doc.save(`vehicle-inventory-${startDate}-${endDate}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
        } finally {
            setGeneratingPdf(false);
        }
    };

    const actions = (
        <button
            onClick={downloadPDF}
            disabled={generatingPdf || loading || !selectedVehicle || reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm font-medium"
        >
            {generatingPdf ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <Download size={16} />
            )}
            Download PDF
        </button>
    );

    return (
        <ReportLayout
            title="Vehicle Inventory Report"
            description="View stock levels and sales performance per vehicle for a specific period."
            loading={loading}
            onRefresh={fetchReport}
            filters={filters}
            actions={actions}
        >
            <div className="min-w-full inline-block align-middle">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Item Name</th>
                                <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Loaded</th>
                                <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sold</th>
                                <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Remaining</th>
                                <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit Cost</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {!selectedVehicle ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <Truck size={40} className="mb-2 opacity-20" />
                                            <p className="text-sm font-medium">Please select a vehicle to view its inventory report</p>
                                            <p className="text-xs">Use the filters above to get started</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        No vehicle inventory records found for the selected period.
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-semibold text-slate-800">{row.itemName}</div>
                                            <div className="text-[10px] text-slate-400 font-medium uppercase">{row.itemCategory}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">
                                            {row.quantityLoaded}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">
                                            {row.quantitySold}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 text-right">
                                            {row.quantityRemaining}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-medium">
                                            <span className="text-[10px] text-slate-400 mr-1">KES</span>
                                            {parseFloat(row.unitCost || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>

                        {/* Footer Summary - Simplified since we removed Value column */}
                        {summary && reportData.length > 0 && (
                            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                                <tr>
                                    <td className="px-6 py-4 text-right text-[11px] text-slate-500 uppercase tracking-wider">Totals:</td>
                                    <td className="px-6 py-4 text-right text-xs">
                                        <div className="text-slate-400 text-[9px] font-normal">VALUE</div>
                                        KES {parseFloat(summary.totalValueLoadedStock || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-xs">
                                        <div className="text-slate-400 text-[9px] font-normal">VALUE</div>
                                        KES {parseFloat(summary.totalValueSold || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right"></td>
                                    <td className="px-6 py-4 text-right"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </ReportLayout>
    );
}
