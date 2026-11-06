import React, { useCallback, useEffect, useState } from 'react';
import { Tag, Plus, Pencil, Trash2, X, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

/**
 * Coupons & offers (REQ-022). Customers enter the code at checkout; the server checks every
 * rule and calculates the discount.
 */
const EMPTY = {
  code: '', description: '', discount_type: 'PERCENT', discount_value: '', max_discount: '',
  min_order_amount: '', valid_from: '', valid_until: '', usage_limit: '', per_customer_limit: '', is_active: true
};
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const toLocalInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const inputCls = 'w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]';

function describe(c) {
  const off = c.discount_type === 'FLAT' ? `${inr(c.discount_value)} off` : `${Number(c.discount_value)}% off`;
  const cap = c.discount_type === 'PERCENT' && c.max_discount != null ? ` (up to ${inr(c.max_discount)})` : '';
  const min = Number(c.min_order_amount) > 0 ? ` on orders over ${inr(c.min_order_amount)}` : '';
  return `${off}${cap}${min}`;
}

function status(c) {
  const now = Date.now();
  if (!Number(c.is_active)) return { label: 'Off', cls: 'bg-slate-100 text-slate-600' };
  if (c.valid_until && new Date(c.valid_until).getTime() < now) return { label: 'Expired', cls: 'bg-rose-50 text-rose-700' };
  if (c.valid_from && new Date(c.valid_from).getTime() > now) return { label: 'Scheduled', cls: 'bg-sky-50 text-sky-700' };
  if (c.usage_limit != null && Number(c.used_count) >= Number(c.usage_limit)) return { label: 'Used up', cls: 'bg-amber-50 text-amber-800' };
  return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' };
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | coupon
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/coupons');
      setCoupons(res.data.coupons || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load coupons.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setFormError(''); setEditing('new'); };
  const openEdit = (c) => {
    setForm({
      code: c.code, description: c.description || '', discount_type: c.discount_type,
      discount_value: String(Number(c.discount_value)), max_discount: c.max_discount != null ? String(Number(c.max_discount)) : '',
      min_order_amount: Number(c.min_order_amount) ? String(Number(c.min_order_amount)) : '',
      valid_from: toLocalInput(c.valid_from), valid_until: toLocalInput(c.valid_until),
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
      per_customer_limit: c.per_customer_limit != null ? String(c.per_customer_limit) : '',
      is_active: Boolean(Number(c.is_active))
    });
    setFormError('');
    setEditing(c);
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : '',
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : '',
      max_discount: form.discount_type === 'PERCENT' ? form.max_discount : ''
    };
    try {
      if (editing === 'new') await api.post('/admin/coupons', payload);
      else await api.put(`/admin/coupons/${editing.id}`, payload);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save the coupon.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try {
      const res = await api.delete(`/admin/coupons/${c.id}`);
      if (res.data.deactivated) alert(res.data.message);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete the coupon.');
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2"><Tag className="w-5 h-5 text-[#3A7D7C]" /> Coupons</h1>
            <p className="text-xs text-[#64748B] mt-1">Discount codes customers can enter at checkout. Rules are checked when the order is placed.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] text-xs font-bold hover:bg-slate-50">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> New coupon
            </button>
          </div>
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold" role="alert">{error}</div>}

        <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#64748B]">Loading coupons…</div>
          ) : coupons.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
              <p>No coupons yet.</p>
              <button type="button" onClick={openNew} className="font-bold text-[#3A7D7C] hover:underline">Create your first coupon</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[#64748B] text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Code</th>
                    <th className="px-4 py-2.5 font-bold">Offer</th>
                    <th className="px-4 py-2.5 font-bold">Valid</th>
                    <th className="px-4 py-2.5 font-bold text-right">Used</th>
                    <th className="px-4 py-2.5 font-bold text-right">Discount given</th>
                    <th className="px-4 py-2.5 font-bold">Status</th>
                    <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F5]">
                  {coupons.map((c) => {
                    const st = status(c);
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-[#1F2937]">{c.code}</div>
                          {c.description && <div className="text-[11px] text-[#64748B]">{c.description}</div>}
                        </td>
                        <td className="px-4 py-3 text-[#475569]">{describe(c)}</td>
                        <td className="px-4 py-3 text-[#475569] whitespace-nowrap">
                          {c.valid_from ? new Date(c.valid_from).toLocaleDateString('en-IN') : 'Now'} – {c.valid_until ? new Date(c.valid_until).toLocaleDateString('en-IN') : 'No end'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{c.used_count}{c.usage_limit != null ? ` / ${c.usage_limit}` : ''}</td>
                        <td className="px-4 py-3 text-right font-mono">{inr(c.total_discount_given)}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full font-bold ${st.cls}`}>{st.label}</span></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button type="button" onClick={() => openEdit(c)} aria-label={`Edit ${c.code}`} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => remove(c)} aria-label={`Delete ${c.code}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="coupon-title">
          <form onSubmit={save} className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h2 id="coupon-title" className="text-sm font-extrabold text-[#1F2937]">{editing === 'new' ? 'New coupon' : `Edit ${editing.code}`}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            {formError && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold" role="alert">{formError}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cp-code" className="block font-bold mb-1">Code *</label>
                <input id="cp-code" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  maxLength={40} placeholder="WELCOME50" className={`${inputCls} font-mono uppercase`} />
              </div>
              <div>
                <label htmlFor="cp-desc" className="block font-bold mb-1">Description</label>
                <input id="cp-desc" value={form.description} onChange={set('description')} maxLength={255} placeholder="Shown to customers" className={inputCls} />
              </div>
              <div>
                <label htmlFor="cp-type" className="block font-bold mb-1">Discount type</label>
                <select id="cp-type" value={form.discount_type} onChange={set('discount_type')} className={inputCls}>
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FLAT">Flat amount (₹)</option>
                </select>
              </div>
              <div>
                <label htmlFor="cp-value" className="block font-bold mb-1">{form.discount_type === 'PERCENT' ? 'Percentage *' : 'Amount (₹) *'}</label>
                <input id="cp-value" required type="number" min="0.01" step="0.01" max={form.discount_type === 'PERCENT' ? 100 : undefined}
                  value={form.discount_value} onChange={set('discount_value')} className={inputCls} />
              </div>
              {form.discount_type === 'PERCENT' && (
                <div>
                  <label htmlFor="cp-max" className="block font-bold mb-1">Maximum discount (₹)</label>
                  <input id="cp-max" type="number" min="0" step="1" value={form.max_discount} onChange={set('max_discount')} placeholder="No limit" className={inputCls} />
                </div>
              )}
              <div>
                <label htmlFor="cp-min" className="block font-bold mb-1">Minimum order (₹)</label>
                <input id="cp-min" type="number" min="0" step="1" value={form.min_order_amount} onChange={set('min_order_amount')} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label htmlFor="cp-from" className="block font-bold mb-1">Starts</label>
                <input id="cp-from" type="datetime-local" value={form.valid_from} onChange={set('valid_from')} className={inputCls} />
              </div>
              <div>
                <label htmlFor="cp-until" className="block font-bold mb-1">Ends</label>
                <input id="cp-until" type="datetime-local" value={form.valid_until} onChange={set('valid_until')} className={inputCls} />
              </div>
              <div>
                <label htmlFor="cp-limit" className="block font-bold mb-1">Total uses allowed</label>
                <input id="cp-limit" type="number" min="1" step="1" value={form.usage_limit} onChange={set('usage_limit')} placeholder="Unlimited" className={inputCls} />
              </div>
              <div>
                <label htmlFor="cp-per" className="block font-bold mb-1">Uses per customer</label>
                <input id="cp-per" type="number" min="1" step="1" value={form.per_customer_limit} onChange={set('per_customer_limit')} placeholder="Unlimited" className={inputCls} />
              </div>
            </div>
            <label className="flex items-center gap-2 font-bold cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="accent-[#3A7D7C]" /> Coupon is active
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Save coupon'}</button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
