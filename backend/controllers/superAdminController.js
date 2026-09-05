const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const NotificationService = require('../services/NotificationService');

// ═══════════════════════════════════════════════
// DASHBOARD KPIs
// ═══════════════════════════════════════════════

async function getSuperAdminKPIs(req, res) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [totalRestaurants] = await query("SELECT COUNT(*) as count FROM restaurants");
    const [activeRestaurants] = await query("SELECT COUNT(*) as count FROM restaurants WHERE status = 'ACTIVE'");
    const [pendingRestaurants] = await query("SELECT COUNT(*) as count FROM restaurants WHERE status = 'PENDING'");
    const [suspendedRestaurants] = await query("SELECT COUNT(*) as count FROM restaurants WHERE status = 'SUSPENDED'");
    const [publishedWebsites] = await query("SELECT COUNT(*) as count FROM restaurants WHERE website_status = 'PUBLISHED'");
    const [orderingEnabled] = await query("SELECT COUNT(*) as count FROM restaurants WHERE is_online_ordering_enabled = 1");
    const [totalAdmins] = await query("SELECT COUNT(*) as count FROM users WHERE role IN ('ADMIN', 'RESTAURANT_ADMIN')");
    const [todayOrders] = await query(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE DATE(created_at) = ?",
      [todayStr]
    );
    const [totalOrders] = await query("SELECT COUNT(*) as count FROM orders");

    res.json({
      success: true,
      kpis: {
        totalRestaurants: totalRestaurants.count,
        activeRestaurants: activeRestaurants.count,
        pendingRestaurants: pendingRestaurants.count,
        suspendedRestaurants: suspendedRestaurants.count,
        publishedWebsites: publishedWebsites.count,
        orderingEnabled: orderingEnabled.count,
        totalAdmins: totalAdmins.count,
        todayOrders: todayOrders.count,
        todayRevenue: parseFloat(todayOrders.revenue),
        totalOrders: totalOrders.count
      }
    });
  } catch (err) {
    console.error('getSuperAdminKPIs Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving KPIs.' });
  }
}

// ═══════════════════════════════════════════════
// RESTAURANT MANAGEMENT
// ═══════════════════════════════════════════════

async function getAllRestaurants(req, res) {
  try {
    const { status, search } = req.query;
    let sql = `
      SELECT r.*,
        (SELECT COUNT(*) FROM orders WHERE restaurant_id = r.id) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE restaurant_id = r.id AND DATE(created_at) = CURDATE()) as today_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE restaurant_id = r.id AND DATE(created_at) = CURDATE()) as today_revenue,
        (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = r.id) as menu_items_count,
        (SELECT COUNT(*) FROM categories WHERE restaurant_id = r.id) as categories_count,
        GROUP_CONCAT(DISTINCT u.name ORDER BY ra.is_primary DESC SEPARATOR ', ') as admin_names,
        GROUP_CONCAT(DISTINCT u.email ORDER BY ra.is_primary DESC SEPARATOR ', ') as admin_emails
      FROM restaurants r
      LEFT JOIN restaurant_admins ra ON ra.restaurant_id = r.id
      LEFT JOIN users u ON u.id = ra.user_id
    `;
    const params = [];
    const wheres = [];

    if (status) {
      wheres.push('r.status = ?');
      params.push(status);
    }
    if (search) {
      wheres.push('(r.name LIKE ? OR r.slug LIKE ? OR r.city LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (wheres.length > 0) {
      sql += ' WHERE ' + wheres.join(' AND ');
    }
    sql += ' GROUP BY r.id ORDER BY r.created_at DESC';

    const restaurants = await query(sql, params);
    res.json({ success: true, count: restaurants.length, restaurants });
  } catch (err) {
    console.error('getAllRestaurants Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving restaurants.' });
  }
}

async function getRestaurantById(req, res) {
  try {
    const { id } = req.params;
    const rows = await query('SELECT * FROM restaurants WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    const restaurant = rows[0];

    // Fetch admins
    const admins = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.status, ra.is_primary, ra.assigned_at
       FROM restaurant_admins ra
       JOIN users u ON u.id = ra.user_id
       WHERE ra.restaurant_id = ?`,
      [id]
    );

    // Order summary
    const [orderSummary] = await query(
      `SELECT COUNT(*) as total_orders,
              COALESCE(SUM(total_amount), 0) as total_revenue,
              SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_orders,
              COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN total_amount ELSE 0 END), 0) as today_revenue
       FROM orders WHERE restaurant_id = ?`,
      [id]
    );

    res.json({
      success: true,
      restaurant: {
        ...restaurant,
        admins,
        orderSummary
      }
    });
  } catch (err) {
    console.error('getRestaurantById Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function createRestaurant(req, res) {
  try {
    const { name, phone, email, address, city, state, area, postal_code } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Restaurant name is required.' });
    }

    let slugBase = name.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slugBase) slugBase = 'restaurant';

    let slug = slugBase;
    const existing = await query('SELECT id FROM restaurants WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      slug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const result = await query(
      `INSERT INTO restaurants (name, slug, phone, email, address, city, state, area, postal_code,
        status, website_status, is_online_ordering_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'DRAFT', 0)`,
      [name, slug, phone || null, email || null, address || null, city || null, state || null, area || null, postal_code || null]
    );

    // Auto-provision 7-Day Free Trial
    try {
      const subscriptionService = require('../services/SubscriptionService');
      await subscriptionService.provisionHotelTrial(result.insertId);
    } catch (trialErr) {
      console.warn('Trial auto-provisioning warning:', trialErr.message);
    }

    const newRest = await query('SELECT * FROM restaurants WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Restaurant created.', restaurant: newRest[0] });
  } catch (err) {
    console.error('createRestaurant Error:', err);
    res.status(500).json({ success: false, message: 'Server error creating restaurant.' });
  }
}

async function updateRestaurantStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    await query('UPDATE restaurants SET status = ? WHERE id = ?', [status, id]);

    // Also synchronize admin users belonging to this restaurant
    try {
      if (status === 'ACTIVE') {
        await query(`
          UPDATE users u
          JOIN restaurant_admins ra ON ra.user_id = u.id
          SET u.status = 'ACTIVE'
          WHERE ra.restaurant_id = ?
        `, [id]);
      } else if (status === 'SUSPENDED') {
        await query(`
          UPDATE users u
          JOIN restaurant_admins ra ON ra.user_id = u.id
          SET u.status = 'DISABLED'
          WHERE ra.restaurant_id = ?
        `, [id]);
      }
    } catch (uErr) {}

    const [updatedRest] = await query('SELECT * FROM restaurants WHERE id = ?', [id]);
    res.json({ success: true, message: `Restaurant status updated to ${status}.`, restaurant: updatedRest });
  } catch (err) {
    console.error('updateRestaurantStatus Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ═══════════════════════════════════════════════
// RESTAURANT ADMIN MANAGEMENT
// ═══════════════════════════════════════════════

async function createRestaurantAdmin(req, res) {
  try {
    const { name, email, password, phone, restaurant_id } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and phone are required.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status)
       VALUES (?, ?, ?, ?, ?, 'RESTAURANT_ADMIN', 'ACTIVE')`,
      [name, email, hash, password, phone]
    );

    const userId = result.insertId;

    // If restaurant_id provided, assign immediately
    if (restaurant_id) {
      await query(
        'INSERT INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, 1)',
        [userId, restaurant_id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Restaurant admin created.',
      admin: { id: userId, name, email, phone, role: 'RESTAURANT_ADMIN' }
    });
  } catch (err) {
    console.error('createRestaurantAdmin Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function assignRestaurantAdmin(req, res) {
  try {
    const { user_id, restaurant_id, is_primary } = req.body;

    if (!user_id || !restaurant_id) {
      return res.status(400).json({ success: false, message: 'user_id and restaurant_id are required.' });
    }

    // Check user exists and is admin role
    const users = await query('SELECT id, role FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    const restaurants = await query('SELECT id FROM restaurants WHERE id = ?', [restaurant_id]);
    if (restaurants.length === 0) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    // If setting as primary, clear other primaries for this restaurant
    if (is_primary) {
      await query('UPDATE restaurant_admins SET is_primary = 0 WHERE restaurant_id = ?', [restaurant_id]);
    }

    await query(
      'INSERT INTO restaurant_admins (user_id, restaurant_id, is_primary) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)',
      [user_id, restaurant_id, is_primary ? 1 : 0]
    );

    // Update user role to RESTAURANT_ADMIN if not already
    await query("UPDATE users SET role = 'RESTAURANT_ADMIN' WHERE id = ? AND role NOT IN ('SUPER_ADMIN', 'RESTAURANT_ADMIN')", [user_id]);
    // Also update admin_user_id on restaurant for backward compatibility
    if (is_primary) {
      await query('UPDATE restaurants SET admin_user_id = ? WHERE id = ?', [user_id, restaurant_id]);
    }

    res.json({ success: true, message: 'Admin assigned to restaurant.' });
  } catch (err) {
    console.error('assignRestaurantAdmin Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function removeRestaurantAdmin(req, res) {
  try {
    const { id } = req.params; // restaurant_admins.id
    await query('DELETE FROM restaurant_admins WHERE id = ?', [id]);
    res.json({ success: true, message: 'Admin assignment removed.' });
  } catch (err) {
    console.error('removeRestaurantAdmin Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getAllAdmins(req, res) {
  try {
    const admins = await query(
      `SELECT u.id as user_id, u.name, u.email, u.phone, u.plain_password, u.status, u.role, u.created_at,
              GROUP_CONCAT(DISTINCT r.name ORDER BY ra.is_primary DESC SEPARATOR ', ') as restaurant_names,
              GROUP_CONCAT(DISTINCT r.id ORDER BY ra.is_primary DESC SEPARATOR ',') as restaurant_ids,
              GROUP_CONCAT(DISTINCT r.slug ORDER BY ra.is_primary DESC SEPARATOR ',') as restaurant_slugs
       FROM users u
       LEFT JOIN restaurant_admins ra ON ra.user_id = u.id
       LEFT JOIN restaurants r ON r.id = ra.restaurant_id
       WHERE u.role IN ('ADMIN', 'RESTAURANT_ADMIN')
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, count: admins.length, admins });
  } catch (err) {
    console.error('getAllAdmins Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving admin list.' });
  }
}

async function updateAdminStatus(req, res) {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'DISABLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    await query("UPDATE users SET status = ? WHERE id = ? AND role IN ('ADMIN', 'RESTAURANT_ADMIN')", [status, userId]);

    await NotificationService.sendNotification({
      userId,
      title: 'Account Status Update',
      message: `Your admin account status was changed to ${status} by Super Admin.`,
      type: 'SYSTEM'
    });

    res.json({ success: true, message: `Admin account status updated to ${status}.` });
  } catch (err) {
    console.error('updateAdminStatus Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating admin status.' });
  }
}

// ═══════════════════════════════════════════════
// DRIVER MANAGEMENT (Preserved for Phase 2)
// ═══════════════════════════════════════════════

async function getAllDrivers(req, res) {
  try {
    const drivers = await query(
      `SELECT d.id as driver_id, d.user_id, d.vehicle_type, d.vehicle_number, d.license_number,
              d.approval_status, d.availability_status, d.is_active, d.created_at,
              u.name, u.email, u.phone, u.plain_password, u.status as user_status,
              GROUP_CONCAT(DISTINCT r.name SEPARATOR ', ') as restaurant_name
       FROM delivery_drivers d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN driver_restaurant_assignments dra ON dra.driver_id = d.id AND dra.status = 'ACTIVE'
       LEFT JOIN restaurants r ON dra.restaurant_id = r.id
       GROUP BY d.id
       ORDER BY d.id DESC`
    );
    res.json({ success: true, count: drivers.length, drivers });
  } catch (err) {
    console.error('getAllDrivers Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving drivers.' });
  }
}

async function updateDriverStatus(req, res) {
  try {
    const { driverId } = req.params;
    const { userStatus, approvalStatus } = req.body;

    const drivers = await query('SELECT user_id FROM delivery_drivers WHERE id = ?', [driverId]);
    if (drivers.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    const userId = drivers[0].user_id;

    if (userStatus && ['ACTIVE', 'DISABLED'].includes(userStatus)) {
      await query('UPDATE users SET status = ? WHERE id = ?', [userStatus, userId]);
    }
    if (approvalStatus && ['PENDING', 'APPROVED', 'REJECTED'].includes(approvalStatus)) {
      await query('UPDATE delivery_drivers SET approval_status = ? WHERE id = ?', [approvalStatus, driverId]);
    }

    let notifMsg = 'Your delivery driver profile has been updated.';
    if (approvalStatus === 'APPROVED') notifMsg = '🎉 Your driver application has been APPROVED!';
    else if (approvalStatus === 'REJECTED') notifMsg = 'Your driver application was rejected.';
    else if (userStatus === 'DISABLED') notifMsg = 'Your driver account has been disabled.';
    else if (userStatus === 'ACTIVE') notifMsg = 'Your driver account has been enabled.';

    await NotificationService.sendNotification({
      userId, title: 'Driver Status Update', message: notifMsg, type: 'SYSTEM'
    });

    res.json({ success: true, message: 'Driver status updated successfully.' });
  } catch (err) {
    console.error('updateDriverStatus Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ═══════════════════════════════════════════════
// PLATFORM ORDERS
// ═══════════════════════════════════════════════

async function getAllPlatformOrders(req, res) {
  try {
    const { status, restaurant_id, search, date } = req.query;
    let sql = `
      SELECT o.*, r.name as restaurant_name, r.slug as restaurant_slug
      FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
    `;
    const params = [];
    const wheres = [];

    if (status) { wheres.push('o.order_status = ?'); params.push(status); }
    if (restaurant_id) { wheres.push('o.restaurant_id = ?'); params.push(restaurant_id); }
    if (date) { wheres.push('DATE(o.created_at) = ?'); params.push(date); }
    if (search) {
      wheres.push('(o.order_number LIKE ? OR o.customer_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND ');
    sql += ' ORDER BY o.created_at DESC LIMIT 100';

    const orders = await query(sql, params);
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('getAllPlatformOrders Error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function toggleCustomSubdomain(req, res) {
  try {
    const { id } = req.params;
    const { enabled, custom_subdomain_slug } = req.body;

    const [rest] = await query('SELECT * FROM restaurants WHERE id = ?', [id]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : (rest.custom_subdomain_enabled ? 0 : 1);
    const newCustomSlug = custom_subdomain_slug || rest.custom_subdomain_slug || rest.slug;

    await query(
      'UPDATE restaurants SET custom_subdomain_enabled = ?, custom_subdomain_slug = ? WHERE id = ?',
      [newEnabled, newCustomSlug, id]
    );

    res.json({
      success: true,
      message: `Custom subdomain ${newEnabled ? 'enabled (₹99/mo plan)' : 'disabled (random slug mode)'}.`,
      custom_subdomain_enabled: newEnabled,
      custom_subdomain_slug: newCustomSlug
    });
  } catch (err) {
    console.error('toggleCustomSubdomain Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating subdomain.' });
  }
}

// ═══════════════════════════════════════════════
// RESTAURANT FEATURE CONTROLS & MODULAR PROVISIONING
// ═══════════════════════════════════════════════

const DEFAULT_FEATURE_KEYS = [
  'online_ordering',
  'delivery_fleet',
  'rewards_wallet',
  'table_dine_in',
  'kds_kot',
  'pos_billing',
  'inventory_stock',
  'reports_analytics',
  'hotel_accommodations',
  'custom_subdomain'
];

async function ensureFeatureRow(restaurantId) {
  const [row] = await query('SELECT * FROM restaurant_feature_controls WHERE restaurant_id = ?', [restaurantId]);
  if (!row) {
    await query(
      `INSERT IGNORE INTO restaurant_feature_controls (restaurant_id) VALUES (?)`,
      [restaurantId]
    );
    const [fresh] = await query('SELECT * FROM restaurant_feature_controls WHERE restaurant_id = ?', [restaurantId]);
    return fresh;
  }
  return row;
}

async function getAllRestaurantsWithFeatures(req, res) {
  try {
    const sql = `
      SELECT 
        r.id, r.name, r.slug, r.status, r.website_status, r.phone, r.email,
        COALESCE(f.online_ordering, 1) as online_ordering,
        COALESCE(f.delivery_fleet, 1) as delivery_fleet,
        COALESCE(f.rewards_wallet, 1) as rewards_wallet,
        COALESCE(f.table_dine_in, 1) as table_dine_in,
        COALESCE(f.kds_kot, 1) as kds_kot,
        COALESCE(f.pos_billing, 1) as pos_billing,
        COALESCE(f.inventory_stock, 1) as inventory_stock,
        COALESCE(f.reports_analytics, 1) as reports_analytics,
        COALESCE(f.hotel_accommodations, 1) as hotel_accommodations,
        COALESCE(f.custom_subdomain, 1) as custom_subdomain
      FROM restaurants r
      LEFT JOIN restaurant_feature_controls f ON r.id = f.restaurant_id
      ORDER BY r.id ASC
    `;
    const rows = await query(sql);

    const formatted = rows.map(r => {
      let activeCount = 0;
      DEFAULT_FEATURE_KEYS.forEach(k => {
        if (r[k] === 1) activeCount++;
      });
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        website_status: r.website_status,
        phone: r.phone,
        email: r.email,
        active_features_count: activeCount,
        total_features_count: DEFAULT_FEATURE_KEYS.length,
        features: {
          online_ordering: r.online_ordering,
          delivery_fleet: r.delivery_fleet,
          rewards_wallet: r.rewards_wallet,
          table_dine_in: r.table_dine_in,
          kds_kot: r.kds_kot,
          pos_billing: r.pos_billing,
          inventory_stock: r.inventory_stock,
          reports_analytics: r.reports_analytics,
          hotel_accommodations: r.hotel_accommodations,
          custom_subdomain: r.custom_subdomain
        }
      };
    });

    res.json({ success: true, restaurants: formatted });
  } catch (err) {
    console.error('getAllRestaurantsWithFeatures Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving restaurant features.' });
  }
}

async function getRestaurantFeatures(req, res) {
  try {
    const { id } = req.params;
    const [rest] = await query('SELECT id, name, slug FROM restaurants WHERE id = ?', [id]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    const row = await ensureFeatureRow(id);
    const features = {};
    DEFAULT_FEATURE_KEYS.forEach(k => {
      features[k] = row[k] !== undefined ? row[k] : 1;
    });

    res.json({
      success: true,
      restaurant: rest,
      features
    });
  } catch (err) {
    console.error('getRestaurantFeatures Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving features.' });
  }
}

async function updateRestaurantFeatures(req, res) {
  try {
    const { id } = req.params;
    const [rest] = await query('SELECT id, name, slug FROM restaurants WHERE id = ?', [id]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    await ensureFeatureRow(id);

    const updateFields = [];
    const updateParams = [];

    for (const key of DEFAULT_FEATURE_KEYS) {
      if (req.body[key] !== undefined) {
        const val = req.body[key] ? 1 : 0;
        updateFields.push(`${key} = ?`);
        updateParams.push(val);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid feature fields provided.' });
    }

    updateParams.push(id);
    await query(
      `UPDATE restaurant_feature_controls SET ${updateFields.join(', ')} WHERE restaurant_id = ?`,
      updateParams
    );

    // Fetch complete updated feature set
    const freshRow = await ensureFeatureRow(id);
    const fullFeatures = {};
    DEFAULT_FEATURE_KEYS.forEach(k => {
      fullFeatures[k] = freshRow[k];
    });

    // If custom_subdomain is toggled, sync restaurants.custom_subdomain_enabled
    if (req.body.custom_subdomain !== undefined) {
      await query('UPDATE restaurants SET custom_subdomain_enabled = ? WHERE id = ?', [req.body.custom_subdomain ? 1 : 0, id]);
    }
    // If online_ordering is toggled, sync restaurants.is_online_ordering_enabled
    if (req.body.online_ordering !== undefined) {
      await query('UPDATE restaurants SET is_online_ordering_enabled = ? WHERE id = ?', [req.body.online_ordering ? 1 : 0, id]);
    }

    // Broadcast socket event for real-time instant UI update
    try {
      const io = NotificationService.getSocketIO ? NotificationService.getSocketIO() : null;
      if (io) {
        io.emit('restaurant_features_updated', {
          restaurantId: parseInt(id, 10),
          features: fullFeatures
        });
      }
    } catch (e) {}

    res.json({
      success: true,
      message: 'Feature controls updated successfully.',
      restaurant: rest,
      features: fullFeatures
    });
  } catch (err) {
    console.error('updateRestaurantFeatures Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating features.' });
  }
}

async function bulkSetRestaurantFeatures(req, res) {
  try {
    const { id } = req.params;
    const { preset } = req.body; // 'full', 'food_dining_only', 'cloud_kitchen', 'disable_all'

    const [rest] = await query('SELECT id, name, slug FROM restaurants WHERE id = ?', [id]);
    if (!rest) return res.status(404).json({ success: false, message: 'Restaurant not found.' });

    await ensureFeatureRow(id);

    let targetFeatures = {};
    if (preset === 'full') {
      DEFAULT_FEATURE_KEYS.forEach(k => { targetFeatures[k] = 1; });
    } else if (preset === 'food_dining_only') {
      DEFAULT_FEATURE_KEYS.forEach(k => { targetFeatures[k] = 1; });
      targetFeatures.hotel_accommodations = 0;
    } else if (preset === 'cloud_kitchen') {
      DEFAULT_FEATURE_KEYS.forEach(k => { targetFeatures[k] = 0; });
      targetFeatures.online_ordering = 1;
      targetFeatures.delivery_fleet = 1;
      targetFeatures.rewards_wallet = 1;
      targetFeatures.inventory_stock = 1;
      targetFeatures.reports_analytics = 1;
      targetFeatures.pos_billing = 1;
    } else if (preset === 'disable_all') {
      DEFAULT_FEATURE_KEYS.forEach(k => { targetFeatures[k] = 0; });
    } else {
      return res.status(400).json({ success: false, message: 'Unknown preset profile.' });
    }

    const setClauses = DEFAULT_FEATURE_KEYS.map(k => `${k} = ?`).join(', ');
    const setValues = DEFAULT_FEATURE_KEYS.map(k => targetFeatures[k]);
    setValues.push(id);

    await query(
      `UPDATE restaurant_feature_controls SET ${setClauses} WHERE restaurant_id = ?`,
      setValues
    );

    // Sync sub-flags
    if (targetFeatures.custom_subdomain !== undefined) {
      await query('UPDATE restaurants SET custom_subdomain_enabled = ? WHERE id = ?', [targetFeatures.custom_subdomain, id]);
    }
    if (targetFeatures.online_ordering !== undefined) {
      await query('UPDATE restaurants SET is_online_ordering_enabled = ? WHERE id = ?', [targetFeatures.online_ordering, id]);
    }

    // Broadcast socket event
    try {
      const io = NotificationService.getSocketIO ? NotificationService.getSocketIO() : null;
      if (io) {
        io.emit('restaurant_features_updated', {
          restaurantId: parseInt(id, 10),
          features: targetFeatures
        });
      }
    } catch (e) {}

    res.json({
      success: true,
      message: `Preset profile "${preset}" applied successfully.`,
      features: targetFeatures
    });
  } catch (err) {
    console.error('bulkSetRestaurantFeatures Error:', err);
    res.status(500).json({ success: false, message: 'Server error applying feature preset.' });
  }
}

module.exports = {
  getSuperAdminKPIs,
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurantStatus,
  createRestaurantAdmin,
  assignRestaurantAdmin,
  removeRestaurantAdmin,
  getAllAdmins,
  updateAdminStatus,
  getAllDrivers,
  updateDriverStatus,
  getAllPlatformOrders,
  toggleCustomSubdomain,
  getAllRestaurantsWithFeatures,
  getRestaurantFeatures,
  updateRestaurantFeatures,
  bulkSetRestaurantFeatures
};
