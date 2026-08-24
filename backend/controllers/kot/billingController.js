const pool = require('../../config/database');
const billingService = require('../../services/kot/billingService');
const inventoryService = require('../../services/kot/inventoryService');
const { sendSuccess, sendError } = require('../../utils/response');

async function getBills(req, res, next) {
  try {
    const { payment_status, search, channel } = req.query;
    
    // 1. Fetch Offline Restaurant Bills
    let offlineQuery = `
      SELECT b.id, b.bill_number, b.order_id, b.subtotal, b.discount_amount, b.tax_amount, 
             b.service_charge, b.grand_total, b.payment_status, b.created_at,
             o.order_number, o.customer_name, o.order_type,
             t.table_number, r.room_number,
             'OFFLINE' as channel
      FROM bills b
      LEFT JOIN restaurant_orders o ON b.order_id = o.id
      LEFT JOIN restaurant_tables t ON b.table_id = t.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE 1=1
    `;
    const offlineParams = [];
    if (payment_status) {
      offlineQuery += ` AND b.payment_status = ?`;
      offlineParams.push(payment_status);
    }
    if (search) {
      offlineQuery += ` AND (b.bill_number LIKE ? OR o.order_number LIKE ?)`;
      offlineParams.push(`%${search}%`, `%${search}%`);
    }
    offlineQuery += ` ORDER BY b.created_at DESC`;
    const [offlineBills] = await pool.query(offlineQuery, offlineParams);

    // 2. Fetch Online Order Invoices / Bills
    let onlineQuery = `
      SELECT 
        CONCAT('ONL-', ord.id) as id,
        CONCAT('INV-ONL-', RIGHT(ord.order_number, 5)) as bill_number,
        ord.id as order_id,
        ord.subtotal,
        ord.discount_amount,
        ord.tax_amount,
        ord.delivery_fee as service_charge,
        ord.total_amount as grand_total,
        CASE WHEN ord.payment_status = 'COMPLETED' THEN 'PAID' ELSE ord.payment_status END as payment_status,
        ord.created_at,
        ord.order_number,
        ord.customer_name,
        'DELIVERY' as order_type,
        NULL as table_number,
        NULL as room_number,
        'ONLINE' as channel
      FROM orders ord
      WHERE ord.order_status NOT IN ('CANCELLED')
    `;
    const onlineParams = [];
    if (payment_status) {
      if (payment_status === 'PAID') {
        onlineQuery += ` AND ord.payment_status IN ('PAID', 'COMPLETED')`;
      } else {
        onlineQuery += ` AND ord.payment_status = ?`;
        onlineParams.push(payment_status);
      }
    }
    if (search) {
      onlineQuery += ` AND (ord.order_number LIKE ? OR ord.customer_name LIKE ?)`;
      onlineParams.push(`%${search}%`, `%${search}%`);
    }
    onlineQuery += ` ORDER BY ord.created_at DESC`;
    const [onlineBills] = await pool.query(onlineQuery, onlineParams);

    let allBills = [];
    if (channel === 'OFFLINE') {
      allBills = offlineBills;
    } else if (channel === 'ONLINE') {
      allBills = onlineBills;
    } else {
      allBills = [...offlineBills, ...onlineBills].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return sendSuccess(res, allBills, 'Bills fetched successfully');
  } catch (err) {
    next(err);
  }
}

async function createBillHandler(req, res, next) {
  try {
    const { order_id, discount_amount, service_charge } = req.body;
    if (!order_id) return sendError(res, 'Order ID is required', 400);

    const bill = await billingService.generateBill(order_id, discount_amount, service_charge);
    return sendSuccess(res, bill, 'Bill generated successfully', 201);
  } catch (err) {
    return sendError(res, err.message || 'Failed to generate bill', 400);
  }
}

async function getBillById(req, res, next) {
  try {
    const { id } = req.params;

    if (String(id).startsWith('ONL-')) {
      const orderId = String(id).replace('ONL-', '');
      const [orders] = await pool.query(
        `SELECT ord.id as order_id, CONCAT('ONL-', ord.id) as id,
                CONCAT('INV-ONL-', RIGHT(ord.order_number, 5)) as bill_number,
                ord.order_number, ord.customer_name, ord.customer_phone, 'ONLINE' as order_type,
                ord.subtotal, ord.discount_amount, ord.tax_amount, ord.delivery_fee as service_charge,
                ord.total_amount as grand_total,
                CASE WHEN ord.payment_status = 'COMPLETED' THEN 'PAID' ELSE ord.payment_status END as payment_status,
                ord.payment_method, ord.created_at,
                NULL as table_number, NULL as room_number, NULL as room_guest_name
         FROM orders ord
         WHERE ord.id = ?`,
        [orderId]
      );
      if (orders.length === 0) return sendError(res, 'Online invoice not found', 404);
      const bill = orders[0];

      const [items] = await pool.query(
        `SELECT oi.item_name, oi.unit_price, oi.quantity, oi.tax_amount,
                COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0.00) as total_price
         FROM order_items oi WHERE oi.order_id = ?`,
        [bill.order_id]
      );
      bill.items = items;

      const [payments] = await pool.query(
        `SELECT * FROM payments WHERE order_id = ?`,
        [bill.order_id]
      );
      bill.payments = payments;

      return sendSuccess(res, bill, 'Online invoice details fetched');
    }

    const [bills] = await pool.query(
      `SELECT b.*, o.order_number, o.customer_name, o.customer_phone, o.order_type,
              t.table_number, r.room_number, rf.guest_name as room_guest_name
       FROM bills b
       JOIN restaurant_orders o ON b.order_id = o.id
       LEFT JOIN restaurant_tables t ON b.table_id = t.id
       LEFT JOIN rooms r ON b.room_id = r.id
       LEFT JOIN room_folios rf ON r.id = rf.room_id AND rf.folio_status = 'OPEN'
       WHERE b.id = ?`,
      [id]
    );

    if (bills.length === 0) return sendError(res, 'Bill not found', 404);

    const bill = bills[0];

    // Fetch items
    const [items] = await pool.query(
      `SELECT oi.item_name, oi.unit_price, oi.quantity, oi.tax_amount, 
              COALESCE(oi.item_total, oi.unit_price * oi.quantity, 0.00) as total_price 
       FROM order_items oi WHERE oi.order_id = ?`,
      [bill.order_id]
    );
    bill.items = items;

    // Fetch payments
    const [payments] = await pool.query(`SELECT * FROM payments WHERE order_id = ?`, [bill.order_id]);
    bill.payments = payments;

    return sendSuccess(res, bill, 'Bill details fetched');
  } catch (err) {
    next(err);
  }
}

async function processPaymentHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { payment_method, amount, transaction_ref } = req.body;

    const updatedBill = await billingService.recordPayment(id, payment_method, amount, transaction_ref);

    // Trigger Idempotent Inventory Stock Deduction upon Payment Completion
    try {
      if (updatedBill && updatedBill.order_id) {
        await inventoryService.deductStockForOrder(updatedBill.order_id);
      }
    } catch (invErr) {
      console.error('Inventory stock deduction warning during payment processing:', invErr);
    }

    // Send notification to admin
    try {
      const notificationService = require('../../services/NotificationService');
      const restaurantId = req.user?.restaurant_id || req.adminRestaurantId || 1;
      await notificationService.sendNotification({
        restaurantId,
        orderId: null,
        title: `💵 Bill Settled #${updatedBill.bill_number}`,
        message: `Received ₹${parseFloat(amount).toFixed(2)} via ${payment_method || 'CASH'}.`,
        type: 'ORDER_UPDATE'
      });
    } catch (notifErr) {
      console.warn('Bill payment notification warning:', notifErr.message);
    }

    return sendSuccess(res, updatedBill, 'Payment completed successfully');
  } catch (err) {
    return sendError(res, err.message || 'Payment processing failed', 400);
  }
}

module.exports = {
  getBills,
  createBillHandler,
  getBillById,
  processPaymentHandler
};
