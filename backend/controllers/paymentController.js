const { query } = require('../config/db');
const pool = require('../config/database');
const PaymentService = require('../services/PaymentService');

async function initiatePayment(req, res) {
  try {
    const { order_id, is_offline = false, table_token = null } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    let order = null;
    let restaurantId = null;

    if (is_offline) {
      const [offOrders] = await pool.query(
        `SELECT o.*, t.table_number 
         FROM restaurant_orders o 
         LEFT JOIN restaurant_tables t ON o.table_id = t.id 
         WHERE o.id = ?`,
        [order_id]
      );
      if (offOrders.length === 0) {
        return res.status(404).json({ success: false, message: 'Dine-In Order not found.' });
      }
      order = offOrders[0];
      restaurantId = order.restaurant_id || 1;
    } else {
      const [onlOrders] = await pool.query('SELECT * FROM orders WHERE id = ?', [order_id]);
      if (onlOrders.length === 0) {
        return res.status(404).json({ success: false, message: 'Online Order not found.' });
      }
      order = onlOrders[0];
      restaurantId = order.restaurant_id || 1;
    }

    const result = await PaymentService.createOnlinePaymentOrder(
      order.id, 
      parseFloat(order.total_amount), 
      is_offline, 
      restaurantId
    );

    res.json({ success: true, payment: result });
  } catch (err) {
    console.error('initiatePayment Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function verifyPayment(req, res) {
  try {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, is_offline = false } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    const result = await PaymentService.verifyOnlinePayment(
      order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, is_offline
    );

    res.json({ success: true, message: 'Payment verified successfully.', verification: result });
  } catch (err) {
    console.error('verifyPayment Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

async function markCodCollected(req, res) {
  try {
    const { order_id } = req.body;

    const orders = await query('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];
    if (order.payment_method !== 'COD') {
      return res.status(400).json({ success: false, message: 'Order is not Cash on Delivery.' });
    }

    await query('UPDATE orders SET payment_status = "COMPLETED" WHERE id = ?', [order_id]);
    await query(
      `INSERT INTO payments (order_id, payment_method, amount, status, transaction_id) VALUES (?, 'COD', ?, 'SUCCESS', ?)`,
      [order_id, order.total_amount, `COD_COLLECTED_${Date.now()}`]
    );

    res.json({ success: true, message: `COD payment of ₹${order.total_amount} marked as collected.` });
  } catch (err) {
    console.error('markCodCollected Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { initiatePayment, verifyPayment, markCodCollected };
