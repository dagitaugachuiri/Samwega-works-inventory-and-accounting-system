"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Search, RefreshCw, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";
import KPICard from "@/components/reports/KPICard";

export default function InventoryReportPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [error, setError] = useState(null);

    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState("");

    useEffect(() => {
        fetchInventory();
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        try {
            const response = await api.getStoreLocations();
            if (response.success) {
                setWarehouses(response.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch warehouses:", error);
        }
    };

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const response = await api.getInventory({ limit: 1000 }); // Fetch all for report
            if (response.success) {
                const data = response.data.items || response.data;
                setItems(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to fetch inventory:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            setGeneratingPdf(true);

            // Dynamic import to avoid SSR issues
            const jsPDF = (await import("jspdf")).default;
            const autoTable = (await import("jspdf-autotable")).default;

            const doc = new jsPDF();

            // Header - Minimal Design
            doc.setFontSize(18);
            doc.text("Warehouse Inventory", 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 28);
            if (selectedWarehouse) {
                const whName = warehouses.find(w => w.id === selectedWarehouse)?.name;
                doc.text(`Warehouse: ${whName}`, 14, 34);
            }

            // Draw a subtle line under header
            doc.setDrawColor(230, 230, 230);
            doc.line(14, 38, 196, 38);

            // Table Data
            const tableColumn = ["Item Name", "Quantity", "Warehouse", "Buying Price", "Supplier"];
            const tableRows = filteredItems.map(item => [
                item.productName,
                `${item.stock} ${item.unit || ''}`,
                item.warehouseName || item.location || "N/A",
                parseFloat(item.buyingPricePerUnit || item.buyingPrice || 0).toLocaleString(),
                item.supplier || "-"
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 42,
                theme: 'plain', // Minimal theme
                styles: {
                    fontSize: 9,
                    cellPadding: 3,
                    textColor: 40,
                    lineColor: 230,
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [248, 250, 252], // Very light gray bg
                    textColor: 60,
                    fontStyle: 'bold',
                    lineWidth: 0 // No border for header
                },
                alternateRowStyles: {
                    fillColor: 255 // White background only (no stripes for minimal)
                },
                columnStyles: {
                    0: { cellWidth: 'auto', fontStyle: 'bold' },
                    1: { cellWidth: 30, halign: 'right' },
                    3: { cellWidth: 30, halign: 'right' },
                },
                didDrawPage: (data) => {
                    // Footer
                    const str = 'Page ' + doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    const pageSize = doc.internal.pageSize;
                    const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                    doc.text(str, data.settings.margin.left, pageHeight - 10);
                }
            });

            doc.save(`warehouse-inventory-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            setError("Failed to generate PDF report. Please try again.");
            setTimeout(() => setError(null), 3000); // Clear error after 3s
        } finally {
            setGeneratingPdf(false);
        }
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.warehouseName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesWarehouse = selectedWarehouse ? (item.warehouseId === selectedWarehouse || item.locationId === selectedWarehouse) : true;

        return matchesSearch && matchesWarehouse;
    });

    // Calculate KPIs
    const totalItems = items.length;
    const totalStockValue = items.reduce((acc, item) => acc + (parseFloat(item.buyingPricePerUnit || item.buyingPrice || 0) * (item.stock || 0)), 0);
    const potentialRevenue = items.reduce((acc, item) => acc + (parseFloat(item.sellingPricePerPiece || item.sellingPrice || 0) * (item.stock || 0)), 0);
    const lowStockCount = items.filter(item => (item.stock || 0) <= (item.lowStockAlert || 5)).length;

    const kpiCards = (
        <>
            <KPICard
                title="Total Stock Value"
                value={`KES ${totalStockValue.toLocaleString()}`}
                icon={BarChart3}
                color="sky"
            />
            <KPICard
                title="Potential Revenue"
                value={`KES ${potentialRevenue.toLocaleString()}`}
                icon={TrendingUp}
                color="emerald"
            />
            <KPICard
                title="Low Stock Items"
                value={lowStockCount}
                icon={AlertTriangle}
                color={lowStockCount > 0 ? "rose" : "emerald"}
            />
        </>
    );

    const filters = (
        <div className="flex flex-wrap gap-4 w-full">
            <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
            </div>

            <div className="w-full md:w-64">
                <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                    <option value="">All Warehouses</option>
                    {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );

    const actions = (
        <button
            onClick={handleDownloadPDF}
            disabled={generatingPdf || loading || items.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
            {generatingPdf ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <Download size={18} />
            )}
            Download PDF
        </button>
    );

    return (
        <ReportLayout
            title="Inventory Valuation Report"
            description="Comprehensive view of inventory assets, stock levels, and potential revenue."
            loading={loading}
            onRefresh={fetchInventory}
            filters={filters}
            actions={actions}
            kpiCards={kpiCards}
        >
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 mx-6 mt-6">
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}

            {/* Data Table */}
            <div className="min-w-full inline-block align-middle">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-700">Item Name</th>
                                <th className="px-6 py-4 font-semibold text-gray-700">Quantity</th>
                                <th className="px-6 py-4 font-semibold text-gray-700">Warehouse</th>
                                <th className="px-6 py-4 font-semibold text-gray-700">Buying Price</th>
                                <th className="px-6 py-4 font-semibold text-gray-700">Supplier</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        Loading inventory data...
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        No items found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.productName}</td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.stock <= (item.lowStockAlert || 5)
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-green-100 text-green-700'
                                                }`}>
                                                {item.stock} {item.unit || 'PCS'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {item.warehouseName || item.location ? (
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                                    {item.warehouseName || item.location}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-medium">
                                            KES {parseFloat(item.buyingPricePerUnit || item.buyingPrice || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{item.supplier || '-'}</td>
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
