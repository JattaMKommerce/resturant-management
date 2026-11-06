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
    // Restaurant alerts that must stay in the notification bell, not only pop up live (REQ-039)
    const isRestaurantAlert = ['LOW_STOCK', 'SOLD_OUT'].includes(upperType);

    // Only insert into DB for new orders, restaurant alerts or direct user targeted alerts.
    // A failed save must never stop the live pop-up below from being sent.
    let insertRes = null;
    if (isNewOrder || isRestaurantAlert || userId) {
      try {
        insertRes = await query(
          `INSERT INTO notifications (user_id, restaurant_id, order_id, customer_identity_id, title, message, type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId || null, (isNewOrder || isRestaurantAlert) ? restaurantId || null : null, orderId || null, customerIdentityId || null, title, message, type]
        );
      } catch (dbErr) {
        console.warn('[Notification] Could not save notification row (live alert still sent):', dbErr.message);
      }
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

      // 3. Restaurant staff alerts are tenant-scoped: ONLY sockets that joined THIS restaurant's
      //    rooms (membership verified in server.js) receive them. Never broadcast to shared
      //    rooms like 'admin' / 'admin_room' or to every socket — those reach other restaurants.
      if (restaurantId) {
        const restaurantRooms = ioInstance.to([
          `restaurant_admin_${restaurantId}`,
          `restaurant_${restaurantId}_admin`,
          `restaurant_${restaurantId}`
        ]);
        if (isNewOrder) {
          restaurantRooms.emit('admin_notification', notificationData);
          restaurantRooms.emit('new_order', notificationData);
        } else {
          restaurantRooms.emit('order_status_updated', notificationData);
        }
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
