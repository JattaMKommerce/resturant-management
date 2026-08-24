/**
 * superAdminSubscriptionController.js
 * Endpoints for Super Admins: Plan CRUD, global hotel subscriptions overview,
 * pending approvals queue, approval/rejection execution, manual assignment/extension.
 */

const pool = require('../config/database');
const subscriptionService = require('../services/SubscriptionService');
const subscriptionPaymentService = require('../services/SubscriptionPaymentService');
const subscriptionApprovalService = require('../services/SubscriptionApprovalService');
const { sendSuccess, sendError } = require('../utils/response');

// 1. Subscription Plans Management
async function getAllPlans(req, res, next) {
  try {
    const [plans] = await pool.query('SELECT * FROM subscription_plans ORDER BY display_order ASC, price ASC');
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
    return sendSuccess(res, formatted, 'All subscription plans retrieved.');
  } catch (err) {
    next(err);
  }
}

async function createPlan(req, res, next) {
  try {
    const { name, slug, description, price, duration_days, max_orders_per_month, max_menu_items, max_staff_accounts, features, display_order } = req.body;

    if (!name) return sendError(res, 'Plan name is required.', 400);
    const planSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '');

    const [existing] = await pool.query('SELECT id FROM subscription_plans WHERE slug = ?', [planSlug]);
    if (existing.length > 0) return sendError(res, `Plan slug "${planSlug}" already exists.`, 400);

    const [result] = await pool.query(
      `INSERT INTO subscription_plans 
        (name, slug, description, price, duration_days, max_orders_per_month, max_menu_items, max_staff_accounts, features_json, is_active, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        name,
        planSlug,
        description || '',
        price || 0,
        duration_days || 30,
        max_orders_per_month || null,
        max_menu_items || null,
        max_staff_accounts || null,
        JSON.stringify(features || []),
        display_order || 0
      ]
    );

    return sendSuccess(res, { id: result.insertId, slug: planSlug }, 'Plan created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, price, duration_days, max_orders_per_month, max_menu_items, max_staff_accounts, features, is_active, display_order } = req.body;

    await pool.query(
      `UPDATE subscription_plans 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           price = COALESCE(?, price),
           duration_days = COALESCE(?, duration_days),
           max_orders_per_month = ?,
           max_menu_items = ?,
           max_staff_accounts = ?,
           features_json = COALESCE(?, features_json),
           is_active = COALESCE(?, is_active),
           display_order = COALESCE(?, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        description,
        price !== undefined ? price : null,
        duration_days !== undefined ? duration_days : null,
        max_orders_per_month !== undefined ? max_orders_per_month : null,
        max_menu_items !== undefined ? max_menu_items : null,
        max_staff_accounts !== undefined ? max_staff_accounts : null,
        features ? JSON.stringify(features) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        display_order !== undefined ? display_order : null,
        id
      ]
    );

    return sendSuccess(res, { id }, 'Plan updated successfully.');
  } catch (err) {
    next(err);
  }
}

async function togglePlanStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    await pool.query('UPDATE subscription_plans SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [is_active ? 1 : 0, id]);
    return sendSuccess(res, { id, is_active: Boolean(is_active) }, 'Plan status updated.');
  } catch (err) {
    next(err);
  }
}

// 2. Pending Approvals Queue & Execution
async function getPendingApprovals(req, res, next) {
  try {
    const queue = await subscriptionApprovalService.getPendingApprovalsQueue();
    return sendSuccess(res, queue, 'Pending subscription approvals retrieved.');
  } catch (err) {
    next(err);
  }
}

async function approvePendingSubscription(req, res, next) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await subscriptionApprovalService.approveSubscription({
      subscriptionId: id,
      actorUserId: req.user.id,
      notes
    });

    return sendSuccess(res, result, result.message);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
}

async function rejectPendingSubscription(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await subscriptionApprovalService.rejectSubscription({
      subscriptionId: id,
      actorUserId: req.user.id,
      reason
    });

    return sendSuccess(res, result, result.message);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
}

// 3. Hotel Subscriptions Master Overview & Direct Assignment
async function getAllHotelsSubscriptions(req, res, next) {
  try {
    const hotels = await subscriptionService.getAllHotelsWithSubscriptions();
    return sendSuccess(res, hotels, 'Hotels subscriptions retrieved.');
  } catch (err) {
    next(err);
  }
}

async function assignPlanToHotel(req, res, next) {
  try {
    const { restaurant_id, plan_id, duration_days, notes } = req.body;
    if (!restaurant_id || !plan_id) return sendError(res, 'restaurant_id and plan_id are required.', 400);

    const sub = await subscriptionService.assignPlanToHotel(
      restaurant_id,
      plan_id,
      duration_days,
      req.user.id,
      notes || 'Assigned by Super Admin'
    );

    return sendSuccess(res, sub, 'Plan assigned and activated for hotel successfully.');
  } catch (err) {
    return sendError(res, err.message, 400);
  }
}

async function extendHotelSubscription(req, res, next) {
  try {
    const { restaurant_id, extra_days, notes } = req.body;
    if (!restaurant_id || !extra_days) return sendError(res, 'restaurant_id and extra_days are required.', 400);

    const sub = await subscriptionService.extendSubscription(
      restaurant_id,
      extra_days,
      req.user.id,
      notes || `Extended by Super Admin (+${extra_days} days)`
    );

    return sendSuccess(res, sub, `Subscription extended by ${extra_days} days.`);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
}

async function updateHotelSubscriptionStatus(req, res, next) {
  try {
    const { restaurant_id, status, notes } = req.body;
    if (!restaurant_id || !status) return sendError(res, 'restaurant_id and status are required.', 400);

    const sub = await subscriptionService.updateHotelSubscriptionStatus(
      restaurant_id,
      status,
      req.user.id,
      notes
    );

    return sendSuccess(res, sub, `Subscription status updated to ${status}.`);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
}

// 4. Platform SaaS Payments
async function getAllPayments(req, res, next) {
  try {
    const payments = await subscriptionPaymentService.getAllPlatformSubscriptionPayments();
    return sendSuccess(res, payments, 'Platform subscription payments retrieved.');
  } catch (err) {
    next(err);
  }
}

// 5. Subscription History & Audit Trail
async function getSubscriptionAuditHistory(req, res, next) {
  try {
    const { restaurant_id } = req.query;
    let query = `
      SELECT sh.*, r.name as restaurant_name, sp.name as plan_name, u.name as actor_name
      FROM subscription_history sh
      JOIN restaurants r ON sh.restaurant_id = r.id
      JOIN subscription_plans sp ON sh.plan_id = sp.id
      LEFT JOIN users u ON sh.actor_user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (restaurant_id) {
      query += ' AND sh.restaurant_id = ?';
      params.push(restaurant_id);
    }
    query += ' ORDER BY sh.id DESC LIMIT 100';

    const [rows] = await pool.query(query, params);
    return sendSuccess(res, rows, 'Subscription audit history retrieved.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllPlans,
  createPlan,
  updatePlan,
  togglePlanStatus,
  getPendingApprovals,
  approvePendingSubscription,
  rejectPendingSubscription,
  getAllHotelsSubscriptions,
  assignPlanToHotel,
  extendHotelSubscription,
  updateHotelSubscriptionStatus,
  getAllPayments,
  getSubscriptionAuditHistory
};
