"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Search, RefreshCw } from "lucide-react";
import api from "@/lib/api";

export default function InventoryReportPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchInventory();
    }, []);

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

            // Header
            doc.setFontSize(20);
            doc.text("Inventory Report", 14, 22);
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 30);

            // Table Data
            const tableColumn = ["Item Name", "Quantity", "Warehouse", "Unit Price", "Supplier"];
            const tableRows = filteredItems.map(item => [
                item.productName,
                item.stock,
                item.warehouseName || "N/A",
                item.sellingPricePerPiece || item.sellingPrice || "0",
                item.supplier || "N/A"
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 40,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] },
            });

            doc.save(`inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            setError("Failed to generate PDF report. Please try again.");
            setTimeout(() => setError(null), 3000); // Clear error after 3s
        } finally {
            setGeneratingPdf(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.warehouseName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="text-blue-600" />
                        Inventory Report
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        comprehensive view of all inventory items and their locations.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchInventory}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={generatingPdf || loading || items.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generatingPdf ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Download size={18} />
                        )}
                        Download PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search items, warehouses, or suppliers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Preview Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-700">Item Name</th>
                                <th className="px-6 py-4 font-semibold text-gray-700">Quantity</th>
                                <th className="px-6 py-4 font-semibold text-gray-700">Warehouse</th>
                                <th className="px-6 py-4 font-semibold text-gray-700">Unit Price</th>
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
                                            {item.warehouseName ? (
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                                    {item.warehouseName}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            KES {parseFloat(item.sellingPricePerPiece || item.sellingPrice || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{item.supplier || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && filteredItems.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between">
                        <span>Showing {filteredItems.length} items</span>
                        <span>Total Items: {items.length}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
