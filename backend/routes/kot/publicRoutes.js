const express = require('express');
const router = express.Router();
const qrController = require('../../controllers/kot/qrController');
const menuController = require('../../controllers/kot/menuController');
const orderController = require('../../controllers/kot/orderController');

router.get('/tables/:token', qrController.getPublicTableByToken);
router.post('/tables/:token/call-waiter', qrController.callWaiterHandler);
router.post('/call-waiter', qrController.callWaiterHandler);
router.get('/menu', menuController.getPublicMenu);
router.post('/orders', orderController.createOrderHandler);
router.get('/orders/:orderId/track', orderController.getCustomerOrderTracking);
router.post('/orders/:orderId/request-counter-payment', orderController.requestCounterPaymentHandler);

module.exports = router;
