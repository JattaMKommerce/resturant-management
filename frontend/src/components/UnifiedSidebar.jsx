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
  ChevronDown,
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
        bg-white border-r border-[#D7E5E8] flex flex-col fixed inset-y-0 left-0 z-50
        shadow-xs text-[#1F2937] select-none transition-all duration-300 ease-in-out
        ${isCollapsed ? 'lg:w-20' : 'lg:w-[270px]'}
        w-72 max-w-[85vw]
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Brand Header */}
      <div className={`p-3.5 border-b border-[#D7E5E8] bg-[#EAF4F7] flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-between'} h-16 shrink-0`}>
        {/* Expanded Header */}
        <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'lg:hidden' : 'flex'}`}>
          <div className="w-10 h-10 rounded-xl bg-[#3A7D7C] text-white font-bold flex items-center justify-center shadow-xs shrink-0 text-sm tracking-wider">
            HMS
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[#1F2937] leading-tight truncate">
              {restaurant?.name || 'Restaurant Admin'}
            </h1>
            <p className="text-[10px] text-[#3A7D7C] font-bold tracking-wider uppercase">Unified Admin Console</p>
          </div>
        </div>

        {/* Collapsed Header Icon */}
        {isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex w-10 h-10 rounded-xl bg-[#3A7D7C] text-white font-bold items-center justify-center shadow-xs hover:bg-[#2F6665] transition-colors text-xs"
            title="Expand Sidebar"
          >
            HMS
          </button>
        )}

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-2 text-[#64748B] hover:text-[#1F2937] rounded-lg hover:bg-slate-100 lg:hidden"
          title="Close Navigation"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop Collapse Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`hidden lg:flex p-1.5 rounded-lg text-[#64748B] hover:text-[#1F2937] hover:bg-white border border-transparent hover:border-[#D7E5E8] transition-colors ${isCollapsed ? 'hidden' : ''}`}
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
        
        {/* SECTION 1: ONLINE HOTEL & STORE MANAGEMENT */}
        <div className="space-y-1">
          <button
            onClick={() => setOnlineOpen(!onlineOpen)}
            className={`w-full flex items-center ${
              isCollapsed ? 'lg:justify-center' : 'justify-between'
            } px-2 py-1 text-[10px] font-bold text-[#3A7D7C] uppercase tracking-wider hover:text-[#2F6665] transition-colors`}
          >
            <span className={isCollapsed ? 'lg:hidden' : 'inline'}>1. Online Store</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${onlineOpen ? '' : '-rotate-90'} ${isCollapsed ? 'lg:hidden' : 'inline'}`} />
          </button>

          {onlineOpen && (
            <div className="space-y-0.5 pt-0.5">
              {onlineNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    end={item.exact}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      `flex items-center ${
                        isCollapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:p-0 lg:mx-auto group relative' : 'justify-start gap-2.5'
                      } px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-[#3A7D7C] text-white shadow-2xs font-bold'
                          : 'text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'inline'}`}>{item.name}</span>

                    {/* Collapsed Tooltip */}
                    {isCollapsed && (
                      <div className="fixed left-20 ml-2 px-2.5 py-1 bg-white border border-[#D7E5E8] text-[#1F2937] text-xs font-bold rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap hidden lg:block">
                        {item.name}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: OFFLINE RESTAURANT & KOT MANAGEMENT */}
        <div className="space-y-1 pt-2 border-t border-[#D7E5E8]">
          <button
            onClick={() => setOfflineOpen(!offlineOpen)}
            className={`w-full flex items-center ${
              isCollapsed ? 'lg:justify-center' : 'justify-between'
            } px-2 py-1 text-[10px] font-bold text-[#3A7D7C] uppercase tracking-wider hover:text-[#2F6665] transition-colors`}
          >
            <span className={isCollapsed ? 'lg:hidden' : 'inline'}>2. Offline KOT & Floor</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${offlineOpen ? '' : '-rotate-90'} ${isCollapsed ? 'lg:hidden' : 'inline'}`} />
          </button>

          {offlineOpen && (
            <div className="space-y-0.5 pt-0.5">
              {offlineNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      `flex items-center ${
                        isCollapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:p-0 lg:mx-auto group relative' : 'justify-start gap-2.5'
                      } px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-[#3A7D7C] text-white shadow-2xs font-bold'
                          : 'text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'inline'}`}>{item.name}</span>

                    {/* Collapsed Tooltip */}
                    {isCollapsed && (
                      <div className="fixed left-20 ml-2 px-2.5 py-1 bg-white border border-[#D7E5E8] text-[#1F2937] text-xs font-bold rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap hidden lg:block">
                        {item.name}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: ACCOUNT & SETTINGS */}
        <div className="space-y-1 pt-2 border-t border-[#D7E5E8]">
          <div
            className={`px-2 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider ${
              isCollapsed ? 'lg:text-center' : 'text-left'
            }`}
          >
            <span className={isCollapsed ? 'lg:hidden' : 'inline'}>Account & Settings</span>
          </div>

          <div className="space-y-0.5 pt-0.5">
            <NavLink
              to="/admin/offline/subscription"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center ${
                  isCollapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:p-0 lg:mx-auto group relative' : 'justify-start gap-2.5'
                } px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-[#3A7D7C] text-white shadow-2xs font-bold'
                    : 'text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7]'
                }`
              }
              title="Hotel SaaS Subscription"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'inline'}`}>SaaS Subscription</span>
              {isCollapsed && (
                <div className="fixed left-20 ml-2 px-2.5 py-1 bg-white border border-[#D7E5E8] text-[#1F2937] text-xs font-bold rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap hidden lg:block">
                  SaaS Subscription
                </div>
              )}
            </NavLink>
          </div>
        </div>

      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-[#D7E5E8] bg-[#EAF4F7]/40 space-y-2 shrink-0">

        {/* Quick Customer Store Link */}
        <Link
          to={`/restaurant/${activeSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center ${
            isCollapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:p-0 lg:mx-auto' : 'justify-between'
          } px-3 py-2 bg-white hover:bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs font-bold text-[#1F2937] transition-all shadow-2xs`}
          title="Open Live Online Ordering Website"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#3A7D7C]" />
            <span className={isCollapsed ? 'lg:hidden' : 'inline'}>View Live Store</span>
          </div>
          <ExternalLink className={`w-3.5 h-3.5 text-[#64748B] ${isCollapsed ? 'lg:hidden' : 'inline'}`} />
        </Link>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${
            isCollapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:p-0 lg:mx-auto' : 'justify-center'
          } gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors shadow-2xs`}
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className={isCollapsed ? 'lg:hidden' : 'inline'}>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
