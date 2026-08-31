const express = require('express');
const router = express.Router();
const accommodationController = require('../../controllers/kot/accommodationController');
const { authenticateToken, requireRoles } = require('../../middleware/kotAuth');

router.use(authenticateToken);

// 1. Dashboard Overview (Scoped by Hotel)
router.get(
  '/dashboard',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getAccommodationDashboard
);

// 2. Aggregate stats
router.get(
  '/stats/summary',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRoomStats
);

// 3. Bookings Management
router.get(
  '/bookings',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getBookings
);

router.post(
  '/bookings',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.createBooking
);

router.put(
  '/bookings/:id/status',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.updateBookingStatus
);

// 4. Notifications System
router.get(
  '/notifications',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getAccommodationNotifications
);

router.post(
  '/notifications/mark-read',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.markNotificationsRead
);

// 5. Payments & Folios
router.get(
  '/payments',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getAccommodationPayments
);

router.post(
  '/payments/record',
  requireRoles('ADMIN', 'MANAGER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.recordAccommodationPayment
);

router.post(
  '/guest-document',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.saveGuestDocument
);

// 6. Guest Directory List
router.get(
  '/guests/list',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getGuests
);

// 7. All Folios List & Search
router.get(
  '/folios/all',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getAllFolios
);

// 8. Folio Operations
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

// 9. Room Inventory CRUD
router.get(
  '/',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRooms
);

router.post(
  '/',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.createRoom
);

router.get(
  '/:id',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRoomById
);

router.put(
  '/:id',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.updateRoom
);

router.patch(
  '/:id/status',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.updateRoomStatus
);

router.delete(
  '/:id',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.deleteRoom
);

// 10. Operational Actions
router.post(
  '/:id/check-in',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.checkInGuest
);

router.post(
  '/:id/check-out',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.checkOutGuest
);

router.post(
  '/:id/extend-stay',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.extendStay
);

router.post(
  '/:id/add-breakfast',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.addBreakfastCharge
);

router.post(
  '/:id/complete-cleaning',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.completeCleaning
);

router.post(
  '/:id/set-maintenance',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.setMaintenance
);

router.post(
  '/:id/complete-maintenance',
  requireRoles('ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.completeMaintenance
);

router.get(
  '/:id/folio',
  requireRoles('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  accommodationController.getRoomFolio
);

module.exports = router;
