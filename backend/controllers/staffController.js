const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { isUserOnline } = require('../config/socket');

/**
 * Get all staff members (Chefs, Waiters, Managers) assigned to the current restaurant
 */
async function getRestaurantStaff(req, res) {
  try {
    const restaurantId = req.adminRestaurantId || req.user?.restaurant_id || 1;

    const staffRows = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.plain_password, u.created_at, u.updated_at,
              ra.restaurant_id
       FROM users u
       JOIN restaurant_admins ra ON u.id = ra.user_id
       WHERE ra.restaurant_id = ?
         AND u.role IN ('KITCHEN', 'CHEF', 'WAITER', 'MANAGER', 'CASHIER')
       ORDER BY (u.role = 'KITCHEN' OR u.role = 'CHEF') DESC, u.name ASC`,
      [restaurantId]
    );

    // Attach real-time online presence status
    const staffWithPresence = staffRows.map(staff => ({
      ...staff,
      role: staff.role === 'CHEF' ? 'KITCHEN' : staff.role,
      is_online: isUserOnline(staff.id),
      plain_password: staff.plain_password || null
    }));

    return res.json({
      success: true,
      staff: staffWithPresence,
      total: staffWithPresence.length
    });
  } catch (err) {
    console.error('getRestaurantStaff Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch restaurant staff list.' });
  }
}

/**
 * Create a new staff member (Chef / Waiter / Manager) for this restaurant
 */
async function createStaffMember(req, res) {
  try {
    const restaurantId = req.adminRestaurantId || req.user?.restaurant_id || 1;
    let { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email/username, password, and phone number are required.'
      });
    }

    name = String(name).trim();
    email = String(email).trim().toLowerCase();
    phone = String(phone).trim();
    password = String(password).trim();

    // Standardize role
    let normalizedRole = 'KITCHEN';
    if (role === 'WAITER') normalizedRole = 'WAITER';
    else if (role === 'MANAGER') normalizedRole = 'MANAGER';
    else if (role === 'CASHIER') normalizedRole = 'CASHIER';
    else normalizedRole = 'KITCHEN';

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `An account with email/username "${email}" already exists. Please choose a different username/email.`
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await withTransaction(async (conn) => {
      const [userRes] = await conn.query(
        `INSERT INTO users (name, email, password_hash, plain_password, phone, role, status)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [name, email, passwordHash, password, phone, normalizedRole]
      );

      const newUserId = userRes.insertId;

      await conn.query(
        `INSERT INTO restaurant_admins (user_id, restaurant_id, is_primary)
         VALUES (?, ?, 0)`,
        [newUserId, restaurantId]
      );

      return {
        id: newUserId,
        name,
        email,
        phone,
        role: normalizedRole,
        plain_password: password,
        status: 'ACTIVE',
        is_online: false,
        restaurant_id: restaurantId
      };
    });

    return res.status(201).json({
      success: true,
      message: `${normalizedRole === 'KITCHEN' ? 'Chef' : normalizedRole} account created successfully!`,
      staff: result
    });
  } catch (err) {
    console.error('createStaffMember Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create staff account.' });
  }
}

/**
 * Update staff profile / reset password
 */
async function updateStaffMember(req, res) {
  try {
    const restaurantId = req.adminRestaurantId || req.user?.restaurant_id || 1;
    const { id } = req.params;
    let { name, email, phone, role, password, status } = req.body;

    // Verify staff belongs to this restaurant
    const verify = await query(
      `SELECT u.id FROM users u
       JOIN restaurant_admins ra ON u.id = ra.user_id
       WHERE u.id = ? AND ra.restaurant_id = ?`,
      [id, restaurantId]
    );

    if (verify.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff member not found for this restaurant.' });
    }

    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (email) { updates.push('email = ?'); params.push(email.trim().toLowerCase()); }
    if (phone) { updates.push('phone = ?'); params.push(phone.trim()); }
    if (role) {
      let normRole = role === 'WAITER' ? 'WAITER' : (role === 'MANAGER' ? 'MANAGER' : (role === 'CASHIER' ? 'CASHIER' : 'KITCHEN'));
      updates.push('role = ?');
      params.push(normRole);
    }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (password && String(password).trim().length > 0) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      updates.push('password_hash = ?');
      params.push(passwordHash);
      updates.push('plain_password = ?');
      params.push(password.trim());
    }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updatedRows] = await query('SELECT id, name, email, phone, role, status, plain_password FROM users WHERE id = ?', [id]);
    const updated = updatedRows[0];

    return res.json({
      success: true,
      message: 'Staff details updated successfully.',
      staff: { ...updated, is_online: isUserOnline(updated.id) }
    });
  } catch (err) {
    console.error('updateStaffMember Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update staff member.' });
  }
}

/**
 * Toggle staff active/inactive status
 */
async function toggleStaffStatus(req, res) {
  try {
    const restaurantId = req.adminRestaurantId || req.user?.restaurant_id || 1;
    const { id } = req.params;

    const [rows] = await query(
      `SELECT u.id, u.status FROM users u
       JOIN restaurant_admins ra ON u.id = ra.user_id
       WHERE u.id = ? AND ra.restaurant_id = ?`,
      [id, restaurantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const newStatus = rows[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await query('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);

    return res.json({
      success: true,
      message: `Staff account set to ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('toggleStaffStatus Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update staff status.' });
  }
}

/**
 * Delete a staff member from this restaurant
 */
async function deleteStaffMember(req, res) {
  try {
    const restaurantId = req.adminRestaurantId || req.user?.restaurant_id || 1;
    const { id } = req.params;

    await withTransaction(async (conn) => {
      await conn.query('DELETE FROM restaurant_admins WHERE user_id = ? AND restaurant_id = ?', [id, restaurantId]);
      await conn.query('DELETE FROM users WHERE id = ? AND role IN (\'KITCHEN\', \'CHEF\', \'WAITER\', \'CASHIER\')', [id]);
    });

    return res.json({
      success: true,
      message: 'Staff member removed successfully.'
    });
  } catch (err) {
    console.error('deleteStaffMember Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete staff member.' });
  }
}

module.exports = {
  getRestaurantStaff,
  createStaffMember,
  updateStaffMember,
  toggleStaffStatus,
  deleteStaffMember
};
