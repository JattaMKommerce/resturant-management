const { query } = require('../config/db');
const pool = require('../config/database');
const PaymentService = require('../services/PaymentService');

function sendPaymentError(res, err, fallbackStatus = 400) {
  const status = err.statusCode || fallbackStatus;
  res.status(status).json({ success: false, message: err.message });
}

async function initiatePayment(req, res) {
  try {
    const { order_id, is_offline = false } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    let order = null;
    if (is_offline) {
      const [offOrders] = await pool.query(`SELECT * FROM restaurant_orders WHERE id = ?`, [order_id]);
      if (offOrders.length === 0) {
        return res.status(404).json({ success: false, message: 'Dine-In Order not found.' });
      }
      order = offOrders[0];
    } else {
      const [onlOrders] = await pool.query('SELECT * FROM orders WHERE id = ?', [order_id]);
      if (onlOrders.length === 0) {
        return res.status(404).json({ success: false, message: 'Online Order not found.' });
      }
      order = onlOrders[0];
    }

    // The amount always comes from the order on the server
    const result = await PaymentService.createOnlinePaymentOrder(
      order.id,
      parseFloat(order.total_amount),
      Boolean(is_offline),
      order.restaurant_id || 1
    );

    res.json({ success: true, payment: result });
  } catch (err) {
    console.error('initiatePayment Error:', err.message);
    sendPaymentError(res, err, 500);
  }
}

async function verifyPayment(req, res) {
  try {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, is_offline = false } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order ID is required.' });
    }

    const result = await PaymentService.verifyOnlinePayment(
      order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, Boolean(is_offline)
    );

    res.json({ success: true, message: 'Payment verified successfully.', verification: result });
  } catch (err) {
    console.error('verifyPayment Error:', err.message);
    sendPaymentError(res, err);
  }
}

/**
 * POST /payments/failed — the customer closed the payment window or the gateway reported a
 * failure. The attempt is recorded as FAILED so it is never mistaken for a payment (REQ-024).
 */
async function reportPaymentFailure(req, res) {
  try {
    const { order_id, razorpay_order_id, is_offline = false, reason } = req.body || {};
    if (!order_id || !razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Order and payment reference are required.' });
    }
    const cleanReason = String(reason || 'Payment cancelled by customer').slice(0, 200);
    const result = await PaymentService.recordPaymentFailure(order_id, razorpay_order_id, Boolean(is_offline), cleanReason);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('reportPaymentFailure Error:', err.message);
    sendPaymentError(res, err);
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

    // Repeated clicks must not record the same cash twice (REQ-025)
    const upd = await query(
      `UPDATE orders SET payment_status = 'COMPLETED' WHERE id = ? AND payment_status <> 'COMPLETED'`,
      [order_id]
    );
    if (!upd.affectedRows) {
      return res.json({ success: true, alreadyCollected: true, message: 'Cash for this order was already recorded.' });
    }
    await query(
      `INSERT INTO payments (order_id, order_source, payment_method, amount, status, transaction_id) VALUES (?, 'ONLINE', 'COD', ?, 'SUCCESS', ?)`,
      [order_id, order.total_amount, `COD_COLLECTED_${Date.now()}`]
    );

    res.json({ success: true, message: `COD payment of ₹${order.total_amount} marked as collected.` });
  } catch (err) {
    console.error('markCodCollected Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { initiatePayment, verifyPayment, reportPaymentFailure, markCodCollected };
