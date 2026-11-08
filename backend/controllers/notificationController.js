const { query } = require('../config/db');

/**
 * The restaurant whose alerts this user sees in the bell. Sign-in tokens don't carry a
 * restaurant, so look up the user's own restaurants (owner, admin or staff link) and use the
 * branch they are working on (branch switcher / admin URL), else their primary one.
 * Customers have no restaurant: they only see notifications addressed to them.
 */
async function restaurantForBell(req) {
  if (req.user.restaurant_id) return req.user.restaurant_id;
  if (req.adminRestaurantId) return req.adminRestaurantId;
  const uid = req.user.id;
  const links = await query(
    `SELECT restaurant_id, MAX(p) AS p FROM (
       SELECT restaurant_id, is_primary AS p FROM restaurant_admins WHERE user_id = ?
       UNION ALL SELECT id, 1 FROM restaurants WHERE admin_user_id = ?
     ) x GROUP BY restaurant_id ORDER BY p DESC, restaurant_id ASC`,
    [uid, uid]
  ).catch(() => []);
  if (!links.length) return null;
  const ids = links.map((l) => Number(l.restaurant_id));
  const branch = parseInt(req.headers['x-branch-id'], 10);
  if (branch && ids.includes(branch)) return branch;
  const slug = req.headers['x-restaurant-slug'];
  if (slug) {
    const rows = await query('SELECT id FROM restaurants WHERE slug = ? OR custom_subdomain_slug = ? LIMIT 1', [slug, slug]).catch(() => []);
    if (rows.length && ids.includes(Number(rows[0].id))) return Number(rows[0].id);
  }
  return ids[0];
}

async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const restaurantId = await restaurantForBell(req);

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
    const restaurantId = await restaurantForBell(req);

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
    const restaurantId = await restaurantForBell(req);

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
    const restaurantId = await restaurantForBell(req);

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
    const restaurantId = await restaurantForBell(req);

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
