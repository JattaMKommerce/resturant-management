import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Search, Ban, LogIn, Pencil, X, Lock } from 'lucide-react';
import api from '../../services/api';

/**
 * Reservations (REQ-041) and room availability (REQ-042): book, change, cancel and check in
 * reservations; see every room's state for any dates; block rooms.
 */
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const nights = (a, b) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000));
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—');

const STATE_STYLE = {
  AVAILABLE: { label: 'Available', cls: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
  RESERVED: { label: 'Reserved', cls: 'bg-sky-50 border-sky-300 text-sky-800' },
  OCCUPIED: { label: 'Occupied', cls: 'bg-rose-50 border-rose-300 text-rose-800' },
  BLOCKED: { label: 'Blocked', cls: 'bg-slate-100 border-slate-300 text-slate-700' },
  MAINTENANCE: { label: 'Maintenance', cls: 'bg-orange-50 border-orange-300 text-orange-800' },
  CLEANING: { label: 'Cleaning', cls: 'bg-violet-50 border-violet-300 text-violet-800' }
};
const LIST_FILTERS = [
  { key: 'CONFIRMED', label: 'Upcoming' },
  { key: 'CHECKED_IN', label: 'In house' },
  { key: 'CHECKED_OUT', label: 'Past' },
  { key: 'CANCELLED', label: 'Cancelled' }
];
const inputCls = 'w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]';

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block font-bold text-[#1F2937] mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReservationForm({ rooms, initial, onClose, onSaved }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({
    room_id: initial?.room_id || '', check_in_date: String(initial?.check_in_date || todayIst()).slice(0, 10),
    check_out_date: String(initial?.check_out_date || addDays(todayIst(), 1)).slice(0, 10),
    guest_name: initial?.guest_name || '', guest_phone: initial?.guest_phone || '', guest_email: initial?.guest_email || '',
    adults: initial?.adults || 2, children: initial?.children || 0, advance_amount: initial?.advance_amount || '', notes: initial?.notes || ''
  });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setQuote(null);
    if (!form.room_id || !form.check_in_date || !form.check_out_date || form.check_out_date <= form.check_in_date) return undefined;
    const t = setTimeout(() => {
      api.get(`/rooms/${form.room_id}/quote?from=${form.check_in_date}&to=${form.check_out_date}`)
        .then((res) => setQuote(res.data))
        .catch(() => setQuote(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.room_id, form.check_in_date, form.check_out_date]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...form, from_inquiry_id: initial?.from_inquiry_id };
      if (editing) await api.put(`/rooms/reservations/${initial.id}`, body);
      else await api.post('/rooms/reservations', body);
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not save the reservation.');
    } finally {
      setSaving(false);
    }
  };

  const conflictText = quote && !quote.available && (!editing || quote.conflict?.detail?.id !== initial?.id)
    ? `Not available: ${quote.conflict.type === 'RESERVED' ? `reserved for ${quote.conflict.detail.guest_name}` : quote.conflict.type.toLowerCase()}`
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="res-title">
      <form onSubmit={submit} className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xl space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h2 id="res-title" className="text-sm font-extrabold text-[#1F2937]">{editing ? 'Change reservation' : 'New reservation'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold" role="alert">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Check-in" htmlFor="res-in"><input id="res-in" type="date" required value={form.check_in_date} min={editing ? undefined : todayIst()} onChange={set('check_in_date')} className={inputCls} /></Field>
          <Field label="Check-out" htmlFor="res-out"><input id="res-out" type="date" required value={form.check_out_date} min={addDays(form.check_in_date, 1)} onChange={set('check_out_date')} className={inputCls} /></Field>
          <Field label="Room" htmlFor="res-room">
            <select id="res-room" required value={form.room_id} onChange={set('room_id')} className={inputCls}>
              <option value="">Choose…</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.room_number} · {r.room_type}{r.state && r.state !== 'AVAILABLE' ? ` (${STATE_STYLE[r.state]?.label.toLowerCase()})` : ''}</option>)}
            </select>
          </Field>
        </div>
        {conflictText && <p className="text-rose-700 font-semibold" role="alert">{conflictText}</p>}
        {quote && (
          <div className="p-3 rounded-xl bg-slate-50 border border-[#D7E5E8] space-y-1">
            <p className="font-bold text-[#1F2937]">{quote.nights_count} night{quote.nights_count === 1 ? '' : 's'} · {inr(quote.subtotal)} + GST {inr(quote.tax)} = <span className="text-[#2F6665]">{inr(quote.total)}</span></p>
            <p className="text-[#64748B]">{quote.nights.map((n) => `${fmt(n.date)} ${inr(n.rate)}${n.rule ? ` (${n.rule})` : ''}`).join(' · ')}</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Guest name" htmlFor="res-name"><input id="res-name" required value={form.guest_name} onChange={set('guest_name')} className={inputCls} /></Field>
          <Field label="Mobile number" htmlFor="res-phone"><input id="res-phone" required type="tel" value={form.guest_phone} onChange={set('guest_phone')} className={inputCls} /></Field>
          <Field label="Email" htmlFor="res-email"><input id="res-email" type="email" value={form.guest_email} onChange={set('guest_email')} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adults" htmlFor="res-adults"><input id="res-adults" type="number" min="1" value={form.adults} onChange={set('adults')} className={inputCls} /></Field>
            <Field label="Children" htmlFor="res-kids"><input id="res-kids" type="number" min="0" value={form.children} onChange={set('children')} className={inputCls} /></Field>
          </div>
          <Field label="Advance received (₹)" htmlFor="res-adv"><input id="res-adv" type="number" min="0" step="1" value={form.advance_amount} onChange={set('advance_amount')} placeholder="0" className={inputCls} /></Field>
          <Field label="Notes" htmlFor="res-notes"><input id="res-notes" value={form.notes} onChange={set('notes')} placeholder="Arrival time, requests…" className={inputCls} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancel</button>
          <button type="submit" disabled={saving || Boolean(conflictText)} className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Confirm reservation'}</button>
        </div>
      </form>
    </div>
  );
}

function CheckInDialog({ reservation, onClose, onDone }) {
  const [form, setForm] = useState({ id_proof_type: 'AADHAAR', id_proof_number: '', guest_address: '', company_gstin: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/rooms/reservations/${reservation.id}/check-in`, form);
      onDone();
    } catch (err) {
      setError(err.message || 'Could not check in.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="ci-title">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xl space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <h2 id="ci-title" className="text-sm font-extrabold">Check in {reservation.guest_name} · Room {reservation.room_number}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold" role="alert">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID proof" htmlFor="ci-idt">
            <select id="ci-idt" value={form.id_proof_type} onChange={set('id_proof_type')} className={inputCls}>
              {['AADHAAR', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'PAN', 'OTHER'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="ID number" htmlFor="ci-idn"><input id="ci-idn" required value={form.id_proof_number} onChange={set('id_proof_number')} className={inputCls} /></Field>
        </div>
        <Field label="Address" htmlFor="ci-addr"><input id="ci-addr" value={form.guest_address} onChange={set('guest_address')} className={inputCls} /></Field>
        <Field label="Company GSTIN (for a business invoice)" htmlFor="ci-gst"><input id="ci-gst" value={form.company_gstin} onChange={(e) => setForm((f) => ({ ...f, company_gstin: e.target.value.toUpperCase() }))} maxLength={15} className={`${inputCls} font-mono`} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold disabled:opacity-50">{saving ? 'Checking in…' : 'Check in'}</button>
        </div>
      </form>
    </div>
  );
}

export default function ReservationsTab({ onChanged }) {
  const [from, setFrom] = useState(todayIst());
  const [to, setTo] = useState(addDays(todayIst(), 1));
  const [board, setBoard] = useState(null);
  const [filter, setFilter] = useState('CONFIRMED');
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [checkingIn, setCheckingIn] = useState(null);
  const [blockForm, setBlockForm] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadBoard = useCallback(() => {
    if (!from || !to || to <= from) return;
    api.get(`/rooms/availability?from=${from}&to=${to}`).then((res) => setBoard(res.data)).catch((err) => setError(err.message));
  }, [from, to]);
  const loadList = useCallback(() => {
    const params = new URLSearchParams({ status: filter });
    if (search.trim()) params.set('q', search.trim());
    api.get(`/rooms/reservations?${params}`).then((res) => setList(res.data.reservations || [])).catch((err) => setError(err.message));
  }, [filter, search]);
  const loadBlocks = useCallback(() => {
    api.get('/rooms/blocks').then((res) => setBlocks(res.data.blocks || [])).catch(() => {});
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const refreshAll = (msg) => {
    setMessage(msg || '');
    setEditing(null);
    setCheckingIn(null);
    setBlockForm(null);
    loadBoard(); loadList(); loadBlocks();
    if (typeof onChanged === 'function') onChanged();
  };

  const act = async (fn, msg) => {
    setError('');
    try { await fn(); refreshAll(msg); } catch (err) { setError(err.message || 'Something went wrong.'); }
  };

  const roomsForForm = useMemo(() => (board?.rooms || []), [board]);

  return (
    <div className="space-y-5 text-xs">
      {message && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold" role="status">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold" role="alert">{error}</div>}

      {/* Availability board */}
      <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-extrabold text-[#1F2937] flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#3A7D7C]" /> Room availability</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 font-semibold text-[#64748B]">From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to <= e.target.value) setTo(addDays(e.target.value, 1)); }} className="p-2 border border-[#D7E5E8] rounded-xl" /></label>
            <label className="flex flex-col gap-0.5 font-semibold text-[#64748B]">To<input type="date" value={to} min={addDays(from, 1)} onChange={(e) => setTo(e.target.value)} className="p-2 border border-[#D7E5E8] rounded-xl" /></label>
            <button type="button" onClick={() => setEditing({ check_in_date: from, check_out_date: to })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold"><Plus className="w-3.5 h-3.5" /> New reservation</button>
            <button type="button" onClick={() => setBlockForm({ room_id: '', from_date: from, to_date: to, reason: '' })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] font-bold"><Lock className="w-3.5 h-3.5" /> Block a room</button>
          </div>
        </div>
        {board && (
          <>
            <p className="text-[#64748B]">{nights(from, to)} night{nights(from, to) === 1 ? '' : 's'} · {Object.entries(board.counts || {}).map(([k, v]) => `${v} ${STATE_STYLE[k]?.label.toLowerCase() || k}`).join(' · ')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {board.rooms.map((r) => {
                const st = STATE_STYLE[r.state] || STATE_STYLE.AVAILABLE;
                return (
                  <button key={r.id} type="button" disabled={r.state !== 'AVAILABLE'}
                    onClick={() => setEditing({ room_id: r.id, check_in_date: from, check_out_date: to })}
                    className={`text-left p-2.5 rounded-xl border ${st.cls} disabled:cursor-default enabled:hover:shadow-sm`}
                    title={r.state === 'AVAILABLE' ? 'Book this room' : undefined}>
                    <span className="block font-extrabold">Room {r.room_number}</span>
                    <span className="block opacity-80 truncate">{r.room_type}</span>
                    <span className="block font-bold mt-1">{st.label}</span>
                    {r.detail?.guest_name && <span className="block truncate">{r.detail.guest_name}</span>}
                    {r.detail?.reason && <span className="block truncate">{r.detail.reason}</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Reservations list */}
      <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Reservation status">
            {LIST_FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl font-bold border ${filter === f.key ? 'bg-[#3A7D7C] text-white border-[#3A7D7C]' : 'bg-white border-[#D7E5E8]'}`}>{f.label}</button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Search reservations</span>
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Guest, phone or room" className="pl-8 pr-2 py-2 border border-[#D7E5E8] rounded-xl" />
          </label>
        </div>
        {list.length === 0 ? (
          <p className="text-[#64748B] py-6 text-center">No reservations here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-[#64748B]"><tr>
                <th className="py-2 pr-3">Guest</th><th className="py-2 pr-3">Room</th><th className="py-2 pr-3">Stay</th>
                <th className="py-2 pr-3 text-right">Total</th><th className="py-2 pr-3 text-right">Advance</th><th className="py-2"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody className="divide-y divide-[#EEF3F5]">
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3"><div className="font-bold text-[#1F2937]">{r.guest_name}</div><div className="text-[#64748B]">{r.guest_phone}</div></td>
                    <td className="py-2.5 pr-3">Room {r.room_number}<div className="text-[#64748B]">{r.room_type}</div></td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{fmt(r.check_in_date)} → {fmt(r.check_out_date)}<div className="text-[#64748B]">{nights(String(r.check_in_date).slice(0, 10), String(r.check_out_date).slice(0, 10))} nights · {r.adults || 1}+{r.children || 0} guests</div></td>
                    <td className="py-2.5 pr-3 text-right font-mono">{r.grand_total ? inr(r.grand_total) : '—'}</td>
                    <td className="py-2.5 pr-3 text-right font-mono">{Number(r.advance_amount) > 0 ? inr(r.advance_amount) : '—'}</td>
                    <td className="py-2.5 text-right whitespace-nowrap space-x-1">
                      {r.status === 'CONFIRMED' && (
                        <>
                          <button type="button" onClick={() => setCheckingIn(r)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3A7D7C] text-white font-bold"><LogIn className="w-3 h-3" /> Check in</button>
                          <button type="button" onClick={() => setEditing(r)} aria-label="Change" className="p-1.5 rounded-lg border border-[#D7E5E8]"><Pencil className="w-3 h-3" /></button>
                          <button type="button" onClick={() => { const reason = window.prompt('Reason for cancelling?', 'Guest cancelled'); if (reason !== null) act(() => api.post(`/rooms/reservations/${r.id}/cancel`, { reason }), 'Reservation cancelled.'); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 font-bold"><Ban className="w-3 h-3" /> Cancel</button>
                          <button type="button" onClick={() => act(() => api.post(`/rooms/reservations/${r.id}/cancel`, { reason: 'Guest did not arrive', no_show: true }), 'Marked as no-show.')} className="px-2.5 py-1.5 rounded-lg border border-[#D7E5E8] font-bold">No-show</button>
                        </>
                      )}
                      {r.status === 'CANCELLED' && r.cancel_reason && <span className="text-[#64748B]">{r.cancel_reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Blocks */}
      {blocks.length > 0 && (
        <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-extrabold text-[#1F2937]">Blocked rooms</h3>
          <ul className="divide-y divide-[#EEF3F5]">
            {blocks.map((b) => (
              <li key={b.id} className="py-2 flex items-center justify-between gap-2">
                <span>Room {b.room_number} · {fmt(b.from_date)} → {fmt(b.to_date)}{b.reason ? ` · ${b.reason}` : ''}</span>
                <button type="button" onClick={() => act(() => api.delete(`/rooms/blocks/${b.id}`), 'Block removed.')} className="font-bold text-[#3A7D7C] hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && <ReservationForm rooms={roomsForForm} initial={editing} onClose={() => setEditing(null)} onSaved={() => refreshAll(editing.id ? 'Reservation updated.' : 'Reservation confirmed.')} />}
      {checkingIn && <CheckInDialog reservation={checkingIn} onClose={() => setCheckingIn(null)} onDone={() => refreshAll(`${checkingIn.guest_name} checked in to Room ${checkingIn.room_number}.`)} />}
      {blockForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="blk-title">
          <form onSubmit={(e) => { e.preventDefault(); act(() => api.post(`/rooms/${blockForm.room_id}/block`, blockForm), 'Room blocked.'); }} className="w-full max-w-md bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="blk-title" className="text-sm font-extrabold">Block a room</h2>
              <button type="button" onClick={() => setBlockForm(null)} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <Field label="Room" htmlFor="blk-room">
              <select id="blk-room" required value={blockForm.room_id} onChange={(e) => setBlockForm((f) => ({ ...f, room_id: e.target.value }))} className={inputCls}>
                <option value="">Choose…</option>
                {roomsForForm.map((r) => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="blk-from"><input id="blk-from" type="date" required value={blockForm.from_date} onChange={(e) => setBlockForm((f) => ({ ...f, from_date: e.target.value }))} className={inputCls} /></Field>
              <Field label="Until (morning of)" htmlFor="blk-to"><input id="blk-to" type="date" required value={blockForm.to_date} min={addDays(blockForm.from_date, 1)} onChange={(e) => setBlockForm((f) => ({ ...f, to_date: e.target.value }))} className={inputCls} /></Field>
            </div>
            <Field label="Reason" htmlFor="blk-reason"><input id="blk-reason" value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Renovation, owner's use…" className={inputCls} /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBlockForm(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold">Block room</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
