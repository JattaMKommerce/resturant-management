const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../../utils/token');
const { sendSuccess, sendError } = require('../../utils/response');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    const [rows] = await pool.query(
      `SELECT u.*, u.role as role_name 
       FROM users u 
       WHERE u.email = ? AND (u.status IS NULL OR u.status = 'ACTIVE')`,
      [email]
    );

    if (rows.length === 0) {
      return sendError(res, 'Invalid credentials or inactive user account', 401);
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return sendError(res, 'Invalid credentials', 401);
    }

    // Fetch primary restaurant
    const [restRows] = await pool.query(
      `SELECT r.* FROM restaurants r 
       LEFT JOIN restaurant_admins ra ON ra.restaurant_id = r.id 
       WHERE ra.user_id = ? OR r.id = 1 
       ORDER BY (ra.user_id = ?) DESC LIMIT 1`,
      [user.id, user.id]
    );
    const restaurant = restRows[0] || null;

    const token = generateToken({
      ...user,
      restaurant_id: restaurant ? restaurant.id : 1
    });

    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || user.role_name,
        phone: user.phone
      },
      restaurant
    }, 'Login successful');
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

    return sendSuccess(res, rows[0], 'User profile fetched');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getMe
};
