const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');
const { query } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

/**
 * Uniform Authentication Middleware for KOT and Table/Operations routes
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token && req.cookies) {
    token = req.cookies.token || req.cookies.hotel_token || req.cookies.jwt;
  }

  if (!token) {
    return sendError(res, 'Access denied. No authentication token provided.', 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Standardize role aliases
    if (req.user.role === 'ADMIN') req.user.role = 'RESTAURANT_ADMIN';
    if (req.user.role === 'CHEF') req.user.role = 'KITCHEN';

    // Resolve restaurant_id if not present in token
    if (req.user && req.user.id && !req.user.restaurant_id) {
      try {
        const rows = await query(
          'SELECT restaurant_id FROM restaurant_admins WHERE user_id = ? ORDER BY is_primary DESC LIMIT 1',
          [req.user.id]
        );
        if (rows.length > 0) {
          req.user.restaurant_id = rows[0].restaurant_id;
        } else {
          req.user.restaurant_id = 1;
        }
      } catch (dbErr) {
        req.user.restaurant_id = 1;
      }
    }

    next();
  } catch (err) {
    return sendError(res, 'Invalid or expired token.', 401);
  }
}

/**
 * Role authorization middleware supporting RESTAURANT_ADMIN, KITCHEN, WAITER, MANAGER, SUPER_ADMIN
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Permission denied. Not authenticated.', 401);
    }
    const userRole = req.user.role === 'ADMIN' ? 'RESTAURANT_ADMIN' : (req.user.role || 'CUSTOMER');
    
    // Super Admin and Restaurant Admin have full administrative permissions across tables, KOTs, and operations
    if (userRole === 'SUPER_ADMIN' || userRole === 'RESTAURANT_ADMIN' || userRole === 'ADMIN') {
      return next();
    }

    const mappedAllowed = allowedRoles.map(r => {
      if (r === 'ADMIN') return 'RESTAURANT_ADMIN';
      if (r === 'CHEF') return 'KITCHEN';
      return r;
    });

    if (mappedAllowed.includes(userRole) || allowedRoles.includes(userRole)) {
      return next();
    }

    return sendError(res, `Permission denied. Insufficient role access.`, 403);
  };
}

module.exports = {
  authenticateToken,
  requireRoles
};
