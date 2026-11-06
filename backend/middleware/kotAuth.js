const { sendError } = require('../utils/response');
const { query } = require('../config/db');
const { extractToken, verifyToken, checkSession, STAFF_ROLES, passwordChangeBlocks } = require('../utils/authSession');

/**
 * Uniform Authentication Middleware for KOT and Table/Operations routes
 */
async function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return sendError(res, 'Access denied. No authentication token provided. Please log in again.', 401);
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    return sendError(res, 'Invalid or expired token.', 401);
  }

  const rejection = await checkSession(decoded, token);
  if (rejection) {
    return sendError(res, rejection, 401);
  }
  if (passwordChangeBlocks(decoded, req)) {
    return res.status(403).json({ success: false, code: 'PASSWORD_CHANGE_REQUIRED', message: 'Please set a new password before continuing.' });
  }

  try {
    req.user = decoded;
    req.authToken = token;

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

        // Auto-verify if user is owner or admin in restaurant_admins or restaurants.
        // Staff are linked through restaurant_admins too: for them the link only tells us which
        // restaurant they work at — it must not turn a waiter or chef into an admin.
        const adminCheck = await query(
          'SELECT restaurant_id FROM restaurant_admins WHERE user_id = ? UNION SELECT id as restaurant_id FROM restaurants WHERE admin_user_id = ?',
          [req.user.id, req.user.id]
        );
        if (adminCheck && adminCheck.length > 0) {
          const currentRole = String(req.user.role || '').toUpperCase();
          if (!['SUPER_ADMIN', 'MANAGER'].includes(currentRole) && !STAFF_ROLES.includes(currentRole)) {
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

        const isStaff = dbUser && STAFF_ROLES.includes(String(dbUser.role || '').toUpperCase());
        const adminCheck = isStaff ? [] : await query(
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
