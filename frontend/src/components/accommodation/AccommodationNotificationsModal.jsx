import React from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  Sparkles, 
  Wrench,
  ExternalLink 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AccommodationNotificationsModal({
  isOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  onMarkAllRead,
  selectedHotelName = 'The Grand Palace'
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getIcon = (type, severity) => {
    if (type === 'ROOM_NOT_READY' || severity === 'WARNING') {
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
    if (type === 'MAINTENANCE_ALERT' || severity === 'URGENT') {
      return <Wrench className="w-4 h-4 text-rose-600" />;
    }
    if (type === 'PAYMENT_PENDING') {
      return <CreditCard className="w-4 h-4 text-purple-600" />;
    }
    if (type === 'HOUSEKEEPING_ALERT') {
      return <Sparkles className="w-4 h-4 text-teal-600" />;
    }
    return <Info className="w-4 h-4 text-blue-600" />;
  };

  const handleItemClick = (item) => {
    if (item.link_url) {
      navigate(item.link_url);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-top-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#006C70]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Notifications</h3>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[220px]">
                {selectedHotelName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[11px] font-bold text-[#006C70] hover:underline flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark Read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">No New Notifications</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                All operations and room turnovers for this property are running smoothly.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  item.is_read
                    ? 'bg-white border-slate-100 opacity-75 hover:opacity-100 hover:border-slate-200'
                    : 'bg-teal-50/40 border-teal-100 shadow-2xs hover:bg-teal-50/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white shadow-2xs shrink-0 mt-0.5 border border-slate-100">
                    {getIcon(item.notification_type, item.severity)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {item.title}
                      </h4>
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#006C70] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {item.link_url && (
                        <span className="text-[#006C70] font-bold flex items-center gap-0.5 hover:underline">
                          <span>View</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Notifications are strictly scoped to the active hotel workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
