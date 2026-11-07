/**
 * Customer management (REQ-038): one list of the restaurant's customers built from online orders,
 * dine-in / POS orders and table bookings, matched by mobile number. Each customer has a profile
 * with their orders and bookings, and staff notes / tags (e.g. "VIP", "nut allergy").
 */
const { query } = require('../config/db');

const KEY = (col) => `RIGHT(REGEXP_REPLACE(COALESCE(${col}, ''), '[^0-9]', ''), 10)`;
const keyOf = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const restaurantOf = (req) => req.adminRestaurantId || null;

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await query(`CREATE TABLE IF NOT EXISTS restaurant_customer_notes (
    restaurant_id INT NOT NULL,
    phone_key VARCHAR(10) NOT NULL,
    notes VARCHAR(1000) NULL,
    tags VARCHAR(255) NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (restaurant_id, phone_key)
  )`);
  schemaReady = true;
}

async function hasTable(name) {
  const rows = await query(`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name]);
  return Number(rows[0].n) > 0;
}

// Every order line of the restaurant with a usable mobile number. ok = counts as a real order.
const ORDERS_SQL = `
  SELECT ${KEY('o.customer_phone')} AS k, o.customer_name AS name, o.total_amount AS amount, o.created_at AS at, 'ONLINE' AS channel,
         (o.order_status NOT IN ('CANCELLED', 'REJECTED') AND COALESCE(o.payment_hold, 0) = 0) AS ok
  FROM orders o WHERE o.restaurant_id = ? AND o.customer_phone IS NOT NULL
  UNION ALL
  SELECT ${KEY('ro.customer_phone')}, ro.customer_name, ro.total_amount, ro.created_at, 'DINE_IN', ro.order_status <> 'CANCELLED'
  FROM restaurant_orders ro WHERE ro.restaurant_id = ? AND ro.customer_phone IS NOT NULL`;

function segment(c, today = Date.now()) {
  const days = (d) => (d ? (today - new Date(d).getTime()) / 86400000 : Infinity);
  const out = [];
  if (c.orders >= 5) out.push('Regular');
  if (c.orders > 0 && days(c.first_order_at) <= 30) out.push('New');
  if (c.orders > 0 && days(c.last_order_at) > 60) out.push('Lapsed');
  return out;
}

async function listCustomers(req, res) {
  try {
    await ensureSchema();
    const rid = restaurantOf(req);
    if (!rid) return res.status(403).json({ success: false, message: 'No restaurant selected.' });
    const rows = await query(
      `SELECT k AS phone_key,
              SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(name, '') ORDER BY at DESC SEPARATOR 0x1f), 0x1f, 1) AS name,
              SUM(ok) AS orders, SUM(IF(ok, amount, 0)) AS spent, MIN(IF(ok, at, NULL)) AS first_order_at, MAX(IF(ok, at, NULL)) AS last_order_at,
              SUM(ok AND channel = 'ONLINE') AS online_orders, SUM(ok AND channel = 'DINE_IN') AS dine_in_orders, SUM(NOT ok) AS cancelled
       FROM (${ORDERS_SQL}) x
       WHERE LENGTH(k) = 10
       GROUP BY k`,
      [rid, rid]
    );
    const byKey = new Map(rows.map((r) => [r.phone_key, {
      phone_key: r.phone_key, name: r.name || '', orders: Number(r.orders || 0), spent: r2(r.spent), cancelled: Number(r.cancelled || 0),
      online_orders: Number(r.online_orders || 0), dine_in_orders: Number(r.dine_in_orders || 0),
      first_order_at: r.first_order_at, last_order_at: r.last_order_at, bookings: 0, no_shows: 0
    }]));

    // Table bookings add guests who booked but never ordered online.
    if (await hasTable('table_reservations')) {
      const bookings = await query(
        `SELECT ${KEY('customer_phone')} AS k, SUBSTRING_INDEX(GROUP_CONCAT(customer_name ORDER BY reserved_for DESC SEPARATOR 0x1f), 0x1f, 1) AS name,
                SUM(status IN ('CONFIRMED','SEATED','COMPLETED','PENDING')) AS bookings, SUM(status = 'NO_SHOW') AS no_shows
         FROM table_reservations WHERE restaurant_id = ? GROUP BY k`, [rid]
      );
      for (const b of bookings) {
        if (String(b.k).length !== 10) continue;
        const c = byKey.get(b.k) || { phone_key: b.k, name: b.name || '', orders: 0, spent: 0, cancelled: 0, online_orders: 0, dine_in_orders: 0, first_order_at: null, last_order_at: null };
        c.bookings = Number(b.bookings || 0);
        c.no_shows = Number(b.no_shows || 0);
        if (!c.name) c.name = b.name || '';
        byKey.set(b.k, c);
      }
    }
    const notes = await query(`SELECT phone_key, notes, tags FROM restaurant_customer_notes WHERE restaurant_id = ?`, [rid]);
    for (const n of notes) {
      const c = byKey.get(n.phone_key);
      if (c) { c.notes = n.notes; c.tags = n.tags ? n.tags.split(',').map((t) => t.trim()).filter(Boolean) : []; }
    }

    let list = [...byKey.values()].map((c) => ({ ...c, tags: c.tags || [], segments: segment(c), average_order: c.orders ? r2(c.spent / c.orders) : 0 }));
    const search = String(req.query.search || '').trim().toLowerCase();
    if (search) {
      const digits = search.replace(/\D/g, '');
      list = list.filter((c) => c.name.toLowerCase().includes(search) || (digits.length >= 3 && c.phone_key.includes(digits)) || c.tags.some((t) => t.toLowerCase().includes(search)));
    }
    const seg = String(req.query.segment || '');
    if (seg) list = list.filter((c) => c.segments.includes(seg) || c.tags.includes(seg));
    const sorts = {
      spent: (a, b) => b.spent - a.spent,
      orders: (a, b) => b.orders - a.orders,
      recent: (a, b) => new Date(b.last_order_at || 0) - new Date(a.last_order_at || 0),
      name: (a, b) => a.name.localeCompare(b.name)
    };
    list.sort(sorts[req.query.sort] || sorts.spent);
    const total = list.length;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const all = [...byKey.values()];
    return res.json({
      success: true,
      data: {
        customers: list.slice(offset, offset + limit),
        total,
        summary: {
          customers: all.length,
          repeat_customers: all.filter((c) => c.orders >= 2).length,
          total_spent: r2(all.reduce((s, c) => s + c.spent, 0)),
          new_last_30_days: all.filter((c) => c.first_order_at && (Date.now() - new Date(c.first_order_at).getTime()) / 86400000 <= 30).length
        }
      }
    });
  } catch (err) {
    console.error('listCustomers error:', err);
    return res.status(500).json({ success: false, message: 'Could not load customers.' });
  }
}

async function getCustomer(req, res) {
  try {
    await ensureSchema();
    const rid = restaurantOf(req);
    const k = keyOf(req.params.phone);
    if (!rid || k.length !== 10) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const orders = await query(
      `SELECT o.id, o.order_number, o.customer_name AS name, o.customer_phone AS phone, o.total_amount, o.order_status AS status, o.payment_status,
              o.created_at, 'ONLINE' AS channel, o.order_type, u.email
       FROM orders o LEFT JOIN users u ON u.id = o.customer_id
       WHERE o.restaurant_id = ? AND ${KEY('o.customer_phone')} = ?
       UNION ALL
       SELECT ro.id, ro.order_number, ro.customer_name, ro.customer_phone, ro.total_amount, ro.order_status, ro.payment_status,
              ro.created_at, 'DINE_IN', ro.order_type, NULL
       FROM restaurant_orders ro WHERE ro.restaurant_id = ? AND ${KEY('ro.customer_phone')} = ?
       ORDER BY created_at DESC LIMIT 100`,
      [rid, k, rid, k]
    );
    const bookings = (await hasTable('table_reservations')) ? await query(
      `SELECT id, reservation_code, customer_name AS name, party_size, status, booking_type,
              DATE_FORMAT(reserved_for, '%Y-%m-%d %H:%i') AS reserved_for, occasion, special_requests
       FROM table_reservations WHERE restaurant_id = ? AND ${KEY('customer_phone')} = ? ORDER BY reserved_for DESC LIMIT 50`,
      [rid, k]
    ) : [];
    if (!orders.length && !bookings.length) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const [note] = await query(`SELECT notes, tags, updated_at FROM restaurant_customer_notes WHERE restaurant_id = ? AND phone_key = ?`, [rid, k]);
    const real = orders.filter((o) => !['CANCELLED', 'REJECTED'].includes(o.status));
    return res.json({
      success: true,
      data: {
        phone_key: k,
        name: (orders[0] && orders[0].name) || (bookings[0] && bookings[0].name) || '',
        phone: (orders[0] && orders[0].phone) || k,
        email: (orders.find((o) => o.email) || {}).email || null,
        orders_count: real.length,
        spent: r2(real.reduce((s, o) => s + Number(o.total_amount || 0), 0)),
        notes: note ? note.notes : '',
        tags: note && note.tags ? note.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        orders: orders.map((o) => ({ ...o, total_amount: r2(o.total_amount) })),
        bookings
      }
    });
  } catch (err) {
    console.error('getCustomer error:', err);
    return res.status(500).json({ success: false, message: 'Could not load the customer.' });
  }
}

async function saveCustomerNotes(req, res) {
  try {
    await ensureSchema();
    const rid = restaurantOf(req);
    const k = keyOf(req.params.phone);
    if (!rid || k.length !== 10) return res.status(400).json({ success: false, message: 'Enter a 10-digit mobile number.' });
    const notes = String(req.body?.notes || '').trim().slice(0, 1000) || null;
    const tags = (Array.isArray(req.body?.tags) ? req.body.tags : String(req.body?.tags || '').split(','))
      .map((t) => String(t).trim().replace(/,/g, '').slice(0, 30)).filter(Boolean).slice(0, 8);
    await query(
      `INSERT INTO restaurant_customer_notes (restaurant_id, phone_key, notes, tags, updated_by) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE notes = VALUES(notes), tags = VALUES(tags), updated_by = VALUES(updated_by)`,
      [rid, k, notes, tags.join(',') || null, req.user?.id || null]
    );
    return res.json({ success: true, message: 'Customer notes saved', data: { notes: notes || '', tags } });
  } catch (err) {
    console.error('saveCustomerNotes error:', err);
    return res.status(500).json({ success: false, message: 'Could not save the notes.' });
  }
}

module.exports = { listCustomers, getCustomer, saveCustomerNotes, ensureSchema };
