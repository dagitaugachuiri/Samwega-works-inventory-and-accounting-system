"use client"
import { useState, useEffect } from "react";
import { FileText, Download, Calendar, Filter } from "lucide-react";
import api from "../../lib/api";

const REPORT_TYPES = [
    {
        category: "Inventory Reports",
        reports: [
            { id: "inventory", name: "Warehouse Inventory", description: "Current stock levels and values", needsDate: false },
            { id: "vehicle-inventory", name: "Vehicle Inventory", description: "Stock in vehicles with capacity", needsVehicle: true },
            { id: "stock-movement", name: "Stock Movement", description: "All inventory transactions", needsDate: true },
            { id: "inventory-turnover", name: "Inventory Turnover", description: "Fast/medium/slow moving items", needsDate: true },
        ]
    },
    {
        category: "Sales Reports",
        reports: [
            { id: "sales", name: "Sales Report", description: "Comprehensive sales analysis", needsDate: true },
            { id: "trip-sales", name: "Trip Sales", description: "Daily trip summary", needsVehicle: true, needsTripDate: true },
            { id: "vehicle-trip-history", name: "Vehicle Trip History", description: "Historical trip performance", needsVehicle: true, needsDate: true },
            { id: "customer-sales", name: "Customer Sales", description: "Customer purchase history", needsCustomer: true, needsDate: true },
        ]
    },
    {
        category: "Financial Reports",
        reports: [
            { id: "profit-loss", name: "Profit & Loss", description: "Revenue, expenses, and net profit", needsDate: true },
            { id: "expense", name: "Expenses Report", description: "All expenses by category", needsDate: true },
            { id: "credit-sales", name: "Credit Sales & Debts", description: "Outstanding debts with aging", needsDate: true },
        ]
    },
    {
        category: "Performance Reports",
        reports: [
            { id: "supplier-performance", name: "Supplier Performance", description: "Supplier analysis and ranking", needsDate: true },
        ]
    }
];

export default function ReportsPage() {
    const [selectedReport, setSelectedReport] = useState(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [vehicleId, setVehicleId] = useState("");
    const [tripDate, setTripDate] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatedPDF, setGeneratedPDF] = useState(null);

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
                case "inventory-turnover":
                    response = await api.generateInventoryTurnoverPDF(startDate, endDate);
                    break;
                case "sales":
                    response = await api.generateSalesPDF(startDate, endDate);
                    break;
                case "trip-sales":
                    response = await api.generateTripSalesPDF(vehicleId, tripDate);
                    break;
                case "vehicle-trip-history":
                    response = await api.generateVehicleTripHistoryPDF(vehicleId, startDate, endDate);
                    break;
                case "customer-sales":
                    response = await api.generateCustomerSalesPDF(customerPhone, startDate, endDate);
                    break;
                case "profit-loss":
                    response = await api.generateProfitLossPDF(startDate, endDate);
                    break;
                case "expense":
                    response = await api.generateExpensePDF(startDate, endDate);
                    break;
                case "credit-sales":
                    response = await api.generateCreditSalesPDF(startDate, endDate);
                    break;
                case "supplier-performance":
                    response = await api.generateSupplierPerformancePDF(startDate, endDate);
                    break;
                default:
                    throw new Error("Unknown report type");
            }

            if (response.success && response.data?.pdfUrl) {
                setGeneratedPDF(response.data);
            }
        } catch (error) {
            console.error("Failed to generate report:", error);
            alert("Failed to generate report: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
                    <p className="text-sm text-slate-500 mt-1">Generate comprehensive business reports</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Report Selection */}
                <div className="lg:col-span-2 space-y-6">
                    {REPORT_TYPES.map((category) => (
                        <div key={category.category} className="glass-panel p-5">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">{category.category}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {category.reports.map((report) => (
                                    <button
                                        key={report.id}
                                        onClick={() => setSelectedReport(report)}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${selectedReport?.id === report.id
                                            ? "border-sky-500 bg-sky-50"
                                            : "border-slate-200 hover:border-sky-300 bg-white"
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <FileText className={`mt-0.5 ${selectedReport?.id === report.id ? "text-sky-600" : "text-slate-400"}`} size={20} />
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-slate-900 text-sm">{report.name}</h3>
                                                <p className="text-xs text-slate-500 mt-1">{report.description}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Report Configuration */}
                <div className="glass-panel p-5 h-fit sticky top-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Generate Report</h2>

                    {selectedReport ? (
                        <div className="space-y-4">
                            <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                                <p className="text-sm font-semibold text-sky-900">{selectedReport.name}</p>
                                <p className="text-xs text-sky-700 mt-1">{selectedReport.description}</p>
                            </div>

                            {selectedReport.id === 'inventory' ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
                                        This report is now available on a dedicated page with an interactive preview and warehouse details.
                                    </div>
                                    <a
                                        href="/reports/inventory"
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                    >
                                        <FileText size={16} />
                                        View Full Report
                                    </a>
                                </div>
                            ) : (
                                <>
                                    {selectedReport.needsDate && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                    <Calendar className="inline mr-1" size={14} />
                                                    Start Date
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
                                                    <Calendar className="inline mr-1" size={14} />
                                                    End Date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="input-field w-full"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {selectedReport.needsTripDate && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                <Calendar className="inline mr-1" size={14} />
                                                Trip Date
                                            </label>
                                            <input
                                                type="date"
                                                value={tripDate}
                                                onChange={(e) => setTripDate(e.target.value)}
                                                className="input-field w-full"
                                            />
                                        </div>
                                    )}

                                    {selectedReport.needsVehicle && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Vehicle
                                            </label>
                                            <select
                                                value={vehicleId}
                                                onChange={(e) => setVehicleId(e.target.value)}
                                                className="input-field w-full"
                                            >
                                                <option value="">Select vehicle</option>
                                                {vehicles.map((vehicle) => (
                                                    <option key={vehicle.id} value={vehicle.id}>
                                                        {vehicle.vehicleName} - {vehicle.registrationNumber}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {selectedReport.needsCustomer && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Customer Phone
                                            </label>
                                            <input
                                                type="tel"
                                                value={customerPhone}
                                                onChange={(e) => setCustomerPhone(e.target.value)}
                                                placeholder="+254XXXXXXXXX"
                                                className="input-field w-full"
                                            />
                                        </div>
                                    )}

                                    <button
                                        onClick={generateReport}
                                        disabled={loading}
                                        className="btn-primary w-full"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="mr-2" size={16} />
                                                Generate PDF
                                            </>
                                        )}
                                    </button>
                                </>
                            )}

                            {generatedPDF && (
                                <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <p className="text-sm font-semibold text-emerald-900 mb-2">Report Generated!</p>
                                    <a
                                        href={generatedPDF.pdfUrl}
                                        download={generatedPDF.reportName || "report.pdf"}
                                        className="btn-ghost w-full text-sm inline-flex items-center justify-center"
                                    >
                                        <Download className="mr-2" size={14} />
                                        Download PDF
                                    </a>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <FileText size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Select a report type to begin</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
