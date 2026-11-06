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
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.created_at, u.updated_at,
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
      is_online: isUserOnline(staff.id)
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
        `INSERT INTO users (name, email, password_hash, phone, role, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [name, email, passwordHash, phone, normalizedRole]
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
        // Returned once so the admin can share the login details; it is not stored.
        initial_password: password,
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
      updates.push('plain_password = NULL');
    }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (password && String(password).trim().length > 0) {
      // New password set by the admin: end the staff member's existing sessions.
      await require('../utils/authSession').revokeAllSessionsForUser(id);
    }

    const [updatedRows] = await query('SELECT id, name, email, phone, role, status FROM users WHERE id = ?', [id]);
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

    const rows = await query(
      `SELECT u.id, u.status FROM users u
       JOIN restaurant_admins ra ON u.id = ra.user_id
       WHERE u.id = ? AND ra.restaurant_id = ?`,
      [id, restaurantId]
    );

    if (!rows || rows.length === 0) {
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

// ---- Permissions (REQ-029) ---------------------------------------------------------------

async function loadStaffInRestaurant(staffId, restaurantId) {
  const [row] = await query(
    `SELECT u.id, u.name, u.role FROM users u
     JOIN restaurant_admins ra ON ra.user_id = u.id AND ra.restaurant_id = ?
     WHERE u.id = ?`,
    [restaurantId, staffId]
  );
  return row || null;
}

/** GET /admin/staff/:id/permissions */
async function getStaffPermissions(req, res) {
  try {
    const perms = require('../utils/permissions');
    const staff = await loadStaffInRestaurant(req.params.id, req.adminRestaurantId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found for this restaurant.' });
    const role = String(staff.role || '').toUpperCase();
    const eff = await perms.effectivePermissions(staff.id, role, req.adminRestaurantId);
    res.json({
      success: true,
      staff: { id: staff.id, name: staff.name, role },
      editable: !eff.owner,
      permissions: eff.permissions,
      custom: eff.custom,
      role_defaults: perms.ROLE_DEFAULTS[role] || [],
      catalog: perms.PERMISSIONS
    });
  } catch (err) {
    console.error('getStaffPermissions Error:', err);
    res.status(500).json({ success: false, message: 'Could not load permissions.' });
  }
}

/** PUT /admin/staff/:id/permissions { permissions: [...] } or { reset: true } */
async function updateStaffPermissions(req, res) {
  try {
    const perms = require('../utils/permissions');
    const staff = await loadStaffInRestaurant(req.params.id, req.adminRestaurantId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found for this restaurant.' });
    const role = String(staff.role || '').toUpperCase();
    if (perms.OWNER_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Restaurant owners always have full access.' });
    }
    if (Number(staff.id) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot change your own permissions.' });
    }
    const editorRole = String(req.user.role || '').toUpperCase();
    const editorIsOwner = perms.OWNER_ROLES.includes(editorRole) || req.isSuperAdmin;

    if (req.body?.reset) {
      await perms.setPermissions(staff.id, req.adminRestaurantId, null, req.user.id);
      return res.json({ success: true, message: `${staff.name} is back to the ${role.toLowerCase()} defaults.`, permissions: perms.ROLE_DEFAULTS[role] || [] });
    }
    if (!Array.isArray(req.body?.permissions)) {
      return res.status(400).json({ success: false, message: 'Send the list of permissions.' });
    }
    let requested = req.body.permissions.filter((k) => perms.ALL_KEYS.includes(k));
    if (!editorIsOwner) {
      // A manager with staff rights can only hand out what they have themselves
      const mine = (await perms.effectivePermissions(req.user.id, editorRole, req.adminRestaurantId)).permissions;
      const notAllowed = requested.filter((k) => !mine.includes(k));
      if (notAllowed.length) {
        return res.status(403).json({ success: false, message: 'You can only give permissions you have yourself.' });
      }
    }
    const saved = await perms.setPermissions(staff.id, req.adminRestaurantId, requested, req.user.id);
    res.json({ success: true, message: `Permissions updated for ${staff.name}.`, permissions: saved });
  } catch (err) {
    console.error('updateStaffPermissions Error:', err);
    res.status(500).json({ success: false, message: 'Could not update permissions.' });
  }
}

/** GET /auth/permissions — what the signed-in user may do at the current restaurant */
async function getMyPermissions(req, res) {
  try {
    const perms = require('../utils/permissions');
    const role = String(req.user.role || '').toUpperCase();
    let restaurantId = null;
    const slug = req.query.slug || req.headers['x-restaurant-slug'];
    if (slug) {
      const [r] = await query('SELECT id FROM restaurants WHERE slug = ? OR custom_subdomain_slug = ? LIMIT 1', [slug, slug]);
      if (r) restaurantId = r.id;
    }
    if (!restaurantId) {
      const [link] = await query(
        `SELECT restaurant_id FROM restaurant_admins WHERE user_id = ? ORDER BY is_primary DESC LIMIT 1`,
        [req.user.id]
      );
      restaurantId = link ? link.restaurant_id : (req.user.restaurant_id || null);
    }
    const eff = await perms.effectivePermissions(req.user.id, role, restaurantId);
    res.json({ success: true, role, owner: eff.owner, restaurant_id: restaurantId, permissions: eff.permissions, catalog: perms.PERMISSIONS });
  } catch (err) {
    console.error('getMyPermissions Error:', err);
    res.status(500).json({ success: false, message: 'Could not load permissions.' });
  }
}

module.exports = {
  getRestaurantStaff,
  createStaffMember,
  updateStaffMember,
  toggleStaffStatus,
  deleteStaffMember,
  getStaffPermissions,
  updateStaffPermissions,
  getMyPermissions
};
