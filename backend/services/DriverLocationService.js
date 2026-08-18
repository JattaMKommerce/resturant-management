const { query } = require('../config/db');

let ioInstance = null;

function setSocketIOInstance(io) {
  ioInstance = io;
}

/**
 * Single Canonical Location Update Pipeline
 * Handles location validation, DB updates, limited location history logging, and Socket.IO broadcast.
 * 
 * @param {Object} params
 * @param {number} params.userId - Authenticated user ID (must be DRIVER role)
 * @param {number} params.latitude - Current GPS latitude
 * @param {number} params.longitude - Current GPS longitude
 * @param {number} [params.orderId] - Optional specific order ID being delivered
 */
async function processDriverLocationUpdate({ userId, latitude, longitude, orderId = null }) {
  if (!userId) {
    throw new Error('Authentication required for location updates.');
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid GPS coordinates provided.');
  }

  // 1. Verify Driver profile & active account status
  let [driver] = await query('SELECT * FROM delivery_drivers WHERE user_id = ?', [userId]);
  if (!driver) {
    const [dByEmail] = await query(
      `SELECT d.* FROM delivery_drivers d JOIN users u ON (u.email = d.email OR u.phone = d.mobile) WHERE u.id = ?`,
      [userId]
    );
    if (dByEmail) {
      await query('UPDATE delivery_drivers SET user_id = ? WHERE id = ?', [userId, dByEmail.id]);
      driver = dByEmail;
    } else {
      const [user] = await query('SELECT * FROM users WHERE id = ?', [userId]);
      if (user) {
        const [ins] = await query(
          `INSERT INTO delivery_drivers (user_id, full_name, email, mobile, vehicle_type, vehicle_number, approval_status, account_status, availability_status)
           VALUES (?, ?, ?, ?, 'Bike', 'KA-25-TEMP', 'APPROVED', 'ACTIVE', 'OFFLINE')`,
          [userId, user.name || 'Delivery Partner', user.email || 'driver@hotel.com', user.phone || '+91 9999999999']
        );
        const [newDriver] = await query('SELECT * FROM delivery_drivers WHERE id = ?', [ins.insertId]);
        driver = newDriver;
      }
    }
  }

  if (!driver) {
    return { success: false, message: 'Driver profile not found.' };
  }

  if (driver.account_status !== 'ACTIVE') {
    return { success: false, message: `Driver account is ${driver.account_status}.` };
  }

  // 2. If OFFLINE, update cached coordinates quietly without live stream error
  if (driver.availability_status === 'OFFLINE') {
    await query('UPDATE delivery_drivers SET current_latitude = ?, current_longitude = ?, last_location_at = NOW() WHERE id = ?', [lat, lng, driver.id]);
    return { success: true, message: 'Location saved (OFFLINE mode).' };
  }

  // 3. Find active deliveries in progress (ASSIGNED_TO_DRIVER, DRIVER_ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY)
  let activeOrders = await query(
    `SELECT o.id, o.restaurant_id, o.order_status, o.order_number
     FROM orders o
     WHERE o.assigned_driver_id = ?
       AND o.order_status IN ('ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY')`,
    [driver.id]
  );

  // If specific orderId requested, verify driver is assigned to it
  if (orderId) {
    const matched = activeOrders.find(o => o.id === parseInt(orderId));
    if (!matched) {
      // Check if order exists but driver is not assigned
      const [ord] = await query('SELECT assigned_driver_id, order_status FROM orders WHERE id = ?', [orderId]);
      if (!ord || ord.assigned_driver_id !== driver.id) {
        throw new Error('Driver is not authorized to stream location for this order.');
      }
    }
  }

  const now = new Date();

  // 4. Update delivery_drivers table with current location
  await query(
    `UPDATE delivery_drivers
     SET current_latitude = ?, current_longitude = ?, last_location_at = ?
     WHERE id = ?`,
    [lat, lng, now, driver.id]
  );

  // 5. Store limited location history if there's an active delivery
  const deliveringOrder = activeOrders.find(o => o.order_status === 'OUT_FOR_DELIVERY') || activeOrders[0];
  if (deliveringOrder) {
    await query(
      `INSERT INTO driver_location_history (driver_id, order_id, latitude, longitude, recorded_at)
       VALUES (?, ?, ?, ?, ?)`,
      [driver.id, deliveringOrder.id, lat, lng, now]
    );

    // Keep only last 100 entries per active order to limit table bloat
    await query(
      `DELETE FROM driver_location_history
       WHERE order_id = ? AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM driver_location_history WHERE order_id = ? ORDER BY id DESC LIMIT 100
         ) t
       )`,
      [deliveringOrder.id, deliveringOrder.id]
    ).catch(() => {}); // non-blocking cleanup
  }

  // 6. Broadcast via Socket.IO
  const payload = {
    driverId: driver.id,
    driverName: driver.full_name || 'Delivery Partner',
    vehicleNumber: driver.vehicle_number,
    latitude: lat,
    longitude: lng,
    lastLocationAt: now,
    activeOrdersCount: activeOrders.length
  };

  if (ioInstance) {
    // Broadcast to specific order rooms
    activeOrders.forEach(o => {
      ioInstance.to(`order_${o.id}`).emit('driver_location_stream', {
        ...payload,
        orderId: o.id,
        orderStatus: o.order_status
      });

      // Also broadcast to restaurant admin room
      if (o.restaurant_id) {
        ioInstance.to(`restaurant_admin_${o.restaurant_id}`).emit('driver_location_stream', {
          ...payload,
          orderId: o.id,
          orderStatus: o.order_status
        });
      }
    });

    // Broadcast to driver's own room
    ioInstance.to(`driver_${driver.id}`).emit('driver_location_ack', payload);
  }

  return {
    success: true,
    driverId: driver.id,
    latitude: lat,
    longitude: lng,
    activeDeliveries: activeOrders.length,
    lastLocationAt: now
  };
}

module.exports = {
  setSocketIOInstance,
  processDriverLocationUpdate
};
