/**
 * subscriptionController.js
 * Endpoints for Hotel Admins: view subscription countdown & status, list available plans, initiate/verify renewal payment.
 */

const pool = require('../config/database');
const subscriptionService = require('../services/SubscriptionService');
const subscriptionPaymentService = require('../services/SubscriptionPaymentService');
const { sendSuccess, sendError } = require('../utils/response');

async function getSubscriptionStatus(req, res, next) {
  try {
    const restaurantId = req.adminRestaurantId || req.user.restaurant_id;
    if (!restaurantId) return sendError(res, 'Restaurant identity could not be resolved.', 400);

    const sub = await subscriptionService.getHotelActiveSubscription(restaurantId);
    return sendSuccess(res, sub, 'Subscription status retrieved.');
  } catch (err) {
    next(err);
  }
}

async function getAvailablePlans(req, res, next) {
  try {
    const [plans] = await pool.query(
      `SELECT * FROM subscription_plans WHERE is_active = 1 AND slug NOT IN ('free-trial', 'trial') ORDER BY display_order ASC, price ASC`
    );

    const formatted = plans.map(p => {
      let features = [];
      try {
        features = typeof p.features_json === 'string' ? JSON.parse(p.features_json) : (p.features_json || []);
      } catch (e) {
        features = [];
      }
      return {
        ...p,
        price: parseFloat(p.price),
        features
      };
    });

    return sendSuccess(res, formatted, 'Available subscription plans retrieved.');
  } catch (err) {
    next(err);
  }
}

async function initiateRenewalPayment(req, res, next) {
  try {
    const restaurantId = req.adminRestaurantId || req.user.restaurant_id;
    const { plan_id, payment_method, offline_proof_note } = req.body;

    if (!restaurantId) return sendError(res, 'Restaurant identity required.', 400);
    if (!plan_id) return sendError(res, 'Plan ID is required.', 400);

    const result = await subscriptionPaymentService.initiateSubscriptionPayment({
      restaurantId,
      planId: plan_id,
      paymentMethod: payment_method || 'RAZORPAY',
      offlineProofNote: offline_proof_note || '',
      actorUserId: req.user.id
    });

    return sendSuccess(res, result, 'Payment initiated successfully.', 201);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
}

async function verifyRenewalPayment(req, res, next) {
  try {
    const { transaction_reference, razorpay_payment_id, razorpay_signature } = req.body;

    if (!transaction_reference) return sendError(res, 'Transaction reference is required.', 400);

    const result = await subscriptionPaymentService.verifyRazorpayPayment({
      transactionReference: transaction_reference,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      actorUserId: req.user.id
    });

    return sendSuccess(res, result, result.message);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
}

async function getInvoices(req, res, next) {
  try {
    const restaurantId = req.adminRestaurantId || req.user.restaurant_id;
    if (!restaurantId) return sendError(res, 'Restaurant identity required.', 400);

    const invoices = await subscriptionPaymentService.getHotelInvoices(restaurantId);
    return sendSuccess(res, invoices, 'Invoices retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSubscriptionStatus,
  getAvailablePlans,
  initiateRenewalPayment,
  verifyRenewalPayment,
  getInvoices
};
