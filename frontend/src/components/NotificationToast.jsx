import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ShoppingBag, Receipt, Bike, ConciergeBell, ExternalLink, X } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function NotificationToast() {
  const { toast, setToast } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if current URL is a customer page (/order/* or /restaurant/*)
  const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const isCustomerPage = pathname.startsWith('/order') || pathname.startsWith('/restaurant');

  // NEVER render staff/admin toast popups on customer pages or for non-staff users
  if (isCustomerPage || !user || !toast) return null;

  const handleToastClick = () => {
    let targetLink = toast.link;

    if (!targetLink) {
      const titleLower = String(toast.title || '').toLowerCase();
      const typeLower = String(toast.type || '').toLowerCase();

      if (typeLower.includes('call') || titleLower.includes('waiter')) {
        targetLink = '/waiter';
      } else if (typeLower.includes('order') || titleLower.includes('order')) {
        targetLink = '/hotel/admin/orders';
      } else if (typeLower.includes('bill') || titleLower.includes('bill')) {
        targetLink = '/hotel/admin/offline/billing';
      } else if (typeLower.includes('driver') || typeLower.includes('rider') || titleLower.includes('rider')) {
        targetLink = '/hotel/admin/deliveries';
      } else if (typeLower.includes('kot') || titleLower.includes('kitchen')) {
        targetLink = '/hotel/admin/offline/kds';
      } else {
        targetLink = '/hotel/admin/orders';
      }
    }

    setToast(null);
    navigate(targetLink);
  };

  const getToastIcon = () => {
    const typeLower = String(toast.type || '').toLowerCase();
    const titleLower = String(toast.title || '').toLowerCase();

    if (typeLower.includes('call') || titleLower.includes('waiter')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
          <ConciergeBell className="w-5 h-5 stroke-[2.2]" />
        </div>
      );
    }
    if (typeLower.includes('order') || titleLower.includes('order')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
          <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
        </div>
      );
    }
    if (typeLower.includes('bill') || titleLower.includes('bill')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
          <Receipt className="w-5 h-5 stroke-[2.2]" />
        </div>
      );
    }
    if (typeLower.includes('driver') || titleLower.includes('rider') || typeLower.includes('delivery')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 border border-sky-200">
          <Bike className="w-5 h-5 stroke-[2.2]" />
        </div>
      );
    }

    return (
      <div className="w-10 h-10 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center shrink-0 border border-[#D7E5E8]">
        <Bell className="w-5 h-5 stroke-[2.2]" />
      </div>
    );
  };

  return (
    <div className="fixed top-5 right-5 z-[9999] w-80 sm:w-96 font-sans">
      <div
        onClick={handleToastClick}
        className="group relative bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-[#D7E5E8] hover:border-[#3A7D7C] transition-all cursor-pointer overflow-hidden transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            {getToastIcon()}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="font-extrabold text-sm text-[#1F2937] truncate">{toast.title || 'Notification'}</h4>
                <ExternalLink className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#3A7D7C] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <p className="text-xs font-medium text-[#64748B] mt-1 line-clamp-2 leading-relaxed">
                {toast.message}
              </p>
              <span className="inline-block mt-2 text-[10px] font-bold text-[#3A7D7C] bg-[#EAF4F7] px-2 py-0.5 rounded-full border border-[#D7E5E8]">
                Click to open module ➔
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setToast(null);
            }}
            className="p-1 rounded-lg text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100 transition-colors shrink-0"
            title="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 5-second shrinking progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#EAF4F7]">
          <div
            className="h-full bg-[#3A7D7C] transition-all"
            style={{
              animation: 'toastProgress 5s linear forwards'
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
