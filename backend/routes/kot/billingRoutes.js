const express = require('express');
const router = express.Router();
const billingController = require('../../controllers/kot/billingController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);
router.use(requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER'));

router.get('/', billingController.getBills);
router.post('/', billingController.createBillHandler);
router.get('/:id', billingController.getBillById);
router.post('/:id/payment', billingController.processPaymentHandler);

module.exports = router;
