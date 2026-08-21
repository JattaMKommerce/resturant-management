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
    <aside className="w-64 bg-white border-r border-[#D7E5E8] flex flex-col shrink-0 min-h-[calc(100vh-4rem)] shadow-xs font-sans antialiased">
      {/* User Profile Card */}
      {user && (
        <div className="p-4 border-b border-[#D7E5E8] bg-[#EAF4F7]/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-[#1F2937] truncate">{user.name}</div>
            <div className="text-[10px] font-semibold text-[#3A7D7C] uppercase tracking-wider">{user.role}</div>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <div className="p-3 flex-1 space-y-1 overflow-y-auto custom-scrollbar">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={`${item.path}-${index}`}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#3A7D7C] text-white font-bold shadow-2xs'
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

      <div className="p-3 border-t border-[#D7E5E8] text-[10px] text-[#64748B] text-center font-semibold bg-[#EAF4F7]/20">
        GRAND PALACE HMS
      </div>
    </aside>
  );
}
