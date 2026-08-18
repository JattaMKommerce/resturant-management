const express = require('express');
const router = express.Router();
const menuController = require('../../controllers/kot/menuController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);

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
