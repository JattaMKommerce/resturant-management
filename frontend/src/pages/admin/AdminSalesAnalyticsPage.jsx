import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Download, Printer, Star } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import { downloadXlsx } from '../../utils/xlsxWriter';

/**
 * Sales analytics (REQ-017), best sellers (REQ-002), payment methods (REQ-033) and
 * Excel / PDF export (REQ-037). Online and dine-in sales together, by the restaurant's day.
 */

// Chart tokens (validated palette: series-1 blue / series-2 orange pass every CVD check)
const VIZ_STYLE = {
  '--surface-1': '#ffffff',
  '--text-primary': '#0b0b0b',
  '--text-secondary': '#52514e',
  '--text-muted': '#898781',
  '--grid': '#e1e0d9',
  '--baseline': '#c3c2b7',
  '--series-1': '#2a78d6',
  '--series-2': '#eb6834'
};

const PRESETS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'month', label: 'This month' }
];

const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const shiftDays = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const inr = (v, digits = 0) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const compactInr = (v) => {
  const n = Number(v || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n >= 100000000 ? 0 : 1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return `₹${Math.round(n)}`;
};
const shortDate = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function rangeFor(preset) {
  const to = todayIst();
  if (preset === 'month') return { from: `${to.slice(0, 8)}01`, to };
  const p = PRESETS.find((x) => x.key === preset) || PRESETS[1];
  return { from: shiftDays(to, -(p.days - 1)), to };
}

function niceTicks(max) {
  if (max <= 0) return [0];
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) || pow * 10;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function useWidth(ref) {
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver((entries) => setW(Math.max(280, entries[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function StatTile({ label, value, sub }) {
  return (
    <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4">
      <p className="text-xs font-semibold text-[#52514e]">{label}</p>
      <p className="text-2xl font-semibold text-[#0b0b0b] mt-1">{value}</p>
      {sub && <p className="text-[11px] text-[#898781] mt-0.5">{sub}</p>}
    </div>
  );
}

/** Revenue by day: stacked columns, online (series-1) + dine-in (series-2). */
function DailyRevenueChart({ daily }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null);
  const height = 260;
  const m = { top: 12, right: 8, bottom: 28, left: 52 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const totals = daily.map((d) => d.online_revenue + d.dinein_revenue);
  const ticks = niceTicks(Math.max(0, ...totals));
  const yMax = ticks[ticks.length - 1] || 1;
  const band = plotW / Math.max(1, daily.length);
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const y = (v) => m.top + plotH - (v / yMax) * plotH;
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(1, Math.floor(plotW / 64))));
  const GAP = 2;

  const columnPath = (x, top, bottom, rounded) => {
    const h = bottom - top;
    if (h <= 0) return '';
    const r = rounded ? Math.min(4, barW / 2, h) : 0;
    return `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${bottom} Z`;
  };

  return (
    <div ref={wrapRef} className="relative" style={{ height }}>
      <svg width={width} height={height} role="img" aria-label="Revenue by day, online and dine-in. A table of the same data is below the chart.">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--baseline)' : 'var(--grid)'} strokeWidth="1" />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--text-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>{compactInr(t)}</text>
          </g>
        ))}
        {daily.map((d, i) => {
          const x = m.left + i * band + (band - barW) / 2;
          const onTop = y(d.online_revenue);
          const base = y(0);
          const hasDine = d.dinein_revenue > 0;
          const dineBottom = d.online_revenue > 0 ? onTop - GAP : base;
          const dineTop = y(d.online_revenue + d.dinein_revenue) - (d.online_revenue > 0 ? GAP : 0);
          const dim = hover !== null && hover !== i ? 0.55 : 1;
          return (
            <g key={d.date} opacity={dim}>
              {d.online_revenue > 0 && <path d={columnPath(x, onTop, base, !hasDine)} fill="var(--series-1)" />}
              {hasDine && <path d={columnPath(x, dineTop, dineBottom, true)} fill="var(--series-2)" />}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{shortDate(d.date)}</text>
              )}
              <rect
                x={m.left + i * band} y={m.top} width={band} height={plotH} fill="transparent"
                tabIndex={0}
                aria-label={`${shortDate(d.date)}: online ${inr(d.online_revenue)}, dine-in ${inr(d.dinein_revenue)}`}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                style={{ outline: 'none' }}
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && daily[hover] && (
        <div
          className="pointer-events-none absolute z-10 bg-white border border-[#e1e0d9] rounded-xl shadow-md px-3 py-2 text-xs"
          style={{
            left: Math.min(width - 170, Math.max(0, m.left + hover * band + band / 2 - 80)),
            top: 4
          }}
          role="status"
        >
          <p className="text-[#52514e] mb-1">{shortDate(daily[hover].date)}</p>
          {[
            ['var(--series-1)', 'Online', daily[hover].online_revenue, daily[hover].online_orders],
            ['var(--series-2)', 'Dine-in', daily[hover].dinein_revenue, daily[hover].dinein_orders]
          ].map(([color, label, amt, n]) => (
            <p key={label} className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: color }} />
              <strong className="text-[#0b0b0b]">{inr(amt)}</strong>
              <span className="text-[#52514e]">{label} · {n} order{n === 1 ? '' : 's'}</span>
            </p>
          ))}
          <p className="mt-1 pt-1 border-t border-[#e1e0d9]"><strong>{inr(daily[hover].online_revenue + daily[hover].dinein_revenue)}</strong> <span className="text-[#52514e]">total</span></p>
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars, one hue. */
function RankedBars({ rows, valueKey, labelKey, format, empty }) {
  const max = Math.max(0, ...rows.map((r) => r[valueKey]));
  const total = rows.reduce((s, r) => s + r[valueKey], 0);
  if (!rows.length || max <= 0) return <p className="text-xs text-[#898781]">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = total ? Math.round((r[valueKey] / total) * 100) : 0;
        return (
          <li key={r[labelKey]} className="grid grid-cols-[minmax(80px,30%)_1fr] items-center gap-3 text-xs" title={`${r[labelKey]}: ${format(r[valueKey])} (${pct}%)`}>
            <span className="text-[#52514e] truncate">{r[labelKey]}</span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="h-3 rounded-r-[4px] shrink-0" style={{ width: `${Math.max(1, (r[valueKey] / max) * 70)}%`, background: 'var(--series-1)' }} />
              <span className="text-[#0b0b0b] font-semibold whitespace-nowrap">{format(r[valueKey])}</span>
              <span className="text-[#898781] whitespace-nowrap">{pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminSalesAnalyticsPage() {
  const [preset, setPreset] = useState('30');
  const [range, setRange] = useState(() => rangeFor('30'));
  const [custom, setCustom] = useState(() => rangeFor('30'));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [bestsellerMsg, setBestsellerMsg] = useState('');

  const load = useCallback(async (r) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/reports/sales?from=${r.from}&to=${r.to}`);
      setReport(res.data.report);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the sales report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const choosePreset = (key) => {
    setPreset(key);
    const r = rangeFor(key);
    setRange(r);
    setCustom(r);
  };

  const t = report?.totals;
  const hasSales = Boolean(t && t.orders > 0);

  const exportExcel = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const ordersRes = await api.get(`/admin/reports/orders?from=${range.from}&to=${range.to}`);
      const orders = ordersRes.data.orders || [];
      downloadXlsx(`sales-${range.from}-to-${range.to}.xlsx`, [
        {
          name: 'Summary',
          rows: [
            ['Measure', 'Value'],
            ['From', range.from], ['To', range.to],
            ['Total revenue (₹)', t.revenue], ['Online revenue (₹)', t.online_revenue], ['Dine-in revenue (₹)', t.dinein_revenue],
            ['Orders', t.orders], ['Online orders', t.online_orders], ['Dine-in orders', t.dinein_orders],
            ['Average order value (₹)', t.avg_order_value], ['GST collected (₹)', t.tax], ['Discounts given (₹)', t.discounts],
            ['Cancelled / rejected orders', t.cancelled_orders], ['Cancelled value (₹)', t.cancelled_value], ['Refunds paid (₹)', t.refunds]
          ]
        },
        {
          name: 'Daily',
          rows: [['Date', 'Online revenue (₹)', 'Online orders', 'Dine-in revenue (₹)', 'Dine-in orders', 'Total (₹)'],
            ...report.daily.map((d) => [d.date, d.online_revenue, d.online_orders, d.dinein_revenue, d.dinein_orders, Math.round((d.online_revenue + d.dinein_revenue) * 100) / 100])]
        },
        { name: 'Payment methods', rows: [['Method', 'Amount (₹)', 'Payments'], ...report.payment_methods.map((p) => [p.label, p.amount, p.count])] },
        { name: 'Order types', rows: [['Order type', 'Revenue (₹)', 'Orders'], ...report.order_types.map((o) => [o.label, o.revenue, o.orders])] },
        { name: 'Top dishes', rows: [['Rank', 'Dish', 'Quantity sold', 'Revenue (₹)'], ...report.top_items.map((d, i) => [i + 1, d.name, d.quantity, d.revenue])] },
        {
          name: 'Orders',
          rows: [['Date', 'Channel', 'Order number', 'Type', 'Customer', 'Phone', 'Status', 'Payment', 'Payment status', 'Coupon', 'Subtotal (₹)', 'Discount (₹)', 'GST (₹)', 'Delivery (₹)', 'Total (₹)'],
            ...orders.map((o) => [o.business_date, o.channel, o.order_number, o.order_type, o.customer_name, o.customer_phone, o.order_status,
              o.payment_method, o.payment_status, o.coupon_code, o.subtotal, o.discount_amount, o.tax_amount, o.delivery_fee, o.total_amount])]
        }
      ]);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not export the report.');
    } finally {
      setExporting(false);
    }
  };

  const applyBestsellers = async () => {
    setBestsellerMsg('');
    try {
      const res = await api.post('/admin/reports/bestsellers/apply', { top: 5, days: 30 });
      setBestsellerMsg(res.data.message);
    } catch (err) {
      setBestsellerMsg(err.response?.data?.message || 'Could not update bestsellers.');
    }
  };

  const typeRows = useMemo(() => (report?.order_types || []), [report]);

  return (
    <AdminLayout>
      <style>{`@media print {
        aside, header, .no-print { display: none !important; }
        [class*="lg:pl-"] { padding-left: 0 !important; }
        .print-avoid-break { break-inside: avoid; }
      }`}</style>
      <div className="max-w-6xl mx-auto space-y-5" style={VIZ_STYLE}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#3A7D7C]" /> Sales analytics</h1>
            <p className="text-xs text-[#64748B] mt-1">
              Online and dine-in sales, {shortDate(range.from)} – {shortDate(range.to)}. Cancelled orders and unpaid online checkouts are not counted as sales.
            </p>
          </div>
          <div className="no-print flex gap-2">
            <button type="button" onClick={exportExcel} disabled={!report || exporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /> {exporting ? 'Preparing…' : 'Export Excel'}
            </button>
            <button type="button" onClick={() => window.print()} disabled={!report}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] text-xs font-bold hover:bg-slate-50 disabled:opacity-50">
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
          </div>
        </div>

        {/* Filters: one row, above everything they scope */}
        <div className="no-print flex flex-wrap items-end gap-2 text-xs">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => choosePreset(p.key)} aria-pressed={preset === p.key}
              className={`px-3 py-2 rounded-xl font-bold border ${preset === p.key ? 'bg-[#1F2937] text-white border-[#1F2937]' : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:bg-slate-50'}`}>
              {p.label}
            </button>
          ))}
          <form className="flex flex-wrap items-end gap-2 ml-auto" onSubmit={(e) => { e.preventDefault(); setPreset('custom'); setRange({ ...custom }); }}>
            <label className="flex flex-col gap-0.5 font-semibold text-[#52514e]">From
              <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="p-1.5 border border-[#D7E5E8] rounded-lg bg-white" />
            </label>
            <label className="flex flex-col gap-0.5 font-semibold text-[#52514e]">To
              <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="p-1.5 border border-[#D7E5E8] rounded-lg bg-white" />
            </label>
            <button type="submit" className="px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] font-bold hover:bg-slate-50">Apply</button>
          </form>
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold" role="alert">{error}</div>}

        {!report ? (
          <div className="p-10 text-center text-xs text-[#64748B]">{loading ? 'Loading sales…' : 'No data.'}</div>
        ) : (
          <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="Revenue" value={inr(t.revenue)} sub={`Online ${inr(t.online_revenue)} · Dine-in ${inr(t.dinein_revenue)}`} />
              <StatTile label="Orders" value={t.orders.toLocaleString('en-IN')} sub={`Online ${t.online_orders} · Dine-in ${t.dinein_orders}`} />
              <StatTile label="Average order value" value={inr(t.avg_order_value)} />
              <StatTile label="Cancelled or rejected" value={t.cancelled_orders.toLocaleString('en-IN')} sub={`${inr(t.cancelled_value)} not earned · refunds paid ${inr(t.refunds)}`} />
            </div>
            <p className="text-[11px] text-[#64748B]">GST collected {inr(t.tax, 2)} · Discounts given {inr(t.discounts, 2)}</p>

            <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 print-avoid-break">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold text-[#0b0b0b]">Revenue by day</h2>
                <div className="flex items-center gap-4 text-xs text-[#52514e]" aria-hidden="true">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--series-1)' }} /> Online orders</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--series-2)' }} /> Dine-in</span>
                </div>
              </div>
              {hasSales ? <DailyRevenueChart daily={report.daily} /> : <p className="text-xs text-[#898781] py-10 text-center">No sales in this period.</p>}
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-bold text-[#3A7D7C] no-print">Show as table</summary>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full">
                    <thead className="text-left text-[#52514e]"><tr><th className="py-1.5 pr-3">Date</th><th className="py-1.5 pr-3 text-right">Online</th><th className="py-1.5 pr-3 text-right">Dine-in</th><th className="py-1.5 text-right">Total</th></tr></thead>
                    <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {report.daily.map((d) => (
                        <tr key={d.date} className="border-t border-[#EEF3F5]">
                          <td className="py-1.5 pr-3">{shortDate(d.date)}</td>
                          <td className="py-1.5 pr-3 text-right">{inr(d.online_revenue)} <span className="text-[#898781]">({d.online_orders})</span></td>
                          <td className="py-1.5 pr-3 text-right">{inr(d.dinein_revenue)} <span className="text-[#898781]">({d.dinein_orders})</span></td>
                          <td className="py-1.5 text-right font-semibold">{inr(d.online_revenue + d.dinein_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 print-avoid-break">
                <h2 className="text-sm font-bold text-[#0b0b0b] mb-1">How customers paid</h2>
                <p className="text-[11px] text-[#898781] mb-3">Payments received in this period</p>
                <RankedBars rows={report.payment_methods} valueKey="amount" labelKey="label" format={(v) => inr(v)} empty="No payments recorded in this period." />
              </section>
              <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 print-avoid-break">
                <h2 className="text-sm font-bold text-[#0b0b0b] mb-1">Sales by order type</h2>
                <p className="text-[11px] text-[#898781] mb-3">Revenue per channel</p>
                <RankedBars rows={typeRows} valueKey="revenue" labelKey="label" format={(v) => inr(v)} empty="No sales in this period." />
              </section>
            </div>

            <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 print-avoid-break">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold text-[#0b0b0b]">Best-selling dishes</h2>
                <button type="button" onClick={applyBestsellers}
                  className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#D7E5E8] text-xs font-bold hover:bg-slate-50">
                  <Star className="w-3.5 h-3.5 text-amber-500" /> Mark top 5 (last 30 days) as Bestseller on the menu
                </button>
              </div>
              {bestsellerMsg && <p className="text-xs text-[#2F6665] mb-2" role="status">{bestsellerMsg}</p>}
              {report.top_items.length === 0 ? (
                <p className="text-xs text-[#898781]">No dishes sold in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-[#52514e]">
                      <tr><th className="py-1.5 pr-3 w-10">#</th><th className="py-1.5 pr-3">Dish</th><th className="py-1.5 pr-3 text-right">Sold</th><th className="py-1.5 text-right">Revenue</th></tr>
                    </thead>
                    <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {report.top_items.map((d, i) => (
                        <tr key={`${d.name}-${i}`} className="border-t border-[#EEF3F5]">
                          <td className="py-2 pr-3 text-[#898781]">{i + 1}</td>
                          <td className="py-2 pr-3 text-[#0b0b0b] font-semibold">{d.name}</td>
                          <td className="py-2 pr-3 text-right">{d.quantity.toLocaleString('en-IN')}</td>
                          <td className="py-2 text-right">{inr(d.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
