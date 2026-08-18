const pool = require('../../config/database');
const orderService = require('../../services/kot/orderService');
const { sendSuccess, sendError } = require('../../utils/response');
const { emitToRoom, broadcastEvent } = require('../../config/socket');

async function createOrderHandler(req, res, next) {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotency_key;
    const result = await orderService.createOrder(req.body, idempotencyKey);

    if (result.isDuplicate) {
      return sendSuccess(res, result.order, 'Order already processed (Idempotent response)', 200);
    }

    return sendSuccess(res, result.order, 'Order placed and KOTs generated successfully', 201);
  } catch (err) {
    return sendError(res, err.message || 'Failed to place order', 400);
  }
}

async function getOrders(req, res, next) {
  try {
    const { status, table_id, order_type, search } = req.query;
    let query = `
      SELECT o.*, t.table_number, t.table_name, r.room_number,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as total_items_count
      FROM restaurant_orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN rooms r ON o.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND o.order_status = ?`;
      params.push(status);
    }
    if (table_id) {
      query += ` AND o.table_id = ?`;
      params.push(table_id);
    }
    if (order_type) {
      query += ` AND o.order_type = ?`;
      params.push(order_type);
    }
    if (search) {
      query += ` AND (o.order_number LIKE ? OR o.customer_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY o.created_at DESC`;

    const [orders] = await pool.query(query, params);
    return sendSuccess(res, orders, 'Orders fetched successfully');
  } catch (err) {
    next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const [orders] = await pool.query(
      `SELECT o.*, t.table_number, t.table_name, r.room_number
       FROM restaurant_orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       LEFT JOIN rooms r ON o.room_id = r.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }

    const order = orders[0];

    // Fetch order items & modifiers
    const [items] = await pool.query(
      `SELECT oi.*, k.name as kitchen_department_name
       FROM order_items oi
       JOIN kitchen_departments k ON oi.kitchen_department_id = k.id
       WHERE oi.order_id = ?`,
      [order.id]
    );

    for (let item of items) {
      const [mods] = await pool.query(
        `SELECT option_name, price_adjustment FROM order_item_modifiers WHERE order_item_id = ?`,
        [item.id]
      );
      item.modifiers = mods;
    }
    order.items = items;

    // Fetch KOTs
    const [kots] = await pool.query(
      `SELECT k.*, kd.name as kitchen_department_name, kd.code as kitchen_department_code
       FROM kots k
       JOIN kitchen_departments kd ON k.kitchen_department_id = kd.id
       WHERE k.order_id = ?`,
      [order.id]
    );
    order.kots = kots;

    return sendSuccess(res, order, 'Order details fetched');
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'IN_KITCHEN', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 'Invalid order status', 400);
    }

    const [orders] = await pool.query(`SELECT * FROM restaurant_orders WHERE id = ?`, [id]);
    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }

    const order = orders[0];

    await pool.query(`UPDATE restaurant_orders SET order_status = ? WHERE id = ?`, [status, id]);

    // Emit live events
    emitToRoom(`customer_${id}`, 'order_updated', { order_id: parseInt(id), status });
    emitToRoom('waiter', 'order_updated', { order_id: parseInt(id), status });
    emitToRoom('admin', 'order_updated', { order_id: parseInt(id), status });

    return sendSuccess(res, { order_id: parseInt(id), status }, `Order status updated to ${status}`);
  } catch (err) {
    next(err);
  }
}

// Public Customer Tracking Endpoint
async function getCustomerOrderTracking(req, res, next) {
  try {
    const { orderId } = req.params;
    const [orders] = await pool.query(
      `SELECT o.id, o.order_number, o.order_status, o.subtotal, o.tax_amount, o.total_amount, o.created_at, 
              t.table_number, t.qr_token,
              b.id as bill_id, b.bill_number, COALESCE(b.payment_status, 'UNPAID') as payment_status,
              (SELECT payment_method FROM payments p WHERE p.order_id = o.id ORDER BY p.id DESC LIMIT 1) as payment_method
       FROM restaurant_orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       LEFT JOIN bills b ON b.order_id = o.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }

    const order = orders[0];

    const [items] = await pool.query(
      `SELECT oi.item_name, oi.quantity, 
              COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0.00) as total_price, 
              oi.status
       FROM order_items oi
       WHERE oi.order_id = ?`,
      [order.id]
    );
    order.items = items;

    const [kots] = await pool.query(
      `SELECT k.id, k.kot_number, k.status, kd.name as kitchen_department_name
       FROM kots k
       JOIN kitchen_departments kd ON k.kitchen_department_id = kd.id
       WHERE k.order_id = ?`,
      [order.id]
    );
    order.kots = kots;

    return sendSuccess(res, order, 'Customer tracking order details loaded');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrderHandler,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getCustomerOrderTracking
};
