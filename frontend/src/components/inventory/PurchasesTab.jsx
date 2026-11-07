import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2, Receipt, IndianRupee, Ban } from 'lucide-react';
import api from '../../services/api';

/**
 * Supplier bills (REQ-054): record what was bought, it goes straight into stock as batches, and
 * track what is paid and still owed.
 */
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const inputCls = 'w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-sm focus:outline-none focus:border-[#3A7D7C]';
const PAY = { UNPAID: { label: 'Unpaid', cls: 'bg-rose-50 text-rose-800 border-rose-200' }, PARTIAL: { label: 'Part paid', cls: 'bg-amber-50 text-amber-900 border-amber-200' }, PAID: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-900 border-emerald-200' } };
const METHODS = ['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE'];
const FILTERS = [['', 'All bills'], ['DUE', 'To pay'], ['PAID', 'Paid'], ['VOID', 'Voided']];
const blankLine = () => ({ inventory_item_id: '', quantity: '', unit_price: '', tax_percent: '5', expiry_date: '' });

function BillForm({ items, suppliers, onClose, onSaved }) {
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', purchase_date: todayIst(), due_date: '', other_charges: '', amount_paid: '', payment_method: 'UPI', payment_reference: '', notes: '' });
  const [lines, setLines] = useState([blankLine()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLine = (i, k) => (e) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: e.target.value } : l)));
  const unitOf = (id) => items.find((it) => String(it.id) === String(id))?.unit || '';
  const totals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
    const tax = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (Number(l.tax_percent) || 0) / 100, 0);
    return { sub, tax, total: sub + tax + (Number(form.other_charges) || 0) };
  }, [lines, form.other_charges]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        ...form,
        supplier_id: Number(form.supplier_id),
        other_charges: Number(form.other_charges) || 0,
        amount_paid: Number(form.amount_paid) || 0,
        due_date: form.due_date || null,
        lines: lines.filter((l) => l.inventory_item_id).map((l) => ({
          inventory_item_id: Number(l.inventory_item_id), quantity: Number(l.quantity), unit_price: Number(l.unit_price),
          tax_percent: Number(l.tax_percent) || 0, expiry_date: l.expiry_date || null
        }))
      };
      const res = await api.post('/inventory/purchases', body);
      onSaved(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="bill-title">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl text-xs">
        <div className="flex items-center justify-between">
          <h2 id="bill-title" className="text-lg font-extrabold text-[#1F2937]">Record a supplier bill</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="font-bold text-[#1F2937] sm:col-span-2">Supplier
            <select required value={form.supplier_id} onChange={set('supplier_id')} className={`${inputCls} mt-1`}>
              <option value="">Choose supplier</option>
              {suppliers.filter((s) => Number(s.is_active) !== 0).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="font-bold text-[#1F2937]">Bill number<input value={form.invoice_number} onChange={set('invoice_number')} className={`${inputCls} mt-1`} /></label>
          <label className="font-bold text-[#1F2937]">Bill date<input type="date" required max={todayIst()} value={form.purchase_date} onChange={set('purchase_date')} className={`${inputCls} mt-1`} /></label>
        </div>
        {suppliers.length === 0 && <p className="text-amber-900 font-semibold">Add a supplier first (Suppliers tab).</p>}

        <fieldset className="space-y-2">
          <legend className="font-bold text-[#1F2937] mb-1">Items received</legend>
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] text-[#64748B] font-bold">
            <span className="col-span-4">Ingredient</span><span className="col-span-2">Quantity</span><span className="col-span-2">Price per unit</span><span className="col-span-1">GST %</span><span className="col-span-2">Use by</span>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center border-b sm:border-0 border-[#EEF3F5] pb-2 sm:pb-0">
              <select required value={l.inventory_item_id} onChange={setLine(i, 'inventory_item_id')} className={`${inputCls} col-span-2 sm:col-span-4`} aria-label={`Line ${i + 1} ingredient`}>
                <option value="">Ingredient</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.item_name} ({it.unit})</option>)}
              </select>
              <div className="relative sm:col-span-2">
                <input required type="number" min="0.001" step="0.001" value={l.quantity} onChange={setLine(i, 'quantity')} className={`${inputCls} pr-10`} placeholder="Qty" aria-label={`Line ${i + 1} quantity`} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#64748B]">{unitOf(l.inventory_item_id)}</span>
              </div>
              <input required type="number" min="0" step="0.01" value={l.unit_price} onChange={setLine(i, 'unit_price')} className={`${inputCls} sm:col-span-2`} placeholder="₹ per unit" aria-label={`Line ${i + 1} price per unit`} />
              <select value={l.tax_percent} onChange={setLine(i, 'tax_percent')} className={`${inputCls} sm:col-span-1`} aria-label={`Line ${i + 1} GST`}>
                {['0', '5', '12', '18', '28'].map((t) => <option key={t} value={t}>{t}%</option>)}
              </select>
              <input type="date" min={form.purchase_date} value={l.expiry_date} onChange={setLine(i, 'expiry_date')} className={`${inputCls} sm:col-span-2`} aria-label={`Line ${i + 1} use by date`} />
              <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} className="p-2 rounded-lg hover:bg-rose-50 text-rose-700 justify-self-end" aria-label={`Remove line ${i + 1}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className="text-[#3A7D7C] font-bold hover:underline">+ Add another item</button>
          <p className="text-[11px] text-[#64748B]">No use-by date: one year from the bill date. Stock is used earliest use-by first.</p>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="font-bold text-[#1F2937]">Transport / other ₹<input type="number" min="0" step="0.01" value={form.other_charges} onChange={set('other_charges')} className={`${inputCls} mt-1`} /></label>
          <label className="font-bold text-[#1F2937]">Paid now ₹<input type="number" min="0" step="0.01" value={form.amount_paid} onChange={set('amount_paid')} className={`${inputCls} mt-1`} /></label>
          <label className="font-bold text-[#1F2937]">Paid by
            <select value={form.payment_method} onChange={set('payment_method')} className={`${inputCls} mt-1`}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          </label>
          <label className="font-bold text-[#1F2937]">Pay by date<input type="date" min={form.purchase_date} value={form.due_date} onChange={set('due_date')} className={`${inputCls} mt-1`} /></label>
        </div>
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm text-[#1F2937]">
          <span>Items {inr(totals.sub)}</span><span>GST {inr(totals.tax)}</span><span className="font-extrabold">Bill total {inr(totals.total)}</span>
        </div>
        {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-sm">Close</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save bill & add to stock'}</button>
        </div>
      </form>
    </div>
  );
}

function BillDetail({ id, onClose, onChanged }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [pay, setPay] = useState({ amount: '', method: 'UPI', reference: '', paid_on: todayIst() });
  const [busy, setBusy] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  useEffect(() => {
    api.get(`/inventory/purchases/${id}`).then((res) => { setP(res.data); setPay((x) => ({ ...x, amount: res.data.balance > 0 ? String(res.data.balance) : '' })); }).catch((err) => setError(err.message));
  }, [id]);
  const act = async (fn) => {
    setBusy(true);
    setError('');
    try {
      const res = await fn();
      setP(res.data);
      onChanged(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirmVoid(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="bill-detail-title">
      <div className="bg-white w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl text-xs">
        <div className="flex items-center justify-between">
          <h2 id="bill-detail-title" className="text-lg font-extrabold text-[#1F2937]">{p ? `${p.supplier_display_name}${p.invoice_number ? ` · bill ${p.invoice_number}` : ''}` : 'Bill'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {!p ? <p className="text-[#64748B]">{error || 'Loading…'}</p> : (
          <>
            <p className="text-[#475569]">Bill date {p.purchase_date}{p.due_date ? ` · pay by ${p.due_date}` : ''}{p.supplier_gstin ? ` · GSTIN ${p.supplier_gstin}` : ''}{p.status === 'VOID' ? ` · VOIDED (${p.void_reason})` : ''}</p>
            <table className="w-full">
              <caption className="sr-only">Bill lines</caption>
              <thead><tr className="text-left text-[#64748B] border-b border-[#D7E5E8]"><th className="py-1.5 font-bold">Item</th><th className="py-1.5 font-bold text-right">Qty</th><th className="py-1.5 font-bold text-right">Price</th><th className="py-1.5 font-bold text-right">GST</th><th className="py-1.5 font-bold text-right">Amount</th></tr></thead>
              <tbody>
                {p.lines.map((l) => (
                  <tr key={l.id} className="border-b border-[#EEF3F5]">
                    <td className="py-1.5">{l.item_name}{l.batch_number ? <span className="block text-[10px] text-[#64748B]">Batch {l.batch_number} · {l.batch_remaining} {l.unit} left · use by {l.expiry_date}</span> : null}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.quantity} {l.unit}</td>
                    <td className="py-1.5 text-right tabular-nums">{inr(l.unit_price)}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.tax_percent}%</td>
                    <td className="py-1.5 text-right tabular-nums">{inr(l.line_total + l.tax_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-full sm:w-72 space-y-1 text-sm">
              <div className="flex justify-between"><span>Items</span><span className="tabular-nums">{inr(p.subtotal)}</span></div>
              <div className="flex justify-between"><span>GST</span><span className="tabular-nums">{inr(p.tax_amount)}</span></div>
              {p.other_charges > 0 && <div className="flex justify-between"><span>Transport / other</span><span className="tabular-nums">{inr(p.other_charges)}</span></div>}
              <div className="flex justify-between font-extrabold border-t border-[#D7E5E8] pt-1"><span>Total</span><span className="tabular-nums">{inr(p.total_amount)}</span></div>
              {p.payments.map((x) => <div key={x.id} className="flex justify-between text-[#006300] text-xs"><span>Paid {x.paid_on} · {x.method}{x.reference ? ` · ${x.reference}` : ''}</span><span className="tabular-nums">-{inr(x.amount)}</span></div>)}
              <div className="flex justify-between font-extrabold border-t border-[#D7E5E8] pt-1"><span>{p.balance > 0 ? 'Still to pay' : 'Paid in full'}</span><span className="tabular-nums">{inr(p.balance)}</span></div>
            </div>
            {p.status !== 'VOID' && p.balance > 0 && (
              <form onSubmit={(e) => { e.preventDefault(); act(() => api.post(`/inventory/purchases/${p.id}/payments`, { ...pay, amount: Number(pay.amount) })); }} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end bg-slate-50 rounded-xl p-3">
                <label className="font-bold">Amount ₹<input required type="number" min="0.01" step="0.01" max={p.balance} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className={`${inputCls} mt-1 bg-white`} /></label>
                <label className="font-bold">Method<select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} className={`${inputCls} mt-1 bg-white`}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
                <label className="font-bold">Reference<input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className={`${inputCls} mt-1 bg-white`} /></label>
                <label className="font-bold">Date<input type="date" max={todayIst()} value={pay.paid_on} onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} className={`${inputCls} mt-1 bg-white`} /></label>
                <button type="submit" disabled={busy} className="py-2 rounded-xl bg-[#3A7D7C] text-white font-bold flex items-center justify-center gap-1 disabled:opacity-50"><IndianRupee className="w-3.5 h-3.5" /> Record payment</button>
              </form>
            )}
            {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
            {p.status !== 'VOID' && p.amount_paid === 0 && (
              !confirmVoid ? (
                <button type="button" onClick={() => setConfirmVoid(true)} className="text-rose-700 font-bold flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Void this bill (entered by mistake)</button>
              ) : (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-rose-900">Remove this bill and its stock? Only possible while none of it has been used.</span>
                  <button type="button" onClick={() => setConfirmVoid(false)} className="px-3 py-1.5 rounded-lg bg-white font-bold">Keep</button>
                  <button type="button" disabled={busy} onClick={() => act(() => api.post(`/inventory/purchases/${p.id}/void`, { reason: 'Entered by mistake' }))} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold">Void bill</button>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PurchasesTab({ items, suppliers, onChanged }) {
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null);
  const load = useCallback(() => {
    api.get(`/inventory/purchases${status ? `?payment_status=${status}` : ''}`).then((res) => setData(res.data)).catch((err) => setError(err.message));
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const changed = (msg) => { setNotice(msg); load(); if (onChanged) onChanged(); };
  const s = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {FILTERS.map(([k, l]) => (
            <button key={k || 'all'} type="button" onClick={() => setStatus(k)} aria-pressed={status === k}
              className={`px-3 py-1.5 rounded-xl border font-bold ${status === k ? 'bg-[#1F2937] text-white border-[#1F2937]' : 'bg-white border-[#D7E5E8] text-[#1F2937]'}`}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={() => { setNotice(''); setAdding(true); }} className="py-2 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs flex items-center gap-2"><Plus className="w-4 h-4" /> Record bill</button>
      </div>
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['Bills', s.bills], ['Bought', inr(s.total)], ['Paid', inr(s.paid)], ['Still to pay', `${inr(s.outstanding)}${s.overdue ? ` · ${s.overdue} overdue` : ''}`]].map(([l, v]) => (
            <div key={l} className="bg-white border border-[#D7E5E8] rounded-2xl p-3"><p className="text-xs font-semibold text-[#64748B]">{l}</p><p className="text-lg font-extrabold text-[#1F2937] tabular-nums">{v}</p></div>
          ))}
        </div>
      )}
      {notice && <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold" role="status">{notice}</p>}
      {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}
      {!data ? <p className="text-sm text-[#64748B]">Loading…</p> : data.purchases.length === 0 ? (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-8 text-center text-sm text-[#64748B]"><Receipt className="w-7 h-7 mx-auto text-[#3A7D7C] mb-2" />No bills here yet. Record supplier bills to add stock and keep track of what you owe.</div>
      ) : (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Supplier bills</caption>
            <thead>
              <tr className="text-left text-[#64748B] border-b border-[#D7E5E8]">
                <th className="py-2 pl-4 pr-2 font-bold">Date</th><th className="py-2 px-2 font-bold">Supplier</th><th className="py-2 px-2 font-bold">Bill no.</th>
                <th className="py-2 px-2 font-bold text-right">Items</th><th className="py-2 px-2 font-bold text-right">Total</th><th className="py-2 px-2 font-bold text-right">To pay</th><th className="py-2 pl-2 pr-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.purchases.map((p) => (
                <tr key={p.id} onClick={() => setViewing(p.id)} className={`border-b border-[#EEF3F5] cursor-pointer hover:bg-slate-50 ${p.status === 'VOID' ? 'opacity-60 line-through' : ''}`}>
                  <td className="py-2 pl-4 pr-2 whitespace-nowrap">{p.purchase_date}</td>
                  <td className="py-2 px-2 font-semibold text-[#1F2937]"><button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); setViewing(p.id); }}>{p.supplier_display_name}</button></td>
                  <td className="py-2 px-2">{p.invoice_number || '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{p.line_count}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{inr(p.total_amount)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold">{p.status === 'VOID' ? '—' : inr(p.balance)}</td>
                  <td className="py-2 pl-2 pr-4">
                    {p.status === 'VOID' ? <span className="font-bold text-[#64748B]">Voided</span> : (
                      <span className={`inline-block px-2 py-0.5 rounded-full border font-bold ${PAY[p.payment_status].cls}`}>{PAY[p.payment_status].label}{p.is_overdue ? ' · overdue' : ''}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <BillForm items={items} suppliers={suppliers} onClose={() => setAdding(false)} onSaved={(m) => { setAdding(false); changed(m); }} />}
      {viewing && <BillDetail id={viewing} onClose={() => setViewing(null)} onChanged={changed} />}
    </div>
  );
}
