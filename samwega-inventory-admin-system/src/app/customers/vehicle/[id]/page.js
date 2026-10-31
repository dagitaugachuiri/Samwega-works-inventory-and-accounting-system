"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Search, ArrowLeft, Printer, RefreshCw } from "lucide-react";
import api from "../../../../lib/api";
import AlertContainer, { useAlert } from "../../../../components/Alert";

export default function VehicleCustomersPage() {
    const { id } = useParams();
    const [vehicle, setVehicle] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [search, setSearch] = useState("");
    const alert = useAlert();

    useEffect(() => {
        let cancelled = false;
        api.getCurrentUser()
            .then((r) => !cancelled && setIsAdmin(r?.data?.role === "admin"))
            .catch(() => {});
        api.getCustomersByVehicle()
            .then((r) => {
                if (cancelled) return;
                const list = (r?.data ?? r)?.vehicles ?? [];
                setVehicle(list.find((v) => v.vehicleId === id) || null);
            })
            .catch((e) => alert.error("Failed to load customers: " + e.message))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const customers = vehicle?.customers ?? [];

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter((c) =>
            (c.customerName || "").toLowerCase().includes(q) ||
            (c.storeName || "").toLowerCase().includes(q) ||
            (c.customerPhone || "").includes(q)
        );
    }, [customers, search]);

    const totals = customers.reduce(
        (t, c) => ({
            purchases: t.purchases + (c.totalPurchases || 0),
            debt: t.debt + (c.totalDebt || 0),
        }),
        { purchases: 0, debt: 0 }
    );

    const [recalculating, setRecalculating] = useState(false);

    const recalculate = async () => {
        if (!window.confirm("Recalculate every customer's debt from the sales records? Use this once to correct the figures.")) return;
        setRecalculating(true);
        try {
            const r = (await api.recalculateCustomerDebts())?.data ?? {};
            alert.success(`Debt recalculated for ${r.customers} customers, ${r.withDebt} with debt. Reloading…`);
            setTimeout(() => window.location.reload(), 1200);
        } catch (e) {
            alert.error("Recalculation failed: " + e.message);
            setRecalculating(false);
        }
    };

    const patchLocal = (customerId, changes) =>
        setVehicle((v) => ({
            ...v,
            customers: v.customers.map((x) => (x.customerId === customerId ? { ...x, ...changes } : x)),
        }));

    const toggleMessages = async (c) => {
        const stopping = !c.messagesStopped;
        if (stopping && !window.confirm("Are you sure you want to opt out this client?")) return;

        setBusyId(c.customerId);
        try {
            await api.setCustomerMessagesStopped(c.customerId, stopping);
            patchLocal(c.customerId, { messagesStopped: stopping });
        } catch (e) {
            alert.error("Failed to update messages: " + e.message);
        } finally {
            setBusyId(null);
        }
    };

    const removeCustomer = async (c) => {
        if (!window.confirm(`Delete ${c.customerName}? This cannot be undone.`)) return;

        setBusyId(c.customerId);
        try {
            await api.deleteCustomer(c.customerId);
            setVehicle((v) => ({
                ...v,
                customers: v.customers.filter((x) => x.customerId !== c.customerId),
            }));
            alert.success("Customer deleted");
        } catch (e) {
            alert.error("Failed to delete: " + e.message);
        } finally {
            setBusyId(null);
        }
    };

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

    const stats = [
        { label: "Customers", value: customers.length },
        { label: "Total purchases", value: `KES ${totals.purchases.toLocaleString()}` },
        { label: "Debt outstanding", value: `KES ${totals.debt.toLocaleString()}` },
    ];

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                        <ArrowLeft size={14} /> All vehicles
                    </Link>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                        {vehicle?.vehicleName || "Vehicle"}
                    </h1>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                    {isAdmin && (
                        <button onClick={recalculate} disabled={recalculating} className="btn-ghost">
                            <RefreshCw size={16} className="mr-2" /> {recalculating ? "Recalculating…" : "Recalculate debts"}
                        </button>
                    )}
                    <Link href={`/customers/print?vehicle=${id}`} className="btn-ghost">
                        <Printer size={16} className="mr-2" /> Print debt report
                    </Link>
                </div>
            </div>

            {!vehicle ? (
                <div className="glass-panel p-10 text-center text-sm text-slate-500">
                    This vehicle has no customers yet.
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {stats.map((s) => (
                            <div key={s.label} className="glass-panel p-5">
                                <p className="text-sm text-slate-500">{s.label}</p>
                                <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search name, store or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-field pl-9"
                        />
                    </div>

                    {/* Table */}
                    <div className="glass-panel overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 text-left text-xs text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Name</th>
                                    <th className="px-4 py-3 font-medium">Store</th>
                                    <th className="px-4 py-3 font-medium">Phone</th>
                                    <th className="px-4 py-3 text-right font-medium">Purchases</th>
                                    <th className="px-4 py-3 text-right font-medium">Debt</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    {isAdmin && <th className="px-4 py-3 text-center font-medium">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                                            {customers.length === 0 ? "No customers for this vehicle yet." : "No customers match your search."}
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((c) => (
                                        <tr key={c.customerId} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm">
                                                <Link href={`/customers/${c.customerId}`} className="font-medium text-sky-700 hover:underline">
                                                    {c.customerName}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{c.storeName || "—"}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{c.customerPhone || "—"}</td>
                                            <td className="px-4 py-3 text-right text-sm">KES {(c.totalPurchases || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-sm">KES {(c.totalDebt || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                {c.messagesStopped && (
                                                    <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                        Opted out
                                                    </span>
                                                )}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Link
                                                            href={`/customers/${c.customerId}`}
                                                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                                                            title="Edit customer"
                                                        >
                                                            <Pencil size={14} />
                                                        </Link>
                                                        <button
                                                            onClick={() => toggleMessages(c)}
                                                            disabled={busyId === c.customerId}
                                                            title={c.messagesStopped ? "Messages on" : "Opt out"}
                                                            className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
                                                                c.messagesStopped ? "bg-slate-300" : "bg-emerald-500"
                                                            }`}
                                                        >
                                                            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                                                                c.messagesStopped ? "" : "translate-x-5"
                                                            }`} />
                                                        </button>
                                                        <button
                                                            onClick={() => removeCustomer(c)}
                                                            disabled={busyId === c.customerId}
                                                            className="rounded p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                                                            title="Delete customer"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <AlertContainer alerts={alert.alerts} onClose={alert.hideAlert} />
        </div>
    );
}
