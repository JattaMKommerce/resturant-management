const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getConnection, query } = require('../config/db');
const OrderService = require('../services/OrderService');
const { processDriverLocationUpdate } = require('../services/DriverLocationService');
const { sendNotification } = require('../services/NotificationService');
const { validateRestaurantAccess } = require('../middleware/auth');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

/**
 * 1. DRIVER LOGIN (Email/Mobile + Password)
 * Only approved & active drivers can log in. NO OTP.
 */
async function driverLogin(req, res) {
  try {
    const { login, password } = req.body;
    const identifier = login || req.body.email || req.body.mobile;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/Mobile and password are required.' });
    }

    // Find user by email or phone
    const users = await query(
      `SELECT * FROM users WHERE (email = ? OR phone = ?) AND role = 'DRIVER'`,
      [identifier.trim().toLowerCase(), identifier.trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid driver credentials or account does not exist.' });
    }

    const user = users[0];

    if (user.status === 'DISABLED' || user.status === 'INACTIVE') {
      return res.status(403).json({ success: false, message: 'Your user account is disabled. Contact support.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Verify driver profile & application status
    const drivers = await query('SELECT * FROM delivery_drivers WHERE user_id = ?', [user.id]);
    if (drivers.length === 0) {
      return res.status(403).json({ success: false, message: 'Driver profile not found.' });
    }

    const driver = drivers[0];

    if (driver.approval_status === 'PENDING') {
      return res.status(403).json({ success: false, message: 'Your driver application is still pending review.' });
    }

    if (driver.approval_status === 'REJECTED') {
      return res.status(403).json({ success: false, message: 'Your driver application was rejected.' });
    }

    if (driver.account_status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: `Your driver account is ${driver.account_status}. Please contact the restaurant admin.` });
    }

    // Fetch assigned restaurants via driver_restaurant_assignments
    const assignedRestaurants = await query(
      `SELECT r.id, r.name, r.slug, r.logo_url, r.address, r.latitude, r.longitude, dra.status as assignment_status
       FROM restaurants r
       JOIN driver_restaurant_assignments dra ON dra.restaurant_id = r.id
       WHERE dra.driver_id = ? AND dra.status = 'ACTIVE'`,
      [driver.id]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: 'DRIVER', driverId: driver.id },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      driver: {
        id: driver.id,
        userId: user.id,
        fullName: driver.full_name || user.name,
        email: user.email,
        mobile: user.phone,
        vehicleType: driver.vehicle_type,
        vehicleNumber: driver.vehicle_number,
        accountStatus: driver.account_status,
        availabilityStatus: driver.availability_status,
        currentLatitude: driver.current_latitude,
        currentLongitude: driver.current_longitude
      },
      assignedRestaurants
    });

  } catch (err) {
    console.error('driverLogin Error:', err);
    res.status(500).json({ success: false, message: 'Server error logging in driver.' });
  }
}

/**
 * Universal Driver Profile Resolver
 * Locates driver record by user_id, email, phone, or driverId, with automatic linking.
 */
async function getOrCreateDriverProfile(req) {
  if (!req.user) return null;
  const userId = req.user.id;

  // 1. Direct match on user_id
  let drivers = await query('SELECT * FROM delivery_drivers WHERE user_id = ?', [userId]);
  if (drivers.length > 0) return drivers[0];

  // 2. Match by email or phone
  if (req.user.email || req.user.phone) {
    drivers = await query(
      'SELECT * FROM delivery_drivers WHERE (email = ? AND email IS NOT NULL) OR (mobile = ? AND mobile IS NOT NULL)',
      [req.user.email || '', req.user.phone || '']
    );
    if (drivers.length > 0) {
      await query('UPDATE delivery_drivers SET user_id = ? WHERE id = ?', [userId, drivers[0].id]);
      return { ...drivers[0], user_id: userId };
    }
  }

  // 3. Match by driverId in JWT
  if (req.user.driverId) {
    drivers = await query('SELECT * FROM delivery_drivers WHERE id = ?', [req.user.driverId]);
    if (drivers.length > 0) {
      await query('UPDATE delivery_drivers SET user_id = ? WHERE id = ?', [userId, drivers[0].id]);
      return { ...drivers[0], user_id: userId };
    }
  }

  // 4. Auto-create or link delivery_drivers record for any authenticated user accessing portal
  const [ins] = await query(
    `INSERT INTO delivery_drivers (user_id, full_name, email, mobile, vehicle_type, vehicle_number, approval_status, account_status, availability_status)
     VALUES (?, ?, ?, ?, 'Bike', 'KA-25-TEMP', 'APPROVED', 'ACTIVE', 'OFFLINE')`,
    [
      userId,
      req.user.name || 'Delivery Partner',
      req.user.email || 'driver@hotel.com',
      req.user.phone || '+91 9999999999'
    ]
  );
  const newDrivers = await query('SELECT * FROM delivery_drivers WHERE id = ?', [ins.insertId]);
  return newDrivers[0];
}

/**
 * 2. GET DRIVER PROFILE & ACTIVE ASSIGNMENTS
 */
async function getDriverProfile(req, res) {
  try {
    const driver = await getOrCreateDriverProfile(req);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    const assignedRestaurants = await query(
      `SELECT r.id, r.name, r.slug, r.logo_url, r.phone, r.address, r.latitude, r.longitude
       FROM restaurants r
       JOIN driver_restaurant_assignments dra ON dra.restaurant_id = r.id
       WHERE dra.driver_id = ? AND dra.status = 'ACTIVE'`,
      [driver.id]
    );

    res.json({
      success: true,
      driver,
      assignedRestaurants
    });
  } catch (err) {
    console.error('getDriverProfile Error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
}

/**
 * 3. UPDATE DRIVER PROFILE
 */
async function updateDriverProfile(req, res) {
  try {
    const driver = await getOrCreateDriverProfile(req);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    const { currentCity, currentAddress, emergencyContact, vehicleType, vehicleNumber } = req.body;

    await query(
      `UPDATE delivery_drivers SET
        current_city = COALESCE(?, current_city),
        current_address = COALESCE(?, current_address),
        emergency_contact = COALESCE(?, emergency_contact),
        vehicle_type = COALESCE(?, vehicle_type),
        vehicle_number = COALESCE(?, vehicle_number)
       WHERE id = ?`,
      [
        currentCity || null, currentAddress || null,
        emergencyContact || null, vehicleType || null,
        vehicleNumber || null, driver.id
      ]
    );

    res.json({ success: true, message: 'Driver profile updated successfully.' });
  } catch (err) {
    console.error('updateDriverProfile Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
}

/**
 * 4. GO ONLINE
 */
async function goOnline(req, res) {
  try {
    const driver = await getOrCreateDriverProfile(req);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    if (driver.account_status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is not active.' });
    }

    const { latitude, longitude } = req.body;
    const lat = latitude ? parseFloat(latitude) : (driver.current_latitude || 15.3647);
    const lng = longitude ? parseFloat(longitude) : (driver.current_longitude || 75.1240);

    await query(
      `UPDATE delivery_drivers SET availability_status = 'AVAILABLE', current_latitude = ?, current_longitude = ?, last_location_at = NOW() WHERE id = ?`,
      [lat, lng, driver.id]
    );

    // Broadcast status change
    try {
      const { getSocketIO } = require('../services/NotificationService');
      const io = getSocketIO();
      if (io) {
        io.emit('driver_status_change', { driverId: driver.id, availability_status: 'AVAILABLE' });
      }
    } catch (e) { }

    res.json({
      success: true,
      message: 'You are now ONLINE and available for delivery assignments! 🟢',
      availabilityStatus: 'AVAILABLE'
    });
  } catch (err) {
    console.error('goOnline Error:', err);
    res.status(500).json({ success: false, message: 'Server error going online.' });
  }
}

/**
 * 5. GO OFFLINE
 */
async function goOffline(req, res) {
  try {
    const driver = await getOrCreateDriverProfile(req);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    // Check if active delivery in progress
    const activeDeliveries = await query(
      `SELECT id FROM orders WHERE assigned_driver_id = ? AND order_status IN ('PICKED_UP', 'OUT_FOR_DELIVERY')`,
      [driver.id]
    );

    if (activeDeliveries.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot go offline while you have an active delivery in progress.' });
    }

    await query(`UPDATE delivery_drivers SET availability_status = 'OFFLINE' WHERE id = ?`, [driver.id]);

    // Broadcast status change
    try {
      const { getSocketIO } = require('../services/NotificationService');
      const io = getSocketIO();
      if (io) {
        io.emit('driver_status_change', { driverId: driver.id, availability_status: 'OFFLINE' });
      }
    } catch (e) { }

    res.json({
      success: true,
      message: 'You are now OFFLINE. 🔴',
      availabilityStatus: 'OFFLINE'
    });
  } catch (err) {
    console.error('goOffline Error:', err);
    res.status(500).json({ success: false, message: 'Server error going offline.' });
  }
}

/**
 * 6. CANONICAL LOCATION UPDATE
 * Delegates to DriverLocationService
 */
async function updateDriverLocation(req, res) {
  try {
    const userId = req.user.id;
    const { latitude, longitude, orderId } = req.body;

    const result = await processDriverLocationUpdate({
      userId,
      latitude,
      longitude,
      orderId: orderId || null
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * 7. GET DRIVER ORDERS / ACTIVE DELIVERY
 */
async function getDriverOrders(req, res) {
  try {
    const driver = await getOrCreateDriverProfile(req);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    const assignedOrders = await query(
      `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
              r.phone as restaurant_phone, r.latitude as restaurant_latitude, r.longitude as restaurant_longitude
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.assigned_driver_id = ?
       ORDER BY o.created_at DESC`,
      [driver.id]
    );

    for (let order of assignedOrders) {
      order.items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    }

    const activeDelivery = assignedOrders.find(o =>
      ['ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'ACCEPTED', 'PREPARING', 'PENDING'].includes(o.order_status)
    ) || null;

    res.json({
      success: true,
      driver,
      activeDelivery,
      orders: assignedOrders
    });
  } catch (err) {
    console.error('getDriverOrders Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving driver orders.' });
  }
}

/**
 * 8. DRIVER ACCEPTS ASSIGNED DELIVERY
 */
async function acceptOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const driver = await getOrCreateDriverProfile(req);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.assigned_driver_id && order.assigned_driver_id !== driver.id) {
      return res.status(400).json({ success: false, message: 'This order is assigned to another driver.' });
    }

    // Auto-ensure driver is linked to restaurant if active
    const [assignment] = await query(
      'SELECT id FROM driver_restaurant_assignments WHERE driver_id = ? AND restaurant_id = ? AND status = "ACTIVE"',
      [driver.id, order.restaurant_id]
    );
    if (!assignment) {
      await query(
        `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, status, approved_at)
         VALUES (?, ?, 'ACTIVE', NOW())
         ON DUPLICATE KEY UPDATE status = 'ACTIVE', approved_at = NOW()`,
        [driver.id, order.restaurant_id]
      );
    }

    if (!order.assigned_driver_id) {
      await query('UPDATE orders SET assigned_driver_id = ? WHERE id = ?', [driver.id, id]);
    }

    const result = await OrderService.updateOrderStatus(id, 'DRIVER_ACCEPTED', userId, 'Driver accepted delivery assignment.');
    await query('UPDATE delivery_drivers SET availability_status = "BUSY" WHERE id = ?', [driver.id]);

    res.json({
      success: true,
      message: 'Delivery assignment accepted! Please proceed to the restaurant for pickup.',
      result
    });
  } catch (err) {
    console.error('acceptOrder Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * 9. DRIVER DECLINES ASSIGNED DELIVERY
 */
async function declineOrder(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const driver = await getOrCreateDriverProfile(req);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.assigned_driver_id !== driver.id) {
      return res.status(400).json({ success: false, message: 'This order is not assigned to you.' });
    }

    // Reset order back to READY_FOR_PICKUP and clear driver assignment
    await query(
      `UPDATE orders SET assigned_driver_id = NULL, order_status = 'READY_FOR_PICKUP' WHERE id = ?`,
      [id]
    );

    await query('UPDATE delivery_drivers SET availability_status = "AVAILABLE" WHERE id = ?', [driver.id]);

    await query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id)
       VALUES (?, 'READY_FOR_PICKUP', ?, ?)`,
      [id, `Driver ${driver.full_name} declined assignment. Reason: ${reason || 'Not specified'}`, userId]
    );

    res.json({
      success: true,
      message: 'Delivery assignment declined. Order returned to pickup pool.'
    });
  } catch (err) {
    console.error('declineOrder Error:', err);
    res.status(500).json({ success: false, message: 'Server error declining order.' });
  }
}

/**
 * 10. DRIVER MARKS FOOD PICKED UP
 */
async function pickupOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const driver = await getOrCreateDriverProfile(req);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.assigned_driver_id !== driver.id) {
      return res.status(400).json({ success: false, message: 'This order is not assigned to you.' });
    }

    const result = await OrderService.updateOrderStatus(id, 'PICKED_UP', userId, 'Driver picked up food package from restaurant.');

    res.json({
      success: true,
      message: 'Order marked as PICKED UP! Ready to start delivery.',
      result
    });
  } catch (err) {
    console.error('pickupOrder Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * 11. DRIVER STARTS DELIVERY (OUT_FOR_DELIVERY)
 */
async function startDelivery(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const driver = await getOrCreateDriverProfile(req);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.assigned_driver_id !== driver.id) {
      return res.status(400).json({ success: false, message: 'This order is not assigned to you.' });
    }

    const result = await OrderService.updateOrderStatus(id, 'OUT_FOR_DELIVERY', userId, 'Driver started delivery route to customer location.');

    res.json({
      success: true,
      message: 'Order status updated to OUT FOR DELIVERY. Live tracking activated!',
      result
    });
  } catch (err) {
    console.error('startDelivery Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * 12. DRIVER MARKS DELIVERED & COD COLLECTION
 */
async function deliverOrder(req, res) {
  try {
    const { id } = req.params;
    const { isCodCollected, remainOnline } = req.body;
    const userId = req.user.id;

    const driver = await getOrCreateDriverProfile(req);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (!order.assigned_driver_id) {
      await query('UPDATE orders SET assigned_driver_id = ? WHERE id = ?', [driver.id, id]);
    } else if (order.assigned_driver_id !== driver.id) {
      return res.status(400).json({ success: false, message: 'This order is not assigned to you.' });
    }

    // Process COD payment collection if applicable
    if (order.payment_method === 'COD' && isCodCollected) {
      await query(
        `UPDATE orders SET
          payment_status = 'COMPLETED',
          cod_collected_by = ?,
          cod_collected_at = NOW()
         WHERE id = ?`,
        [driver.id, id]
      );

      await query(
        `INSERT INTO payments (order_id, payment_method, amount, status, collected_by, collected_at, transaction_id)
         VALUES (?, 'COD', ?, 'SUCCESS', ?, NOW(), ?)`,
        [id, order.total_amount, driver.id, `COD_COLLECTED_DRIVER_${driver.id}_${Date.now()}`]
      );
    }

    // Update order status to DELIVERED
    const result = await OrderService.updateOrderStatus(id, 'DELIVERED', userId, 'Driver marked order as delivered.');

    // Update driver availability back to AVAILABLE so they can immediately accept the next order
    const newAvailability = remainOnline !== false ? 'AVAILABLE' : 'OFFLINE';
    await query('UPDATE delivery_drivers SET availability_status = ? WHERE id = ?', [newAvailability, driver.id]);

    // Broadcast driver availability change
    try {
      const { getSocketIO } = require('../services/NotificationService');
      const io = getSocketIO();
      if (io) {
        io.emit('driver_status_change', { driverId: driver.id, availability_status: newAvailability });
      }
    } catch (e) { }

    res.json({
      success: true,
      message: 'Order delivered successfully! 🎉 Ready for next delivery.',
      availabilityStatus: newAvailability,
      result
    });
  } catch (err) {
    console.error('deliverOrder Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * 13. DRIVER MARKS DELIVERY FAILED
 */
async function markDeliveryFailed(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Delivery failure reason is required.' });
    }

    const driver = await getOrCreateDriverProfile(req);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.assigned_driver_id !== driver.id) {
      return res.status(400).json({ success: false, message: 'This order is not assigned to you.' });
    }

    await query(
      `UPDATE orders SET delivery_failure_reason = ? WHERE id = ?`,
      [reason.trim(), id]
    );

    const result = await OrderService.updateOrderStatus(id, 'DELIVERY_FAILED', userId, `Delivery failed: ${reason.trim()}`);
    await query('UPDATE delivery_drivers SET availability_status = "AVAILABLE" WHERE id = ?', [driver.id]);

    res.json({
      success: true,
      message: 'Delivery marked as failed. Restaurant Admin has been notified for operational recovery.',
      result
    });
  } catch (err) {
    console.error('markDeliveryFailed Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * 14. ADMIN: Get Drivers List (Restaurant-Isolated)
 */
/**
 * 14. ADMIN: Get Drivers List (Restaurant-Isolated with SQL Fallback)
 */
async function getAdminDrivers(req, res) {
  try {
    const { availability, accountStatus, search, restaurant_id } = req.query;
    const restId = req.adminRestaurantId;

    if (!restId && !req.isSuperAdmin && (!req.adminRestaurantIds || req.adminRestaurantIds.length === 0)) {
      return res.status(403).json({ success: false, message: 'No restaurant assigned.' });
    }

    // Auto-ensure active drivers in delivery_drivers are assigned to active restaurants
    try {
      const activeRests = await query('SELECT id FROM restaurants WHERE status = "ACTIVE"');
      const activeDrivers = await query('SELECT id FROM delivery_drivers WHERE account_status = "ACTIVE" AND approval_status = "APPROVED"');
      for (const d of activeDrivers) {
        for (const r of activeRests) {
          await query(
            `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, status, approved_at)
             VALUES (?, ?, 'ACTIVE', NOW())
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [d.id, r.id]
          );
        }
      }
    } catch (e) {
      // Non-fatal auto-linking
    }

    let sql = `
      SELECT d.*,
             COALESCE(NULLIF(d.full_name, ''), u.name, 'Delivery Partner') as full_name,
             COALESCE(NULLIF(d.full_name, ''), u.name, 'Delivery Partner') as name,
             COALESCE(NULLIF(d.email, ''), u.email, '') as email,
             COALESCE(NULLIF(d.email, ''), u.email, '') as user_email,
             COALESCE(NULLIF(d.mobile, ''), u.phone, '') as mobile,
             COALESCE(NULLIF(d.mobile, ''), u.phone, '') as user_phone,
             u.status as user_status,
             COALESCE(MAX(dra.status), 'ACTIVE') as assignment_status
      FROM delivery_drivers d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_restaurant_assignments dra ON dra.driver_id = d.id AND dra.status = 'ACTIVE'
    `;
    const params = [];
    const wheres = [];

    if (!req.isSuperAdmin) {
      if (req.adminRestaurantIds && req.adminRestaurantIds.length > 0) {
        const placeholders = req.adminRestaurantIds.map(() => '?').join(',');
        wheres.push(`(dra.restaurant_id IN (${placeholders}) OR dra.restaurant_id IS NULL)`);
        params.push(...req.adminRestaurantIds);
      } else if (restId) {
        wheres.push('(dra.restaurant_id = ? OR dra.restaurant_id IS NULL)');
        params.push(restId);
      }
    } else if (restaurant_id) {
      wheres.push('(dra.restaurant_id = ? OR dra.restaurant_id IS NULL)');
      params.push(restaurant_id);
    }

    if (availability) {
      wheres.push('d.availability_status = ?');
      params.push(availability);
    }

    if (accountStatus && accountStatus !== 'ALL') {
      wheres.push('d.account_status = ?');
      params.push(accountStatus);
    }

    if (search) {
      wheres.push('(d.full_name LIKE ? OR d.mobile LIKE ? OR d.vehicle_number LIKE ? OR u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND ');
    sql += ` GROUP BY d.id ORDER BY d.id DESC`;

    const drivers = await query(sql, params);
    res.json({ success: true, count: drivers.length, drivers });
  } catch (err) {
    console.error('getAdminDrivers Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving drivers.' });
  }
}

/**
 * 14c. ADMIN: Create Delivery Rider directly
 */
async function createAdminDriver(req, res) {
  try {
    const { name, email, password, phone, vehicle_type, vehicle_number, license_number } = req.body;

    if (!name || !email || !phone || !vehicle_number) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, and vehicle plate number are required.'
      });
    }

    // Check existing user
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ? OR phone = ?',
      [email.trim().toLowerCase(), phone.trim()]
    );

    let userId;
    const userPassword = password && password.trim() ? password.trim() : 'driver123';
    const hash = await bcrypt.hash(userPassword, 10);

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
      await query(
        `UPDATE users SET role = 'DRIVER', status = 'ACTIVE', password_hash = ?, plain_password = ? WHERE id = ?`,
        [hash, userPassword, userId]
      );
    } else {
      const userRes = await query(
        `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status)
         VALUES (?, ?, ?, ?, ?, 'DRIVER', 'ACTIVE')`,
        [name.trim(), email.trim().toLowerCase(), hash, userPassword, phone.trim()]
      );
      userId = userRes.insertId;
    }

    // Check existing delivery_drivers profile
    const existingDrivers = await query('SELECT id FROM delivery_drivers WHERE user_id = ?', [userId]);

    let driverId;
    if (existingDrivers.length > 0) {
      driverId = existingDrivers[0].id;
      await query(
        `UPDATE delivery_drivers SET
          full_name = ?, mobile = ?, email = ?,
          vehicle_type = COALESCE(?, vehicle_type), vehicle_number = COALESCE(?, vehicle_number),
          license_number = COALESCE(?, license_number),
          account_status = 'ACTIVE', approval_status = 'APPROVED'
         WHERE id = ?`,
        [
          name.trim(), phone.trim(), email.trim().toLowerCase(),
          vehicle_type || 'Bike', vehicle_number.trim(),
          license_number || null, driverId
        ]
      );
    } else {
      const driverRes = await query(
        `INSERT INTO delivery_drivers (
          user_id, full_name, mobile, email,
          vehicle_type, vehicle_number, license_number,
          account_status, availability_status, approval_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'OFFLINE', 'APPROVED')`,
        [
          userId, name.trim(), phone.trim(), email.trim().toLowerCase(),
          vehicle_type || 'Bike', vehicle_number.trim(), license_number || null
        ]
      );
      driverId = driverRes.insertId;
    }

    // Assign to active restaurants
    const restaurants = await query('SELECT id FROM restaurants WHERE status = "ACTIVE"');
    for (const r of restaurants) {
      await query(
        `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, status, approved_at)
         VALUES (?, ?, 'ACTIVE', NOW())
         ON DUPLICATE KEY UPDATE status = 'ACTIVE', approved_at = NOW()`,
        [driverId, r.id]
      );
    }

    res.status(201).json({
      success: true,
      message: `Delivery rider "${name}" created successfully.`,
      driver: {
        id: driverId,
        user_id: userId,
        name: name.trim(),
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        vehicle_type: vehicle_type || 'Bike',
        vehicle_number: vehicle_number.trim(),
        account_status: 'ACTIVE',
        availability_status: 'OFFLINE'
      }
    });
  } catch (err) {
    console.error('createAdminDriver Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error creating driver.' });
  }
}

/**
 * 14b. ADMIN: Get Driver Details by ID (Restaurant-Isolated)
 */
async function getAdminDriverById(req, res) {
  try {
    const { id } = req.params;
    const restId = req.adminRestaurantId;

    if (!restId && !req.isSuperAdmin && (!req.adminRestaurantIds || req.adminRestaurantIds.length === 0)) {
      return res.status(403).json({ success: false, message: 'No restaurant assigned.' });
    }

    let sql = `
      SELECT d.*, u.name as user_name, u.email as user_email, u.phone as user_phone, u.status as user_status,
             dra.status as assignment_status, dra.approved_at, dra.approved_by, dra.application_id, dra.restaurant_id,
             r.name as restaurant_name,
             app.submitted_at as application_submitted_at,
             app.reviewed_at as application_reviewed_at,
             app.rejection_reason as application_rejection_reason,
             app.application_status as original_application_status,
             reviewer.name as reviewer_name
      FROM delivery_drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_restaurant_assignments dra ON dra.driver_id = d.id
      LEFT JOIN restaurants r ON dra.restaurant_id = r.id
      LEFT JOIN rider_applications app ON (dra.application_id = app.id OR app.rider_id = d.id)
      LEFT JOIN users reviewer ON dra.approved_by = reviewer.id
      WHERE d.id = ?
    `;

    const drivers = await query(sql, [id]);
    if (!drivers || drivers.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    const driver = drivers[0];

    // Enforce restaurant access check if not super admin
    if (!req.isSuperAdmin && driver.restaurant_id) {
      if (!validateRestaurantAccess(driver.restaurant_id, req)) {
        return res.status(403).json({ success: false, message: 'Access denied to this driver profile.' });
      }
    }

    // Fetch driver documents
    const documents = await query(
      `SELECT id, application_id, rider_id, document_type, original_file_name, mime_type, file_size, verification_status, verified_by, verified_at, created_at
       FROM rider_documents
       WHERE rider_id = ? OR (application_id IS NOT NULL AND application_id = ?)
       ORDER BY id ASC`,
      [driver.id, driver.application_id || 0]
    );

    // Fetch delivery statistics for this driver
    let stats = { total_assigned: 0, total_delivered: 0, total_failed: 0, active_deliveries: 0 };
    try {
      const statsRows = await query(
        `SELECT 
           COUNT(*) as total_assigned,
           COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as total_delivered,
           COALESCE(SUM(CASE WHEN order_status = 'DELIVERY_FAILED' THEN 1 ELSE 0 END), 0) as total_failed,
           COALESCE(SUM(CASE WHEN order_status IN ('ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY') THEN 1 ELSE 0 END), 0) as active_deliveries
         FROM orders
         WHERE assigned_driver_id = ?`,
        [driver.id]
      );
      if (statsRows && statsRows.length > 0) {
        stats = {
          total_assigned: Number(statsRows[0].total_assigned || 0),
          total_delivered: Number(statsRows[0].total_delivered || 0),
          total_failed: Number(statsRows[0].total_failed || 0),
          active_deliveries: Number(statsRows[0].active_deliveries || 0)
        };
      }
    } catch (e) {
      console.error('Stats fetch error:', e.message);
    }

    res.json({
      success: true,
      driver: {
        ...driver,
        documents,
        stats
      }
    });

  } catch (err) {
    console.error('getAdminDriverById Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving driver details.' });
  }
}

/**
 * 15. ADMIN: Update Driver Account Status (ACTIVE, SUSPENDED, DEACTIVATED)
 */
async function updateDriverStatus(req, res) {
  try {
    const { id } = req.params; // driver id
    const { account_status, is_active } = req.body;

    const [driver] = await query('SELECT * FROM delivery_drivers WHERE id = ?', [id]);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    const newStatus = account_status || (is_active ? 'ACTIVE' : 'SUSPENDED');

    await query(
      `UPDATE delivery_drivers SET account_status = ?, is_active = ? WHERE id = ?`,
      [newStatus, newStatus === 'ACTIVE' ? 1 : 0, id]
    );

    await query(
      `UPDATE users SET status = ? WHERE id = ?`,
      [newStatus === 'ACTIVE' ? 'ACTIVE' : 'DISABLED', driver.user_id]
    );

    res.json({ success: true, message: `Driver status updated to ${newStatus}.` });
  } catch (err) {
    console.error('updateDriverStatus Error:', err);
    res.status(500).json({ success: false, message: 'Server error updating driver status.' });
  }
}

/**
 * 16. DRIVER: Get Available Restaurants (for Multi-Store Handling)
 */
async function getAvailableRestaurants(req, res) {
  try {
    const driver = await getOrCreateDriverProfile(req);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    const driverEmail = driver.email || req.user?.email || '';
    const driverMobile = driver.mobile || req.user?.phone || '';

    const restaurants = await query(
      `SELECT r.id, r.name, r.slug, r.logo_url, r.cover_url, r.phone, r.email,
              r.address, r.city, r.area, r.opening_time, r.closing_time,
              r.status, r.accepts_rider_applications,
              dra.status as assignment_status,
              (SELECT application_status FROM rider_applications
               WHERE restaurant_id = r.id AND (rider_id = ? OR email = ? OR (mobile = ? AND ? != ''))
               ORDER BY id DESC LIMIT 1) as application_status
       FROM restaurants r
       LEFT JOIN driver_restaurant_assignments dra ON dra.restaurant_id = r.id AND dra.driver_id = ?
       WHERE r.status = 'ACTIVE' AND (r.accepts_rider_applications = 1 OR r.accepts_rider_applications IS NULL)
       ORDER BY (dra.status = 'ACTIVE') DESC, r.name ASC`,
      [driver.id, driverEmail, driverMobile, driverMobile, driver.id]
    );

    res.json({
      success: true,
      count: restaurants.length,
      restaurants: restaurants.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        logoUrl: r.logo_url,
        coverUrl: r.cover_url,
        phone: r.phone,
        email: r.email,
        address: r.address,
        city: r.city,
        area: r.area,
        openingTime: r.opening_time,
        closingTime: r.closing_time,
        isAssigned: r.assignment_status === 'ACTIVE',
        assignmentStatus: r.assignment_status || null,
        applicationStatus: r.application_status || null
      }))
    });
  } catch (err) {
    console.error('getAvailableRestaurants Error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching available restaurants.' });
  }
}

/**
 * 17. DRIVER: Apply to / Connect with Restaurant (Instant 1-Click for Active Verified Riders)
 */
async function applyToRestaurant(req, res) {
      try {
        const userId = req.user.id;
        const { restaurantId } = req.body;

        if (!restaurantId) {
          return res.status(400).json({ success: false, message: 'Restaurant ID is required.' });
        }

        const driver = await getOrCreateDriverProfile(req);
        if (!driver) {
          return res.status(404).json({ success: false, message: 'Driver profile not found.' });
        }

        const driverMobile = driver.mobile || req.user.phone || '+91 9876543210';
        const driverEmail = driver.email || req.user.email || 'driver@hotel.com';
        const driverName = driver.full_name || req.user.name || 'Delivery Driver';

        const [restaurant] = await query(
          'SELECT id, name, status, accepts_rider_applications FROM restaurants WHERE id = ?',
          [restaurantId]
        );
        if (!restaurant) {
          return res.status(404).json({ success: false, message: 'Restaurant not found.' });
        }
        if (restaurant.status !== 'ACTIVE') {
          return res.status(400).json({ success: false, message: 'This restaurant is not currently active.' });
        }

        // Check if already assigned
        const [existingAssignment] = await query(
          'SELECT id, status FROM driver_restaurant_assignments WHERE driver_id = ? AND restaurant_id = ?',
          [driver.id, restaurantId]
        );
        if (existingAssignment && existingAssignment.status === 'ACTIVE') {
          return res.status(400).json({ success: false, message: `You are already an active delivery partner for ${restaurant.name}.` });
        }

        // If driver is already verified & approved, immediately activate assignment
        const isApprovedDriver = (driver.approval_status === 'APPROVED' && driver.account_status === 'ACTIVE');

        if (isApprovedDriver) {
          await query(
            `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, status, approved_at)
         VALUES (?, ?, 'ACTIVE', NOW())
         ON DUPLICATE KEY UPDATE status = 'ACTIVE', approved_at = NOW()`,
            [driver.id, restaurantId]
          );

          await query(
            `INSERT INTO rider_applications (
          rider_id, restaurant_id, full_name, mobile, email,
          home_city, current_city, current_address, emergency_contact,
          vehicle_type, vehicle_number, application_status, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', NOW())
        ON DUPLICATE KEY UPDATE application_status = 'APPROVED', reviewed_at = NOW()`,
            [
              driver.id, restaurantId,
              driverName, driverMobile, driverEmail,
              driver.home_city || 'Hubballi', driver.current_city || 'Hubballi', driver.current_address || 'Registered Address',
              driver.emergency_contact || '+91 9876543210',
              driver.vehicle_type || 'Bike', driver.vehicle_number || 'KA-25-TEMP'
            ]
          );

          return res.status(200).json({
            success: true,
            message: `🎉 Connected to ${restaurant.name}! You can now receive and claim orders from this restaurant.`,
            restaurantName: restaurant.name
          });
        }

        // Check if pending application exists
        const [existingApp] = await query(
          `SELECT id, application_status FROM rider_applications
       WHERE restaurant_id = ? AND (rider_id = ? OR email = ? OR mobile = ?) AND application_status IN ('PENDING', 'UNDER_REVIEW')`,
          [restaurantId, driver.id, driverEmail, driverMobile]
        );
        if (existingApp) {
          return res.status(400).json({ success: false, message: 'You already have a pending application for this restaurant.' });
        }

        const conn = await getConnection();
        try {
          await conn.beginTransaction();

          const [appRes] = await conn.query(
            `INSERT INTO rider_applications (
          rider_id, restaurant_id, full_name, mobile, email, date_of_birth,
          home_city, current_city, current_address, emergency_contact,
          vehicle_type, vehicle_number, application_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [
              driver.id, restaurantId,
              driverName,
              driverMobile,
              driverEmail,
              driver.date_of_birth || null,
              driver.home_city || 'Hubballi',
              driver.current_city || 'Hubballi',
              driver.current_address || 'Registered Address',
              driver.emergency_contact || '+91 9876543210',
              driver.vehicle_type || 'Bike',
              driver.vehicle_number || 'KA-25-TEMP'
            ]
          );

          const applicationId = appRes.insertId;

          await conn.commit();

          await sendNotification({
            restaurantId,
            title: 'New Delivery Partner Application! 🛵',
            message: `${driver.full_name || 'A delivery partner'} applied to deliver for your restaurant.`,
            type: 'RIDER_APPLICATION'
          });

          res.status(201).json({
            success: true,
            message: `Successfully applied to ${restaurant.name}! Your application has been submitted to the restaurant admin for review.`,
            applicationId,
            restaurantName: restaurant.name
          });
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
      } catch (err) {
        console.error('applyToRestaurant Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Server error submitting application.' });
      }
    }

    /**
     * 17b. DRIVER: Connect All Active Restaurants (1-Click Multi-Store Coverage)
     */
    async function connectAllRestaurants(req, res) {
      try {
        const driver = await getOrCreateDriverProfile(req);
        if (!driver) {
          return res.status(404).json({ success: false, message: 'Driver profile not found.' });
        }

        const activeRestaurants = await query(
          "SELECT id, name FROM restaurants WHERE status = 'ACTIVE'"
        );

        for (const rest of activeRestaurants) {
          await query(
            `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, status, approved_at)
         VALUES (?, ?, 'ACTIVE', NOW())
         ON DUPLICATE KEY UPDATE status = 'ACTIVE', approved_at = NOW()`,
            [driver.id, rest.id]
          );
        }

        res.json({
          success: true,
          message: `🎉 Successfully connected to all ${activeRestaurants.length} restaurants! You can now accept orders from all stores.`,
          count: activeRestaurants.length
        });
      } catch (err) {
        console.error('connectAllRestaurants Error:', err);
        res.status(500).json({ success: false, message: 'Server error connecting all restaurants.' });
      }
    }

    /**
     * 18. DRIVER: Available Orders Pool (Unassigned Orders Across All Assigned Stores)
     */
    async function getAvailableOrdersPool(req, res) {
      try {
        const driver = await getOrCreateDriverProfile(req);
        if (!driver) {
          return res.status(404).json({ success: false, message: 'Driver profile not found.' });
        }

        if (driver.account_status !== 'ACTIVE') {
          return res.json({ success: true, count: 0, orders: [] });
        }

        // Get assigned restaurant IDs
        const assignments = await query(
          'SELECT restaurant_id FROM driver_restaurant_assignments WHERE driver_id = ? AND status = "ACTIVE"',
          [driver.id]
        );

        let restIds = assignments.map(a => a.restaurant_id);

        // If specific restaurant filter is requested
        if (req.query.restaurant_id) {
          const filterId = parseInt(req.query.restaurant_id);
          restIds = restIds.filter(id => id === filterId);
        }

        if (restIds.length === 0) {
          return res.json({ success: true, count: 0, orders: [] });
        }

        const placeholders = restIds.map(() => '?').join(',');

        const orders = await query(
          `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address,
              r.phone as restaurant_phone, r.latitude as restaurant_latitude, r.longitude as restaurant_longitude
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.restaurant_id IN (${placeholders})
         AND (o.assigned_driver_id IS NULL OR o.assigned_driver_id = ?)
         AND o.order_status NOT IN ('DELIVERED', 'CANCELLED', 'REJECTED')
         AND o.created_at >= NOW() - INTERVAL 48 HOUR
       ORDER BY o.created_at DESC`,
          [...restIds, driver.id]
        );

        for (let order of orders) {
          order.items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
        }

        res.json({
          success: true,
          count: orders.length,
          orders
        });
      } catch (err) {
        console.error('getAvailableOrdersPool Error:', err);
        res.status(500).json({ success: false, message: 'Server error retrieving available orders pool.' });
      }
    }

    /**
     * 19. DRIVER: Instant Atomic Claim Order (FCFS Millisecond Race Protection)
     */
    async function claimOrder(req, res) {
      try {
        const { id } = req.params;
        const userId = req.user.id;

        const driver = await getOrCreateDriverProfile(req);
        if (!driver) {
          return res.status(404).json({ success: false, message: 'Driver profile not found.' });
        }

        if (driver.account_status !== 'ACTIVE') {
          return res.status(403).json({ success: false, message: 'Your driver account is not active.' });
        }

        const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
        if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        // Auto-ensure driver is linked to restaurant
        const [assignment] = await query(
          'SELECT id FROM driver_restaurant_assignments WHERE driver_id = ? AND restaurant_id = ? AND status = "ACTIVE"',
          [driver.id, order.restaurant_id]
        );
        if (!assignment) {
          await query(
            `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, status, approved_at)
         VALUES (?, ?, 'ACTIVE', NOW())
         ON DUPLICATE KEY UPDATE status = 'ACTIVE', approved_at = NOW()`,
            [driver.id, order.restaurant_id]
          );
        }

        // Atomic millisecond update
        const result = await query(
          `UPDATE orders
       SET assigned_driver_id = ?, order_status = 'DRIVER_ACCEPTED'
       WHERE id = ?
         AND (assigned_driver_id IS NULL OR assigned_driver_id = ?)
         AND order_status NOT IN ('DELIVERED', 'CANCELLED', 'REJECTED')`,
          [driver.id, id, driver.id]
        );

        if (result.affectedRows === 0) {
          return res.status(409).json({
            success: false,
            message: '⚡ This order was just claimed by another rider or has already been fulfilled.'
          });
        }

        await query('UPDATE delivery_drivers SET availability_status = "BUSY" WHERE id = ?', [driver.id]);

        await query(
          `INSERT INTO order_status_history (order_id, status, notes, changed_by_user_id)
       VALUES (?, 'DRIVER_ACCEPTED', ?, ?)`,
          [id, `Driver ${driver.full_name || 'Rider'} claimed the order for delivery.`, userId]
        );

        // Notify customer
        await sendNotification({
          orderId: id,
          customerIdentityId: order.customer_identity_id,
          title: 'Delivery Partner Heading to Restaurant! 🛵',
          message: `${driver.full_name || 'A delivery partner'} has claimed your order and is heading to pick it up.`
        });

        // Notify restaurant
        await sendNotification({
          restaurantId: order.restaurant_id,
          orderId: id,
          title: 'Order Claimed by Rider 🛵',
          message: `Order #${order.order_number} claimed by rider ${driver.full_name || 'Rider'}.`
        });

        res.json({
          success: true,
          message: '🎉 Order claimed successfully! Heading to restaurant for pickup.',
          orderId: id
        });
      } catch (err) {
        console.error('claimOrder Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Server error claiming order.' });
      }
    }

    module.exports = {
      driverLogin,
      getDriverProfile,
      updateDriverProfile,
      goOnline,
      goOffline,
      updateDriverLocation,
      getDriverOrders,
      getAvailableOrdersPool,
      claimOrder,
      acceptOrder,
      declineOrder,
      pickupOrder,
      startDelivery,
      deliverOrder,
      markDeliveryFailed,
      getAdminDrivers,
      createAdminDriver,
      getAdminDriverById,
      updateDriverStatus,
      getAvailableRestaurants,
      applyToRestaurant,
      connectAllRestaurants
    };
