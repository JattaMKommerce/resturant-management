const express = require('express');
const router = express.Router();
const hotelController = require('../../controllers/kot/hotelController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

// Hotels are publicly viewable by guests & authenticated staff
router.get('/', hotelController.getHotels);
router.get('/:id', hotelController.getHotelById);

module.exports = router;
