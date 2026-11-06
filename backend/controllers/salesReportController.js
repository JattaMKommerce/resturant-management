/**
 * Sales analytics for one restaurant over a date range (REQ-002, REQ-017, REQ-033, REQ-037).
 * Online orders (orders) and dine-in/POS orders (restaurant_orders) are combined.
 *
 * Counted as sales:
 *  - online: placed (not an unpaid online checkout) and not cancelled/rejected
 *  - dine-in: bill paid
 * Dates follow the restaurant's business day (utils/businessTime).
 */
const { query } = require('../config/db');
const { businessDate, businessRange } = require('../utils/businessTime');

const MAX_DAYS = 366;
const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

function parseRange(req) {
  const today = businessDate();
  const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  let to = isYmd(req.query.to) ? req.query.to : today;
  let from = isYmd(req.query.from) ? req.query.from : null;
  if (!from) {
    const d = new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 29);
    from = d.toISOString().slice(0, 10);
  }
  if (from > to) [from, to] = [to, from];
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days > MAX_DAYS) {
    const err = new Error(`Please choose a range of ${MAX_DAYS} days or less.`);
    err.statusCode = 400;
    throw err;
  }
  const { start, end } = businessRange(from, to);
  return { from, to, start, end, days };
}

function eachDate(from, to) {
  const out = [];
  const d = new Date(`${from}T00:00:00Z`);
  const last = Date.parse(`${to}T00:00:00Z`);
  while (d.getTime() <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const METHOD_LABELS = {
  UPI: 'UPI', CARD: 'Card', NETBANKING: 'Net banking', WALLET: 'Wallet', EMI: 'EMI', PAYLATER: 'Pay later',
  CASH: 'Cash', ROOM_CHARGE: 'Room charge', MOCK: 'Online (test)', ONLINE: 'Online (other)'
};

function methodKey(row) {
  const pm = String(row.payment_method || '').toUpperCase();
  const detail = String(row.method_detail || '').toUpperCase();
  if (pm === 'ONLINE') return detail || 'ONLINE';
  if (pm === 'COD') return detail || 'CASH';
  return pm || 'OTHER';
}

async function restaurantIdFor(req) {
  const slug = req.query.slug || req.headers['x-restaurant-slug'];
  if (slug) {
    const [r] = await query('SELECT id FROM restaurants WHERE slug = ? OR custom_subdomain_slug = ? LIMIT 1', [slug, slug]);
    if (r && (req.isSuperAdmin || (req.adminRestaurantIds || []).includes(r.id))) return r.id;
  }
  return req.adminRestaurantId || null;
}

async function buildSales(restId, range) {
  const { start, end, from, to } = range;
  const online = await query(
    `SELECT id, created_at, total_amount, tax_amount, discount_amount, order_status, payment_method,
            COALESCE(order_type, 'DELIVERY') AS order_type
     FROM orders
     WHERE restaurant_id = ? AND COALESCE(payment_hold, 0) = 0 AND created_at >= ? AND created_at < ?`,
    [restId, start, end]
  );
  const dine = await query(
    `SELECT id, created_at, total_amount, tax_amount, discount_amount, order_status, payment_status,
            COALESCE(order_type, 'DINE_IN') AS order_type
     FROM restaurant_orders
     WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?`,
    [restId, start, end]
  );

  const daily = Object.fromEntries(eachDate(from, to).map((d) => [d, { date: d, online_revenue: 0, dinein_revenue: 0, online_orders: 0, dinein_orders: 0 }]));
  const types = {};
  const totals = {
    revenue: 0, online_revenue: 0, dinein_revenue: 0, orders: 0, online_orders: 0, dinein_orders: 0,
    cancelled_orders: 0, cancelled_value: 0, discounts: 0, tax: 0, refunds: 0
  };
  const addType = (key, label, amount) => {
    types[key] = types[key] || { type: key, label, revenue: 0, orders: 0 };
    types[key].revenue += amount;
    types[key].orders += 1;
  };

  for (const o of online) {
    const amount = Number(o.total_amount || 0);
    if (['CANCELLED', 'REJECTED'].includes(o.order_status)) {
      totals.cancelled_orders += 1;
      totals.cancelled_value += amount;
      continue;
    }
    const day = daily[businessDate(new Date(o.created_at))];
    if (day) { day.online_revenue += amount; day.online_orders += 1; }
    totals.online_revenue += amount;
    totals.online_orders += 1;
    totals.discounts += Number(o.discount_amount || 0);
    totals.tax += Number(o.tax_amount || 0);
    addType(o.order_type === 'TAKEAWAY' ? 'ONLINE_TAKEAWAY' : 'DELIVERY', o.order_type === 'TAKEAWAY' ? 'Online takeaway' : 'Home delivery', amount);
  }
  for (const o of dine) {
    if (o.order_status === 'CANCELLED') { totals.cancelled_orders += 1; totals.cancelled_value += Number(o.total_amount || 0); continue; }
    if (o.payment_status !== 'PAID') continue;
    const amount = Number(o.total_amount || 0);
    const day = daily[businessDate(new Date(o.created_at))];
    if (day) { day.dinein_revenue += amount; day.dinein_orders += 1; }
    totals.dinein_revenue += amount;
    totals.dinein_orders += 1;
    totals.discounts += Number(o.discount_amount || 0);
    totals.tax += Number(o.tax_amount || 0);
    const label = { DINE_IN: 'Dine-in', TAKEAWAY: 'Counter takeaway', ROOM_SERVICE: 'Room service' }[o.order_type] || 'Dine-in';
    addType(o.order_type === 'TAKEAWAY' ? 'COUNTER_TAKEAWAY' : o.order_type, label, amount);
  }
  totals.revenue = totals.online_revenue + totals.dinein_revenue;
  totals.orders = totals.online_orders + totals.dinein_orders;
  totals.avg_order_value = totals.orders ? totals.revenue / totals.orders : 0;

  // Payments actually received, by method (REQ-033)
  const sourceExpr = `COALESCE(p.order_source, CASE WHEN p.payment_method IN ('ONLINE','COD') THEN 'ONLINE' ELSE 'OFFLINE' END)`;
  const pays = await query(
    `SELECT p.payment_method, p.method_detail, p.amount FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE ${sourceExpr} = 'ONLINE' AND o.restaurant_id = ? AND p.status = 'SUCCESS' AND p.created_at >= ? AND p.created_at < ?
     UNION ALL
     SELECT p.payment_method, p.method_detail, p.amount FROM payments p
     JOIN restaurant_orders ro ON ro.id = p.order_id
     WHERE ${sourceExpr} = 'OFFLINE' AND ro.restaurant_id = ? AND p.status = 'SUCCESS' AND p.created_at >= ? AND p.created_at < ?`,
    [restId, start, end, restId, start, end]
  );
  const methods = {};
  for (const p of pays) {
    const key = methodKey(p);
    methods[key] = methods[key] || { method: key, label: METHOD_LABELS[key] || key.replace(/_/g, ' '), amount: 0, count: 0 };
    methods[key].amount += Number(p.amount || 0);
    methods[key].count += 1;
  }

  // Best sellers (REQ-002): quantity sold across online and dine-in, cancelled orders excluded
  const topItems = await query(
    `SELECT name, menu_item_id, SUM(qty) AS quantity, SUM(rev) AS revenue FROM (
       SELECT oi.item_name AS name, oi.menu_item_id, oi.quantity AS qty, COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0) AS rev
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id AND COALESCE(oi.order_source, 'ONLINE') = 'ONLINE'
       WHERE o.restaurant_id = ? AND COALESCE(o.payment_hold, 0) = 0 AND o.order_status NOT IN ('CANCELLED', 'REJECTED')
         AND o.created_at >= ? AND o.created_at < ?
       UNION ALL
       SELECT oi.item_name, oi.menu_item_id, oi.quantity, COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0)
       FROM order_items oi
       JOIN restaurant_orders ro ON ro.id = oi.order_id AND COALESCE(oi.order_source, 'OFFLINE') = 'OFFLINE'
       WHERE ro.restaurant_id = ? AND ro.order_status <> 'CANCELLED' AND ro.created_at >= ? AND ro.created_at < ?
     ) sold_lines
     GROUP BY name, menu_item_id
     ORDER BY quantity DESC, revenue DESC
     LIMIT 15`,
    [restId, start, end, restId, start, end]
  );

  try {
    const [rf] = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE restaurant_id = ? AND status = 'PROCESSED' AND processed_at >= ? AND processed_at < ?`,
      [restId, start, end]
    );
    totals.refunds = Number(rf?.total || 0);
  } catch (e) { /* refunds table created on first use */ }

  for (const k of Object.keys(totals)) totals[k] = k.endsWith('orders') ? totals[k] : round2(totals[k]);
  return {
    range: { from, to, days: range.days },
    totals,
    daily: Object.values(daily).map((d) => ({ ...d, online_revenue: round2(d.online_revenue), dinein_revenue: round2(d.dinein_revenue) })),
    payment_methods: Object.values(methods).map((m) => ({ ...m, amount: round2(m.amount) })).sort((a, b) => b.amount - a.amount),
    order_types: Object.values(types).map((t) => ({ ...t, revenue: round2(t.revenue) })).sort((a, b) => b.revenue - a.revenue),
    top_items: topItems.map((t) => ({ name: t.name, menu_item_id: t.menu_item_id, quantity: Number(t.quantity), revenue: round2(t.revenue) }))
  };
}

/** GET /admin/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD */
async function getSalesReport(req, res) {
  try {
    const restId = await restaurantIdFor(req);
    if (!restId) return res.status(400).json({ success: false, message: 'No restaurant selected.' });
    const range = parseRange(req);
    res.json({ success: true, report: await buildSales(restId, range) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('getSalesReport Error:', err);
    res.status(500).json({ success: false, message: 'Could not build the sales report.' });
  }
}

/** GET /admin/reports/orders?from&to — every order in the range, for the Excel export (REQ-037) */
async function getOrdersExport(req, res) {
  try {
    const restId = await restaurantIdFor(req);
    if (!restId) return res.status(400).json({ success: false, message: 'No restaurant selected.' });
    const { start, end, from, to } = parseRange(req);
    const online = await query(
      `SELECT 'Online' AS channel, order_number, created_at, COALESCE(order_type, 'DELIVERY') AS order_type, customer_name, customer_phone,
              order_status, payment_method, payment_status, subtotal, discount_amount, tax_amount, delivery_fee, total_amount, coupon_code
       FROM orders WHERE restaurant_id = ? AND COALESCE(payment_hold, 0) = 0 AND created_at >= ? AND created_at < ?
       ORDER BY created_at ASC LIMIT 10000`,
      [restId, start, end]
    );
    const dine = await query(
      `SELECT 'Dine-in' AS channel, order_number, created_at, COALESCE(order_type, 'DINE_IN') AS order_type, customer_name, customer_phone,
              order_status, NULL AS payment_method, payment_status, subtotal, discount_amount, tax_amount, 0 AS delivery_fee, total_amount, NULL AS coupon_code
       FROM restaurant_orders WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?
       ORDER BY created_at ASC LIMIT 10000`,
      [restId, start, end]
    );
    const rows = [...online, ...dine]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((r) => ({
        ...r,
        business_date: businessDate(new Date(r.created_at)),
        subtotal: round2(r.subtotal), discount_amount: round2(r.discount_amount), tax_amount: round2(r.tax_amount),
        delivery_fee: round2(r.delivery_fee), total_amount: round2(r.total_amount)
      }));
    res.json({ success: true, range: { from, to }, orders: rows });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error('getOrdersExport Error:', err);
    res.status(500).json({ success: false, message: 'Could not export orders.' });
  }
}

/**
 * POST /admin/reports/bestsellers/apply { top = 5, days = 30 }
 * Marks the restaurant's top-selling dishes with the "Bestseller" badge on the menu (REQ-002).
 */
async function applyBestsellers(req, res) {
  try {
    const restId = await restaurantIdFor(req);
    if (!restId) return res.status(400).json({ success: false, message: 'No restaurant selected.' });
    const top = Math.min(20, Math.max(1, parseInt(req.body?.top, 10) || 5));
    const days = Math.min(365, Math.max(1, parseInt(req.body?.days, 10) || 30));
    const to = businessDate();
    const fromDate = new Date(`${to}T00:00:00Z`);
    fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
    const report = await buildSales(restId, { ...businessRange(fromDate.toISOString().slice(0, 10), to), from: fromDate.toISOString().slice(0, 10), to, days });
    const winners = report.top_items.filter((t) => t.menu_item_id).slice(0, top);
    await query('UPDATE menu_items SET is_bestseller = 0 WHERE restaurant_id = ?', [restId]);
    if (winners.length) {
      await query(
        `UPDATE menu_items SET is_bestseller = 1 WHERE restaurant_id = ? AND id IN (${winners.map(() => '?').join(',')})`,
        [restId, ...winners.map((w) => w.menu_item_id)]
      );
    }
    res.json({
      success: true,
      message: winners.length
        ? `Marked ${winners.length} dish${winners.length === 1 ? '' : 'es'} as Bestseller based on the last ${days} days.`
        : `No sales in the last ${days} days, so no dish was marked.`,
      bestsellers: winners
    });
  } catch (err) {
    console.error('applyBestsellers Error:', err);
    res.status(500).json({ success: false, message: 'Could not update bestsellers.' });
  }
}

module.exports = { getSalesReport, getOrdersExport, applyBestsellers, buildSales, parseRange };
