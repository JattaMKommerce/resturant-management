const express = require('express');
const router = express.Router();
const tableController = require('../../controllers/kot/tableController');
const qrController = require('../../controllers/kot/qrController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);

router.get('/', requireRoles('ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'), tableController.getTables);
router.get('/next-number', requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER'), tableController.getNextTableNumberHandler);
router.post('/', requireRoles('ADMIN', 'MANAGER'), tableController.createTable);
router.get('/:id', requireRoles('ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'), tableController.getTableById);
router.put('/:id', requireRoles('ADMIN', 'MANAGER'), tableController.updateTable);
router.patch('/:id/status', requireRoles('ADMIN', 'MANAGER', 'WAITER'), tableController.updateTableStatus);
router.delete('/:id', requireRoles('ADMIN', 'MANAGER'), tableController.deleteTable);

// QR Code Management
router.post('/:tableId/qr/regenerate', requireRoles('ADMIN', 'MANAGER'), qrController.regenerateQR);
router.patch('/:tableId/qr/status', requireRoles('ADMIN', 'MANAGER'), qrController.toggleQRStatus);
router.get('/:tableId/qr/history', requireRoles('ADMIN', 'MANAGER', 'WAITER'), qrController.getQRHistory);

module.exports = router;
