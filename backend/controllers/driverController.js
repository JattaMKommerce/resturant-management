const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getConnection, query } = require('../config/db');
const OrderService = require('../services/OrderService');
const { processDriverLocationUpdate } = require('../services/DriverLocationService');
const { sendNotification } = require('../services/NotificationService');
const { validateRestaurantAccess } = require('../middleware/auth');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026';

function toDataUrl(data, defaultMime = 'image/jpeg') {
  if (!data) return null;
  if (typeof data === 'string') {
    if (data.startsWith('http') || data.startsWith('data:') || data.startsWith('/')) return data;
    return `data:${defaultMime};base64,${data}`;
  }
  if (Buffer.isBuffer(data)) {
    return `data:${defaultMime};base64,${data.toString('base64')}`;
  }
  return null;
}

function computeKycDetails(drv) {
  if (!drv) {
    return {
      kyc_status: 'PENDING',
      missing_documents: ['Profile Photo', 'Driving License', 'Aadhaar Card'],
      has_selfie: false,
      has_license: false,
      has_aadhaar: false,
      selfie_url: null,
      license_url: null,
      aadhaar_url: null
    };
  }

  const hasSelfie = !!(drv.selfie_path || (drv.selfie_data && drv.selfie_data.length > 0));
  const hasLicense = !!(drv.license_path || (drv.license_data && drv.license_data.length > 0) || (drv.license_number && drv.license_number.trim().length > 3));
  const hasAadhaar = !!(drv.aadhaar_path || (drv.aadhaar_data && drv.aadhaar_data.length > 0));

  const missing = [];
  if (!hasSelfie) missing.push('Profile Photo');
  if (!hasLicense) missing.push('Driving License');
  if (!hasAadhaar) missing.push('Aadhaar Card');

  let kycStatus = 'PENDING';
  if (missing.length === 0) {
    kycStatus = 'VERIFIED';
  } else if (missing.length < 3) {
    kycStatus = 'PARTIAL';
  }

  return {
    kyc_status: kycStatus,
    missing_documents: missing,
    has_selfie: hasSelfie,
    has_license: hasLicense,
    has_aadhaar: hasAadhaar,
    selfie_url: drv.selfie_path || toDataUrl(drv.selfie_data),
    license_url: drv.license_path || toDataUrl(drv.license_data),
    aadhaar_url: drv.aadhaar_path || toDataUrl(drv.aadhaar_data)
  };
}

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
       LEFT JOIN driver_restaurant_assignments dra ON dra.restaurant_id = r.id AND dra.driver_id = ?
       WHERE (dra.status = 'ACTIVE' OR r.id = ?)
       LIMIT 1`,
      [driver.id, driver.restaurant_id || 7]
    );

    const [orderStats] = await query(
      `SELECT 
         COUNT(CASE WHEN order_status = 'DELIVERED' THEN 1 END) as delivered_count,
         COUNT(CASE WHEN order_status = 'DELIVERED' AND DATE(created_at) = CURDATE() THEN 1 END) as today_delivered_count
       FROM orders WHERE assigned_driver_id = ?`,
      [driver.id]
    );

    const kyc = computeKycDetails(driver);

    // Get exclusive restaurant
    let restaurant = assignedRestaurants.length > 0 ? assignedRestaurants[0] : null;
    if (!restaurant && driver.restaurant_id) {
      const [rest] = await query('SELECT id, name, slug, logo_url, phone, address FROM restaurants WHERE id = ?', [driver.restaurant_id]);
      restaurant = rest || null;
    }

    // Strip raw massive buffers from response
    delete driver.selfie_data;
    delete driver.license_data;
    delete driver.aadhaar_data;

    res.json({
      success: true,
      driver: {
        ...driver,
        ...kyc,
        delivered_orders_count: Number(orderStats?.delivered_count || 0),
        today_delivered_count: Number(orderStats?.today_delivered_count || 0)
      },
      restaurant,
      assignedRestaurants
    });
  } catch (err) {
    console.error('getDriverProfile Error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
}

/**
 * 2b. DRIVER UPLOAD DOCUMENTS (Photo, License, Aadhaar)
 */
async function uploadDriverDocuments(req, res) {
  try {
    const driver = await getOrCreateDriverProfile(req);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    const { selfie, license, aadhaar, license_number, vehicle_number, emergency_contact } = req.body;

    const updates = [];
    const params = [];

    if (selfie) {
      updates.push('selfie_data = ?');
      params.push(selfie);
    }
    if (license) {
      updates.push('license_data = ?');
      params.push(license);
    }
    if (aadhaar) {
      updates.push('aadhaar_data = ?');
      params.push(aadhaar);
    }
    if (license_number) {
      updates.push('license_number = ?');
      params.push(license_number.trim());
    }
    if (vehicle_number) {
      updates.push('vehicle_number = ?');
      params.push(vehicle_number.trim());
    }
    if (emergency_contact) {
      updates.push('emergency_contact = ?');
      params.push(emergency_contact.trim());
    }

    if (updates.length > 0) {
      const sql = `UPDATE delivery_drivers SET ${updates.join(', ')} WHERE id = ?`;
      params.push(driver.id);
      await query(sql, params);
    }

    // Refresh driver record and calculate KYC status
    const [updated] = await query('SELECT * FROM delivery_drivers WHERE id = ?', [driver.id]);
    const kyc = computeKycDetails(updated);
    await query('UPDATE delivery_drivers SET kyc_status = ? WHERE id = ?', [kyc.kyc_status, driver.id]);

    // Send notification to restaurant admin
    const restId = updated.restaurant_id || 7;
    try {
      await sendNotification({
        restaurantId: restId,
        title: 'Driver KYC Documents Uploaded 🪪',
        message: `${updated.full_name || 'Driver'} submitted KYC documents. Status: ${kyc.kyc_status}.`
      });
    } catch (e) { }

    delete updated.selfie_data;
    delete updated.license_data;
    delete updated.aadhaar_data;

    res.json({
      success: true,
      message: 'KYC documents updated successfully!',
      kyc_status: kyc.kyc_status,
      missing_documents: kyc.missing_documents,
      driver: {
        ...updated,
        ...kyc
      }
    });
  } catch (err) {
    console.error('uploadDriverDocuments Error:', err);
    res.status(500).json({ success: false, message: 'Server error uploading documents.' });
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
 * 14. ADMIN: Get Drivers List (Restaurant-Isolated with Strict Scoping & KYC Tracking)
 */
async function getAdminDrivers(req, res) {
  try {
    const { availability, accountStatus, search, restaurant_id } = req.query;
    const targetRestId = restaurant_id || req.adminRestaurantId || (req.adminRestaurantIds && req.adminRestaurantIds[0]) || (req.user?.restaurant_id) || 7;

    let sql = `
      SELECT DISTINCT
             d.id,
             d.user_id,
             d.restaurant_id,
             d.vehicle_type,
             d.vehicle_number,
             d.license_number,
             d.selfie_path,
             d.selfie_data,
             d.license_path,
             d.license_data,
             d.aadhaar_path,
             d.aadhaar_data,
             d.kyc_status,
             d.account_status,
             d.availability_status,
             d.approval_status,
             d.current_latitude,
             d.current_longitude,
             d.last_location_at,
             d.created_at,
             d.updated_at,
             COALESCE(NULLIF(d.full_name, ''), u.name, 'Delivery Partner') as full_name,
             COALESCE(NULLIF(d.full_name, ''), u.name, 'Delivery Partner') as name,
             COALESCE(NULLIF(d.email, ''), u.email, '') as email,
             COALESCE(NULLIF(d.email, ''), u.email, '') as user_email,
             COALESCE(NULLIF(d.mobile, ''), u.phone, '') as mobile,
             COALESCE(NULLIF(d.mobile, ''), u.phone, '') as user_phone,
             u.status as user_status,
             COALESCE(d.restaurant_id, dra.restaurant_id) as assigned_restaurant_id
      FROM delivery_drivers d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_restaurant_assignments dra ON dra.driver_id = d.id
    `;
    const params = [];
    const wheres = [];

    if (!req.isSuperAdmin) {
      wheres.push('(d.restaurant_id = ? OR dra.restaurant_id = ?)');
      params.push(targetRestId, targetRestId);
    } else if (restaurant_id) {
      wheres.push('(d.restaurant_id = ? OR dra.restaurant_id = ?)');
      params.push(restaurant_id, restaurant_id);
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
    sql += ` ORDER BY d.id DESC`;

    const rawDrivers = await query(sql, params);
    const seenIds = new Set();
    const drivers = [];

    for (let drv of rawDrivers) {
      if (seenIds.has(drv.id)) continue;
      seenIds.add(drv.id);

      // Compute delivered stats
      const [orderStats] = await query(
        `SELECT 
           COUNT(CASE WHEN order_status = 'DELIVERED' THEN 1 END) as delivered_count,
           COUNT(CASE WHEN order_status = 'DELIVERED' AND DATE(created_at) = CURDATE() THEN 1 END) as today_delivered_count
         FROM orders WHERE assigned_driver_id = ?`,
        [drv.id]
      );
      drv.delivered_orders_count = Number(orderStats?.delivered_count || 0);
      drv.today_delivered_count = Number(orderStats?.today_delivered_count || 0);

      // Fetch active delivery (if any)
      const [activeOrder] = await query(
        `SELECT id, order_number, total_amount, order_status, delivery_address, customer_phone, customer_name, created_at
         FROM orders 
         WHERE assigned_driver_id = ? AND order_status IN ('ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
         ORDER BY id DESC LIMIT 1`,
        [drv.id]
      );
      drv.active_order = activeOrder || null;

      // Compute KYC details
      const kyc = computeKycDetails(drv);
      drv.kyc_status = kyc.kyc_status;
      drv.missing_documents = kyc.missing_documents;
      drv.has_selfie = kyc.has_selfie;
      drv.has_license = kyc.has_license;
      drv.has_aadhaar = kyc.has_aadhaar;
      drv.selfie_url = kyc.selfie_url;
      drv.license_url = kyc.license_url;
      drv.aadhaar_url = kyc.aadhaar_url;

      delete drv.selfie_data;
      delete drv.license_data;
      delete drv.aadhaar_data;

      drivers.push(drv);
    }

    res.json({ success: true, count: drivers.length, drivers });
  } catch (err) {
    console.error('getAdminDrivers Error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving drivers.' });
  }
}

/**
 * 14c. ADMIN: Create Delivery Rider directly (Strictly Linked to Restaurant)
 */
async function createAdminDriver(req, res) {
  try {
    const { name, email, password, phone, vehicle_type, vehicle_number, license_number, restaurant_id } = req.body;

    if (!name || !phone || !vehicle_number) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, and vehicle plate number are required.'
      });
    }

    const driverEmail = email && email.trim() 
      ? email.trim().toLowerCase() 
      : `${phone.trim().replace(/\D/g, '')}@hotel.com`;

    const targetRestId = restaurant_id || req.adminRestaurantId || (req.adminRestaurantIds && req.adminRestaurantIds[0]) || (req.user?.restaurant_id) || 7;

    // Check existing user
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ? OR phone = ?',
      [driverEmail, phone.trim()]
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
        [name.trim(), driverEmail, hash, userPassword, phone.trim()]
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
          restaurant_id = ?,
          full_name = ?, mobile = ?, email = ?,
          vehicle_type = COALESCE(?, vehicle_type), vehicle_number = COALESCE(?, vehicle_number),
          license_number = COALESCE(?, license_number),
          account_status = 'ACTIVE', approval_status = 'APPROVED'
         WHERE id = ?`,
        [
          targetRestId,
          name.trim(), phone.trim(), driverEmail,
          vehicle_type || 'Bike', vehicle_number.trim(),
          license_number || null, driverId
        ]
      );
    } else {
      const driverRes = await query(
        `INSERT INTO delivery_drivers (
          user_id, restaurant_id, full_name, mobile, email,
          vehicle_type, vehicle_number, license_number,
          account_status, availability_status, approval_status, kyc_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'OFFLINE', 'APPROVED', 'PENDING')`,
        [
          userId, targetRestId, name.trim(), phone.trim(), driverEmail,
          vehicle_type || 'Bike', vehicle_number.trim(), license_number || null
        ]
      );
      driverId = driverRes.insertId;
    }

    // Assign to managing restaurant in driver_restaurant_assignments
    await query(
      `INSERT INTO driver_restaurant_assignments (driver_id, restaurant_id, status, approved_at)
       VALUES (?, ?, 'ACTIVE', NOW())
       ON DUPLICATE KEY UPDATE status = 'ACTIVE', approved_at = NOW()`,
      [driverId, targetRestId]
    );

    res.status(201).json({
      success: true,
      message: `Delivery rider "${name}" created successfully.`,
      driver: {
        id: driverId,
        user_id: userId,
        restaurant_id: targetRestId,
        name: name.trim(),
        full_name: name.trim(),
        email: driverEmail,
        phone: phone.trim(),
        vehicle_type: vehicle_type || 'Bike',
        vehicle_number: vehicle_number.trim(),
        license_number: license_number || null,
        account_status: 'ACTIVE',
        availability_status: 'OFFLINE',
        kyc_status: 'PENDING',
        missing_documents: ['Profile Photo', 'Driving License', 'Aadhaar Card'],
        delivered_orders_count: 0,
        today_delivered_count: 0
      }
    });
  } catch (err) {
    console.error('createAdminDriver Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error creating driver.' });
  }
}

/**
 * 14b. ADMIN: Get Driver Details by ID (Restaurant-Isolated with Full KYC & Orders)
 */
async function getAdminDriverById(req, res) {
  try {
    const { id } = req.params;

    let sql = `
      SELECT d.*, u.name as user_name, u.email as user_email, u.phone as user_phone, u.status as user_status,
             r.name as restaurant_name
      FROM delivery_drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN restaurants r ON d.restaurant_id = r.id
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

    // Compute KYC details
    const kyc = computeKycDetails(driver);

    // Fetch delivery statistics for this driver
    const [statsRows] = await query(
      `SELECT 
         COUNT(*) as total_assigned,
         COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as total_delivered,
         COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0) as today_delivered,
         COALESCE(SUM(CASE WHEN order_status = 'DELIVERY_FAILED' THEN 1 ELSE 0 END), 0) as total_failed,
         COALESCE(SUM(CASE WHEN order_status IN ('ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY') THEN 1 ELSE 0 END), 0) as active_deliveries
       FROM orders
       WHERE assigned_driver_id = ?`,
      [driver.id]
    );

    const stats = {
      total_assigned: Number(statsRows?.total_assigned || 0),
      total_delivered: Number(statsRows?.total_delivered || 0),
      today_delivered: Number(statsRows?.today_delivered || 0),
      total_failed: Number(statsRows?.total_failed || 0),
      active_deliveries: Number(statsRows?.active_deliveries || 0)
    };

    // Active order (if currently out on delivery)
    const [activeOrder] = await query(
      `SELECT o.*, r.name as restaurant_name, r.address as restaurant_address
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.assigned_driver_id = ? AND o.order_status IN ('ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
       ORDER BY o.id DESC LIMIT 1`,
      [driver.id]
    );
    if (activeOrder) {
      activeOrder.items = await query('SELECT * FROM order_items WHERE order_id = ?', [activeOrder.id]);
    }

    // Recent 20 delivered orders
    const recentDeliveries = await query(
      `SELECT o.id, o.order_number, o.total_amount, o.order_status, o.delivery_address, 
              o.customer_name, o.customer_phone, o.payment_method, o.created_at, o.updated_at
       FROM orders o
       WHERE o.assigned_driver_id = ? AND o.order_status = 'DELIVERED'
       ORDER BY o.updated_at DESC LIMIT 20`,
      [driver.id]
    );
    for (let ord of recentDeliveries) {
      ord.items = await query('SELECT item_name, quantity, price FROM order_items WHERE order_id = ?', [ord.id]);
    }

    // Clean sensitive raw BLOBs
    delete driver.selfie_data;
    delete driver.license_data;
    delete driver.aadhaar_data;

    res.json({
      success: true,
      driver: {
        ...driver,
        ...kyc,
        stats,
        active_order: activeOrder || null,
        recent_deliveries: recentDeliveries
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
      uploadDriverDocuments,
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
