"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Truck, Calendar, ArrowUpRight, ArrowDownLeft, MoveHorizontal } from "lucide-react";
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
                <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <select
                        value={selectedVehicle}
                        onChange={(e) => setSelectedVehicle(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 bg-white h-[40px] transition-all appearance-none"
                    >
                        <option value="">All Vehicles</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.vehicleName}</option>
                        ))}
                    </select>
                </div>
            </div>
            <button
                onClick={fetchReport}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors h-[40px]"
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

        const tableColumn = ["Date", "Ref", "Item", "Quantity", "Origin", "Dest", "Vehicle", "Status"];
        const tableRows = reportData
            .filter(row => vehicles.some(v => v.id === row.vehicleId)) // Only WH <-> Valid Vehicle
            .map(row => {
                const vehicle = vehicles.find(v => v.id === row.vehicleId);
                const vehicleDisplay = vehicle ? vehicle.vehicleNumber : row.vehicleId;
                const isReturn = row.returnQty || row.type === 'return' || row.status?.toLowerCase() === 'returned';
                const origin = isReturn ? (vehicle ? vehicle.vehicleNumber : "Vehicle") : "Warehouse";
                const dest = isReturn ? "Warehouse" : (vehicle ? vehicle.vehicleNumber : "Vehicle");

                return [
                    new Date(row.date._seconds * 1000 || row.date).toLocaleDateString(),
                    row.transferNumber,
                    row.productName,
                    row.quantity,
                    row.origin || origin,
                    row.destination || dest,
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
            onClick={exportPDF}
            disabled={loading || reportData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm font-medium"
        >
            <Download size={16} />
            Download PDF
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
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date/Time</th>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reference</th>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Item</th>
                                <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                                <th scope="col" className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Origin/Dest</th>
                                <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vehicle</th>
                                <th scope="col" className="px-6 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.filter(row => vehicles.some(v => v.id === row.vehicleId)).length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                        No warehouse-vehicle movements found for the selected period.
                                    </td>
                                </tr>
                            ) : (
                                reportData
                                    .filter(row => vehicles.some(v => v.id === row.vehicleId))
                                    .map((row, index) => {
                                        const isReturn = row.returnQty || row.type === 'return' || row.status?.toLowerCase() === 'returned';
                                        const vehicle = vehicles.find(v => v.id === row.vehicleId);
                                        const vName = vehicle ? vehicle.vehicleNumber : row.vehicleId;

                                        // Use provided origin/dest or fallback to logic
                                        const origin = row.origin || (isReturn ? vName : "Warehouse");
                                        const dest = row.destination || (isReturn ? "Warehouse" : vName);

                                        return (
                                            <tr key={index} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                                <td className="px-6 py-3 whitespace-nowrap text-xs">
                                                    <div className="text-slate-900 font-bold">
                                                        {new Date(row.date._seconds * 1000 || row.date).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">
                                                        {new Date(row.date._seconds * 1000 || row.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-[11px] font-bold text-blue-600 uppercase">
                                                    {row.transferNumber}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-xs font-bold text-slate-800">
                                                    {row.productName}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-900 text-right font-bold">
                                                    {row.quantity}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="flex items-center gap-2 group">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${isReturn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{origin}</span>
                                                            {isReturn ? <ArrowDownLeft size={10} className="text-emerald-500" /> : <ArrowUpRight size={10} className="text-blue-500" />}
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${!isReturn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{dest}</span>
                                                        </div>
                                                        <span className={`text-[8.5px] font-bold uppercase tracking-tighter ${isReturn ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                            {isReturn ? "Return (In)" : "Issue (Out)"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-xs">
                                                    <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase">
                                                        <Truck size={12} className="text-slate-400" />
                                                        {vName}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-center">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                                                ${row.status === 'collected' ? 'bg-indigo-50 text-indigo-700' :
                                                            row.status === 'confirmed' ? 'bg-slate-100 text-slate-700' :
                                                                'bg-amber-50 text-amber-700'}`}>
                                                        {row.status || 'Pending'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </ReportLayout>
    );
}
