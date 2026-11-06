const express = require('express');
const router = express.Router();
const accommodationController = require('../../controllers/kot/accommodationController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);

// Hotel data belongs to one restaurant: any :id / :folioId route only works on records of the
// signed-in user's restaurant (Super Admin: all). Unknown or foreign ids look "not found".
const { query: dbQuery } = require('../../config/db');
const notFound = (res, what) => res.status(404).json({ success: false, message: `${what} not found.` });
router.param('id', async (req, res, next, id) => {
  try {
    const scope = accommodationController.hotelScope(req);
    if (!scope) return next();
    const isEnquiry = req.path.startsWith('/inquiries/');
    const isReservation = req.path.startsWith('/reservations/');
    const isBlock = req.path.startsWith('/blocks/');
    const isRate = req.path.startsWith('/rates/');
    const isServiceRequest = req.path.startsWith('/service-requests/');
    const table = isEnquiry || isReservation ? 'room_bookings' : isBlock ? 'room_blocks' : isRate ? 'room_rate_rules' : isServiceRequest ? 'room_service_requests' : 'rooms';
    const rows = await dbQuery(`SELECT restaurant_id FROM ${table} WHERE id = ?`, [id]).catch(() => []);
    if (!rows.length || Number(rows[0].restaurant_id) !== Number(scope)) {
      return notFound(res, isEnquiry ? 'Enquiry' : isReservation ? 'Reservation' : isBlock ? 'Block' : isRate ? 'Rate' : isServiceRequest ? 'Request' : 'Room');
    }
    next();
  } catch (err) {
    next(err);
  }
});
router.param('folioId', async (req, res, next, folioId) => {
  try {
    const scope = accommodationController.hotelScope(req);
    if (!scope) return next();
    const rows = await dbQuery(
      `SELECT r.restaurant_id FROM room_folios f JOIN rooms r ON r.id = f.room_id WHERE f.id = ?`, [folioId]
    );
    if (!rows.length || Number(rows[0].restaurant_id) !== Number(scope)) return notFound(res, 'Folio');
    next();
  } catch (err) {
    next(err);
  }
});

// ---- Hotel operations (REQ-041..050) — before the parameterised /:id routes ----
const hotelOps = require('../../controllers/kot/hotelOpsController');
const FRONT_DESK = requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN');
const MANAGEMENT = requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN');
router.get('/availability', FRONT_DESK, hotelOps.getAvailability);
router.get('/reservations', FRONT_DESK, hotelOps.listReservations);
router.post('/reservations', FRONT_DESK, hotelOps.createReservation);
router.put('/reservations/:id', FRONT_DESK, hotelOps.updateReservation);
router.post('/reservations/:id/cancel', FRONT_DESK, hotelOps.cancelReservation);
router.post('/reservations/:id/check-in', FRONT_DESK, hotelOps.checkInReservation);
router.get('/blocks', FRONT_DESK, hotelOps.listBlocks);
router.delete('/blocks/:id', MANAGEMENT, hotelOps.unblock);
router.get('/rates', MANAGEMENT, hotelOps.listRates);
router.post('/rates', MANAGEMENT, hotelOps.createRate);
router.put('/rates/room-tax', MANAGEMENT, hotelOps.setRoomTax);
router.put('/rates/:id', MANAGEMENT, hotelOps.updateRate);
router.delete('/rates/:id', MANAGEMENT, hotelOps.deleteRate);
router.get('/folios/:folioId/invoice', FRONT_DESK, hotelOps.getFolioInvoice);
router.get('/guests/history', FRONT_DESK, hotelOps.getGuestHistory);
router.get('/service-requests', FRONT_DESK, hotelOps.listServiceRequests);
router.patch('/service-requests/:id', FRONT_DESK, hotelOps.updateServiceRequest);
router.get('/:id/quote', FRONT_DESK, hotelOps.getQuote);
router.post('/:id/block', MANAGEMENT, hotelOps.blockRoom);
router.post('/:id/service-requests', FRONT_DESK, hotelOps.createServiceRequest);

// Room Reservation Leads / Inquiries (must be placed before parameterized /:id route)
router.get(
  '/inquiries/list',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRoomInquiries
);

router.patch(
  '/inquiries/:id/status',
  requireRoles('ADMIN', 'MANAGER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.updateInquiryStatus
);

router.delete(
  '/inquiries/:id',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.deleteInquiry
);

// Aggregate stats (must be placed before parameterized /:id route)
router.get(
  '/stats/summary',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRoomStats
);

// Guest Management List
router.get(
  '/guests/list',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getGuests
);

// All Folios List & Search
router.get(
  '/folios/all',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getAllFolios
);

// Folio Operations: Add custom charge & Settle payment
router.post(
  '/folios/:folioId/charge',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.addFolioCharge
);

router.post(
  '/folios/:folioId/settle',
  requireRoles('ADMIN', 'MANAGER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.settleFolio
);

// Room List & Search
router.get(
  '/',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRooms
);

// Create Room
router.post(
  '/',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.createRoom
);

// Single Room Details
router.get(
  '/:id',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRoomById
);

// Update Room Details
router.put(
  '/:id',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.updateRoom
);

// Quick Update Status (VACANT, OCCUPIED, CLEANING, MAINTENANCE)
router.patch(
  '/:id/status',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.updateRoomStatus
);

// Delete Room
router.delete(
  '/:id',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.deleteRoom
);

// Guest Check-In
router.post(
  '/:id/check-in',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.checkInGuest
);

// Guest Check-Out
router.post(
  '/:id/check-out',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.checkOutGuest
);

// Extended Stay: extend checkout date
router.post(
  '/:id/extend-stay',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.extendStay
);

// Breakfast Extra Charge: add breakfast package charge to open folio
router.post(
  '/:id/add-breakfast',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.addBreakfastCharge
);

// Housekeeping: complete cleaning and mark VACANT
router.post(
  '/:id/complete-cleaning',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.completeCleaning
);

// Maintenance: set room to MAINTENANCE status
router.post(
  '/:id/set-maintenance',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.setMaintenance
);

// Maintenance: complete maintenance and mark VACANT
router.post(
  '/:id/complete-maintenance',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.completeMaintenance
);

// Room Folio & Linked Charges
router.get(
  '/:id/folio',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRoomFolio
);

module.exports = router;
