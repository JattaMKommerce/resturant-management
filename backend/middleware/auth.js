const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

/**
 * Middleware to verify JWT token from Authorization Header or HttpOnly Cookie
 * Attaches decoded user payload to req.user
 */
function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check Authorization Bearer Header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Fallback to HttpOnly Cookie if header not present
  if (!token && req.cookies) {
    token = req.cookies.token || req.cookies.hotel_token || req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required.',
      code: 'UNAUTHENTICATED'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token.',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Middleware to restrict route access to specific roles
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHENTICATED'
      });
    }

    // SUPER_ADMIN has global authorization across management & admin routes
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Standardize role aliases (e.g. ADMIN -> RESTAURANT_ADMIN, CHEF -> KITCHEN, DRIVER -> DELIVERY_DRIVER)
    const userRole = req.user.role === 'ADMIN' ? 'RESTAURANT_ADMIN' : req.user.role;
    const mappedAllowed = allowedRoles.map(r => {
      if (r === 'ADMIN') return 'RESTAURANT_ADMIN';
      if (r === 'CHEF') return 'KITCHEN';
      if (r === 'RIDER') return 'DRIVER';
      return r;
    });

    if (!mappedAllowed.includes(userRole) && !mappedAllowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
        code: 'FORBIDDEN_ROLE'
      });
    }

    next();
  };
}

/**
 * Middleware: Resolve which restaurant(s) the authenticated user has access to.
 * Sets req.adminRestaurantIds = [ids] and req.adminRestaurantId = primary id
 * SUPER_ADMIN bypasses all restrictions.
 * Outlets staff (Admin, Manager, Waiter, Kitchen) are strictly scoped to their assigned restaurants.
 */
async function resolveRestaurantAccess(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.', code: 'UNAUTHENTICATED' });
    }

    const userRole = req.user.role;

    // Super Admin can access everything
    if (userRole === 'SUPER_ADMIN') {
      req.adminRestaurantIds = null; // null = all
      req.adminRestaurantId = null;
      req.isSuperAdmin = true;
      return next();
    }

    // Check token-embedded restaurant_id first
    if (req.user.restaurant_id) {
      req.adminRestaurantIds = [parseInt(req.user.restaurant_id, 10)];
      req.adminRestaurantId = parseInt(req.user.restaurant_id, 10);
      req.isSuperAdmin = false;
      return next();
    }

    // Query restaurant_admins assignment table
    const assignments = await query(
      'SELECT restaurant_id, is_primary FROM restaurant_admins WHERE user_id = ?',
      [req.user.id]
    );

    if (assignments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to any active restaurant.',
        code: 'NO_RESTAURANT_ASSIGNMENT'
      });
    }

    req.adminRestaurantIds = assignments.map(a => a.restaurant_id);
    const primary = assignments.find(a => a.is_primary) || assignments[0];
    req.adminRestaurantId = primary.restaurant_id;
    req.isSuperAdmin = false;
    return next();
  } catch (err) {
    console.error('resolveRestaurantAccess Error:', err);
    return res.status(500).json({ success: false, message: 'Server error resolving restaurant access.', code: 'INTERNAL_ERROR' });
  }
}

/**
 * Validate that a specific restaurant ID is within the user's authorized scope.
 */
function validateRestaurantAccess(restaurantId, req) {
  if (req.isSuperAdmin) return true;
  if (!req.adminRestaurantIds) return false;
  return req.adminRestaurantIds.includes(parseInt(restaurantId, 10));
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  resolveRestaurantAccess,
  validateRestaurantAccess
};
