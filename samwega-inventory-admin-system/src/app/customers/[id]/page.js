"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Car, Receipt, RefreshCw } from "lucide-react";
import api from "../../../lib/api";
import AlertContainer, { useAlert } from "../../../components/Alert";

const FIELDS = [
    { key: "customerName", label: "Name" },
    { key: "storeName", label: "Store" },
    { key: "customerPhone", label: "Phone" },
    { key: "customerIdNumber", label: "ID number" },
    { key: "customerEmail", label: "Email" },
    { key: "notes", label: "Notes", multiline: true },
];

const PAY_METHODS = ["cash", "mpesa", "bank", "equity", "cheque", "manual"];

const unwrap = (r) => r?.data ?? r;

export default function CustomerEditPage() {
    const { id } = useParams();
    const router = useRouter();
    const [customer, setCustomer] = useState(null);
    const [form, setForm] = useState({});
    const [vehicles, setVehicles] = useState([]);
    const [unpaid, setUnpaid] = useState({ totalDebt: 0, sales: [] });
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [saving, setSaving] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("cash");
    const [paying, setPaying] = useState(false);
    const alert = useAlert();

    const loadCustomer = useCallback(async () => {
        setLoading(true);
        setLoadError("");
        try {
            const c = unwrap(await api.getCustomerById(id));
            setCustomer(c);
            setForm({
                ...Object.fromEntries(FIELDS.map((f) => [f.key, c[f.key] || ""])),
                assignedVehicleId: c.assignedVehicleId || "",
            });
        } catch (e) {
            setLoadError(e.message || "Could not load this customer.");
        } finally {
            setLoading(false);
        }
        api.getCustomerUnpaidSales(id)
            .then((r) => setUnpaid(unwrap(r) || { totalDebt: 0, sales: [] }))
            .catch(() => {});
    }, [id]);

    useEffect(() => {
        api.getCurrentUser()
            .then((r) => setIsAdmin(unwrap(r)?.role === "admin"))
            .catch(() => {});
        api.getVehicles()
            .then((r) => {
                const d = unwrap(r);
                const list = Array.isArray(d) ? d : (d?.vehicles ?? []);
                setVehicles(list.filter((v) => v.isActive !== false));
            })
            .catch(() => {});
        loadCustomer();
    }, [loadCustomer]);

    const save = async () => {
        const payload = {};
        FIELDS.forEach((f) => {
            if ((form[f.key] ?? "") !== (customer[f.key] || "")) payload[f.key] = form[f.key];
        });
        if ((form.assignedVehicleId || "") !== (customer.assignedVehicleId || "")) {
            payload.assignedVehicleId = form.assignedVehicleId || null;
        }
        if (Object.keys(payload).length === 0) {
            alert.info("Nothing to save.");
            return;
        }

        setSaving(true);
        try {
            const updated = unwrap(await api.updateCustomer(id, payload));
            setCustomer(updated);
            setForm((f) => ({ ...f, assignedVehicleId: updated.assignedVehicleId || "" }));
            alert.success(payload.customerPhone
                ? "Saved. Sales with the old phone number were updated too."
                : "Customer saved");
        } catch (e) {
            alert.error("Failed to save: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const recordPayment = async () => {
        const amount = Number(payAmount);
        if (!(amount > 0)) {
            alert.error("Enter the amount paid");
            return;
        }
        setPaying(true);
        try {
            const updated = unwrap(await api.recordCustomerPayment(id, amount, payMethod));
            setCustomer(updated);
            setPayAmount("");
            alert.success(`Payment of KES ${amount.toLocaleString()} recorded`);
            api.getCustomerUnpaidSales(id).then((r) => setUnpaid(unwrap(r))).catch(() => {});
        } catch (e) {
            alert.error("Failed to record payment: " + e.message);
        } finally {
            setPaying(false);
        }
    };

    const toggleMessages = async () => {
        const stopping = !customer.messagesStopped;
        if (stopping && !window.confirm("Are you sure you want to opt out this client?")) return;
        try {
            setCustomer(unwrap(await api.setCustomerMessagesStopped(id, stopping)));
        } catch (e) {
            alert.error("Failed to update messages: " + e.message);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Delete ${customer.customerName}? This cannot be undone.`)) return;
        try {
            await api.deleteCustomer(id);
            router.push("/customers");
        } catch (e) {
            alert.error("Failed to delete: " + e.message);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center py-24">
                <div className="glass-panel px-10 py-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                    <p className="text-sm text-slate-600">Loading customer…</p>
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-16 text-center">
                <p className="text-sm text-slate-700">Could not load this customer.</p>
                {loadError && <p className="text-xs text-rose-600">{loadError}</p>}
                <button onClick={loadCustomer} className="btn-ghost">
                    <RefreshCw size={14} className="mr-2" /> Try again
                </button>
                <Link href="/customers" className="text-sm text-slate-500 hover:underline">Back to customers</Link>
            </div>
        );
    }

    const debt = Number(customer.totalDebt || 0);

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
            <div>
                <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={14} /> Back
                </Link>
                <div className="mt-1 flex items-center justify-between gap-4">
                    <h1 className="text-2xl font-semibold text-slate-900">{customer.customerName}</h1>
                    {customer.messagesStopped && (
                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            Opted out
                        </span>
                    )}
                </div>
            </div>

            {/* Debt */}
            <div className="glass-panel p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-500">Debt outstanding</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">KES {debt.toLocaleString()}</p>
                    </div>
                    <Receipt size={22} className="text-sky-500" />
                </div>
                {unpaid.sales.length > 0 && (
                    <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                        {unpaid.sales.map((s) => (
                            <div key={s.saleId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                <div>
                                    <span className="font-mono text-slate-900">{s.receiptNumber}</span>
                                    <span className="ml-2 text-slate-500">
                                        {s.saleDate ? new Date(s.saleDate).toLocaleDateString() : ""}
                                        {s.vehicleName ? ` · ${s.vehicleName}` : ""}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="font-medium text-slate-900">KES {s.grandTotal.toLocaleString()}</div>
                                    <div className="text-xs text-amber-700">
                                        {s.paymentStatus === "partially_paid" ? "Partly paid" : "Unpaid"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {isAdmin && debt > 0 && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-end">
                        <label className="block flex-1">
                            <span className="mb-1 block text-sm font-medium text-slate-700">Amount paid (KES)</span>
                            <input
                                type="number"
                                min="0"
                                className="input-field"
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                            />
                        </label>
                        <label className="block sm:w-40">
                            <span className="mb-1 block text-sm font-medium text-slate-700">Method</span>
                            <select className="input-field" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                                {PAY_METHODS.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </label>
                        <button onClick={recordPayment} disabled={paying} className="btn-primary">
                            {paying ? "Recording…" : "Record payment"}
                        </button>
                    </div>
                )}
            </div>

            {/* Details */}
            <div className="glass-panel space-y-4 p-6">
                {FIELDS.map((f) => (
                    <label key={f.key} className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}</span>
                        {f.multiline ? (
                            <textarea
                                className="input-field disabled:bg-slate-100"
                                rows={3}
                                value={form[f.key] ?? ""}
                                disabled={!isAdmin}
                                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                            />
                        ) : (
                            <input
                                className="input-field disabled:bg-slate-100"
                                value={form[f.key] ?? ""}
                                disabled={!isAdmin}
                                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                            />
                        )}
                    </label>
                ))}

                <label className="block">
                    <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
                        <Car size={14} /> Assigned vehicle
                    </span>
                    <select
                        className="input-field disabled:bg-slate-100"
                        value={form.assignedVehicleId ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => setForm({ ...form, assignedVehicleId: e.target.value })}
                    >
                        <option value="">No vehicle</option>
                        {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>{v.vehicleName}</option>
                        ))}
                    </select>
                </label>

                {isAdmin && (
                    <div className="flex justify-end pt-2">
                        <button onClick={save} disabled={saving} className="btn-primary">
                            {saving ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                )}
            </div>

            {isAdmin && (
                <div className="glass-panel flex items-center justify-between gap-4 p-6">
                    <div>
                        <p className="font-medium text-slate-900">Messages</p>
                        <p className="text-sm text-slate-500">
                            {customer.messagesStopped
                                ? "Opted out. No messages are sent to this number."
                                : "Messages are on."}
                        </p>
                    </div>
                    <button
                        onClick={toggleMessages}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                            customer.messagesStopped ? "bg-slate-300" : "bg-emerald-500"
                        }`}
                        title={customer.messagesStopped ? "Messages on" : "Opt out"}
                    >
                        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                            customer.messagesStopped ? "" : "translate-x-5"
                        }`} />
                    </button>
                </div>
            )}

            {isAdmin && (
                <div className="glass-panel flex items-center justify-between gap-4 p-6">
                    <div>
                        <p className="font-medium text-slate-900">Delete customer</p>
                        <p className="text-sm text-slate-500">Not possible while the customer has outstanding debt.</p>
                    </div>
                    <button onClick={remove} className="btn-danger">
                        <Trash2 size={14} className="mr-2" /> Delete
                    </button>
                </div>
            )}

            <AlertContainer alerts={alert.alerts} onClose={alert.hideAlert} />
        </div>
    );
}
