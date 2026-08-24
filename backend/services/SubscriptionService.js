/**
 * SubscriptionService.js
 * Authoritative SaaS subscription & entitlement service.
 * Handles 7-Day Free Trial provisioning, server-time countdown, strict zero-grace expiry, and paid plan lifecycle.
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
 * Automatically provision a 7-Day Free Trial for a new hotel
 */
async function provisionHotelTrial(restaurantId) {
  if (!restaurantId) return null;

  // Check if restaurant already has a subscription
  const [existing] = await pool.query('SELECT id, status FROM hotel_subscriptions WHERE restaurant_id = ?', [restaurantId]);
  if (existing.length > 0) {
    return existing[0];
  }

  // Find or create trial plan
  let [trialPlanRows] = await pool.query("SELECT * FROM subscription_plans WHERE slug = 'free-trial' OR slug = 'trial' LIMIT 1");
  let trialPlanId = null;

  if (trialPlanRows.length > 0) {
    trialPlanId = trialPlanRows[0].id;
  } else {
    const [createPlan] = await pool.query(
      `INSERT INTO subscription_plans (name, slug, description, price, duration_days, max_orders_per_month, max_menu_items, max_staff_accounts, features_json, is_active, display_order)
       VALUES ('7-Day Free Trial', 'free-trial', 'Full complimentary operational access for 7 days.', 0.00, 7, 100, 50, 5, ?, 1, 0)`,
      [JSON.stringify(['Kitchen Display System (KDS)', 'Table QR Digital Menus', 'POS Billing & GST Invoices', 'Online Customer Storefront', 'Dedicated Rider Dispatch'])]
    );
    trialPlanId = createPlan.insertId;
  }

  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [insertSub] = await pool.query(
    `INSERT INTO hotel_subscriptions 
      (restaurant_id, plan_id, subscription_type, status, starts_at, expires_at, notes)
     VALUES (?, ?, 'TRIAL', 'ACTIVE', ?, ?, '7-Day Free Trial activated on registration')`,
    [restaurantId, trialPlanId, startsAt, expiresAt]
  );

  // History log
  await pool.query(
    `INSERT INTO subscription_history 
      (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, notes)
     VALUES (?, ?, ?, 'ASSIGNED', 'PENDING', 'ACTIVE', ?, ?, '7-Day Free Trial activated')`,
    [restaurantId, insertSub.insertId, trialPlanId, startsAt, expiresAt]
  );

  // Send Welcome Trial Notification
  try {
    await notificationService.sendNotification({
      restaurantId: restaurantId,
      title: '🎉 Welcome to HMS! Free Trial Active',
      message: `Your 7-day free trial is active until ${formatDate(expiresAt)}. Enjoy full access to all operational features.`,
      type: 'SUBSCRIPTION_APPROVED'
    });
  } catch (err) {
    console.warn('[NOTIFICATION] Trial notification failed:', err.message);
  }

  return {
    subscription_id: insertSub.insertId,
    restaurant_id: restaurantId,
    subscription_type: 'TRIAL',
    status: 'ACTIVE',
    starts_at: startsAt,
    expires_at: expiresAt
  };
}

/**
 * Get active subscription status for a hotel with server-authoritative time evaluation
 */
async function getHotelActiveSubscription(restaurantId) {
  if (!restaurantId) {
    return {
      has_subscription: false,
      status: 'NO_SUBSCRIPTION',
      is_trial: false,
      is_expiring_soon: false,
      remaining_ms: 0,
      server_time: new Date().toISOString()
    };
  }

  const [rows] = await pool.query(
    `SELECT hs.*, 
            sp.name as plan_name, sp.slug as plan_slug, sp.description as plan_description,
            sp.price as plan_price, sp.duration_days, sp.max_orders_per_month,
            sp.max_menu_items, sp.max_staff_accounts, sp.features_json,
            r.name as restaurant_name, r.slug as restaurant_slug
     FROM hotel_subscriptions hs
     JOIN subscription_plans sp ON hs.plan_id = sp.id
     JOIN restaurants r ON hs.restaurant_id = r.id
     WHERE hs.restaurant_id = ?
     ORDER BY hs.id DESC LIMIT 1`,
    [restaurantId]
  );

  const serverTime = new Date();

  // If hotel has no subscription record at all, auto-provision 7-Day Free Trial
  if (rows.length === 0) {
    const trial = await provisionHotelTrial(restaurantId);
    if (trial) {
      return getHotelActiveSubscription(restaurantId);
    }
    return {
      has_subscription: false,
      status: 'NO_SUBSCRIPTION',
      is_trial: false,
      is_expiring_soon: false,
      remaining_ms: 0,
      server_time: serverTime.toISOString()
    };
  }

  const sub = rows[0];
  let status = sub.status;
  let remainingMs = 0;
  let isExpiringSoon = false;

  // Real-time server expiration check (Strict zero grace period)
  if (status === 'ACTIVE' && sub.expires_at) {
    const expiryTime = new Date(sub.expires_at).getTime();
    remainingMs = Math.max(0, expiryTime - serverTime.getTime());

    if (remainingMs === 0) {
      status = 'EXPIRED';
      // Automatically persist EXPIRED status in database
      await pool.query(
        `UPDATE hotel_subscriptions SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [sub.id]
      );
      await pool.query(
        `INSERT INTO subscription_history (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, notes)
         VALUES (?, ?, ?, 'EXPIRED', 'ACTIVE', 'EXPIRED', 'Server-authoritative expiry reached')`,
        [sub.restaurant_id, sub.id, sub.plan_id]
      );
    } else if (remainingMs <= 3 * 24 * 60 * 60 * 1000) {
      isExpiringSoon = true;
    }
  }

  let features = [];
  try {
    features = typeof sub.features_json === 'string' ? JSON.parse(sub.features_json) : (sub.features_json || []);
  } catch (e) {
    features = [];
  }

  const isTrial = sub.subscription_type === 'TRIAL' || sub.plan_slug === 'free-trial';

  return {
    has_subscription: true,
    subscription_id: sub.id,
    restaurant_id: sub.restaurant_id,
    restaurant_name: sub.restaurant_name,
    restaurant_slug: sub.restaurant_slug,
    plan_id: sub.plan_id,
    plan_name: sub.plan_name,
    plan_slug: sub.plan_slug,
    plan_price: parseFloat(sub.plan_price || 0),
    subscription_type: sub.subscription_type || (isTrial ? 'TRIAL' : 'PAID'),
    is_trial: isTrial,
    status,
    starts_at: sub.starts_at,
    expires_at: sub.expires_at,
    server_time: serverTime.toISOString(),
    remaining_ms: remainingMs,
    is_expiring_soon: isExpiringSoon,
    rejection_reason: sub.rejection_reason || null,
    features,
    quotas: {
      max_orders_per_month: sub.max_orders_per_month,
      max_menu_items: sub.max_menu_items,
      max_staff_accounts: sub.max_staff_accounts
    }
  };
}

/**
 * Super Admin manually assigns or activates a plan for a hotel
 */
async function assignPlanToHotel(restaurantId, planId, durationDays = null, actorUserId = null, notes = '') {
  const [planRows] = await pool.query('SELECT * FROM subscription_plans WHERE id = ?', [planId]);
  if (planRows.length === 0) throw new Error('Subscription plan not found.');
  const plan = planRows[0];

  const days = durationDays ? parseInt(durationDays, 10) : plan.duration_days;
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
  const subType = plan.slug === 'free-trial' ? 'TRIAL' : 'PAID';

  const [existing] = await pool.query('SELECT id, status FROM hotel_subscriptions WHERE restaurant_id = ?', [restaurantId]);

  let subscriptionId;
  let previousStatus = 'NONE';

  if (existing.length > 0) {
    previousStatus = existing[0].status;
    await pool.query(
      `UPDATE hotel_subscriptions 
       SET plan_id = ?, subscription_type = ?, status = 'ACTIVE', starts_at = ?, expires_at = ?, 
           approved_by_user_id = ?, approved_at = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [plan.id, subType, startsAt, expiresAt, actorUserId, startsAt, notes, existing[0].id]
    );
    subscriptionId = existing[0].id;
  } else {
    const [result] = await pool.query(
      `INSERT INTO hotel_subscriptions 
        (restaurant_id, plan_id, subscription_type, status, starts_at, expires_at, approved_by_user_id, approved_at, notes)
       VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`,
      [restaurantId, plan.id, subType, startsAt, expiresAt, actorUserId, startsAt, notes]
    );
    subscriptionId = result.insertId;
  }

  await pool.query(
    `INSERT INTO subscription_history 
      (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, actor_user_id, notes)
     VALUES (?, ?, ?, 'ASSIGNED', ?, 'ACTIVE', ?, ?, ?, ?)`,
    [restaurantId, subscriptionId, plan.id, previousStatus, startsAt, expiresAt, actorUserId, notes]
  );

  return getHotelActiveSubscription(restaurantId);
}

/**
 * Extend active subscription duration by extra days
 */
async function extendSubscription(restaurantId, extraDays, actorUserId = null, notes = '') {
  const currentSub = await getHotelActiveSubscription(restaurantId);
  if (!currentSub.has_subscription) {
    throw new Error('Hotel does not have any active subscription to extend.');
  }

  const baseDate = (currentSub.status === 'ACTIVE' && currentSub.expires_at) 
    ? new Date(currentSub.expires_at) 
    : new Date();

  const newExpiresAt = new Date(baseDate.getTime() + parseInt(extraDays, 10) * 24 * 60 * 60 * 1000);

  await pool.query(
    `UPDATE hotel_subscriptions 
     SET status = 'ACTIVE', expires_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newExpiresAt, currentSub.subscription_id]
  );

  await pool.query(
    `INSERT INTO subscription_history 
      (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, actor_user_id, notes)
     VALUES (?, ?, ?, 'EXTENDED', ?, 'ACTIVE', ?, ?, ?, ?)`,
    [restaurantId, currentSub.subscription_id, currentSub.plan_id, currentSub.status, currentSub.starts_at, newExpiresAt, actorUserId, notes]
  );

  return getHotelActiveSubscription(restaurantId);
}

/**
 * Super Admin updates hotel subscription status (ACTIVE, SUSPENDED, CANCELLED)
 */
async function updateHotelSubscriptionStatus(restaurantId, newStatus, actorUserId = null, notes = '') {
  const currentSub = await getHotelActiveSubscription(restaurantId);
  if (!currentSub.has_subscription) throw new Error('Hotel subscription not found.');

  await pool.query(
    `UPDATE hotel_subscriptions 
     SET status = ?, notes = CONCAT(COALESCE(notes,''), ' | Status changed to ', ?), updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newStatus, newStatus, currentSub.subscription_id]
  );

  await pool.query(
    `INSERT INTO subscription_history 
      (restaurant_id, subscription_id, plan_id, action, previous_status, new_status, starts_at, expires_at, actor_user_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [restaurantId, currentSub.subscription_id, currentSub.plan_id, newStatus, currentSub.status, newStatus, currentSub.starts_at, currentSub.expires_at, actorUserId, notes]
  );

  return getHotelActiveSubscription(restaurantId);
}

/**
 * Get all hotels with real-time subscription details for Super Admin
 */
async function getAllHotelsWithSubscriptions() {
  const [hotels] = await pool.query(
    `SELECT r.id as restaurant_id, r.name as restaurant_name, r.slug as restaurant_slug,
            r.email as restaurant_email, r.phone as restaurant_phone, r.city as restaurant_city,
            hs.id as subscription_id, hs.subscription_type, hs.status as subscription_status,
            hs.starts_at, hs.expires_at, hs.rejection_reason,
            sp.id as plan_id, sp.name as plan_name, sp.slug as plan_slug, sp.price as plan_price,
            sp.duration_days as plan_duration_days
     FROM restaurants r
     LEFT JOIN hotel_subscriptions hs ON r.id = hs.restaurant_id
     LEFT JOIN subscription_plans sp ON hs.plan_id = sp.id
     ORDER BY r.id ASC`
  );

  const serverTime = new Date();

  return hotels.map(h => {
    let status = h.subscription_status || 'NO_SUBSCRIPTION';
    let remainingMs = 0;

    if (status === 'ACTIVE' && h.expires_at) {
      const expiry = new Date(h.expires_at).getTime();
      remainingMs = Math.max(0, expiry - serverTime.getTime());
      if (remainingMs === 0) status = 'EXPIRED';
    }

    const isTrial = h.subscription_type === 'TRIAL' || h.plan_slug === 'free-trial';

    return {
      restaurant_id: h.restaurant_id,
      restaurant_name: h.restaurant_name,
      restaurant_slug: h.restaurant_slug,
      restaurant_email: h.restaurant_email,
      restaurant_phone: h.restaurant_phone,
      restaurant_city: h.restaurant_city,
      has_subscription: Boolean(h.subscription_id),
      subscription_id: h.subscription_id,
      subscription_type: h.subscription_type || (isTrial ? 'TRIAL' : 'PAID'),
      is_trial: isTrial,
      plan_id: h.plan_id,
      plan_name: h.plan_name || 'No Plan',
      plan_slug: h.plan_slug || 'none',
      plan_price: h.plan_price ? parseFloat(h.plan_price) : 0,
      plan_duration_days: h.plan_duration_days || 0,
      status,
      starts_at: h.starts_at,
      expires_at: h.expires_at,
      remaining_ms: remainingMs,
      rejection_reason: h.rejection_reason
    };
  });
}

module.exports = {
  provisionHotelTrial,
  getHotelActiveSubscription,
  assignPlanToHotel,
  extendSubscription,
  updateHotelSubscriptionStatus,
  getAllHotelsWithSubscriptions
};
