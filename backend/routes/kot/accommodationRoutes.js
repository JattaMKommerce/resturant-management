const express = require('express');
const router = express.Router();
const accommodationController = require('../../controllers/kot/accommodationController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);

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
