import React, { useCallback, useEffect, useState } from 'react';
import { Percent, Plus, Trash2, X } from 'lucide-react';
import api from '../../services/api';

/**
 * Room rates (REQ-045): seasonal and weekday prices on top of each room's base rate, and the
 * GST rate charged on rooms.
 */
const WEEKDAYS = [['0', 'Sun'], ['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat']];
const inputCls = 'w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]';
const EMPTY = { name: '', applies: 'ALL', room_type: '', room_id: '', start_date: '', end_date: '', weekdays: [], rate_type: 'PERCENT', value: '' };

function describe(rule, rooms) {
  const who = rule.room_id ? `Room ${(rooms.find((r) => r.id === rule.room_id) || {}).room_number || rule.room_id}` : rule.room_type || 'All rooms';
  const when = [
    rule.start_date || rule.end_date ? `${rule.start_date ? String(rule.start_date).slice(0, 10) : '…'} to ${rule.end_date ? String(rule.end_date).slice(0, 10) : '…'}` : null,
    rule.weekdays ? String(rule.weekdays).split(',').map((d) => WEEKDAYS[Number(d)]?.[1]).join(', ') : null
  ].filter(Boolean).join(' · ') || 'Every night';
  const price = rule.rate_type === 'FIXED' ? `₹${Number(rule.value).toLocaleString('en-IN')} per night` : `${Number(rule.value) > 0 ? '+' : ''}${Number(rule.value)}% on base rate`;
  return `${who} · ${when} · ${price}`;
}

export default function RatesTab({ rooms = [] }) {
  const [rules, setRules] = useState([]);
  const [roomTax, setRoomTax] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    api.get('/rooms/rates').then((res) => {
      setRules(res.data.rules || []);
      setRoomTax(res.data.room_tax_percentage === null || res.data.room_tax_percentage === undefined ? '' : String(Number(res.data.room_tax_percentage)));
    }).catch((err) => setError(err.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const roomTypes = [...new Set(rooms.map((r) => r.room_type).filter(Boolean))];

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = {
        name: form.name, rate_type: form.rate_type, value: form.value,
        room_type: form.applies === 'TYPE' ? form.room_type : null,
        room_id: form.applies === 'ROOM' ? form.room_id : null,
        start_date: form.start_date || null, end_date: form.end_date || null,
        weekdays: form.weekdays.join(',')
      };
      if (form.id) await api.put(`/rooms/rates/${form.id}`, body);
      else await api.post('/rooms/rates', body);
      setForm(null);
      setMessage('Rate saved.');
      load();
    } catch (err) {
      setError(err.message || 'Could not save the rate.');
    }
  };

  const saveTax = async () => {
    setError('');
    try {
      const res = await api.put('/rooms/rates/room-tax', { room_tax_percentage: roomTax });
      setMessage(res.message || 'Saved.');
    } catch (err) {
      setError(err.message || 'Could not save.');
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {message && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold" role="status">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold" role="alert">{error}</div>}

      <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-[#1F2937]">Seasonal and weekday rates</h2>
            <p className="text-[#64748B]">Each room's base rate is used unless a rule below matches the night. A rule for one room beats a room-type rule, which beats an all-rooms rule.</p>
          </div>
          <button type="button" onClick={() => setForm({ ...EMPTY })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold"><Plus className="w-3.5 h-3.5" /> Add rate</button>
        </div>
        {rules.length === 0 ? (
          <p className="text-[#64748B] py-4">No special rates yet. Example: “Weekend” +20% on Fri and Sat, or “Diwali” ₹4,500 per night for 10 days.</p>
        ) : (
          <ul className="divide-y divide-[#EEF3F5]">
            {rules.map((r) => (
              <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                <span><strong className="text-[#1F2937]">{r.name}</strong><span className="text-[#475569]"> · {describe(r, rooms)}</span></span>
                <span className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => setForm({
                    id: r.id, name: r.name, applies: r.room_id ? 'ROOM' : r.room_type ? 'TYPE' : 'ALL', room_type: r.room_type || '', room_id: r.room_id || '',
                    start_date: r.start_date ? String(r.start_date).slice(0, 10) : '', end_date: r.end_date ? String(r.end_date).slice(0, 10) : '',
                    weekdays: r.weekdays ? String(r.weekdays).split(',') : [], rate_type: r.rate_type, value: String(Number(r.value))
                  })} className="px-2.5 py-1.5 rounded-lg border border-[#D7E5E8] font-bold">Edit</button>
                  <button type="button" aria-label={`Delete ${r.name}`} onClick={() => api.delete(`/rooms/rates/${r.id}`).then(load).catch((err) => setError(err.message))} className="p-1.5 rounded-lg border border-rose-200 text-rose-700"><Trash2 className="w-3.5 h-3.5" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-2">
        <h2 className="text-sm font-extrabold text-[#1F2937] flex items-center gap-2"><Percent className="w-4 h-4 text-[#3A7D7C]" /> GST on rooms</h2>
        <p className="text-[#64748B]">Leave empty to use the standard slabs: 5% for rooms up to ₹7,500 a night, 18% above. Confirm the rate that applies to you with your accountant.</p>
        <div className="flex items-center gap-2 max-w-xs">
          <label htmlFor="room-tax" className="sr-only">Room GST rate</label>
          <input id="room-tax" type="number" min="0" max="40" step="0.01" value={roomTax} onChange={(e) => setRoomTax(e.target.value)} placeholder="Standard slabs" className={inputCls} />
          <button type="button" onClick={saveTax} className="px-4 py-2.5 rounded-xl bg-[#3A7D7C] text-white font-bold">Save</button>
        </div>
      </section>

      {form && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="rate-title">
          <form onSubmit={save} className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="rate-title" className="text-sm font-extrabold">{form.id ? 'Edit rate' : 'New rate'}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label htmlFor="rate-name" className="block font-bold mb-1">Name</label>
              <input id="rate-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Weekend, Peak season…" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rate-applies" className="block font-bold mb-1">Applies to</label>
                <select id="rate-applies" value={form.applies} onChange={(e) => setForm((f) => ({ ...f, applies: e.target.value }))} className={inputCls}>
                  <option value="ALL">All rooms</option><option value="TYPE">A room type</option><option value="ROOM">One room</option>
                </select>
              </div>
              {form.applies === 'TYPE' && (
                <div>
                  <label htmlFor="rate-type-name" className="block font-bold mb-1">Room type</label>
                  <select id="rate-type-name" required value={form.room_type} onChange={(e) => setForm((f) => ({ ...f, room_type: e.target.value }))} className={inputCls}>
                    <option value="">Choose…</option>{roomTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              {form.applies === 'ROOM' && (
                <div>
                  <label htmlFor="rate-room" className="block font-bold mb-1">Room</label>
                  <select id="rate-room" required value={form.room_id} onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value }))} className={inputCls}>
                    <option value="">Choose…</option>{rooms.map((r) => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="rate-from" className="block font-bold mb-1">From (optional)</label>
                <input id="rate-from" type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label htmlFor="rate-to" className="block font-bold mb-1">To (optional)</label>
                <input id="rate-to" type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <fieldset>
              <legend className="block font-bold mb-1">Only on these nights (optional)</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map(([k, label]) => (
                  <label key={k} className={`px-2.5 py-1.5 rounded-lg border cursor-pointer font-bold ${form.weekdays.includes(k) ? 'bg-[#EAF4F7] border-[#3A7D7C] text-[#2F6665]' : 'border-[#D7E5E8]'}`}>
                    <input type="checkbox" className="sr-only" checked={form.weekdays.includes(k)} onChange={() => setForm((f) => ({ ...f, weekdays: f.weekdays.includes(k) ? f.weekdays.filter((d) => d !== k) : [...f.weekdays, k] }))} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rate-kind" className="block font-bold mb-1">Price</label>
                <select id="rate-kind" value={form.rate_type} onChange={(e) => setForm((f) => ({ ...f, rate_type: e.target.value }))} className={inputCls}>
                  <option value="PERCENT">% change on base rate</option><option value="FIXED">Fixed price per night</option>
                </select>
              </div>
              <div>
                <label htmlFor="rate-value" className="block font-bold mb-1">{form.rate_type === 'FIXED' ? 'Price (₹)' : 'Change (%)'}</label>
                <input id="rate-value" required type="number" step="0.01" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder={form.rate_type === 'FIXED' ? '4500' : '20 or -15'} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold">Save rate</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
