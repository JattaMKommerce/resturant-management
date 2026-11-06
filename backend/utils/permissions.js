/**
 * Role-based access control with per-person permissions (REQ-029 / REQ-030).
 *
 * Owners (restaurant admin) and Super Admin can do everything. Managers and staff get their
 * role's default permissions, which the restaurant admin can change per person in Staff
 * Management. Every /admin API route is mapped to one permission below.
 */
const { query } = require('../config/db');

const PERMISSIONS = [
  { key: 'orders.manage', label: 'Online orders', description: 'See and update online orders, assign riders, unclaimed orders' },
  { key: 'menu.manage', label: 'Menu', description: 'Dishes, categories, prices, stock and specials' },
  { key: 'coupons.manage', label: 'Coupons', description: 'Create and edit coupon codes' },
  { key: 'refunds.manage', label: 'Refunds', description: 'Record refunds to customers' },
  { key: 'reports.view', label: 'Reports', description: 'Dashboard, sales analytics, exports, order history' },
  { key: 'drivers.manage', label: 'Delivery riders', description: 'Riders, rider applications and payouts' },
  { key: 'rooms.manage', label: 'Hotel rooms', description: 'Room enquiries and bookings' },
  { key: 'staff.manage', label: 'Staff', description: 'Add staff and change their permissions' },
  { key: 'settings.manage', label: 'Settings', description: 'Restaurant settings, payments, website' }
];
const ALL_KEYS = PERMISSIONS.map((p) => p.key);

const OWNER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RESTAURANT_ADMIN'];
const ROLE_DEFAULTS = {
  MANAGER: ALL_KEYS.filter((k) => !['staff.manage', 'settings.manage'].includes(k)),
  CASHIER: ['orders.manage', 'refunds.manage', 'reports.view'],
  WAITER: [],
  KITCHEN: [],
  CHEF: [],
  INVENTORY_MANAGER: []
};
const PERMISSION_ROLES = Object.keys(ROLE_DEFAULTS);

// /admin/<first path segment> -> permission
const ROUTE_PERMISSIONS = {
  orders: 'orders.manage',
  menu: 'menu.manage', categories: 'menu.manage', offerings: 'menu.manage', 'upload-images': 'menu.manage',
  coupons: 'coupons.manage',
  refunds: 'refunds.manage',
  reports: 'reports.view', dashboard: 'reports.view', history: 'reports.view', ai: 'reports.view',
  drivers: 'drivers.manage', riders: 'drivers.manage', 'rider-applications': 'drivers.manage', 'driver-payouts': 'drivers.manage',
  'room-inquiries': 'rooms.manage',
  staff: 'staff.manage',
  restaurant: 'settings.manage', subscription: 'settings.manage', wallet: 'settings.manage'
};
// Reading the restaurant profile is needed by every admin screen
const READ_ANYWAY = [/^\/restaurant\/?$/];

let schemaPromise = null;
function ensurePermissionSchema() {
  if (!schemaPromise) {
    schemaPromise = query(`CREATE TABLE IF NOT EXISTS staff_permissions (
      user_id INT NOT NULL,
      restaurant_id INT NOT NULL,
      permissions TEXT NOT NULL,
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, restaurant_id)
    )`).catch((err) => { schemaPromise = null; throw err; });
  }
  return schemaPromise;
}

function cleanList(list) {
  return ALL_KEYS.filter((k) => (list || []).includes(k));
}

async function effectivePermissions(userId, role, restaurantId) {
  const r = String(role || '').toUpperCase();
  if (OWNER_ROLES.includes(r)) return { permissions: ALL_KEYS, custom: false, owner: true };
  const defaults = ROLE_DEFAULTS[r] || [];
  if (!userId || !restaurantId) return { permissions: defaults, custom: false, owner: false };
  await ensurePermissionSchema();
  const [row] = await query('SELECT permissions FROM staff_permissions WHERE user_id = ? AND restaurant_id = ?', [userId, restaurantId]);
  if (!row) return { permissions: defaults, custom: false, owner: false };
  let list = [];
  try { list = JSON.parse(row.permissions); } catch (e) { list = []; }
  return { permissions: cleanList(list), custom: true, owner: false };
}

async function setPermissions(userId, restaurantId, list, updatedBy) {
  await ensurePermissionSchema();
  if (list === null) {
    await query('DELETE FROM staff_permissions WHERE user_id = ? AND restaurant_id = ?', [userId, restaurantId]);
    return null;
  }
  const clean = cleanList(list);
  await query(
    `INSERT INTO staff_permissions (user_id, restaurant_id, permissions, updated_by) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE permissions = VALUES(permissions), updated_by = VALUES(updated_by)`,
    [userId, restaurantId, JSON.stringify(clean), updatedBy || null]
  );
  return clean;
}

function permissionForAdminPath(path) {
  // path is relative to /api, e.g. /admin/menu/12
  const m = String(path || '').match(/^\/admin\/([^/?]+)/);
  if (!m) return null;
  const rest = path.slice('/admin'.length);
  if (READ_ANYWAY.some((re) => re.test(rest))) return null;
  return ROUTE_PERMISSIONS[m[1]] || null;
}

/**
 * Express middleware for /admin routes, used after authenticateToken + resolveRestaurantAccess.
 * Owners pass. Managers/staff need the permission mapped to the route. Others are refused.
 */
function requireAdminPermission(req, res, next) {
  const role = String(req.user?.role || '').toUpperCase();
  if (OWNER_ROLES.includes(role) || req.isSuperAdmin) return next();
  if (!PERMISSION_ROLES.includes(role)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  const path = (req.originalUrl || '').split('?')[0].replace(/^\/api(\/v1)?/, '');
  const key = permissionForAdminPath(path);
  // A route with no mapped permission stays owner/manager only, as before
  if (!key) {
    return role === 'MANAGER' ? next() : res.status(403).json({ success: false, message: 'Access denied.' });
  }
  effectivePermissions(req.user.id, role, req.adminRestaurantId)
    .then(({ permissions }) => {
      if (permissions.includes(key)) {
        req.permissions = permissions;
        return next();
      }
      const label = PERMISSIONS.find((p) => p.key === key)?.label || key;
      return res.status(403).json({ success: false, code: 'PERMISSION_DENIED', permission: key, message: `You do not have permission for ${label}. Ask your restaurant admin.` });
    })
    .catch((err) => {
      console.error('requireAdminPermission error:', err);
      res.status(500).json({ success: false, message: 'Could not check permissions.' });
    });
}

module.exports = {
  PERMISSIONS, ALL_KEYS, ROLE_DEFAULTS, PERMISSION_ROLES, OWNER_ROLES,
  ensurePermissionSchema, effectivePermissions, setPermissions, permissionForAdminPath, requireAdminPermission
};
