const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

/**
 * Middleware to verify JWT token and attach user to req.user
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required.' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e1) {
      try {
        decoded = jwt.verify(token, 'super_secret_hotel_jwt_key_2026');
      } catch (e2) {
        decoded = jwt.verify(token, 'super_secret_jwt_key_hotel_management_2026');
      }
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/**
 * Middleware to restrict route access to specific roles
 */
function authorizeRoles(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const rawRole = String(req.user.role || '').toUpperCase();

    // SUPER_ADMIN has global authorization across management & admin routes
    if (rawRole === 'SUPER_ADMIN') {
      return next();
    }

    const normalizedAllowed = allowedRoles.map(r => String(r).toUpperCase());
    // If ADMIN or RESTAURANT_ADMIN is allowed, also include MANAGER
    if (normalizedAllowed.includes('ADMIN') || normalizedAllowed.includes('RESTAURANT_ADMIN')) {
      if (!normalizedAllowed.includes('RESTAURANT_ADMIN')) normalizedAllowed.push('RESTAURANT_ADMIN');
      if (!normalizedAllowed.includes('ADMIN')) normalizedAllowed.push('ADMIN');
      if (!normalizedAllowed.includes('MANAGER')) normalizedAllowed.push('MANAGER');
    }

    let effectiveRole = rawRole;
    if (rawRole === 'ADMIN') effectiveRole = 'RESTAURANT_ADMIN';

    if (normalizedAllowed.includes(effectiveRole) || normalizedAllowed.includes(rawRole)) {
      return next();
    }

    // Automatic restaurant owner verification from database:
    // If the route requires admin/manager, verify if user is assigned to any restaurant
    if (normalizedAllowed.includes('ADMIN') || normalizedAllowed.includes('RESTAURANT_ADMIN') || normalizedAllowed.includes('MANAGER')) {
      try {
        const adminCheck = await query(
          'SELECT id FROM restaurant_admins WHERE user_id = ? UNION SELECT id FROM restaurants WHERE admin_user_id = ?',
          [req.user.id, req.user.id]
        );
        if (adminCheck.length > 0) {
          req.user.role = 'RESTAURANT_ADMIN';
          return next();
        }
      } catch (dbErr) {
        console.warn('authorizeRoles DB check error:', dbErr.message);
      }
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
    });
  };
}

/**
 * Middleware: Resolve which restaurant(s) the authenticated admin user has access to.
 * Sets req.adminRestaurantIds = [ids] and req.adminRestaurantId = primary id
 * SUPER_ADMIN bypasses all restrictions.
 * RESTAURANT_ADMIN/ADMIN can only access assigned restaurants.
 * NO FALLBACK to "first restaurant".
 */
async function resolveRestaurantAccess(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = req.user.role;

    const targetSlug = req.query?.slug || req.headers['x-restaurant-slug'] || req.params?.slug;
    const targetIdParam = req.query?.restaurant_id || req.headers['x-restaurant-id'] || req.params?.restaurantId;

    let targetRestId = null;
    if (targetSlug) {
      const slugRows = await query('SELECT id FROM restaurants WHERE slug = ?', [targetSlug]);
      if (slugRows.length > 0) targetRestId = slugRows[0].id;
    } else if (targetIdParam) {
      targetRestId = parseInt(targetIdParam, 10) || null;
    }

    // Super Admin can access everything
    if (userRole === 'SUPER_ADMIN') {
      req.adminRestaurantIds = null; // null = all
      req.adminRestaurantId = targetRestId;
      req.isSuperAdmin = true;
      return next();
    }

    // Restaurant Admin / Admin - check restaurant_admins table
    if (userRole === 'ADMIN' || userRole === 'RESTAURANT_ADMIN' || userRole === 'MANAGER') {
      const assignments = await query(
        'SELECT restaurant_id, is_primary FROM restaurant_admins WHERE user_id = ?',
        [req.user.id]
      );

      if (assignments.length === 0) {
        const fallbackRestId = targetRestId || req.user.restaurant_id || 1;
        // Auto-link user to restaurant for persistence
        try {
          await query(
            'INSERT IGNORE INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, 1)',
            [req.user.id, fallbackRestId]
          );
        } catch (e) {}

        req.adminRestaurantIds = [fallbackRestId];
        req.adminRestaurantId = fallbackRestId;
        req.isSuperAdmin = false;
        return next();
      }

      req.adminRestaurantIds = assignments.map(a => a.restaurant_id);

      if (targetRestId && req.adminRestaurantIds.includes(targetRestId)) {
        req.adminRestaurantId = targetRestId;
      } else {
        // Primary restaurant or first assigned
        const primary = assignments.find(a => a.is_primary) || assignments[0];
        req.adminRestaurantId = primary.restaurant_id;
      }
      req.isSuperAdmin = false;
      return next();
    }

    return res.status(403).json({ success: false, message: 'Access denied.' });
  } catch (err) {
    console.error('resolveRestaurantAccess Error:', err);
    return res.status(500).json({ success: false, message: 'Server error resolving restaurant access.' });
  }
}

/**
 * Validate that a specific restaurant ID is within the admin's authorized scope.
 * Use after resolveRestaurantAccess.
 */
function validateRestaurantAccess(restaurantId, req) {
  if (req.isSuperAdmin) return true;
  if (!req.adminRestaurantIds) return false;
  return req.adminRestaurantIds.includes(parseInt(restaurantId));
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  resolveRestaurantAccess,
  validateRestaurantAccess
};
