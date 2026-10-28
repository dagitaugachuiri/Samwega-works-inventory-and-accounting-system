"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Car, BellOff, ChevronRight, Search, Printer, RefreshCw } from "lucide-react";
import api from "../../lib/api";
import AlertContainer, { useAlert } from "../../components/Alert";

const unwrap = (r) => r?.data ?? r;

export default function CustomersLanding() {
    const [summary, setSummary] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const alert = useAlert();

    useEffect(() => {
        api.getCurrentUser()
            .then((r) => setIsAdmin(unwrap(r)?.role === "admin"))
            .catch(() => {});
    }, []);

    const recalculate = async () => {
        if (!window.confirm("Recalculate every customer's debt from the sales records? Use this once to correct the figures.")) return;
        setRecalculating(true);
        try {
            const r = unwrap(await api.recalculateCustomerDebts());
            alert.success(`Debt recalculated for ${r.customers} customers, ${r.withDebt} with debt. Reloading…`);
            setTimeout(() => window.location.reload(), 1200);
        } catch (e) {
            alert.error("Recalculation failed: " + e.message);
            setRecalculating(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        Promise.all([api.getCustomersSummary(), api.getCustomersByVehicle()])
            .then(([s, v]) => {
                if (cancelled) return;
                setSummary(unwrap(s));
                setVehicles(unwrap(v)?.vehicles ?? []);
            })
            .catch((e) => alert.error("Failed to load customers: " + e.message))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        const t = setTimeout(() => {
            api.searchCustomers(q)
                .then((r) => setResults(unwrap(r)?.customers ?? []))
                .catch((e) => alert.error("Search failed: " + e.message))
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const stats = [
        { label: "Total customers", value: summary?.totalCustomers, icon: Users },
        { label: "Vehicles", value: summary?.vehicleCount, icon: Car },
        { label: "Opted out", value: summary?.optedOutCustomers, icon: BellOff },
    ];

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center py-24">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                    <p className="text-sm text-slate-600">Loading customers…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
                    <p className="text-sm text-slate-500">Customers grouped by vehicle</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                    {isAdmin && (
                        <button onClick={recalculate} disabled={recalculating} className="btn-ghost">
                            <RefreshCw size={16} className="mr-2" /> {recalculating ? "Recalculating…" : "Recalculate debts"}
                        </button>
                    )}
                    <Link href="/customers/print" className="btn-ghost">
                        <Printer size={16} className="mr-2" /> Print debt report
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {stats.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="glass-panel flex items-center justify-between p-5">
                            <div>
                                <p className="text-sm text-slate-500">{s.label}</p>
                                <p className="mt-1 text-3xl font-semibold text-slate-900">
                                    {typeof s.value === "number" ? s.value.toLocaleString() : "—"}
                                </p>
                            </div>
                            <Icon size={22} className="text-sky-500" />
                        </div>
                    );
                })}
            </div>

            {/* Search all customers */}
            <div className="flex flex-col gap-3">
                <div className="relative max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search all customers by name, store or phone..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="input-field pl-9"
                    />
                </div>
                {query.trim().length >= 2 && (
                    <div className="glass-panel overflow-hidden">
                        {searching ? (
                            <p className="p-4 text-sm text-slate-500">Searching…</p>
                        ) : results.length === 0 ? (
                            <p className="p-4 text-sm text-slate-500">No customers match.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {results.map((c) => (
                                    <li key={c.id}>
                                        <Link href={`/customers/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                                            <span className="font-medium text-slate-900">{c.customerName}</span>
                                            <span className="text-sm text-slate-500">
                                                {[c.storeName, c.customerPhone].filter(Boolean).join(" · ")}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            {/* Vehicles */}
            {vehicles.length === 0 ? (
                <div className="glass-panel p-10 text-center text-sm text-slate-500">
                    No vehicle customers yet. Customers appear here once they have a sale.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {vehicles.map((v) => (
                        <div key={v.vehicleId} className="glass-panel flex flex-col items-center p-6 text-center">
                            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-sky-100 text-sky-700">
                                <span className="text-2xl font-semibold">{v.customers.length}</span>
                                <span className="text-[10px] uppercase tracking-wide">customers</span>
                            </div>
                            <h2 className="mt-4 font-semibold text-slate-900">{v.vehicleName}</h2>
                            <Link href={`/customers/vehicle/${v.vehicleId}`} className="btn-ghost mt-5 w-full">
                                View customers
                                <ChevronRight size={16} className="ml-1" />
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            <AlertContainer alerts={alert.alerts} onClose={alert.hideAlert} />
        </div>
    );
}
