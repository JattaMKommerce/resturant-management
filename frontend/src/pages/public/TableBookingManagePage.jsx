import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, Phone, Check, X } from 'lucide-react';
import api from '../../api/axios';

/** A customer's private table-booking link: see the booking and cancel it (REQ-051 / REQ-056). */
const fmtTime = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const STATUS = {
  PENDING: { label: 'Waiting for the restaurant to confirm', cls: 'bg-amber-50 border-amber-200 text-amber-900' },
  CONFIRMED: { label: 'Confirmed', cls: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  WAITLIST: { label: 'On the waitlist', cls: 'bg-violet-50 border-violet-200 text-violet-900' },
  SEATED: { label: 'You are seated. Enjoy your meal!', cls: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  COMPLETED: { label: 'Thank you for visiting', cls: 'bg-slate-50 border-slate-200 text-slate-800' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-50 border-slate-200 text-slate-700' },
  NO_SHOW: { label: 'Marked as not arrived', cls: 'bg-rose-50 border-rose-200 text-rose-900' }
};

export default function TableBookingManagePage() {
  const { token } = useParams();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get(`/table-bookings/${token}`)
      .then((res) => setB(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'This booking link is not valid.'));
  }, [token]);

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/table-bookings/${token}/cancel`);
      setB(res.data.data);
      setMsg(res.data.message);
      setAsking(false);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Could not cancel. Please call the restaurant.');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center text-sm text-slate-700">{error}</div>;
  if (!b) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Loading…</div>;
  const s = STATUS[b.status] || STATUS.CONFIRMED;
  const r = b.restaurant || {};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <header className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><CalendarClock className="w-6 h-6" /></div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight">Your table at {r.name}</h1>
            <p className="text-sm text-slate-600 font-mono">{b.reservation_code}</p>
          </div>
        </header>
        <p className={`p-3 rounded-xl border text-sm font-bold ${s.cls}`} role="status">{s.label}</p>
        {msg && <p className="p-3 rounded-xl bg-white border border-slate-200 text-sm flex items-center gap-2"><Check className="w-4 h-4 text-emerald-700" /> {msg}</p>}
        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <dl className="text-sm grid grid-cols-2 gap-y-2">
            <dt className="text-slate-500">Name</dt><dd className="font-semibold text-right">{b.customer_name}</dd>
            <dt className="text-slate-500">Day</dt><dd className="font-semibold text-right">{fmtDay(b.date)}</dd>
            <dt className="text-slate-500">Time</dt><dd className="font-semibold text-right">{fmtTime(b.time)}</dd>
            <dt className="text-slate-500">Guests</dt><dd className="font-semibold text-right">{b.party_size}</dd>
            <dt className="text-slate-500">Type</dt><dd className="font-semibold text-right">{b.booking_type_label}</dd>
            {b.occasion && <><dt className="text-slate-500">Occasion</dt><dd className="font-semibold text-right">{b.occasion}</dd></>}
            {b.special_requests && <><dt className="text-slate-500">Requests</dt><dd className="text-right">{b.special_requests}</dd></>}
          </dl>
          {r.address && <p className="text-xs text-slate-600 mt-3">{r.address}</p>}
        </section>

        {b.can_cancel && (!asking ? (
          <button type="button" onClick={() => setAsking(true)} className="w-full py-3 rounded-xl bg-white border border-slate-200 text-rose-700 font-bold text-sm flex items-center justify-center gap-2"><X className="w-4 h-4" /> Cancel this booking</button>
        ) : (
          <div className="bg-white rounded-2xl border border-rose-200 p-4 space-y-3">
            <p className="text-sm font-semibold">Cancel your table for {fmtDay(b.date)} at {fmtTime(b.time)}?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsking(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-sm">Keep it</button>
              <button type="button" onClick={cancel} disabled={busy} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm disabled:opacity-50">{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
            </div>
          </div>
        ))}
        {r.phone && (
          <a href={`tel:${r.phone}`} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold"><Phone className="w-4 h-4" /> Call the restaurant</a>
        )}
        {r.slug && <Link to={`/restaurant/${r.slug}`} className="block text-center text-sm font-bold text-emerald-700 hover:underline">See the menu</Link>}
      </div>
    </div>
  );
}
