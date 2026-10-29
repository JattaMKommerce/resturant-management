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
         WHERE LOWER(u.email) = LOWER(?) AND (u.status IS NULL OR u.status = 'ACTIVE')`,
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
           AND (u.status IS NULL OR u.status = 'ACTIVE')
         ORDER BY id DESC`,
        [inputStr, phoneCandidate, `%${phoneCandidate}`, fallbackEmail]
      );
    }

    if (rows.length === 0) {
      return sendError(res, 'Invalid credentials or inactive user account', 401);
    }

    const user = rows[0];
    let isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch && user.plain_password && user.plain_password === password) {
      isMatch = true;
    }
    if (!isMatch) {
      return sendError(res, 'Invalid email/mobile or password.', 401);
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
