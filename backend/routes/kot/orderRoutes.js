const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/kot/orderController');
const { authenticateToken } = require('../../middleware/kotAuth');

// On the shared /api/orders mount, single-order lookups belong to the online ordering router
// (customer tracking, /orders/my-orders, admin order detail). KOT keeps them under /api/restaurant/orders.
const deferToOnlineOrders = (req, res, next) => (req.baseUrl.includes('/restaurant/') ? next() : next('router'));

router.get('/', authenticateToken, orderController.getOrders);
router.post('/', orderController.createOrderHandler); // Allowed for Waiter/POS/QR
router.get('/:id', deferToOnlineOrders, authenticateToken, orderController.getOrderById);
router.patch('/:id/status', deferToOnlineOrders, authenticateToken, orderController.updateOrderStatus);

module.exports = router;
