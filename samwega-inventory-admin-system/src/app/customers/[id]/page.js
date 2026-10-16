'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from "../../../lib/api";

const FIELDS = [
  { key: 'customerName', label: 'Name' },
  { key: 'storeName', label: 'Store' },
  { key: 'customerPhone', label: 'Phone' },
  { key: 'customerIdNumber', label: 'ID number' },
  { key: 'customerEmail', label: 'Email' },
  { key: 'notes', label: 'Notes', multiline: true },
];

export default function CustomerEditPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [form, setForm] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getCurrentUser().then((r) => setIsAdmin(r?.data?.role === 'admin')).catch(() => {});
    api.getCustomerById(id)
      .then((r) => {
        const c = r?.data ?? r;
        setCustomer(c);
        setForm(Object.fromEntries(FIELDS.map((f) => [f.key, c[f.key] || ''])));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const save = async () => {
    const payload = {};
    FIELDS.forEach((f) => {
      if ((form[f.key] ?? '') !== (customer[f.key] || '')) payload[f.key] = form[f.key];
    });
    if (Object.keys(payload).length === 0) {
      setMessage('Nothing to save.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const r = await api.updateCustomer(id, payload);
      const updated = r?.data ?? r;
      setCustomer(updated);
      setMessage(payload.customerPhone
        ? 'Saved. Sales with the old phone number were updated too.'
        : 'Saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    const stopping = !customer.messagesStopped;
    if (stopping && !window.confirm('Are you sure you want to opt out this client?')) return;
    setError('');
    try {
      const r = await api.setCustomerMessagesStopped(id, stopping);
      setCustomer(r?.data ?? r);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!customer) {
    return <div className="p-6">{error || 'Loading…'}</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link href="/customers" className="text-sm text-slate-500 hover:underline">← Back</Link>

      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-semibold">{customer.customerName}</h1>
        {customer.messagesStopped && (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-200 text-slate-700">
            Opted out
          </span>
        )}
      </div>

      <div className="border rounded-xl bg-white p-6 space-y-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm text-slate-600">{f.label}</span>
            {f.multiline ? (
              <textarea
                className="mt-1 border rounded-lg px-3 py-2 w-full disabled:bg-slate-50"
                rows={3}
                value={form[f.key] ?? ''}
                disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <input
                className="mt-1 border rounded-lg px-3 py-2 w-full disabled:bg-slate-50"
                value={form[f.key] ?? ''}
                disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            )}
          </label>
        ))}

        {isAdmin && (
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="border rounded-xl bg-white p-6 mt-6 flex items-center justify-between">
          <div>
            <p className="font-medium">Messages</p>
            <p className="text-sm text-slate-500">
              {customer.messagesStopped ? 'Opted out — no messages are sent to this number.' : 'Messages are on.'}
            </p>
          </div>
          <button
            onClick={toggle}
            className={`relative w-11 h-6 rounded-full transition ${
              customer.messagesStopped ? 'bg-slate-300' : 'bg-emerald-500'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${
              customer.messagesStopped ? '' : 'translate-x-5'
            }`} />
          </button>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}