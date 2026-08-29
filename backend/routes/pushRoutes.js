const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');

router.get('/public-key', pushController.getPublicKey);
router.post('/subscribe', pushController.subscribe);

module.exports = router;
