const { query } = require('../config/db');

async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const restaurantId = req.user.restaurant_id || req.adminRestaurantId || null;

    let queryStr = 'SELECT * FROM notifications WHERE ';
    let params = [];

    if (restaurantId) {
      queryStr += '(restaurant_id = ? OR user_id = ?) ';
      params.push(restaurantId, userId);
    } else {
      queryStr += 'user_id = ? ';
      params.push(userId);
    }

    queryStr += 'ORDER BY created_at DESC LIMIT 40';

    const notifications = await query(queryStr, params);

    // Calculate unread count
    let unreadCount = 0;
    if (restaurantId) {
      const [countRes] = await query(
        'SELECT COUNT(*) as count FROM notifications WHERE (restaurant_id = ? OR user_id = ?) AND is_read = 0',
        [restaurantId, userId]
      );
      unreadCount = countRes?.count || 0;
    } else {
      const [countRes] = await query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      unreadCount = countRes?.count || 0;
    }

    res.json({ success: true, count: notifications.length, unread_count: unreadCount, notifications });
  } catch (err) {
    console.error('Error retrieving notifications:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving notifications.' });
  }
}

async function markNotificationRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const restaurantId = req.user.restaurant_id || req.adminRestaurantId || null;

    if (restaurantId) {
      await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND (restaurant_id = ? OR user_id = ?)', [id, restaurantId, userId]);
    } else {
      await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    }
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating notification.' });
  }
}

async function markAllNotificationsRead(req, res) {
  try {
    const userId = req.user.id;
    const restaurantId = req.user.restaurant_id || req.adminRestaurantId || null;

    if (restaurantId) {
      await query('UPDATE notifications SET is_read = 1 WHERE (restaurant_id = ? OR user_id = ?) AND is_read = 0', [restaurantId, userId]);
    } else {
      await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
    }
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating notifications.' });
  }
}

async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const restaurantId = req.user.restaurant_id || req.adminRestaurantId || null;

    if (restaurantId) {
      await query('DELETE FROM notifications WHERE id = ? AND (restaurant_id = ? OR user_id = ?)', [id, restaurantId, userId]);
    } else {
      await query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
    }
    res.json({ success: true, message: 'Notification removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting notification.' });
  }
}

async function clearAllNotifications(req, res) {
  try {
    const userId = req.user.id;
    const restaurantId = req.user.restaurant_id || req.adminRestaurantId || null;

    if (restaurantId) {
      await query('DELETE FROM notifications WHERE restaurant_id = ? OR user_id = ?', [restaurantId, userId]);
    } else {
      await query('DELETE FROM notifications WHERE user_id = ?', [userId]);
    }
    res.json({ success: true, message: 'All notifications cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error clearing notifications.' });
  }
}

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications
};
