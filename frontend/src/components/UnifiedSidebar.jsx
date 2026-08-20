import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Globe,
  ShoppingBag,
  ExternalLink,
  LogOut,
  Settings,
  Layers,
  Utensils,
  LayoutDashboard,
  Activity,
  Grid2X2,
  UtensilsCrossed,
  ChefHat,
  CheckSquare2,
  Receipt,
  Boxes,
  BarChart3,
  Building,
  History,
  Users,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UnifiedSidebar({
  restaurant,
  currentSlug = 'grand-palace',
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [offlineOpen, setOfflineOpen] = useState(true);

  // Dynamically resolve base slug path
  const activeSlug = currentSlug || restaurant?.slug || user?.restaurant_slug || 'grand-palace';
  const basePath = `/admin/${activeSlug}`;

  // 1. ONLINE HOTEL & STORE MANAGEMENT SECTION
  const onlineNavItems = [
    { name: 'Online Dashboard', path: basePath, icon: LayoutDashboard, exact: true },
    { name: 'Orders Pipeline', path: `${basePath}/orders`, icon: ShoppingBag },
    { name: 'Order History & Archive', path: `${basePath}/history`, icon: History },
    { name: 'Staff Management', path: `${basePath}/staff`, icon: Users },
    { name: 'Delivery Riders', path: `${basePath}/riders`, icon: UtensilsCrossed },
    { name: 'Active Fleet Monitor', path: `${basePath}/deliveries`, icon: Globe },
    { name: 'Menu Items', path: `${basePath}/menu`, icon: Utensils },
    { name: 'Categories', path: `${basePath}/categories`, icon: Layers },
    { name: 'Website & Setup', path: `${basePath}/website`, icon: Globe },
    { name: 'Store Settings', path: `${basePath}/settings`, icon: Settings },
  ];

  // 2. OFFLINE RESTAURANT & KOT SECTION
  const offlineNavItems = [
    { name: 'Dashboard', path: '/admin/offline/dashboard', icon: LayoutDashboard },
    { name: 'Live Operation', path: '/admin/offline/operations', icon: Activity },
    { name: 'Staff & Access', path: '/admin/offline/staff', icon: Users },
    { name: 'Table Management', path: '/admin/offline/tables', icon: Grid2X2 },
    { name: 'Menu Management', path: '/admin/offline/menu', icon: UtensilsCrossed },
    { name: 'Orders', path: '/admin/offline/orders', icon: ShoppingBag },
    { name: 'Order History', path: '/admin/offline/history', icon: History },
    { name: 'Kitchen Display', path: '/admin/offline/kds', icon: ChefHat },
    { name: 'Kitchen Display System (Accept/Reject)', path: '/admin/offline/kot-status', icon: CheckSquare2 },
    { name: 'Billing & Folio', path: '/admin/offline/billing', icon: Receipt },
    { name: 'Receipts & Stocks', path: '/admin/offline/inventory', icon: Boxes },
    { name: 'Reports', path: '/admin/offline/reports', icon: BarChart3 },
  ];

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleLogout = () => {
    if (onCloseMobile) onCloseMobile();
    logout();
    navigate('/admin/login');
  };

  return (
    <aside
      className={`
        bg-slate-900 border-r border-slate-800 flex flex-col fixed inset-y-0 left-0 z-50
        shadow-2xl text-slate-300 select-none transition-all duration-300 ease-in-out
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        w-72 max-w-[85vw]
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Brand Header */}
      <div className={`p-4 border-b border-slate-800/80 bg-slate-950/90 flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-between'} h-16 shrink-0`}>
        {/* Expanded Header */}
        <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'lg:hidden' : 'flex'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0 text-sm tracking-wider">
            HMS
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-white leading-tight truncate">
              {restaurant?.name || 'Restaurant Admin'}
            </h1>
            <p className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">Unified Admin Console</p>
          </div>
        </div>

        {/* Collapsed Header Icon (Click to toggle) */}
        {isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 text-slate-950 font-black items-center justify-center shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform text-xs"
            title="Click to expand sidebar"
          >
            HMS
          </button>
        )}

        {/* Mobile Close (X) Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 lg:hidden border border-slate-800 transition-colors"
          title="Close Navigation Drawer"
          aria-label="Close Navigation Drawer"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>

        {/* Desktop Collapse Button (Expanded mode) */}
        {!isCollapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active Outlet Badge */}
      {restaurant && (
        <div className={`transition-all shrink-0 ${isCollapsed ? 'lg:px-2 lg:pt-3' : 'px-3 pt-3'}`}>
          {isCollapsed ? (
            <div className="hidden lg:flex justify-center group relative">
              <div
                className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-orange-400"
                title={restaurant.name}
              >
                <Building className="w-4 h-4" />
              </div>
              {/* Tooltip on hover */}
              <div className="fixed left-20 ml-2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white text-[11px] font-bold rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                {restaurant.name}
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                  <Building className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-black text-slate-400 block leading-tight">Current Outlet</span>
                  <span className="font-bold text-white text-xs block truncate leading-tight mt-0.5">{restaurant.name}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Links Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
        
        {/* ================= SECTION 1: ONLINE HOTEL & STORE ================= */}
        <div>
          {isCollapsed ? (
            <div className="hidden lg:flex items-center justify-center my-1.5" title="Online Management">
              <div className="w-6 h-1 rounded-full bg-sky-500/30" />
            </div>
          ) : (
            <button 
              type="button"
              onClick={() => setOnlineOpen(!onlineOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-sky-400 hover:text-sky-300 rounded-lg hover:bg-slate-800/40 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Online Store & Delivery</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${onlineOpen ? 'rotate-0' : '-rotate-90'}`} />
            </button>
          )}

          {(onlineOpen || isCollapsed) && (
            <div className={`mt-1 space-y-1 ${isCollapsed ? 'lg:flex lg:flex-col lg:items-center' : ''}`}>
              {onlineNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    end={item.exact}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      isCollapsed
                        ? `group relative hidden lg:flex w-10 h-10 rounded-xl items-center justify-center transition-all ${
                            isActive
                              ? 'bg-sky-500 text-white font-bold shadow-lg shadow-sky-500/25 ring-1 ring-sky-400/50'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                          }`
                        : `flex items-center px-3 py-2 rounded-xl text-xs font-semibold transition-all gap-2.5 ${
                            isActive
                              ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/30'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`
                    }
                  >
                    <Icon className={isCollapsed ? 'w-4 h-4' : 'w-4 h-4 shrink-0'} />
                    <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'inline'}`}>{item.name}</span>

                    {/* Floating Tooltip in Collapsed Mode */}
                    {isCollapsed && (
                      <div className="fixed left-20 ml-2 px-2.5 py-1 bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-lg shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                        {item.name}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800/80 my-1" />

        {/* ================= SECTION 2: OFFLINE RESTAURANT & KOT ================= */}
        <div>
          {isCollapsed ? (
            <div className="hidden lg:flex items-center justify-center my-1.5" title="Offline System (KOT)">
              <div className="w-6 h-1 rounded-full bg-amber-500/30" />
            </div>
          ) : (
            <button 
              type="button"
              onClick={() => setOfflineOpen(!offlineOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800/40 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Offline KOT & Dine-In</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${offlineOpen ? 'rotate-0' : '-rotate-90'}`} />
            </button>
          )}

          {(offlineOpen || isCollapsed) && (
            <div className={`mt-1 space-y-1 ${isCollapsed ? 'lg:flex lg:flex-col lg:items-center' : ''}`}>
              {offlineNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      isCollapsed
                        ? `group relative hidden lg:flex w-10 h-10 rounded-xl items-center justify-center transition-all ${
                            isActive
                              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 ring-1 ring-amber-400/50'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                          }`
                        : `flex items-center px-3 py-2 rounded-xl text-xs font-semibold transition-all gap-2.5 ${
                            isActive
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`
                    }
                  >
                    <Icon className={isCollapsed ? 'w-4 h-4' : 'w-4 h-4 shrink-0'} />
                    <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'inline'}`}>{item.name}</span>

                    {/* Floating Tooltip in Collapsed Mode */}
                    {isCollapsed && (
                      <div className="fixed left-20 ml-2 px-2.5 py-1 bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-lg shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                        {item.name}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Footer Area: Public Website Preview & Logout */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 space-y-2 shrink-0">
        {/* Public Store Preview Link */}
        {restaurant?.slug && !isCollapsed && (
          <a
            href={`/restaurant/${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
            className="flex items-center justify-between px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-800 transition-colors group"
          >
            <span className="flex items-center gap-2 truncate">
              <Globe className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="truncate">View Public Store</span>
            </span>
            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white shrink-0" />
          </a>
        )}

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2'} rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border border-rose-500/20`}
          title="Sign out of Admin Session"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
