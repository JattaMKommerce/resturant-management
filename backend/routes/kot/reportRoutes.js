const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/kot/reportController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);
router.use(requireRoles('ADMIN', 'MANAGER'));

router.get('/dashboard-kpis', reportController.getDashboardKPIs);
router.get('/sales', reportController.getSalesReport);
router.get('/kot', reportController.getKOTReport);
router.get('/menu', reportController.getMenuReport);
router.get('/expiry', reportController.getExpiryReport);

module.exports = router;
