const express = require('express');
const router = express.Router();
const menuController = require('../../controllers/kot/menuController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);

const { query: dbQuery } = require('../../config/db');
router.param('id', async (req, res, next, id) => {
  try {
    if (!req.path.startsWith('/items/') || String(req.user?.role || '').toUpperCase() === 'SUPER_ADMIN') return next();
    const rows = await dbQuery(`SELECT restaurant_id FROM menu_items WHERE id = ?`, [id]);
    if (!rows.length || Number(rows[0].restaurant_id) !== Number(req.user?.restaurant_id || 1)) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Categories
router.get('/categories', menuController.getCategories);
router.post('/categories', requireRoles('ADMIN', 'MANAGER'), menuController.createCategory);
router.put('/categories/:id', requireRoles('ADMIN', 'MANAGER'), menuController.updateCategory);
router.delete('/categories/:id', requireRoles('ADMIN', 'MANAGER'), menuController.deleteCategory);

// Kitchen Departments
router.get('/departments', menuController.getKitchenDepartments);
router.post('/departments', requireRoles('ADMIN', 'MANAGER'), menuController.createKitchenDepartment);
router.put('/departments/:id', requireRoles('ADMIN', 'MANAGER'), menuController.updateKitchenDepartment);

// Items
router.get('/items', menuController.getMenuItems);
router.post('/items', requireRoles('ADMIN', 'MANAGER'), menuController.createMenuItem);
router.get('/items/:id', menuController.getMenuItemById);
router.put('/items/:id', requireRoles('ADMIN', 'MANAGER'), menuController.updateMenuItem);
router.patch('/items/:id/toggle-online', requireRoles('ADMIN', 'MANAGER'), menuController.toggleOnlineAvailability);
router.delete('/items/:id', requireRoles('ADMIN', 'MANAGER'), menuController.deleteMenuItem);

// Modifiers
router.get('/modifiers', menuController.getModifierGroups);
router.post('/modifiers', requireRoles('ADMIN', 'MANAGER'), menuController.createModifierGroup);

module.exports = router;
