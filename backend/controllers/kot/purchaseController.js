/**
 * Kitchen stock, suppliers, purchases and food cost.
 *  REQ-053 food inventory: ingredients belong to one restaurant; edit items, record wastage,
 *          stock counts and corrections (FEFO: the earliest-expiring batch is used first).
 *  REQ-054 purchase & supplier management: supplier records with GSTIN, purchase bills with lines
 *          that receive stock as batches, supplier payments (paid / part-paid / unpaid), void.
 *  REQ-055 food cost: cost of each dish from its recipe at current ingredient cost, margin and
 *          food-cost %, plus the cost of what was actually sold in a period.
 *
 * Ingredient cost (inventory_items.unit_cost) is the weighted average of the usable batches. A
 * batch's unit price includes the GST paid on it: restaurants on the 5% GST scheme cannot claim
 * that tax back, so it is part of what the food costs.
 */
const pool = require('../../config/database');
const { sendSuccess, sendError } = require('../../utils/response');
const { businessDate } = require('../../utils/businessTime');

const q = async (sql, params = [], ex = pool) => (await ex.query(sql, params))[0];
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const r3 = (v) => Math.round(Number(v || 0) * 1000) / 1000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const text = (v, max) => {
  const s = String(v == null ? '' : v).trim();
  return s ? s.slice(0, max) : null;
};
const restaurantOf = (req) => req.user?.restaurant_id || 1;
const addDaysYmd = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ymdOf = (v) => (v instanceof Date ? businessDate(v) : String(v || '').slice(0, 10));

// ---------------------------------------------------------------------------------------------
// Schema: per-restaurant inventory (with a one-time owner for older rows) + purchase tables
// ---------------------------------------------------------------------------------------------
async function columnsOf(table) {
  const rows = await q(
    `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [table]
  );
  return new Set(rows.map((r) => r.c));
}

let schemaReady = false;
async function ensureInventorySchema() {
  if (schemaReady) return;
  const itemCols = await columnsOf('inventory_items');
  if (!itemCols.size) return; // inventory module not installed on this database
  if (!itemCols.has('restaurant_id')) {
    await q(`ALTER TABLE inventory_items ADD COLUMN restaurant_id INT NULL, ADD INDEX idx_inventory_items_restaurant (restaurant_id)`);
  }
  const supCols = await columnsOf('suppliers');
  if (supCols.size) {
    if (!supCols.has('restaurant_id')) await q(`ALTER TABLE suppliers ADD COLUMN restaurant_id INT NULL, ADD INDEX idx_suppliers_restaurant (restaurant_id)`);
    if (!supCols.has('gstin')) await q(`ALTER TABLE suppliers ADD COLUMN gstin VARCHAR(20) NULL`);
    if (!supCols.has('is_active')) await q(`ALTER TABLE suppliers ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`);
    if (!supCols.has('notes')) await q(`ALTER TABLE suppliers ADD COLUMN notes VARCHAR(500) NULL`);
  }
  const batchCols = await columnsOf('inventory_batches');
  if (batchCols.size && !batchCols.has('purchase_id')) await q(`ALTER TABLE inventory_batches ADD COLUMN purchase_id INT NULL, ADD INDEX idx_batches_purchase (purchase_id)`);

  // Older ingredients had no owner (every restaurant saw every ingredient). Give each one to the
  // restaurant whose dishes use it, otherwise to the first restaurant.
  await q(
    `UPDATE inventory_items ii JOIN (
       SELECT ri.inventory_item_id, MIN(m.restaurant_id) AS rid
       FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id JOIN menu_items m ON m.id = r.menu_item_id
       GROUP BY ri.inventory_item_id
     ) used ON used.inventory_item_id = ii.id
     SET ii.restaurant_id = used.rid WHERE ii.restaurant_id IS NULL`
  ).catch(() => {});
  await q(`UPDATE inventory_items SET restaurant_id = (SELECT MIN(id) FROM restaurants) WHERE restaurant_id IS NULL`).catch(() => {});
  if (supCols.size) {
    await q(
      `UPDATE suppliers s JOIN (
         SELECT b.supplier_id, MIN(ii.restaurant_id) AS rid FROM inventory_batches b JOIN inventory_items ii ON ii.id = b.inventory_item_id
         WHERE b.supplier_id IS NOT NULL GROUP BY b.supplier_id
       ) used ON used.supplier_id = s.id
       SET s.restaurant_id = used.rid WHERE s.restaurant_id IS NULL`
    ).catch(() => {});
    await q(`UPDATE suppliers SET restaurant_id = (SELECT MIN(id) FROM restaurants) WHERE restaurant_id IS NULL`).catch(() => {});
  }
  // The recipe screen always takes quantities in the ingredient's stock unit; keep the label in step.
  await q(`UPDATE recipe_ingredients ri JOIN inventory_items ii ON ii.id = ri.inventory_item_id SET ri.unit = ii.unit WHERE ri.unit <> ii.unit OR ri.unit IS NULL`).catch(() => {});

  await q(`CREATE TABLE IF NOT EXISTS inventory_purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL,
    supplier_id INT NULL,
    supplier_name VARCHAR(150) NULL,
    invoice_number VARCHAR(60) NULL,
    purchase_date DATE NOT NULL,
    due_date DATE NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(12) NOT NULL DEFAULT 'UNPAID',
    status VARCHAR(12) NOT NULL DEFAULT 'RECEIVED',
    notes VARCHAR(500) NULL,
    void_reason VARCHAR(255) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_purchases_restaurant_date (restaurant_id, purchase_date),
    INDEX idx_purchases_supplier (supplier_id)
  )`);
  await q(`CREATE TABLE IF NOT EXISTS inventory_purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    inventory_item_id INT NOT NULL,
    batch_id INT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    expiry_date DATE NULL,
    INDEX idx_purchase_items_purchase (purchase_id),
    INDEX idx_purchase_items_item (inventory_item_id)
  )`);
  await q(`CREATE TABLE IF NOT EXISTS inventory_purchase_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    method VARCHAR(20) NOT NULL DEFAULT 'CASH',
    reference VARCHAR(80) NULL,
    paid_on DATE NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_purchase_payments_purchase (purchase_id)
  )`);
  schemaReady = true;
}

// ---------------------------------------------------------------------------------------------
// Stock helpers
// ---------------------------------------------------------------------------------------------
/** Usable (unexpired) stock from batches -> inventory_items.current_stock. */
async function syncItemStock(ex, itemId) {
  const [row] = await q(
    `SELECT COALESCE(SUM(current_quantity), 0) AS usable, COUNT(*) AS batches FROM inventory_batches
     WHERE inventory_item_id = ? AND current_quantity > 0 AND expiry_date >= CURRENT_DATE()`, [itemId], ex
  );
  const [any] = await q(`SELECT COUNT(*) AS n FROM inventory_batches WHERE inventory_item_id = ?`, [itemId], ex);
  if (Number(any.n) > 0) await q(`UPDATE inventory_items SET current_stock = ? WHERE id = ?`, [r3(row.usable), itemId], ex);
}

/** Weighted average cost of the usable batches -> inventory_items.unit_cost (kept if none left). */
async function refreshItemCost(ex, itemId) {
  const [row] = await q(
    `SELECT SUM(current_quantity * unit_price) AS value, SUM(current_quantity) AS qty FROM inventory_batches
     WHERE inventory_item_id = ? AND current_quantity > 0 AND expiry_date >= CURRENT_DATE() AND unit_price > 0`, [itemId], ex
  );
  if (Number(row.qty) > 0) await q(`UPDATE inventory_items SET unit_cost = ? WHERE id = ?`, [r2(Number(row.value) / Number(row.qty)), itemId], ex);
}

async function itemOf(ex, restaurantId, itemId, lock = false) {
  const rows = await q(
    `SELECT id, item_name, unit, current_stock, unit_cost, min_stock_alert, category_id FROM inventory_items
     WHERE id = ? AND restaurant_id = ?${lock ? ' FOR UPDATE' : ''}`, [itemId, restaurantId], ex
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------------------------
// REQ-053: ingredients
// ---------------------------------------------------------------------------------------------
async function updateInventoryItem(req, res, next) {
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const item = await itemOf(pool, rid, req.params.id);
    if (!item) return sendError(res, 'Ingredient not found', 404);
    const b = req.body || {};
    const name = b.item_name !== undefined ? text(b.item_name, 120) : item.item_name;
    if (!name) return sendError(res, 'Ingredient name is required', 400);
    const minAlert = b.min_stock_alert !== undefined ? Number(b.min_stock_alert) : Number(item.min_stock_alert);
    const unitCost = b.unit_cost !== undefined ? Number(b.unit_cost) : Number(item.unit_cost);
    if (!Number.isFinite(minAlert) || minAlert < 0) return sendError(res, 'Low-stock level must be 0 or more', 400);
    if (!Number.isFinite(unitCost) || unitCost < 0) return sendError(res, 'Cost must be 0 or more', 400);
    let categoryId = item.category_id;
    if (b.category_id !== undefined) {
      const cat = await q(`SELECT id FROM inventory_categories WHERE id = ?`, [b.category_id]);
      if (!cat.length) return sendError(res, 'Category not found', 400);
      categoryId = cat[0].id;
    }
    await q(
      `UPDATE inventory_items SET item_name = ?, category_id = ?, min_stock_alert = ?, unit_cost = ? WHERE id = ?`,
      [name, categoryId, minAlert, r2(unitCost), item.id]
    );
    require('../../services/StockAlertService').checkInventoryItems([item.id], rid);
    return sendSuccess(res, await itemOf(pool, rid, item.id), 'Ingredient updated');
  } catch (err) {
    next(err);
  }
}

const ADJUST_TYPES = {
  WASTAGE: 'Wastage / spoilage',
  EXPIRED_DISPOSAL: 'Expired stock thrown away',
  MANUAL_ADJUSTMENT: 'Stock count correction'
};

/**
 * Record wastage or a stock-count correction. quantity > 0 removes stock (earliest expiry first);
 * for MANUAL_ADJUSTMENT a negative quantity adds stock found during a count. Alternatively send
 * counted_quantity: the physical count, and the difference is booked.
 */
async function adjustStock(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const b = req.body || {};
    const type = String(b.type || 'WASTAGE').toUpperCase();
    if (!ADJUST_TYPES[type]) return sendError(res, 'Choose wastage, expired disposal or stock count correction', 400);
    await conn.beginTransaction();
    const item = await itemOf(conn, rid, req.params.id, true);
    if (!item) { await conn.rollback(); return sendError(res, 'Ingredient not found', 404); }

    let remove;
    if (b.counted_quantity !== undefined && b.counted_quantity !== '') {
      const counted = Number(b.counted_quantity);
      if (!Number.isFinite(counted) || counted < 0) { await conn.rollback(); return sendError(res, 'Counted quantity must be 0 or more', 400); }
      remove = r3(Number(item.current_stock) - counted);
      if (type !== 'MANUAL_ADJUSTMENT' && remove < 0) { await conn.rollback(); return sendError(res, 'The count is higher than the stock; record it as a stock count correction', 400); }
    } else {
      remove = r3(b.quantity);
    }
    if (!Number.isFinite(remove) || remove === 0) { await conn.rollback(); return sendError(res, 'Enter a quantity', 400); }
    if (remove < 0 && type !== 'MANUAL_ADJUSTMENT') { await conn.rollback(); return sendError(res, 'Wastage must be a positive quantity', 400); }
    if (remove > Number(item.current_stock) + 0.0005) {
      await conn.rollback();
      return sendError(res, `Only ${r3(item.current_stock)} ${item.unit} in stock`, 400);
    }
    const reason = text(b.reason, 255) || ADJUST_TYPES[type];
    const stamp = Date.now();
    let left = remove;

    if (remove > 0) {
      // Expired disposal takes from expired batches first, everything else from the earliest expiry.
      const batches = await q(
        `SELECT id, current_quantity FROM inventory_batches WHERE inventory_item_id = ? AND current_quantity > 0
         ${type === 'EXPIRED_DISPOSAL' ? '' : 'AND expiry_date >= CURRENT_DATE()'}
         ORDER BY expiry_date ASC, id ASC FOR UPDATE`, [item.id], conn
      );
      for (const batch of batches) {
        if (left <= 0) break;
        const take = r3(Math.min(Number(batch.current_quantity), left));
        await q(`UPDATE inventory_batches SET current_quantity = current_quantity - ? WHERE id = ?`, [take, batch.id], conn);
        await q(
          `INSERT INTO stock_transactions (inventory_item_id, batch_id, change_quantity, type, reference_id, notes, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [item.id, batch.id, -take, type, `${type}_${item.id}_${batch.id}_${stamp}`, reason, type === 'MANUAL_ADJUSTMENT' ? 'COUNT' : String(b.reason_code || 'OTHER').toUpperCase().slice(0, 30)], conn
        );
        left = r3(left - take);
      }
      if (left > 0) {
        // Stock kept without batches (older data): book the rest against the item itself.
        await q(
          `INSERT INTO stock_transactions (inventory_item_id, change_quantity, type, reference_id, notes, reason) VALUES (?, ?, ?, ?, ?, ?)`,
          [item.id, -left, type, `${type}_${item.id}_X_${stamp}`, reason, type === 'MANUAL_ADJUSTMENT' ? 'COUNT' : String(b.reason_code || 'OTHER').toUpperCase().slice(0, 30)], conn
        );
        await q(`UPDATE inventory_items SET current_stock = GREATEST(current_stock - ?, 0) WHERE id = ?`, [left, item.id], conn);
      }
    } else {
      // Found more than the system had: add it as a small batch at today's cost.
      const add = r3(-remove);
      const today = businessDate();
      const ins = await q(
        `INSERT INTO inventory_batches (inventory_item_id, batch_number, supplier_name, initial_quantity, current_quantity, unit_price, purchase_date, expiry_date, notes)
         VALUES (?, ?, 'Stock count', ?, ?, ?, ?, ?, ?)`,
        [item.id, `ADJ-${item.id}-${stamp}`.slice(0, 50), add, add, r2(item.unit_cost), today, addDaysYmd(today, 180), reason], conn
      );
      await q(
        `INSERT INTO stock_transactions (inventory_item_id, batch_id, change_quantity, type, reference_id, notes, reason) VALUES (?, ?, ?, 'MANUAL_ADJUSTMENT', ?, ?, 'COUNT')`,
        [item.id, ins.insertId, add, `MANUAL_ADJUSTMENT_${item.id}_ADD_${stamp}`, reason], conn
      );
    }
    await syncItemStock(conn, item.id);
    await conn.commit();
    require('../../services/StockAlertService').checkInventoryItems([item.id], rid);
    const updated = await itemOf(pool, rid, item.id);
    const word = remove > 0 ? `${r3(remove)} ${item.unit} removed` : `${r3(-remove)} ${item.unit} added`;
    return sendSuccess(res, updated, `${item.item_name}: ${word}`);
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------------------------
// REQ-054: suppliers
// ---------------------------------------------------------------------------------------------
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function supplierInput(b, current = {}) {
  const pick = (k, max) => (b[k] !== undefined ? text(b[k], max) : current[k] ?? null);
  const out = {
    name: pick('name', 100),
    contact_person: pick('contact_person', 100),
    phone: pick('phone', 20),
    email: pick('email', 100),
    address: pick('address', 255),
    gstin: b.gstin !== undefined ? (text(b.gstin, 20) || '').toUpperCase() || null : current.gstin ?? null,
    notes: pick('notes', 500),
    is_active: b.is_active !== undefined ? (b.is_active === false || b.is_active === 0 || b.is_active === '0' || b.is_active === 'false' ? 0 : 1) : (current.is_active ?? 1)
  };
  if (!out.name) return { error: 'Supplier name is required' };
  if (out.gstin && !GSTIN.test(out.gstin)) return { error: 'GSTIN should look like 29ABCDE1234F1Z5' };
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) return { error: 'Enter a valid email or leave it empty' };
  return { value: out };
}

async function listSuppliers(req, res, next) {
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const rows = await q(
      `SELECT s.*,
         COALESCE(p.bills, 0) AS bills, COALESCE(p.purchased, 0) AS total_purchased, COALESCE(p.paid, 0) AS total_paid,
         p.last_purchase
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id, COUNT(*) AS bills, SUM(total_amount) AS purchased, SUM(amount_paid) AS paid, MAX(purchase_date) AS last_purchase
         FROM inventory_purchases WHERE restaurant_id = ? AND status <> 'VOID' GROUP BY supplier_id
       ) p ON p.supplier_id = s.id
       WHERE s.restaurant_id = ?
       ORDER BY s.is_active DESC, s.name ASC`,
      [rid, rid]
    );
    return sendSuccess(res, rows.map((s) => ({
      ...s,
      bills: Number(s.bills),
      total_purchased: r2(s.total_purchased),
      total_paid: r2(s.total_paid),
      outstanding: r2(Number(s.total_purchased) - Number(s.total_paid)),
      last_purchase: s.last_purchase ? ymdOf(s.last_purchase) : null
    })), 'Suppliers loaded');
  } catch (err) {
    next(err);
  }
}

async function createSupplier(req, res, next) {
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const input = supplierInput(req.body || {});
    if (input.error) return sendError(res, input.error, 400);
    const s = input.value;
    const dup = await q(`SELECT id FROM suppliers WHERE restaurant_id = ? AND LOWER(name) = LOWER(?)`, [rid, s.name]);
    if (dup.length) return sendError(res, `A supplier called "${s.name}" already exists`, 400);
    const r = await q(
      `INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, address, gstin, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, s.name, s.contact_person, s.phone, s.email, s.address, s.gstin, s.notes, s.is_active]
    );
    const [row] = await q(`SELECT * FROM suppliers WHERE id = ?`, [r.insertId]);
    return sendSuccess(res, row, 'Supplier created successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function updateSupplier(req, res, next) {
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const [current] = await q(`SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?`, [req.params.id, rid]);
    if (!current) return sendError(res, 'Supplier not found', 404);
    const input = supplierInput(req.body || {}, current);
    if (input.error) return sendError(res, input.error, 400);
    const s = input.value;
    const dup = await q(`SELECT id FROM suppliers WHERE restaurant_id = ? AND LOWER(name) = LOWER(?) AND id <> ?`, [rid, s.name, current.id]);
    if (dup.length) return sendError(res, `A supplier called "${s.name}" already exists`, 400);
    await q(
      `UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, gstin = ?, notes = ?, is_active = ? WHERE id = ?`,
      [s.name, s.contact_person, s.phone, s.email, s.address, s.gstin, s.notes, s.is_active, current.id]
    );
    const [row] = await q(`SELECT * FROM suppliers WHERE id = ?`, [current.id]);
    return sendSuccess(res, row, 'Supplier updated');
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------------------------
// REQ-054: purchase bills
// ---------------------------------------------------------------------------------------------
const PAY_METHODS = ['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE', 'CREDIT_NOTE'];
const payStatus = (total, paid) => (paid <= 0.004 ? 'UNPAID' : paid + 0.004 >= total ? 'PAID' : 'PARTIAL');

function purchaseRow(p) {
  return {
    ...p,
    purchase_date: ymdOf(p.purchase_date),
    due_date: p.due_date ? ymdOf(p.due_date) : null,
    subtotal: r2(p.subtotal),
    tax_amount: r2(p.tax_amount),
    other_charges: r2(p.other_charges),
    total_amount: r2(p.total_amount),
    amount_paid: r2(p.amount_paid),
    balance: r2(Number(p.total_amount) - Number(p.amount_paid)),
    is_overdue: p.status !== 'VOID' && p.payment_status !== 'PAID' && p.due_date && ymdOf(p.due_date) < businessDate()
  };
}

async function listPurchases(req, res, next) {
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const where = ['p.restaurant_id = ?'];
    const params = [rid];
    if (YMD.test(String(req.query.from || ''))) { where.push('p.purchase_date >= ?'); params.push(req.query.from); }
    if (YMD.test(String(req.query.to || ''))) { where.push('p.purchase_date <= ?'); params.push(req.query.to); }
    if (req.query.supplier_id) { where.push('p.supplier_id = ?'); params.push(Number(req.query.supplier_id)); }
    const status = String(req.query.payment_status || '').toUpperCase();
    if (['UNPAID', 'PARTIAL', 'PAID'].includes(status)) { where.push(`p.payment_status = ? AND p.status <> 'VOID'`); params.push(status); }
    if (status === 'DUE') where.push(`p.payment_status <> 'PAID' AND p.status <> 'VOID'`);
    if (status === 'VOID') where.push(`p.status = 'VOID'`);
    const rows = await q(
      `SELECT p.*, COALESCE(s.name, p.supplier_name) AS supplier_display_name,
         (SELECT COUNT(*) FROM inventory_purchase_items i WHERE i.purchase_id = p.id) AS line_count
       FROM inventory_purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.purchase_date DESC, p.id DESC LIMIT 500`, params
    );
    const list = rows.map(purchaseRow);
    const live = list.filter((p) => p.status !== 'VOID');
    return sendSuccess(res, {
      purchases: list,
      summary: {
        bills: live.length,
        total: r2(live.reduce((s, p) => s + p.total_amount, 0)),
        paid: r2(live.reduce((s, p) => s + p.amount_paid, 0)),
        outstanding: r2(live.reduce((s, p) => s + p.balance, 0)),
        overdue: live.filter((p) => p.is_overdue).length
      }
    }, 'Purchases loaded');
  } catch (err) {
    next(err);
  }
}

async function loadPurchase(rid, id, ex = pool) {
  const rows = await q(
    `SELECT p.*, COALESCE(s.name, p.supplier_name) AS supplier_display_name, s.gstin AS supplier_gstin, s.phone AS supplier_phone
     FROM inventory_purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ? AND p.restaurant_id = ?`, [id, rid], ex
  );
  if (!rows.length) return null;
  const lines = await q(
    `SELECT pi.*, ii.item_name, ii.unit, b.batch_number, b.current_quantity AS batch_remaining
     FROM inventory_purchase_items pi JOIN inventory_items ii ON ii.id = pi.inventory_item_id
     LEFT JOIN inventory_batches b ON b.id = pi.batch_id
     WHERE pi.purchase_id = ? ORDER BY pi.id`, [id], ex
  );
  const payments = await q(`SELECT * FROM inventory_purchase_payments WHERE purchase_id = ? ORDER BY paid_on, id`, [id], ex);
  return {
    ...purchaseRow(rows[0]),
    lines: lines.map((l) => ({
      ...l, quantity: r3(l.quantity), unit_price: r2(l.unit_price), tax_percent: Number(l.tax_percent), line_total: r2(l.line_total),
      tax_amount: r2(l.tax_amount), expiry_date: l.expiry_date ? ymdOf(l.expiry_date) : null,
      batch_remaining: l.batch_remaining == null ? null : r3(l.batch_remaining)
    })),
    payments: payments.map((p) => ({ ...p, amount: r2(p.amount), paid_on: ymdOf(p.paid_on) }))
  };
}

async function getPurchase(req, res, next) {
  try {
    await ensureInventorySchema();
    const p = await loadPurchase(restaurantOf(req), req.params.id);
    if (!p) return sendError(res, 'Purchase not found', 404);
    return sendSuccess(res, p, 'Purchase loaded');
  } catch (err) {
    next(err);
  }
}

/**
 * A supplier bill. Each line receives stock as a new batch (earliest expiry is used first), so the
 * bill, the stock and the ingredient cost stay in step. Optional amount_paid records a payment.
 */
async function createPurchase(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const b = req.body || {};
    const purchaseDate = YMD.test(String(b.purchase_date || '')) ? b.purchase_date : businessDate();
    if (purchaseDate > addDaysYmd(businessDate(), 1)) return sendError(res, 'The bill date cannot be in the future', 400);
    const dueDate = YMD.test(String(b.due_date || '')) ? b.due_date : null;
    if (dueDate && dueDate < purchaseDate) return sendError(res, 'The due date cannot be before the bill date', 400);
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!lines.length) return sendError(res, 'Add at least one item to the bill', 400);
    if (lines.length > 100) return sendError(res, 'A bill can have at most 100 lines', 400);
    const otherCharges = r2(Math.max(0, Number(b.other_charges || 0)));
    const paidNow = r2(Math.max(0, Number(b.amount_paid || 0)));
    const method = PAY_METHODS.includes(String(b.payment_method || '').toUpperCase()) ? String(b.payment_method).toUpperCase() : 'CASH';

    await conn.beginTransaction();
    let supplierId = null;
    let supplierName = text(b.supplier_name, 150);
    if (b.supplier_id) {
      const [s] = await q(`SELECT id, name FROM suppliers WHERE id = ? AND restaurant_id = ?`, [b.supplier_id, rid], conn);
      if (!s) { await conn.rollback(); return sendError(res, 'Supplier not found', 400); }
      supplierId = s.id;
      supplierName = s.name;
    }
    if (!supplierName) { await conn.rollback(); return sendError(res, 'Choose a supplier', 400); }
    const invoice = text(b.invoice_number, 60);
    if (invoice) {
      const dup = await q(
        `SELECT id FROM inventory_purchases WHERE restaurant_id = ? AND status <> 'VOID' AND invoice_number = ? AND (supplier_id <=> ?) AND supplier_name = ?`,
        [rid, invoice, supplierId, supplierName], conn
      );
      if (dup.length) { await conn.rollback(); return sendError(res, `Bill ${invoice} from ${supplierName} is already recorded`, 409); }
    }

    const checked = [];
    for (const [i, l] of lines.entries()) {
      const item = await itemOf(conn, rid, l.inventory_item_id, true);
      if (!item) { await conn.rollback(); return sendError(res, `Line ${i + 1}: ingredient not found`, 400); }
      const qty = r3(l.quantity);
      const price = r2(l.unit_price);
      const taxPct = Math.min(28, Math.max(0, Number(l.tax_percent || 0)));
      if (!(qty > 0)) { await conn.rollback(); return sendError(res, `Line ${i + 1} (${item.item_name}): enter the quantity`, 400); }
      if (!(price >= 0)) { await conn.rollback(); return sendError(res, `Line ${i + 1} (${item.item_name}): enter the price`, 400); }
      const expiry = YMD.test(String(l.expiry_date || '')) ? l.expiry_date : addDaysYmd(purchaseDate, 365);
      if (expiry < purchaseDate) { await conn.rollback(); return sendError(res, `Line ${i + 1} (${item.item_name}): expiry is before the bill date`, 400); }
      const lineTotal = r2(qty * price);
      checked.push({ item, qty, price, taxPct, expiry, lineTotal, tax: r2(lineTotal * taxPct / 100) });
    }
    const subtotal = r2(checked.reduce((s, l) => s + l.lineTotal, 0));
    const tax = r2(checked.reduce((s, l) => s + l.tax, 0));
    const total = r2(subtotal + tax + otherCharges);
    if (paidNow > total + 0.004) { await conn.rollback(); return sendError(res, 'Paid amount is more than the bill total', 400); }

    const ins = await q(
      `INSERT INTO inventory_purchases (restaurant_id, supplier_id, supplier_name, invoice_number, purchase_date, due_date, subtotal, tax_amount,
         other_charges, total_amount, amount_paid, payment_status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, supplierId, supplierName, invoice, purchaseDate, dueDate, subtotal, tax, otherCharges, total, paidNow, payStatus(total, paidNow), text(b.notes, 500), req.user?.id || null],
      conn
    );
    const purchaseId = ins.insertId;
    for (const [i, l] of checked.entries()) {
      // Landed cost per unit: price + its GST (not claimable on the 5% scheme) + a share of transport etc.
      const share = subtotal > 0 ? otherCharges * (l.lineTotal / subtotal) : otherCharges / checked.length;
      const landed = r2((l.lineTotal + l.tax + share) / l.qty);
      const batch = await q(
        `INSERT INTO inventory_batches (inventory_item_id, batch_number, supplier_id, supplier_name, initial_quantity, current_quantity, unit_price, purchase_date, expiry_date, notes, purchase_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [l.item.id, `PB${purchaseId}-${i + 1}`, supplierId, supplierName, l.qty, l.qty, landed, purchaseDate, l.expiry,
          invoice ? `Bill ${invoice}` : `Purchase #${purchaseId}`, purchaseId],
        conn
      );
      await q(
        `INSERT INTO inventory_purchase_items (purchase_id, inventory_item_id, batch_id, quantity, unit_price, tax_percent, line_total, tax_amount, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [purchaseId, l.item.id, batch.insertId, l.qty, l.price, l.taxPct, l.lineTotal, l.tax, l.expiry], conn
      );
      await q(
        `INSERT INTO stock_transactions (inventory_item_id, batch_id, change_quantity, type, reference_id, notes) VALUES (?, ?, ?, 'RESTOCK', ?, ?)`,
        [l.item.id, batch.insertId, l.qty, `PURCHASE_${purchaseId}_${i + 1}`, `${supplierName}${invoice ? ` bill ${invoice}` : ''}`], conn
      );
    }
    for (const id of new Set(checked.map((l) => l.item.id))) {
      await syncItemStock(conn, id);
      await refreshItemCost(conn, id);
    }
    if (paidNow > 0) {
      await q(
        `INSERT INTO inventory_purchase_payments (purchase_id, amount, method, reference, paid_on, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [purchaseId, paidNow, method, text(b.payment_reference, 80), purchaseDate, req.user?.id || null], conn
      );
    }
    await conn.commit();
    require('../../services/StockAlertService').checkInventoryItems([...new Set(checked.map((l) => l.item.id))], rid);
    const purchase = await loadPurchase(rid, purchaseId);
    return sendSuccess(res, purchase, `Bill recorded: ${checked.length} item${checked.length === 1 ? '' : 's'} added to stock`, 201);
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
}

async function recordPurchasePayment(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const b = req.body || {};
    const amount = r2(b.amount);
    if (!(amount > 0)) return sendError(res, 'Enter the amount paid', 400);
    const method = PAY_METHODS.includes(String(b.method || '').toUpperCase()) ? String(b.method).toUpperCase() : 'CASH';
    const paidOn = YMD.test(String(b.paid_on || '')) ? b.paid_on : businessDate();
    await conn.beginTransaction();
    const [p] = await q(`SELECT * FROM inventory_purchases WHERE id = ? AND restaurant_id = ? FOR UPDATE`, [req.params.id, rid], conn);
    if (!p) { await conn.rollback(); return sendError(res, 'Purchase not found', 404); }
    if (p.status === 'VOID') { await conn.rollback(); return sendError(res, 'This bill was voided', 400); }
    const balance = r2(Number(p.total_amount) - Number(p.amount_paid));
    if (amount > balance + 0.004) { await conn.rollback(); return sendError(res, `Only ₹${balance.toFixed(2)} is due on this bill`, 400); }
    await q(
      `INSERT INTO inventory_purchase_payments (purchase_id, amount, method, reference, paid_on, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, amount, method, text(b.reference, 80), paidOn, req.user?.id || null], conn
    );
    const paid = r2(Number(p.amount_paid) + amount);
    await q(`UPDATE inventory_purchases SET amount_paid = ?, payment_status = ? WHERE id = ?`, [paid, payStatus(Number(p.total_amount), paid), p.id], conn);
    await conn.commit();
    return sendSuccess(res, await loadPurchase(rid, p.id), `₹${amount.toFixed(2)} payment recorded`);
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
}

/** Void a bill entered by mistake: only while none of its stock has been used. */
async function voidPurchase(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    await conn.beginTransaction();
    const [p] = await q(`SELECT * FROM inventory_purchases WHERE id = ? AND restaurant_id = ? FOR UPDATE`, [req.params.id, rid], conn);
    if (!p) { await conn.rollback(); return sendError(res, 'Purchase not found', 404); }
    if (p.status === 'VOID') { await conn.rollback(); return sendError(res, 'This bill is already voided', 400); }
    if (Number(p.amount_paid) > 0) { await conn.rollback(); return sendError(res, 'Payments were made on this bill; it cannot be voided', 400); }
    const batches = await q(
      `SELECT b.id, b.inventory_item_id, b.initial_quantity, b.current_quantity, ii.item_name FROM inventory_batches b
       JOIN inventory_items ii ON ii.id = b.inventory_item_id WHERE b.purchase_id = ? FOR UPDATE`, [p.id], conn
    );
    const used = batches.find((x) => Math.abs(Number(x.initial_quantity) - Number(x.current_quantity)) > 0.0005);
    if (used) { await conn.rollback(); return sendError(res, `Some ${used.item_name} from this bill was already used; record a correction instead`, 400); }
    for (const x of batches) {
      await q(
        `INSERT INTO stock_transactions (inventory_item_id, batch_id, change_quantity, type, reference_id, notes, reason) VALUES (?, NULL, ?, 'MANUAL_ADJUSTMENT', ?, ?, 'VOID')`,
        [x.inventory_item_id, -Number(x.current_quantity), `PURCHASE_VOID_${p.id}_${x.id}`, `Bill #${p.id} voided`], conn
      );
      await q(`UPDATE inventory_purchase_items SET batch_id = NULL WHERE batch_id = ?`, [x.id], conn);
      await q(`UPDATE stock_transactions SET batch_id = NULL WHERE batch_id = ?`, [x.id], conn);
      await q(`DELETE FROM inventory_batches WHERE id = ?`, [x.id], conn);
    }
    for (const id of new Set(batches.map((x) => x.inventory_item_id))) {
      await syncItemStock(conn, id);
      await refreshItemCost(conn, id);
    }
    await q(`UPDATE inventory_purchases SET status = 'VOID', void_reason = ? WHERE id = ?`, [text(req.body?.reason, 255) || 'Entered by mistake', p.id], conn);
    await conn.commit();
    require('../../services/StockAlertService').checkInventoryItems([...new Set(batches.map((x) => x.inventory_item_id))], rid);
    return sendSuccess(res, await loadPurchase(rid, p.id), 'Bill voided and its stock removed');
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------------------------
// REQ-055: food cost and margins
// ---------------------------------------------------------------------------------------------
/**
 * Every dish with its recipe cost (ingredients x current cost, plus recipe wastage %), selling
 * price before GST, margin and food-cost %. With from/to: the dishes sold in that period, what
 * their ingredients cost and the gross margin left.
 */
async function getFoodCost(req, res, next) {
  try {
    await ensureInventorySchema();
    const rid = restaurantOf(req);
    const target = Math.min(90, Math.max(5, Number(req.query.target) || 35));
    const items = await q(
      `SELECT m.id, m.name, m.price, m.discounted_price, m.is_available, c.name AS category_name, r.id AS recipe_id
       FROM menu_items m LEFT JOIN menu_categories c ON c.id = m.category_id LEFT JOIN recipes r ON r.menu_item_id = m.id
       WHERE m.restaurant_id = ? AND COALESCE(m.is_active, 1) = 1
       ORDER BY c.name, m.name`, [rid]
    );
    const recipeIds = items.filter((i) => i.recipe_id).map((i) => i.recipe_id);
    const ings = recipeIds.length ? await q(
      `SELECT ri.recipe_id, ri.quantity, ri.wastage_percentage, ii.id AS inventory_item_id, ii.item_name, ii.unit, ii.unit_cost, ii.restaurant_id
       FROM recipe_ingredients ri JOIN inventory_items ii ON ii.id = ri.inventory_item_id
       WHERE ri.recipe_id IN (?)`, [recipeIds]
    ) : [];
    const byRecipe = new Map();
    for (const g of ings) {
      if (!byRecipe.has(g.recipe_id)) byRecipe.set(g.recipe_id, []);
      byRecipe.get(g.recipe_id).push(g);
    }

    const dishes = items.map((m) => {
      const price = r2(Number(m.discounted_price) > 0 && Number(m.discounted_price) < Number(m.price) ? m.discounted_price : m.price);
      const parts = (byRecipe.get(m.recipe_id) || []).map((g) => {
        const qty = Number(g.quantity) * (1 + Number(g.wastage_percentage || 0) / 100);
        return {
          inventory_item_id: g.inventory_item_id, item_name: g.item_name, unit: g.unit,
          quantity: r3(qty), unit_cost: r2(g.unit_cost), cost: r2(qty * Number(g.unit_cost || 0)), missing_cost: !(Number(g.unit_cost) > 0)
        };
      });
      const cost = r2(parts.reduce((s, p) => s + p.cost, 0));
      const hasRecipe = parts.length > 0;
      const costPct = hasRecipe && price > 0 ? Math.round((cost / price) * 1000) / 10 : null;
      let flag = 'OK';
      if (!hasRecipe) flag = 'NO_RECIPE';
      else if (parts.some((p) => p.missing_cost)) flag = 'MISSING_COST';
      else if (price <= 0) flag = 'NO_PRICE';
      else if (cost >= price) flag = 'LOSS';
      else if (costPct > target) flag = 'HIGH_COST';
      return {
        menu_item_id: m.id, name: m.name, category_name: m.category_name, is_available: Number(m.is_available) !== 0,
        price, cost, margin: hasRecipe ? r2(price - cost) : null, food_cost_percent: costPct,
        margin_percent: costPct == null ? null : Math.round((100 - costPct) * 10) / 10,
        flag, ingredients: parts
      };
    });

    const costed = dishes.filter((d) => d.food_cost_percent != null && d.flag !== 'MISSING_COST');
    const summary = {
      target_percent: target,
      dishes: dishes.length,
      with_recipe: dishes.filter((d) => d.flag !== 'NO_RECIPE').length,
      above_target: dishes.filter((d) => d.flag === 'HIGH_COST' || d.flag === 'LOSS').length,
      missing_costs: dishes.filter((d) => d.flag === 'MISSING_COST').length,
      average_food_cost_percent: costed.length ? Math.round((costed.reduce((s, d) => s + d.food_cost_percent, 0) / costed.length) * 10) / 10 : null
    };

    // Period: what was sold, its ingredient cost and the gross margin (cancelled orders excluded).
    let period = null;
    if (req.query.from || req.query.to) {
      const { parseRange } = require('../salesReportController');
      let range;
      try { range = parseRange(req); } catch (e) { return sendError(res, e.message, e.statusCode || 400); }
      const sold = await q(
        `SELECT menu_item_id, MAX(name) AS name, SUM(qty) AS quantity, SUM(rev) AS revenue FROM (
           SELECT oi.menu_item_id, oi.item_name AS name, oi.quantity AS qty, COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0) AS rev
           FROM order_items oi JOIN orders o ON o.id = oi.order_id AND COALESCE(oi.order_source, 'ONLINE') = 'ONLINE'
           WHERE o.restaurant_id = ? AND COALESCE(o.payment_hold, 0) = 0 AND o.order_status NOT IN ('CANCELLED', 'REJECTED')
             AND o.created_at >= ? AND o.created_at < ?
           UNION ALL
           SELECT oi.menu_item_id, oi.item_name, oi.quantity, COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0)
           FROM order_items oi JOIN restaurant_orders ro ON ro.id = oi.order_id AND COALESCE(oi.order_source, 'OFFLINE') = 'OFFLINE'
           WHERE ro.restaurant_id = ? AND ro.order_status <> 'CANCELLED' AND ro.created_at >= ? AND ro.created_at < ?
         ) sold_lines GROUP BY menu_item_id`,
        [rid, range.start, range.end, rid, range.start, range.end]
      );
      const dishById = new Map(dishes.map((d) => [d.menu_item_id, d]));
      const lines = sold.map((s) => {
        const d = dishById.get(s.menu_item_id);
        const qty = Number(s.quantity || 0);
        const revenue = r2(s.revenue);
        const costed = Boolean(d && d.flag !== 'NO_RECIPE');
        const cost = costed ? r2(d.cost * qty) : null;
        return {
          menu_item_id: s.menu_item_id, name: d?.name || s.name, quantity: qty, revenue, cost,
          margin: cost == null ? null : r2(revenue - cost),
          food_cost_percent: cost != null && revenue > 0 ? Math.round((cost / revenue) * 1000) / 10 : null
        };
      }).sort((a, b) => b.revenue - a.revenue);
      const withCost = lines.filter((l) => l.cost != null);
      const revenue = r2(lines.reduce((s, l) => s + l.revenue, 0));
      const costedRevenue = r2(withCost.reduce((s, l) => s + l.revenue, 0));
      const cost = r2(withCost.reduce((s, l) => s + l.cost, 0));
      const [waste] = await q(
        `SELECT COALESCE(SUM(ABS(st.change_quantity) * ii.unit_cost), 0) AS value FROM stock_transactions st
         JOIN inventory_items ii ON ii.id = st.inventory_item_id
         WHERE ii.restaurant_id = ? AND st.type IN ('WASTAGE', 'EXPIRED_DISPOSAL') AND st.created_at >= ? AND st.created_at < ?`,
        [rid, range.start, range.end]
      );
      const [bought] = await q(
        `SELECT COALESCE(SUM(total_amount), 0) AS value FROM inventory_purchases
         WHERE restaurant_id = ? AND status <> 'VOID' AND purchase_date BETWEEN ? AND ?`, [rid, range.from, range.to]
      );
      period = {
        from: range.from, to: range.to,
        revenue, costed_revenue: costedRevenue, ingredient_cost: cost,
        gross_margin: r2(costedRevenue - cost),
        food_cost_percent: costedRevenue > 0 ? Math.round((cost / costedRevenue) * 1000) / 10 : null,
        uncosted_revenue: r2(revenue - costedRevenue),
        wastage_value: r2(waste.value),
        purchases_value: r2(bought.value),
        items: lines
      };
    }
    return sendSuccess(res, { summary, dishes, period }, 'Food cost loaded');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ensureInventorySchema,
  syncItemStock,
  refreshItemCost,
  updateInventoryItem,
  adjustStock,
  listSuppliers,
  createSupplier,
  updateSupplier,
  listPurchases,
  getPurchase,
  createPurchase,
  recordPurchasePayment,
  voidPurchase,
  getFoodCost
};
