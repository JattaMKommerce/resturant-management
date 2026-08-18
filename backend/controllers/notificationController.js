const { query } = require('../config/db');

async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const notifications = await query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
      [userId]
    );

    res.json({ success: true, count: notifications.length, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error retrieving notifications.' });
  }
}

async function markNotificationRead(req, res) {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating notification.' });
  }
}

module.exports = {
  getNotifications,
  markNotificationRead
};
