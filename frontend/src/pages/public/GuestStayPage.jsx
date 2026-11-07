import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BedDouble, UtensilsCrossed, Sparkles, Shirt, Package, Wrench, MessageCircle, Phone, Check } from 'lucide-react';
import api from '../../api/axios';

/**
 * A hotel guest's private stay page (REQ-047): ask for food, housekeeping, laundry and more from
 * the phone. The link is sent by the front desk and stops working at check-out.
 */
const TYPES = [
  { key: 'FOOD', label: 'Food to my room', Icon: UtensilsCrossed, hint: 'What would you like? Any allergies?' },
  { key: 'HOUSEKEEPING', label: 'Room cleaning', Icon: Sparkles, hint: 'When suits you?' },
  { key: 'AMENITIES', label: 'Towels, water, toiletries', Icon: Package, hint: 'What do you need?' },
  { key: 'LAUNDRY', label: 'Laundry pickup', Icon: Shirt, hint: 'Number of items, any express need' },
  { key: 'MAINTENANCE', label: 'Something not working', Icon: Wrench, hint: 'What is not working?' },
  { key: 'OTHER', label: 'Something else', Icon: MessageCircle, hint: 'How can we help?' }
];
const STATUS_LABEL = { OPEN: 'Sent', IN_PROGRESS: 'On the way', DONE: 'Done', CANCELLED: 'Closed' };

export default function GuestStayPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [type, setType] = useState(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');

  const load = useCallback(() => {
    api.get(`/stay/${token}`).then((res) => setData(res.data)).catch((err) => setError(err.response?.data?.message || 'This link is not valid.'));
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    setSent('');
    try {
      const res = await api.post(`/stay/${token}/requests`, { request_type: type, details });
      setSent(res.data.message);
      setType(null);
      setDetails('');
      load();
    } catch (err) {
      setSent(err.response?.data?.message || 'Could not send. Please call the front desk.');
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center text-sm text-slate-700">{error}</div>;
  }
  if (!data) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Loading…</div>;
  const s = data.stay;
  const chosen = TYPES.find((t) => t.key === type);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <header className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#3A7D7C] text-white flex items-center justify-center shrink-0"><BedDouble className="w-6 h-6" /></div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight">Hello {s.guest_first_name}</h1>
            <p className="text-sm text-slate-600">Room {s.room_number} · {s.hotel_name}</p>
          </div>
        </header>

        {sent && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2" role="status"><Check className="w-4 h-4" /> {sent}</div>}

        {!type ? (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h2 className="font-bold">What do you need?</h2>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(({ key, label, Icon }) => (
                <button key={key} type="button" onClick={() => { setType(key); setSent(''); }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-[#3A7D7C] hover:bg-[#EAF4F7] text-left text-sm font-semibold flex flex-col gap-2 min-h-[84px]">
                  <Icon className="w-5 h-5 text-[#3A7D7C]" />{label}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <form onSubmit={send} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h2 className="font-bold">{chosen.label}</h2>
            <label htmlFor="stay-details" className="block text-sm text-slate-600">{chosen.hint}</label>
            <textarea id="stay-details" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#3A7D7C]" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setType(null)} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-sm">Back</button>
              <button type="submit" disabled={sending} className="flex-1 py-3 rounded-xl bg-[#3A7D7C] text-white font-bold text-sm disabled:opacity-50">{sending ? 'Sending…' : 'Send request'}</button>
            </div>
          </form>
        )}

        {data.requests.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <h2 className="font-bold text-sm">Your requests</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {data.requests.map((r) => (
                <li key={r.id} className="py-2 flex justify-between gap-2">
                  <span>{(TYPES.find((t) => t.key === r.request_type) || {}).label || r.request_type}{r.details ? <span className="block text-xs text-slate-500">{r.details}</span> : null}</span>
                  <span className="text-xs font-bold text-[#2F6665] whitespace-nowrap">{STATUS_LABEL[r.status] || r.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.hotel_phone && (
          <a href={`tel:${s.hotel_phone}`} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold">
            <Phone className="w-4 h-4" /> Call the front desk
          </a>
        )}
      </div>
    </div>
  );
}
