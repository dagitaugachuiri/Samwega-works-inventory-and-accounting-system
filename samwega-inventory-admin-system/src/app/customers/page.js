'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from "../../lib/api";

export default function CustomersLanding() {
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getCustomersSummary(), api.getCustomersByVehicle()])
      .then(([s, v]) => {
        setSummary(s?.data ?? s);
        setVehicles((v?.data ?? v)?.vehicles ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Total customers', value: summary?.totalCustomers },
    { label: 'Vehicles', value: summary?.vehicleCount },
    { label: 'Opted out', value: summary?.optedOutCustomers },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-semibold mb-6">Customers</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="border rounded-xl p-5 bg-white">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="text-3xl font-semibold mt-1">
              {typeof s.value === 'number' ? s.value.toLocaleString() : '—'}
            </p>
          </div>
        ))}
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((v) => {
          const reversed = v.customers.reduce((n, c) => n + (c.reversedSales || 0), 0);
          return (
            <div key={v.vehicleId} className="border rounded-xl p-5 bg-white flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold">{v.customers.length}</span>
                <span className="text-[10px] uppercase tracking-wide">customers</span>
              </div>
              <h2 className="mt-4 font-semibold">{v.vehicleName}</h2>
              <p className="text-sm text-slate-500 mt-1">{reversed} reversed</p>
              <Link
                href={`/customers/vehicle/${v.vehicleId}`}
                className="mt-4 w-full text-center border rounded-lg py-2 text-sm hover:bg-slate-50"
              >
                View customers →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}