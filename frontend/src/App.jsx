import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Customer Online Pages
import RestaurantMenuPage from './pages/customer/RestaurantMenuPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import OrderTrackingPage from './pages/customer/OrderTrackingPage';

// Customer Offline Public Pages (QR Digital Menu & Table Tracking)
import CustomerQRMenuPage from './pages/public/CustomerQRMenuPage';
import CustomerOrderTrackingPage from './pages/public/CustomerOrderTrackingPage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterRestaurantPage from './pages/auth/RegisterRestaurantPage';

// Driver Pages (Phase 2)
import DriverApplicationPage from './pages/driver/DriverApplicationPage';
import DriverLoginPage from './pages/driver/DriverLoginPage';
import DriverDashboardPage from './pages/driver/DriverDashboardPage';

// Waiter Portal Pages
import WaiterLoginPage from './pages/waiter/WaiterLoginPage';
import WaiterRegisterPage from './pages/waiter/WaiterRegisterPage';
import WaiterDashboard from './pages/offline/waiter/WaiterDashboard';

// Kitchen Portal Pages
import KitchenLoginPage from './pages/kitchen/KitchenLoginPage';
import KitchenRegisterPage from './pages/kitchen/KitchenRegisterPage';

// Online Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminMenuPage from './pages/admin/AdminMenuPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminHistoryPage from './pages/admin/AdminHistoryPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminWebsitePage from './pages/admin/AdminWebsitePage';
import RestaurantOnboarding from './pages/admin/RestaurantOnboarding';
import AdminRidersPage from './pages/admin/AdminRidersPage';
import AdminDeliveriesPage from './pages/admin/AdminDeliveriesPage';

// Offline Restaurant & KOT Pages
import OfflineDashboardPage from './pages/offline/dashboard/DashboardPage';
import OperationsCenterPage from './pages/offline/operations/OperationsCenterPage';
import TableManagementPage from './pages/offline/tables/TableManagementPage';
import OfflineMenuPage from './pages/offline/menu/MenuManagementPage';
import ServiceDashboardPage from './pages/offline/waiter/ServiceDashboardPage';
import KitchenDisplayPage from './pages/offline/kitchen/KitchenDisplayPage';
import KitchenHistoryPage from './pages/offline/kitchen/KitchenHistoryPage';
import KitchenInventoryView from './pages/offline/kitchen/KitchenInventoryView';
import KOTStatusPage from './pages/offline/waiter/KOTStatusPage';
import ReadyOrdersPage from './pages/offline/waiter/ReadyOrdersPage';
import BillingPage from './pages/offline/billing/BillingPage';
import RecipeInventoryPage from './pages/offline/inventory/RecipeInventoryPage';
import ReportsPage from './pages/offline/reports/ReportsPage';
import QRManagementPage from './pages/offline/qr/QRManagementPage';
import AuditLogsPage from './pages/offline/audit/AuditLogsPage';

// Super Admin Pages
import SuperAdminPage from './pages/superadmin/SuperAdminPage';

// Layout & Notifications
import AdminLayout from './components/AdminLayout';
import NotificationToast from './components/NotificationToast';

// Role Guard Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  const effectiveRole = user.role === 'ADMIN' ? 'RESTAURANT_ADMIN' : user.role;
  const mappedAllowed = allowedRoles.map(r => r === 'ADMIN' ? 'RESTAURANT_ADMIN' : r);

  // SUPER_ADMIN has platform-wide access across all portals
  if (effectiveRole === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return children;
  }

  if (mappedAllowed.length > 0 && !mappedAllowed.includes(effectiveRole) && !mappedAllowed.includes(user.role)) {
    if (user.role === 'KITCHEN' || user.role === 'CHEF') {
      return <Navigate to="/kitchen" replace />;
    }
    if (user.role === 'WAITER') {
      return <Navigate to="/waiter/dashboard" replace />;
    }
    if (user.role === 'DELIVERY_DRIVER' || user.role === 'DRIVER') {
      return <Navigate to="/rider/dashboard" replace />;
    }
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

// Waiter Portal Smart Redirector
const WaiterRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  const waiterRoles = ['WAITER', 'ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN', 'MANAGER'];
  if (!user || !waiterRoles.includes(user.role)) {
    return <Navigate to="/waiter/login" replace />;
  }
  return <Navigate to="/waiter/dashboard" replace />;
};

// Rider Portal Smart Redirector
const RiderRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  const riderRoles = ['DRIVER', 'DELIVERY_DRIVER', 'SUPER_ADMIN'];
  if (!user || !riderRoles.includes(user.role)) {
    return <Navigate to="/driver/login" replace />;
  }
  return <Navigate to="/driver/dashboard" replace />;
};

// Kitchen Portal Smart Redirector
const KitchenRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  const kitchenRoles = ['KITCHEN', 'CHEF', 'ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN', 'MANAGER'];
  if (!user || !kitchenRoles.includes(user.role)) {
    return <Navigate to="/kitchen/login" replace />;
  }
  return <KitchenDisplayPage />;
};

// Admin Restaurant Slug Redirector
const AdminRedirect = () => {
  const { restaurant } = useAuth();
  const slug = restaurant?.slug;
  if (!slug) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8">
        <h2 className="text-2xl font-bold mb-4">No Restaurant Assigned</h2>
        <p className="text-slate-400">Please contact Super Admin to assign you to a restaurant.</p>
      </div>
    );
  }
  return <Navigate to={`/admin/${slug}`} replace />;
};

// Home redirect to published restaurants
const HomeRedirect = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-300 mb-6">
        Hotel & Restaurant Platform
      </h1>
      <p className="text-slate-400 text-lg mb-8 text-center max-w-md">
        Unified online ordering, guest reservation management, and offline KOT kitchen display system.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <a href="/admin/login" className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all text-sm font-bold shadow-lg shadow-amber-500/20">
          Admin Portal Login
        </a>
        <a href="/driver/apply" className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl transition-all text-sm font-bold shadow-lg shadow-orange-500/20">
          Delivery Partner 🛵
        </a>
      </div>
    </div>
  );
};

export default function App() {
  const adminRoles = ['ADMIN', 'RESTAURANT_ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER', 'INVENTORY_MANAGER', 'SUPER_ADMIN'];

  return (
    <>
      <NotificationToast />
      <Routes>
        {/* Home */}
        <Route path="/" element={<HomeRedirect />} />

        {/* Public Customer Online Website */}
        <Route path="/restaurant/:slug" element={<RestaurantMenuPage />} />
        <Route path="/restaurant/:slug/checkout" element={<CheckoutPage />} />
        <Route path="/restaurant/:slug/order/:orderId" element={<OrderTrackingPage />} />

        {/* Public Customer Offline QR Menu & Live Dine-In Tracking */}
        <Route path="/order/table/:token" element={<CustomerQRMenuPage />} />
        <Route path="/order/:orderId/track" element={<CustomerOrderTrackingPage />} />

        {/* Public Rider Application & Driver Auth (Phase 2) */}
        <Route path="/driver/apply" element={<DriverApplicationPage />} />
        <Route path="/driver/login" element={<DriverLoginPage />} />
        <Route path="/driver/dashboard" element={
          <ProtectedRoute allowedRoles={['DRIVER', 'SUPER_ADMIN']}>
            <DriverDashboardPage />
          </ProtectedRoute>
        } />
        {/* Rider aliases */}
        <Route path="/rider" element={<RiderRedirect />} />
        <Route path="/rider/login" element={<DriverLoginPage />} />
        <Route path="/rider/apply" element={<DriverApplicationPage />} />
        <Route path="/rider/register" element={<DriverApplicationPage />} />
        <Route path="/rider/dashboard" element={
          <ProtectedRoute allowedRoles={['DRIVER', 'SUPER_ADMIN']}>
            <DriverDashboardPage />
          </ProtectedRoute>
        } />

        {/* Dedicated Standalone Waiter Station Portal */}
        <Route path="/waiter" element={<WaiterRedirect />} />
        <Route path="/waiter/login" element={<WaiterLoginPage />} />
        <Route path="/waiter/register" element={<WaiterRegisterPage />} />
        <Route path="/waiter/dashboard" element={
          <ProtectedRoute allowedRoles={['WAITER', 'MANAGER', 'ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <WaiterDashboard />
          </ProtectedRoute>
        } />
        <Route path="/waiter/ready" element={
          <ProtectedRoute allowedRoles={['WAITER', 'MANAGER', 'ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <WaiterDashboard />
          </ProtectedRoute>
        } />

        {/* Super Admin Portal */}
        <Route path="/super-admin" element={<SuperAdminPage />} />
        <Route path="/super-admin/login" element={<SuperAdminPage />} />

        {/* Authentication */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register-restaurant" element={<RegisterRestaurantPage />} />

        {/* Dedicated Standalone Kitchen Station Portal (Full-screen for Chefs) */}
        <Route path="/kitchen" element={<KitchenRedirect />} />
        <Route path="/kitchen/login" element={<KitchenLoginPage />} />
        <Route path="/kitchen/register" element={<KitchenRegisterPage />} />
        <Route path="/kds" element={<Navigate to="/kitchen" replace />} />

        {/* ========================================================= */}
        {/* 1. ONLINE RESTAURANT ADMIN ROUTES                        */}
        {/* ========================================================= */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminRedirect />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/menu" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminMenuPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/categories" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminCategoriesPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/orders" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminOrdersPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/history" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminHistoryPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/riders" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminRidersPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/deliveries" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminDeliveriesPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/settings" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminSettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/website" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <AdminWebsitePage />
          </ProtectedRoute>
        } />
        <Route path="/admin/:slug/onboarding" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'RESTAURANT_ADMIN']}>
            <RestaurantOnboarding />
          </ProtectedRoute>
        } />

        {/* ========================================================= */}
        {/* 2. OFFLINE RESTAURANT & KOT SYSTEM ROUTES (Exact 10)     */}
        {/* ========================================================= */}
        <Route path="/admin/offline" element={<Navigate to="/admin/offline/dashboard" replace />} />
        
        {/* 1. Offline Dashboard */}
        <Route path="/admin/offline/dashboard" element={
          <ProtectedRoute allowedRoles={adminRoles}>
            <AdminLayout>
              <OfflineDashboardPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 2. Live Operation Center */}
        <Route path="/admin/offline/operations" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <OperationsCenterPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 3. Table Management */}
        <Route path="/admin/offline/tables" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <TableManagementPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 4. Menu Management */}
        <Route path="/admin/offline/menu" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <OfflineMenuPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 5. Orders */}
        <Route path="/admin/offline/orders" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <ServiceDashboardPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* Order History */}
        <Route path="/admin/offline/history" element={
          <ProtectedRoute allowedRoles={adminRoles}>
            <AdminHistoryPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/history" element={
          <ProtectedRoute allowedRoles={adminRoles}>
            <AdminHistoryPage />
          </ProtectedRoute>
        } />

        {/* 6. Kitchen Display (KDS) */}
        <Route path="/admin/offline/kds" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'KITCHEN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <KitchenDisplayPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 7. Kitchen Display System (Accept/Reject) */}
        <Route path="/admin/offline/kot-status" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <KOTStatusPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 8. Billing & Room Folio */}
        <Route path="/admin/offline/billing" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <BillingPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 9. Receipts & Stocks (Inventory) */}
        <Route path="/admin/offline/inventory" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <RecipeInventoryPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* 10. Reports */}
        <Route path="/admin/offline/reports" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <ReportsPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* Extra KOT Helper Views */}
        <Route path="/admin/offline/qr-codes" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'WAITER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <QRManagementPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/offline/kitchen/history" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'KITCHEN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <KitchenHistoryPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/offline/kitchen/inventory-view" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'KITCHEN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <KitchenInventoryView />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/offline/waiter" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'WAITER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <ServiceDashboardPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/offline/ready-orders" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <ReadyOrdersPage />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/offline/audit-logs" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout>
              <AuditLogsPage />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* Offline Portal Redirect Aliases & Shortcuts */}
        <Route path="/admin/offline/kitchen" element={<Navigate to="/admin/offline/kds" replace />} />
        <Route path="/tables" element={<Navigate to="/admin/offline/tables" replace />} />
        <Route path="/orders" element={<Navigate to="/admin/offline/orders" replace />} />
        <Route path="/kds" element={<Navigate to="/admin/offline/kds" replace />} />
        <Route path="/kitchen" element={<Navigate to="/admin/offline/kds" replace />} />
        <Route path="/billing" element={<Navigate to="/admin/offline/billing" replace />} />
        <Route path="/inventory" element={<Navigate to="/admin/offline/inventory" replace />} />
        <Route path="/reports" element={<Navigate to="/admin/offline/reports" replace />} />
        <Route path="/operations" element={<Navigate to="/admin/offline/operations" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
