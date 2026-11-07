import React, { useState } from 'react';
import { History, Search } from 'lucide-react';
import api from '../../services/api';

/** Guest profile and booking history by phone number (REQ-048). */
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function GuestHistoryLookup() {
  const [phone, setPhone] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await api.get(`/rooms/guests/history?phone=${encodeURIComponent(phone)}`);
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Could not load the guest history.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-3 text-xs mb-5">
      <form onSubmit={lookup} className="flex flex-wrap items-end gap-2">
        <h2 className="text-sm font-extrabold text-[#1F2937] flex items-center gap-2 mr-auto"><History className="w-4 h-4 text-[#3A7D7C]" /> Guest booking history</h2>
        <label className="relative">
          <span className="sr-only">Guest mobile number</span>
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Guest mobile number" className="pl-8 pr-2 py-2 border border-[#D7E5E8] rounded-xl" />
        </label>
        <button type="submit" disabled={loading || phone.replace(/\D/g, '').length < 10} className="px-3 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold disabled:opacity-50">{loading ? 'Looking…' : 'Look up'}</button>
      </form>
      {error && <p className="text-rose-700 font-semibold" role="alert">{error}</p>}
      {data && (
        !data.guest ? <p className="text-[#64748B]">No stays or reservations for this number yet.</p> : (
          <div className="space-y-3">
            <p className="text-[#1F2937]">
              <strong>{data.guest.name}</strong> · {data.guest.phone}{data.guest.email ? ` · ${data.guest.email}` : ''}{data.guest.address ? ` · ${data.guest.address}` : ''}
            </p>
            <p className="text-[#475569]">{data.stays_count} stay{data.stays_count === 1 ? '' : 's'} · {data.nights} night{data.nights === 1 ? '' : 's'} · {inr(data.total_spend)} billed</p>
            {data.stays.length > 0 && (
              <ul className="divide-y divide-[#EEF3F5]">
                {data.stays.map((s) => (
                  <li key={`s${s.id}`} className="py-2 flex justify-between gap-2">
                    <span>Room {s.room_number} · {fmt(s.check_in_date)} → {fmt(s.check_out_date || s.expected_check_out)}{s.folio_status === 'OPEN' ? ' · in house' : ''}</span>
                    <a href={`/admin/accommodation/folios/${s.id}/invoice`} className="font-bold text-[#3A7D7C] hover:underline">Bill</a>
                  </li>
                ))}
              </ul>
            )}
            {data.reservations.filter((r) => r.status === 'CONFIRMED').length > 0 && (
              <p className="text-[#475569]">Upcoming: {data.reservations.filter((r) => r.status === 'CONFIRMED').map((r) => `Room ${r.room_number} from ${fmt(r.check_in_date)}`).join(' · ')}</p>
            )}
          </div>
        )
      )}
    </section>
  );
}
