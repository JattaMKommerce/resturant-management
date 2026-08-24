/**
 * SubscriptionPaymentService.js
 * Handles SaaS subscription payments:
 * - Razorpay: Instant Payment SUCCESS -> Subscription ACTIVE (with safe renewal preservation)
 * - Offline Manual: Payment PENDING -> Subscription PENDING_APPROVAL -> Super Admin verifies -> SUCCESS -> ACTIVE
 */

const crypto = require('crypto');
const pool = require('../config/database');
const notificationService = require('./NotificationService');

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Initiate a subscription payment intent
 */
async function initiateSubscriptionPayment({ restaurantId, planId, paymentMethod = 'RAZORPAY', offlineProofNote = '', actorUserId = null }) {
  if (!restaurantId) throw new Error('Restaurant ID is required.');
  if (!planId) throw new Error('Plan ID is required.');

  const [planRows] = await pool.query('SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1', [planId]);
  if (planRows.length === 0) throw new Error('Active subscription plan not found.');
  const plan = planRows[0];

  const [restRows] = await pool.query('SELECT id, name FROM restaurants WHERE id = ?', [restaurantId]);
  if (restRows.length === 0) throw new Error('Restaurant not found.');
  const restaurant = restRows[0];

  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const transactionRef = `SUB-${dateCode}-${randomSuffix}`;

  let gatewayOrderId = null;
  const amount = parseFloat(plan.price);
  const currency = 'INR';

  // Razorpay integration handling (live or simulated for test mode)
  if (paymentMethod === 'RAZORPAY') {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret && !keyId.includes('mock')) {
      try {
        const Razorpay = require('razorpay');
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const rzpOrder = await rzp.orders.create({
          amount: Math.round(amount * 100), // in paise
          currency: currency,
          receipt: transactionRef,
          notes: {
            restaurant_id: restaurantId,
            plan_id: plan.id,
            plan_name: plan.name
          }
        });
        gatewayOrderId = rzpOrder.id;
      } catch (rzpErr) {
        console.warn('[SUBSCRIPTION PAYMENT] Razorpay SDK create order fallback:', rzpErr.message);
        gatewayOrderId = `rzp_order_${Date.now()}`;
      }
    } else {
      gatewayOrderId = `rzp_mock_order_${Date.now()}`;
    }
  }

  // Check if hotel already has a subscription row
  const [existingSubs] = await pool.query('SELECT id, status FROM hotel_subscriptions WHERE restaurant_id = ? ORDER BY id DESC LIMIT 1', [restaurantId]);
  let subscriptionId;

  const initialSubStatus = (paymentMethod === 'MANUAL_OFFLINE') ? 'PENDING_APPROVAL' : 'PENDING';
  const initialNotes = (paymentMethod === 'MANUAL_OFFLINE')
    ? `Offline payment proof submitted: ${offlineProofNote || 'UTR Reference provided'}`
    : 'Online checkout initiated';

  if (existingSubs.length > 0) {
    subscriptionId = existingSubs[0].id;
    if (paymentMethod === 'MANUAL_OFFLINE') {
      await pool.query(
        `UPDATE hotel_subscriptions 
         SET plan_id = ?, subscription_type = 'PAID', status = 'PENDING_APPROVAL', notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [plan.id, initialNotes, subscriptionId]
      );
    }
  } else {
    const [createSub] = await pool.query(
      `INSERT INTO hotel_subscriptions (restaurant_id, plan_id, subscription_type, status, starts_at, expires_at, notes)
       VALUES (?, ?, 'PAID', ?, NULL, NULL, ?)`,
      [restaurantId, plan.id, initialSubStatus, initialNotes]
    );
    subscriptionId = createSub.insertId;
  }

  // Insert payment record in PENDING status
  const [paymentResult] = await pool.query(
    `INSERT INTO subscription_payments 
      (subscription_id, restaurant_id, plan_id, amount, currency, payment_method, gateway_order_id, transaction_reference, offline_proof_note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      subscriptionId,
      restaurantId,
      plan.id,
      amount,
      currency,
      paymentMethod,
      gatewayOrderId,
      transactionRef,
      offlineProofNote || null
    ]
  );

  // If offline proof submitted, record PENDING_APPROVAL in history & notify hotel admin
  if (paymentMethod === 'MANUAL_OFFLINE') {
    await pool.query(
      `INSERT INTO subscription_history 
        (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, actor_user_id, notes)
       VALUES (?, ?, ?, 'PENDING_APPROVAL', 'PENDING', 'PENDING_APPROVAL', NULL, NULL, ?, ?)`,
      [
        restaurantId,
        subscriptionId,
        plan.id,
        actorUserId,
        `Offline proof submitted (Tx: ${transactionRef}). Awaiting Super Admin review.`
      ]
    );

    try {
      await notificationService.sendNotification({
        restaurantId: restaurantId,
        title: '⏳ Offline Payment Submitted',
        message: 'Payment submitted. Waiting for Super Admin verification.',
        type: 'SUBSCRIPTION_PENDING_APPROVAL'
      });
    } catch (notifErr) {
      console.error('[NOTIFICATION] Failed to send offline payment notification:', notifErr.message);
    }
  }

  return {
    payment_id: paymentResult.insertId,
    subscription_id: subscriptionId,
    transaction_reference: transactionRef,
    amount,
    currency,
    payment_method: paymentMethod,
    gateway_order_id: gatewayOrderId,
    razorpay_key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key',
    subscription_status: initialSubStatus,
    plan: {
      id: plan.id,
      name: plan.name,
      price: amount,
      duration_days: plan.duration_days
    },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name
    }
  };
}

/**
 * Verify and process an online Razorpay subscription payment.
 * Rule: Direct activation on verified payment (Payment: SUCCESS -> Subscription: ACTIVE).
 * Renewal Rule (Rule 8): If hotel already has an active PAID subscription, extend remaining days without loss.
 */
async function verifyRazorpayPayment({ transactionReference, razorpayPaymentId, razorpaySignature, actorUserId = null }) {
  const connection = await pool.getConnection();
  let restaurantId = null;
  let planName = 'Plan';
  let startsAt = new Date();
  let expiresAt = new Date();
  let durationDays = 30;

  try {
    await connection.beginTransaction();

    const [payRows] = await connection.query(
      'SELECT * FROM subscription_payments WHERE transaction_reference = ? FOR UPDATE',
      [transactionReference]
    );

    if (payRows.length === 0) throw new Error('Transaction record not found.');
    const payment = payRows[0];
    restaurantId = payment.restaurant_id;

    if (payment.status === 'SUCCESS') {
      await connection.commit();
      return { 
        success: true, 
        message: 'Payment already verified and subscription is ACTIVE.',
        status: 'ACTIVE',
        payment 
      };
    }

    // Verify Razorpay HMAC signature if live credentials configured
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keySecret && razorpaySignature && !keySecret.includes('mock') && payment.gateway_order_id) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${payment.gateway_order_id}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        await connection.query(
          `UPDATE subscription_payments SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [payment.id]
        );
        await connection.commit();
        throw new Error('Invalid Razorpay payment signature.');
      }
    }

    // 1. Mark payment as SUCCESS
    await connection.query(
      `UPDATE subscription_payments 
       SET status = 'SUCCESS', gateway_payment_id = ?, verified_at = CURRENT_TIMESTAMP, verified_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [razorpayPaymentId || 'rzp_pay_mock', actorUserId, payment.id]
    );

    // 2. Fetch plan details
    const [planRows] = await connection.query('SELECT * FROM subscription_plans WHERE id = ?', [payment.plan_id]);
    const plan = planRows[0];
    planName = plan.name;
    durationDays = plan.duration_days || 30;

    // 3. Fetch existing subscription row to check for active paid renewal
    const [subRows] = await connection.query(
      'SELECT * FROM hotel_subscriptions WHERE id = ? FOR UPDATE',
      [payment.subscription_id]
    );
    const existingSub = subRows.length > 0 ? subRows[0] : null;

    const now = new Date();
    const isCurrentActivePaid = (
      existingSub &&
      existingSub.status === 'ACTIVE' &&
      existingSub.subscription_type === 'PAID' &&
      existingSub.expires_at &&
      new Date(existingSub.expires_at).getTime() > now.getTime()
    );

    if (isCurrentActivePaid) {
      // Safe Renewal (Rule 8): Extend from current expires_at
      const currentExpiryMs = new Date(existingSub.expires_at).getTime();
      startsAt = existingSub.starts_at || now;
      expiresAt = new Date(currentExpiryMs + durationDays * 24 * 60 * 60 * 1000);
    } else {
      // New activation from trial, expired, or initial purchase
      startsAt = now;
      expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    // 4. Directly Activate Subscription (NO PENDING_APPROVAL for Razorpay)
    await connection.query(
      `UPDATE hotel_subscriptions 
       SET plan_id = ?, subscription_type = 'PAID', status = 'ACTIVE', starts_at = ?, expires_at = ?, 
           notes = 'Razorpay Payment Verified. Active immediately.', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [plan.id, startsAt, expiresAt, payment.subscription_id]
    );

    // 5. Audit log history
    await connection.query(
      `INSERT INTO subscription_history 
        (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, actor_user_id, notes)
       VALUES (?, ?, ?, 'APPROVED', 'PENDING', 'ACTIVE', ?, ?, ?, ?)`,
      [
        payment.restaurant_id,
        payment.subscription_id,
        plan.id,
        startsAt,
        expiresAt,
        actorUserId,
        `Payment SUCCESS (Tx: ${transactionReference}, RzpPayId: ${razorpayPaymentId || 'simulated'}). Active until ${formatDate(expiresAt)}.`
      ]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // 6. Send Instant Activation Notification
  if (restaurantId) {
    try {
      await notificationService.sendNotification({
        restaurantId: restaurantId,
        title: '🎉 Subscription Activated!',
        message: `🎉 Your ${planName} subscription is now ACTIVE until ${formatDate(expiresAt)}. Full HMS operational access is enabled.`,
        type: 'SUBSCRIPTION_APPROVED'
      });
    } catch (notifErr) {
      console.error('[NOTIFICATION] Failed to send payment verified notification:', notifErr.message);
    }
  }

  return {
    success: true,
    message: `Payment verified! Your ${planName} subscription is now ACTIVE until ${formatDate(expiresAt)}. Full HMS access granted.`,
    status: 'ACTIVE',
    starts_at: startsAt,
    expires_at: expiresAt,
    transaction_reference: transactionReference
  };
}

/**
 * Get SaaS invoices for a hotel
 */
async function getHotelInvoices(restaurantId) {
  const [payments] = await pool.query(
    `SELECT sp.*, p.name as plan_name, p.duration_days, hs.status as subscription_status,
            u.name as verified_by_name
     FROM subscription_payments sp
     JOIN subscription_plans p ON sp.plan_id = p.id
     JOIN hotel_subscriptions hs ON sp.subscription_id = hs.id
     LEFT JOIN users u ON sp.verified_by_user_id = u.id
     WHERE sp.restaurant_id = ?
     ORDER BY sp.id DESC`,
    [restaurantId]
  );
  return payments;
}

/**
 * Get all SaaS payments across all hotels for Super Admin ledger
 */
async function getAllPlatformSubscriptionPayments() {
  const [payments] = await pool.query(
    `SELECT sp.*, r.name as restaurant_name, r.slug as restaurant_slug,
            p.name as plan_name, p.duration_days, hs.status as subscription_status,
            u.name as verified_by_name
     FROM subscription_payments sp
     JOIN restaurants r ON sp.restaurant_id = r.id
     JOIN subscription_plans p ON sp.plan_id = p.id
     JOIN hotel_subscriptions hs ON sp.subscription_id = hs.id
     LEFT JOIN users u ON sp.verified_by_user_id = u.id
     ORDER BY sp.id DESC`
  );
  return payments;
}

module.exports = {
  initiateSubscriptionPayment,
  verifyRazorpayPayment,
  getHotelInvoices,
  getAllPlatformSubscriptionPayments
};
