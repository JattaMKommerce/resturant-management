const express = require('express');
const router = express.Router();
const operationsController = require('../../controllers/kot/operationsController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

// Protect all operations endpoints to ADMIN and MANAGER roles only
router.use(authenticateToken);
router.use(requireRoles('ADMIN', 'MANAGER'));

router.get('/overview', operationsController.getOverview);

module.exports = router;
