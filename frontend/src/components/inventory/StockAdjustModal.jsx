import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';

/** Wastage, expired stock thrown away, or a stock count correction (REQ-053). */
const TYPES = [
  { key: 'WASTAGE', label: 'Wastage / spoilage', hint: 'Quantity thrown away' },
  { key: 'EXPIRED_DISPOSAL', label: 'Expired stock thrown away', hint: 'Quantity thrown away' },
  { key: 'MANUAL_ADJUSTMENT', label: 'Stock count', hint: 'What you counted on the shelf' }
];
const REASONS = [['SPOILED', 'Spoiled'], ['DAMAGED', 'Damaged'], ['OVERCOOKED', 'Cooking mistake'], ['RETURNED', 'Returned dish'], ['OTHER', 'Other']];
const inputCls = 'w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-sm focus:outline-none focus:border-[#3A7D7C]';

export default function StockAdjustModal({ items, onClose, onSaved }) {
  const [form, setForm] = useState({ item_id: '', type: 'WASTAGE', quantity: '', reason_code: 'SPOILED', reason: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const item = items.find((i) => String(i.id) === String(form.item_id));
  const type = TYPES.find((t) => t.key === form.type);
  const count = form.type === 'MANUAL_ADJUSTMENT';

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { type: form.type, reason: form.reason, reason_code: form.reason_code };
      if (count) body.counted_quantity = Number(form.quantity);
      else body.quantity = Number(form.quantity);
      const res = await api.post(`/inventory/items/${form.item_id}/adjust`, body);
      onSaved(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="adj-title">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3 shadow-xl text-xs">
        <div className="flex items-center justify-between">
          <h2 id="adj-title" className="text-lg font-extrabold text-[#1F2937]">Stock correction</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <label className="block font-bold text-[#1F2937]">Ingredient
          <select required value={form.item_id} onChange={set('item_id')} className={`${inputCls} mt-1`}>
            <option value="">Choose ingredient</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_name} ({Number(i.current_stock)} {i.unit} in stock)</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="font-bold text-[#1F2937] mb-1">What happened</legend>
          <div className="grid grid-cols-1 gap-1.5">
            {TYPES.map((t) => (
              <label key={t.key} className={`p-2.5 rounded-xl border cursor-pointer font-semibold ${form.type === t.key ? 'border-[#3A7D7C] bg-[#EAF4F7]' : 'border-[#D7E5E8]'}`}>
                <input type="radio" name="adj-type" value={t.key} checked={form.type === t.key} onChange={set('type')} className="mr-2 accent-[#3A7D7C]" />{t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block font-bold text-[#1F2937]">{type.hint}{item ? ` (${item.unit})` : ''}
          <input required type="number" min="0" step="0.001" value={form.quantity} onChange={set('quantity')} className={`${inputCls} mt-1`} />
        </label>
        {count && item && form.quantity !== '' && (
          <p className="text-[#475569]">System has {Number(item.current_stock)} {item.unit}; this {Number(form.quantity) < Number(item.current_stock) ? `removes ${(Number(item.current_stock) - Number(form.quantity)).toFixed(3)}` : `adds ${(Number(form.quantity) - Number(item.current_stock)).toFixed(3)}`} {item.unit}.</p>
        )}
        {form.type === 'WASTAGE' && (
          <label className="block font-bold text-[#1F2937]">Reason
            <select value={form.reason_code} onChange={set('reason_code')} className={`${inputCls} mt-1`}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
        )}
        <label className="block font-bold text-[#1F2937]">Note (optional)<input value={form.reason} onChange={set('reason')} maxLength={255} className={`${inputCls} mt-1`} /></label>
        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-sm">Close</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
