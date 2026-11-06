/**
 * OrderLifecycleService
 * What happens around an online order beyond its status: database columns it needs, handing
 * a paid order to the restaurant, stock, refunds on cancellation, and cleaning up checkouts
 * whose online payment never completed.
 *
 * Requirements: REQ-003 item stock, REQ-006 cancellation & refunds, REQ-024 failed payments,
 * REQ-025 duplicate prevention.
 */
const { query } = require('../config/db');

let schemaPromise = null;

// information_schema (not SHOW ... LIKE ?) because query() uses prepared statements
async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.n) > 0;
}

async function indexExists(table, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return Number(rows[0]?.n) > 0;
}

async function addColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

function ensureOrderSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      // Duplicate prevention: one order per checkout attempt (key sent by the browser)
      await addColumn('orders', 'idempotency_key', 'VARCHAR(64) NULL DEFAULT NULL');
      if (!(await indexExists('orders', 'uniq_orders_idempotency'))) {
        await query('ALTER TABLE orders ADD UNIQUE INDEX uniq_orders_idempotency (restaurant_id, idempotency_key)');
      }
      // Online-payment orders are held back from the restaurant until the payment is verified
      await addColumn('orders', 'payment_hold', 'TINYINT(1) NOT NULL DEFAULT 0');
      await addColumn('orders', 'cancelled_reason', 'VARCHAR(255) NULL DEFAULT NULL');
      // REQ-008: online orders are DELIVERY or TAKEAWAY (pickup); dine-in lives in restaurant_orders
      await addColumn('orders', 'order_type', "VARCHAR(20) NOT NULL DEFAULT 'DELIVERY'");
      // REQ-027: GST rate used for this order (the restaurant's rate may change later)
      await addColumn('orders', 'tax_rate', 'DECIMAL(5,2) NULL DEFAULT NULL');
      await addColumn('restaurants', 'gstin', 'VARCHAR(20) NULL DEFAULT NULL');
      await addColumn('restaurants', 'fssai_number', 'VARCHAR(20) NULL DEFAULT NULL');
      await addColumn('restaurants', 'is_takeaway_enabled', 'TINYINT(1) NOT NULL DEFAULT 1');
      // REQ-033: how an online/COD payment was actually made (UPI, CARD, CASH, NETBANKING…)
      await addColumn('payments', 'method_detail', 'VARCHAR(30) NULL DEFAULT NULL');
      await require('./CouponService').ensureCouponSchema();
      // REQ-001: breakfast / lunch / dinner menus
      await addColumn('restaurants', 'meal_schedule_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
      await addColumn('restaurants', 'meal_periods_json', 'TEXT NULL');
      await addColumn('menu_items', 'meal_periods', 'VARCHAR(40) NULL DEFAULT NULL');
      await addColumn('categories', 'meal_periods', 'VARCHAR(40) NULL DEFAULT NULL');

      // Online orders (orders) and dine-in orders (restaurant_orders) both keep their lines in
      // order_items keyed only by order_id, and their ids overlapped (online #5 and dine-in #5
      // shared item rows). Label every row with its source and keep new dine-in ids far apart.
      await addColumn('order_items', 'order_source', 'VARCHAR(10) NULL DEFAULT NULL');
      if (!(await indexExists('order_items', 'idx_order_items_source'))) {
        await query('ALTER TABLE order_items ADD INDEX idx_order_items_source (order_id, order_source)');
      }
      // Existing rows: an item is written in the same request as its order, so its created_at
      // sits next to its parent's. Where both tables have that id, the closer timestamp wins.
      await query(`
        UPDATE order_items oi
        LEFT JOIN orders o ON o.id = oi.order_id
        LEFT JOIN restaurant_orders ro ON ro.id = oi.order_id
        SET oi.order_source = CASE
          WHEN ro.id IS NULL THEN 'ONLINE'
          WHEN o.id IS NULL THEN 'OFFLINE'
          WHEN ABS(TIMESTAMPDIFF(SECOND, oi.created_at, o.created_at))
               <= ABS(TIMESTAMPDIFF(SECOND, oi.created_at, ro.created_at)) THEN 'ONLINE'
          ELSE 'OFFLINE' END
        WHERE oi.order_source IS NULL`);
      // (MAX(id), not information_schema.AUTO_INCREMENT: MySQL 8 caches that figure for a day)
      const [maxRow] = await query('SELECT COALESCE(MAX(id), 0) AS max_id FROM restaurant_orders');
      if (Number(maxRow?.max_id) < 10000000) {
        await query('ALTER TABLE restaurant_orders AUTO_INCREMENT = 10000000');
      }

      // Item-wise stock: NULL = not tracked (unlimited)
      await addColumn('menu_items', 'stock_quantity', 'INT NULL DEFAULT NULL');

      // Payments are shared by online orders (orders) and dine-in orders (restaurant_orders);
      // order_source tells them apart because their ids overlap.
      await addColumn('payments', 'order_source', "VARCHAR(10) NULL DEFAULT NULL");
      await addColumn('payments', 'failure_reason', 'VARCHAR(255) NULL DEFAULT NULL');

      await query(`CREATE TABLE IF NOT EXISTS refunds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NULL,
        order_id INT NOT NULL,
        order_source VARCHAR(10) NOT NULL DEFAULT 'ONLINE',
        payment_id INT NULL,
        amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL',
        status ENUM('PENDING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
        gateway_refund_id VARCHAR(100) NULL,
        reference VARCHAR(150) NULL,
        reason VARCHAR(255) NULL,
        failure_reason VARCHAR(255) NULL,
        created_by_user_id INT NULL,
        processed_by_user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL,
        INDEX idx_refunds_order (order_source, order_id),
        INDEX idx_refunds_restaurant (restaurant_id, status)
      )`);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

/**
 * Tell the restaurant (sound + notification), the kitchen (KOT) and the delivery fleet about an
 * order. COD orders are released when placed; online-payment orders only once paid.
 */
async function releaseOrderToRestaurant(orderId) {
  const { sendNotification, getSocketIO } = require('./NotificationService');
  const { notifyKitchen } = require('./KitchenIntegrationService');

  const [order] = await query(
    `SELECT o.*, r.name AS restaurant_name FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.id = ?`,
    [orderId]
  );
  if (!order) return false;
  const items = await query('SELECT * FROM order_items WHERE order_id = ? AND COALESCE(order_source, "ONLINE") = "ONLINE"', [orderId]);
  const total = parseFloat(order.total_amount);
  const paidNote = order.payment_method === 'ONLINE' ? ' (paid online)' : '';

  await sendNotification({
    restaurantId: order.restaurant_id,
    orderId,
    title: `New Order! #${order.order_number}`,
    message: `New order from ${order.customer_name} - ₹${total}${paidNote}`,
    type: 'NEW_ORDER'
  });

  await sendNotification({
    orderId,
    customerIdentityId: order.customer_identity_id,
    title: 'Order Placed Successfully!',
    message: `Your order #${order.order_number} for ₹${total} has been placed.`
  });
  // REQ-010 / REQ-026: confirmation on WhatsApp (in the background)
  require('./WhatsAppOrderService').sendOrderUpdate(orderId, 'PLACED');

  try {
    await notifyKitchen({
      id: orderId,
      order_number: order.order_number,
      restaurant_id: order.restaurant_id,
      items,
      order_type: 'ONLINE'
    });
  } catch (kErr) {
    console.warn('[OrderLifecycle] Kitchen dispatch warning:', kErr.message);
  }

  try {
    const io = getSocketIO();
    // Takeaway orders are collected by the customer: no delivery partner needed
    if (io && order.order_type !== 'TAKEAWAY') {
      io.to([`restaurant_drivers_${order.restaurant_id}`, `restaurant_${order.restaurant_id}`]).emit('available_orders_updated', {
        orderId,
        orderNumber: order.order_number,
        restaurantId: order.restaurant_id,
        restaurantName: order.restaurant_name,
        customerName: order.customer_name,
        totalAmount: total,
        deliveryAddress: order.delivery_address,
        createdAt: order.created_at
      });
    }
  } catch (dErr) {
    console.warn('[OrderLifecycle] Driver dispatch warning:', dErr.message);
  }
  return true;
}

/**
 * Called once when an online payment is verified: clears the hold and releases the order.
 * Returns false if the order was not on hold (already released).
 */
async function releasePaidOrder(orderId) {
  const res = await query(`UPDATE orders SET payment_hold = 0 WHERE id = ? AND payment_hold = 1`, [orderId]);
  if (!res.affectedRows) return false;
  await query(
    `INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id) VALUES (?, 'PENDING', 'Online payment received. Order sent to the restaurant.', NULL)`,
    [orderId]
  );
  await releaseOrderToRestaurant(orderId);
  return true;
}

/** Put back the stock an order took (only for items whose stock is tracked). */
async function restoreStock(orderId) {
  const items = await query('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ? AND COALESCE(order_source, "ONLINE") = "ONLINE"', [orderId]);
  for (const it of items) {
    if (!it.menu_item_id) continue;
    await query(
      `UPDATE menu_items SET stock_quantity = stock_quantity + ? WHERE id = ? AND stock_quantity IS NOT NULL`,
      [it.quantity, it.menu_item_id]
    );
  }
  await require('./StockAlertService').checkMenuItems(items.map((it) => it.menu_item_id), null);
}

/**
 * Refund the successful online payment(s) of an online order. Tries the Razorpay refund API;
 * when that is not possible the refund is recorded as PENDING for the admin to complete.
 */
async function refundOnlineOrder(order, { reason = 'Order cancelled', userId = null } = {}) {
  const payments = await query(
    `SELECT * FROM payments
     WHERE order_id = ? AND (order_source = 'ONLINE' OR order_source IS NULL)
       AND status = 'SUCCESS' AND payment_method <> 'COD'`,
    [order.id]
  );
  if (payments.length === 0) return [];

  const PaymentService = require('./PaymentService');
  const results = [];
  for (const pay of payments) {
    const [existing] = await query(
      `SELECT id FROM refunds WHERE payment_id = ? AND status IN ('PENDING','PROCESSED') LIMIT 1`,
      [pay.id]
    );
    if (existing) continue;

    const amount = parseFloat(pay.amount);
    const ins = await query(
      `INSERT INTO refunds (restaurant_id, order_id, order_source, payment_id, amount, method, status, reason, created_by_user_id)
       VALUES (?, ?, 'ONLINE', ?, ?, 'ORIGINAL', 'PENDING', ?, ?)`,
      [order.restaurant_id, order.id, pay.id, amount, reason, userId]
    );
    const refundId = ins.insertId;

    let outcome = { status: 'PENDING' };
    try {
      outcome = await PaymentService.refundGatewayPayment(order.restaurant_id, pay, amount, reason);
    } catch (err) {
      outcome = { status: 'PENDING', failureReason: err.message };
    }

    if (outcome.status === 'PROCESSED') {
      await query(
        `UPDATE refunds SET status = 'PROCESSED', gateway_refund_id = ?, processed_at = NOW() WHERE id = ?`,
        [outcome.gatewayRefundId || null, refundId]
      );
      await query(`UPDATE payments SET status = 'REFUNDED' WHERE id = ?`, [pay.id]);
    } else if (outcome.failureReason) {
      await query(`UPDATE refunds SET failure_reason = ? WHERE id = ?`, [String(outcome.failureReason).slice(0, 250), refundId]);
    }
    results.push({ refundId, amount, status: outcome.status });
  }

  const allDone = results.length > 0 && results.every((r) => r.status === 'PROCESSED');
  if (allDone) {
    await query(`UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ?`, [order.id]);
    require('./WhatsAppOrderService').sendOrderUpdate(order.id, 'REFUNDED', { amount: results.reduce((s, r) => s + Number(r.amount || 0), 0) });
  }
  return results;
}

/**
 * Everything that must happen when an online order is cancelled or rejected:
 * stock goes back, a paid order is refunded, and the reason is kept.
 */
async function onOrderClosed(order, { status, reason = '', userId = null } = {}) {
  await ensureOrderSchema();
  if (reason) {
    await query(`UPDATE orders SET cancelled_reason = ? WHERE id = ?`, [String(reason).slice(0, 250), order.id]);
  }
  try {
    await restoreStock(order.id);
  } catch (e) {
    console.warn('[OrderLifecycle] stock restore warning:', e.message);
  }
  try {
    await require('./CouponService').reverseForOrder(order.id);
  } catch (e) {
    console.warn('[OrderLifecycle] coupon reversal warning:', e.message);
  }
  let refunds = [];
  if (order.payment_method === 'ONLINE' && order.payment_status === 'COMPLETED') {
    refunds = await refundOnlineOrder(order, {
      reason: reason || (status === 'REJECTED' ? 'Order rejected by restaurant' : 'Order cancelled'),
      userId
    });
  } else if (order.payment_method === 'ONLINE' && order.payment_status === 'PENDING') {
    // Payment never completed: make sure nothing still counts it as payable
    await query(`UPDATE orders SET payment_status = 'FAILED' WHERE id = ? AND payment_status = 'PENDING'`, [order.id]);
    await query(
      `UPDATE payments SET status = 'FAILED', failure_reason = 'Order cancelled before payment'
       WHERE order_id = ? AND (order_source = 'ONLINE' OR order_source IS NULL) AND status = 'PENDING'`,
      [order.id]
    );
  }
  return { refunds };
}

/**
 * Online-payment checkouts that were never paid are cancelled after `minutes`, so they never
 * linger as pending orders. Only orders created on hold (payment_hold = 1) are touched.
 */
async function cancelAbandonedOnlineOrders(minutes = 30) {
  await ensureOrderSchema();
  const OrderService = require('./OrderService');
  const stale = await query(
    `SELECT id FROM orders
     WHERE payment_hold = 1 AND order_status = 'PENDING'
       AND payment_status IN ('PENDING','FAILED')
       AND created_at < (NOW() - INTERVAL ? MINUTE)
     LIMIT 50`,
    [minutes]
  );
  for (const row of stale) {
    try {
      await OrderService.updateOrderStatus(row.id, 'CANCELLED', null, `Online payment was not completed within ${minutes} minutes.`);
    } catch (err) {
      console.warn(`[OrderLifecycle] could not cancel abandoned order ${row.id}:`, err.message);
    }
  }
  return stale.length;
}

module.exports = {
  ensureOrderSchema,
  releaseOrderToRestaurant,
  releasePaidOrder,
  restoreStock,
  refundOnlineOrder,
  onOrderClosed,
  cancelAbandonedOnlineOrders
};
