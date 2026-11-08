import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarClock, ChevronLeft, ChevronRight, Plus, RefreshCw, Search, X, Users, Phone, UserPlus,
  Check, Armchair, Flag, Ban, Pencil, AlertTriangle, IndianRupee, Grid2X2
} from 'lucide-react';
import api from '../../../services/api';

/**
 * Restaurant table reservations (REQ-051 / REQ-056): take bookings by phone, walk-in or WhatsApp,
 * see the day's bookings, confirm online requests, seat guests, keep a waitlist and record
 * no-shows. Online bookings from the restaurant page arrive here too.
 */
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const nowIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(11, 16);
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const roundedTime = () => {
  const [h, m] = nowIst().split(':').map(Number);
  const mins = Math.min(23 * 60 + 30, Math.ceil((h * 60 + m + 30) / 30) * 30);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

const TYPES = [
  { key: 'TABLE', label: 'Table booking', minutes: 90 },
  { key: 'CELEBRATION', label: 'Birthday / celebration', minutes: 120 },
  { key: 'PRIVATE_DINING', label: 'Private dining', minutes: 150 },
  { key: 'GROUP_EVENT', label: 'Group / event', minutes: 180 }
];
const SOURCES = [
  { key: 'PHONE', label: 'Phone call' },
  { key: 'WALK_IN', label: 'Walk-in' },
  { key: 'IN_PERSON', label: 'In person' },
  { key: 'WHATSAPP', label: 'WhatsApp' }
];
const STATUS = {
  PENDING: { label: 'To confirm', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  CONFIRMED: { label: 'Confirmed', cls: 'bg-sky-100 text-sky-900 border-sky-300' },
  WAITLIST: { label: 'Waitlist', cls: 'bg-violet-100 text-violet-900 border-violet-300' },
  SEATED: { label: 'Seated', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  COMPLETED: { label: 'Completed', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200 line-through' },
  NO_SHOW: { label: 'No-show', cls: 'bg-rose-100 text-rose-900 border-rose-300' }
};
const FILTERS = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PENDING', label: 'To confirm' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'SEATED', label: 'Seated' },
  { key: 'WAITLIST', label: 'Waitlist' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CLOSED', label: 'Cancelled / no-show' },
  { key: 'ALL', label: 'All' }
];
const inputCls = 'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-amber-500';

function Field({ label, htmlFor, children, hint }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

/** Tables at a time with free / busy; tick the ones to use. */
function TablePicker({ date, time, partySize, bookingType, duration, excludeId, value, onChange, onTouched, autoPick }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!date || !time) return undefined;
    setError('');
    const t = setTimeout(() => {
      const p = new URLSearchParams({ date, time, party_size: partySize || 2, booking_type: bookingType || 'TABLE' });
      if (duration) p.set('duration_minutes', duration);
      if (excludeId) p.set('exclude_id', excludeId);
      api.get(`/table-reservations/availability?${p}`)
        .then((res) => {
          setData(res.data);
          if (autoPick) onChange(res.data.suggested_table_ids || []);
        })
        .catch((err) => setError(err.message));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, partySize, bookingType, duration, excludeId]);

  if (error) return <p className="text-xs text-rose-700 font-semibold">{error}</p>;
  if (!data) return <p className="text-xs text-slate-500">Checking tables…</p>;
  const seats = data.tables.filter((t) => value.includes(t.id)).reduce((s, t) => s + t.capacity, 0);
  const toggle = (id) => {
    if (onTouched) onTouched();
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        {fmtTime(data.time)}–{fmtTime(data.end_time)} · {data.free_count} of {data.tables.length} tables free
        {value.length > 0 && <> · selected seat <strong className={seats < partySize ? 'text-rose-700' : 'text-emerald-700'}>{seats}</strong> for {partySize}</>}
      </p>
      {data.tables.length === 0 ? (
        <p className="text-xs text-slate-500">No tables yet. Add tables under <Link to="/admin/offline/tables" className="font-bold text-amber-700 underline">Table Management</Link>.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
          {data.tables.map((t) => {
            const on = value.includes(t.id);
            return (
              <button key={t.id} type="button" disabled={!t.free && !on} onClick={() => toggle(t.id)} aria-pressed={on}
                className={`text-left p-2 rounded-xl border text-xs transition ${on ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-400' : t.free ? 'border-slate-200 bg-white hover:border-amber-400' : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'}`}>
                <span className="font-black text-slate-900 block">{t.table_number} <span className="font-semibold text-slate-500">· {t.capacity} seats</span></span>
                <span className="block truncate">{t.free ? `${t.floor || ''}${t.table_type && t.table_type !== 'STANDARD' ? ` · ${t.table_type.toLowerCase()}` : ''}` : t.busy_reason}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookingForm({ initial, defaultDate, waitlist, onClose, onSaved }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(() => ({
    customer_name: initial?.customer_name || '',
    customer_phone: initial?.customer_phone || '',
    customer_email: initial?.customer_email || '',
    party_size: initial?.party_size || 2,
    booking_type: initial?.booking_type || 'TABLE',
    source: initial?.source && initial.source !== 'ONLINE' ? initial.source : (waitlist ? 'WALK_IN' : 'PHONE'),
    date: initial?.date || defaultDate || todayIst(),
    time: initial?.time || roundedTime(),
    duration_minutes: initial?.duration_minutes || 90,
    occasion: initial?.occasion || '',
    special_requests: initial?.special_requests || '',
    internal_notes: initial?.internal_notes || '',
    deposit_amount: initial?.deposit_amount || '',
    deposit_method: initial?.deposit_method || 'UPI',
    deposit_reference: initial?.deposit_reference || ''
  }));
  const [tableIds, setTableIds] = useState(() => (initial?.tables || []).map((t) => t.id));
  const [touchedTables, setTouchedTables] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setType = (e) => {
    const type = TYPES.find((t) => t.key === e.target.value);
    setForm((f) => ({ ...f, booking_type: type.key, duration_minutes: editing ? f.duration_minutes : type.minutes }));
  };
  const seated = initial?.status === 'SEATED';

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...form, party_size: Number(form.party_size), duration_minutes: Number(form.duration_minutes) };
      if (waitlist) body.status = 'WAITLIST';
      else if (touchedTables || !editing) body.table_ids = tableIds; // editing: only when the staff changed them
      const res = editing
        ? await api.put(`/table-reservations/${initial.id}`, body)
        : await api.post('/table-reservations', body);
      onSaved(res.message, res.data);
    } catch (err) {
      const alt = err.response?.data?.alternatives;
      setError(`${err.message}${alt && alt.length ? ` Free: ${alt.map(fmtTime).join(', ')}.` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tr-form-title">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="tr-form-title" className="text-lg font-black text-slate-900">
            {editing ? `Change booking ${initial.reservation_code}` : waitlist ? 'Add walk-in to the waitlist' : 'New table booking'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Guest name" htmlFor="tr-name"><input id="tr-name" required minLength={2} value={form.customer_name} onChange={set('customer_name')} className={inputCls} autoComplete="off" /></Field>
          <Field label="Mobile number" htmlFor="tr-phone"><input id="tr-phone" required type="tel" value={form.customer_phone} onChange={set('customer_phone')} className={inputCls} autoComplete="off" /></Field>
          <Field label="Guests" htmlFor="tr-party"><input id="tr-party" required type="number" min={1} max={200} value={form.party_size} onChange={set('party_size')} className={inputCls} /></Field>
          <Field label="Booking type" htmlFor="tr-type">
            <select id="tr-type" value={form.booking_type} onChange={setType} className={inputCls}>
              {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          {!waitlist && !seated && (
            <>
              <Field label="Date" htmlFor="tr-date"><input id="tr-date" required type="date" value={form.date} onChange={set('date')} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Time" htmlFor="tr-time"><input id="tr-time" required type="time" step={900} value={form.time} onChange={set('time')} className={inputCls} /></Field>
                <Field label="Length (min)" htmlFor="tr-dur"><input id="tr-dur" type="number" min={30} max={720} step={15} value={form.duration_minutes} onChange={set('duration_minutes')} className={inputCls} /></Field>
              </div>
            </>
          )}
          <Field label="Booked by" htmlFor="tr-source">
            <select id="tr-source" value={form.source} onChange={set('source')} className={inputCls} disabled={editing}>
              {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Email (optional)" htmlFor="tr-email"><input id="tr-email" type="email" value={form.customer_email} onChange={set('customer_email')} className={inputCls} /></Field>
        </div>

        {!waitlist && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700">Tables {editing ? '' : '(best fit picked for you, change if needed)'}</h3>
            <TablePicker
              date={seated ? initial.date : form.date} time={seated ? initial.time : form.time} partySize={Number(form.party_size) || 1}
              bookingType={form.booking_type} duration={form.duration_minutes} excludeId={initial?.id}
              value={tableIds} onChange={(ids) => setTableIds(ids)} onTouched={() => setTouchedTables(true)} autoPick={!editing && !touchedTables}
            />
            {editing && <p className="text-[11px] text-slate-500">Leave the tables as they are to keep them; they are re-picked only if they no longer fit.</p>}
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Occasion" htmlFor="tr-occ"><input id="tr-occ" value={form.occasion} onChange={set('occasion')} placeholder="Birthday, anniversary…" className={inputCls} /></Field>
          <Field label="Guest's requests" htmlFor="tr-req"><input id="tr-req" value={form.special_requests} onChange={set('special_requests')} placeholder="High chair, window seat…" className={inputCls} /></Field>
          <Field label="Staff notes (guest never sees)" htmlFor="tr-notes"><input id="tr-notes" value={form.internal_notes} onChange={set('internal_notes')} className={inputCls} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Deposit ₹" htmlFor="tr-dep"><input id="tr-dep" type="number" min={0} step="0.01" value={form.deposit_amount} onChange={set('deposit_amount')} className={inputCls} /></Field>
            <Field label="Paid by" htmlFor="tr-depm">
              <select id="tr-depm" value={form.deposit_method} onChange={set('deposit_method')} className={inputCls}>
                {['UPI', 'CASH', 'CARD', 'BANK'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Ref." htmlFor="tr-depr"><input id="tr-depr" value={form.deposit_reference} onChange={set('deposit_reference')} className={inputCls} /></Field>
          </div>
        </div>

        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-bold text-sm">Close</button>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save changes' : waitlist ? 'Add to waitlist' : 'Book table'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Seat a waitlist guest (or a booking without tables): choose tables free right now. */
function SeatDialog({ reservation, onClose, onDone }) {
  const [ids, setIds] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const seat = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/table-reservations/${reservation.id}/status`, { status: 'SEATED', table_ids: ids });
      onDone(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const date = reservation.status === 'WAITLIST' ? todayIst() : reservation.date;
  const time = reservation.status === 'WAITLIST' ? nowIst() : reservation.time;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tr-seat-title">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="tr-seat-title" className="text-lg font-black text-slate-900">Seat {reservation.customer_name} ({reservation.party_size})</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <TablePicker date={date} time={time} partySize={reservation.party_size} bookingType={reservation.booking_type}
          duration={reservation.duration_minutes} excludeId={reservation.id} value={ids} onChange={setIds} autoPick />
        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold text-sm">Close</button>
          <button type="button" onClick={seat} disabled={saving || ids.length === 0} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm disabled:opacity-50">{saving ? 'Seating…' : 'Seat guests'}</button>
        </div>
      </div>
    </div>
  );
}

function ReasonDialog({ reservation, status, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const noShow = status === 'NO_SHOW';
  const go = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/table-reservations/${reservation.id}/status`, { status, reason });
      onDone(res.message);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tr-reason-title">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3 shadow-xl">
        <h2 id="tr-reason-title" className="text-lg font-black text-slate-900">{noShow ? 'Mark as no-show' : 'Cancel booking'} {reservation.reservation_code}</h2>
        <p className="text-sm text-slate-600">{reservation.customer_name} · {reservation.party_size} guests · {fmtTime(reservation.time)}. Its tables are freed.</p>
        <Field label="Reason (optional)" htmlFor="tr-reason"><input id="tr-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder={noShow ? 'Did not arrive' : 'Guest called to cancel'} /></Field>
        {error && <p className="text-sm text-rose-700 font-semibold" role="alert">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold text-sm">Keep booking</button>
          <button type="button" onClick={go} disabled={saving} className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-black text-sm disabled:opacity-50">{noShow ? 'Mark no-show' : 'Cancel booking'}</button>
        </div>
      </div>
    </div>
  );
}

function ReservationRow({ r, onAction, showDate }) {
  const s = STATUS[r.status] || STATUS.CONFIRMED;
  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition';
  return (
    <li className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(r.status) ? 'opacity-70' : ''}`}>
      <div className="sm:w-24 shrink-0 flex sm:flex-col items-baseline sm:items-start gap-2 sm:gap-0">
        {showDate && r.status !== 'WAITLIST' && <span className="text-[11px] font-bold text-amber-800">{new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>}
        <span className="text-lg font-black text-slate-900 tabular-nums">{r.status === 'WAITLIST' ? 'Now' : fmtTime(r.time)}</span>
        <span className="text-[11px] text-slate-500">{r.status === 'WAITLIST' ? `added ${fmtTime(r.time)}` : `${r.duration_minutes} min`}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black text-slate-900">{r.customer_name}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
          {r.is_late && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">Late</span>}
          {r.booking_type !== 'TABLE' && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{r.booking_type_label}</span>}
          {r.source === 'ONLINE' && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">Online</span>}
        </div>
        <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {r.party_size} guests</span>
          <a href={`tel:${r.customer_phone}`} className="inline-flex items-center gap-1 hover:text-amber-700"><Phone className="w-3.5 h-3.5" /> {r.customer_phone}</a>
          <span className="inline-flex items-center gap-1"><Grid2X2 className="w-3.5 h-3.5" /> {r.tables.length ? r.tables.map((t) => t.table_number).join(' + ') : 'No table yet'}</span>
          <span className="font-mono text-[11px] text-slate-500">{r.reservation_code}</span>
        </p>
        {(r.occasion || r.special_requests || r.internal_notes || r.deposit_amount > 0 || r.guest_visits > 0 || r.guest_no_shows > 0 || r.cancel_reason) && (
          <p className="text-xs text-slate-700 flex flex-wrap gap-x-3 gap-y-1">
            {r.occasion && <span>🎉 {r.occasion}</span>}
            {r.special_requests && <span>“{r.special_requests}”</span>}
            {r.internal_notes && <span className="text-slate-500">Note: {r.internal_notes}</span>}
            {r.deposit_amount > 0 && <span className="inline-flex items-center gap-0.5 text-emerald-800 font-semibold"><IndianRupee className="w-3 h-3" />{r.deposit_amount.toLocaleString('en-IN')} deposit{r.deposit_method ? ` (${r.deposit_method})` : ''}</span>}
            {r.guest_visits > 0 && <span className="text-emerald-800 font-semibold">{r.guest_visits} earlier visit{r.guest_visits === 1 ? '' : 's'}</span>}
            {r.guest_no_shows > 0 && <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><AlertTriangle className="w-3 h-3" />{r.guest_no_shows} no-show{r.guest_no_shows === 1 ? '' : 's'} before</span>}
            {r.cancel_reason && <span className="text-slate-500">{r.cancel_reason}</span>}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 sm:justify-end sm:max-w-[260px]">
        {r.status === 'PENDING' && <button type="button" onClick={() => onAction('CONFIRMED', r)} className={`${btn} bg-sky-600 text-white hover:bg-sky-700`}><Check className="w-3.5 h-3.5" /> Confirm</button>}
        {['CONFIRMED', 'WAITLIST'].includes(r.status) && <button type="button" onClick={() => onAction('SEATED', r)} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}><Armchair className="w-3.5 h-3.5" /> Seat</button>}
        {r.status === 'SEATED' && <button type="button" onClick={() => onAction('COMPLETED', r)} className={`${btn} bg-slate-800 text-white hover:bg-slate-900`}><Flag className="w-3.5 h-3.5" /> Done</button>}
        {['PENDING', 'CONFIRMED', 'WAITLIST', 'SEATED'].includes(r.status) && <button type="button" onClick={() => onAction('EDIT', r)} className={`${btn} bg-slate-100 text-slate-800 hover:bg-slate-200`}><Pencil className="w-3.5 h-3.5" /> Change</button>}
        {r.status === 'CONFIRMED' && <button type="button" onClick={() => onAction('NO_SHOW', r)} className={`${btn} bg-slate-100 text-rose-700 hover:bg-rose-50`}>No-show</button>}
        {['PENDING', 'CONFIRMED', 'WAITLIST'].includes(r.status) && <button type="button" onClick={() => onAction('CANCELLED', r)} className={`${btn} bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700`}><Ban className="w-3.5 h-3.5" /> Cancel</button>}
      </div>
    </li>
  );
}

export default function TableReservationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // day = one date; week = next 7 days; requests = online requests waiting for confirmation
  const [view, setViewState] = useState(['requests', 'week'].includes(searchParams.get('view')) ? searchParams.get('view') : 'day');
  const setView = (v) => {
    setViewState(v);
    const next = new URLSearchParams(searchParams);
    if (v === 'day') next.delete('view'); else next.set('view', v);
    setSearchParams(next, { replace: true });
  };
  const [bookingSummary, setBookingSummary] = useState(null);
  const [date, setDate] = useState(todayIst());
  const [filter, setFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null); // { initial?, waitlist? }
  const [seat, setSeat] = useState(null);
  const [reason, setReason] = useState(null); // { reservation, status }

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const today = todayIst();
      const p = view === 'day' ? new URLSearchParams({ date })
        : view === 'week' ? new URLSearchParams({ from: today, to: addDays(today, 6) })
          : new URLSearchParams({ from: today, to: addDays(today, 60), status: 'PENDING' });
      if (search.trim()) p.set('search', search.trim());
      const [res, sum] = await Promise.all([
        api.get(`/table-reservations?${p}`),
        api.get('/table-reservations/summary').catch(() => null)
      ]);
      setData(res.data);
      if (sum?.data) setBookingSummary(sum.data);
    } catch (err) {
      setError(err.message || 'Could not load bookings.');
    } finally {
      setLoading(false);
    }
  }, [date, search, view]);

  useEffect(() => {
    const t = setTimeout(() => load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  useEffect(() => {
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [load]);

  const list = useMemo(() => {
    const all = data?.reservations || [];
    if (filter === 'ALL') return all;
    if (filter === 'ACTIVE') return all.filter((r) => ['PENDING', 'CONFIRMED', 'WAITLIST', 'SEATED'].includes(r.status));
    if (filter === 'CLOSED') return all.filter((r) => ['CANCELLED', 'NO_SHOW'].includes(r.status));
    return all.filter((r) => r.status === filter);
  }, [data, filter]);
  const counts = data?.summary?.by_status || {};

  const done = (message) => {
    setForm(null);
    setSeat(null);
    setReason(null);
    setNotice(message || 'Saved');
    load(true);
    window.dispatchEvent(new Event('hms_bookings_changed')); // sidebar badge
  };

  const onAction = async (action, r) => {
    setNotice('');
    if (action === 'EDIT') return setForm({ initial: r });
    if (action === 'CANCELLED' || action === 'NO_SHOW') return setReason({ reservation: r, status: action });
    if (action === 'SEATED' && (r.status === 'WAITLIST' || r.tables.length === 0)) return setSeat(r);
    try {
      const res = await api.post(`/table-reservations/${r.id}/status`, { status: action });
      done(res.message);
    } catch (err) {
      if (action === 'SEATED') setSeat(r); // tables taken: let staff choose others
      else setError(err.message);
    }
    return undefined;
  };

  const isToday = date === todayIst();
  return (
    <div className="space-y-5">
      <div className="bg-white border border-blue-100 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-amber-600" /> Table Bookings
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">Bookings by phone, walk-in and online. Booked tables show as reserved on the floor an hour before.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => load()} className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700" title="Refresh" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
          <button type="button" onClick={() => { setNotice(''); setForm({ waitlist: true }); }} className="py-2.5 px-3.5 rounded-xl bg-violet-100 text-violet-900 border border-violet-200 font-bold text-xs flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Walk-in waitlist</button>
          <button type="button" onClick={() => { setNotice(''); setForm({}); }} className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5"><Plus className="w-4 h-4 stroke-[3]" /> New booking</button>
        </div>
      </div>

      {bookingSummary?.pending_requests > 0 && view !== 'requests' && (
        <div className="p-3 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="status">
          <p className="text-sm font-bold text-amber-900">
            {bookingSummary.pending_requests} booking request{bookingSummary.pending_requests === 1 ? '' : 's'} waiting for you to confirm
            <span className="block text-xs font-semibold text-amber-800">Guests booked online. Confirm or cancel so they know where they stand.</span>
          </p>
          <button type="button" onClick={() => setView('requests')} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0">Show requests</button>
        </div>
      )}
      {bookingSummary && !bookingSummary.has_tables && (
        <p className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold">
          You haven't set up tables yet. Bookings still come in (online ones as requests for you to confirm). Add your tables in <Link to="/admin/offline/tables" className="underline font-bold">Table Management</Link> to assign them and stop double bookings.
        </p>
      )}

      <div className="bg-white border border-blue-100 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Which bookings">
          {[['day', 'One day'], ['week', 'Next 7 days'], ['requests', `Requests to confirm${bookingSummary?.pending_requests ? ` (${bookingSummary.pending_requests})` : ''}`]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${view === k ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className={`flex items-center gap-2 ${view !== 'day' ? 'hidden' : ''}`}>
            <button type="button" onClick={() => setDate(addDays(date, -1))} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200" aria-label="Previous day"><ChevronLeft className="w-4 h-4" /></button>
            <label className="sr-only" htmlFor="tr-day">Day</label>
            <input id="tr-day" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold" />
            <button type="button" onClick={() => setDate(addDays(date, 1))} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200" aria-label="Next day"><ChevronRight className="w-4 h-4" /></button>
            {!isToday && <button type="button" onClick={() => setDate(todayIst())} className="px-3 py-2 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-50">Today</button>}
          </div>
          <div className="relative md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <label className="sr-only" htmlFor="tr-search">Search bookings</label>
            <input id="tr-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or booking code" className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
          </div>
        </div>
        <p className="text-sm font-bold text-slate-800">
          {view === 'week' ? 'Next 7 days' : view === 'requests' ? 'Online requests waiting for confirmation' : <>{fmtDay(date)}{isToday ? ' · today' : ''}</>}
          {data && <span className="font-semibold text-slate-600"> · {data.summary.bookings} booking{data.summary.bookings === 1 ? '' : 's'}, {data.summary.guests} guests{counts.WAITLIST ? ` · ${counts.WAITLIST} waiting` : ''}</span>}
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Booking status">
          {FILTERS.map((f) => {
            const n = f.key === 'ACTIVE' ? (counts.PENDING || 0) + (counts.CONFIRMED || 0) + (counts.WAITLIST || 0) + (counts.SEATED || 0)
              : f.key === 'CLOSED' ? (counts.CANCELLED || 0) + (counts.NO_SHOW || 0)
                : f.key === 'ALL' ? (data?.reservations || []).length : (counts[f.key] || 0);
            return (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'}`}>
                {f.label} <span className={filter === f.key ? 'text-amber-300' : 'text-slate-500'}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {notice && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center gap-2" role="status"><Check className="w-4 h-4" /> {notice}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</div>}

      <section className="bg-white border border-blue-100 rounded-2xl shadow-sm">
        {loading && !data ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading bookings…</p>
        ) : list.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CalendarClock className="w-8 h-8 text-amber-600 mx-auto" />
            <p className="font-bold text-slate-900">{view === 'requests' ? 'No requests waiting' : view === 'week' ? 'No bookings in the next 7 days' : filter === 'ACTIVE' ? 'No bookings for this day yet' : 'Nothing here'}</p>
            <p className="text-xs text-slate-600">Use “New booking” for phone bookings. Online bookings from your restaurant page show up here by themselves.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((r) => <ReservationRow key={r.id} r={r} onAction={onAction} showDate={view !== 'day'} />)}
          </ul>
        )}
      </section>

      {form && <BookingForm initial={form.initial} waitlist={form.waitlist} defaultDate={date} onClose={() => setForm(null)} onSaved={(msg, saved) => { if (saved?.date && saved.date !== date) setDate(saved.date); done(msg); }} />}
      {seat && <SeatDialog reservation={seat} onClose={() => setSeat(null)} onDone={done} />}
      {reason && <ReasonDialog reservation={reason.reservation} status={reason.status} onClose={() => setReason(null)} onDone={done} />}
    </div>
  );
}
