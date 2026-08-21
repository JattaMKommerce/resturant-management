import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Power, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import UnifiedSidebar from './UnifiedSidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function AdminLayout({ children }) {
  const { user, restaurant, updateRestaurant } = useAuth();
  const location = useLocation();
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

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
      const res = await api.patch(`/restaurants/${restaurant.id}/status`, {
        is_online_ordering_enabled: nextState
      });
      if (res.data.success && res.data.restaurant) {
        updateRestaurant(res.data.restaurant);
      }
    } catch (err) {
      console.error('Failed to toggle online ordering status:', err);
    } finally {
      setLoadingToggle(false);
    }
  };

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
              className="p-2 -ml-1 text-[#1F2937] hover:bg-slate-100 rounded-xl lg:hidden shrink-0 border border-[#D7E5E8] transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-[#3A7D7C]" />
            </button>

            {/* Desktop Collapse/Expand toggle button in header */}
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="hidden lg:flex p-2 -ml-2 text-[#64748B] hover:text-[#1F2937] rounded-xl hover:bg-[#EAF4F7] transition-colors shrink-0"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base lg:text-lg font-bold text-[#1F2937] truncate leading-tight">
                {getPageTitle()}
              </h2>
              <p className="text-[10px] sm:text-xs text-[#64748B] font-semibold truncate mt-0.5 flex items-center gap-1.5">
                <span className="text-[#3A7D7C] font-bold">{restaurant?.name || 'Restaurant Admin'}</span>
                <span className="hidden sm:inline">• Unified Operational Control</span>
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            
            {/* ONLINE ORDERING TOGGLE BUTTON */}
            {restaurant && (() => {
              const isOrderingOn = Boolean(restaurant.is_online_ordering_enabled);
              const isPublished = restaurant.website_status === 'PUBLISHED';
              const isActive = restaurant.status === 'ACTIVE';

              let statusText = 'ONLINE & ACCEPTING';
              let statusClass = 'text-emerald-700 font-bold';
              if (!isOrderingOn) {
                statusText = 'OFFLINE (PAUSED)';
                statusClass = 'text-rose-700 font-bold';
              } else if (!isPublished) {
                statusText = `OFFLINE (${restaurant.website_status || 'DRAFT'})`;
                statusClass = 'text-amber-700 font-bold';
              } else if (!isActive) {
                statusText = 'OFFLINE (INACTIVE)';
                statusClass = 'text-rose-700 font-bold';
              }

              return (
                <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 p-1.5 sm:p-2 sm:px-3.5 rounded-xl border border-[#D7E5E8] shadow-2xs">
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-[9px] font-bold uppercase text-[#64748B]">Online Ordering</span>
                    <span className={`text-[11px] font-bold ${statusClass}`}>
                      {statusText}
                    </span>
                  </div>

                  <button
                    onClick={handleToggleOnlineOrdering}
                    disabled={loadingToggle}
                    className={`p-2 sm:px-3 sm:py-2 rounded-xl transition-all font-bold flex items-center gap-1.5 text-xs text-white shadow-2xs ${
                      isOrderingOn
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
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

            {/* Admin Profile Avatar */}
            <div className="flex items-center gap-2 sm:gap-3 border-l border-[#D7E5E8] pl-2 sm:pl-4">
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

        {/* Dynamic Responsive Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

    </div>
  );
}
