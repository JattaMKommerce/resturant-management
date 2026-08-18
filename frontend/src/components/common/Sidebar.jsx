import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Grid2X2, 
  QrCode, 
  Utensils, 
  ShoppingBag, 
  ChefHat, 
  ConciergeBell, 
  Receipt, 
  Boxes, 
  BarChart3, 
  ShieldAlert,
  Clock,
  Bell,
  History,
  CheckCheck,
  Activity
} from 'lucide-react';

const adminNavItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Live Operations', path: '/operations', icon: Activity },
  { name: 'Table Management', path: '/tables', icon: Grid2X2 },
  { name: 'QR Management', path: '/qr-codes', icon: QrCode },
  { name: 'Menu Management', path: '/menu', icon: Utensils },
  { name: 'Orders', path: '/orders', icon: ShoppingBag },
  { name: 'KOT / Order Status', path: '/kot-status', icon: Clock },
  { name: 'Kitchen Display (KDS)', path: '/kds', icon: ChefHat },
  { name: 'Billing', path: '/billing', icon: Receipt },
  { name: 'Recipe & Stock', path: '/inventory', icon: Boxes },
  { name: 'Reports', path: '/reports', icon: BarChart3 },
  { name: 'Audit Logs', path: '/audit-logs', icon: ShieldAlert }
];

const kitchenNavItems = [
  { name: 'Kitchen Dashboard', path: '/dashboard', icon: ChefHat },
  { name: 'KOT Queue', path: '/kds', icon: Clock },
  { name: 'Kitchen Display (KDS)', path: '/kds', icon: Utensils },
  { name: 'Preparation Timers', path: '/kds', icon: Clock },
  { name: 'Ready Orders', path: '/ready-orders', icon: Bell },
  { name: 'Kitchen History', path: '/kitchen/history', icon: History },
  { name: 'Ingredient Availability', path: '/kitchen/inventory-view', icon: Boxes }
];

const waiterNavItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Table Management', path: '/tables', icon: Grid2X2 },
  { name: 'Orders', path: '/orders', icon: ShoppingBag },
  { name: 'KOT / Order Status', path: '/kot-status', icon: Clock },
  { name: 'Ready Orders', path: '/ready-orders', icon: Bell },
  { name: 'Serving', path: '/waiter/serving', icon: CheckCheck },
  { name: 'Billing', path: '/billing', icon: Receipt },
  { name: 'Table QR / QR Ordering', path: '/qr-codes', icon: QrCode }
];

export default function Sidebar() {
  const { user } = useAuth();

  let items = adminNavItems;
  if (user?.role === 'WAITER') {
    items = waiterNavItems;
  } else if (user?.role === 'KITCHEN') {
    items = kitchenNavItems;
  }

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      {/* User Profile Card */}
      {user && (
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-extrabold text-base">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-white truncate">{user.name}</div>
            <div className="text-[11px] font-black text-amber-400 uppercase tracking-wider">{user.role}</div>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <div className="p-4 flex-1 space-y-1 overflow-y-auto">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={`${item.path}-${index}`}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 text-center font-medium">
        GRAND PALACE HMS v1.0
      </div>
    </aside>
  );
}
