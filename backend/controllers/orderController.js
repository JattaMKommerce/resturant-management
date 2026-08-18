const { query } = require('../config/db');
const OrderService = require('../services/OrderService');
const { validateRestaurantAccess } = require('../middleware/auth');

async function placeOrder(req, res) {
  try {
    const guestIdentityId = req.guestIdentity?.id || null;
    const customerId = req.user?.id || null;

    const orderData = {
      ...req.body,
      customerId,
      customerIdentityId: guestIdentityId
    };

    const result = await OrderService.createOrder(orderData);
    res.status(201).json({ success: true, message: 'Order created successfully.', order: result });
  } catch (err) {
    console.error('placeOrder Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const orders = await query(
      `SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug,
              r.address as restaurant_address,
              r.latitude as restaurant_latitude, r.longitude as restaurant_longitude,
              r.logo_url as restaurant_logo,
              d.vehicle_type, d.vehicle_number, u_d.name as driver_name, u_d.phone as driver_phone,
              d.current_latitude as driver_latitude, d.current_longitude as driver_longitude
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       LEFT JOIN delivery_drivers d ON o.assigned_driver_id = d.id
       LEFT JOIN users u_d ON d.user_id = u_d.id
       WHERE o.id = ? OR o.order_number = ?`,
      [id, id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];

    // OWNERSHIP CHECK: Guest identity, assigned driver, or admin
    const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'RESTAURANT_ADMIN' || req.user.role === 'SUPER_ADMIN');
    const isDriverOwner = req.user && req.user.role === 'DRIVER' && (order.assigned_driver_id === req.user.driverId || order.driver_name);
    const isGuestOwner = req.guestIdentity?.id && order.customer_identity_id === req.guestIdentity.id;
    const isUserOwner = req.user?.id && order.customer_id === req.user.id;

    if (!isAdmin && !isDriverOwner && !isGuestOwner && !isUserOwner) {
      return res.status(403).json({ success: false, message: 'You do not have access to this order.' });
    }

    const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const history = await query(
      `SELECT h.*, u.name as changed_by_name
       FROM order_status_history h
       LEFT JOIN users u ON h.changed_by_user_id = u.id
       WHERE h.order_id = ?
       ORDER BY h.created_at ASC`,
      [order.id]
    );

    res.json({
      success: true,
      order: { ...order, items, history }
    });
  } catch (err) {
    console.error('getOrderById Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving order.' });
  }
}

async function getUserOrders(req, res) {
  try {
    const userId = req.user.id;
    const orders = await query(
      `SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug, r.logo_url as restaurant_logo
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`,
      [userId]
    );

    for (let order of orders) {
      order.items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    }

    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('getUserOrders Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving user orders.' });
  }
}

async function getAllOrders(req, res) {
  try {
    const { status, payment_method, search, date } = req.query;
    const restId = req.adminRestaurantId;

    if (!restId && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'No restaurant assigned.' });
    }

    let sql = `
      SELECT o.*, r.name as restaurant_name,
             COALESCE(d.full_name, u_d.name) as driver_name,
             COALESCE(d.mobile, u_d.phone) as driver_phone,
             d.vehicle_type, d.vehicle_number,
             d.current_latitude as driver_latitude, d.current_longitude as driver_longitude
      FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN delivery_drivers d ON o.assigned_driver_id = d.id
      LEFT JOIN users u_d ON d.user_id = u_d.id
    `;
    const params = [];
    const wheres = [];

    if (!req.isSuperAdmin) {
      wheres.push('o.restaurant_id = ?');
      params.push(restId);
    }

    if (status) { wheres.push('o.order_status = ?'); params.push(status); }
    if (payment_method) { wheres.push('o.payment_method = ?'); params.push(payment_method); }
    if (search) {
      wheres.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)');
      const s = `%${search}%`; params.push(s, s, s);
    }
    if (date) { wheres.push('DATE(o.created_at) = ?'); params.push(date); }

    if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND ');
    sql += ` ORDER BY o.created_at DESC`;

    const orders = await query(sql, params);
    for (let order of orders) {
      order.items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    }

    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('getAllOrders Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user ? req.user.id : null;

    // Verify admin owns this order's restaurant
    if (!req.isSuperAdmin) {
      const [order] = await query('SELECT restaurant_id FROM orders WHERE id = ?', [id]);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
      if (!validateRestaurantAccess(order.restaurant_id, req)) {
        return res.status(403).json({ success: false, message: 'Access denied to this order.' });
      }
    }

    const result = await OrderService.updateOrderStatus(id, status, userId, notes);
    res.json({ success: true, message: `Order status updated to ${status}.`, result });
  } catch (err) {
    console.error('updateOrderStatus Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

async function assignDriver(req, res) {
  try {
    const { id } = req.params;
    const { driver_id } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!driver_id) {
      return res.status(400).json({ success: false, message: 'Driver ID is required.' });
    }

    const result = await OrderService.assignDriver(id, driver_id, userId);
    res.json({ success: true, message: 'Driver assigned.', result });
  } catch (err) {
    console.error('assignDriver Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getDashboardKPIs(req, res) {
  try {
    const restId = req.adminRestaurantId;
    if (!restId && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'No restaurant assigned.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    const [todayOrdersRow] = await query(
      'SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ?',
      [restId, todayStr]
    );

    const statusCounts = await query(
      'SELECT order_status, COUNT(*) as count FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ? GROUP BY order_status',
      [restId, todayStr]
    );

    const statusMap = {
      PENDING: 0, ACCEPTED: 0, SENT_TO_KITCHEN: 0, PREPARING: 0,
      READY_FOR_PICKUP: 0, ASSIGNED_TO_DRIVER: 0, OUT_FOR_DELIVERY: 0,
      DELIVERED: 0, CANCELLED: 0, REJECTED: 0
    };
    statusCounts.forEach(sc => { statusMap[sc.order_status] = sc.count; });

    // Recent orders
    const recentOrders = await query(
      `SELECT o.id, o.order_number, o.customer_name, o.order_status, o.total_amount, o.payment_method, o.created_at
       FROM orders o WHERE o.restaurant_id = ? ORDER BY o.created_at DESC LIMIT 10`,
      [restId]
    );

    res.json({
      success: true,
      kpis: {
        todayOrders: todayOrdersRow.count,
        todayRevenue: parseFloat(todayOrdersRow.revenue),
        statusCounts: statusMap,
        recentOrders
      }
    });
  } catch (err) {
    console.error('getDashboardKPIs Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  placeOrder,
  getOrderById,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  assignDriver,
  getDashboardKPIs
};
