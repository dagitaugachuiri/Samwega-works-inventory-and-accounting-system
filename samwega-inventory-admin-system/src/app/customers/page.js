'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from "../../lib/api";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ limit: '50', ...(search ? { search } : {}) }).toString();
        const res = await api.getCustomers(qs);
        setCustomers(res?.data?.customers ?? res?.customers ?? []);
        setError('');
      } catch (e) {
        setError(e.message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Customers</h1>
      <input
        className="border rounded px-3 py-2 mb-4 w-full max-w-md"
        placeholder="Search name, store or phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th>Phone</th>
            <th>Store</th>
            <th className="text-right">Purchases</th>
            <th className="text-right">Debt</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b hover:bg-slate-50">
              <td className="py-2">
                <Link href={`/customers/${c.id}`} className="text-blue-600">{c.customerName}</Link>
              </td>
              <td>{c.customerPhone || '—'}</td>
              <td>{c.storeName || '—'}</td>
              <td className="text-right">{(c.totalPurchases || 0).toLocaleString()}</td>
              <td className="text-right">{(c.totalDebt || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}