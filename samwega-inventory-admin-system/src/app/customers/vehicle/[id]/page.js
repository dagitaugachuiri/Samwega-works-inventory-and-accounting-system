'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import api from "../../../../lib/api";

export default function VehicleCustomersPage() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api.getCurrentUser().then((r) => setIsAdmin(r?.data?.role === 'admin')).catch(() => {});
    api.getCustomersByVehicle()
      .then((r) => {
        const list = (r?.data ?? r)?.vehicles ?? [];
        setVehicle(list.find((v) => v.vehicleId === id) || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const customers = vehicle?.customers ?? [];
  const totals = customers.reduce(
    (t, c) => ({
      purchases: t.purchases + (c.totalPurchases || 0),
      debt: t.debt + (c.totalDebt || 0),
      reversed: t.reversed + (c.reversedSales || 0),
    }),
    { purchases: 0, debt: 0, reversed: 0 }
  );

  const toggle = async (c) => {
    const stopping = !c.messagesStopped;
    if (stopping && !window.confirm('Are you sure you want to opt out this client?')) return;

    setBusyId(c.customerId);
    setError('');
    try {
      await api.setCustomerMessagesStopped(c.customerId, stopping);
      setVehicle((v) => ({
        ...v,
        customers: v.customers.map((x) =>
          x.customerId === c.customerId ? { ...x, messagesStopped: stopping } : x
        ),
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const stats = [
    { label: 'Customers', value: customers.length },
    { label: 'Total purchases', value: totals.purchases.toLocaleString() },
    { label: 'Reversed sales', value: totals.reversed },
    { label: 'Debt outstanding', value: totals.debt.toLocaleString() },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <Link href="/customers" className="text-sm text-slate-500 hover:underline">← All vehicles</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">{vehicle?.vehicleName || 'Vehicle'}</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-slate-500">Loading…</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="border rounded-xl p-5 bg-white">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="text-2xl font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {!loading && vehicle && (
        <div className="border rounded-xl bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-slate-50">
                <th className="py-3 px-4">Name</th>
                <th className="px-4">Store</th>
                <th className="px-4">Phone</th>
                <th className="px-4 text-right">Purchases</th>
                <th className="px-4 text-right">Debt</th>
                <th className="px-4">Status</th>
                {isAdmin && <th className="px-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customerId} className="border-b last:border-0">
                  <td className="py-3 px-4">
                    <Link href={`/customers/${c.customerId}`} className="text-blue-600 hover:underline">
                      {c.customerName}
                    </Link>
                  </td>
                  <td className="px-4">{c.storeName || '—'}</td>
                  <td className="px-4">{c.customerPhone || '—'}</td>
                  <td className="px-4 text-right">{(c.totalPurchases || 0).toLocaleString()}</td>
                  <td className="px-4 text-right">{(c.totalDebt || 0).toLocaleString()}</td>
                  <td className="px-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.messagesStopped ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {c.messagesStopped ? 'Opted out' : 'Active'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/customers/${c.customerId}`} className="text-slate-500 hover:text-slate-900" title="Edit">
                          <Pencil size={16} />
                        </Link>
                        <button
                          onClick={() => toggle(c)}
                          disabled={busyId === c.customerId}
                          title={c.messagesStopped ? 'Turn messages on' : 'Opt out'}
                          className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 ${
                            c.messagesStopped ? 'bg-slate-300' : 'bg-emerald-500'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${
                            c.messagesStopped ? '' : 'translate-x-5'
                          }`} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} className="py-6 px-4 text-center text-slate-500">No customers for this vehicle yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}