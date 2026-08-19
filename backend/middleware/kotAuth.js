const { verifyToken } = require('../utils/token');
const { sendError } = require('../utils/response');
const pool = require('../config/database');

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
    const decoded = verifyToken(token);
    req.user = decoded;

    // Fetch live user role and info from database if available
    if (req.user && req.user.id) {
      try {
        const [users] = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = ?', [req.user.id]);
        if (users.length > 0) {
          req.user.role = users[0].role || req.user.role;
          req.user.name = users[0].name || req.user.name;
          req.user.status = users[0].status || 'ACTIVE';
        }

        // Resolve restaurant_id if not present
        if (!req.user.restaurant_id) {
          const [admins] = await pool.query(
            'SELECT restaurant_id FROM restaurant_admins WHERE user_id = ? ORDER BY is_primary DESC LIMIT 1',
            [req.user.id]
          );
          if (admins.length > 0) {
            req.user.restaurant_id = admins[0].restaurant_id;
          } else {
            req.user.restaurant_id = 1;
          }
        }
      } catch (dbErr) {
        console.warn('kotAuth: DB enrichment fallback:', dbErr.message);
      }
    }

    next();
  } catch (err) {
    return sendError(res, 'Invalid or expired token.', 401);
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Permission denied. Not authenticated.', 401);
    }
    
    const userRole = String(req.user.role || req.user.role_name || (req.user.role_id === 1 ? 'ADMIN' : 'USER')).toUpperCase();
    
    // Super Admin, Restaurant Admin, Admin, Manager have full access across all operations
    if (['ADMIN', 'SUPER_ADMIN', 'RESTAURANT_ADMIN', 'HOTEL_ADMIN', 'OWNER', 'MANAGER'].includes(userRole)) {
      return next();
    }
    
    const mappedAllowed = allowedRoles.map(r => String(r).toUpperCase());
    if (mappedAllowed.includes('ADMIN')) {
      mappedAllowed.push('RESTAURANT_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'HOTEL_ADMIN');
    }
    if (mappedAllowed.includes('KITCHEN')) {
      mappedAllowed.push('CHEF');
    }
    if (mappedAllowed.includes('CHEF')) {
      mappedAllowed.push('KITCHEN');
    }

    if (mappedAllowed.includes(userRole)) {
      return next();
    }

    return sendError(res, 'Permission denied. Insufficient role access.', 403);
  };
}

module.exports = {
  authenticateToken,
  requireRoles
};
