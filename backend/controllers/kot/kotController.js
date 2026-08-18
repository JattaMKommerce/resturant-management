const pool = require('../../config/database');
const kotService = require('../../services/kot/kotService');
const { sendSuccess, sendError } = require('../../utils/response');

async function getKOTs(req, res, next) {
  try {
    const { status, kitchen_department_id, table_id, order_type, delayed_only } = req.query;
    let query = `
      SELECT k.*, kd.name as kitchen_department_name, kd.code as kitchen_department_code, 
             t.table_number, t.table_name, t.floor, r.room_number,
             COALESCE(ord.order_number, o.order_number, CONCAT('ORD-', k.order_id)) as order_number,
             ord.customer_name as online_customer_name,
             ord.customer_phone as online_customer_phone,
             ord.delivery_address as online_delivery_address,
             ord.delivery_instructions as online_delivery_instructions,
             ord.payment_method as online_payment_method,
             ord.total_amount as online_total_amount
      FROM kots k
      JOIN kitchen_departments kd ON k.kitchen_department_id = kd.id
      LEFT JOIN restaurant_tables t ON k.table_id = t.id
      LEFT JOIN rooms r ON k.room_id = r.id
      LEFT JOIN restaurant_orders o ON k.order_id = o.id
      LEFT JOIN orders ord ON k.order_id = ord.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      if (status === 'ACTIVE') {
        query += ` AND k.status IN ('PENDING', 'ACCEPTED', 'PREPARING')`;
      } else {
        query += ` AND k.status = ?`;
        params.push(status);
      }
    }
    if (kitchen_department_id) {
      query += ` AND k.kitchen_department_id = ?`;
      params.push(kitchen_department_id);
    }
    if (table_id) {
      query += ` AND k.table_id = ?`;
      params.push(table_id);
    }
    if (order_type) {
      query += ` AND k.order_type = ?`;
      params.push(order_type);
    }
    if (delayed_only === 'true' || delayed_only === '1') {
      query += ` AND (k.is_delayed = TRUE OR k.target_completion_at < NOW()) AND k.status IN ('PENDING', 'ACCEPTED', 'PREPARING')`;
    }

    query += ` ORDER BY k.created_at ASC`;

    const [kots] = await pool.query(query, params);

    // Fetch items for each KOT
    for (let kot of kots) {
      const [items] = await pool.query(
        `SELECT ki.*, oi.unit_price, COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0.00) as total_price,
                COALESCE(NULLIF(ki.item_name, ''), oi.item_name, m.name, ord_i.item_name, 'Food Item') as item_name
         FROM kot_items ki
         LEFT JOIN order_items oi ON ki.order_item_id = oi.id
         LEFT JOIN menu_items m ON oi.menu_item_id = m.id
         LEFT JOIN order_items ord_i ON ki.order_item_id = ord_i.id
         WHERE ki.kot_id = ?`,
        [kot.id]
      );
      
      for (let item of items) {
        if (typeof item.modifiers_json === 'string') {
          try {
            item.modifiers = JSON.parse(item.modifiers_json);
          } catch (e) {
            item.modifiers = [];
          }
        } else {
          item.modifiers = item.modifiers_json || [];
        }
      }

      kot.items = items;
    }

    // Trigger check for delayed KOTs asynchronously
    kotService.checkAndTriggerDelayedKOTs();

    return sendSuccess(res, kots, 'KOTs fetched successfully');
  } catch (err) {
    next(err);
  }
}

async function getKOTById(req, res, next) {
  try {
    const { id } = req.params;
    const [kots] = await pool.query(
      `SELECT k.*, kd.name as kitchen_department_name, kd.code as kitchen_department_code, 
             t.table_number, t.table_name, r.room_number,
             COALESCE(ord.order_number, o.order_number, CONCAT('ORD-', k.order_id)) as order_number,
             ord.customer_name as online_customer_name,
             ord.delivery_address as online_delivery_address,
             ord.delivery_instructions as online_delivery_instructions
      FROM kots k
      JOIN kitchen_departments kd ON k.kitchen_department_id = kd.id
      LEFT JOIN restaurant_tables t ON k.table_id = t.id
      LEFT JOIN rooms r ON k.room_id = r.id
      LEFT JOIN restaurant_orders o ON k.order_id = o.id
      LEFT JOIN orders ord ON k.order_id = ord.id
      WHERE k.id = ?`,
      [id]
    );

    if (kots.length === 0) {
      return sendError(res, 'KOT not found', 404);
    }

    const kot = kots[0];
    const [items] = await pool.query(
      `SELECT ki.*, oi.unit_price, COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0.00) as total_price,
              COALESCE(NULLIF(ki.item_name, ''), oi.item_name, m.name, ord_i.item_name, 'Food Item') as item_name
       FROM kot_items ki
       LEFT JOIN order_items oi ON ki.order_item_id = oi.id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       LEFT JOIN order_items ord_i ON ki.order_item_id = ord_i.id
       WHERE ki.kot_id = ?`,
      [kot.id]
    );

    for (let item of items) {
      item.modifiers = typeof item.modifiers_json === 'string' ? JSON.parse(item.modifiers_json) : (item.modifiers_json || []);
    }
    kot.items = items;

    return sendSuccess(res, kot, 'KOT details loaded');
  } catch (err) {
    next(err);
  }
}

async function updateKOTStatusHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : null;

    const validStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return sendError(res, `Invalid KOT status: ${status}`, 400);
    }

    if (userRole === 'WAITER' && ['ACCEPTED', 'PREPARING', 'READY'].includes(status)) {
      return sendError(res, 'Permission denied: Waiters cannot change kitchen preparation status or mark food READY.', 403);
    }

    if (userRole === 'KITCHEN' && status === 'SERVED') {
      return sendError(res, 'Permission denied: Kitchen staff cannot mark orders SERVED; serving is handled by Waiters.', 403);
    }

    const updatedKOT = await kotService.updateKOTStatus(id, status, userId, reason);
    return sendSuccess(res, updatedKOT, `KOT status updated to ${status}`);
  } catch (err) {
    return sendError(res, err.message || 'Failed to update KOT status', 400);
  }
}

async function updateKOTItemStatus(req, res, next) {
  try {
    const { itemId } = req.params;
    const { status } = req.body;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : null;

    const validStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return sendError(res, `Invalid item status: ${status}`, 400);
    }

    if (userRole === 'WAITER' && ['ACCEPTED', 'PREPARING', 'READY'].includes(status)) {
      return sendError(res, 'Permission denied: Waiters cannot change kitchen preparation status or mark food READY.', 403);
    }

    if (userRole === 'KITCHEN' && status === 'SERVED') {
      return sendError(res, 'Permission denied: Kitchen staff cannot mark orders SERVED; serving is handled by Waiters.', 403);
    }

    const result = await kotService.updateKOTItemStatus(itemId, status, userId);
    return sendSuccess(res, result, `KOT item status updated to ${status}`);
  } catch (err) {
    return sendError(res, err.message || 'Failed to update item status', 400);
  }
}

module.exports = {
  getKOTs,
  getKOTById,
  updateKOTStatusHandler,
  updateKOTItemStatus
};
