import React, { useCallback, useEffect, useState } from 'react';
import { UsersRound, Search, Download, X, Phone, RefreshCw, StickyNote, ShoppingBag, CalendarClock } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import { downloadXlsx } from '../../utils/xlsxWriter';

/**
 * Customer management (REQ-038): everyone who ordered online, at a table or booked a table,
 * matched by mobile number, with spend, last visit and staff notes / tags.
 */
const inr = (v) => `₹${Math.round(Number(v || 0)).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const SEGMENTS = [['', 'Everyone'], ['Regular', 'Regulars (5+ orders)'], ['New', 'New (last 30 days)'], ['Lapsed', 'Not seen in 60 days']];
const SEG_STYLE = { Regular: 'bg-emerald-50 text-emerald-800 border-emerald-200', New: 'bg-sky-50 text-sky-800 border-sky-200', Lapsed: 'bg-amber-50 text-amber-900 border-amber-200' };
const STATUS_TEXT = { DELIVERED: 'Delivered', COMPLETED: 'Completed', CANCELLED: 'Cancelled', REJECTED: 'Rejected' };

function CustomerDrawer({ phoneKey, onClose, onSaved }) {
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  useEffect(() => {
    api.get(`/admin/customers/${phoneKey}`)
      .then((res) => { setC(res.data.data); setNotes(res.data.data.notes || ''); setTags((res.data.data.tags || []).join(', ')); })
      .catch((err) => setError(err.response?.data?.message || 'Could not load the customer.'));
  }, [phoneKey]);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved('');
    try {
      const res = await api.put(`/admin/customers/${phoneKey}`, { notes, tags });
      setSaved(res.data.message);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="cust-title">
      <div className="bg-white w-full sm:max-w-lg h-full overflow-y-auto p-5 space-y-4 shadow-xl text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="cust-title" className="text-lg font-extrabold text-[#1F2937]">{c?.name || 'Customer'}</h2>
            {c && (
              <p className="text-xs text-[#64748B] flex flex-wrap gap-x-3">
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 font-semibold text-[#3A7D7C]"><Phone className="w-3 h-3" />{c.phone}</a>
                {c.email && <span>{c.email}</span>}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold" role="alert">{error}</p>}
        {!c ? (!error && <p className="text-[#64748B]">Loading…</p>) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#D7E5E8] p-3"><p className="text-xs text-[#64748B] font-semibold">Orders</p><p className="text-xl font-extrabold tabular-nums">{c.orders_count}</p></div>
              <div className="rounded-xl border border-[#D7E5E8] p-3"><p className="text-xs text-[#64748B] font-semibold">Spent</p><p className="text-xl font-extrabold tabular-nums">{inr(c.spent)}</p></div>
            </div>
            <form onSubmit={save} className="space-y-2 rounded-xl bg-slate-50 p-3">
              <h3 className="font-bold flex items-center gap-1.5"><StickyNote className="w-4 h-4 text-[#3A7D7C]" /> Staff notes</h3>
              <label className="block text-xs font-bold">Tags (comma separated)
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="VIP, nut allergy, prefers window" className="mt-1 w-full px-3 py-2 rounded-xl border border-[#D7E5E8] bg-white" />
              </label>
              <label className="block text-xs font-bold">Notes
                <textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-[#D7E5E8] bg-white" />
              </label>
              <div className="flex items-center justify-end gap-3">
                {saved && <span className="text-xs text-emerald-800 font-semibold" role="status">{saved}</span>}
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Save notes'}</button>
              </div>
            </form>
            <section>
              <h3 className="font-bold flex items-center gap-1.5 mb-2"><ShoppingBag className="w-4 h-4 text-[#3A7D7C]" /> Orders</h3>
              {c.orders.length === 0 ? <p className="text-xs text-[#64748B]">No orders yet.</p> : (
                <ul className="divide-y divide-[#EEF3F5] text-xs">
                  {c.orders.map((o) => (
                    <li key={`${o.channel}-${o.id}`} className="py-2 flex justify-between gap-2">
                      <span>
                        <span className="font-mono font-semibold">{o.order_number}</span>
                        <span className="block text-[#64748B]">{fmtDate(o.created_at)} · {o.channel === 'ONLINE' ? `Online${o.order_type ? ` (${String(o.order_type).toLowerCase()})` : ''}` : 'Dine-in / counter'}</span>
                      </span>
                      <span className="text-right">
                        <span className="font-bold tabular-nums block">{inr(o.total_amount)}</span>
                        <span className={`${['CANCELLED', 'REJECTED'].includes(o.status) ? 'text-rose-700' : 'text-[#64748B]'}`}>{STATUS_TEXT[o.status] || String(o.status || '').replace(/_/g, ' ').toLowerCase()}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {c.bookings.length > 0 && (
              <section>
                <h3 className="font-bold flex items-center gap-1.5 mb-2"><CalendarClock className="w-4 h-4 text-[#3A7D7C]" /> Table bookings</h3>
                <ul className="divide-y divide-[#EEF3F5] text-xs">
                  {c.bookings.map((b) => (
                    <li key={b.id} className="py-2 flex justify-between gap-2">
                      <span>{b.reserved_for} · {b.party_size} guests{b.occasion ? ` · ${b.occasion}` : ''}</span>
                      <span className={b.status === 'NO_SHOW' ? 'text-rose-700 font-bold' : 'text-[#64748B]'}>{b.status === 'NO_SHOW' ? 'No-show' : b.status.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminCustomersPage() {
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [sort, setSort] = useState('spent');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ sort, limit: '500' });
    if (search.trim()) p.set('search', search.trim());
    if (segment) p.set('segment', segment);
    api.get(`/admin/customers?${p}`).then((res) => setData(res.data.data)).catch((err) => setError(err.response?.data?.message || 'Could not load customers.'));
  }, [search, segment, sort]);
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const exportXlsx = () => {
    const rows = (data?.customers || []).map((c) => [c.name, c.phone_key, c.orders, c.spent, c.average_order, c.online_orders, c.dine_in_orders, c.bookings, c.no_shows,
      c.first_order_at ? fmtDate(c.first_order_at) : '', c.last_order_at ? fmtDate(c.last_order_at) : '', [...c.segments, ...c.tags].join(', '), c.notes || '']);
    downloadXlsx('customers.xlsx', [{
      name: 'Customers',
      rows: [['Name', 'Mobile', 'Orders', 'Spent (₹)', 'Average order (₹)', 'Online orders', 'Dine-in orders', 'Table bookings', 'No-shows', 'First order', 'Last order', 'Tags', 'Notes'], ...rows]
    }]);
  };

  const s = data?.summary;
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2"><UsersRound className="w-6 h-6 text-[#3A7D7C]" /> Customers</h1>
            <p className="text-xs text-[#64748B]">Everyone who ordered online, at a table or booked a table, matched by mobile number.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
            <button type="button" disabled={!data?.customers?.length} onClick={exportXlsx} className="px-3 py-2 rounded-xl border border-[#D7E5E8] bg-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"><Download className="w-4 h-4" /> Excel</button>
          </div>
        </div>

        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Customers', s.customers.toLocaleString('en-IN')], ['Came back (2+ orders)', s.repeat_customers.toLocaleString('en-IN')], ['New in last 30 days', s.new_last_30_days.toLocaleString('en-IN')], ['Total spent', inr(s.total_spent)]].map(([l, v]) => (
              <div key={l} className="bg-white border border-[#D7E5E8] rounded-2xl p-4"><p className="text-xs font-semibold text-[#64748B]">{l}</p><p className="text-2xl font-extrabold text-[#1F2937] tabular-nums">{v}</p></div>
            ))}
          </div>
        )}

        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-3 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="relative md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <label htmlFor="cust-search" className="sr-only">Search customers</label>
            <input id="cust-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, mobile or tag" className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-sm" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {SEGMENTS.map(([k, l]) => (
              <button key={k || 'all'} type="button" onClick={() => setSegment(k)} aria-pressed={segment === k}
                className={`px-3 py-1.5 rounded-xl border font-bold ${segment === k ? 'bg-[#1F2937] text-white border-[#1F2937]' : 'bg-white border-[#D7E5E8] text-[#1F2937]'}`}>{l}</button>
            ))}
            <label className="flex items-center gap-1 font-bold text-[#475569]">Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-2 py-1.5 rounded-xl border border-[#D7E5E8] bg-white">
                <option value="spent">Most spent</option><option value="orders">Most orders</option><option value="recent">Most recent</option><option value="name">Name</option>
              </select>
            </label>
          </div>
        </div>

        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-x-auto">
          {!data ? <p className="p-6 text-sm text-[#64748B]">Loading…</p> : data.customers.length === 0 ? (
            <p className="p-6 text-sm text-[#64748B]">{search || segment ? 'No customers match.' : 'No customers yet. They appear here after their first order or table booking.'}</p>
          ) : (
            <table className="w-full text-xs">
              <caption className="sr-only">Customers</caption>
              <thead>
                <tr className="text-left text-[#64748B] border-b border-[#D7E5E8]">
                  <th className="py-2 pl-4 pr-2 font-bold">Customer</th><th className="py-2 px-2 font-bold text-right">Orders</th><th className="py-2 px-2 font-bold text-right">Spent</th>
                  <th className="py-2 px-2 font-bold text-right hidden md:table-cell">Avg order</th><th className="py-2 px-2 font-bold hidden sm:table-cell">Last order</th><th className="py-2 pl-2 pr-4 font-bold">Tags</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.phone_key} onClick={() => setOpen(c.phone_key)} className="border-b border-[#EEF3F5] cursor-pointer hover:bg-slate-50">
                    <td className="py-2 pl-4 pr-2">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(c.phone_key); }} className="font-bold text-[#1F2937] hover:underline text-left">{c.name || 'Guest'}</button>
                      <span className="block text-[#64748B] font-mono">{c.phone_key}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{c.orders}{c.bookings ? <span className="block text-[10px] text-[#64748B]">{c.bookings} booking{c.bookings === 1 ? '' : 's'}</span> : null}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{inr(c.spent)}</td>
                    <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell">{inr(c.average_order)}</td>
                    <td className="py-2 px-2 whitespace-nowrap hidden sm:table-cell">{fmtDate(c.last_order_at)}</td>
                    <td className="py-2 pl-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {c.segments.map((t) => <span key={t} className={`px-1.5 py-0.5 rounded-full border font-bold text-[10px] ${SEG_STYLE[t]}`}>{t}</span>)}
                        {c.tags.map((t) => <span key={t} className="px-1.5 py-0.5 rounded-full border border-[#D7E5E8] bg-slate-50 font-bold text-[10px]">{t}</span>)}
                        {c.no_shows > 0 && <span className="px-1.5 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-800 font-bold text-[10px]">{c.no_shows} no-show</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data && data.total > data.customers.length && <p className="text-xs text-[#64748B]">Showing the first {data.customers.length} of {data.total}. Search to narrow down.</p>}
      </div>
      {open && <CustomerDrawer phoneKey={open} onClose={() => setOpen(null)} onSaved={load} />}
    </AdminLayout>
  );
}
