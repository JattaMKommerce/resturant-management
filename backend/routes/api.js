const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeRoles, resolveRestaurantAccess } = require('../middleware/auth');
const { resolveGuestIdentity, initGuestIdentity, getGuestActiveOrder, getGuestOrders } = require('../middleware/guestIdentity');
const upload = require('../middleware/upload');
const { riderUpload } = require('../middleware/riderUpload');
const { createRateLimiter } = require('../middleware/rateLimiter');

const authController = require('../controllers/authController');
const restaurantController = require('../controllers/restaurantController');
const categoryController = require('../controllers/categoryController');
const menuController = require('../controllers/menuController');
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');
const driverController = require('../controllers/driverController');
const riderAppController = require('../controllers/riderApplicationController');
const notificationController = require('../controllers/notificationController');
const superAdminController = require('../controllers/superAdminController');

// Rate limiters
const applicationLimiter = createRateLimiter(15 * 60 * 1000, 10); // 10 application requests per 15 min

// Document upload fields for rider applications
const riderFieldsUpload = riderUpload.fields([
  { name: 'selfie', maxCount: 1 },
  { name: 'aadhaar_front', maxCount: 1 },
  { name: 'aadhaar_back', maxCount: 1 },
  { name: 'driving_license_front', maxCount: 1 },
  { name: 'driving_license_back', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'vehicle_rc', maxCount: 1 },
  { name: 'insurance', maxCount: 1 }
]);

// ═══════════════════════════════════════════════
// 1. AUTH ROUTES
// ═══════════════════════════════════════════════
router.post('/auth/register', authController.register);
router.post('/auth/register-restaurant', authController.registerRestaurant);
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);

// ═══════════════════════════════════════════════
// 2. GUEST IDENTITY ROUTES
// ═══════════════════════════════════════════════
router.post('/guest/init', resolveGuestIdentity, initGuestIdentity);
router.get('/guest/active-order/:slug', resolveGuestIdentity, getGuestActiveOrder);
router.get('/guest/orders', resolveGuestIdentity, getGuestOrders);

// ═══════════════════════════════════════════════
// 3. PUBLIC RESTAURANT & MENU ROUTES
// ═══════════════════════════════════════════════
router.get('/restaurants', restaurantController.getDefaultRestaurant);
router.get('/restaurants/published', restaurantController.getPublishedRestaurants);
router.get('/restaurants/:slug', restaurantController.getRestaurantBySlug);
router.get('/restaurants/:slug/categories', categoryController.getCategoriesBySlug);
router.get('/restaurants/:slug/menu', menuController.getMenuBySlug);

// ═══════════════════════════════════════════════
// 4. PUBLIC RIDER APPLICATION ROUTES (Rate-Limited)
// ═══════════════════════════════════════════════
router.post('/driver-applications', applicationLimiter, riderFieldsUpload, riderAppController.submitApplication);
router.get('/driver-applications/:id', riderAppController.checkApplicationStatus);

// ═══════════════════════════════════════════════
// 5. DRIVER PORTAL ROUTES (Phase 2)
// ═══════════════════════════════════════════════
const driverAuth = [authenticateToken, authorizeRoles('DRIVER', 'ADMIN', 'SUPER_ADMIN')];

router.post('/driver/login', driverController.driverLogin);
router.get('/driver/profile', ...driverAuth, driverController.getDriverProfile);
router.put('/driver/profile', ...driverAuth, driverController.updateDriverProfile);
router.post('/driver/go-online', ...driverAuth, driverController.goOnline);
router.post('/driver/go-offline', ...driverAuth, driverController.goOffline);
router.post('/driver/location', ...driverAuth, driverController.updateDriverLocation);
router.get('/driver/orders', ...driverAuth, driverController.getDriverOrders);
router.get('/driver/available-orders', ...driverAuth, driverController.getAvailableOrdersPool);
router.post('/driver/orders/:id/claim', ...driverAuth, driverController.claimOrder);
router.post('/driver/orders/:id/accept', ...driverAuth, driverController.acceptOrder);
router.post('/driver/orders/:id/decline', ...driverAuth, driverController.declineOrder);
router.post('/driver/orders/:id/pickup', ...driverAuth, driverController.pickupOrder);
router.post('/driver/orders/:id/start-delivery', ...driverAuth, driverController.startDelivery);
router.post('/driver/orders/:id/deliver', ...driverAuth, driverController.deliverOrder);
router.post('/driver/orders/:id/delivery-failed', ...driverAuth, driverController.markDeliveryFailed);
router.get('/driver/available-restaurants', ...driverAuth, driverController.getAvailableRestaurants);
router.post('/driver/apply-restaurant', ...driverAuth, driverController.applyToRestaurant);
router.post('/driver/connect-all-restaurants', ...driverAuth, driverController.connectAllRestaurants);

// ═══════════════════════════════════════════════
// 6. CUSTOMER ORDER ROUTES (Guest Identity)
// ═══════════════════════════════════════════════
router.post('/orders/checkout', resolveGuestIdentity, orderController.placeOrder);
router.get('/orders/:id', resolveGuestIdentity, orderController.getOrderById);
router.get('/orders/my-orders', authenticateToken, orderController.getUserOrders);

// ═══════════════════════════════════════════════
// 7. PAYMENT ROUTES (Guest or Auth)
// ═══════════════════════════════════════════════
router.post('/payments/initiate', resolveGuestIdentity, paymentController.initiatePayment);
router.post('/payments/verify', resolveGuestIdentity, paymentController.verifyPayment);
router.post('/payments/mark-cod-collected', authenticateToken, paymentController.markCodCollected);

// ═══════════════════════════════════════════════
// 8. SUPER ADMIN ROUTES
// ═══════════════════════════════════════════════
const superAuth = [authenticateToken, authorizeRoles('SUPER_ADMIN')];

router.get('/superadmin/kpis', ...superAuth, superAdminController.getSuperAdminKPIs);
router.get('/superadmin/restaurants', ...superAuth, superAdminController.getAllRestaurants);
router.get('/superadmin/restaurants/:id', ...superAuth, superAdminController.getRestaurantById);
router.post('/superadmin/restaurants', ...superAuth, superAdminController.createRestaurant);
router.patch('/superadmin/restaurants/:id/status', ...superAuth, superAdminController.updateRestaurantStatus);
router.get('/superadmin/admins', ...superAuth, superAdminController.getAllAdmins);
router.post('/superadmin/admins', ...superAuth, superAdminController.createRestaurantAdmin);
router.post('/superadmin/admins/assign', ...superAuth, superAdminController.assignRestaurantAdmin);
router.delete('/superadmin/admins/:id', ...superAuth, superAdminController.removeRestaurantAdmin);
router.patch('/superadmin/admins/:userId/status', ...superAuth, superAdminController.updateAdminStatus);
router.get('/superadmin/drivers', ...superAuth, superAdminController.getAllDrivers);
router.patch('/superadmin/drivers/:driverId/status', ...superAuth, superAdminController.updateDriverStatus);
router.get('/superadmin/orders', ...superAuth, superAdminController.getAllPlatformOrders);

// ═══════════════════════════════════════════════
// 9. RESTAURANT ADMIN ROUTES (With Isolation)
// ═══════════════════════════════════════════════
const adminAuth = [authenticateToken, authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'), resolveRestaurantAccess];

// Dashboard
router.get('/admin/dashboard/kpis', ...adminAuth, orderController.getDashboardKPIs);

// Restaurant management (specific routes BEFORE :id parameterized routes)
router.get('/admin/restaurant', ...adminAuth, restaurantController.getAdminRestaurant);
router.put(
  '/admin/restaurant/settings',
  ...adminAuth,
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
  restaurantController.updateRestaurantSettings
);

// Setup & Publishing (must be before /:id route)
router.get('/admin/restaurant/setup-progress', ...adminAuth, restaurantController.getSetupProgress);
router.post('/admin/restaurant/publish', ...adminAuth, restaurantController.publishWebsite);
router.post('/admin/restaurant/unpublish', ...adminAuth, restaurantController.unpublishWebsite);
router.post('/admin/restaurant/toggle-ordering', ...adminAuth, restaurantController.toggleOnlineOrdering);

// Parameterized :id routes LAST (so they don't swallow the named routes above)
router.get('/admin/restaurant/:id', ...adminAuth, restaurantController.getAdminRestaurant);
router.get('/admin/restaurant/:id/setup-progress', ...adminAuth, restaurantController.getSetupProgress);
router.post('/admin/restaurant/:id/publish', ...adminAuth, restaurantController.publishWebsite);
router.post('/admin/restaurant/:id/unpublish', ...adminAuth, restaurantController.unpublishWebsite);
router.post('/admin/restaurant/:id/toggle-ordering', ...adminAuth, restaurantController.toggleOnlineOrdering);

// Categories
router.get('/admin/categories', ...adminAuth, categoryController.getAdminCategories);
router.post('/admin/categories', ...adminAuth, upload.single('image'), categoryController.createCategory);
router.put('/admin/categories/:id', ...adminAuth, upload.single('image'), categoryController.updateCategory);
router.delete('/admin/categories/:id', ...adminAuth, categoryController.deleteCategory);

// Menu
router.get('/admin/menu', ...adminAuth, menuController.getAdminMenu);
router.post('/admin/menu', ...adminAuth, upload.single('image'), menuController.createMenuItem);
router.put('/admin/menu/:id', ...adminAuth, upload.single('image'), menuController.updateMenuItem);
router.patch('/admin/menu/:id/availability', ...adminAuth, menuController.toggleAvailability);
router.delete('/admin/menu/:id', ...adminAuth, menuController.deleteMenuItem);

// Orders
router.get('/admin/orders', ...adminAuth, orderController.getAllOrders);
router.patch('/admin/orders/:id/status', ...adminAuth, orderController.updateOrderStatus);
router.post('/admin/orders/:id/assign-driver', ...adminAuth, orderController.assignDriver);
router.post('/admin/orders/:id/recover-delivery', ...adminAuth, async (req, res) => {
  try {
    const { action, newDriverId, notes } = req.body;
    const OrderService = require('../services/OrderService');
    const result = await OrderService.recoverFailedDelivery(req.params.id, action, newDriverId, req.user.id, notes);
    res.json({ success: true, message: 'Delivery recovery action executed successfully.', result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin Rider Applications & Management
router.get('/admin/rider-applications', ...adminAuth, riderAppController.getAdminApplications);
router.get('/admin/rider-applications/:id', ...adminAuth, riderAppController.getAdminApplicationById);
router.patch('/admin/rider-applications/:id/approve', ...adminAuth, riderAppController.approveApplication);
router.patch('/admin/rider-applications/:id/reject', ...adminAuth, riderAppController.rejectApplication);
router.get('/admin/riders/:riderId/documents/:documentId', authenticateToken, resolveRestaurantAccess, riderAppController.streamDocument);
router.patch('/admin/riders/:riderId/documents/:documentId/verify', ...adminAuth, riderAppController.verifyDocument);
router.get('/admin/riders', ...adminAuth, driverController.getAdminDrivers);
router.patch('/admin/riders/:id/status', ...adminAuth, driverController.updateDriverStatus);

// ═══════════════════════════════════════════════
// 10. NOTIFICATIONS
// ═══════════════════════════════════════════════
router.get('/notifications', authenticateToken, notificationController.getNotifications);
router.patch('/notifications/:id/read', authenticateToken, notificationController.markNotificationRead);

module.exports = router;
