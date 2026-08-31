const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

async function register(req, res) {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email address already registered.' });
    }

    let assignedRole = 'CUSTOMER';
    if (role === 'DRIVER') assignedRole = 'DRIVER';
    else if (role === 'WAITER') assignedRole = 'WAITER';
    else if (role === 'KITCHEN' || role === 'CHEF') assignedRole = 'KITCHEN';

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [name, email, passwordHash, password, phone, assignedRole]
    );

    const userId = result.insertId;

    if (assignedRole === 'DRIVER') {
      await query(
        `INSERT INTO delivery_drivers (user_id, vehicle_type, vehicle_number, is_active, approval_status, availability_status) VALUES (?, 'Motorbike', 'TEMP-0000', 1, 'PENDING', 'AVAILABLE')`,
        [userId]
      );
    } else if (assignedRole === 'WAITER' || assignedRole === 'KITCHEN') {
      const restId = req.body.restaurant_id || 1;
      await query(
        `INSERT IGNORE INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, 0)`,
        [userId, restId]
      );
    }

    const token = jwt.sign(
      { id: userId, email, name, role: assignedRole },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: { id: userId, name, email, phone, role: assignedRole }
    });

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function registerRestaurant(req, res) {
  try {
    const {
      adminName, adminEmail, adminPassword, adminPhone,
      restaurantName, restaurantPhone, restaurantEmail,
      address, latitude, longitude,
      deliveryRadiusKm, minOrderAmount, deliveryFee, taxPercentage
    } = req.body;

    if (!adminName || !adminEmail || !adminPassword || !adminPhone || !restaurantName || !address) {
      return res.status(400).json({
        success: false,
        message: 'Admin Name, Email, Password, Phone, Restaurant Name, and Address are required.'
      });
    }

    const existingUser = await query('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'Admin email address is already registered.' });
    }

    // Create Admin User with RESTAURANT_ADMIN role
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userRes = await query(
      `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status) VALUES (?, ?, ?, ?, ?, 'RESTAURANT_ADMIN', 'ACTIVE')`,
      [adminName, adminEmail, passwordHash, adminPassword, adminPhone]
    );

    const adminUserId = userRes.insertId;

    // Generate unique slug
    let slugBase = restaurantName
      .toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slugBase) slugBase = 'restaurant';

    let uniqueSlug = slugBase;
    const existingSlug = await query('SELECT id FROM restaurants WHERE slug = ?', [uniqueSlug]);
    if (existingSlug.length > 0) {
      uniqueSlug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Create Restaurant with PENDING status and DRAFT website
    const restRes = await query(
      `INSERT INTO restaurants (
        name, slug, admin_user_id, phone, email, address,
        latitude, longitude, opening_time, closing_time,
        delivery_radius_km, min_order_amount, delivery_fee, tax_percentage,
        currency, status, website_status, is_online_ordering_enabled, is_cod_enabled, is_online_payment_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '10:00', '23:00', ?, ?, ?, ?, 'INR', 'PENDING', 'DRAFT', 0, 1, 1)`,
      [
        restaurantName, uniqueSlug, adminUserId,
        restaurantPhone || adminPhone, restaurantEmail || adminEmail, address,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        deliveryRadiusKm ? parseFloat(deliveryRadiusKm) : 10.0,
        minOrderAmount ? parseFloat(minOrderAmount) : 199.0,
        deliveryFee ? parseFloat(deliveryFee) : 49.0,
        taxPercentage ? parseFloat(taxPercentage) : 5.0
      ]
    );

    const restaurantId = restRes.insertId;

    // Create restaurant_admins junction entry
    await query(
      'INSERT INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, 1)',
      [adminUserId, restaurantId]
    );

    // Auto-provision 7-Day Free Trial
    try {
      const subscriptionService = require('../services/SubscriptionService');
      await subscriptionService.provisionHotelTrial(restaurantId);
    } catch (trialErr) {
      console.warn('Trial auto-provisioning warning:', trialErr.message);
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: adminUserId, email: adminEmail, name: adminName, role: 'RESTAURANT_ADMIN' },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const [newRest] = await query('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);

    res.status(201).json({
      success: true,
      message: 'New Admin and Restaurant registered successfully!',
      token,
      user: { id: adminUserId, name: adminName, email: adminEmail, phone: adminPhone, role: 'RESTAURANT_ADMIN' },
      restaurant: newRest
    });

  } catch (err) {
    console.error('registerRestaurant Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];

    if (user.status === 'DISABLED' || user.status === 'INACTIVE') {
      if (user.role === 'ADMIN' || user.role === 'RESTAURANT_ADMIN') {
        return res.status(403).json({ success: false, message: 'Your admin account has been suspended by Super Admin.' });
      }
      if (user.role === 'DRIVER') {
        return res.status(403).json({ success: false, message: 'Your driver account has been locked/disabled by Super Admin.' });
      }
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Driver approval check
    if (user.role === 'DRIVER') {
      const driverRows = await query('SELECT approval_status FROM delivery_drivers WHERE user_id = ?', [user.id]);
      if (driverRows.length > 0) {
        const appStatus = driverRows[0].approval_status;
        if (appStatus === 'PENDING') {
          return res.status(403).json({ success: false, message: 'Your driver application is pending approval.' });
        }
        if (appStatus === 'REJECTED') {
          return res.status(403).json({ success: false, message: 'Your driver application was rejected.' });
        }
      }
    }

    // Fetch assigned restaurant(s) for admin, kitchen, waiter users via restaurant_admins table
    let restaurant = null;
    let restaurants = [];
    if (['ADMIN', 'RESTAURANT_ADMIN', 'MANAGER', 'KITCHEN', 'CHEF', 'WAITER'].includes(user.role)) {
      const restRows = await query(
        `SELECT r.* FROM restaurants r
         LEFT JOIN restaurant_admins ra ON ra.restaurant_id = r.id
         WHERE ra.user_id = ? OR r.id = 1
         ORDER BY (ra.user_id = ?) DESC, ra.is_primary DESC LIMIT 1`,
        [user.id, user.id]
      );
      if (restRows.length > 0) {
        restaurant = restRows[0];
        restaurants = restRows;
      }
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      restaurant_id: restaurant ? restaurant.id : 1
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    // Determine effective role for frontend
    const effectiveRole = (user.role === 'ADMIN') ? 'RESTAURANT_ADMIN' : user.role;

    // If client supplied pre-login suite_mode selection, persist it to user record
    let finalSuiteMode = user.suite_mode || 'RESTAURANT_ACCOMMODATION';
    if (req.body.suite_mode && ['RESTAURANT_ONLY', 'RESTAURANT_ACCOMMODATION'].includes(req.body.suite_mode)) {
      finalSuiteMode = req.body.suite_mode;
      try {
        await query('UPDATE users SET suite_mode = ? WHERE id = ?', [finalSuiteMode, user.id]);
      } catch (e) {
        console.warn('suite_mode update notice:', e.message);
      }
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: effectiveRole,
        suite_mode: finalSuiteMode
      },
      restaurant,
      restaurants
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function updateSuiteMode(req, res) {
  try {
    const { suite_mode } = req.body;
    if (!['RESTAURANT_ONLY', 'RESTAURANT_ACCOMMODATION'].includes(suite_mode)) {
      return res.status(400).json({ success: false, message: 'Invalid suite mode. Must be RESTAURANT_ONLY or RESTAURANT_ACCOMMODATION.' });
    }

    try {
      await query('UPDATE users SET suite_mode = ? WHERE id = ?', [suite_mode, req.user.id]);
    } catch (e) {
      console.warn('suite_mode update notice:', e.message);
    }

    return res.json({
      success: true,
      suite_mode,
      message: `Workspace suite updated to ${suite_mode === 'RESTAURANT_ONLY' ? 'Restaurant Only' : 'Restaurant + Accommodation'}`
    });
  } catch (err) {
    console.error('Update Suite Mode Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function getMe(req, res) {
  try {
    let users = [];
    try {
      users = await query('SELECT id, name, email, phone, role, status, suite_mode, created_at FROM users WHERE id = ?', [req.user.id]);
    } catch (e) {
      users = await query('SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ?', [req.user.id]);
    }
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];
    let restaurant = null;
    let restaurants = [];

    if (user.role === 'ADMIN' || user.role === 'RESTAURANT_ADMIN') {
      const restRows = await query(
        `SELECT r.* FROM restaurants r
         JOIN restaurant_admins ra ON ra.restaurant_id = r.id
         WHERE ra.user_id = ?
         ORDER BY ra.is_primary DESC`,
        [user.id]
      );
      if (restRows.length > 0) {
        restaurant = restRows[0];
        restaurants = restRows;
      }
    }

    const effectiveRole = (user.role === 'ADMIN') ? 'RESTAURANT_ADMIN' : user.role;

    res.json({
      success: true,
      user: { 
        ...user, 
        role: effectiveRole,
        suite_mode: user.suite_mode || 'RESTAURANT_ACCOMMODATION'
      },
      restaurant,
      restaurants
    });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = {
  register,
  registerRestaurant,
  login,
  getMe,
  updateSuiteMode
};
