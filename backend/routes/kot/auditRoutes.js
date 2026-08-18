const express = require('express');
const router = express.Router();
const auditController = require('../../controllers/kot/auditController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);
router.use(requireRoles('ADMIN'));

router.get('/', auditController.getAuditLogs);

module.exports = router;
