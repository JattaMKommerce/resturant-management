const express = require('express');
const router = express.Router();
const reservations = require('../../controllers/kot/tableReservationController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

// Restaurant table reservations for front-of-house staff (REQ-051 / REQ-056).
router.use(authenticateToken);
router.param('id', reservations.guardReservation);

const FRONT_OF_HOUSE = ['ADMIN', 'MANAGER', 'WAITER', 'CASHIER'];
router.get('/', requireRoles(...FRONT_OF_HOUSE), reservations.listReservations);
router.get('/availability', requireRoles(...FRONT_OF_HOUSE), reservations.checkAvailability);
router.post('/', requireRoles(...FRONT_OF_HOUSE), reservations.createReservation);
router.get('/:id', requireRoles(...FRONT_OF_HOUSE), reservations.getReservation);
router.put('/:id', requireRoles(...FRONT_OF_HOUSE), reservations.updateReservation);
router.post('/:id/status', requireRoles(...FRONT_OF_HOUSE), reservations.changeReservationStatus);

module.exports = router;
