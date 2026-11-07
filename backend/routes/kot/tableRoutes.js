const express = require('express');
const router = express.Router();
const tableController = require('../../controllers/kot/tableController');
const qrController = require('../../controllers/kot/qrController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);

const { query: dbQuery } = require('../../config/db');
async function ownTable(req, res, next, id) {
  try {
    if (String(req.user?.role || '').toUpperCase() === 'SUPER_ADMIN') return next();
    const rows = await dbQuery(`SELECT restaurant_id FROM restaurant_tables WHERE id = ?`, [id]);
    const mine = rows.length && (rows[0].restaurant_id == null || Number(rows[0].restaurant_id) === Number(req.user?.restaurant_id || 1));
    if (!mine) return res.status(404).json({ success: false, message: 'Table not found' });
    next();
  } catch (err) {
    next(err);
  }
}
router.param('id', ownTable);
router.param('tableId', ownTable);

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
