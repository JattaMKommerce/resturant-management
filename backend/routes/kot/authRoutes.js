const express = require('express');
const router = express.Router();
const authController = require('../../controllers/kot/authController');
const mainAuthController = require('../../controllers/authController');
const { authenticateToken } = require('../../middleware/kotAuth');

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/register', mainAuthController.register);
router.post('/register-restaurant', mainAuthController.registerRestaurant);
router.post('/customer/send-otp', mainAuthController.customerSendOtp);
router.post('/customer/verify-otp', mainAuthController.customerVerifyOtp);
router.post('/send-otp', mainAuthController.customerSendOtp);
router.post('/verify-otp', mainAuthController.customerVerifyOtp);

module.exports = router;

