/**
 * subscriptionAuth.js
 * Enforces active SaaS subscription on protected hotel operational APIs.
 * Ensures Super Admin is never blocked and pending approval / expired hotels are strictly blocked.
 */

const subscriptionService = require('../services/SubscriptionService');

async function enforceSubscriptionAccess(req, res, next) {
  try {
    // 1. Super Admin is always unrestricted across all platform routes
    if (req.isSuperAdmin || (req.user && req.user.role === 'SUPER_ADMIN')) {
      return next();
    }

    // 2. Resolve target restaurant ID from context
    let restaurantId = req.adminRestaurantId || (req.user && req.user.restaurant_id);

    // If param :id or :restaurantId exists and user is restaurant admin/staff, check if that matches
    if (!restaurantId && req.params) {
      if (req.params.restaurantId && !isNaN(req.params.restaurantId)) {
        restaurantId = parseInt(req.params.restaurantId, 10);
      } else if (req.params.id && !isNaN(req.params.id)) {
        restaurantId = parseInt(req.params.id, 10);
      }
    }

    // If cannot resolve restaurant ID, proceed to standard controller to handle missing entity
    if (!restaurantId) {
      return next();
    }

    // 3. Evaluate authoritative subscription state
    const subInfo = await subscriptionService.getHotelActiveSubscription(restaurantId);

    // Option A: Hotel has no subscription assigned yet
    if (!subInfo.has_subscription) {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'No active subscription plan found for this hotel. Please choose and subscribe to a plan to access operational HMS features.',
        subscription: subInfo
      });
    }

    // 4. Strict Super Admin Approval Enforcement (Rule 5 & 7)
    if (subInfo.status === 'PENDING_APPROVAL') {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_PENDING_APPROVAL',
        message: 'Your subscription payment has been received and is currently awaiting Super Admin review and approval. HMS operational access will be granted immediately upon approval.',
        subscription: subInfo
      });
    }

    // 5. Rejected Request
    if (subInfo.status === 'REJECTED') {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_REJECTED',
        message: `Your subscription request was rejected by Super Admin. Reason: ${subInfo.rejection_reason || 'Administrative review'}. Please submit a new request.`,
        subscription: subInfo
      });
    }

    // 6. Strict Zero-Grace Expiry Check (Rule 8)
    if (subInfo.status === 'EXPIRED') {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Your hotel subscription has expired. Please renew your plan to restore full operations.',
        subscription: subInfo
      });
    }

    // 7. Suspended / Other Inactive States
    if (subInfo.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        code: `SUBSCRIPTION_${subInfo.status}`,
        message: `Your hotel subscription is currently ${subInfo.status}. Access to operational HMS features is blocked.`,
        subscription: subInfo
      });
    }

    // Attach active subscription details to request context
    req.subscription = subInfo;
    next();
  } catch (err) {
    console.error('Subscription Access Middleware Error:', err);
    next(err);
  }
}

module.exports = {
  enforceSubscriptionAccess
};
