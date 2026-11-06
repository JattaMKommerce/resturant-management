import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw, RefreshCw, CheckCircle2, Clock, X } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

/**
 * Refunds (REQ-006). A refund is created automatically when a paid online order is cancelled or
 * rejected. Razorpay refunds are issued automatically when possible; the rest wait here until the
 * restaurant pays the customer back and records how.
 */
const FILTERS = [
  { key: 'PENDING', label: 'To refund' },
  { key: 'PROCESSED', label: 'Completed' },
  { key: '', label: 'All' }
];
const METHODS = [
  { value: 'UPI', label: 'UPI transfer' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'RAZORPAY_DASHBOARD', label: 'Razorpay dashboard' },
  { value: 'OTHER', label: 'Other' }
];

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminRefundsPage() {
  const [filter, setFilter] = useState('PENDING');
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(null);
  const [method, setMethod] = useState('UPI');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/refunds${filter ? `?status=${filter}` : ''}`);
      setRefunds(res.data.refunds || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load refunds.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const submitComplete = async (e) => {
    e.preventDefault();
    if (!completing) return;
    setSaving(true);
    try {
      await api.post(`/admin/refunds/${completing.id}/complete`, { method, reference: reference.trim() });
      setCompleting(null);
      setReference('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record the refund.');
    } finally {
      setSaving(false);
    }
  };

  const pendingTotal = refunds.filter((r) => r.status === 'PENDING').reduce((s, r) => s + Number(r.amount), 0);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[#3A7D7C]" /> Refunds
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              Paid online orders that were cancelled or rejected. Razorpay refunds are issued automatically when possible; the rest are listed here until you pay the customer back.
            </p>
          </div>
          <button type="button" onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] text-xs font-bold text-[#1F2937] hover:bg-slate-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Refund status">
          {FILTERS.map((f) => (
            <button key={f.key || 'all'} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${filter === f.key ? 'bg-[#3A7D7C] text-white border-[#3A7D7C]' : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:bg-slate-50'}`}>
              {f.label}
            </button>
          ))}
          {filter === 'PENDING' && refunds.length > 0 && (
            <span className="ml-auto text-xs font-bold text-amber-800">{refunds.length} to refund · {inr(pendingTotal)}</span>
          )}
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold" role="alert">{error}</div>}

        <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#64748B]">Loading refunds…</div>
          ) : refunds.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B]">
              {filter === 'PENDING' ? 'Nothing to refund. You are all caught up.' : 'No refunds yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[#64748B] text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Order</th>
                    <th className="px-4 py-2.5 font-bold">Customer</th>
                    <th className="px-4 py-2.5 font-bold text-right">Amount</th>
                    <th className="px-4 py-2.5 font-bold">Reason</th>
                    <th className="px-4 py-2.5 font-bold">Status</th>
                    <th className="px-4 py-2.5 font-bold"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F5]">
                  {refunds.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#1F2937]">#{r.order_number || r.order_id}</div>
                        <div className="text-[11px] text-[#64748B]">{new Date(r.created_at).toLocaleString('en-IN')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1F2937]">{r.customer_name || '—'}</div>
                        {r.customer_phone && <a href={`tel:${r.customer_phone}`} className="text-[11px] text-[#3A7D7C] font-bold">{r.customer_phone}</a>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#1F2937]">{inr(r.amount)}</td>
                      <td className="px-4 py-3 text-[#475569] max-w-[220px]">
                        {r.reason || r.cancelled_reason || '—'}
                        {r.status === 'PENDING' && r.failure_reason && (
                          <div className="text-[11px] text-amber-700 mt-0.5">{r.failure_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'PROCESSED' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Refunded
                            <span className="font-normal text-[#64748B]">· {r.method}{r.reference ? ` · ${r.reference}` : ''}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700"><Clock className="w-3.5 h-3.5" /> To refund</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'PENDING' && (
                          <button type="button" onClick={() => { setCompleting(r); setMethod('UPI'); setReference(''); }}
                            className="px-3 py-1.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold whitespace-nowrap">
                            Mark refunded
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {completing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="refund-title">
          <form onSubmit={submitComplete} className="w-full max-w-sm bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h2 id="refund-title" className="text-sm font-extrabold text-[#1F2937]">Record refund · {inr(completing.amount)}</h2>
              <button type="button" onClick={() => setCompleting(null)} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[#64748B]">Order #{completing.order_number || completing.order_id} · {completing.customer_name}</p>
            <div>
              <label htmlFor="refund-method" className="block font-bold mb-1">How did you refund?</label>
              <select id="refund-method" value={method} onChange={(e) => setMethod(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-semibold">
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="refund-ref" className="block font-bold mb-1">Reference (UTR / transaction id)</label>
              <input id="refund-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={150}
                placeholder="Optional" className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCompleting(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold disabled:opacity-50">
                {saving ? 'Saving…' : 'Save refund'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
