import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Power, Menu, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../api/axios';

import UnifiedSidebar from './UnifiedSidebar';

export default function AdminLayout({ children }) {
  const { user } = useAuth();
  const { socket, joinRoom } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState(null);
  const [loadingToggle, setLoadingToggle] = useState(false);

  // Responsive Sidebar States
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Extract slug from URL pathname: /admin/:slug/*
  const pathParts = location.pathname.split('/');
  const routeSlug = (pathParts[1] === 'admin' && pathParts[2] && pathParts[2] !== 'offline') ? pathParts[2] : null;

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    fetchRestaurant();
  }, [routeSlug]);

  useEffect(() => {
    if (restaurant?.id) {
      joinRoom(`restaurant_admin_${restaurant.id}`);
      joinRoom('admin_room');
    }
  }, [restaurant?.id, socket]);

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed(prev => {
      const nextVal = !prev;
      try {
        localStorage.setItem('admin_sidebar_collapsed', String(nextVal));
      } catch (e) {
        console.error(e);
      }
      return nextVal;
    });
  };

  const fetchRestaurant = async () => {
    try {
      const url = routeSlug ? `/admin/restaurant?slug=${routeSlug}` : '/admin/restaurant';
      const res = await api.get(url);
      if (res.data.success) {
        setRestaurant(res.data.restaurant);
      }
    } catch (err) {
      console.error('Failed to fetch restaurant settings:', err);
    }
  };

  const handleToggleOnlineOrdering = async () => {
    if (!restaurant) return;
    setLoadingToggle(true);
    const newStatus = Number(restaurant.is_online_ordering_enabled) === 1 ? 0 : 1;

    try {
      const res = await api.post('/admin/restaurant/toggle-ordering', {
        enabled: newStatus === 1,
        restaurantId: restaurant.id,
        slug: restaurant.slug
      });
      if (res.data.success) {
        setRestaurant(prev => ({ ...prev, is_online_ordering_enabled: newStatus }));
      }
    } catch (err) {
      console.error('Failed to toggle ordering:', err);
      alert('Failed to update Online Ordering setting');
    } finally {
      setLoadingToggle(false);
    }
  };

  const currentSlug = routeSlug || restaurant?.slug || 'grand-palace';

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/admin/offline/dashboard')) return 'Offline Dashboard';
    if (path.includes('/admin/offline/operations')) return 'Live Operation Center';
    if (path.includes('/admin/offline/tables')) return 'Table Management';
    if (path.includes('/admin/offline/menu')) return 'Offline Menu Management';
    if (path.includes('/admin/offline/orders')) return 'Restaurant Orders';
    if (path.includes('/admin/offline/kds')) return 'Kitchen Display (KDS)';
    if (path.includes('/admin/offline/kot-status')) return 'KDS Accept / Reject';
    if (path.includes('/admin/offline/billing')) return 'Billing & Room Folio';
    if (path.includes('/admin/offline/inventory')) return 'Receipts & Stocks (Inventory)';
    if (path.includes('/admin/offline/reports')) return 'Reports & Analytics';
    if (path.includes('/admin/offline/qr-codes')) return 'QR Codes';
    if (path.includes('/admin/offline/audit-logs')) return 'Audit Logs';
    if (path.includes('/history')) return 'Past History & Archive';
    if (path.includes('/orders')) return 'Online Orders Pipeline';
    if (path.includes('/riders')) return 'Delivery Partner Fleet';
    if (path.includes('/deliveries')) return 'Active Fleet Monitor';
    if (path.includes('/menu')) return 'Online Menu Items';
    if (path.includes('/categories')) return 'Online Categories';
    if (path.includes('/website')) return 'Website & Online Store';
    if (path.includes('/settings')) return 'Restaurant Settings';
    if (path.includes('/onboarding')) return 'Restaurant Setup Wizard';
    return 'Admin Console';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans relative overflow-x-hidden">
      
      {/* Mobile Drawer Backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Unified Sidebar */}
      <UnifiedSidebar 
        restaurant={restaurant} 
        currentSlug={currentSlug}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        } pl-0`}
      >
        
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3">
          
          {/* Left Title & Sidebar Toggles */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-1 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 lg:hidden shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Quick Collapse/Expand button in header */}
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="hidden lg:flex p-2 -ml-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-white truncate leading-tight">
                {getPageTitle()}
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate mt-0.5">
                {restaurant?.name || 'Grand Palace'} <span className="hidden sm:inline">• Unified Operational Control</span>
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            
            {/* ONLINE ORDERING TOGGLE BUTTON */}
            {restaurant && (() => {
              const isOrderingOn = Number(restaurant.is_online_ordering_enabled) === 1 || restaurant.is_online_ordering_enabled === true;
              const isPublished = restaurant.website_status === 'PUBLISHED';
              const isActive = restaurant.status === 'ACTIVE';

              let statusText = 'ONLINE';
              let statusClass = 'text-emerald-400';
              if (!isOrderingOn) {
                statusText = 'OFFLINE';
                statusClass = 'text-rose-400';
              } else if (!isPublished) {
                statusText = 'DRAFT';
                statusClass = 'text-amber-400';
              } else if (!isActive) {
                statusText = 'INACTIVE';
                statusClass = 'text-rose-400';
              }

              return (
                <div className="flex items-center gap-2 sm:gap-3 bg-slate-950/80 p-1.5 sm:p-2 sm:px-3 rounded-xl border border-slate-800 shadow-xs">
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-[9px] font-extrabold uppercase text-slate-400">Ordering</span>
                    <span className={`text-[11px] font-black ${statusClass}`}>
                      {statusText}
                    </span>
                  </div>

                  <button
                    onClick={handleToggleOnlineOrdering}
                    disabled={loadingToggle}
                    className={`p-2 sm:px-3 sm:py-2 rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs text-white shadow-sm ${
                      isOrderingOn
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    }`}
                    title={!isPublished ? "Master toggle is ON, but website is in DRAFT state. Publish website in Website Controls." : "Toggle Online Store Order Acceptances"}
                  >
                    <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden md:inline">
                      {loadingToggle ? 'Updating...' : isOrderingOn ? 'Turn Store OFF' : 'Turn Store ON'}
                    </span>
                  </button>
                </div>
              );
            })()}

            {/* Admin Profile */}
            <div className="flex items-center gap-2 sm:gap-3 border-l border-slate-800 pl-2 sm:pl-4">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-md shadow-orange-500/20 shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden md:block">
                <span className="font-bold text-xs text-white block leading-none truncate max-w-[120px]">{user?.name || 'Admin User'}</span>
                <span className="text-[10px] font-semibold text-slate-400 block mt-1 truncate max-w-[120px]">{user?.email}</span>
              </div>
            </div>

          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

    </div>
  );
}
