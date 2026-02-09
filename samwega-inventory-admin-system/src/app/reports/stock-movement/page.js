"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Truck, Calendar } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function StockMovementPage() {  // Renamed to match route/function
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedVehicle, setSelectedVehicle] = useState("");
    const [vehicles, setVehicles] = useState([]);

    useEffect(() => {
        fetchVehicles();
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
    }, [startDate, endDate, selectedVehicle]);

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
            const filters = {
                startDate,
                endDate,
                vehicleId: selectedVehicle
            };
            const res = await api.getStockMovementReport(filters);

            if (res.success || Array.isArray(res.data) || Array.isArray(res)) {
                const data = res.data || res;
                // Ensure data is array
                setReportData(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to fetch stock movement report:", error);
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
            <div className="w-full md:w-56">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Vehicle</label>
                <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                        value={selectedVehicle}
                        onChange={(e) => setSelectedVehicle(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                    >
                        <option value="">All Vehicles</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.vehicleName} ({v.vehicleNumber})</option>
                        ))}
                    </select>
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
        doc.text("Stock Movement Report", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 33);
        if (selectedVehicle) {
            const v = vehicles.find(v => v.id === selectedVehicle);
            const vName = v ? `${v.vehicleName} (${v.vehicleNumber})` : selectedVehicle;
            doc.text(`Vehicle: ${vName}`, 14, 38);
        }

        const tableColumn = ["Date", "Ref", "Item", "Quantity", "Vehicle", "Status"];
        const tableRows = reportData.map(row => {
            const vehicle = vehicles.find(v => v.id === row.vehicleId);
            const vehicleDisplay = vehicle ? vehicle.vehicleNumber : row.vehicleId;

            return [
                new Date(row.date._seconds * 1000 || row.date).toLocaleDateString(),
                row.transferNumber,
                row.productName,
                row.quantity,
                vehicleDisplay,
                row.status
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] }
        });

        doc.save(`stock-movement-${startDate}-${endDate}.pdf`);
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
            title="Stock Movement Report"
            description="Track inventory issued from warehouse to vehicles."
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
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Issued</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                        No stock movements found for the selected period.
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {new Date(row.date._seconds * 1000 || row.date).toLocaleDateString()}
                                            <span className="block text-xs text-gray-400">
                                                {new Date(row.date._seconds * 1000 || row.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                            {row.transferNumber}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                            {row.productName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                                            {row.quantity}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {(() => {
                                                const vehicle = vehicles.find(v => v.id === row.vehicleId);
                                                return vehicle ? vehicle.vehicleNumber : row.vehicleId;
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${row.status === 'collected' ? 'bg-green-100 text-green-800' :
                                                    row.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-yellow-100 text-yellow-800'}`}>
                                                {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Unknown'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </ReportLayout>
    );
}
