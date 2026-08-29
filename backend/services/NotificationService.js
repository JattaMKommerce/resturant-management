const { query } = require('../config/db');
const pushNotificationService = require('./pushNotificationService');

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
async function sendNotification({ userId, restaurantId, orderId, customerIdentityId, title, message, type = 'ORDER_UPDATE', status, extraData = {} }) {
  try {
    const upperType = String(type || '').toUpperCase();
    const isNewOrder = upperType.includes('NEW_ORDER') || upperType.includes('ORDER_CREATED') || upperType === 'NEW_TABLE_ORDER';

    // Only insert into DB for new orders or direct user targeted alerts
    let insertRes = null;
    if (isNewOrder || userId) {
      insertRes = await query(
        `INSERT INTO notifications (user_id, restaurant_id, order_id, customer_identity_id, title, message, type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId || null, isNewOrder ? restaurantId || null : null, orderId || null, customerIdentityId || null, title, message, type]
      );
    }

    const notificationData = {
      id: insertRes ? insertRes.insertId : Date.now(),
      userId, restaurantId, orderId, customerIdentityId,
      title, message, type, status,
      is_read: 0,
      created_at: new Date()
    };

    if (ioInstance) {
      // 1. Send status update ONLY to customer order room (customer live tracking)
      if (orderId) {
        ioInstance.to(`order_${orderId}`).emit('notification', notificationData);
        ioInstance.to(`order_${orderId}`).emit('order_update', notificationData);
        ioInstance.to(`order_${orderId}`).emit('order_status_updated', notificationData);
      }
      // 2. Send to specific user room if applicable
      if (userId) {
        ioInstance.to(`user_${userId}`).emit('notification', notificationData);
      }

      // 3. Admin ONLY gets alerted when a NEW order arrives
      if (isNewOrder) {
        if (restaurantId) {
          ioInstance.to(`restaurant_admin_${restaurantId}`).emit('admin_notification', notificationData);
          ioInstance.to(`restaurant_admin_${restaurantId}`).emit('new_order', notificationData);
        }
        ioInstance.to('admin_room').emit('admin_notification', notificationData);
        ioInstance.to('admin_room').emit('new_order', notificationData);
      } else {
        // Send order status sync to admin table view without triggering toast/bell popup
        if (restaurantId) {
          ioInstance.to(`restaurant_admin_${restaurantId}`).emit('order_status_updated', notificationData);
        }
        ioInstance.to('admin_room').emit('order_status_updated', notificationData);
      }
    }

    // 4. Trigger Web Push Notification directly to customer device
    if (orderId) {
      const targetStatus = status || type;
      pushNotificationService.sendPushForOrder(orderId, targetStatus, extraData).catch(err => {
        console.warn('Web push notification dispatch notice:', err.message);
      });
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
