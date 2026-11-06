/**
 * CouponService (REQ-022)
 * Restaurant coupon codes: percentage or flat discounts on the food subtotal, with optional cap,
 * minimum order, validity window, total usage limit and per-customer limit.
 * The discount is always computed on the server; the browser only sends the code.
 */
const { query } = require('../config/db');

let schemaPromise = null;
function ensureCouponSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        code VARCHAR(40) NOT NULL,
        description VARCHAR(255) NULL,
        discount_type ENUM('PERCENT','FLAT') NOT NULL DEFAULT 'PERCENT',
        discount_value DECIMAL(10,2) NOT NULL,
        max_discount DECIMAL(10,2) NULL,
        min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        valid_from DATETIME NULL,
        valid_until DATETIME NULL,
        usage_limit INT NULL,
        per_customer_limit INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_coupon_code (restaurant_id, code)
      )`);
      await query(`CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        coupon_id INT NOT NULL,
        order_id INT NOT NULL,
        restaurant_id INT NOT NULL,
        customer_phone VARCHAR(20) NULL,
        discount_amount DECIMAL(10,2) NOT NULL,
        status ENUM('APPLIED','REVERSED') NOT NULL DEFAULT 'APPLIED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_redemptions_coupon (coupon_id, status),
        INDEX idx_redemptions_order (order_id)
      )`);
      const cols = await query(
        `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('coupon_code','coupon_discount')`
      );
      const have = new Set(cols.map((r) => r.c));
      if (!have.has('coupon_code')) await query(`ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(40) NULL DEFAULT NULL`);
      if (!have.has('coupon_discount')) await query(`ALTER TABLE orders ADD COLUMN coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 0`);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 40);
}

function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

class CouponError extends Error {}

/**
 * Check a coupon and compute its discount. `runQuery(sql, params)` lets this run inside an order
 * transaction (with the coupon row locked) or on the pool for a preview.
 * Returns { coupon, discount }. Throws CouponError with a customer-facing message.
 */
async function evaluate({ restaurantId, code, subtotal, customerPhone, lock = false, runQuery = query }) {
  const clean = normalizeCode(code);
  if (!clean) throw new CouponError('Enter a coupon code.');
  const rows = await runQuery(
    `SELECT * FROM coupons WHERE restaurant_id = ? AND code = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [restaurantId, clean]
  );
  const coupon = rows[0];
  if (!coupon || !Number(coupon.is_active)) throw new CouponError(`Coupon "${clean}" is not valid.`);

  const now = Date.now();
  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) {
    throw new CouponError(`Coupon "${clean}" is not active yet.`);
  }
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() < now) {
    throw new CouponError(`Coupon "${clean}" has expired.`);
  }
  const minOrder = parseFloat(coupon.min_order_amount || 0);
  if (subtotal < minOrder) {
    throw new CouponError(`Coupon "${clean}" needs a minimum order of ₹${minOrder.toFixed(0)}.`);
  }
  if (coupon.usage_limit != null && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
    throw new CouponError(`Coupon "${clean}" has been fully used.`);
  }
  if (coupon.per_customer_limit != null) {
    const digits = phoneDigits(customerPhone);
    if (!digits) throw new CouponError('Enter your phone number to use this coupon.');
    const used = await runQuery(
      `SELECT COUNT(*) AS n FROM coupon_redemptions
       WHERE coupon_id = ? AND status = 'APPLIED' AND customer_phone = ?`,
      [coupon.id, digits]
    );
    if (Number(used[0]?.n) >= Number(coupon.per_customer_limit)) {
      throw new CouponError(`You have already used coupon "${clean}".`);
    }
  }

  let discount = coupon.discount_type === 'FLAT'
    ? parseFloat(coupon.discount_value)
    : subtotal * (parseFloat(coupon.discount_value) / 100);
  if (coupon.max_discount != null) discount = Math.min(discount, parseFloat(coupon.max_discount));
  discount = Math.max(0, Math.min(subtotal, Math.round(discount * 100) / 100));
  return { coupon, discount };
}

/** Preview for the checkout page (no locking, nothing recorded). */
async function preview({ restaurantId, code, subtotal, customerPhone }) {
  await ensureCouponSchema();
  const { coupon, discount } = await evaluate({ restaurantId, code, subtotal, customerPhone });
  return {
    code: coupon.code,
    description: coupon.description,
    discount_type: coupon.discount_type,
    discount_value: parseFloat(coupon.discount_value),
    discount
  };
}

/** Inside the order transaction: lock, re-check, record the redemption and count the use. */
async function redeemInTransaction(conn, { restaurantId, code, subtotal, customerPhone, orderId }) {
  const runQuery = async (sql, params) => (await conn.query(sql, params))[0];
  const { coupon, discount } = await evaluate({ restaurantId, code, subtotal, customerPhone, lock: true, runQuery });
  return { coupon, discount, record: async (finalOrderId) => {
    await conn.query(
      `INSERT INTO coupon_redemptions (coupon_id, order_id, restaurant_id, customer_phone, discount_amount) VALUES (?, ?, ?, ?, ?)`,
      [coupon.id, finalOrderId || orderId, restaurantId, phoneDigits(customerPhone) || null, discount]
    );
    await conn.query(`UPDATE coupons SET used_count = used_count + 1 WHERE id = ?`, [coupon.id]);
  } };
}

/** Order cancelled/rejected: give the use back. Safe to call more than once. */
async function reverseForOrder(orderId) {
  await ensureCouponSchema();
  const rows = await query(`SELECT * FROM coupon_redemptions WHERE order_id = ? AND status = 'APPLIED'`, [orderId]);
  for (const r of rows) {
    const upd = await query(`UPDATE coupon_redemptions SET status = 'REVERSED' WHERE id = ? AND status = 'APPLIED'`, [r.id]);
    if (upd.affectedRows) {
      await query(`UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?`, [r.coupon_id]);
    }
  }
  return rows.length;
}

// ---- Admin management -------------------------------------------------------------------

function parseCouponInput(body, { partial = false } = {}) {
  const out = {};
  const err = (m) => { throw new CouponError(m); };
  if (!partial || body.code !== undefined) {
    const code = normalizeCode(body.code);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) err('Code must be 3-40 letters, numbers, - or _.');
    out.code = code;
  }
  if (!partial || body.discount_type !== undefined) {
    const t = String(body.discount_type || 'PERCENT').toUpperCase();
    if (!['PERCENT', 'FLAT'].includes(t)) err('Discount type must be PERCENT or FLAT.');
    out.discount_type = t;
  }
  if (!partial || body.discount_value !== undefined) {
    const v = Number(body.discount_value);
    if (!Number.isFinite(v) || v <= 0) err('Discount value must be more than 0.');
    const type = out.discount_type || String(body.discount_type || '').toUpperCase();
    if (type === 'PERCENT' && v > 100) err('A percentage discount cannot be more than 100%.');
    out.discount_value = v;
  }
  const optNum = (key, { integer = false, min = 0 } = {}) => {
    if (body[key] === undefined) return;
    if (body[key] === null || body[key] === '') { out[key] = null; return; }
    const v = Number(body[key]);
    if (!Number.isFinite(v) || v < min || (integer && !Number.isInteger(v))) err(`${key.replace(/_/g, ' ')} is not valid.`);
    out[key] = v;
  };
  optNum('max_discount');
  optNum('usage_limit', { integer: true, min: 1 });
  optNum('per_customer_limit', { integer: true, min: 1 });
  if (body.min_order_amount !== undefined) {
    const v = Number(body.min_order_amount || 0);
    if (!Number.isFinite(v) || v < 0) err('Minimum order is not valid.');
    out.min_order_amount = v;
  }
  for (const key of ['valid_from', 'valid_until']) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === '') { out[key] = null; continue; }
    const d = new Date(body[key]);
    if (Number.isNaN(d.getTime())) err(`${key.replace(/_/g, ' ')} is not a valid date.`);
    out[key] = d;
  }
  if (out.valid_from && out.valid_until && out.valid_until < out.valid_from) err('The end date must be after the start date.');
  if (body.description !== undefined) out.description = String(body.description || '').slice(0, 255) || null;
  if (body.is_active !== undefined) out.is_active = ['1', 'true', 'on', 'yes'].includes(String(body.is_active).toLowerCase()) || body.is_active === true ? 1 : 0;
  return out;
}

async function listCoupons(restaurantId) {
  await ensureCouponSchema();
  return query(
    `SELECT c.*,
            (SELECT COALESCE(SUM(cr.discount_amount), 0) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id AND cr.status = 'APPLIED') AS total_discount_given
     FROM coupons c WHERE c.restaurant_id = ? ORDER BY c.created_at DESC`,
    [restaurantId]
  );
}

async function createCoupon(restaurantId, body) {
  await ensureCouponSchema();
  const data = parseCouponInput(body);
  try {
    const res = await query(
      `INSERT INTO coupons (restaurant_id, code, description, discount_type, discount_value, max_discount, min_order_amount,
                            valid_from, valid_until, usage_limit, per_customer_limit, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [restaurantId, data.code, data.description ?? null, data.discount_type, data.discount_value, data.max_discount ?? null,
        data.min_order_amount ?? 0, data.valid_from ?? null, data.valid_until ?? null, data.usage_limit ?? null,
        data.per_customer_limit ?? null, data.is_active ?? 1]
    );
    return (await query('SELECT * FROM coupons WHERE id = ?', [res.insertId]))[0];
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new CouponError(`A coupon with code "${data.code}" already exists.`);
    throw e;
  }
}

async function updateCoupon(restaurantId, couponId, body) {
  await ensureCouponSchema();
  const [existing] = await query('SELECT * FROM coupons WHERE id = ? AND restaurant_id = ?', [couponId, restaurantId]);
  if (!existing) throw new CouponError('Coupon not found.');
  const data = parseCouponInput({ discount_type: existing.discount_type, ...body }, { partial: true });
  const keys = Object.keys(data);
  if (keys.length === 0) return existing;
  try {
    await query(`UPDATE coupons SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => data[k]), couponId]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new CouponError(`A coupon with code "${data.code}" already exists.`);
    throw e;
  }
  return (await query('SELECT * FROM coupons WHERE id = ?', [couponId]))[0];
}

async function deleteCoupon(restaurantId, couponId) {
  await ensureCouponSchema();
  const [existing] = await query('SELECT id, used_count FROM coupons WHERE id = ? AND restaurant_id = ?', [couponId, restaurantId]);
  if (!existing) throw new CouponError('Coupon not found.');
  // Keep history for coupons that were used: switch them off instead of deleting
  if (Number(existing.used_count) > 0) {
    await query('UPDATE coupons SET is_active = 0 WHERE id = ?', [couponId]);
    return { deactivated: true };
  }
  await query('DELETE FROM coupons WHERE id = ?', [couponId]);
  return { deleted: true };
}

module.exports = {
  ensureCouponSchema,
  normalizeCode,
  preview,
  redeemInTransaction,
  reverseForOrder,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  CouponError
};
