const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const {
  signToken, tokenExpiryFor, extractToken, revokeToken, revokeAllSessionsForUser,
  clearAuthCookies, hashCode, ensureAuthSchema, STAFF_ROLES
} = require('../utils/authSession');
require('dotenv').config();

const MIN_PASSWORD_LENGTH = 6;

// Local testing conveniences for the customer WhatsApp OTP login (universal code 1234 and
// showing the code on screen). Never enable this on the live server.
const DEMO_OTP_ALLOWED = process.env.ALLOW_DEMO_OTP === 'true';

function expiryToMs(expiresIn) {
  const m = String(expiresIn).match(/^(\d+)\s*([smhd])$/);
  if (!m) return 7 * 24 * 3600 * 1000;
  return Number(m[1]) * { s: 1e3, m: 6e4, h: 3.6e6, d: 8.64e7 }[m[2]];
}

async function register(req, res) {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email address already registered.' });
    }

    let assignedRole = 'CUSTOMER';
    if (role === 'DRIVER') {
      return res.status(400).json({
        success: false,
        message: 'Delivery partners must apply through the rider application form so the restaurant can verify their documents.'
      });
    }
    else if (role === 'WAITER') assignedRole = 'WAITER';
    else if (role === 'KITCHEN' || role === 'CHEF') assignedRole = 'KITCHEN';

    // Staff who sign themselves up start INACTIVE: the restaurant admin activates them from
    // Staff Management. Before, anyone could attach themselves to any restaurant as staff.
    const isStaffSignup = assignedRole === 'WAITER' || assignedRole === 'KITCHEN';
    let staffRestaurantId = null;
    if (isStaffSignup) {
      staffRestaurantId = parseInt(req.body.restaurant_id, 10) || 1;
      const [rest] = await query('SELECT id FROM restaurants WHERE id = ?', [staffRestaurantId]);
      if (!rest) {
        return res.status(400).json({ success: false, message: 'Restaurant not found.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, passwordHash, phone, assignedRole, isStaffSignup ? 'INACTIVE' : 'ACTIVE']
    );

    const userId = result.insertId;

    if (isStaffSignup) {
      await query(
        `INSERT IGNORE INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, 0)`,
        [userId, staffRestaurantId]
      );
      return res.status(201).json({
        success: true,
        pending_activation: true,
        message: 'Account created. Your restaurant admin must activate it in Staff Management before you can log in.',
        user: { id: userId, name, email, phone, role: assignedRole, status: 'INACTIVE' }
      });
    }

    const token = signToken({ id: userId, email, name, role: assignedRole });

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

    if (String(adminPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    // Create Admin User with RESTAURANT_ADMIN role
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userRes = await query(
      `INSERT INTO users (name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, 'RESTAURANT_ADMIN', 'ACTIVE')`,
      [adminName, adminEmail, passwordHash, adminPhone]
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
        name, slug, custom_subdomain_slug, custom_subdomain_enabled, admin_user_id, phone, email, address,
        latitude, longitude, opening_time, closing_time,
        delivery_radius_km, min_order_amount, delivery_fee, tax_percentage,
        currency, status, website_status, is_online_ordering_enabled, is_cod_enabled, is_online_payment_enabled
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, '10:00', '23:00', ?, ?, ?, ?, 'INR', 'PENDING', 'DRAFT', 0, 1, 1)`,
      [
        restaurantName, uniqueSlug, uniqueSlug, adminUserId,
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
    const token = signToken({ id: adminUserId, email: adminEmail, name: adminName, role: 'RESTAURANT_ADMIN' });

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
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const inputStr = (email || '').trim();
    let users = [];

    if (inputStr.includes('@')) {
      // Direct email lookup
      users = await query('SELECT * FROM users WHERE email = ?', [inputStr]);
    } else {
      // Mobile number lookup (supports riders logging in with phone)
      const phoneDigits = inputStr.replace(/\D/g, '');
      const phoneCandidate = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
      const fallbackEmail = phoneCandidate ? `${phoneCandidate}@hotel.com` : inputStr;

      users = await query(
        `SELECT * FROM users 
         WHERE phone = ? 
            OR phone = ?
            OR phone LIKE ?
            OR email = ?
         ORDER BY CASE WHEN role = 'DRIVER' THEN 0 ELSE 1 END, id DESC`,
        [inputStr, phoneCandidate, `%${phoneCandidate}`, fallbackEmail]
      );
    }

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
      if (STAFF_ROLES.includes(String(user.role || '').toUpperCase())) {
        return res.status(403).json({ success: false, message: 'Your staff account is inactive. Ask your restaurant admin to activate it in Staff Management.' });
      }
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }

    const match = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email/mobile or password.' });
    }

    // Driver approval and profile check
    let driverProfile = null;
    if (user.role === 'DRIVER') {
      const driverRows = await query('SELECT * FROM delivery_drivers WHERE user_id = ?', [user.id]);
      if (driverRows.length > 0) {
        driverProfile = driverRows[0];
        const appStatus = driverProfile.approval_status;
        const accStatus = driverProfile.account_status;
        if (appStatus === 'REJECTED') {
          return res.status(403).json({ success: false, message: 'Your driver application was rejected.' });
        }
        if (accStatus === 'SUSPENDED') {
          return res.status(403).json({ success: false, message: 'Your driver account has been suspended by the restaurant admin.' });
        }
        if (appStatus === 'PENDING') {
          await query("UPDATE delivery_drivers SET approval_status = 'APPROVED' WHERE id = ?", [driverProfile.id]);
          driverProfile.approval_status = 'APPROVED';
        }
      }
    }

    // Fetch assigned restaurant(s) and auto-repair owner role if needed
    let restaurant = null;
    let restaurants = [];
    const restRows = await query(
      `SELECT r.* FROM restaurants r
       LEFT JOIN restaurant_admins ra ON ra.restaurant_id = r.id
       WHERE ra.user_id = ? OR r.admin_user_id = ?
       ORDER BY (r.admin_user_id = ?) DESC, ra.is_primary DESC`,
      [user.id, user.id, user.id]
    );
    if (restRows.length > 0) {
      restaurant = restRows[0];
      restaurants = restRows;
      // Owners whose account started as a customer get repaired to RESTAURANT_ADMIN.
      // Staff are linked to their restaurant the same way and must keep their own role.
      if (!['SUPER_ADMIN', 'ADMIN', 'RESTAURANT_ADMIN', 'MANAGER', ...STAFF_ROLES].includes(String(user.role || '').toUpperCase())) {
        await query('UPDATE users SET role = "RESTAURANT_ADMIN" WHERE id = ?', [user.id]);
        user.role = 'RESTAURANT_ADMIN';
      }
      try {
        const featRows = await query('SELECT * FROM restaurant_feature_controls WHERE restaurant_id = ?', [restaurant.id]);
        if (featRows.length > 0) {
          restaurant.features = {
            online_ordering: featRows[0].online_ordering,
            delivery_fleet: featRows[0].delivery_fleet,
            rewards_wallet: featRows[0].rewards_wallet,
            table_dine_in: featRows[0].table_dine_in,
            kds_kot: featRows[0].kds_kot,
            pos_billing: featRows[0].pos_billing,
            inventory_stock: featRows[0].inventory_stock,
            reports_analytics: featRows[0].reports_analytics,
            hotel_accommodations: featRows[0].hotel_accommodations,
            custom_subdomain: featRows[0].custom_subdomain
          };
        }
      } catch (fErr) {}
    }

    // If driver has no restaurant from admin tables, check their assigned restaurant
    if (!restaurant && user.role === 'DRIVER') {
      const drvRestId = driverProfile?.restaurant_id;
      if (drvRestId) {
        const [dRest] = await query('SELECT * FROM restaurants WHERE id = ?', [drvRestId]);
        if (dRest) {
          restaurant = dRest;
          restaurants = [dRest];
        }
      }
    }

    const effectiveRole = (user.role === 'ADMIN') ? 'RESTAURANT_ADMIN' : user.role;

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: effectiveRole,
      driverId: driverProfile ? driverProfile.id : null,
      restaurant_id: restaurant ? restaurant.id : 1
    };

    const token = signToken(tokenPayload);

    const cookieOptions = {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiryToMs(tokenExpiryFor(effectiveRole))
    };
    res.cookie('hotel_token', token, cookieOptions);
    res.cookie('token', token, cookieOptions);

    const userObj = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: effectiveRole
    };

    const payload = {
      token,
      user: userObj,
      restaurant,
      restaurants
    };

    res.json({
      success: true,
      token,
      user: userObj,
      restaurant,
      restaurants,
      data: payload
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function getMe(req, res) {
  try {
    const users = await query('SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];
    let restaurant = null;
    let restaurants = [];

    const restRows = await query(
      `SELECT r.* FROM restaurants r
       LEFT JOIN restaurant_admins ra ON ra.restaurant_id = r.id
       WHERE ra.user_id = ? OR r.admin_user_id = ?
       ORDER BY (r.admin_user_id = ?) DESC, ra.is_primary DESC`,
      [user.id, user.id, user.id]
    );
    if (restRows.length > 0) {
      restaurant = restRows[0];
      restaurants = restRows;
      if (!['SUPER_ADMIN', 'ADMIN', 'RESTAURANT_ADMIN', 'MANAGER'].includes(user.role)) {
        await query('UPDATE users SET role = "RESTAURANT_ADMIN" WHERE id = ?', [user.id]);
        user.role = 'RESTAURANT_ADMIN';
      }
      try {
        const featRows = await query('SELECT * FROM restaurant_feature_controls WHERE restaurant_id = ?', [restaurant.id]);
        if (featRows.length > 0) {
          restaurant.features = {
            online_ordering: featRows[0].online_ordering,
            delivery_fleet: featRows[0].delivery_fleet,
            rewards_wallet: featRows[0].rewards_wallet,
            table_dine_in: featRows[0].table_dine_in,
            kds_kot: featRows[0].kds_kot,
            pos_billing: featRows[0].pos_billing,
            inventory_stock: featRows[0].inventory_stock,
            reports_analytics: featRows[0].reports_analytics,
            hotel_accommodations: featRows[0].hotel_accommodations,
            custom_subdomain: featRows[0].custom_subdomain
          };
        }
      } catch (fErr) {}
    }

    if (!restaurant && user.role === 'DRIVER') {
      const driverRows = await query('SELECT restaurant_id FROM delivery_drivers WHERE user_id = ?', [user.id]);
      let restId = driverRows[0]?.restaurant_id;
      if (!restId) {
        const [dra] = await query(
          'SELECT restaurant_id FROM driver_restaurant_assignments WHERE driver_id = (SELECT id FROM delivery_drivers WHERE user_id = ? LIMIT 1) AND status = "ACTIVE" ORDER BY id DESC LIMIT 1',
          [user.id]
        );
        restId = dra?.restaurant_id;
      }
      if (restId) {
        const [dRest] = await query('SELECT * FROM restaurants WHERE id = ?', [restId]);
        if (dRest) {
          restaurant = dRest;
          restaurants = [dRest];
        }
      }
    }

    const effectiveRole = (user.role === 'ADMIN') ? 'RESTAURANT_ADMIN' : user.role;

    res.json({
      success: true,
      user: { ...user, role: effectiveRole },
      restaurant,
      restaurants
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// In-memory OTP store fallback / fast cache
const customerOtpStore = new Map();
const customerOtpAttempts = new Map();

let isCustomerOtpTableEnsured = false;
async function ensureCustomerOtpsTable() {
  if (isCustomerOtpTableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS customer_otps (
        phone VARCHAR(20) PRIMARY KEY,
        otp VARCHAR(10) NOT NULL,
        expires_at BIGINT NOT NULL,
        name VARCHAR(100) NULL,
        restaurant_id INT NULL,
        verified_at BIGINT NULL,
        last_token TEXT NULL,
        last_user TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    isCustomerOtpTableEnsured = true;
  } catch (err) {
    console.warn('[OTP Table Ensure Warning]:', err.message);
  }
}

/**
 * Send Customer Mobile/WhatsApp OTP
 */
async function customerSendOtp(req, res) {
  try {
    await ensureCustomerOtpsTable();
    const { phone, name, restaurantId } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Please provide a valid mobile number.' });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
    }

    // Check if customer profile already exists
    const [existingCust] = await query(
      'SELECT id, name, phone FROM users WHERE (phone LIKE ? OR phone = ?) AND role = "CUSTOMER" LIMIT 1',
      [`%${cleanPhone}%`, cleanPhone]
    );
    const [anyUser] = !existingCust ? await query(
      'SELECT id, name, phone FROM users WHERE phone LIKE ? OR phone = ? LIMIT 1',
      [`%${cleanPhone}%`, cleanPhone]
    ) : [null];

    const isNewUser = !existingCust;

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30-minute generous window
    const customerName = (existingCust?.name) || (anyUser?.name) || (name?.trim()) || 'Customer';

    // 1. In-memory fast cache
    customerOtpStore.set(cleanPhone, {
      otp,
      expiresAt,
      name: customerName,
      restaurantId: restaurantId || null
    });

    // 2. Persistent MySQL store
    try {
      await query(`
        INSERT INTO customer_otps (phone, otp, expires_at, name, restaurant_id, verified_at, last_token, last_user)
        VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL)
        ON DUPLICATE KEY UPDATE
          otp = VALUES(otp),
          expires_at = VALUES(expires_at),
          name = VALUES(name),
          restaurant_id = VALUES(restaurant_id),
          verified_at = NULL,
          last_token = NULL,
          last_user = NULL
      `, [cleanPhone, otp, expiresAt, customerName, restaurantId || null]);
    } catch (dbErr) {
      console.warn('[customerSendOtp] MySQL OTP persistence warning:', dbErr.message);
    }

    customerOtpAttempts.delete(cleanPhone);
    if (DEMO_OTP_ALLOWED) {
      console.log(`📲 [WhatsApp/OTP] Verification code for ${cleanPhone}: ${otp} (demo code 1234 enabled)`);
    }

    // Fetch restaurant name if available
    let restaurantName = 'Hotel & Restaurant';
    let restaurantWhatsApp = '919876543210';
    if (restaurantId) {
      const [rest] = await query('SELECT name, phone FROM restaurants WHERE id = ? LIMIT 1', [restaurantId]);
      if (rest) {
        restaurantName = rest.name;
        if (rest.phone) restaurantWhatsApp = rest.phone.replace(/[^0-9]/g, '');
      }
    }

    // Dispatch real WhatsApp OTP via Meta Cloud API using approved hms_login_otp template
    let waDelivery = { success: false };
    try {
      const { sendWhatsAppOtp } = require('../services/WhatsAppOtpService');
      const templateName = process.env.WHATSAPP_OTP_TEMPLATE || 'hms_login_otp';
      waDelivery = await sendWhatsAppOtp(cleanPhone, otp, templateName);
    } catch (waErr) {
      console.warn('[customerSendOtp] Meta WhatsApp dispatch error:', waErr.message);
    }

    // Prepare WhatsApp verification link as instant click-to-chat fallback
    const waText = encodeURIComponent(`Hi ${restaurantName}, please verify my login code: ${otp}`);
    const whatsappDeepLink = `https://api.whatsapp.com/send?phone=${restaurantWhatsApp}&text=${waText}`;

    // The code is only ever shown on screen when WhatsApp could not deliver it (so customers
    // can still log in while WhatsApp is not set up). Once WhatsApp delivers, the customer
    // must type the code they received — showing it to whoever asked made every account
    // takeable with just a phone number. Set OTP_REQUIRE_WHATSAPP=true to never show it.
    const requireWhatsApp = process.env.OTP_REQUIRE_WHATSAPP === 'true';
    const exposeCode = !waDelivery.success && (!requireWhatsApp || DEMO_OTP_ALLOWED);
    if (!waDelivery.success && !exposeCode) {
      return res.status(503).json({
        success: false,
        message: 'We could not send the WhatsApp code right now. Please try again in a moment.'
      });
    }

    return res.json({
      success: true,
      phone: cleanPhone,
      isNewUser,
      existingName: existingCust?.name || anyUser?.name || null,
      otpPreview: exposeCode ? otp : undefined,
      whatsappSent: Boolean(waDelivery.success),
      whatsappMessageId: waDelivery.messageId || null,
      whatsappError: waDelivery.success ? null : (waDelivery.error || 'WhatsApp service not configured or token expired'),
      whatsappDeepLink: exposeCode ? whatsappDeepLink : undefined,
      message: waDelivery.success
        ? `WhatsApp verification code sent to +91 ${cleanPhone}!`
        : `Verification code: ${otp}`
    });
  } catch (err) {
    console.error('customerSendOtp error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Verify Customer Mobile/WhatsApp OTP
 */
async function customerVerifyOtp(req, res) {
  try {
    await ensureCustomerOtpsTable();
    const { phone, otp, name, restaurantId } = req.body;
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '').slice(-10);

    const submittedOtp = String(otp || '').trim();

    if (!cleanPhone || !submittedOtp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    }

    // Brute-force guard: 5 wrong codes per phone burns the current code.
    const attempts = customerOtpAttempts.get(cleanPhone) || 0;
    if (attempts >= 5) {
      return res.status(429).json({ success: false, message: 'Too many wrong codes. Please request a new code.' });
    }

    // 1. Try in-memory store
    let stored = customerOtpStore.get(cleanPhone);

    // 2. Fallback to MySQL database
    if (!stored) {
      try {
        const [dbRow] = await query('SELECT * FROM customer_otps WHERE phone = ? LIMIT 1', [cleanPhone]);
        if (dbRow) {
          stored = {
            otp: String(dbRow.otp).trim(),
            expiresAt: Number(dbRow.expires_at),
            name: dbRow.name,
            restaurantId: dbRow.restaurant_id,
            verifiedAt: dbRow.verified_at ? Number(dbRow.verified_at) : null,
            lastToken: dbRow.last_token,
            lastUser: dbRow.last_user ? (typeof dbRow.last_user === 'string' ? JSON.parse(dbRow.last_user) : dbRow.last_user) : null
          };
          customerOtpStore.set(cleanPhone, stored);
        }
      } catch (dbReadErr) {
        console.warn('[customerVerifyOtp] DB lookup warning:', dbReadErr.message);
      }
    }

    // Universal demo code '1234' only when ALLOW_DEMO_OTP=true (local testing)
    const isUniversalMaster = DEMO_OTP_ALLOWED && submittedOtp === '1234';
    const isStoredOtpMatch = Boolean(stored && stored.otp === submittedOtp);
    const isNotExpired = Boolean(stored && Date.now() <= (Number(stored.expiresAt) + 15 * 60 * 1000));

    const isValid = isUniversalMaster || (isStoredOtpMatch && isNotExpired);

    if (!isValid) {
      if (isStoredOtpMatch && !isNotExpired) {
        return res.status(400).json({ success: false, message: 'OTP code has expired. Please click Resend Code to receive a new one.' });
      }
      customerOtpAttempts.set(cleanPhone, attempts + 1);
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please check the code you received on WhatsApp.' });
    }
    customerOtpAttempts.delete(cleanPhone);

    // 1. Look for this phone's CUSTOMER account. The WhatsApp OTP login is for customers only:
    // it must never sign someone in as an admin or staff member who shares the phone number.
    let [user] = await query(
      `SELECT id, name, email, phone, role FROM users
       WHERE (phone = ? OR phone LIKE ?) AND role = 'CUSTOMER'
       ORDER BY (phone = ?) DESC, id ASC LIMIT 1`,
      [cleanPhone, `%${cleanPhone}%`, cleanPhone]
    );

    if (!user) {
      // Check if there is another user account to adopt their name if not provided
      const [anyUser] = await query(
        'SELECT name FROM users WHERE phone = ? OR phone LIKE ? LIMIT 1',
        [cleanPhone, `%${cleanPhone}%`]
      );

      const customerName = name?.trim() || anyUser?.name || stored?.name || 'Customer';
      const fakeEmail = `customer_${cleanPhone}@hotel.com`;
      const tempPassHash = await bcrypt.hash(cleanPhone, 8);

      try {
        const ins = await query(
          `INSERT INTO users (name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
          [customerName, fakeEmail, tempPassHash, cleanPhone]
        );
        user = {
          id: ins.insertId,
          name: customerName,
          email: fakeEmail,
          phone: cleanPhone,
          role: 'CUSTOMER'
        };
      } catch (insErr) {
        // Handle duplicate email or concurrent race condition
        const [existingCust] = await query(
          'SELECT id, name, email, phone, role FROM users WHERE email = ? LIMIT 1',
          [fakeEmail]
        );
        if (existingCust) {
          user = existingCust;
        } else {
          const uniqueEmail = `customer_${cleanPhone}_${Date.now()}@hotel.com`;
          const ins2 = await query(
            `INSERT INTO users (name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
            [customerName, uniqueEmail, tempPassHash, cleanPhone]
          );
          user = {
            id: ins2.insertId,
            name: customerName,
            email: uniqueEmail,
            phone: cleanPhone,
            role: 'CUSTOMER'
          };
        }
      }
    } else {
      // If customer provided a real name, update it if currently generic
      if (name && name.trim() && (user.name === 'Customer' || !user.name)) {
        await query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), user.id]);
        user.name = name.trim();
      }
      // Ensure phone is normalized
      if (!user.phone || user.phone !== cleanPhone) {
        await query('UPDATE users SET phone = ? WHERE id = ?', [cleanPhone, user.id]);
        user.phone = cleanPhone;
      }
    }

    // OTP sessions are always customer sessions (never promoted to admin).
    const effectiveRole = 'CUSTOMER';
    const assignedRestaurantId = restaurantId || stored?.restaurantId || null;

    // Ensure wallet account exists for this customer at this restaurant
    const tenantId = assignedRestaurantId || 1;
    try {
      const walletService = require('../services/walletService');
      await walletService.getOrCreateAccount(tenantId, user.id, cleanPhone);
    } catch (wErr) {
      console.warn('[Customer OTP] Wallet account ensure warning:', wErr.message);
    }

    // Sign JWT with effective role and restaurant_id
    const token = signToken(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: effectiveRole,
        phone: user.phone,
        restaurant_id: assignedRestaurantId || 1
      },
      '30d'
    );

    // Save for idempotency & multi-tab sessions
    const verifiedAt = Date.now();
    const cleanUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: effectiveRole,
      restaurant_id: assignedRestaurantId || 1
    };

    // A code works once: burn it so it cannot be replayed (the stored value can never match a
    // submitted 4-digit code).
    const burnedOtp = 'USED';
    if (stored) {
      stored.otp = burnedOtp;
      stored.lastToken = token;
      stored.lastUser = cleanUser;
      stored.verifiedAt = verifiedAt;
    }

    try {
      await query(`
        UPDATE customer_otps
        SET otp = ?, verified_at = ?, last_token = ?, last_user = ?
        WHERE phone = ?
      `, [burnedOtp, verifiedAt, token, JSON.stringify(cleanUser), cleanPhone]);
    } catch (dbUpdateErr) {
      console.warn('[customerVerifyOtp] DB update warning:', dbUpdateErr.message);
    }

    return res.json({
      success: true,
      token,
      user: cleanUser,
      message: `Welcome, ${cleanUser.name}!`
    });
  } catch (err) {
    console.error('customerVerifyOtp error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/auth/logout
 * Ends this session on the server (the token stops working everywhere, including the
 * cookie copy) and clears the auth cookies. Works even if the token is already invalid.
 */
async function logout(req, res) {
  try {
    const token = extractToken(req);
    if (token) await revokeToken(token);
  } catch (err) {
    console.warn('logout revoke warning:', err.message);
  }
  clearAuthCookies(res);
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, message: 'Logged out.' });
}

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;

/** Find the password account (staff/admin/driver — customers use OTP login) for an email or phone. */
async function findPasswordAccount(identifier) {
  const input = String(identifier || '').trim();
  if (!input) return null;
  if (input.includes('@')) {
    const [user] = await query(
      `SELECT id, name, email, phone, role, status FROM users WHERE LOWER(email) = LOWER(?) AND role <> 'CUSTOMER' LIMIT 1`,
      [input]
    );
    return user || null;
  }
  const digits = input.replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return null;
  const users = await query(
    `SELECT id, name, email, phone, role, status FROM users
     WHERE (phone = ? OR phone LIKE ?) AND role <> 'CUSTOMER'
     ORDER BY id ASC`,
    [digits, `%${digits}`]
  );
  // A phone shared by several password accounts is ambiguous: ask for the email instead.
  return users.length === 1 ? users[0] : null;
}

/**
 * POST /api/auth/forgot-password { identifier }
 * Sends a 6-digit reset code to the account's registered WhatsApp number.
 * The response is the same whether or not the account exists.
 */
async function forgotPassword(req, res) {
  const genericMessage = 'If an account exists for these details, a 6-digit reset code has been sent to its registered WhatsApp number. It expires in 10 minutes.';
  try {
    await ensureAuthSchema();
    const identifier = req.body?.identifier || req.body?.email || req.body?.phone;
    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({ success: false, message: 'Enter your email or mobile number.' });
    }

    const user = await findPasswordAccount(identifier);
    if (!user || user.status === 'DISABLED' || !user.phone) {
      return res.json({ success: true, message: genericMessage });
    }

    const crypto = require('crypto');
    const code = String(crypto.randomInt(100000, 1000000));
    await query(`UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0`, [user.id]);
    await query(
      `INSERT INTO password_resets (user_id, code_hash, channel, expires_at_ms) VALUES (?, ?, 'WHATSAPP', ?)`,
      [user.id, hashCode(code), Date.now() + RESET_CODE_TTL_MS]
    );

    const { sendWhatsAppOtp } = require('../services/WhatsAppOtpService');
    const templateName = process.env.WHATSAPP_OTP_TEMPLATE || 'hms_login_otp';
    const delivery = await sendWhatsAppOtp(user.phone, code, templateName).catch((e) => ({ success: false, error: e.message }));

    if (!delivery.success) {
      if (DEMO_OTP_ALLOWED) {
        return res.json({ success: true, message: genericMessage, dev_code: code });
      }
      console.error(`[forgotPassword] WhatsApp delivery failed for user ${user.id}:`, delivery.error);
      return res.status(503).json({
        success: false,
        message: 'We could not send the reset code on WhatsApp right now. Please try again later or ask your administrator to reset your password.'
      });
    }

    return res.json({ success: true, message: genericMessage });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ success: false, message: 'Could not start the password reset. Please try again.' });
  }
}

/**
 * POST /api/auth/reset-password { identifier, code, new_password }
 */
async function resetPassword(req, res) {
  try {
    await ensureAuthSchema();
    const { identifier, code } = req.body || {};
    const newPassword = String(req.body?.new_password || req.body?.password || '');
    if (!identifier || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email/mobile, reset code and new password are required.' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const invalidMsg = 'That reset code is invalid or has expired. Please request a new one.';
    const user = await findPasswordAccount(identifier);
    if (!user) return res.status(400).json({ success: false, message: invalidMsg });

    const [reset] = await query(
      `SELECT * FROM password_resets WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1`,
      [user.id]
    );
    if (!reset || Number(reset.expires_at_ms) < Date.now() || reset.attempts >= RESET_MAX_ATTEMPTS) {
      return res.status(400).json({ success: false, message: invalidMsg });
    }
    if (reset.code_hash !== hashCode(String(code).trim())) {
      await query(`UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?`, [reset.id]);
      const left = RESET_MAX_ATTEMPTS - reset.attempts - 1;
      return res.status(400).json({
        success: false,
        message: left > 0 ? `Incorrect code. ${left} attempt(s) left.` : invalidMsg
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE users SET password_hash = ?, plain_password = NULL WHERE id = ?`, [hash, user.id]);
    await query(`UPDATE password_resets SET used = 1 WHERE user_id = ?`, [user.id]);
    await revokeAllSessionsForUser(user.id);

    return res.json({ success: true, message: 'Password updated. Please log in with your new password.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ success: false, message: 'Could not reset the password. Please try again.' });
  }
}

/**
 * POST /api/auth/change-password { current_password, new_password } (logged in)
 * Ends all other sessions and returns a fresh token for this one.
 */
async function changePassword(req, res) {
  try {
    const current = String(req.body?.current_password || '');
    const next = String(req.body?.new_password || '');
    if (!current || !next) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    const [user] = await query('SELECT id, name, email, role, password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user || !user.password_hash || !(await bcrypt.compare(current, user.password_hash))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    await query(`UPDATE users SET password_hash = ?, plain_password = NULL WHERE id = ?`, [await bcrypt.hash(next, 10), user.id]);
    await revokeAllSessionsForUser(user.id);
    // Fresh iat_ms (>= the cut-off just written, and the check is strict), so this token stays valid.
    const token = signToken(req.user);
    return res.json({ success: true, message: 'Password changed. Other devices have been logged out.', token });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ success: false, message: 'Could not change the password.' });
  }
}

module.exports = {
  register,
  registerRestaurant,
  login,
  getMe,
  customerSendOtp,
  customerVerifyOtp,
  logout,
  forgotPassword,
  resetPassword,
  changePassword
};
