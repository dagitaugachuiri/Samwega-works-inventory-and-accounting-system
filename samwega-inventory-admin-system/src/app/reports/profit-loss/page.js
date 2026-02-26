"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Download, Search, TrendingUp, TrendingDown, Minus, X, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import ReportLayout from "@/components/reports/ReportLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const convertTimestamp = (ts) => {
    if (!ts) return null;
    if (ts._seconds) return new Date(ts._seconds * 1000);
    if (ts instanceof Date) return ts;
    if (typeof ts === "string") return new Date(ts);
    return null;
};

const fmt = (n) =>
    Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtInt = (n) => Number(n || 0).toLocaleString();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfitLossReportPage() {
    const [sales, setSales] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedVehicle, setSelectedVehicle] = useState("");
    const [search, setSearch] = useState("");

    // Default: current month
    useEffect(() => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(first.toISOString().split("T")[0]);
        setEndDate(now.toISOString().split("T")[0]);
    }, []);

    useEffect(() => {
        fetchVehicles();
    }, []);

    useEffect(() => {
        if (startDate && endDate) fetchData();
    }, [startDate, endDate, selectedVehicle]);

    const fetchVehicles = async () => {
        try {
            const res = await api.getVehicles();
            const list = res?.data?.vehicles || res?.vehicles || res?.data || [];
            setVehicles(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const filters = {
                startDate,
                endDate: `${endDate}T23:59:59`,
                limit: 500,
            };
            if (selectedVehicle) filters.vehicleId = selectedVehicle;

            const res = await api.getSales(filters);
            if (res.success && Array.isArray(res.data?.sales)) {
                setSales(res.data.sales);
            } else if (res.success && Array.isArray(res.data)) {
                setSales(res.data);
            } else {
                setSales([]);
            }
        } catch (e) {
            console.error(e);
            setSales([]);
        } finally {
            setLoading(false);
        }
    };

    // ── Flatten sales → item rows ─────────────────────────────────────────────
    const allRows = useMemo(() => {
        const rows = [];
        for (const sale of sales) {
            const vehicle = vehicles.find((v) => v.id === sale.vehicleId);
            const customerName = sale.customerName || sale.customer?.name || "Walk-in";
            const receiptNumber = sale.receiptNumber || `#${sale.id?.substring(0, 8)}`;
            const date = convertTimestamp(sale.saleDate);

            for (const item of sale.items || []) {
                const qty = Number(item.quantity || item.qty || 0);
                const buyingPrice = Number(item.buyingPrice || item.costPrice || item.cost || 0);
                const sellingPrice = Number(
                    item.sellingPrice || item.unitPrice || item.price || 0
                );
                const totalCost = buyingPrice * qty;
                const totalIncome = sellingPrice * qty;
                const margin = totalIncome - totalCost;

                rows.push({
                    saleId: sale.id,
                    date,
                    vehicleName: vehicle?.vehicleName || "-",
                    customerName,
                    receiptNumber,
                    productName: item.productName || item.name || "-",
                    qty,
                    buyingPrice,
                    totalCost,
                    sellingPrice,
                    totalIncome,
                    margin,
                });
            }
        }
        return rows;
    }, [sales, vehicles]);

    const filteredRows = useMemo(() => {
        if (!search.trim()) return allRows;
        const q = search.toLowerCase();
        return allRows.filter(
            (r) =>
                r.productName.toLowerCase().includes(q) ||
                r.customerName.toLowerCase().includes(q) ||
                r.receiptNumber.toLowerCase().includes(q)
        );
    }, [allRows, search]);

    // ── Totals ────────────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        return filteredRows.reduce(
            (acc, r) => ({
                qty: acc.qty + r.qty,
                totalCost: acc.totalCost + r.totalCost,
                totalIncome: acc.totalIncome + r.totalIncome,
                totalMargin: acc.totalMargin + r.margin,
            }),
            { qty: 0, totalCost: 0, totalIncome: 0, totalMargin: 0 }
        );
    }, [filteredRows]);

    const marginPct =
        totals.totalIncome > 0
            ? ((totals.totalMargin / totals.totalIncome) * 100).toFixed(1)
            : "0.0";

    // ── PDF Export ────────────────────────────────────────────────────────────
    const downloadPDF = () => {
        const doc = new jsPDF({ orientation: "landscape" });

        // Header
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text("Profit & Loss Report", 14, 18);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Period: ${startDate}  →  ${endDate}`, 14, 25);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        if (selectedVehicle) {
            const v = vehicles.find((x) => x.id === selectedVehicle);
            doc.text(`Vehicle: ${v?.vehicleName || selectedVehicle}`, 14, 35);
        }

        // Summary boxes
        const summaryY = selectedVehicle ? 42 : 37;
        const boxes = [
            { label: "Items", val: fmtInt(filteredRows.length) },
            { label: "Total Cost", val: `KSh ${fmt(totals.totalCost)}` },
            { label: "Total Income", val: `KSh ${fmt(totals.totalIncome)}` },
            { label: "Net Margin", val: `KSh ${fmt(totals.totalMargin)} (${marginPct}%)` },
        ];
        let bx = 14;
        boxes.forEach(({ label, val }) => {
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(bx, summaryY, 64, 14, 2, 2, "FD");
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(label.toUpperCase(), bx + 3, summaryY + 5);
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(val, bx + 3, summaryY + 11);
            bx += 68;
        });

        // Table
        const tableY = summaryY + 20;
        const rows = filteredRows.map((r) => [
            r.date?.toLocaleDateString() || "—",
            r.vehicleName,
            r.customerName,
            r.receiptNumber,
            r.productName,
            fmtInt(r.qty),
            fmt(r.buyingPrice),
            fmt(r.totalCost),
            fmt(r.sellingPrice),
            fmt(r.totalIncome),
            fmt(r.margin),
        ]);

        // Totals row
        rows.push([
            { content: "TOTALS", styles: { fontStyle: "bold" } },
            "", "", "", "",
            { content: fmtInt(totals.qty), styles: { fontStyle: "bold", halign: "right" } },
            "",
            { content: fmt(totals.totalCost), styles: { fontStyle: "bold", halign: "right", textColor: [220, 38, 38] } },
            "",
            { content: fmt(totals.totalIncome), styles: { fontStyle: "bold", halign: "right", textColor: [5, 150, 105] } },
            { content: fmt(totals.totalMargin), styles: { fontStyle: "bold", halign: "right", textColor: totals.totalMargin >= 0 ? [5, 150, 105] : [220, 38, 38] } },
        ]);

        autoTable(doc, {
            head: [["Date", "Vehicle", "Customer", "Receipt #", "Product", "Qty", "Buy Price", "Total Cost", "Sell Price", "Total Income", "Margin"]],
            body: rows,
            startY: tableY,
            theme: "plain",
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: {
                fillColor: [241, 245, 249],
                textColor: [71, 85, 105],
                fontStyle: "bold",
                lineWidth: 0.1,
                lineColor: [226, 232, 240],
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 22 },
                2: { cellWidth: 28 },
                3: { cellWidth: 22 },
                4: { cellWidth: 40 },
                5: { halign: "right", cellWidth: 12 },
                6: { halign: "right", cellWidth: 22 },
                7: { halign: "right", cellWidth: 22, textColor: [220, 38, 38] },
                8: { halign: "right", cellWidth: 22 },
                9: { halign: "right", cellWidth: 22, textColor: [5, 150, 105] },
                10: { halign: "right", cellWidth: 22 },
            },
            didParseCell: (data) => {
                // Colour the margin column
                if (data.column.index === 10 && data.section === "body") {
                    const raw = filteredRows[data.row.index];
                    if (raw) {
                        data.cell.styles.textColor =
                            raw.margin > 0 ? [5, 150, 105] : raw.margin < 0 ? [220, 38, 38] : [100, 116, 139];
                    }
                }
            },
        });

        const vehiclePart = selectedVehicle
            ? `-${vehicles.find((v) => v.id === selectedVehicle)?.vehicleName || selectedVehicle}`
            : "";
        doc.save(`pnl-report${vehiclePart}-${startDate}-${endDate}.pdf`);
    };

    // ── Filter bar ────────────────────────────────────────────────────────────
    const filtersBar = (
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 bg-white h-[40px] transition-all shadow-sm"
                >
                    <option value="">All Vehicles</option>
                    {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.vehicleName}</option>
                    ))}
                </select>
            </div>
            <div className="relative w-full md:w-64">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Search</label>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Receipt, Item, Customer..."
                        className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 h-[40px] transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
            <button
                onClick={fetchData}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors h-[40px]"
            >
                Apply
            </button>
        </div>
    );

    // ── Actions ───────────────────────────────────────────────────────────────
    const actions = (
        <button
            onClick={downloadPDF}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm font-medium"
        >
            <Download size={16} />
            Download PDF
        </button>
    );

    // ── KPI strip ─────────────────────────────────────────────────────────────
    const kpiCards = (
        <>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Items Sold</p>
                <p className="text-2xl font-semibold text-slate-900">{fmtInt(filteredRows.length)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Cost</p>
                <p className="text-2xl font-semibold text-rose-600">KSh {fmt(totals.totalCost)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Income</p>
                <p className="text-2xl font-semibold text-emerald-600">KSh {fmt(totals.totalIncome)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Net Margin</p>
                <div className={`flex items-center gap-1.5 ${totals.totalMargin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {totals.totalMargin >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    <p className="text-2xl font-semibold">KSh {fmt(totals.totalMargin)}</p>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{marginPct}% margin</p>
            </div>
        </>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <ReportLayout
            title="Profit & Loss Report"
            description="Item-level breakdown of buying cost, selling income, and net margin for every sale."
            loading={loading}
            onRefresh={fetchData}
            filters={filtersBar}
            actions={actions}
            kpiCards={!loading ? kpiCards : null}
        >
            {/* P&L Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            {[
                                "Date",
                                "Vehicle",
                                "Customer",
                                "Receipt #",
                                "Product",
                                "Qty",
                                "Buy Price",
                                "Total Cost",
                                "Sell Price",
                                "Total Income",
                                "Margin",
                            ].map((col, i) => (
                                <th
                                    key={col}
                                    className={`px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap ${i >= 5 ? "text-right" : "text-left"}`}
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                                    No data found for the selected filters.
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row, idx) => {
                                const isProfit = row.margin > 0;
                                const isLoss = row.margin < 0;
                                return (
                                    <tr key={`${row.saleId}-${idx}`} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                        <td className="px-4 py-2.5 whitespace-nowrap text-[11px] font-medium text-slate-500">
                                            {row.date?.toLocaleDateString() || "—"}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-slate-700">
                                            {row.vehicleName}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-medium text-slate-600 max-w-[140px] truncate" title={row.customerName}>
                                            {row.customerName}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap font-bold text-[11px] text-blue-600 uppercase">
                                            {row.receiptNumber}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-800 font-bold max-w-[180px] truncate" title={row.productName}>
                                            {row.productName}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-slate-700 font-bold">
                                            {fmtInt(row.qty)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-slate-500 font-medium">
                                            {fmt(row.buyingPrice)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-rose-600 font-bold">
                                            {fmt(row.totalCost)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-slate-500 font-medium">
                                            {fmt(row.sellingPrice)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-emerald-600 font-bold">
                                            {fmt(row.totalIncome)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-bold text-xs">
                                            <span className={`inline-flex items-center gap-1 justify-end ${isProfit ? "text-emerald-700" : isLoss ? "text-rose-600" : "text-slate-400"}`}>
                                                {isProfit ? <TrendingUp size={12} /> : isLoss ? <TrendingDown size={12} /> : <Minus size={12} />}
                                                {fmt(row.margin)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>

                    {/* Summary Footer */}
                    {filteredRows.length > 0 && (
                        <tfoot className="border-t border-slate-200 bg-slate-50 font-bold text-slate-900">
                            <tr>
                                <td colSpan={5} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Totals (Filtered)
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-900">
                                    {fmtInt(totals.qty)}
                                </td>
                                <td className="px-4 py-3" />
                                <td className="px-4 py-3 text-right text-xs font-bold text-rose-600">
                                    {fmt(totals.totalCost)}
                                </td>
                                <td className="px-4 py-3" />
                                <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">
                                    {fmt(totals.totalIncome)}
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-bold">
                                    <span className={`inline-flex items-center gap-1 justify-end ${totals.totalMargin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                        {totals.totalMargin >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {fmt(totals.totalMargin)}
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-t border-slate-100">
                                <td colSpan={9} />
                                <td className="px-4 py-2 text-right text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    Margin %
                                </td>
                                <td className={`px-4 py-2 text-right text-sm font-bold ${totals.totalMargin >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                    {marginPct}%
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </ReportLayout>
    );
}
