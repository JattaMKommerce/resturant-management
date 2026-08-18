/**
 * Guest Identity Middleware
 * Creates and validates HttpOnly cookie-based guest identities for customers.
 * Customers do NOT need to log in. Identity is established via secure cookies.
 */
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');

const COOKIE_NAME = 'guest_identity';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Hash a token for secure storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Middleware: Initialize or validate guest identity from HttpOnly cookie
 * Sets req.guestIdentity = { id, tokenHash } if valid
 */
async function resolveGuestIdentity(req, res, next) {
  try {
    // If Authorization header is provided, decode JWT for req.user
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';
        req.user = jwt.verify(token, JWT_SECRET);
      } catch (e) { }
    }

    const existingToken = req.cookies?.[COOKIE_NAME];

    if (existingToken) {
      const tokenHash = hashToken(existingToken);
      const rows = await query('SELECT id, customer_name, customer_phone FROM customer_identities WHERE token_hash = ?', [tokenHash]);

      if (rows.length > 0) {
        req.guestIdentity = {
          id: rows[0].id,
          tokenHash,
          customerName: rows[0].customer_name,
          customerPhone: rows[0].customer_phone
        };
        return next();
      }
    }

    // No valid cookie found - create new guest identity
    const newToken = uuidv4() + '-' + crypto.randomBytes(16).toString('hex');
    const tokenHash = hashToken(newToken);

    const result = await query(
      'INSERT INTO customer_identities (token_hash) VALUES (?)',
      [tokenHash]
    );

    // Set HttpOnly cookie
    res.cookie(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/'
    });

    req.guestIdentity = {
      id: result.insertId,
      tokenHash,
      customerName: null,
      customerPhone: null
    };

    next();
  } catch (err) {
    console.error('Guest Identity Error:', err.message);
    // Don't block the request - proceed without guest identity
    req.guestIdentity = null;
    next();
  }
}

/**
 * Initialize guest identity endpoint handler
 * Called by frontend on first load to establish the cookie
 */
async function initGuestIdentity(req, res) {
  try {
    const existingToken = req.cookies?.[COOKIE_NAME];

    if (existingToken) {
      const tokenHash = hashToken(existingToken);
      const rows = await query(
        'SELECT id, customer_name, customer_phone, created_at FROM customer_identities WHERE token_hash = ?',
        [tokenHash]
      );

      if (rows.length > 0) {
        return res.json({
          success: true,
          isReturning: true,
          guest: {
            id: rows[0].id,
            customerName: rows[0].customer_name,
            customerPhone: rows[0].customer_phone
          }
        });
      }
    }

    // Create new identity
    const newToken = uuidv4() + '-' + crypto.randomBytes(16).toString('hex');
    const tokenHash = hashToken(newToken);

    const result = await query(
      'INSERT INTO customer_identities (token_hash) VALUES (?)',
      [tokenHash]
    );

    res.cookie(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/'
    });

    res.json({
      success: true,
      isReturning: false,
      guest: {
        id: result.insertId,
        customerName: null,
        customerPhone: null
      }
    });
  } catch (err) {
    console.error('initGuestIdentity Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to initialize guest identity.' });
  }
}

/**
 * Get active order for a guest at a restaurant
 */
async function getGuestActiveOrder(req, res) {
  try {
    if (!req.guestIdentity?.id) {
      return res.json({ success: true, activeOrder: null });
    }

    const { slug } = req.params;

    const orders = await query(
      `SELECT o.id, o.order_number, o.order_status, o.total_amount, o.created_at,
              r.name as restaurant_name, r.slug as restaurant_slug
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.customer_identity_id = ? AND r.slug = ?
         AND o.order_status NOT IN ('DELIVERED', 'CANCELLED', 'REJECTED')
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [req.guestIdentity.id, slug]
    );

    if (orders.length === 0) {
      return res.json({ success: true, activeOrder: null });
    }

    res.json({ success: true, activeOrder: orders[0] });
  } catch (err) {
    console.error('getGuestActiveOrder Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

/**
 * Get all orders for a guest identity
 */
async function getGuestOrders(req, res) {
  try {
    if (!req.guestIdentity?.id) {
      return res.json({ success: true, orders: [] });
    }

    const orders = await query(
      `SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug, r.logo_url as restaurant_logo
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.customer_identity_id = ?
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [req.guestIdentity.id]
    );

    for (let order of orders) {
      order.items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    }

    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('getGuestOrders Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

/**
 * Update guest identity info (name, phone) when they checkout
 */
async function updateGuestInfo(guestIdentityId, customerName, customerPhone) {
  try {
    await query(
      'UPDATE customer_identities SET customer_name = ?, customer_phone = ? WHERE id = ?',
      [customerName, customerPhone, guestIdentityId]
    );
  } catch (err) {
    console.error('updateGuestInfo Error:', err.message);
  }
}

module.exports = {
  resolveGuestIdentity,
  initGuestIdentity,
  getGuestActiveOrder,
  getGuestOrders,
  updateGuestInfo,
  hashToken,
  COOKIE_NAME
};
