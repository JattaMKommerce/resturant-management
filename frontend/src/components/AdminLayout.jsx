import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, UtensilsCrossed, Utensils, Layers, ShoppingBag, 
  Settings, LogOut, ExternalLink, Building, Globe, Power, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../api/axios';

import UnifiedSidebar from './UnifiedSidebar';

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const { socket, joinRoom } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState(null);
  const [loadingToggle, setLoadingToggle] = useState(false);

  // Extract slug from URL pathname: /admin/:slug/*
  const pathParts = location.pathname.split('/');
  const routeSlug = (pathParts[1] === 'admin' && pathParts[2] && pathParts[2] !== 'offline') ? pathParts[2] : null;

  useEffect(() => {
    fetchRestaurant();
  }, [routeSlug]);

  useEffect(() => {
    if (restaurant?.id) {
      joinRoom(`restaurant_admin_${restaurant.id}`);
      joinRoom('admin_room');
    }
  }, [restaurant?.id, socket]);

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
    if (path.includes('/orders')) return 'Online Orders Pipeline';
    if (path.includes('/riders')) return 'Delivery Partner Fleet';
    if (path.includes('/deliveries')) return 'Active Fleet Monitor';
    if (path.includes('/menu')) return 'Online Menu Items';
    if (path.includes('/categories')) return 'Online Categories';
    if (path.includes('/website')) return 'Website & Online Store';
    if (path.includes('/settings')) return 'Restaurant Settings';
    return 'Admin Console';
  };

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex font-sans antialiased">
      
      {/* Unified Sidebar */}
      <UnifiedSidebar restaurant={restaurant} currentSlug={currentSlug} />

      {/* Main Content Area */}
      <div className="flex-1 pl-[270px] flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#D7E5E8] shadow-xs px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1F2937] tracking-tight">
              {getPageTitle()}
            </h2>
            <p className="text-xs text-[#64748B] font-semibold mt-0.5">
              {restaurant?.name || 'Grand Palace'} • Operational Control
            </p>
          </div>

          <div className="flex items-center gap-6">
            
            {/* ONLINE ORDERING TOGGLE BUTTON */}
            {restaurant && (() => {
              const isOrderingOn = Number(restaurant.is_online_ordering_enabled) === 1 || restaurant.is_online_ordering_enabled === true;
              const isPublished = restaurant.website_status === 'PUBLISHED';
              const isActive = restaurant.status === 'ACTIVE';

              let statusText = 'ONLINE & ACCEPTING';
              let statusClass = 'text-emerald-800 font-bold';
              if (!isOrderingOn) {
                statusText = 'OFFLINE (PAUSED)';
                statusClass = 'text-rose-800 font-bold';
              } else if (!isPublished) {
                statusText = `OFFLINE (${restaurant.website_status || 'DRAFT'})`;
                statusClass = 'text-amber-800 font-bold';
              } else if (!isActive) {
                statusText = 'OFFLINE (INACTIVE)';
                statusClass = 'text-rose-800 font-bold';
              }

              return (
                <div className="flex items-center gap-3 bg-slate-50 p-2 px-3.5 rounded-xl border border-[#D7E5E8] shadow-2xs">
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-bold uppercase text-[#64748B]">Online Ordering</span>
                    <span className={`text-xs font-black ${statusClass}`}>
                      {statusText}
                    </span>
                  </div>

                  <button
                    onClick={handleToggleOnlineOrdering}
                    disabled={loadingToggle}
                    className={`p-2.5 rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs text-white shadow-2xs ${
                      isOrderingOn
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                    title={!isPublished ? "Master toggle is ON, but website is in DRAFT state. Publish website in Website Controls." : "Toggle Online Store Order Acceptances"}
                  >
                    <Power className="w-4 h-4" />
                    {loadingToggle ? 'Updating...' : isOrderingOn ? 'Turn Store OFF' : 'Turn Store ON'}
                  </button>
                </div>
              );
            })()}

            {/* Admin Profile */}
            <div className="flex items-center gap-3 border-l border-[#D7E5E8] pl-6">
              <div className="w-9 h-9 rounded-full bg-[#3A7D7C] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-xs text-[#1F2937] block leading-none">{user?.name || 'Admin User'}</span>
                <span className="text-[10px] font-bold text-[#64748B] block mt-1">{user?.email}</span>
              </div>
            </div>

          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6 sm:p-8">
          {children}
        </main>
      </div>

    </div>
  );
}
