import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
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
    <aside className="w-[270px] bg-white border-r border-[#D7E5E8] flex flex-col fixed inset-y-0 z-30 shadow-xs text-[#1F2937] select-none">
      {/* Brand Header */}
      <div className="p-3.5 border-b border-[#D7E5E8] flex items-center gap-3 bg-[#EAF4F7]">
        <div className="w-10 h-10 rounded-xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
          HMS
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-[#1F2937] leading-tight truncate">Hotel & Resort</h1>
          <p className="text-[10px] text-[#3A7D7C] font-bold tracking-wider uppercase">Unified Admin v2.0</p>
        </div>
      </div>

      {/* Active Store Badge */}
      {restaurant && (
        <div className="mx-3 mt-3 p-2.5 bg-slate-50 rounded-xl border border-[#D7E5E8] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Building className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-[#64748B] block truncate">Active Outlet</span>
              <span className="font-bold text-[#1F2937] text-xs block truncate">{restaurant.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 custom-scrollbar">
        
        {/* ================= SECTION: ONLINE ================= */}
        <div>
          <button 
            type="button"
            onClick={() => setOnlineOpen(!onlineOpen)}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#3A7D7C] hover:text-[#2F6665] rounded-lg hover:bg-[#EAF4F7] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#3A7D7C]" />
              Online Management
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${onlineOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {onlineOpen && (
            <div className="mt-1 space-y-0.5 pl-0.5">
              {onlineNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-[#3A7D7C] text-white shadow-2xs font-bold'
                          : 'text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7]'
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
        <div className="border-t border-[#D7E5E8]" />

        {/* ================= SECTION: OFFLINE (KOT) ================= */}
        <div>
          <button 
            type="button"
            onClick={() => setOfflineOpen(!offlineOpen)}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#3A7D7C] hover:text-[#2F6665] rounded-lg hover:bg-[#EAF4F7] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-[#3A7D7C]" />
              Offline System (KOT)
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${offlineOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {offlineOpen && (
            <div className="mt-1 space-y-0.5 pl-0.5">
              {offlineNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-[#3A7D7C] text-white shadow-2xs font-bold'
                          : 'text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7]'
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
      <div className="p-3 border-t border-[#D7E5E8] space-y-1.5 bg-[#EAF4F7]/40">
        <Link
          to={`/restaurant/${currentSlug}`}
          target="_blank"
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-xs font-bold text-[#1F2937] transition-colors shadow-2xs"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-[#3A7D7C]" /> Web Storefront
          </span>
          <span className="text-[10px] text-[#64748B]">Live ↗</span>
        </Link>

        <button
          onClick={() => {
            logout();
            navigate('/admin/login');
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>

        <div className="text-[10px] text-[#64748B] text-center font-medium pt-1 border-t border-[#D7E5E8]">
          HMS Unified Online & Offline v2.0
        </div>
      </div>
    </aside>
  );
}
