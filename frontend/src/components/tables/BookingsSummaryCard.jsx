import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import api from '../../api/axios';

/** Dashboard card: today's table bookings and online requests waiting for confirmation (REQ-051). */
export default function BookingsSummaryCard() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/table-reservations/summary').then((res) => { if (alive) setS(res.data?.data || null); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    window.addEventListener('hms_bookings_changed', load);
    return () => { alive = false; clearInterval(t); window.removeEventListener('hms_bookings_changed', load); };
  }, []);
  if (!s) return null;
  const waiting = s.pending_requests > 0;
  return (
    <div className={`rounded-2xl p-5 border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${waiting ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#D7E5E8]'}`}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
          <CalendarClock className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">Table bookings</span>
          <p className="text-base font-bold text-[#1F2937] mt-0.5">
            {s.today.bookings} today{s.today.bookings ? ` · ${s.today.guests} guests` : ''}
            {waiting && <span className="text-amber-800"> · {s.pending_requests} request{s.pending_requests === 1 ? '' : 's'} to confirm</span>}
          </p>
          <span className="text-[11px] font-semibold text-[#64748B]">
            {s.upcoming_7_days} in the next 7 days{!s.has_tables ? ' · add your tables to assign them' : ''}
          </span>
        </div>
      </div>
      <Link
        to={waiting ? '/admin/offline/table-reservations?view=requests' : '/admin/offline/table-reservations'}
        className={`px-4 py-2 rounded-xl font-bold text-xs text-center shrink-0 ${waiting ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-[#3A7D7C] hover:bg-[#2F6665] text-white'}`}
      >
        {waiting ? 'Confirm requests' : 'Open bookings'}
      </Link>
    </div>
  );
}
