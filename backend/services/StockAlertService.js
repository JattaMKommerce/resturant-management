/**
 * Low-stock alerts (REQ-039).
 *
 * - Ingredients (inventory_items): alert when current_stock falls to or below min_stock_alert.
 * - Dishes with tracked portions (menu_items.stock_quantity): alert when portions fall to or below
 *   low_stock_threshold (default 5), and again when the dish sells out.
 *
 * Each item alerts once per drop: *_alerted_at is set when the alert goes out and cleared when
 * stock is back above the level, so restocking re-arms it and staff are not spammed.
 */
const { query } = require('../config/db');

const DEFAULT_DISH_THRESHOLD = 5;
let schemaPromise = null;

async function hasColumn(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.n) > 0;
}

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      if (!(await hasColumn('inventory_items', 'low_stock_alerted_at'))) {
        await query('ALTER TABLE inventory_items ADD COLUMN low_stock_alerted_at DATETIME NULL DEFAULT NULL');
      }
      if (!(await hasColumn('menu_items', 'low_stock_threshold'))) {
        await query('ALTER TABLE menu_items ADD COLUMN low_stock_threshold INT NULL DEFAULT NULL');
      }
      if (!(await hasColumn('menu_items', 'low_stock_alerted_at'))) {
        await query('ALTER TABLE menu_items ADD COLUMN low_stock_alerted_at DATETIME NULL DEFAULT NULL');
      }
      if (!(await hasColumn('menu_items', 'sold_out_alerted_at'))) {
        await query('ALTER TABLE menu_items ADD COLUMN sold_out_alerted_at DATETIME NULL DEFAULT NULL');
      }
    })().catch((err) => { schemaPromise = null; throw err; });
  }
  return schemaPromise;
}

function notify(restaurantId, title, message, type) {
  const { sendNotification } = require('./NotificationService');
  return sendNotification({ restaurantId, title, message, type }).catch((e) =>
    console.warn('[StockAlert] notification failed:', e.message));
}

const fmtQty = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
};

/** Check ingredients after their stock changed. restaurantId: who to alert (inventory is shared). */
async function checkInventoryItems(itemIds, restaurantId = 1) {
  const ids = [...new Set((itemIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return [];
  try {
    await ensureSchema();
    const rows = await query(
      `SELECT id, item_name, unit, current_stock, min_stock_alert, low_stock_alerted_at
       FROM inventory_items WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    const alerted = [];
    for (const it of rows) {
      const min = Number(it.min_stock_alert || 0);
      const stock = Number(it.current_stock || 0);
      if (min > 0 && stock <= min) {
        if (!it.low_stock_alerted_at) {
          const upd = await query(`UPDATE inventory_items SET low_stock_alerted_at = NOW() WHERE id = ? AND low_stock_alerted_at IS NULL`, [it.id]);
          if (upd.affectedRows) {
            await notify(restaurantId, `Low stock: ${it.item_name}`,
              `${it.item_name} is down to ${fmtQty(stock)} ${it.unit || ''} (minimum ${fmtQty(min)}). Please restock.`.replace(/\s+\(/, ' ('), 'LOW_STOCK');
            alerted.push(it.id);
          }
        }
      } else if (it.low_stock_alerted_at) {
        await query(`UPDATE inventory_items SET low_stock_alerted_at = NULL WHERE id = ?`, [it.id]);
      }
    }
    return alerted;
  } catch (err) {
    console.warn('[StockAlert] inventory check failed:', err.message);
    return [];
  }
}

/** Check dishes with tracked portions after an order took (or a cancel returned) stock. */
async function checkMenuItems(menuItemIds, restaurantId) {
  const ids = [...new Set((menuItemIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return [];
  try {
    await ensureSchema();
    const rows = await query(
      `SELECT id, name, restaurant_id, stock_quantity, low_stock_threshold, low_stock_alerted_at, sold_out_alerted_at
       FROM menu_items WHERE id IN (${ids.map(() => '?').join(',')}) AND stock_quantity IS NOT NULL`,
      ids
    );
    const alerted = [];
    for (const it of rows) {
      const rid = it.restaurant_id || restaurantId;
      const stock = Number(it.stock_quantity);
      const threshold = it.low_stock_threshold != null ? Number(it.low_stock_threshold) : DEFAULT_DISH_THRESHOLD;
      if (stock <= 0) {
        if (!it.sold_out_alerted_at) {
          const upd = await query(`UPDATE menu_items SET sold_out_alerted_at = NOW(), low_stock_alerted_at = COALESCE(low_stock_alerted_at, NOW()) WHERE id = ? AND sold_out_alerted_at IS NULL`, [it.id]);
          if (upd.affectedRows) {
            await notify(rid, `Sold out: ${it.name}`, `${it.name} has sold out and is hidden from the online menu. Add portions in Menu Items to sell it again.`, 'SOLD_OUT');
            alerted.push(it.id);
          }
        }
      } else if (stock <= threshold) {
        if (it.sold_out_alerted_at) await query(`UPDATE menu_items SET sold_out_alerted_at = NULL WHERE id = ?`, [it.id]);
        if (!it.low_stock_alerted_at) {
          const upd = await query(`UPDATE menu_items SET low_stock_alerted_at = NOW() WHERE id = ? AND low_stock_alerted_at IS NULL`, [it.id]);
          if (upd.affectedRows) {
            await notify(rid, `Low stock: ${it.name}`, `Only ${stock} portion${stock === 1 ? '' : 's'} of ${it.name} left.`, 'LOW_STOCK');
            alerted.push(it.id);
          }
        }
      } else if (it.low_stock_alerted_at || it.sold_out_alerted_at) {
        await query(`UPDATE menu_items SET low_stock_alerted_at = NULL, sold_out_alerted_at = NULL WHERE id = ?`, [it.id]);
      }
    }
    return alerted;
  } catch (err) {
    console.warn('[StockAlert] menu check failed:', err.message);
    return [];
  }
}

module.exports = { ensureSchema, checkInventoryItems, checkMenuItems, DEFAULT_DISH_THRESHOLD };
