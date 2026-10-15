'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from "../../../lib/api";

export default function CustomerPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const isAdmin = true; 

  useEffect(() => {
    api.getCustomerById(id).then((res) => {
      const c = res?.data ?? res;
      setCustomer(c);
      setForm({
        customerName: c.customerName || '',
        customerPhone: c.customerPhone || '',
        storeName: c.storeName || '',
        customerEmail: c.customerEmail || '',
        notes: c.notes || '',
      });
    }).catch((e) => setMessage(e.message));
  }, [id]);

  const save = async () => {
    try {
      await api.updateCustomer(id, form);
      setMessage('Saved. Sales with the old phone number were updated too.');
    } catch (e) {
      setMessage(e.message);
    }
  };

  if (!customer) return <div className="p-6">{message || 'Loading…'}</div>;

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">{customer.customerName}</h1>
      {['customerName', 'customerPhone', 'storeName', 'customerEmail'].map((field) => (
        <label key={field} className="block mb-3">
          <span className="text-sm text-slate-600">{field}</span>
          <input
            className="border rounded px-3 py-2 w-full"
            value={form[field]}
            disabled={!isAdmin}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          />
        </label>
      ))}
      <label className="block mb-3">
        <span className="text-sm text-slate-600">notes</span>
        <textarea
          className="border rounded px-3 py-2 w-full"
          value={form.notes}
          disabled={!isAdmin}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
      {isAdmin && (
        <button onClick={save} className="bg-blue-600 text-white rounded px-4 py-2">Save</button>
      )}
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}