const webPush = require('web-push');
const { query } = require('../config/db');

let vapidKeys = null;

function initVapidKeys() {
  if (vapidKeys) return vapidKeys;

  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    vapidKeys = {
      publicKey: envPublic,
      privateKey: envPrivate
    };
  } else {
    // Generate automated in-memory VAPID keys for 100% free push delivery
    vapidKeys = webPush.generateVAPIDKeys();
    console.log('🔑 Auto-generated Web Push VAPID keys initialized.');
  }

  try {
    webPush.setVapidDetails(
      process.env.VAPID_MAILTO || 'mailto:support@jattamkommerce.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (err) {
    console.warn('VAPID details setup warning:', err.message);
  }

  return vapidKeys;
}

function getPublicKey() {
  const keys = initVapidKeys();
  return keys ? keys.publicKey : null;
}

/**
 * Save browser push subscription
 */
async function saveSubscription({ order_id, customer_identity_id, user_id, subscription, user_agent }) {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Invalid Web Push subscription payload');
  }

  initVapidKeys();

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys.p256dh;
  const auth = subscription.keys.auth;

  // Check existing subscription to prevent duplicates
  const existing = await query(
    'SELECT id FROM push_subscriptions WHERE endpoint = ? LIMIT 1',
    [endpoint]
  );

  if (existing.length > 0) {
    await query(
      `UPDATE push_subscriptions 
       SET order_id = COALESCE(?, order_id),
           customer_identity_id = COALESCE(?, customer_identity_id),
           user_id = COALESCE(?, user_id),
           p256dh = ?, auth = ?, user_agent = ?
       WHERE id = ?`,
      [order_id || null, customer_identity_id || null, user_id || null, p256dh, auth, user_agent || null, existing[0].id]
    );
    return existing[0].id;
  } else {
    const res = await query(
      `INSERT INTO push_subscriptions (order_id, customer_identity_id, user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [order_id || null, customer_identity_id || null, user_id || null, endpoint, p256dh, auth, user_agent || null]
    );
    return res.insertId;
  }
}

/**
 * Calculate Haversine distance in kilometers
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate estimated transit time in minutes (assumes ~25 km/h avg speed + 3 min buffer)
 */
function calculateEtaMinutes(driverLat, driverLng, customerLat, customerLng) {
  const distKm = calculateDistanceKm(driverLat, driverLng, customerLat, customerLng);
  if (distKm === null) return 15;
  const transitMins = Math.round((distKm / 25) * 60) + 3;
  return Math.max(2, transitMins);
}

/**
 * Build natural, customer-friendly notification text (No raw order numbers)
 */
function formatCustomerPushPayload(restaurantName, status, extraData = {}) {
  const brand = restaurantName || 'Grand Palace';
  const driverName = extraData.driverName || 'Your delivery partner';
  const etaMins = extraData.etaMins;

  let title = `${brand} 🏨`;
  let body = 'Your order status has been updated.';

  switch (String(status).toUpperCase()) {
    case 'CONFIRMED':
    case 'ACCEPTED':
      title = `${brand} 🟢`;
      body = 'Your order has been confirmed by the restaurant!';
      break;

    case 'SENT_TO_KITCHEN':
    case 'IN_KITCHEN':
      title = `${brand} 👨‍🍳`;
      body = 'Your order has been sent to the kitchen!';
      break;

    case 'PREPARING':
      title = `${brand} 🔥`;
      body = 'Chefs are preparing your delicious meal!';
      break;

    case 'READY':
    case 'READY_FOR_PICKUP':
      title = `${brand} 🛎️`;
      body = 'Your food is ready! Waiting for delivery partner...';
      break;

    case 'ASSIGNED_TO_DRIVER':
    case 'DRIVER_ACCEPTED':
      title = `${brand} 🛵`;
      body = `Delivery partner ${driverName} is heading to the restaurant!`;
      break;

    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
      title = `${brand} 🚀`;
      body = `${driverName} picked up your order! On the way${etaMins ? ` (ETA ~${etaMins} mins)` : ''}.`;
      break;

    case 'NEARBY':
    case 'ABOUT_TO_DELIVER':
      title = `${brand} 📍`;
      body = `${driverName} is about to arrive (<500m away)! Please meet at the door.`;
      break;

    case 'DELIVERED':
    case 'SERVED':
    case 'COMPLETED':
      title = `${brand} 🎉`;
      body = `Your order has been delivered successfully by ${driverName}. Enjoy your meal!`;
      break;

    case 'CANCELLED':
    case 'REJECTED':
      title = `${brand} ⚠️`;
      body = 'Your order status: Cancelled. Please contact restaurant support.';
      break;

    default:
      title = `${brand} 🔔`;
      body = `Your order status is now: ${status}`;
      break;
  }

  return {
    title,
    body,
    icon: '/logo.png',
    status,
    url: extraData.orderId ? `/order/${extraData.orderId}/track` : '/customer/orders'
  };
}

/**
 * Send Web Push notification to all devices subscribed to an order
 */
async function sendPushForOrder(orderId, status, extraData = {}) {
  try {
    if (!orderId) return;
    initVapidKeys();

    // Fetch order & restaurant details
    const [orders] = await query(
      `SELECT o.id, o.restaurant_id, o.customer_identity_id, o.customer_name, r.name as restaurant_name
       FROM orders o
       LEFT JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.id = ? LIMIT 1`,
      [orderId]
    );

    const orderObj = orders[0] || {};
    const restaurantName = orderObj.restaurant_name || 'Grand Palace';

    // Fetch subscriptions for this order or customer identity
    const subs = await query(
      `SELECT * FROM push_subscriptions 
       WHERE order_id = ? OR (customer_identity_id IS NOT NULL AND customer_identity_id = ?)`,
      [orderId, orderObj.customer_identity_id || -1]
    );

    if (subs.length === 0) return;

    const payloadObj = formatCustomerPushPayload(restaurantName, status, {
      ...extraData,
      orderId
    });

    const payloadString = JSON.stringify({
      notification: payloadObj,
      title: payloadObj.title,
      body: payloadObj.body,
      icon: payloadObj.icon,
      url: payloadObj.url,
      order_id: orderId,
      status
    });

    for (const sub of subs) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webPush.sendNotification(pushSubscription, payloadString);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or revoked by browser - remove from DB
          await query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        } else {
          console.warn(`Web push dispatch notice (sub #${sub.id}):`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('sendPushForOrder error:', err.message);
  }
}

module.exports = {
  initVapidKeys,
  getPublicKey,
  saveSubscription,
  calculateDistanceKm,
  calculateEtaMinutes,
  formatCustomerPushPayload,
  sendPushForOrder
};
