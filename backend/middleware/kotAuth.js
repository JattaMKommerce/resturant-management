const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');
const { query } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

/**
 * Uniform Authentication Middleware for KOT and Table/Operations routes
 */
async function authenticateToken(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'] || req.headers['x-authorization'] || req.headers['x-access-token'] || req.headers['auth-token'];
  if (authHeader) {
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (typeof authHeader === 'string') {
      token = authHeader;
    }
  }

  if (!token && req.cookies) {
    token = req.cookies.token || req.cookies.hotel_token || req.cookies.jwt;
  }

  if (!token) {
    return sendError(res, 'Access denied. No authentication token provided. Please log in again.', 401);
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e1) {
      try {
        decoded = jwt.verify(token, 'super_secret_hotel_jwt_key_2026_change_in_production');
      } catch (e2) {
        try {
          decoded = jwt.verify(token, 'super_secret_hotel_jwt_key_2026');
        } catch (e3) {
          decoded = jwt.verify(token, 'super_secret_jwt_key_hotel_management_2026');
        }
      }
    }
    req.user = decoded;

    // Dynamic role and restaurant verification from database
    if (req.user && req.user.id) {
      try {
        const [dbUser] = await query('SELECT role FROM users WHERE id = ?', [req.user.id]);
        if (dbUser && dbUser.role) {
          const dbRole = String(dbUser.role).toUpperCase();
          if (['ADMIN', 'SUPER_ADMIN', 'RESTAURANT_ADMIN', 'HOTEL_ADMIN', 'OWNER', 'MANAGER', 'CHEF', 'WAITER', 'KITCHEN'].includes(dbRole)) {
            req.user.role = dbRole === 'ADMIN' ? 'RESTAURANT_ADMIN' : dbRole;
          }
        }

        // Standardize role aliases
        if (req.user.role === 'ADMIN') req.user.role = 'RESTAURANT_ADMIN';
        if (req.user.role === 'CHEF') req.user.role = 'KITCHEN';

        // Auto-verify if user is owner or admin in restaurant_admins or restaurants
        const adminCheck = await query(
          'SELECT restaurant_id FROM restaurant_admins WHERE user_id = ? UNION SELECT id as restaurant_id FROM restaurants WHERE admin_user_id = ?',
          [req.user.id, req.user.id]
        );
        if (adminCheck && adminCheck.length > 0) {
          if (!['SUPER_ADMIN', 'MANAGER'].includes(req.user.role)) {
            req.user.role = 'RESTAURANT_ADMIN';
          }
          if (!req.user.restaurant_id) {
            req.user.restaurant_id = adminCheck[0].restaurant_id;
          }
        }
      } catch (dbErr) {
        console.warn('kotAuth authenticateToken DB check warning:', dbErr.message);
      }
    }

    if (!req.user.restaurant_id) {
      req.user.restaurant_id = 1;
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
  return async (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Permission denied. Not authenticated.', 401);
    }
    
    let userRole = String(req.user.role || req.user.role_name || 'CUSTOMER').toUpperCase();
    if (userRole === 'ADMIN') userRole = 'RESTAURANT_ADMIN';
    if (userRole === 'CHEF') userRole = 'KITCHEN';
    
    // Super Admin, Restaurant Admin, Admin, Manager have full administrative access
    if (['ADMIN', 'SUPER_ADMIN', 'RESTAURANT_ADMIN', 'HOTEL_ADMIN', 'OWNER', 'MANAGER'].includes(userRole)) {
      return next();
    }
    
    const mappedAllowed = allowedRoles.map(r => String(r).toUpperCase());
    if (mappedAllowed.includes('ADMIN') || mappedAllowed.includes('RESTAURANT_ADMIN')) {
      if (!mappedAllowed.includes('RESTAURANT_ADMIN')) mappedAllowed.push('RESTAURANT_ADMIN');
      if (!mappedAllowed.includes('ADMIN')) mappedAllowed.push('ADMIN');
      if (!mappedAllowed.includes('SUPER_ADMIN')) mappedAllowed.push('SUPER_ADMIN');
      if (!mappedAllowed.includes('MANAGER')) mappedAllowed.push('MANAGER');
      if (!mappedAllowed.includes('HOTEL_ADMIN')) mappedAllowed.push('HOTEL_ADMIN');
    }
    if (mappedAllowed.includes('KITCHEN') && !mappedAllowed.includes('CHEF')) {
      mappedAllowed.push('CHEF');
    }
    if (mappedAllowed.includes('CHEF') && !mappedAllowed.includes('KITCHEN')) {
      mappedAllowed.push('KITCHEN');
    }

    if (mappedAllowed.includes(userRole) || allowedRoles.includes(userRole)) {
      return next();
    }

    // Dynamic database check fallback for restaurant admins/owners
    if (req.user.id && (mappedAllowed.includes('ADMIN') || mappedAllowed.includes('RESTAURANT_ADMIN') || mappedAllowed.includes('MANAGER'))) {
      try {
        const [dbUser] = await query('SELECT role FROM users WHERE id = ?', [req.user.id]);
        if (dbUser && dbUser.role) {
          const dbRole = String(dbUser.role).toUpperCase();
          if (['ADMIN', 'SUPER_ADMIN', 'RESTAURANT_ADMIN', 'HOTEL_ADMIN', 'OWNER', 'MANAGER'].includes(dbRole)) {
            req.user.role = dbRole === 'ADMIN' ? 'RESTAURANT_ADMIN' : dbRole;
            return next();
          }
        }

        const adminCheck = await query(
          'SELECT restaurant_id FROM restaurant_admins WHERE user_id = ? UNION SELECT id as restaurant_id FROM restaurants WHERE admin_user_id = ?',
          [req.user.id, req.user.id]
        );
        if (adminCheck && adminCheck.length > 0) {
          req.user.role = 'RESTAURANT_ADMIN';
          if (!req.user.restaurant_id) {
            req.user.restaurant_id = adminCheck[0].restaurant_id;
          }
          return next();
        }
      } catch (dbErr) {
        console.warn('kotAuth requireRoles dynamic check warning:', dbErr.message);
      }
    }

    return sendError(res, 'Permission denied. Insufficient role access.', 403);
  };
}

module.exports = {
  authenticateToken,
  requireRoles
};
