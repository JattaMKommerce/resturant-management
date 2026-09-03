const express = require('express');
const router = express.Router();
const walletService = require('../services/walletService');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { query } = require('../config/db');

// Optional customer authenticator for checkout / public customer screens
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token && req.query && req.query.token) token = req.query.token;
  if (!token) return next();

  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';
    req.user = jwt.decode(token);
  } catch (e) {}
  next();
}

/**
 * ====================================================================
 * CUSTOMER FACING KRATU REWARDS ROUTES (Slide 14)
 * ====================================================================
 */

/**
 * GET /api/v1/wallet/customer/statement
 * Retrieve current customer's available rewards, pending cashback, and expiring lots
 */
router.get('/customer/statement', optionalAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.query.restaurantId || 1;
    const customerId = req.user?.id || req.query.customerId || 2; // Default to demo customer if guest

    const statement = await walletService.getStatement(tenantId, customerId);
    return res.json({ success: true, data: statement });
  } catch (err) {
    console.error('GET /wallet/customer/statement error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/wallet/checkout/quote
 * Returns cashback to earn on cart + max eligible reward redemption for cart
 */
router.post('/checkout/quote', optionalAuth, async (req, res) => {
  try {
    const { tenantId, orderAmount, customerId } = req.body;
    const activeCustomerId = req.user?.id || customerId || 2;

    const cashbackCalculation = await walletService.calculateCashback(tenantId || 1, orderAmount, activeCustomerId);
    const statement = await walletService.getStatement(tenantId || 1, activeCustomerId);

    // Max redemption cap (e.g. max 50% of bill or total available rewards, whichever is less)
    const maxRedemptionPercentage = cashbackCalculation.maxRedemptionPercentage || 50;
    const maxAllowedByCart = (parseFloat(orderAmount || 0) * maxRedemptionPercentage) / 100;
    const maxRedeemable = Math.min(statement.availableBalance, maxAllowedByCart);

    return res.json({
      success: true,
      data: {
        cashbackToEarn: cashbackCalculation.cashbackAmount,
        cashbackEligible: cashbackCalculation.eligible,
        campaignName: cashbackCalculation.campaignName,
        availableRewards: statement.availableBalance,
        pendingRewards: statement.pendingBalance,
        maxRedeemable: Math.floor(maxRedeemable * 100) / 100,
        maxRedemptionPercentage
      }
    });
  } catch (err) {
    console.error('POST /wallet/checkout/quote error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/wallet/checkout/reserve
 * Locks rewards for 10 minutes during payment gateway checkout (Slide 06)
 */
router.post('/checkout/reserve', optionalAuth, async (req, res) => {
  try {
    const { tenantId, checkoutId, requestedAmount, customerId } = req.body;
    const activeCustomerId = req.user?.id || customerId || 2;

    const result = await walletService.reserveCredits(
      tenantId || 1,
      activeCustomerId,
      checkoutId,
      requestedAmount
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('POST /wallet/checkout/reserve error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/wallet/checkout/release
 * Releases 10-minute lock back to customer if payment fails or user cancels
 */
router.post('/checkout/release', async (req, res) => {
  try {
    const { tenantId, checkoutId, reason } = req.body;
    const result = await walletService.releaseReservation(
      tenantId || 1,
      checkoutId,
      reason || 'User cancelled checkout'
    );
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('POST /wallet/checkout/release error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * ====================================================================
 * OWNER & ADMIN REWARDS MANAGEMENT ROUTES (Slide 11, 12, 14, 15)
 * ====================================================================
 */

/**
 * GET /api/v1/wallet/admin/liability
 * Outstanding liability, unredeemed rewards, campaign budget burn
 */
router.get('/admin/liability', authenticateToken, authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.query.restaurantId || req.user?.restaurant_id || 1;
    const summary = await walletService.getOwnerLiabilitySummary(tenantId);
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error('GET /wallet/admin/liability error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/wallet/admin/campaigns
 * Get campaign configuration
 */
router.get('/admin/campaigns', authenticateToken, authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.query.restaurantId || req.user?.restaurant_id || 1;
    const [campaigns] = await query(
      `SELECT * FROM wallet_campaign_rules WHERE tenant_id = ? ORDER BY id DESC`,
      [tenantId]
    );
    return res.json({ success: true, data: campaigns });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/wallet/admin/campaigns
 * Update campaign economics & caps (Slide 11: Owner approval required)
 */
router.post('/admin/campaigns', authenticateToken, authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.body.restaurantId || req.user?.restaurant_id || 1;
    const {
      campaignName,
      rewardType,
      rewardValue,
      maxCashbackPerOrder,
      minOrderAmount,
      maxRedemptionPercentage,
      expiryDays,
      campaignBudget,
      isActive
    } = req.body;

    // Check if exists
    const [existing] = await query(`SELECT id FROM wallet_campaign_rules WHERE tenant_id = ? LIMIT 1`, [tenantId]);

    if (existing) {
      await query(
        `UPDATE wallet_campaign_rules 
         SET campaign_name = ?, reward_type = ?, reward_value = ?, max_cashback_per_order = ?,
             min_order_amount = ?, max_redemption_percentage = ?, expiry_days = ?, campaign_budget = ?, is_active = ?
         WHERE id = ?`,
        [
          campaignName,
          rewardType,
          rewardValue,
          maxCashbackPerOrder,
          minOrderAmount,
          maxRedemptionPercentage,
          expiryDays,
          campaignBudget,
          isActive ? 1 : 0,
          existing.id
        ]
      );
    } else {
      await query(
        `INSERT INTO wallet_campaign_rules 
          (tenant_id, campaign_name, reward_type, reward_value, max_cashback_per_order, min_order_amount, max_redemption_percentage, expiry_days, campaign_budget, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          campaignName,
          rewardType,
          rewardValue,
          maxCashbackPerOrder,
          minOrderAmount,
          maxRedemptionPercentage,
          expiryDays,
          campaignBudget,
          isActive ? 1 : 0
        ]
      );
    }

    return res.json({ success: true, message: 'Kratu Rewards campaign rules updated successfully!' });
  } catch (err) {
    console.error('POST /wallet/admin/campaigns error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/wallet/admin/ledger
 * Immutable double-entry audit stream (Slide 08)
 */
router.get('/admin/ledger', authenticateToken, authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.query.restaurantId || req.user?.restaurant_id || 1;
    const category = req.query.category;
    const eventType = req.query.eventType;

    let sql = `
      SELECT l.*, a.customer_id, a.customer_phone
      FROM ledger_transactions l
      JOIN wallet_accounts a ON l.wallet_account_id = a.id
      WHERE l.tenant_id = ?
    `;
    const params = [tenantId];

    if (category) {
      sql += ` AND l.account_category = ?`;
      params.push(category);
    }
    if (eventType) {
      sql += ` AND l.event_type = ?`;
      params.push(eventType);
    }

    sql += ` ORDER BY l.created_at DESC LIMIT 100`;

    const records = await query(sql, params);
    return res.json({ success: true, data: records });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/wallet/admin/customers/search
 * Search customers by phone, email, or name with live balance preview
 */
router.get('/admin/customers/search', authenticateToken, authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const tenantId = req.query.restaurantId || req.user?.restaurant_id || 1;
    const q = (req.query.q || '').trim();

    if (!q || q.length < 2) {
      // Return recent 15 registered users & customers
      const recents = await query(
        `SELECT DISTINCT 
           u.id as customer_id,
           u.name as customer_name,
           u.phone as customer_phone,
           u.email as customer_email,
           COALESCE(w.cached_available_balance, 0) as available_rewards
         FROM users u
         LEFT JOIN wallet_accounts w ON w.customer_id = u.id AND w.tenant_id = ?
         ORDER BY u.id DESC LIMIT 15`,
        [tenantId]
      );
      return res.json({ success: true, data: recents });
    }

    const likeQuery = `%${q}%`;
    const results = await query(
      `SELECT DISTINCT 
         u.id as customer_id,
         u.name as customer_name,
         u.phone as customer_phone,
         u.email as customer_email,
         COALESCE(w.cached_available_balance, 0) as available_rewards
       FROM users u
       LEFT JOIN wallet_accounts w ON w.customer_id = u.id AND w.tenant_id = ?
       WHERE (u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)
       ORDER BY u.id DESC LIMIT 20`,
      [tenantId, likeQuery, likeQuery, likeQuery]
    );

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('Customer search error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/wallet/admin/adjust
 * Staff manual credit adjustment with admin verification (Slide 12)
 * Supports customerId OR customerPhone!
 */
router.post('/admin/adjust', authenticateToken, authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.body.restaurantId || req.user?.restaurant_id || 1;
    const { customerId, customerPhone, amount, reason } = req.body;
    const identifier = customerPhone || customerId;

    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Please provide a customer name, phone number, or ID.' });
    }

    const result = await walletService.requestAdjustment(
      tenantId,
      identifier,
      amount,
      reason || 'Staff customer service adjustment',
      req.user
    );

    return res.json({ success: true, data: result, message: `Granted courtesy adjustment of ₹${amount}` });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/wallet/admin/audit-invariants
 * Run financial integrity check: Alert when ledger sum != materialized balance (Slide 15)
 */
router.get('/admin/audit-invariants', authenticateToken, authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.query.restaurantId || req.user?.restaurant_id || 1;
    const audit = await walletService.verifyLedgerInvariants(tenantId);
    return res.json({ success: true, data: audit });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
