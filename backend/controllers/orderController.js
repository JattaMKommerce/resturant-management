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

    // Public order tracking (supports both registered customers and guest checkout)
    const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const history = await query(
      `SELECT h.*, u.name as changed_by_name
       FROM order_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.order_id = ?
       ORDER BY h.created_at ASC`,
      [order.id]
    );

    res.json({
      success: true,
      order: {
        ...order,
        items,
        statusHistory: history
      }
    });
  } catch (err) {
    console.error('getOrderById Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving order details.' });
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

async function getUnifiedHistory(req, res) {
  try {
    const { type = 'ALL', status, startDate, endDate, search, limit = 200 } = req.query;
    const restId = req.adminRestaurantId;

    let onlineOrders = [];
    let offlineOrders = [];

    const safeLimit = Math.max(1, Math.min(500, parseInt(limit) || 200));

    // 1. Fetch Online Orders if type is ALL or ONLINE
    if (type === 'ALL' || type === 'ONLINE') {
      let onlineSql = `
        SELECT o.*, r.name as restaurant_name,
               COALESCE(d.full_name, u_d.name) as driver_name,
               COALESCE(d.mobile, u_d.phone) as driver_phone,
               d.vehicle_type, d.vehicle_number
        FROM orders o
        JOIN restaurants r ON o.restaurant_id = r.id
        LEFT JOIN delivery_drivers d ON o.assigned_driver_id = d.id
        LEFT JOIN users u_d ON d.user_id = u_d.id
      `;
      const onlineParams = [];
      const onlineWheres = [];

      if (!req.isSuperAdmin && restId) {
        onlineWheres.push('o.restaurant_id = ?');
        onlineParams.push(restId);
      }

      if (status && status !== 'ALL') {
        onlineWheres.push('o.order_status = ?');
        onlineParams.push(status);
      }
      if (startDate) {
        onlineWheres.push('DATE(o.created_at) >= ?');
        onlineParams.push(startDate);
      }
      if (endDate) {
        onlineWheres.push('DATE(o.created_at) <= ?');
        onlineParams.push(endDate);
      }
      if (search) {
        onlineWheres.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)');
        const s = `%${search}%`;
        onlineParams.push(s, s, s);
      }

      if (onlineWheres.length > 0) onlineSql += ' WHERE ' + onlineWheres.join(' AND ');
      onlineSql += ` ORDER BY o.created_at DESC LIMIT ${safeLimit}`;

      try {
        const rows = await query(onlineSql, onlineParams);
        onlineOrders = rows.map(o => ({
          id: o.id,
          source_type: 'ONLINE',
          order_number: o.order_number,
          restaurant_name: o.restaurant_name,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          order_type: 'ONLINE_DELIVERY',
          order_status: o.order_status,
          payment_method: o.payment_method,
          payment_status: o.payment_status,
          subtotal: parseFloat(o.subtotal || 0),
          tax_amount: parseFloat(o.tax_amount || 0),
          delivery_fee: parseFloat(o.delivery_fee || 0),
          discount_amount: parseFloat(o.discount_amount || 0),
          total_amount: parseFloat(o.total_amount || 0),
          delivery_address: o.delivery_address,
          delivery_area: o.delivery_area,
          driver_name: o.driver_name,
          driver_phone: o.driver_phone,
          driver_vehicle: o.vehicle_type ? `${o.vehicle_type} (${o.vehicle_number || ''})` : null,
          created_at: o.created_at,
          updated_at: o.updated_at
        }));
      } catch (err) {
        console.error('Error querying online orders history:', err.message);
      }
    }

    // 2. Fetch Offline Orders if type is ALL or OFFLINE
    if (type === 'ALL' || type === 'OFFLINE') {
      let offlineSql = `
        SELECT o.*, t.table_number, t.table_name, rm.room_number
        FROM restaurant_orders o
        LEFT JOIN restaurant_tables t ON o.table_id = t.id
        LEFT JOIN rooms rm ON o.room_id = rm.id
      `;
      const offlineParams = [];
      const offlineWheres = [];

      if (status && status !== 'ALL') {
        offlineWheres.push('o.order_status = ?');
        offlineParams.push(status);
      }
      if (startDate) {
        offlineWheres.push('DATE(o.created_at) >= ?');
        offlineParams.push(startDate);
      }
      if (endDate) {
        offlineWheres.push('DATE(o.created_at) <= ?');
        offlineParams.push(endDate);
      }
      if (search) {
        offlineWheres.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR t.table_number LIKE ? OR rm.room_number LIKE ?)');
        const s = `%${search}%`;
        offlineParams.push(s, s, s, s, s);
      }

      if (offlineWheres.length > 0) offlineSql += ' WHERE ' + offlineWheres.join(' AND ');
      offlineSql += ` ORDER BY o.created_at DESC LIMIT ${safeLimit}`;

      try {
        const rows = await query(offlineSql, offlineParams);
        offlineOrders = rows.map(o => ({
          id: o.id,
          source_type: 'OFFLINE',
          order_number: o.order_number,
          restaurant_name: 'Dine-In / Room Service',
          customer_name: o.customer_name || 'Guest',
          customer_phone: o.customer_phone || 'N/A',
          order_type: o.order_type || 'DINE_IN',
          order_status: o.order_status,
          payment_method: o.payment_status === 'PAID' ? 'PAID' : (o.payment_status === 'ROOM_CHARGED' ? 'ROOM_CHARGE' : 'CASH_POS'),
          payment_status: o.payment_status,
          subtotal: parseFloat(o.subtotal || 0),
          tax_amount: parseFloat(o.tax_amount || 0),
          delivery_fee: 0,
          service_charge: parseFloat(o.service_charge || 0),
          discount_amount: parseFloat(o.discount_amount || 0),
          total_amount: parseFloat(o.total_amount || 0),
          table_number: o.table_number,
          table_name: o.table_name,
          room_number: o.room_number,
          source: o.source,
          created_at: o.created_at,
          updated_at: o.updated_at
        }));
      } catch (err) {
        console.error('Error querying offline orders history:', err.message);
      }
    }

    // 3. Combine and sort chronologically (newest first)
    const combined = [...onlineOrders, ...offlineOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 4. Attach order items for top items in result
    for (let order of combined.slice(0, 100)) {
      try {
        if (order.source_type === 'ONLINE') {
          order.items = await query('SELECT item_name, quantity, unit_price, item_total FROM order_items WHERE order_id = ?', [order.id]);
        } else {
          order.items = await query('SELECT item_name, quantity, unit_price, item_total FROM order_items WHERE order_id = ?', [order.id]);
        }
      } catch (e) {
        order.items = [];
      }
    }

    // 5. Aggregate summary stats
    const totalOrders = combined.length;
    const onlineOrdersCount = onlineOrders.length;
    const offlineOrdersCount = offlineOrders.length;

    const totalRevenue = combined.reduce((sum, o) => {
      const isSuccessful = !['CANCELLED', 'REJECTED', 'DELIVERY_FAILED'].includes(o.order_status);
      return isSuccessful ? sum + o.total_amount : sum;
    }, 0);

    const onlineRevenue = onlineOrders.reduce((sum, o) => {
      const isSuccessful = !['CANCELLED', 'REJECTED', 'DELIVERY_FAILED'].includes(o.order_status);
      return isSuccessful ? sum + o.total_amount : sum;
    }, 0);

    const offlineRevenue = offlineOrders.reduce((sum, o) => {
      const isSuccessful = !['CANCELLED', 'REJECTED', 'DELIVERY_FAILED'].includes(o.order_status);
      return isSuccessful ? sum + o.total_amount : sum;
    }, 0);

    const completedCount = combined.filter(o => ['DELIVERED', 'COMPLETED', 'PAID', 'SERVED'].includes(o.order_status)).length;
    const cancelledCount = combined.filter(o => ['CANCELLED', 'REJECTED', 'DELIVERY_FAILED'].includes(o.order_status)).length;

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        onlineOrdersCount,
        onlineRevenue: Math.round(onlineRevenue * 100) / 100,
        offlineOrdersCount,
        offlineRevenue: Math.round(offlineRevenue * 100) / 100,
        completedCount,
        cancelledCount
      },
      orders: combined
    });
  } catch (err) {
    console.error('getUnifiedHistory Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving history.' });
  }
}

module.exports = {
  placeOrder,
  getOrderById,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  assignDriver,
  getDashboardKPIs,
  getUnifiedHistory
};
