import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw } from 'lucide-react';
import api from '../../services/api';

/**
 * Food cost & margins (REQ-055): each dish's ingredient cost from its recipe at today's ingredient
 * cost, its margin and food-cost % against a target, and what the dishes sold in a period cost.
 */
const inr = (v) => (v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const inr0 = (v) => (v == null ? '—' : `₹${Math.round(Number(v)).toLocaleString('en-IN')}`);
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(1)}%`);
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(`${todayIst()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// Status: icon + word, never colour alone.
const FLAGS = {
  OK: { label: 'On target', Icon: CheckCircle2, cls: 'text-[#006300]' },
  HIGH_COST: { label: 'Above target', Icon: AlertTriangle, cls: 'text-[#8a5a00]' },
  LOSS: { label: 'Costs more than price', Icon: XCircle, cls: 'text-[#b42323]' },
  MISSING_COST: { label: 'Ingredient cost missing', Icon: HelpCircle, cls: 'text-[#475569]' },
  NO_RECIPE: { label: 'No recipe', Icon: HelpCircle, cls: 'text-[#64748B]' },
  NO_PRICE: { label: 'No price', Icon: HelpCircle, cls: 'text-[#64748B]' }
};

/** Food-cost % vs target. Fill carries severity; the track is a lighter step of the same hue. */
function CostMeter({ value, target }) {
  if (value == null) return <span className="text-xs text-[#94A3B8]">—</span>;
  const scaleMax = Math.max(100, target * 2);
  const w = Math.min(100, (value / scaleMax) * 100);
  const t = (target / scaleMax) * 100;
  const tone = value >= 100 ? { fill: '#d03b3b', track: '#f6d4d4' } : value > target ? { fill: '#fab219', track: '#fdebc4' } : { fill: '#2a78d6', track: '#d6e6f9' };
  return (
    <div className="flex items-center gap-2 min-w-[140px]" title={`Food cost ${value.toFixed(1)}% · target ${target}%`}>
      <div className="relative h-2 flex-1 rounded-full" style={{ background: tone.track }} aria-hidden="true">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: tone.fill }} />
        <div className="absolute -top-1 -bottom-1 w-[2px] bg-[#1F2937]" style={{ left: `calc(${t}% - 1px)` }} />
      </div>
      <span className="text-xs font-bold text-[#1F2937] tabular-nums w-12 text-right">{pct(value)}</span>
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4">
      <p className="text-xs font-semibold text-[#64748B]">{label}</p>
      <p className="text-2xl font-extrabold text-[#1F2937] tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-[#64748B] mt-0.5">{sub}</p>}
    </div>
  );
}

const SORTS = {
  cost_pct: (a, b) => (b.food_cost_percent ?? -1) - (a.food_cost_percent ?? -1),
  margin: (a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity),
  name: (a, b) => a.name.localeCompare(b.name)
};

export default function FoodCostTab() {
  const [target, setTarget] = useState(35);
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(todayIst());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const [show, setShow] = useState('ALL');
  const [sort, setSort] = useState('cost_pct');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/inventory/food-cost?target=${target}&from=${from}&to=${to}`);
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Could not load food cost.');
    } finally {
      setLoading(false);
    }
  }, [target, from, to]);
  useEffect(() => { load(); }, [load]);

  const dishes = useMemo(() => {
    const list = (data?.dishes || []).filter((d) => (show === 'ALL' ? true : show === 'ATTENTION' ? ['HIGH_COST', 'LOSS', 'MISSING_COST'].includes(d.flag) : d.flag === 'NO_RECIPE'));
    return [...list].sort(SORTS[sort]);
  }, [data, show, sort]);

  const s = data?.summary;
  const p = data?.period;
  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex flex-wrap items-end gap-3 text-xs">
        <label className="font-bold text-[#1F2937]">Target food cost %
          <input type="number" min={5} max={90} value={target} onChange={(e) => setTarget(Number(e.target.value) || 35)} className="block mt-1 w-24 px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8]" />
        </label>
        <label className="font-bold text-[#1F2937]">Sales from
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="block mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8]" />
        </label>
        <label className="font-bold text-[#1F2937]">to
          <input type="date" value={to} min={from} max={todayIst()} onChange={(e) => e.target.value && setTo(e.target.value)} className="block mt-1 px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8]" />
        </label>
        <button type="button" onClick={load} className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        <p className="text-[11px] text-[#64748B] basis-full">Dish cost = recipe quantities (plus recipe wastage %) × today's average ingredient cost, which includes the GST paid on purchases. Prices are before GST.</p>
      </div>

      {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Average food cost" value={pct(s.average_food_cost_percent)} sub={`Across ${s.with_recipe - s.missing_costs} costed dishes · target ${s.target_percent}%`} />
          <Tile label="Dishes above target" value={s.above_target} sub="Includes dishes that cost more than their price" />
          <Tile label="Dishes without a recipe" value={s.dishes - s.with_recipe} sub={`of ${s.dishes} dishes`} />
          <Tile label="Recipes missing a cost" value={s.missing_costs} sub="An ingredient has no purchase price yet" />
        </div>
      )}

      {p && (
        <section className="bg-white border border-[#D7E5E8] rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-extrabold text-[#1F2937]">Sold from {p.from} to {p.to}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Tile label="Food sales" value={inr0(p.revenue)} sub={p.uncosted_revenue > 0 ? `${inr0(p.uncosted_revenue)} from dishes without a recipe` : 'All dishes costed'} />
            <Tile label="Ingredient cost" value={inr0(p.ingredient_cost)} />
            <Tile label="Gross margin" value={inr0(p.gross_margin)} sub="On costed dishes" />
            <Tile label="Food cost" value={pct(p.food_cost_percent)} sub="Of costed sales" />
            <Tile label="Wastage" value={inr0(p.wastage_value)} sub="Spoiled or expired stock" />
            <Tile label="Purchases" value={inr0(p.purchases_value)} sub="Supplier bills in this period" />
          </div>
          {p.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Dishes sold in the period with cost and margin</caption>
                <thead>
                  <tr className="text-left text-[#64748B] border-b border-[#D7E5E8]">
                    <th className="py-2 pr-2 font-bold">Dish</th><th className="py-2 px-2 font-bold text-right">Sold</th>
                    <th className="py-2 px-2 font-bold text-right">Sales</th><th className="py-2 px-2 font-bold text-right">Ingredient cost</th>
                    <th className="py-2 px-2 font-bold text-right">Margin</th><th className="py-2 pl-2 font-bold text-right">Food cost</th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.slice(0, 50).map((l) => (
                    <tr key={`${l.menu_item_id}-${l.name}`} className="border-b border-[#EEF3F5]">
                      <td className="py-2 pr-2 font-semibold text-[#1F2937]">{l.name}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{l.quantity}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{inr0(l.revenue)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{l.cost == null ? <span className="text-[#94A3B8]">no recipe</span> : inr0(l.cost)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{inr0(l.margin)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums">{pct(l.food_cost_percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="bg-white border border-[#D7E5E8] rounded-2xl">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#D7E5E8]">
          <h3 className="text-sm font-extrabold text-[#1F2937]">Cost per dish</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {[['ALL', 'All dishes'], ['ATTENTION', 'Needs attention'], ['NO_RECIPE', 'No recipe']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setShow(k)} aria-pressed={show === k}
                className={`px-3 py-1.5 rounded-xl border font-bold ${show === k ? 'bg-[#1F2937] text-white border-[#1F2937]' : 'bg-white border-[#D7E5E8] text-[#1F2937]'}`}>{l}</button>
            ))}
            <label className="flex items-center gap-1 font-bold text-[#475569]">Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-2 py-1.5 rounded-xl border border-[#D7E5E8] bg-white">
                <option value="cost_pct">Highest food cost %</option>
                <option value="margin">Lowest margin</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
        </div>
        {!data ? <p className="p-6 text-center text-sm text-[#64748B]">Loading…</p> : dishes.length === 0 ? <p className="p-6 text-center text-sm text-[#64748B]">Nothing to show.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <caption className="sr-only">Food cost per dish</caption>
              <thead>
                <tr className="text-left text-[#64748B] border-b border-[#D7E5E8]">
                  <th className="py-2 pl-4 pr-2 font-bold">Dish</th><th className="py-2 px-2 font-bold text-right">Price</th>
                  <th className="py-2 px-2 font-bold text-right">Cost</th><th className="py-2 px-2 font-bold text-right">Margin</th>
                  <th className="py-2 px-2 font-bold">Food cost vs {target}% target</th><th className="py-2 pl-2 pr-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((d) => {
                  const f = FLAGS[d.flag] || FLAGS.OK;
                  const isOpen = open === d.menu_item_id;
                  return (
                    <React.Fragment key={d.menu_item_id}>
                      <tr className="border-b border-[#EEF3F5] hover:bg-slate-50">
                        <td className="py-2 pl-4 pr-2">
                          {d.ingredients.length > 0 ? (
                            <button type="button" onClick={() => setOpen(isOpen ? null : d.menu_item_id)} aria-expanded={isOpen} className="flex items-center gap-1 font-semibold text-[#1F2937] text-left">
                              {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}{d.name}
                            </button>
                          ) : <span className="font-semibold text-[#1F2937] pl-[18px] block">{d.name}</span>}
                          <span className="text-[10px] text-[#64748B] pl-[18px]">{d.category_name}</span>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{inr(d.price)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{d.ingredients.length ? inr(d.cost) : '—'}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold">{inr(d.margin)}</td>
                        <td className="py-2 px-2"><CostMeter value={d.flag === 'MISSING_COST' ? null : d.food_cost_percent} target={target} /></td>
                        <td className="py-2 pl-2 pr-4"><span className={`inline-flex items-center gap-1 font-bold ${f.cls}`}><f.Icon className="w-3.5 h-3.5" />{f.label}</span></td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50 border-b border-[#EEF3F5]">
                          <td colSpan={6} className="px-4 py-2">
                            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                              {d.ingredients.map((g) => (
                                <li key={g.inventory_item_id} className="flex justify-between gap-2">
                                  <span>{g.item_name} · {g.quantity} {g.unit} × {inr(g.unit_cost)}</span>
                                  <span className="tabular-nums font-semibold">{g.missing_cost ? <span className="text-[#b42323]">no cost yet</span> : inr(g.cost)}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
