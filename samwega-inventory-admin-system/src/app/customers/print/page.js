"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import api from "../../../lib/api";
import AlertContainer, { useAlert } from "../../../components/Alert";

const unwrap = (r) => r?.data ?? r;

const SORTS = {
    debt_desc: { label: "Highest debt first", fn: (a, b) => b.totalDebt - a.totalDebt },
    debt_asc: { label: "Lowest debt first", fn: (a, b) => a.totalDebt - b.totalDebt },
    latest_sale: { label: "Newest sale first", fn: (a, b) => (b.lastSaleDate || "").localeCompare(a.lastSaleDate || "") },
    oldest_sale: { label: "Oldest sale first", fn: (a, b) => (a.lastSaleDate || "").localeCompare(b.lastSaleDate || "") },
    name: { label: "Name A–Z", fn: (a, b) => (a.customerName || "").localeCompare(b.customerName || "") },
};

export default function CustomersPrintPage() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vehicleFilter, setVehicleFilter] = useState("all");
    const [debtOnly, setDebtOnly] = useState(true);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [sort, setSort] = useState("debt_desc");
    const alert = useAlert();

    useEffect(() => {
        const v = new URLSearchParams(window.location.search).get("vehicle");
        if (v) setVehicleFilter(v);
    }, []);

    useEffect(() => {
        let cancelled = false;
        api.getCustomersByVehicle()
            .then((r) => !cancelled && setVehicles(unwrap(r)?.vehicles ?? []))
            .catch((e) => alert.error("Failed to load customers: " + e.message))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // One row per customer, even when they appear under more than one vehicle
    const rows = useMemo(() => {
        const byId = new Map();
        vehicles.forEach((v) => {
            if (vehicleFilter !== "all" && v.vehicleId !== vehicleFilter) return;
            v.customers.forEach((c) => {
                const existing = byId.get(c.customerId);
                if (!existing) {
                    byId.set(c.customerId, { ...c, vehicleNames: [v.vehicleName] });
                } else {
                    if (!existing.vehicleNames.includes(v.vehicleName)) existing.vehicleNames.push(v.vehicleName);
                    if ((c.lastSaleDate || "") > (existing.lastSaleDate || "")) existing.lastSaleDate = c.lastSaleDate;
                }
            });
        });

        return [...byId.values()]
            .filter((c) => !debtOnly || c.totalDebt > 0)
            .filter((c) => {
                const d = (c.lastSaleDate || "").slice(0, 10);
                if (from && (!d || d < from)) return false;
                if (to && (!d || d > to)) return false;
                return true;
            })
            .sort(SORTS[sort].fn);
    }, [vehicles, vehicleFilter, debtOnly, from, to, sort]);

    const total = rows.reduce((t, c) => t + (c.totalDebt || 0), 0);

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center py-24">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                    <p className="text-sm text-slate-600">Loading report…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            {/* Controls: hidden when printing */}
            <div className="print:hidden flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                    <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                        <ArrowLeft size={14} /> Back
                    </Link>
                    <button onClick={() => window.print()} className="btn-primary">
                        <Printer size={16} className="mr-2" /> Print
                    </button>
                </div>

                <div className="glass-panel grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Vehicle</span>
                        <select className="input-field" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
                            <option value="all">All vehicles</option>
                            {vehicles.map((v) => (
                                <option key={v.vehicleId} value={v.vehicleId}>{v.vehicleName}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Last sale from</span>
                        <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Last sale to</span>
                        <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Sort by</span>
                        <select className="input-field" value={sort} onChange={(e) => setSort(e.target.value)}>
                            {Object.entries(SORTS).map(([k, s]) => (
                                <option key={k} value={k}>{s.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                        <input type="checkbox" checked={debtOnly} onChange={(e) => setDebtOnly(e.target.checked)} />
                        Only customers with debt
                    </label>
                </div>
            </div>

            {/* Printable report */}
            <div className="glass-panel overflow-x-auto p-6 print:border-0 print:bg-white print:p-0">
                <div className="mb-4">
                    <h1 className="text-xl font-semibold text-slate-900">Customer debt report</h1>
                    <p className="text-sm text-slate-500">
                        {rows.length} customers · Total outstanding KES {total.toLocaleString()}
                        {from || to ? ` · Last sale ${from || "…"} to ${to || "…"}` : ""}
                    </p>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500 print:bg-white">
                        <tr>
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Store</th>
                            <th className="px-3 py-2 font-medium">Phone</th>
                            <th className="px-3 py-2 font-medium">Vehicle(s)</th>
                            <th className="px-3 py-2 font-medium">Last sale</th>
                            <th className="px-3 py-2 text-right font-medium">Debt (KES)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No customers match these filters.</td>
                            </tr>
                        ) : rows.map((c) => (
                            <tr key={c.customerId}>
                                <td className="px-3 py-2 font-medium text-slate-900">{c.customerName}</td>
                                <td className="px-3 py-2 text-slate-700">{c.storeName || "—"}</td>
                                <td className="px-3 py-2 text-slate-700">{c.customerPhone || "—"}</td>
                                <td className="px-3 py-2 text-slate-700">{c.vehicleNames.join(", ")}</td>
                                <td className="px-3 py-2 text-slate-700">
                                    {c.lastSaleDate ? new Date(c.lastSaleDate).toLocaleDateString() : "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">{c.totalDebt.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AlertContainer alerts={alert.alerts} onClose={alert.hideAlert} />
        </div>
    );
}
