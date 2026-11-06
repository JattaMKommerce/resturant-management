const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../../utils/token');
const { sendSuccess, sendError } = require('../../utils/response');

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return sendError(res, 'Email/Mobile and password are required', 400);
    }

    const inputStr = String(email || '').trim();
    let rows = [];

    if (inputStr.includes('@')) {
      [rows] = await pool.query(
        `SELECT u.*, u.role as role_name 
         FROM users u 
         WHERE LOWER(u.email) = LOWER(?)`,
        [inputStr]
      );
    } else {
      const phoneDigits = inputStr.replace(/\D/g, '');
      const phoneCandidate = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
      const fallbackEmail = phoneCandidate ? `${phoneCandidate}@hotel.com` : inputStr;

      [rows] = await pool.query(
        `SELECT u.*, u.role as role_name 
         FROM users u 
         WHERE (u.phone = ? OR u.phone = ? OR u.phone LIKE ? OR LOWER(u.email) = LOWER(?))
         ORDER BY (u.status IS NULL OR u.status = 'ACTIVE') DESC, id DESC`,
        [inputStr, phoneCandidate, `%${phoneCandidate}`, fallbackEmail]
      );
    }

    if (rows.length === 0) {
      require('../../utils/audit').logAudit(req, { action: 'LOGIN_FAILED', entity: 'auth', userId: null, userRole: null, restaurantId: null, details: { login: inputStr } });
      return sendError(res, 'Invalid credentials or inactive user account', 401);
    }

    const user = rows[0];
    const isMatch = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!isMatch) {
      require('../../utils/audit').logAudit(req, { action: 'LOGIN_FAILED', entity: 'auth', entityId: user.id, userId: user.id, userRole: user.role, restaurantId: null, details: { login: inputStr, reason: 'wrong password' } });
      return sendError(res, 'Invalid email/mobile or password.', 401);
    }

    // Status is only revealed after the password is verified.
    if (user.status && user.status !== 'ACTIVE') {
      const role = String(user.role || '').toUpperCase();
      const msg = ['WAITER', 'KITCHEN', 'CHEF', 'CASHIER', 'INVENTORY_MANAGER', 'MANAGER'].includes(role)
        ? 'Your staff account is inactive. Ask your restaurant admin to activate it in Staff Management.'
        : 'Your account is deactivated. Please contact support.';
      return sendError(res, msg, 403);
    }

    // Fetch primary restaurant and all assigned restaurants
    const [restRows] = await pool.query(
      `SELECT r.* FROM restaurants r 
       LEFT JOIN restaurant_admins ra ON ra.restaurant_id = r.id 
       WHERE ra.user_id = ? OR r.admin_user_id = ? OR r.id = 1 
       ORDER BY (r.admin_user_id = ? OR ra.user_id = ?) DESC LIMIT 5`,
      [user.id, user.id, user.id, user.id]
    );
    const restaurant = restRows[0] || null;

    require('../../utils/audit').logAudit(req, { action: 'LOGIN', entity: 'auth', entityId: user.id, userId: user.id, userRole: user.role || user.role_name, restaurantId: restaurant ? restaurant.id : null });

    const token = generateToken({
      ...user,
      restaurant_id: restaurant ? restaurant.id : 1
    });

    const userObj = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || user.role_name,
      phone: user.phone
    };

    const payload = {
      token,
      user: userObj,
      restaurant,
      restaurants: restRows || []
    };

    // Return both top-level and nested data structure for 100% universal frontend compatibility
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userObj,
      restaurant,
      restaurants: restRows || [],
      data: payload
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.role as role_name 
       FROM users u 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = rows[0];
    const [restRows] = await pool.query(
      `SELECT r.* FROM restaurants r 
       LEFT JOIN restaurant_admins ra ON ra.restaurant_id = r.id 
       WHERE ra.user_id = ? OR r.admin_user_id = ? OR r.id = 1 
       ORDER BY (r.admin_user_id = ? OR ra.user_id = ?) DESC LIMIT 5`,
      [user.id, user.id, user.id, user.id]
    );
    const restaurant = restRows[0] || null;

    const payload = {
      user,
      restaurant,
      restaurants: restRows || []
    };

    return res.status(200).json({
      success: true,
      user,
      restaurant,
      restaurants: restRows || [],
      data: payload
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getMe
};
