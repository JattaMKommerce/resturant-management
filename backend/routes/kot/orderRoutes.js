const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/kot/orderController');
const { authenticateToken } = require('../../middleware/kotAuth');

router.get('/', authenticateToken, orderController.getOrders);
router.post('/', orderController.createOrderHandler); // Allowed for Waiter/POS/QR
router.get('/:id', authenticateToken, orderController.getOrderById);
router.patch('/:id/status', authenticateToken, orderController.updateOrderStatus);

module.exports = router;
