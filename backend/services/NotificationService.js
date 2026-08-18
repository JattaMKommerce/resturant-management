const { query } = require('../config/db');

let ioInstance = null;

function setSocketIO(io) {
  ioInstance = io;
}

function getSocketIO() {
  return ioInstance;
}

/**
 * Send notification to user, order room, or restaurant admin room
 */
async function sendNotification({ userId, restaurantId, orderId, customerIdentityId, title, message, type = 'ORDER_UPDATE' }) {
  try {
    const res = await query(
      `INSERT INTO notifications (user_id, restaurant_id, order_id, customer_identity_id, title, message, type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, restaurantId || null, orderId || null, customerIdentityId || null, title, message, type]
    );

    const notificationData = {
      id: res.insertId,
      userId, restaurantId, orderId, customerIdentityId,
      title, message, type,
      is_read: 0,
      created_at: new Date()
    };

    if (ioInstance) {
      // Send to order room (customer tracking)
      if (orderId) {
        ioInstance.to(`order_${orderId}`).emit('notification', notificationData);
        ioInstance.to(`order_${orderId}`).emit('order_update', notificationData);
        ioInstance.to(`order_${orderId}`).emit('order_status_updated', notificationData);
      }
      // Send to user room
      if (userId) {
        ioInstance.to(`user_${userId}`).emit('notification', notificationData);
      }
      // Send to restaurant admin room
      if (restaurantId) {
        ioInstance.to(`restaurant_admin_${restaurantId}`).emit('admin_notification', notificationData);
        ioInstance.to(`restaurant_admin_${restaurantId}`).emit('new_order', notificationData);
        ioInstance.to(`restaurant_admin_${restaurantId}`).emit('order_update', notificationData);
        ioInstance.to(`restaurant_admin_${restaurantId}`).emit('order_status_updated', notificationData);
      }
      // Broadcast to general admin room (backward compat)
      ioInstance.to('admin_room').emit('admin_notification', notificationData);
      ioInstance.to('admin_room').emit('order_update', notificationData);
      ioInstance.to('admin_room').emit('order_status_updated', notificationData);
    }

    return notificationData;
  } catch (err) {
    console.error('Error creating notification:', err.message);
    return null;
  }
}

module.exports = {
  setSocketIO,
  getSocketIO,
  sendNotification
};
