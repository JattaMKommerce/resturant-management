/**
 * subscriptionRoutes.js
 * SaaS subscription routes for Hotel Admins and Super Admins.
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeRoles, resolveRestaurantAccess } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');
const superAdminSubscriptionController = require('../controllers/superAdminSubscriptionController');

const hotelAdminAuth = [
  authenticateToken,
  authorizeRoles('ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'),
  resolveRestaurantAccess
];

const superAdminAuth = [
  authenticateToken,
  authorizeRoles('SUPER_ADMIN')
];

// =========================================================================
// 1. HOTEL ADMIN SUBSCRIPTION ROUTES (Exempt from blocking so expired/pending hotels can access)
// =========================================================================
router.get('/admin/subscription/status', ...hotelAdminAuth, subscriptionController.getSubscriptionStatus);
router.get('/admin/subscription/plans', ...hotelAdminAuth, subscriptionController.getAvailablePlans);
router.post('/admin/subscription/payment/initiate', ...hotelAdminAuth, subscriptionController.initiateRenewalPayment);
router.post('/admin/subscription/payment/verify', ...hotelAdminAuth, subscriptionController.verifyRenewalPayment);
router.get('/admin/subscription/invoices', ...hotelAdminAuth, subscriptionController.getInvoices);

// =========================================================================
// 2. SUPER ADMIN SAAS GOVERNANCE & APPROVAL ROUTES
// =========================================================================
router.get('/superadmin/subscriptions/plans', ...superAdminAuth, superAdminSubscriptionController.getAllPlans);
router.post('/superadmin/subscriptions/plans', ...superAdminAuth, superAdminSubscriptionController.createPlan);
router.put('/superadmin/subscriptions/plans/:id', ...superAdminAuth, superAdminSubscriptionController.updatePlan);
router.patch('/superadmin/subscriptions/plans/:id/status', ...superAdminAuth, superAdminSubscriptionController.togglePlanStatus);

// Pending Approvals Queue & Super Admin Approve/Reject Endpoints
router.get('/superadmin/subscriptions/pending-approvals', ...superAdminAuth, superAdminSubscriptionController.getPendingApprovals);
router.post('/superadmin/subscriptions/approvals/:id/approve', ...superAdminAuth, superAdminSubscriptionController.approvePendingSubscription);
router.post('/superadmin/subscriptions/approvals/:id/reject', ...superAdminAuth, superAdminSubscriptionController.rejectPendingSubscription);

router.get('/superadmin/subscriptions/hotels', ...superAdminAuth, superAdminSubscriptionController.getAllHotelsSubscriptions);
router.post('/superadmin/subscriptions/assign', ...superAdminAuth, superAdminSubscriptionController.assignPlanToHotel);
router.post('/superadmin/subscriptions/extend', ...superAdminAuth, superAdminSubscriptionController.extendHotelSubscription);
router.patch('/superadmin/subscriptions/hotels/:id/status', ...superAdminAuth, superAdminSubscriptionController.updateHotelSubscriptionStatus);

router.get('/superadmin/subscriptions/payments', ...superAdminAuth, superAdminSubscriptionController.getAllPayments);
router.get('/superadmin/subscriptions/history', ...superAdminAuth, superAdminSubscriptionController.getSubscriptionAuditHistory);

module.exports = router;
