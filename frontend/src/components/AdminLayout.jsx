import React, { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { Power, Menu, PanelLeftClose, PanelLeftOpen, Globe } from 'lucide-react';
import UnifiedSidebar from './UnifiedSidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import SubscriptionCountdownBadge from './subscription/SubscriptionCountdownBadge';
import PlanSelectorModal from './subscription/PlanSelectorModal';
import SubscriptionPaywallModal from './subscription/SubscriptionPaywallModal';
import NotificationBellDropdown from './notifications/NotificationBellDropdown';
import IdleSessionGuard from './IdleSessionGuard';
import { useSocket } from '../context/SocketContext';

export default function AdminLayout({ children }) {
  const { user, restaurant, restaurants, updateRestaurant, switchBranch } = useAuth();
  const { socket, joinRoom, leaveRoom } = useSocket();
  const location = useLocation();
  // Restaurant this admin page is showing (/admin/:slug/...). Orders on screen are loaded
  // by this slug, so its alerts must arrive here too.
  const { slug: viewedSlug } = useParams();
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    fetchSubscription();
  }, [location.pathname]);

  // Subscribe Admin socket to real-time notification rooms.
  // Order alerts are only delivered to a restaurant's own rooms, and the server checks
  // this user may manage each one. Subscribe to every restaurant on the account plus
  // the one being viewed; leave them when the admin switches restaurant or logs out.
  const ownedRestaurantKey = (() => {
    const ids = new Set();
    if (restaurant?.id != null) ids.add(String(restaurant.id));
    (Array.isArray(restaurants) ? restaurants : []).forEach((r) => {
      if (r?.id != null) ids.add(String(r.id));
    });
    if (ids.size === 0 && user?.restaurant_id != null) ids.add(String(user.restaurant_id));
    return [...ids].sort().join(',');
  })();

  useEffect(() => {
    joinRoom('admin_room');
    joinRoom('admin');
    const rooms = ownedRestaurantKey ? ownedRestaurantKey.split(',').map((id) => `restaurant_admin_${id}`) : [];
    if (viewedSlug) rooms.push(`restaurant_slug_${viewedSlug}`);
    rooms.forEach((room) => joinRoom(room));
    return () => rooms.forEach((room) => leaveRoom(room));
  }, [ownedRestaurantKey, viewedSlug, joinRoom, leaveRoom]);

  // Real-time synchronization when Super Admin toggles restaurant features
  useEffect(() => {
    if (!socket) return;

    const handleFeaturesUpdated = (data) => {
      const currentRestId = restaurant?.id || user?.restaurant_id;
      if (data && (String(data.restaurantId) === String(currentRestId))) {
        if (updateRestaurant && data.features) {
          updateRestaurant({ features: data.features });
        }
      }
    };

    socket.on('restaurant_features_updated', handleFeaturesUpdated);

    return () => {
      socket.off('restaurant_features_updated', handleFeaturesUpdated);
    };
  }, [socket, restaurant?.id, user?.restaurant_id, updateRestaurant]);

  // Keep the restaurant shown in the header and pages in step with the server: published or not,
  // approved, orders on/off, name, features. The copy saved at sign-in went stale after publishing.
  const lastRestaurantSync = React.useRef(0);
  const syncRestaurant = React.useCallback((force = false) => {
    if (!restaurant?.id) return;
    const now = Date.now();
    if (!force && now - lastRestaurantSync.current < 10000) return;
    lastRestaurantSync.current = now;
    api.get('/admin/restaurant')
      .then((res) => {
        const r = res.data?.restaurant;
        if (!res.data?.success || !r || Number(r.id) !== Number(restaurant.id)) return;
        updateRestaurant({
          name: r.name, slug: r.slug, logo_url: r.logo_url, status: r.status,
          website_status: r.website_status, is_online_ordering_enabled: r.is_online_ordering_enabled,
          ...(r.features ? { features: r.features } : {})
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);
  useEffect(() => { syncRestaurant(); }, [location.pathname, syncRestaurant]);
  useEffect(() => {
    const onFocus = () => syncRestaurant();
    const onChanged = () => syncRestaurant(true);
    window.addEventListener('focus', onFocus);
    window.addEventListener('hms_restaurant_changed', onChanged);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('hms_restaurant_changed', onChanged);
    };
  }, [syncRestaurant]);

  const fetchSubscription = async () => {
    try {
      const role = String(user?.role || '').toUpperCase();
      if (!['ADMIN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN', 'OWNER', 'HOTEL_ADMIN'].includes(role)) return; // staff don't manage the plan
      const res = await api.get('/admin/subscription/status');
      if (res.data.success) {
        setSubscription(res.data.data);
      }
    } catch (err) {
      // Ignored if unauthenticated or on public routes
    }
  };

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('admin_sidebar_collapsed', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.includes('/subscription')) return 'SaaS Plan & Billing Subscriptions';
    if (p.includes('/orders')) return 'Live Order Processing';
    if (p.includes('/history')) return 'Historical Order Intelligence';
    if (p.includes('/staff')) return 'Restaurant Staff & Access Controls';
    if (p.includes('/riders')) return 'Dedicated Delivery Fleet';
    if (p.includes('/deliveries')) return 'Live Delivery Monitor';
    if (p.includes('/menu')) return 'Menu Catalog Management';
    if (p.includes('/categories')) return 'Menu Category Tax & Structuring';
    if (p.includes('/website')) return 'Website Builder & Visual Setup';
    if (p.includes('/settings')) return 'Store Operational Controls & Rules';
    if (p.includes('/operations')) return 'Live Offline Restaurant Operations';
    if (p.includes('/tables')) return 'Dining Room & Table Layouts';
    if (p.includes('/kds')) return 'Kitchen Display System (KDS)';
    if (p.includes('/kot-status')) return 'KOT Ticket Dispatch Queue';
    if (p.includes('/billing')) return 'Guest Billing, Payments & Folio';
    if (p.includes('/inventory')) return 'Recipe Formulations & Raw Stocks';
    if (p.includes('/reports')) return 'Sales & Audit Reports';
    return 'Hotel & Restaurant Control Centre';
  };

  const handleToggleOnlineOrdering = async () => {
    if (!restaurant) return;
    setLoadingToggle(true);
    try {
      const nextState = !Boolean(restaurant.is_online_ordering_enabled);
      const res = await api.post('/admin/restaurant/toggle-ordering', {
        enabled: nextState,
        is_online_ordering_enabled: nextState
      });
      if (res.data.success) {
        const updatedRest = res.data.restaurant || { ...restaurant, is_online_ordering_enabled: nextState ? 1 : 0 };
        if (updateRestaurant) {
          updateRestaurant(updatedRest);
        }
      }
    } catch (err) {
      console.error('Failed to toggle online ordering status:', err);
    } finally {
      setLoadingToggle(false);
    }
  };

  const isSubscriptionRoute = location.pathname.includes('/subscription');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const shouldBlockWithPaywall = !isSuperAdmin && !isSubscriptionRoute && subscription && (subscription.status === 'EXPIRED' || !subscription.has_subscription);

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex font-sans antialiased relative">
      
      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Global Unified Light Sidebar */}
      <UnifiedSidebar 
        restaurant={restaurant} 
        currentSlug={restaurant?.slug || 'grand-palace'}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[270px]'
        }`}
      >
        
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#D7E5E8] shadow-xs px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left Title & Mobile Hamburger Button */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-1 text-[#1F2937] hover:bg-slate-100 rounded-xl lg:hidden shrink-0 border border-[#D7E5E8] transition-colors cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-[#3A7D7C]" />
            </button>

            {/* Desktop Collapse/Expand toggle button in header */}
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="hidden lg:flex p-2 -ml-2 text-[#64748B] hover:text-[#1F2937] rounded-xl hover:bg-[#EAF4F7] transition-colors shrink-0 cursor-pointer"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base lg:text-lg font-bold text-[#1F2937] truncate leading-tight">
                {getPageTitle()}
              </h2>
              <p className="text-[10px] sm:text-xs text-[#64748B] font-semibold truncate mt-0.5 flex items-center gap-1.5">
                {/* Branch switcher (REQ-009): owners of several branches pick the one to work on */}
                {Array.isArray(restaurants) && restaurants.length > 1 ? (
                  <select
                    aria-label="Branch"
                    value={restaurant?.id || ''}
                    onChange={(e) => switchBranch(restaurants.find((r) => String(r.id) === e.target.value))}
                    className="max-w-[160px] sm:max-w-[220px] truncate bg-transparent text-[#3A7D7C] font-bold border border-[#D7E5E8] rounded-lg px-1.5 py-0.5 cursor-pointer"
                  >
                    {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                ) : (
                  <span className="text-[#3A7D7C] font-bold">{restaurant?.name || 'Restaurant Admin'}</span>
                )}
                <span className="hidden sm:inline">• Unified Operational Control</span>
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Notification Bell with Unread Count */}
            <NotificationBellDropdown />

            {/* SaaS Subscription Live Countdown Pill (phones: own row below the header) */}
            {subscription && (
              <div className="hidden sm:block">
                <SubscriptionCountdownBadge
                  subscription={subscription}
                  compact={true}
                  onExpire={() => fetchSubscription()}
                  onOpenRenew={() => setShowPlanModal(true)}
                />
              </div>
            )}

            {/* ONLINE ORDERING TOGGLE BUTTON */}
            {restaurant && (() => {
              const isOrderingOn = Boolean(restaurant.is_online_ordering_enabled);
              const isPublished = restaurant.website_status === 'PUBLISHED';
              const isActive = restaurant.status === 'ACTIVE';

              // Plain-language store state. A website that isn't published yet can't take orders,
              // so it gets a "Publish" button instead of an on/off switch that looks contradictory.
              // Suspended or still awaiting approval: no switch, just say so.
              if (restaurant.status === 'SUSPENDED' || (isPublished && !isActive)) {
                const suspended = restaurant.status === 'SUSPENDED';
                return (
                  <div className={`flex flex-col text-right px-3 py-1.5 rounded-xl border shadow-2xs ${suspended ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                    <span className={`text-[9px] font-bold uppercase ${suspended ? 'text-rose-800' : 'text-amber-800'}`}>Online store</span>
                    <span className={`text-[11px] font-bold ${suspended ? 'text-rose-900' : 'text-amber-900'}`}>{suspended ? 'Suspended' : 'Awaiting approval'}</span>
                  </div>
                );
              }
              if (!isPublished) {
                return (
                  <div className="flex items-center gap-2 sm:gap-3 bg-amber-50 p-1.5 sm:p-2 sm:px-3.5 rounded-xl border border-amber-200 shadow-2xs">
                    <div className="hidden sm:flex flex-col text-right">
                      <span className="text-[9px] font-bold uppercase text-amber-800">Online store</span>
                      <span className="text-[11px] font-bold text-amber-900">Not published yet</span>
                    </div>
                    <Link
                      to={`/admin/${restaurant.slug || viewedSlug || ''}/setup-wizard`}
                      className="p-2 sm:px-3 sm:py-2 rounded-xl font-bold flex items-center gap-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 shadow-2xs"
                      title="Finish the setup steps and publish your ordering website"
                      aria-label="Online store not published yet. Publish it"
                    >
                      <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden md:inline">Publish website</span>
                    </Link>
                  </div>
                );
              }
              let statusText = 'Accepting orders';
              let statusClass = 'text-emerald-700 font-bold';
              if (!isOrderingOn) {
                statusText = 'Orders paused';
                statusClass = 'text-rose-700 font-bold';
              }

              return (
                <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 p-1.5 sm:p-2 sm:px-3.5 rounded-xl border border-[#D7E5E8] shadow-2xs">
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-[9px] font-bold uppercase text-[#64748B]">Online orders</span>
                    <span className={`text-[11px] font-bold ${statusClass}`}>
                      {statusText}
                    </span>
                  </div>

                  <button
                    onClick={handleToggleOnlineOrdering}
                    disabled={loadingToggle}
                    className={`p-2 sm:px-3 sm:py-2 rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs text-white shadow-2xs cursor-pointer ${
                      isOrderingOn
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                    title={isOrderingOn ? 'Stop taking online orders for now' : 'Start taking online orders again'}
                    aria-label={`Online ordering is ${isOrderingOn ? 'on' : 'off'}. Turn it ${isOrderingOn ? 'off' : 'on'}`}
                  >
                    <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden md:inline">
                      {loadingToggle ? 'Updating…' : isOrderingOn ? 'Pause orders' : 'Resume orders'}
                    </span>
                  </button>
                </div>
              );
            })()}

            {/* Admin Profile Avatar (hidden on phones to keep room for the page name) */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-3 border-l border-[#D7E5E8] pl-2 sm:pl-4">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#3A7D7C] text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-2xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden md:block">
                <span className="font-bold text-xs text-[#1F2937] block leading-none truncate max-w-[120px]">{user?.name || 'Admin User'}</span>
                <span className="text-[10px] font-semibold text-[#64748B] block mt-1 truncate max-w-[120px]">{user?.email}</span>
              </div>
            </div>

          </div>
        </header>
        {subscription && (
          <div className="sm:hidden px-4 pt-3 flex">
            <SubscriptionCountdownBadge
              subscription={subscription}
              compact={true}
              onExpire={() => fetchSubscription()}
              onOpenRenew={() => setShowPlanModal(true)}
            />
          </div>
        )}

        {/* Dynamic Responsive Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Automatic logout after inactivity (REQ-014) */}
      <IdleSessionGuard loginPath="/admin/login" />

      {/* Blocking Paywall Modal if subscription is expired and user is not on subscription page */}
      {shouldBlockWithPaywall && (
        <SubscriptionPaywallModal
          subscription={subscription}
          onRenewed={() => fetchSubscription()}
        />
      )}

      {/* Plan Selector Modal */}
      <PlanSelectorModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSuccess={() => fetchSubscription()}
        currentPlanId={subscription?.plan_id}
      />

    </div>
  );
}
