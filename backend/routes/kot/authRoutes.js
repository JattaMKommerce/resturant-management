const express = require('express');
const router = express.Router();
const authController = require('../../controllers/kot/authController');
const { authenticateToken } = require('../../middleware/kotAuth');

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
