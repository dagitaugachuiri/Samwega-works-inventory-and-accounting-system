"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Car, BellOff, ChevronRight } from "lucide-react";
import api from "../../lib/api";
import AlertContainer, { useAlert } from "../../components/Alert";

export default function CustomersLanding() {
    const [summary, setSummary] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const alert = useAlert();

    useEffect(() => {
        let cancelled = false;
        Promise.all([api.getCustomersSummary(), api.getCustomersByVehicle()])
            .then(([s, v]) => {
                if (cancelled) return;
                setSummary(s?.data ?? s);
                setVehicles((v?.data ?? v)?.vehicles ?? []);
            })
            .catch((e) => alert.error("Failed to load customers: " + e.message))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
                <p className="text-sm text-slate-500">Customers grouped by vehicle</p>
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

            {/* Vehicles */}
            {vehicles.length === 0 ? (
                <div className="glass-panel p-10 text-center text-sm text-slate-500">
                    No vehicle customers yet. Customers appear here once they have a sale.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {vehicles.map((v) => {
                        const reversed = v.customers.reduce((n, c) => n + (c.reversedSales || 0), 0);
                        return (
                            <div key={v.vehicleId} className="glass-panel flex flex-col items-center p-6 text-center">
                                <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-sky-100 text-sky-700">
                                    <span className="text-2xl font-semibold">{v.customers.length}</span>
                                    <span className="text-[10px] uppercase tracking-wide">customers</span>
                                </div>
                                <h2 className="mt-4 font-semibold text-slate-900">{v.vehicleName}</h2>
                                <p className="mt-1 text-sm text-slate-500">{reversed} reversed</p>
                                <Link
                                    href={`/customers/vehicle/${v.vehicleId}`}
                                    className="btn-ghost mt-5 w-full"
                                >
                                    View customers
                                    <ChevronRight size={16} className="ml-1" />
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}

            <AlertContainer alerts={alert.alerts} onClose={alert.hideAlert} />
        </div>
    );
}
