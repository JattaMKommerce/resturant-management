import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '../../api/axios';

/**
 * Tax invoice for an online order (REQ-027 / REQ-028). Print or "Save as PDF" from the browser.
 */
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtRate = (r) => `${Number(r || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

export default function InvoicePage({ overrideSlug }) {
  const params = useParams();
  const slug = overrideSlug || params.slug;
  const { orderId } = params;
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/orders/${orderId}/invoice`)
      .then((res) => setInvoice(res.data.invoice))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the invoice.'));
  }, [orderId]);

  useEffect(() => {
    if (invoice) document.title = `${invoice.invoice_number} · ${invoice.restaurant.name}`;
  }, [invoice]);

  const backTo = slug ? `/restaurant/${slug}/order/${orderId}` : `/order/${orderId}`;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3 max-w-sm">
          <p className="text-sm text-slate-700">{error}</p>
          <Link to={backTo} className="text-sm font-bold text-orange-600 hover:underline">Back to order</Link>
        </div>
      </div>
    );
  }
  if (!invoice) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">Loading invoice…</div>;
  }

  const r = invoice.restaurant;
  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      <style>{`@media print { @page { margin: 12mm; } .no-print { display: none !important; } }`}</style>

      <div className="no-print max-w-3xl mx-auto mb-4 flex items-center justify-between gap-3">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to order
        </Link>
        <button type="button" onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      <article className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-slate-800 text-sm print:border-0 print:rounded-none print:p-0 relative overflow-hidden">
        {invoice.is_cancelled && (
          <div className="absolute top-6 right-6 rotate-12 border-4 border-red-500 text-red-600 font-black text-2xl px-4 py-1 rounded-lg opacity-70" aria-label="Cancelled">
            CANCELLED
          </div>
        )}

        <header className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-slate-900">{r.name}</h1>
            {r.address && <p className="text-xs text-slate-600 max-w-xs">{r.address}</p>}
            <p className="text-xs text-slate-600">{[r.phone, r.email].filter(Boolean).join(' · ')}</p>
            {r.gstin && <p className="text-xs"><span className="font-bold">GSTIN:</span> {r.gstin}</p>}
            {r.fssai && <p className="text-xs"><span className="font-bold">FSSAI Lic. No.:</span> {r.fssai}</p>}
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs font-extrabold tracking-widest text-slate-500 uppercase">{r.gstin ? 'Tax Invoice' : 'Bill of Supply'}</p>
            <p className="font-mono font-bold">{invoice.invoice_number}</p>
            <p className="text-xs text-slate-600">{new Date(invoice.invoice_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <p className="text-xs text-slate-600">Order #{invoice.order_number} · {invoice.order_type === 'TAKEAWAY' ? 'Takeaway' : 'Delivery'}</p>
          </div>
        </header>

        <section className="py-4 border-b border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Billed to</p>
          <p className="font-semibold">{invoice.customer.name}</p>
          <p className="text-xs text-slate-600">{invoice.customer.phone}</p>
          {invoice.customer.address && <p className="text-xs text-slate-600 max-w-md">{invoice.customer.address}</p>}
        </section>

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2 font-bold">Item</th>
              <th className="py-2 font-bold text-right">Rate</th>
              <th className="py-2 font-bold text-right">Qty</th>
              <th className="py-2 font-bold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 pr-2">{it.name}</td>
                <td className="py-2 text-right font-mono">{inr(it.unit_price)}</td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right font-mono">{inr(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full sm:w-80 space-y-1.5 text-sm">
          <Row label="Item total" value={inr(invoice.subtotal)} />
          {invoice.coupon_discount > 0 && <Row label={`Coupon ${invoice.coupon_code || ''}`} value={`-${inr(invoice.coupon_discount)}`} />}
          <Row label="Taxable value" value={inr(invoice.taxable_value)} strong />
          {invoice.tax_amount > 0 && (
            <>
              <Row label={`CGST @ ${fmtRate(invoice.cgst_rate)}`} value={inr(invoice.cgst_amount)} />
              <Row label={`SGST @ ${fmtRate(invoice.sgst_rate)}`} value={inr(invoice.sgst_amount)} />
            </>
          )}
          {invoice.delivery_fee > 0 && <Row label="Delivery charges" value={inr(invoice.delivery_fee)} />}
          {invoice.rewards_discount > 0 && <Row label="Rewards redeemed" value={`-${inr(invoice.rewards_discount)}`} />}
          <div className="border-t border-slate-300 pt-2 flex justify-between font-extrabold text-base">
            <span>Total</span><span className="font-mono">{inr(invoice.total_amount)}</span>
          </div>
          <p className="text-xs text-slate-500 text-right">
            {invoice.payment_method === 'ONLINE' ? 'Paid online' : (invoice.order_type === 'TAKEAWAY' ? 'Pay at pickup' : 'Cash on delivery')}
            {' · '}
            {invoice.payment_status === 'COMPLETED' ? 'Paid' : invoice.payment_status === 'REFUNDED' ? 'Refunded' : 'Payment due'}
          </p>
        </div>

        <footer className="mt-8 pt-4 border-t border-slate-200 text-[11px] text-slate-500 text-center">
          This is a computer-generated invoice and does not need a signature. Thank you for ordering from {r.name}.
        </footer>
      </article>
    </div>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span><span className="font-mono">{value}</span>
    </div>
  );
}
