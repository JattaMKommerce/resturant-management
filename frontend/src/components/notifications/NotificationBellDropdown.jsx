import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Sparkles, XCircle, Clock, AlertCircle, ShoppingBag, Trash2, X } from 'lucide-react';
import api from '../../api/axios';

export default function NotificationBellDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // 15s polling
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch (err) {
      // Quiet fail if unauthenticated
    }
  };

  const handleOpenDropdown = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
      // Auto-clear unread badge on open
      if (unreadCount > 0) {
        api.patch('/notifications/read-all').catch(() => {});
        setUnreadCount(0);
      }
    }
  };

  const handleDismissNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      // Optimistically remove from UI
      setNotifications(prev => prev.filter(n => n.id !== id));
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error('Failed to delete notification:', err);
      fetchNotifications();
    }
  };

  const handleClearAll = async (e) => {
    if (e) e.stopPropagation();
    try {
      setLoading(true);
      setNotifications([]);
      setUnreadCount(0);
      await api.delete('/notifications/clear-all');
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
      fetchNotifications();
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'SUBSCRIPTION_APPROVED':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
            <Sparkles className="w-4 h-4" />
          </div>
        );
      case 'SUBSCRIPTION_REJECTED':
        return (
          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
            <XCircle className="w-4 h-4" />
          </div>
        );
      case 'SUBSCRIPTION_PENDING_APPROVAL':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
            <Clock className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center shrink-0 border border-[#D7E5E8]">
            <ShoppingBag className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Bell Button with Unread Badge */}
      <button
        type="button"
        onClick={handleOpenDropdown}
        className={`relative p-2.5 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-sm'
            : 'bg-white hover:bg-slate-50 text-[#1F2937] border-[#D7E5E8] shadow-2xs'
        }`}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#D7E5E8] rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-[#D7E5E8] flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-[#1F2937]">Notifications</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]">
                {notifications.length} Total
              </span>
            </div>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={loading}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear all</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[#D7E5E8]/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B] space-y-1">
                <Bell className="w-6 h-6 text-[#94A3B8] mx-auto mb-1 opacity-50" />
                <p className="font-bold text-[#1F2937]">No notifications</p>
                <p className="text-[11px]">All caught up!</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="group relative p-3.5 flex items-start gap-3 bg-white hover:bg-slate-50 transition-colors"
                >
                  {getNotificationIcon(item.type)}

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate text-[#1F2937]">
                        {item.title || 'Notification'}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] shrink-0 font-medium">
                        {formatTimeAgo(item.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug break-words">
                      {item.message}
                    </p>
                  </div>

                  {/* Dismiss (✕) Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDismissNotification(item.id, e)}
                    className="absolute right-2.5 top-3 p-1 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                    title="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
