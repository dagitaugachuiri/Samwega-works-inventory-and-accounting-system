"use client"
import { useState, useEffect } from "react";
import { FileText, Download, Calendar, Filter, Search } from "lucide-react";
import api from "../../lib/api";

const REPORT_TYPES = [
    {
        category: "Inventory Reports",
        reports: [
            { id: "inventory", name: "Warehouse Inventory", description: "Current stock levels and values", needsDate: false },
            { id: "vehicle-inventory", name: "Vehicle Inventory", description: "Stock in vehicles with capacity", needsVehicle: true },
            { id: "stock-movement", name: "Stock Movement", description: "All inventory transactions", needsDate: true },
        ]
    },
    {
        category: "Sales Reports",
        reports: [
            { id: "sales", name: "Sales Report", description: "Comprehensive sales analysis", needsDate: true },

        ]
    },
    {
        category: "Financial Reports",
        reports: [
            { id: "expense", name: "Expenses Report", description: "All expenses by category", needsDate: true },
        ]
    }
];

export default function ReportsPage() {
    const [selectedReport, setSelectedReport] = useState(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [vehicleId, setVehicleId] = useState("");
    const [tripDate, setTripDate] = useState("");
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatedPDF, setGeneratedPDF] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [customerPhone, setCustomerPhone] = useState("");

    useEffect(() => {
        fetchVehicles();
        // Set default dates to current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
        setTripDate(now.toISOString().split('T')[0]);
    }, []);

    const fetchVehicles = async () => {
        try {
            const response = await api.getVehicles();
            // Handle nested response structure: response?.data?.vehicles or response?.vehicles
            const vehiclesList = response?.data?.vehicles || response?.vehicles || response?.data || [];
            setVehicles(Array.isArray(vehiclesList) ? vehiclesList : []);
        } catch (error) {
            console.error("Failed to fetch vehicles:", error);
            setVehicles([]);
        }
    };

    const generateReport = async () => {
        if (!selectedReport) return;

        setLoading(true);
        setGeneratedPDF(null);

        try {
            let response;

            // Standard PDF Generation for others (or if downloading from preview)
            switch (selectedReport.id) {
                case "inventory":
                    response = await api.generateInventoryPDF();
                    break;
                case "vehicle-inventory":
                    response = await api.generateVehicleInventoryPDF(vehicleId);
                    break;
                case "stock-movement":
                    response = await api.generateStockMovementPDF(startDate, endDate);
                    break;
                case "sales":
                    response = await api.generateSalesPDF(startDate, endDate, vehicleId);
                    break;
                case "trip-sales":
                    response = await api.generateTripSalesPDF(vehicleId, tripDate);
                    break;
                case "vehicle-trip-history":
                    response = await api.generateVehicleTripHistoryPDF(vehicleId, startDate, endDate);
                    break;

                case "expense":
                    response = await api.generateExpensePDF(startDate, endDate);
                    break;
                default:
                    throw new Error("Unknown report type");
            }

            if (response.success && response.data?.pdfUrl) {
                setGeneratedPDF(response.data);
                // Automatically download
                const link = document.createElement('a');
                link.href = response.data.pdfUrl;
                link.download = response.data.reportName || "report.pdf";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error("Failed to generate report:", error);
            alert("Failed to generate report: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto py-8 px-4 font-sans text-slate-800">
            <h1 className="text-2xl font-bold mb-6 text-slate-900 border-b border-slate-200 pb-4">System Reports</h1>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Report List */}
                <div className="w-full lg:w-1/3 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden h-fit">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-medium text-slate-700 text-sm uppercase tracking-wide">
                        Available Reports
                    </div>
                    <div className="divide-y divide-slate-100">
                        {REPORT_TYPES.map((category) => (
                            <div key={category.category}>
                                {/* Category Header */}
                                <div className="bg-slate-50/50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0">
                                    {category.category}
                                </div>
                                {category.reports.map((report) => (
                                    <button
                                        key={report.id}
                                        onClick={() => setSelectedReport(report)}
                                        className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between group ${selectedReport?.id === report.id
                                            ? "bg-blue-50 text-blue-700 font-medium border-l-4 border-blue-600"
                                            : "hover:bg-slate-50 text-slate-600 border-l-4 border-transparent"
                                            }`}
                                    >
                                        <span>{report.name}</span>
                                        {selectedReport?.id === report.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Configuration Panel */}
                <div className="w-full lg:w-2/3">
                    {selectedReport ? (
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                            <div className="border-b border-slate-100 pb-4 mb-6">
                                <h2 className="text-lg font-semibold text-slate-900">{selectedReport.name}</h2>
                                <p className="text-slate-500 text-sm mt-1">{selectedReport.description}</p>
                            </div>

                            {/* Configurations */}
                            <div className="max-w-md space-y-5">

                                {selectedReport.id === 'inventory' ? (
                                    <div className="space-y-4">
                                        <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-2">
                                            Interactive warehouse inventory view available.
                                        </div>
                                        <a href="/reports/inventory" className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium text-sm transition-colors">
                                            <FileText size={16} /> Open Interactive Report
                                        </a>
                                        <div className="border-t border-slate-100 my-4 pt-4">
                                            <button onClick={generateReport} disabled={loading} className="w-full py-2.5 bg-slate-900 text-white rounded hover:bg-slate-800 font-medium text-sm transition-colors flex items-center justify-center gap-2">
                                                {loading ? 'Generating...' : <><Download size={16} /> Download PDF Summary</>}
                                            </button>
                                        </div>
                                    </div>
                                ) : selectedReport.id === 'vehicle-inventory' ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600">Select a vehicle to view its current loaded stock.</p>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase">Vehicle</label>
                                            <select
                                                value={vehicleId}
                                                onChange={(e) => setVehicleId(e.target.value)}
                                                className="w-full p-2.5 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                            >
                                                <option value="">-- Select Vehicle --</option>
                                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleName}</option>)}
                                            </select>
                                        </div>
                                        <div className="pt-2">
                                            <a href="/reports/vehicle-inventory" className="block w-full py-2.5 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium text-sm text-center">
                                                View Online
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    // Default Form for Date Range Reports
                                    <div className="space-y-5">
                                        {selectedReport.needsDate && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase">Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => setStartDate(e.target.value)}
                                                        className="w-full p-2.5 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase">End Date</label>
                                                    <input
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) => setEndDate(e.target.value)}
                                                        className="w-full p-2.5 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Dynamic Links based on type */}
                                        {selectedReport.id === 'sales' && (
                                            <div className="pt-1">
                                                <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase">Select Vehicle (Optional)</label>
                                                <select
                                                    value={vehicleId}
                                                    onChange={(e) => setVehicleId(e.target.value)}
                                                    className="w-full p-2.5 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                                >
                                                    <option value="">-- All Vehicles --</option>
                                                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleName}</option>)}
                                                </select>
                                            </div>
                                        )}



                                        <button
                                            onClick={generateReport}
                                            disabled={loading}
                                            className="w-full py-2.5 bg-slate-900 text-white rounded hover:bg-slate-800 font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-4"
                                        >
                                            {loading ? 'Processing...' : (
                                                <>
                                                    <Download size={16} />
                                                    Generate PDF Report
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                            </div>

                            {/* Generated PDF feedback */}
                            {generatedPDF && (
                                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded text-green-800 text-sm flex items-center justify-between">
                                    <span>Report generated successfully.</span>
                                    <a href={generatedPDF.pdfUrl} download={generatedPDF.reportName || "report.pdf"} className="font-semibold underline hover:text-green-900">Download Again</a>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg p-12 bg-slate-50/50">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="font-medium">Select a report from the list to configure</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
