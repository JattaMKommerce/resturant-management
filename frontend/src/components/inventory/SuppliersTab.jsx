import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, X, Phone, Building2 } from 'lucide-react';
import api from '../../services/api';

/** Suppliers with what was bought, paid and still owed (REQ-054). */
const inr0 = (v) => `₹${Math.round(Number(v || 0)).toLocaleString('en-IN')}`;
const inputCls = 'w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-sm focus:outline-none focus:border-[#3A7D7C]';
const EMPTY = { name: '', contact_person: '', phone: '', email: '', gstin: '', address: '', notes: '', is_active: true };

function SupplierForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(initial || {}), is_active: initial ? Number(initial.is_active) !== 0 : true }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { name: form.name, contact_person: form.contact_person, phone: form.phone, email: form.email, gstin: form.gstin, address: form.address, notes: form.notes, is_active: form.is_active };
      const res = initial?.id ? await api.put(`/inventory/suppliers/${initial.id}`, body) : await api.post('/inventory/suppliers', body);
      onSaved(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const field = (k, label, props = {}) => (
    <label className="block text-xs font-bold text-[#1F2937]">{label}
      <input value={form[k] || ''} onChange={set(k)} className={`${inputCls} mt-1`} {...props} />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sup-title">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="sup-title" className="text-lg font-extrabold text-[#1F2937]">{initial?.id ? 'Edit supplier' : 'Add supplier'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {field('name', 'Supplier name', { required: true })}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('contact_person', 'Contact person')}
          {field('phone', 'Phone', { type: 'tel' })}
          {field('email', 'Email', { type: 'email' })}
          {field('gstin', 'GSTIN', { placeholder: '29ABCDE1234F1Z5', maxLength: 15 })}
        </div>
        {field('address', 'Address')}
        {field('notes', 'Notes (payment terms, delivery days…)')}
        <label className="flex items-center gap-2 text-xs font-bold text-[#1F2937]"><input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="accent-[#3A7D7C]" /> Active supplier</label>
        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-sm">Close</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save supplier'}</button>
        </div>
      </form>
    </div>
  );
}

export default function SuppliersTab({ onChanged }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => {
    api.get('/inventory/suppliers').then((res) => setList(res.data)).catch((err) => setError(err.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#64748B]">Totals come from the supplier bills you record under Purchases.</p>
        <button type="button" onClick={() => { setNotice(''); setEditing({}); }} className="py-2 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs flex items-center gap-2"><Plus className="w-4 h-4" /> Add supplier</button>
      </div>
      {notice && <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold" role="status">{notice}</p>}
      {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
      {!list ? <p className="text-sm text-[#64748B]">Loading…</p> : list.length === 0 ? (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-8 text-center text-sm text-[#64748B]">
          <Building2 className="w-7 h-7 mx-auto text-[#3A7D7C] mb-2" />No suppliers yet. Add the vendors you buy vegetables, dairy, meat and dry goods from.
        </div>
      ) : (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Suppliers</caption>
            <thead>
              <tr className="text-left text-[#64748B] border-b border-[#D7E5E8]">
                <th className="py-2 pl-4 pr-2 font-bold">Supplier</th><th className="py-2 px-2 font-bold">Contact</th>
                <th className="py-2 px-2 font-bold text-right">Bills</th><th className="py-2 px-2 font-bold text-right">Bought</th>
                <th className="py-2 px-2 font-bold text-right">Paid</th><th className="py-2 px-2 font-bold text-right">Owed</th>
                <th className="py-2 px-2 font-bold">Last bill</th><th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={`border-b border-[#EEF3F5] ${Number(s.is_active) === 0 ? 'opacity-60' : ''}`}>
                  <td className="py-2 pl-4 pr-2">
                    <span className="font-bold text-[#1F2937] block">{s.name}{Number(s.is_active) === 0 ? ' (inactive)' : ''}</span>
                    {s.gstin && <span className="font-mono text-[10px] text-[#64748B]">GSTIN {s.gstin}</span>}
                  </td>
                  <td className="py-2 px-2">
                    {s.contact_person && <span className="block">{s.contact_person}</span>}
                    {s.phone && <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-[#3A7D7C] font-semibold"><Phone className="w-3 h-3" />{s.phone}</a>}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{s.bills}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{inr0(s.total_purchased)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{inr0(s.total_paid)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums font-bold ${s.outstanding > 0 ? 'text-[#b42323]' : 'text-[#1F2937]'}`}>{inr0(s.outstanding)}</td>
                  <td className="py-2 px-2 whitespace-nowrap">{s.last_purchase || '—'}</td>
                  <td className="py-2 pr-4 text-right"><button type="button" onClick={() => { setNotice(''); setEditing(s); }} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label={`Edit ${s.name}`}><Pencil className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <SupplierForm initial={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={(m) => { setEditing(null); setNotice(m); load(); if (onChanged) onChanged(); }} />}
    </div>
  );
}
