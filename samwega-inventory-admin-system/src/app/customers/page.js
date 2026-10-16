'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from "../../lib/api";

export default function CustomersPage() {
  const [view, setView] = useState('all');
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // All customers (paged, searchable)
  useEffect(() => {
    if (view !== 'all') return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          page: String(page),
          limit: '20',
          ...(search ? { search } : {}),
        }).toString();
        const res = await api.getCustomers(qs);
        const data = res?.data ?? res;
        setCustomers(data.customers ?? []);
        setPagination(data.pagination ?? { totalPages: 1, total: 0 });
        setError('');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [view, search, page]);

  // Customers grouped by vehicle (one request for everything)
  useEffect(() => {
    if (view !== 'vehicles') return;
    setLoading(true);
    api.getCustomersByVehicle()
      .then((res) => {
        const data = res?.data ?? res;
        setVehicles(data.vehicles ?? []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [view]);

  const columns = ['Name', 'Phone', 'Sales', 'Reversed', 'Purchases', 'Owing', 'Last sale'];

  const Row = ({ c }) => (
    <tr className={`border-b hover:bg-slate-50 ${c.reversedSales > 0 ? 'bg-amber-50' : ''}`}>
      <td className="py-2">
        <Link href={`/customers/${c.customerId}`} className="text-blue-600">{c.customerName}</Link>
      </td>
      <td>{c.customerPhone || '—'}</td>
      <td className="text-right">{c.completedSales ?? c.totalSales ?? '—'}</td>
      <td className={`text-right ${c.reversedSales > 0 ? 'text-amber-700 font-medium' : ''}`}>
        {c.reversedSales ?? 0}
      </td>
      <td className="text-right">{(c.totalPurchases || 0).toLocaleString()}</td>
      <td className="text-right">{c.salesOwing ?? 0}</td>
      <td>{c.lastSaleDate ? new Date(c.lastSaleDate).toLocaleDateString() : '—'}</td>
    </tr>
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Customers</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('all')}
          className={`px-3 py-1 rounded border ${view === 'all' ? 'bg-blue-600 text-white' : ''}`}
        >
          All customers
        </button>
        <button
          onClick={() => setView('vehicles')}
          className={`px-3 py-1 rounded border ${view === 'vehicles' ? 'bg-blue-600 text-white' : ''}`}
        >
          By vehicle
        </button>
      </div>

      {view === 'all' && (
        <input
          className="border rounded px-3 py-2 mb-4 w-full max-w-md"
          placeholder="Search name, store or phone"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      )}

      {loading && <p className="text-sm text-slate-500 mb-2">Loading…</p>}
      {error && <p className="text-red-600 mb-2">{error}</p>}

      {view === 'all' && (
        <>
          <table className={`w-full text-sm ${loading ? 'opacity-50' : ''}`}>
            <thead>
              <tr className="text-left border-b">
                {columns.map((h) => <th key={h} className="py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => <Row key={c.id} c={{ ...c, customerId: c.id }} />)}
            </tbody>
          </table>

          <div className="flex items-center gap-3 mt-4 text-sm">
            <button
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border rounded px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {page} of {pagination.totalPages || 1} · {pagination.total} customers</span>
            <button
              disabled={loading || page >= (pagination.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="border rounded px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {view === 'vehicles' && !loading && vehicles.length === 0 && (
        <p className="text-sm text-slate-500">No vehicle sales with customers yet.</p>
      )}

      {view === 'vehicles' && vehicles.map((v) => (
        <div key={v.vehicleId} className="mb-8">
          <h2 className="text-lg font-semibold mb-2">
            {v.vehicleName}
            <span className="ml-2 text-sm font-normal text-slate-500">
              {v.customers.length} customer{v.customers.length === 1 ? '' : 's'}
            </span>
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                {columns.map((h) => <th key={h} className="py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {v.customers.map((c) => <Row key={c.customerId} c={c} />)}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}