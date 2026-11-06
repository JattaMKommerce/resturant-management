const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query } = require('../config/db');
const pool = require('../config/database');
const { broadcastEvent, emitToRoom } = require('../config/socket');
require('dotenv').config();

/**
 * Payments for online orders (orders table, source ONLINE) and dine-in/QR orders
 * (restaurant_orders table, source OFFLINE).
 *
 * REQ-023: a successful payment is recorded against exactly the order (and order type) it was
 *          created for — payments are matched by their Razorpay order id, never by order id alone
 *          (online and dine-in order ids overlap).
 * REQ-024: a payment only counts as successful after its Razorpay signature is verified. The
 *          simulated "mock" gateway runs only when RAZORPAY_MOCK_MODE=true; without real keys,
 *          online payment is refused instead of being faked.
 * REQ-025: verifying the same payment twice, or starting payment twice, never double-processes.
 */

// Simulated payments are a local-testing tool. They are never honoured on a production server,
// even if RAZORPAY_MOCK_MODE=true was copied into its settings.
function isMockMode() {
  return process.env.RAZORPAY_MOCK_MODE === 'true' && process.env.NODE_ENV !== 'production';
}
if (process.env.RAZORPAY_MOCK_MODE === 'true' && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  [Payments] RAZORPAY_MOCK_MODE=true is ignored because NODE_ENV=production. Remove it from the server settings.');
}

function hasRealKeys(config) {
  return Boolean(config && config.keyId && config.keySecret &&
    !String(config.keyId).startsWith('rzp_test_mock') && !String(config.keySecret).startsWith('mocksecret'));
}

function sourceOf(isOffline) {
  return isOffline ? 'OFFLINE' : 'ONLINE';
}

class PaymentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Helper to fetch restaurant payment credentials
 */
async function getRestaurantPaymentConfig(restaurantId) {
  if (restaurantId) {
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
  }

  // Fallback to platform keys from .env
  return {
    keyId: process.env.RAZORPAY_KEY_ID || null,
    keySecret: process.env.RAZORPAY_KEY_SECRET || null,
    isCustom: false,
    upiId: null,
    upiName: null
  };
}

async function loadOrder(orderId, isOffline) {
  if (isOffline) {
    const [rows] = await pool.query(`SELECT * FROM restaurant_orders WHERE id = ?`, [orderId]);
    return rows[0] || null;
  }
  const [rows] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [orderId]);
  return rows[0] || null;
}

function isOrderPaid(order, isOffline) {
  return isOffline ? order.payment_status === 'PAID' : order.payment_status === 'COMPLETED';
}

/**
 * Initialize an online payment order (Razorpay Multi-Tenant or Mock)
 */
async function createOnlinePaymentOrder(orderId, amountINR, isOffline = false, directRestaurantId = null) {
  require('./OrderLifecycleService').ensureOrderSchema().catch(() => {});
  const source = sourceOf(isOffline);
  const order = await loadOrder(orderId, isOffline);
  if (!order) throw new PaymentError('Order not found.', 404);
  if (isOrderPaid(order, isOffline)) throw new PaymentError('This order has already been paid.');
  if (!isOffline && ['CANCELLED', 'REJECTED'].includes(order.order_status)) {
    throw new PaymentError('This order was cancelled, so it cannot be paid.');
  }

  const restaurantId = directRestaurantId || order.restaurant_id || 1;
  const amountPaise = Math.round(amountINR * 100);
  const config = await getRestaurantPaymentConfig(restaurantId);
  const mock = isMockMode();

  if (!mock && !hasRealKeys(config)) {
    throw new PaymentError('Online payment is not set up for this restaurant yet. Please choose Cash on Delivery or pay at the counter.', 503);
  }

  // Reuse a recent unpaid attempt for the same order and amount, so a double click or a retry
  // opens the same Razorpay order (it can only be paid once) instead of a second one.
  const [recent] = await pool.query(
    `SELECT * FROM payments
     WHERE order_id = ? AND (order_source = ? OR order_source IS NULL) AND status = 'PENDING'
       AND razorpay_order_id IS NOT NULL AND amount = ?
       AND created_at >= (NOW() - INTERVAL 15 MINUTE)
     ORDER BY id DESC LIMIT 1`,
    [orderId, source, amountINR]
  );
  const reusable = recent[0] && (String(recent[0].razorpay_order_id).startsWith('rzp_mock_') === mock) ? recent[0] : null;

  const response = (razorpayOrderId) => ({
    success: true,
    isMock: mock,
    isCustomMerchant: config.isCustom,
    restaurantId,
    keyId: mock ? (config.keyId || 'rzp_test_mock') : config.keyId,
    razorpayOrderId,
    razorpay_order_id: razorpayOrderId,
    amount: amountPaise,
    currency: 'INR',
    upiId: config.upiId,
    upiName: config.upiName
  });

  if (reusable) return response(reusable.razorpay_order_id);

  if (mock) {
    console.warn(`[PAYMENT SERVICE - MOCK MODE] Simulated payment order for ${source} order #${orderId}, ₹${amountINR}. Never enable RAZORPAY_MOCK_MODE on the live server.`);
    const mockRazorpayOrderId = `rzp_mock_ord_${Date.now()}_${orderId}`;
    await pool.query(
      `INSERT INTO payments (order_id, order_source, payment_method, transaction_id, razorpay_order_id, amount, status) VALUES (?, ?, 'ONLINE', ?, ?, ?, 'PENDING')`,
      [orderId, source, `TXN_MOCK_${Date.now()}`, mockRazorpayOrderId, amountINR]
    );
    return response(mockRazorpayOrderId);
  }

  // REAL LIVE / TEST RAZORPAY INSTANCE FOR THIS SPECIFIC RESTAURANT
  try {
    const restaurantRazorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
    const rzpOrder = await restaurantRazorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `rcpt_${isOffline ? 'off' : 'onl'}_${orderId}_${Date.now()}`,
      payment_capture: 1,
      notes: { order_id: String(orderId), order_source: source }
    });

    await pool.query(
      `INSERT INTO payments (order_id, order_source, payment_method, transaction_id, razorpay_order_id, amount, status) VALUES (?, ?, 'ONLINE', ?, ?, ?, 'PENDING')`,
      [orderId, source, rzpOrder.id, rzpOrder.id, amountINR]
    );
    return response(rzpOrder.id);
  } catch (err) {
    console.error('Razorpay Dynamic Order Creation Error:', err);
    throw new PaymentError(err.message || 'Failed to initiate payment gateway.', 502);
  }
}

function signaturesMatch(expectedHex, givenHex) {
  if (typeof givenHex !== 'string' || givenHex.length !== expectedHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex, 'utf8'), Buffer.from(givenHex, 'utf8'));
  } catch (e) {
    return false;
  }
}

async function markOrderPaid(orderId, isOffline) {
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
    // Online-payment orders were held back from the restaurant until now
    await require('./OrderLifecycleService').releasePaidOrder(orderId);
    emitToRoom(`customer_${orderId}`, 'order_updated', { order_id: orderId, payment_status: 'COMPLETED' });
  }
}

async function markAttemptFailed(paymentRow, orderId, isOffline, reason) {
  await pool.query(
    `UPDATE payments SET status = 'FAILED', failure_reason = ? WHERE id = ? AND status = 'PENDING'`,
    [String(reason || 'Payment failed').slice(0, 250), paymentRow.id]
  );
  if (isOffline) {
    await pool.query(`UPDATE restaurant_orders SET payment_status = 'FAILED' WHERE id = ? AND payment_status <> 'PAID'`, [orderId]);
  } else {
    await pool.query(`UPDATE orders SET payment_status = 'FAILED' WHERE id = ? AND payment_status = 'PENDING'`, [orderId]);
  }
}

/**
 * Server-side Payment Verification
 */
async function verifyOnlinePayment(orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, isOffline = false) {
  const source = sourceOf(isOffline);
  if (!razorpayOrderId) throw new PaymentError('Payment reference is missing. Please try paying again.');

  const [rows] = await pool.query(
    `SELECT * FROM payments
     WHERE razorpay_order_id = ? AND order_id = ? AND (order_source = ? OR order_source IS NULL)
     ORDER BY id DESC LIMIT 1`,
    [razorpayOrderId, orderId, source]
  );
  const payment = rows[0];
  if (!payment) {
    throw new PaymentError('This payment does not belong to this order.');
  }

  // Already processed (double submit / retry): report success without doing it again
  if (payment.status === 'SUCCESS') {
    return { verified: true, alreadyProcessed: true };
  }

  const order = await loadOrder(orderId, isOffline);
  if (!order) throw new PaymentError('Order not found.', 404);
  const config = await getRestaurantPaymentConfig(order.restaurant_id);

  let verified = false;
  let isMock = false;
  if (String(razorpayOrderId).startsWith('rzp_mock_')) {
    if (!isMockMode()) throw new PaymentError('Simulated payments are not accepted.');
    isMock = true;
    verified = true;
    console.warn(`[PAYMENT SERVICE - MOCK MODE] Simulated success for ${source} order #${orderId}.`);
  } else {
    if (!hasRealKeys(config)) throw new PaymentError('Online payment is not set up for this restaurant.', 503);
    if (!razorpayPaymentId || !razorpaySignature) {
      await markAttemptFailed(payment, orderId, isOffline, 'Payment was not completed');
      throw new PaymentError('Payment was not completed.');
    }
    const expected = crypto
      .createHmac('sha256', config.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    verified = signaturesMatch(expected, razorpaySignature);
  }

  if (!verified) {
    await markAttemptFailed(payment, orderId, isOffline, 'Signature verification failed');
    throw new PaymentError('Payment verification failed. If money was deducted, it will be refunded automatically by your bank.');
  }

  const txId = razorpayPaymentId || `pay_mock_${Date.now()}`;
  // Only the first verification flips the attempt to SUCCESS and runs the follow-up work
  const [upd] = await pool.query(
    `UPDATE payments SET razorpay_payment_id = ?, status = 'SUCCESS', transaction_id = ?, failure_reason = NULL
     WHERE id = ? AND status <> 'SUCCESS'`,
    [txId, txId, payment.id]
  );
  if (upd.affectedRows === 0) return { verified: true, alreadyProcessed: true };

  await markOrderPaid(orderId, isOffline);
  broadcastEvent('payment_recorded', { order_id: orderId, order_source: source, status: 'SUCCESS', payment_method: 'ONLINE' });
  return { verified: true, isMock, isCustomMerchant: config.isCustom };
}

/**
 * The customer closed the payment window or the gateway reported a failure.
 */
async function recordPaymentFailure(orderId, razorpayOrderId, isOffline = false, reason = 'Payment cancelled') {
  const source = sourceOf(isOffline);
  const [rows] = await pool.query(
    `SELECT * FROM payments
     WHERE razorpay_order_id = ? AND order_id = ? AND (order_source = ? OR order_source IS NULL)
     ORDER BY id DESC LIMIT 1`,
    [razorpayOrderId, orderId, source]
  );
  if (!rows[0]) throw new PaymentError('This payment does not belong to this order.');
  if (rows[0].status === 'SUCCESS') return { recorded: false, alreadyPaid: true };
  await markAttemptFailed(rows[0], orderId, isOffline, reason);
  return { recorded: true };
}

/**
 * Refund a captured payment through Razorpay. Returns { status: 'PROCESSED' | 'PENDING' }.
 * PENDING means the admin has to complete the refund manually (mock payments, missing keys,
 * or a gateway error).
 */
async function refundGatewayPayment(restaurantId, paymentRow, amountINR, reason) {
  if (!paymentRow.razorpay_payment_id || String(paymentRow.razorpay_payment_id).startsWith('pay_mock_')) {
    return { status: 'PENDING', failureReason: 'No gateway payment to refund automatically; please refund manually.' };
  }
  const config = await getRestaurantPaymentConfig(restaurantId);
  if (!hasRealKeys(config)) {
    return { status: 'PENDING', failureReason: 'Razorpay keys are not configured; please refund manually.' };
  }
  const rzp = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
  const refund = await rzp.payments.refund(paymentRow.razorpay_payment_id, {
    amount: Math.round(amountINR * 100),
    notes: { reason: String(reason || 'Order cancelled').slice(0, 250) }
  });
  return { status: 'PROCESSED', gatewayRefundId: refund.id };
}

module.exports = {
  createOnlinePaymentOrder,
  verifyOnlinePayment,
  recordPaymentFailure,
  refundGatewayPayment,
  getRestaurantPaymentConfig,
  PaymentError
};
