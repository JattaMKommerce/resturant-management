const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query } = require('../config/db');
const pool = require('../config/database');
const { broadcastEvent, emitToRoom } = require('../config/socket');
require('dotenv').config();

const isMockMode = process.env.RAZORPAY_MOCK_MODE === 'true';

/**
 * Helper to fetch restaurant payment credentials
 */
async function getRestaurantPaymentConfig(restaurantId) {
  if (!restaurantId) {
    return {
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkey123456',
      keySecret: process.env.RAZORPAY_KEY_SECRET || 'mocksecretkey123456789',
      isCustom: false,
      upiId: null,
      upiName: null
    };
  }

  try {
    const rows = await query(
      'SELECT id, name, razorpay_key_id, razorpay_key_secret, razorpay_enabled, upi_id, upi_name FROM restaurants WHERE id = ?',
      [restaurantId]
    );

    if (rows.length > 0) {
      const rest = rows[0];
      if (rest.razorpay_enabled && rest.razorpay_key_id && rest.razorpay_key_secret) {
        return {
          keyId: rest.razorpay_key_id,
          keySecret: rest.razorpay_key_secret,
          isCustom: true,
          restaurantName: rest.name,
          upiId: rest.upi_id,
          upiName: rest.upi_name || rest.name
        };
      }
    }
  } catch (err) {
    console.warn('[PaymentService] Failed to load restaurant custom keys:', err.message);
  }

  // Fallback to platform keys from .env
  return {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkey123456',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'mocksecretkey123456789',
    isCustom: false,
    upiId: null,
    upiName: null
  };
}

/**
 * Initialize an online payment order (Razorpay Multi-Tenant or Mock)
 */
async function createOnlinePaymentOrder(orderId, amountINR, isOffline = false, directRestaurantId = null) {
  const amountPaise = Math.round(amountINR * 100);
  const receipt = `rcpt_${isOffline ? 'off' : 'onl'}_${orderId}_${Date.now()}`;

  let restaurantId = directRestaurantId;

  // Resolve restaurant ID
  if (!restaurantId) {
    if (isOffline) {
      const [offRows] = await pool.query(
        `SELECT o.*, t.id as table_id FROM restaurant_orders o LEFT JOIN restaurant_tables t ON o.table_id = t.id WHERE o.id = ?`,
        [orderId]
      );
      restaurantId = offRows[0]?.restaurant_id || 1;
    } else {
      const [onlRows] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [orderId]);
      restaurantId = onlRows[0]?.restaurant_id || 1;
    }
  }

  const config = await getRestaurantPaymentConfig(restaurantId);

  // MOCK MODE or Dummy keys
  if (isMockMode || !config.keyId || config.keyId.startsWith('rzp_test_mock')) {
    console.log(`[PAYMENT SERVICE - MOCK MODE] Created payment order for ${isOffline ? 'Offline' : 'Online'} Order #${orderId}, Amount: ₹${amountINR}, Restaurant #${restaurantId}`);
    const mockRazorpayOrderId = `rzp_mock_ord_${Date.now()}_${orderId}`;

    await pool.query(
      `INSERT INTO payments (order_id, payment_method, transaction_id, razorpay_order_id, amount, status) VALUES (?, 'ONLINE', ?, ?, ?, 'PENDING')`,
      [orderId, `TXN_MOCK_${Date.now()}`, mockRazorpayOrderId, amountINR]
    );

    return {
      success: true,
      isMock: true,
      isCustomMerchant: config.isCustom,
      restaurantId,
      keyId: config.keyId,
      razorpayOrderId: mockRazorpayOrderId,
      amount: amountPaise,
      currency: 'INR',
      upiId: config.upiId,
      upiName: config.upiName
    };
  }

  // REAL LIVE / TEST RAZORPAY INSTANCE FOR THIS SPECIFIC RESTAURANT
  try {
    const restaurantRazorpay = new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret
    });

    const rzpOrder = await restaurantRazorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receipt,
      payment_capture: 1
    });

    await pool.query(
      `INSERT INTO payments (order_id, payment_method, transaction_id, razorpay_order_id, amount, status) VALUES (?, 'ONLINE', ?, ?, ?, 'PENDING')`,
      [orderId, rzpOrder.id, rzpOrder.id, amountINR]
    );

    return {
      success: true,
      isMock: false,
      isCustomMerchant: config.isCustom,
      restaurantId,
      keyId: config.keyId,
      razorpayOrderId: rzpOrder.id,
      amount: amountPaise,
      currency: 'INR',
      upiId: config.upiId,
      upiName: config.upiName
    };
  } catch (err) {
    console.error('Razorpay Dynamic Order Creation Error:', err);
    throw new Error(err.message || 'Failed to initiate payment gateway.');
  }
}

/**
 * Server-side Payment Verification
 */
async function verifyOnlinePayment(orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, isOffline = false) {
  let restaurantId = 1;

  if (isOffline) {
    const [offRows] = await pool.query(`SELECT * FROM restaurant_orders WHERE id = ?`, [orderId]);
    restaurantId = offRows[0]?.restaurant_id || 1;
  } else {
    const [onlRows] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    restaurantId = onlRows[0]?.restaurant_id || 1;
  }

  const config = await getRestaurantPaymentConfig(restaurantId);

  // 1. MOCK MODE handling
  if (isMockMode || !config.keyId || config.keyId.startsWith('rzp_test_mock')) {
    console.log(`[PAYMENT SERVICE - MOCK MODE] Verified ${isOffline ? 'Offline' : 'Online'} Order #${orderId}`);

    const txId = razorpayPaymentId || `pay_mock_${Date.now()}`;
    await pool.query(
      `UPDATE payments SET razorpay_payment_id = ?, status = 'SUCCESS', transaction_id = ? WHERE order_id = ?`,
      [txId, txId, orderId]
    );

    if (isOffline) {
      await pool.query(`UPDATE restaurant_orders SET payment_status = 'PAID', order_status = 'COMPLETED' WHERE id = ?`, [orderId]);
      await pool.query(`UPDATE bills SET payment_status = 'PAID' WHERE order_id = ?`, [orderId]);
      
      const [ord] = await pool.query(`SELECT * FROM restaurant_orders WHERE id = ?`, [orderId]);
      if (ord[0]?.table_id) {
        await pool.query(`UPDATE restaurant_tables SET status = 'CLEANING' WHERE id = ?`, [ord[0].table_id]);
        broadcastEvent('table_status_changed', { table_id: ord[0].table_id, status: 'CLEANING' });
      }

      emitToRoom(`customer_${orderId}`, 'order_updated', { order_id: orderId, payment_status: 'PAID' });
      emitToRoom(`customer_${orderId}`, 'bill_paid', { order_id: orderId, payment_status: 'PAID' });
    } else {
      await pool.query(`UPDATE orders SET payment_status = 'COMPLETED' WHERE id = ?`, [orderId]);
      emitToRoom(`customer_${orderId}`, 'order_updated', { order_id: orderId, payment_status: 'COMPLETED' });
    }

    broadcastEvent('payment_recorded', { order_id: orderId, amount: 'SUCCESS', payment_method: 'ONLINE' });
    return { verified: true, isMock: true, isCustomMerchant: config.isCustom };
  }

  // 2. REAL RAZORPAY SIGNATURE VERIFICATION
  const secret = config.keySecret;
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body.toString())
    .digest('hex');

  const isVerified = expectedSignature === razorpaySignature;

  if (isVerified) {
    await pool.query(
      `UPDATE payments SET razorpay_payment_id = ?, status = 'SUCCESS', transaction_id = ? WHERE order_id = ?`,
      [razorpayPaymentId, razorpayPaymentId, orderId]
    );

    if (isOffline) {
      await pool.query(`UPDATE restaurant_orders SET payment_status = 'PAID', order_status = 'COMPLETED' WHERE id = ?`, [orderId]);
      await pool.query(`UPDATE bills SET payment_status = 'PAID' WHERE order_id = ?`, [orderId]);

      const [ord] = await pool.query(`SELECT * FROM restaurant_orders WHERE id = ?`, [orderId]);
      if (ord[0]?.table_id) {
        await pool.query(`UPDATE restaurant_tables SET status = 'CLEANING' WHERE id = ?`, [ord[0].table_id]);
        broadcastEvent('table_status_changed', { table_id: ord[0].table_id, status: 'CLEANING' });
      }

      emitToRoom(`customer_${orderId}`, 'order_updated', { order_id: orderId, payment_status: 'PAID' });
      emitToRoom(`customer_${orderId}`, 'bill_paid', { order_id: orderId, payment_status: 'PAID' });
    } else {
      await pool.query(`UPDATE orders SET payment_status = 'COMPLETED' WHERE id = ?`, [orderId]);
      emitToRoom(`customer_${orderId}`, 'order_updated', { order_id: orderId, payment_status: 'COMPLETED' });
    }

    broadcastEvent('payment_recorded', { order_id: orderId, amount: 'SUCCESS', payment_method: 'ONLINE' });
    return { verified: true, isMock: false, isCustomMerchant: config.isCustom };
  } else {
    await pool.query(`UPDATE payments SET status = 'FAILED' WHERE order_id = ?`, [orderId]);
    if (isOffline) {
      await pool.query(`UPDATE restaurant_orders SET payment_status = 'FAILED' WHERE id = ?`, [orderId]);
    } else {
      await pool.query(`UPDATE orders SET payment_status = 'FAILED' WHERE id = ?`, [orderId]);
    }
    throw new Error('Payment signature verification failed.');
  }
}

module.exports = {
  createOnlinePaymentOrder,
  verifyOnlinePayment,
  getRestaurantPaymentConfig
};
