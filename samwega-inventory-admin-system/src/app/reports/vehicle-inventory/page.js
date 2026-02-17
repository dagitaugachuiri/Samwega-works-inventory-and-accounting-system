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

    // Fetch initial data (vehicles)
    useEffect(() => {
        fetchVehicles();
        // Don't auto-fetch report initially until vehicle is selected? 
        // Or fetch with defaults. User said "report can only be of a specific vehicle".
        // Maybe we should wait for vehicle selection.
        // But original code fetched on mount.
        // Let's keep fetching but it will show nothing if no vehicle selected (if API requires it).
        // Actually API handles "All Vehicles" if no ID.
        // But user said "can only be of a specific vehicle". 
        // Let's rely on filter.
        fetchReport();
    }, []);

    // Re-fetch when filter changes
    useEffect(() => {
        fetchReport();
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
        try {
            setLoading(true);
            const res = await api.getVehicleInventoryReport({
                vehicleId: selectedVehicle,
                startDate,
                endDate
            });

            if (res.success || res.data) {
                // Determine structure based on API response
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle</label>
                <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        value={selectedVehicle}
                        onChange={(e) => setSelectedVehicle(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none h-[42px]"
                    >
                        <option value="">All Vehicles</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.vehicleName} ({v.vehicleNumber})</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="w-full md:w-40">
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <div className="relative">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white h-[42px]"
                    />
                </div>
            </div>
            <div className="w-full md:w-40">
                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                <div className="relative">
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white h-[42px]"
                    />
                </div>
            </div>
        </div>
    );

    const downloadPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Vehicle Inventory Report", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 33);

        if (selectedVehicle) {
            const v = vehicles.find(v => v.id === selectedVehicle);
            const vName = v ? `${v.vehicleName} (${v.vehicleNumber})` : selectedVehicle;
            doc.text(`Vehicle: ${vName}`, 14, 38);
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
    };

    const actions = (
        <button
            className="btn-primary flex items-center gap-2"
            onClick={downloadPDF}
        >
            <Download size={18} />
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
                        <thead className="bg-gray-50">
                            <tr>
                                {/* Removed Vehicle Column */}
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Loaded</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sold</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                                {/* Removed Value Rem Column */}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        No vehicle inventory records found.
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        {/* Removed Vehicle Cell */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {row.itemName}
                                            <span className="block text-xs text-gray-400">{row.itemCategory}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                            {row.quantityLoaded}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                            {row.quantitySold}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                            {row.quantityRemaining}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                                            {parseFloat(row.unitCost || 0).toLocaleString()}
                                        </td>
                                        {/* Removed Value Rem Cell */}
                                    </tr>
                                ))
                            )}
                        </tbody>

                        {/* Footer Summary - Simplified since we removed Value column */}
                        {summary && reportData.length > 0 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-gray-900">
                                <tr>
                                    <td className="px-6 py-4 text-right">TOTALS:</td>
                                    <td className="px-6 py-4 text-right text-slate-500 text-xs font-normal">
                                        (Value: {parseFloat(summary.totalValueLoadedStock || 0).toLocaleString()})
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-500 text-xs font-normal">
                                        (Value: {parseFloat(summary.totalValueSold || 0).toLocaleString()})
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
