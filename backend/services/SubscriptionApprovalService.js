/**
 * SubscriptionApprovalService.js
 * Dedicated Super Admin approval engine for offline manual payments.
 * Enforces atomic state transitions: PENDING_APPROVAL -> ACTIVE (on APPROVE) or REJECTED (on REJECT).
 * Safe Renewal Rule (Rule 8): Extends from existing expires_at if already on an active paid plan.
 * Sends notifications to Hotel Admin after successful transaction commit.
 */

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
 * Get all pending subscription requests waiting for Super Admin review (Offline transfers)
 */
async function getPendingApprovalsQueue() {
  const [rows] = await pool.query(
    `SELECT hs.id as subscription_id, hs.restaurant_id, hs.plan_id, hs.status as subscription_status,
            hs.created_at as submitted_at, hs.notes as subscription_notes,
            r.name as restaurant_name, r.slug as restaurant_slug, r.email as restaurant_email, r.phone as restaurant_phone, r.city as restaurant_city,
            sp.name as plan_name, sp.slug as plan_slug, sp.price as plan_price, sp.duration_days as plan_duration_days,
            pay.id as payment_id, pay.amount as payment_amount, pay.currency as payment_currency,
            pay.payment_method, pay.gateway_order_id, pay.gateway_payment_id, pay.transaction_reference,
            pay.offline_proof_note, pay.status as payment_status, pay.created_at as payment_date
     FROM hotel_subscriptions hs
     JOIN restaurants r ON hs.restaurant_id = r.id
     JOIN subscription_plans sp ON hs.plan_id = sp.id
     LEFT JOIN (
       SELECT p1.*
       FROM subscription_payments p1
       INNER JOIN (
         SELECT subscription_id, MAX(id) as max_id
         FROM subscription_payments
         GROUP BY subscription_id
       ) p2 ON p1.id = p2.max_id
     ) pay ON hs.id = pay.subscription_id
     WHERE hs.status = 'PENDING_APPROVAL'
     ORDER BY hs.id ASC`
  );

  return rows.map(r => ({
    subscription_id: r.subscription_id,
    restaurant_id: r.restaurant_id,
    restaurant_name: r.restaurant_name,
    restaurant_slug: r.restaurant_slug,
    restaurant_email: r.restaurant_email,
    restaurant_phone: r.restaurant_phone,
    restaurant_city: r.restaurant_city,
    plan_id: r.plan_id,
    plan_name: r.plan_name,
    plan_slug: r.plan_slug,
    plan_price: parseFloat(r.plan_price),
    plan_duration_days: r.plan_duration_days,
    payment_id: r.payment_id,
    payment_amount: r.payment_amount ? parseFloat(r.payment_amount) : parseFloat(r.plan_price),
    payment_currency: r.payment_currency || 'INR',
    payment_method: r.payment_method || 'MANUAL_OFFLINE',
    transaction_reference: r.transaction_reference || 'N/A',
    gateway_payment_id: r.gateway_payment_id,
    offline_proof_note: r.offline_proof_note,
    payment_status: r.payment_status || 'PENDING',
    subscription_status: r.subscription_status,
    submitted_at: r.submitted_at,
    payment_date: r.payment_date || r.submitted_at
  }));
}

/**
 * Super Admin APPROVES a pending offline subscription request.
 * Transitions PENDING_APPROVAL -> ACTIVE, computes duration (with Safe Renewal Rule 8), marks offline payment SUCCESS.
 * Sends notification to Hotel Admin.
 */
async function approveSubscription({ subscriptionId, actorUserId, notes = '' }) {
  const connection = await pool.getConnection();
  let restaurantId = null;
  let planName = 'Plan';
  let startsAt = new Date();
  let expiresAt = new Date();
  let durationDays = 30;
  let restaurantName = '';

  try {
    await connection.beginTransaction();

    const [subRows] = await connection.query(
      `SELECT hs.*, r.name as restaurant_name 
       FROM hotel_subscriptions hs
       JOIN restaurants r ON hs.restaurant_id = r.id
       WHERE hs.id = ? FOR UPDATE`,
      [subscriptionId]
    );

    if (subRows.length === 0) throw new Error('Subscription record not found.');
    const sub = subRows[0];
    restaurantId = sub.restaurant_id;
    restaurantName = sub.restaurant_name;

    if (sub.status === 'ACTIVE') {
      await connection.commit();
      return { success: true, message: 'Subscription is already ACTIVE.' };
    }

    if (sub.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve subscription with status "${sub.status}". Only PENDING_APPROVAL can be approved.`);
    }

    const [planRows] = await connection.query('SELECT * FROM subscription_plans WHERE id = ?', [sub.plan_id]);
    if (planRows.length === 0) throw new Error('Associated plan not found.');
    const plan = planRows[0];
    planName = plan.name;
    durationDays = plan.duration_days || 30;

    const now = new Date();
    const isCurrentActivePaid = (
      sub.subscription_type === 'PAID' &&
      sub.expires_at &&
      new Date(sub.expires_at).getTime() > now.getTime()
    );

    if (isCurrentActivePaid) {
      // Safe Renewal (Rule 8): Extend from current expires_at
      const currentExpiryMs = new Date(sub.expires_at).getTime();
      startsAt = sub.starts_at || now;
      expiresAt = new Date(currentExpiryMs + durationDays * 24 * 60 * 60 * 1000);
    } else {
      // New activation
      startsAt = now;
      expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    // 1. Update subscription to ACTIVE
    await connection.query(
      `UPDATE hotel_subscriptions 
       SET plan_id = ?, subscription_type = 'PAID', status = 'ACTIVE', starts_at = ?, expires_at = ?, approved_by_user_id = ?, approved_at = ?, 
           notes = CONCAT(COALESCE(notes,''), ' | Approved by Super Admin: ', ?), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [plan.id, startsAt, expiresAt, actorUserId, now, notes || 'Approved', sub.id]
    );

    // 2. If there is a payment in PENDING status (offline transfer), transition it to SUCCESS
    await connection.query(
      `UPDATE subscription_payments 
       SET status = 'SUCCESS', verified_at = ?, verified_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE subscription_id = ? AND status = 'PENDING'`,
      [now, actorUserId, sub.id]
    );

    // 3. Audit log history
    await connection.query(
      `INSERT INTO subscription_history 
        (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, actor_user_id, notes)
       VALUES (?, ?, ?, 'APPROVED', 'PENDING_APPROVAL', 'ACTIVE', ?, ?, ?, ?)`,
      [
        sub.restaurant_id,
        sub.id,
        plan.id,
        startsAt,
        expiresAt,
        actorUserId,
        notes || `Approved by Super Admin. Plan active until ${formatDate(expiresAt)}.`
      ]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // 4. Send Notification after commit
  try {
    await notificationService.sendNotification({
      restaurantId: restaurantId,
      title: '🎉 Subscription Approved!',
      message: `🎉 Your ${planName} subscription has been approved and is now ACTIVE until ${formatDate(expiresAt)}.`,
      type: 'SUBSCRIPTION_APPROVED'
    });
  } catch (notifErr) {
    console.error('[NOTIFICATION] Failed to send subscription approval notification:', notifErr.message);
  }

  return {
    success: true,
    message: `Subscription approved successfully! Hotel has been granted active HMS access until ${formatDate(expiresAt)}.`,
    subscription_id: subscriptionId,
    restaurant_id: restaurantId,
    restaurant_name: restaurantName,
    status: 'ACTIVE',
    starts_at: startsAt,
    expires_at: expiresAt
  };
}

/**
 * Super Admin REJECTS a pending subscription request.
 * Transitions PENDING_APPROVAL -> REJECTED, marks offline payment REJECTED, keeps access blocked.
 * Sends notification to Hotel Admin.
 */
async function rejectSubscription({ subscriptionId, actorUserId, reason = '' }) {
  if (!reason || !reason.trim()) {
    throw new Error('A valid rejection reason is required.');
  }

  const connection = await pool.getConnection();
  let restaurantId = null;

  try {
    await connection.beginTransaction();

    const [subRows] = await connection.query(
      'SELECT * FROM hotel_subscriptions WHERE id = ? FOR UPDATE',
      [subscriptionId]
    );

    if (subRows.length === 0) throw new Error('Subscription record not found.');
    const sub = subRows[0];
    restaurantId = sub.restaurant_id;

    if (sub.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot reject subscription with status "${sub.status}". Only PENDING_APPROVAL can be rejected.`);
    }

    const rejectedAt = new Date();

    // 1. Update subscription to REJECTED
    await connection.query(
      `UPDATE hotel_subscriptions 
       SET status = 'REJECTED', rejected_by_user_id = ?, rejected_at = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [actorUserId, rejectedAt, reason.trim(), sub.id]
    );

    // 2. If payment was PENDING (offline payment proof), mark it REJECTED
    await connection.query(
      `UPDATE subscription_payments 
       SET status = 'REJECTED', verified_at = ?, verified_by_user_id = ?, 
           offline_proof_note = CONCAT(COALESCE(offline_proof_note,''), ' | Rejection reason: ', ?), updated_at = CURRENT_TIMESTAMP
       WHERE subscription_id = ? AND status = 'PENDING'`,
      [rejectedAt, actorUserId, reason.trim(), sub.id]
    );

    // 3. Audit log history
    await connection.query(
      `INSERT INTO subscription_history 
        (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, actor_user_id, notes)
       VALUES (?, ?, ?, 'REJECTED', 'PENDING_APPROVAL', 'REJECTED', NULL, NULL, ?, ?)`,
      [
        sub.restaurant_id,
        sub.id,
        sub.plan_id,
        actorUserId,
        `Rejected by Super Admin: ${reason.trim()}`
      ]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // 4. Send Notification after commit
  try {
    await notificationService.sendNotification({
      restaurantId: restaurantId,
      title: '⚠️ Subscription Request Rejected',
      message: `Your payment/subscription request was rejected. Reason: ${reason.trim()}`,
      type: 'SUBSCRIPTION_REJECTED'
    });
  } catch (notifErr) {
    console.error('[NOTIFICATION] Failed to send subscription rejection notification:', notifErr.message);
  }

  return {
    success: true,
    message: 'Subscription request has been rejected. Operational access remains blocked.',
    subscription_id: subscriptionId,
    restaurant_id: restaurantId,
    status: 'REJECTED',
    rejection_reason: reason.trim()
  };
}

module.exports = {
  getPendingApprovalsQueue,
  approveSubscription,
  rejectSubscription
};
