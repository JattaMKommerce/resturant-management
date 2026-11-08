import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, Users, Minus, Plus, Phone, Check, ArrowLeft } from 'lucide-react';
import api from '../../api/axios';

/**
 * Customers book a restaurant table (REQ-051 / REQ-056): party size, booking type, day and a free
 * time, then name and mobile. Group events and private dining are sent as requests the restaurant
 * confirms. The confirmation gives a private link to view or cancel the booking.
 */
const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const inputCls = 'w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:border-emerald-600';

export default function TableBookingPage({ overrideSlug }) {
  const params = useParams();
  const slug = overrideSlug || params.slug;
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [party, setParty] = useState(2);
  const [type, setType] = useState('TABLE');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [requestsOnly, setRequestsOnly] = useState(false); // restaurant confirms every booking
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', occasion: '', special_requests: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [booked, setBooked] = useState(null);

  useEffect(() => {
    api.get(`/restaurants/${slug}/table-booking`)
      .then((res) => {
        setInfo(res.data.data);
        setDate(res.data.data.first_date);
      })
      .catch((err) => setLoadError(err.response?.data?.message || 'This restaurant could not be found.'));
  }, [slug]);

  useEffect(() => {
    if (!info?.enabled || !date) return;
    setSlots(null);
    setSlot(null);
    api.get(`/restaurants/${slug}/table-slots?date=${date}&party_size=${party}&booking_type=${type}`)
      .then((res) => { setSlots(res.data.data.slots); setRequestsOnly(Boolean(res.data.data.requests_only)); })
      .catch((err) => { setSlots([]); setError(err.response?.data?.message || 'Could not load times.'); });
  }, [slug, info, date, party, type]);

  useEffect(() => {
    if (info) document.title = `Book a table · ${info.restaurant.name}`;
  }, [info]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const chosenType = info?.booking_types.find((t) => t.key === type);

  const submit = async (e) => {
    e.preventDefault();
    if (!slot) return;
    setSending(true);
    setError('');
    try {
      const res = await api.post(`/restaurants/${slug}/table-reservations`, {
        ...form, party_size: party, booking_type: type, date: slot.date, time: slot.time
      });
      setBooked({ ...res.data.data, message: res.data.message });
      try { localStorage.setItem(`table_booking_${slug}`, res.data.data.manage_token); } catch (_) { /* private mode */ }
    } catch (err) {
      const alt = err.response?.data?.alternatives;
      setError(err.response?.data?.message || 'Could not book. Please call the restaurant.');
      if (alt && alt.length && slots) setSlots(slots.map((s) => (s.date === slot.date && s.time === slot.time ? { ...s, available: false } : s)));
    } finally {
      setSending(false);
    }
  };

  if (loadError) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center text-sm text-slate-700">{loadError}</div>;
  if (!info) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Loading…</div>;
  const r = info.restaurant;
  const menuPath = overrideSlug ? '/' : `/restaurant/${slug}`;

  if (booked) {
    const pending = booked.status === 'PENDING';
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-center">
          <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${pending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {pending ? <CalendarClock className="w-7 h-7" /> : <Check className="w-7 h-7" />}
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">{pending ? 'Request sent' : 'Table booked'}</h1>
          <p className="text-sm text-slate-700">{booked.message}</p>
          <dl className="text-sm text-left bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-y-2">
            <dt className="text-slate-500">Reference</dt><dd className="font-mono font-bold text-right">{booked.reservation_code}</dd>
            <dt className="text-slate-500">When</dt><dd className="font-semibold text-right">{fmtDay(booked.date)}, {fmtTime(booked.time)}</dd>
            <dt className="text-slate-500">Guests</dt><dd className="font-semibold text-right">{booked.party_size}</dd>
            <dt className="text-slate-500">Type</dt><dd className="font-semibold text-right">{booked.booking_type_label}</dd>
          </dl>
          <p className="text-xs text-slate-600">Keep this link to see or cancel your booking:</p>
          <Link to={`/table-booking/${booked.manage_token}`} className="block py-3 rounded-xl bg-slate-900 text-white font-bold text-sm">View my booking</Link>
          <Link to={menuPath} className="block text-sm font-bold text-emerald-700 hover:underline">Back to the menu</Link>
        </div>
      </div>
    );
  }

  const days = [];
  for (let i = 0; i < 14; i += 1) {
    const d = addDays(info.first_date, i);
    if (d <= info.last_date) days.push(d);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <Link to={menuPath} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700"><ArrowLeft className="w-4 h-4" /> {r.name}</Link>
        <header className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><CalendarClock className="w-6 h-6" /></div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight">Book a table</h1>
            <p className="text-sm text-slate-600">{r.name}{r.address ? ` · ${r.address}` : ''}</p>
          </div>
        </header>

        {!info.enabled ? (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-sm">
            <p>Online table booking is not available right now.</p>
            {r.phone && <a href={`tel:${r.phone}`} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold"><Phone className="w-4 h-4" /> Call {r.phone}</a>}
          </section>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-sm flex items-center gap-2" id="party-label"><Users className="w-4 h-4 text-emerald-700" /> Guests</span>
                <div className="flex items-center gap-2" role="group" aria-labelledby="party-label">
                  <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center" aria-label="Fewer guests"><Minus className="w-4 h-4" /></button>
                  <span className="w-8 text-center text-lg font-extrabold tabular-nums" aria-live="polite">{party}</span>
                  <button type="button" onClick={() => setParty((p) => Math.min(info.max_party, p + 1))} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center" aria-label="More guests"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              {party >= info.max_party && r.phone && <p className="text-xs text-slate-600">More than {info.max_party}? Call us on <a className="font-bold text-emerald-700" href={`tel:${r.phone}`}>{r.phone}</a>.</p>}
              <fieldset>
                <legend className="font-bold text-sm mb-2">Occasion</legend>
                <div className="grid grid-cols-2 gap-2">
                  {info.booking_types.map((t) => (
                    <label key={t.key} className={`p-3 rounded-xl border text-sm font-semibold cursor-pointer ${type === t.key ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
                      <input type="radio" name="booking_type" value={t.key} checked={type === t.key} onChange={() => setType(t.key)} className="sr-only" />
                      {t.label}
                      {t.needs_confirmation && <span className="block text-[11px] font-normal text-slate-500">The restaurant confirms</span>}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="font-bold text-sm">Day</h2>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {days.map((d) => (
                  <button key={d} type="button" onClick={() => setDate(d)} aria-pressed={date === d}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-bold ${date === d ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white'}`}>
                    {d === info.first_date ? 'Today' : fmtDay(d)}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                Or pick a date
                <input type="date" min={info.first_date} max={info.last_date} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm" />
              </label>
              <h2 className="font-bold text-sm pt-1">Time</h2>
              {requestsOnly && <p className="text-xs text-slate-600">Choose a time and send your request. The restaurant confirms it and you'll see the status on your booking page.</p>}
              {!slots ? <p className="text-xs text-slate-500">Finding free times…</p>
                : slots.filter((s) => s.available).length === 0 ? <p className="text-sm text-slate-600">No free tables for {party} on this day. Please try another day{r.phone ? <> or call <a className="font-bold text-emerald-700" href={`tel:${r.phone}`}>{r.phone}</a></> : ''}.</p>
                  : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((s) => (
                        <button key={`${s.date}${s.time}`} type="button" disabled={!s.available} onClick={() => setSlot(s)} aria-pressed={slot === s}
                          className={`py-2.5 rounded-xl border text-sm font-bold ${slot === s ? 'border-emerald-600 bg-emerald-600 text-white' : s.available ? 'border-slate-200 bg-white hover:border-emerald-600' : 'border-slate-100 bg-slate-50 text-slate-300 line-through'}`}>
                          {fmtTime(s.time)}
                        </button>
                      ))}
                    </div>
                  )}
            </section>

            {slot && (
              <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h2 className="font-bold text-sm">Your details</h2>
                <label className="block text-xs font-semibold text-slate-600">Name
                  <input required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" className={`${inputCls} mt-1`} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">Mobile number
                  <input required type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" className={`${inputCls} mt-1`} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">Email (optional)
                  <input type="email" value={form.email} onChange={set('email')} autoComplete="email" className={`${inputCls} mt-1`} />
                </label>
                {type !== 'TABLE' && (
                  <label className="block text-xs font-semibold text-slate-600">What are you celebrating?
                    <input value={form.occasion} onChange={set('occasion')} maxLength={80} className={`${inputCls} mt-1`} />
                  </label>
                )}
                <label className="block text-xs font-semibold text-slate-600">Anything we should know? (optional)
                  <textarea rows={2} maxLength={500} value={form.special_requests} onChange={set('special_requests')} placeholder="High chair, allergies, window seat…" className={`${inputCls} mt-1`} />
                </label>
                {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
                <button type="submit" disabled={sending} className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm disabled:opacity-50">
                  {sending ? 'Sending…' : `${chosenType?.needs_confirmation || slot.needs_confirmation ? 'Send request' : 'Book'} · ${party} guest${party === 1 ? '' : 's'}, ${fmtDay(slot.date)} ${fmtTime(slot.time)}`}
                </button>
              </section>
            )}
            {!slot && error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
