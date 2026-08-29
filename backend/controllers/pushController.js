const pushService = require('../services/pushNotificationService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Return VAPID Public Key for client browser subscription
 */
async function getPublicKey(req, res, next) {
  try {
    const key = pushService.getPublicKey();
    if (!key) {
      return sendError(res, 'VAPID public key not initialized', 500);
    }
    return sendSuccess(res, { publicKey: key }, 'VAPID public key fetched');
  } catch (err) {
    next(err);
  }
}

/**
 * Save browser push subscription
 */
async function subscribe(req, res, next) {
  try {
    const { order_id, subscription, customer_identity_id } = req.body;

    if (!subscription || !subscription.endpoint) {
      return sendError(res, 'Subscription data is required', 400);
    }

    const userAgent = req.headers['user-agent'] || '';
    const userId = req.user ? req.user.id : null;

    const subId = await pushService.saveSubscription({
      order_id: order_id ? parseInt(order_id, 10) : null,
      customer_identity_id: customer_identity_id || null,
      user_id: userId,
      subscription,
      user_agent: userAgent
    });

    return sendSuccess(res, { id: subId }, 'Push subscription registered successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicKey,
  subscribe
};
