"use client";

import { useState, useEffect } from "react";
import { Search, Download, RefreshCw, Filter, Warehouse } from "lucide-react";
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
            const response = await api.getWarehouses();
            if (response.success) {
                const data = response.data.warehouses || response.data;
                setWarehouses(Array.isArray(data) ? data : []);
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
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg">
            <Warehouse size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-600">Total Items:</span>
            <span className="text-sm font-bold text-slate-900">{items.length}</span>
        </div>
    );

    const filters = (
        <div className="flex flex-wrap gap-4 w-full">
            <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    type="text"
                    placeholder="Search by product or supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 outline-none text-sm text-slate-700 transition-all placeholder:text-slate-400"
                />
            </div>

            <div className="w-full md:w-64">
                <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400 bg-white text-sm text-slate-700 outline-none transition-all"
                >
                    <option value="">All Locations</option>
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
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Product Description</th>
                                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Level</th>
                                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Location</th>
                                <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit Cost</th>
                                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Source</th>
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
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                        <td className="px-6 py-3.5 text-sm font-semibold text-slate-800">{item.productName}</td>
                                        <td className="px-6 py-3.5">
                                            <span className={`text-xs font-bold ${item.stock <= (item.lowStockAlert || 5)
                                                ? 'text-rose-600'
                                                : 'text-slate-600'
                                                }`}>
                                                {item.stock} <span className="text-[10px] text-slate-400 font-normal uppercase">{item.unit || 'PCS'}</span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            {item.warehouseName || item.location ? (
                                                <span className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                                                    <Warehouse size={12} className="text-slate-400" />
                                                    {item.warehouseName || item.location}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 text-right text-sm font-bold text-slate-900">
                                            <span className="text-[10px] text-slate-400 font-normal mr-1">KES</span>
                                            {parseFloat(item.buyingPricePerUnit || item.buyingPrice || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3.5 text-xs text-slate-500">{item.supplier || '-'}</td>
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
