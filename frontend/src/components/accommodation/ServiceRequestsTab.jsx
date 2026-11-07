import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Copy, Check } from 'lucide-react';
import api from '../../services/api';

/**
 * Room service requests (REQ-047): what in-house guests asked for (from their private stay link
 * or logged by staff), and each guest's link to share.
 */
const TYPE_LABEL = { FOOD: 'Food', HOUSEKEEPING: 'Housekeeping', LAUNDRY: 'Laundry', AMENITIES: 'Amenities', MAINTENANCE: 'Maintenance', OTHER: 'Other' };
const NEXT = { OPEN: ['IN_PROGRESS', 'Start'], IN_PROGRESS: ['DONE', 'Done'] };

export default function ServiceRequestsTab({ rooms = [] }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const load = useCallback(() => {
    api.get('/rooms/service-requests').then((res) => setRequests(res.data.requests || [])).catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const setStatus = (id, status) => api.patch(`/rooms/service-requests/${id}`, { status }).then(load).catch((err) => setError(err.message));

  const inHouse = rooms.filter((r) => r.guest_token);
  const linkFor = (token) => `${window.location.origin}/stay/${token}`;
  const copy = (r) => {
    navigator.clipboard?.writeText(linkFor(r.guest_token));
    setCopied(r.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-5 text-xs">
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold" role="alert">{error}</div>}
      <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-extrabold text-[#1F2937] flex items-center gap-2"><BellRing className="w-4 h-4 text-[#3A7D7C]" /> Open requests</h2>
        {requests.length === 0 ? (
          <p className="text-[#64748B] py-4">No open requests.</p>
        ) : (
          <ul className="divide-y divide-[#EEF3F5]">
            {requests.map((r) => (
              <li key={r.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-[#1F2937]">Room {r.room_number}</strong> · {TYPE_LABEL[r.request_type] || r.request_type}
                  {r.guest_name ? ` · ${r.guest_name}` : ''} <span className="text-[#64748B]">· {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}{r.source === 'GUEST' ? ' · from guest' : ''}</span>
                  {r.details && <span className="block text-[#475569] mt-0.5">{r.details}</span>}
                </span>
                <span className="flex gap-1">
                  {NEXT[r.status] && <button type="button" onClick={() => setStatus(r.id, NEXT[r.status][0])} className="px-3 py-1.5 rounded-lg bg-[#3A7D7C] text-white font-bold">{NEXT[r.status][1]}</button>}
                  <button type="button" onClick={() => setStatus(r.id, 'CANCELLED')} className="px-3 py-1.5 rounded-lg border border-[#D7E5E8] font-bold">Dismiss</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-2">
        <h2 className="text-sm font-extrabold text-[#1F2937]">Guest links</h2>
        <p className="text-[#64748B]">Share a guest's private link (WhatsApp or SMS) so they can ask for food, towels, cleaning or help from their phone. It stops working at check-out.</p>
        {inHouse.length === 0 ? (
          <p className="text-[#64748B]">No guests checked in.</p>
        ) : (
          <ul className="divide-y divide-[#EEF3F5]">
            {inHouse.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                <span>Room {r.room_number} · {r.guest_name || 'Guest'}</span>
                <button type="button" onClick={() => copy(r)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D7E5E8] font-bold">
                  {copied === r.id ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
