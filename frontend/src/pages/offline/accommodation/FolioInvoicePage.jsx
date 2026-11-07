import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '../../../services/api';

/**
 * Hotel bill / tax invoice for a stay (REQ-044 / REQ-049). Shows room nights, extras, food
 * charged to the room, GST split into CGST + SGST per rate, payments and the balance due.
 */
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const TYPE_LABEL = { ROOM: 'Room', FOOD: 'Restaurant', EXTRA: 'Extra', BREAKFAST: 'Breakfast', SERVICE: 'Service', LAUNDRY: 'Laundry' };

export default function FolioInvoicePage() {
  const { folioId } = useParams();
  const [inv, setInv] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/rooms/folios/${folioId}/invoice`)
      .then((res) => setInv(res.data))
      .catch((err) => setError(err.message || 'Could not load the bill.'));
  }, [folioId]);

  useEffect(() => {
    if (inv) document.title = `${inv.invoice_number} · ${inv.folio.guest_name}`;
  }, [inv]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-sm">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
          <p>{error}</p>
          <Link to="/admin/accommodation/folios" className="font-bold text-[#3A7D7C] hover:underline">Back to folios</Link>
        </div>
      </div>
    );
  }
  if (!inv) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">Loading bill…</div>;

  const h = inv.hotel || {};
  const f = inv.folio;
  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      <style>{`@media print { @page { margin: 12mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print max-w-3xl mx-auto mb-4 flex items-center justify-between gap-3">
        <Link to="/admin/accommodation/folios" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700"><ArrowLeft className="w-4 h-4" /> Back to folios</Link>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      <article className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-sm text-slate-800 print:border-0 print:p-0">
        {inv.provisional && (
          <p className="no-print mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            Provisional: the guest is still checked in. Room nights shown up to the expected check-out; the final bill is made at check-out.
          </p>
        )}
        <header className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-slate-900">{h.name}</h1>
            {h.address && <p className="text-xs text-slate-600 max-w-xs">{h.address}</p>}
            <p className="text-xs text-slate-600">{[h.phone, h.email].filter(Boolean).join(' · ')}</p>
            {h.gstin && <p className="text-xs"><span className="font-bold">GSTIN:</span> {h.gstin}</p>}
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs font-extrabold tracking-widest text-slate-500 uppercase">{inv.provisional ? 'Provisional bill' : (h.gstin ? 'Tax Invoice' : 'Bill')}</p>
            <p className="font-mono font-bold">{inv.invoice_number}</p>
            <p className="text-xs text-slate-600">Room {inv.room?.room_number} · {inv.room?.room_type}</p>
          </div>
        </header>

        <section className="py-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-bold text-slate-500 uppercase tracking-wider mb-1">Guest</p>
            <p className="font-semibold text-sm">{f.guest_name}</p>
            <p className="text-slate-600">{[f.guest_phone, f.guest_email].filter(Boolean).join(' · ')}</p>
            {f.guest_address && <p className="text-slate-600">{f.guest_address}</p>}
            {f.company_gstin && <p><span className="font-bold">Company GSTIN:</span> {f.company_gstin}</p>}
          </div>
          <div className="sm:text-right">
            <p className="font-bold text-slate-500 uppercase tracking-wider mb-1">Stay</p>
            <p>Check-in {fmtDate(f.check_in_date)}</p>
            <p>Check-out {fmtDate(f.check_out_date || f.expected_check_out)}{!f.check_out_date ? ' (expected)' : ''}</p>
            {(f.adults || f.children) ? <p>{f.adults || 1} adult{Number(f.adults) === 1 ? '' : 's'}{Number(f.children) ? `, ${f.children} child${Number(f.children) === 1 ? '' : 'ren'}` : ''}</p> : null}
          </div>
        </section>

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2 font-bold">Date</th><th className="py-2 font-bold">Description</th>
              <th className="py-2 font-bold text-right">Amount</th><th className="py-2 font-bold text-right">GST</th>
            </tr>
          </thead>
          <tbody>
            {inv.charges.length === 0 ? (
              <tr><td colSpan="4" className="py-4 text-center text-slate-500 text-xs">No itemised charges.{inv.legacy_notes ? ' Older charges are listed in the folio notes.' : ''}</td></tr>
            ) : inv.charges.map((c, i) => (
              <tr key={c.id || `p${i}`} className="border-b border-slate-100">
                <td className="py-2 pr-2 text-xs text-slate-600 whitespace-nowrap">{c.charge_date ? fmtDate(c.charge_date) : '—'}</td>
                <td className="py-2 pr-2"><span className="text-[10px] font-bold text-slate-500 mr-1">{TYPE_LABEL[c.charge_type] || c.charge_type}</span>{c.description}</td>
                <td className="py-2 text-right font-mono">{inr(c.amount)}</td>
                <td className="py-2 text-right font-mono text-xs">{Number(c.tax_amount) > 0 ? `${inr(c.tax_amount)} (${Number(c.tax_rate)}%)` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full sm:w-80 space-y-1.5">
          <div className="flex justify-between text-slate-600"><span>Charges</span><span className="font-mono">{inr(inv.subtotal)}</span></div>
          {inv.tax_breakdown.map((t) => (
            <React.Fragment key={t.rate}>
              <div className="flex justify-between text-slate-600 text-xs"><span>CGST @ {t.rate / 2}% on {inr(t.taxable)}</span><span className="font-mono">{inr(t.cgst)}</span></div>
              <div className="flex justify-between text-slate-600 text-xs"><span>SGST @ {t.rate / 2}% on {inr(t.taxable)}</span><span className="font-mono">{inr(t.sgst)}</span></div>
            </React.Fragment>
          ))}
          <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5"><span>Total</span><span className="font-mono">{inr(inv.total)}</span></div>
          {inv.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-emerald-700 text-xs"><span>Paid · {p.method}{p.reference ? ` · ${p.reference}` : ''}</span><span className="font-mono">-{inr(p.amount)}</span></div>
          ))}
          <div className="flex justify-between font-extrabold text-base border-t border-slate-300 pt-2">
            <span>{inv.balance_due > 0 ? 'Balance due' : inv.balance_due < 0 ? 'Refund due to guest' : 'Paid in full'}</span>
            <span className="font-mono">{inr(Math.abs(inv.balance_due))}</span>
          </div>
        </div>

        <footer className="mt-8 pt-4 border-t border-slate-200 text-[11px] text-slate-500 text-center">
          Thank you for staying with {h.name}. This is a computer-generated bill.
        </footer>
      </article>
    </div>
  );
}
