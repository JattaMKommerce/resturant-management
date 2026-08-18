import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  // Online Icons
  Globe,
  BedDouble,
  CalendarCheck,
  CreditCard,
  Users,
  ShoppingBag,
  Sparkles,
  ExternalLink,
  LogOut,
  Settings,
  Layers,
  Utensils,
  
  // Offline KOT Icons
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
  Building
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UnifiedSidebar({ restaurant, currentSlug = 'grand-palace' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [offlineOpen, setOfflineOpen] = useState(true);

  const basePath = `/admin/${currentSlug}`;

  // 1. ONLINE HOTEL & STORE MANAGEMENT SECTION
  const onlineNavItems = [
    { name: 'Online Dashboard', path: basePath, icon: LayoutDashboard, exact: true },
    { name: 'Orders Pipeline', path: `${basePath}/orders`, icon: ShoppingBag },
    { name: 'Delivery Riders', path: `${basePath}/riders`, icon: UtensilsCrossed },
    { name: 'Active Fleet Monitor', path: `${basePath}/deliveries`, icon: Globe },
    { name: 'Menu Items', path: `${basePath}/menu`, icon: Utensils },
    { name: 'Categories', path: `${basePath}/categories`, icon: Layers },
    { name: 'Website & Setup', path: `${basePath}/website`, icon: Globe },
    { name: 'Store Settings', path: `${basePath}/settings`, icon: Settings },
  ];

  // 2. OFFLINE RESTAURANT & KOT SECTION (Exact 10 Required Items)
  const offlineNavItems = [
    { name: 'Dashboard', path: '/admin/offline/dashboard', icon: LayoutDashboard },
    { name: 'Live Operation', path: '/admin/offline/operations', icon: Activity },
    { name: 'Table Management', path: '/admin/offline/tables', icon: Grid2X2 },
    { name: 'Menu Management', path: '/admin/offline/menu', icon: UtensilsCrossed },
    { name: 'Orders', path: '/admin/offline/orders', icon: ShoppingBag },
    { name: 'Kitchen Display', path: '/admin/offline/kds', icon: ChefHat },
    { name: 'Kitchen Display System (Accept/Reject)', path: '/admin/offline/kot-status', icon: CheckSquare2 },
    { name: 'Billing & Folio', path: '/admin/offline/billing', icon: Receipt },
    { name: 'Receipts & Stocks', path: '/admin/offline/inventory', icon: Boxes },
    { name: 'Reports', path: '/admin/offline/reports', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed inset-y-0 z-30 shadow-xl text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/70">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black shadow-inner">
          HMS
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-white leading-tight truncate">Hotel & Resort</h1>
          <p className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase">Unified Admin v2.0</p>
        </div>
      </div>

      {/* Active Store Badge */}
      {restaurant && (
        <div className="mx-3 mt-3 p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Building className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-extrabold text-slate-400 block truncate">Active Outlet</span>
              <span className="font-bold text-white text-xs block truncate">{restaurant.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        
        {/* ================= SECTION: ONLINE ================= */}
        <div>
          <button 
            type="button"
            onClick={() => setOnlineOpen(!onlineOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-sky-400 hover:text-sky-300 rounded-lg hover:bg-slate-800/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              Online Management
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${onlineOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {onlineOpen && (
            <div className="mt-1 space-y-0.5 pl-1">
              {onlineNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800/80" />

        {/* ================= SECTION: OFFLINE (KOT) ================= */}
        <div>
          <button 
            type="button"
            onClick={() => setOfflineOpen(!offlineOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
              Offline System (KOT)
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${offlineOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {offlineOpen && (
            <div className="mt-1 space-y-0.5 pl-1">
              {offlineNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-slate-800 space-y-1.5 bg-slate-950/50">
        <Link
          to={`/restaurant/${currentSlug}`}
          target="_blank"
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-orange-400" /> Web Storefront
          </span>
          <span className="text-[10px] text-slate-500">Live ↗</span>
        </Link>

        <button
          onClick={() => {
            logout();
            navigate('/admin/login');
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>

        <div className="text-[10px] text-slate-500 text-center font-medium pt-1 border-t border-slate-800/60">
          HMS Unified Online & Offline v2.0
        </div>
      </div>
    </aside>
  );
}
