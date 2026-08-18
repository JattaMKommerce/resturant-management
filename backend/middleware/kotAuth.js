const { verifyToken } = require('../utils/token');
const { sendError } = require('../utils/response');
const pool = require('../config/database');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return sendError(res, 'Access denied. No token provided.', 401);
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;

    // Resolve restaurant_id if not present in token
    if (req.user && req.user.id && !req.user.restaurant_id) {
      const [admins] = await pool.query(
        'SELECT restaurant_id FROM restaurant_admins WHERE user_id = ? ORDER BY is_primary DESC LIMIT 1',
        [req.user.id]
      );
      if (admins.length > 0) {
        req.user.restaurant_id = admins[0].restaurant_id;
      }
    }

    next();
  } catch (err) {
    return sendError(res, 'Invalid or expired token.', 403);
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Permission denied. Not authenticated.', 401);
    }
    const userRole = req.user.role || (req.user.role_id === 1 ? 'ADMIN' : 'USER');
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'RESTAURANT_ADMIN') {
      return next();
    }
    if (!allowedRoles.includes(userRole)) {
      return sendError(res, 'Permission denied. Insufficient role access.', 403);
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRoles
};
