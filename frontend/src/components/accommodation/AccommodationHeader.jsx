import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Bell, 
  Sparkles, 
  Star, 
  MapPin, 
  Check, 
  Layers,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import api from '../../services/api';
import AccommodationNotificationsModal from './AccommodationNotificationsModal';

export default function AccommodationHeader({
  hotels = [],
  selectedHotelId = 1,
  onSelectHotel,
  title = 'Accommodation Management',
  subtitle = 'Multi-Property Operations & Guest Services'
}) {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const selectedHotel = hotels.find(h => Number(h.id) === Number(selectedHotelId)) || hotels[0] || {
    id: 1,
    name: 'The Grand Palace Heritage & Spa',
    city: 'Bengaluru',
    rating: 4.9,
    category: 'Heritage Hotel'
  };

  // Fetch hotel-scoped notifications
  const fetchNotifications = async () => {
    try {
      const res = await api.get(`/rooms/notifications?hotel_id=${selectedHotelId}`);
      if (res.data?.success) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unread_count || 0);
      }
    } catch (err) {
      console.warn('Notifications fetch error:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [selectedHotelId]);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/rooms/notifications/mark-read', { hotel_id: selectedHotelId });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          
          {/* Title & Badge */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#006C70] border border-teal-100/60 shadow-2xs">
                <Building2 className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {title}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                SaaS Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium pl-8">
              {subtitle}
            </p>
          </div>

          {/* Right Controls: Hotel Selector & Notifications */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            
            {/* HOTEL SELECTOR DROPDOWN */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-left transition-all shadow-2xs active:scale-[0.98]"
              >
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-sm shadow-2xs">
                  🏨
                </div>
                <div className="min-w-0 pr-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                    Active Property
                  </div>
                  <div className="text-xs font-black text-slate-900 truncate max-w-[160px] sm:max-w-[200px] mt-0.5">
                    {selectedHotel.name}
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSelectorOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Selector Popover */}
              {isSelectorOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsSelectorOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-50 p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150 max-h-[75vh] flex flex-col">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Switch Hotel Property
                      </span>
                      <span className="text-[10px] font-bold text-[#006C70] bg-teal-50 px-2 py-0.5 rounded-md">
                        {hotels.length} Properties
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {hotels.map(hotel => {
                        const isSelected = Number(hotel.id) === Number(selectedHotelId);
                        return (
                          <div
                            key={hotel.id}
                            onClick={() => {
                              onSelectHotel(hotel.id);
                              setIsSelectorOpen(false);
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-teal-50/70 border-[#006C70] ring-2 ring-[#006C70]/10 shadow-xs'
                                : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={hotel.main_image || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200'}
                                alt={hotel.name}
                                className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                  {hotel.name}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                                  <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                    {hotel.rating}
                                  </span>
                                  <span>•</span>
                                  <span className="truncate">{hotel.city}</span>
                                </div>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-[#006C70] text-white flex items-center justify-center shrink-0">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* NOTIFICATION BELL */}
            <button
              type="button"
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all shadow-2xs active:scale-95"
              title="View Hotel Notifications"
            >
              <Bell className="w-4 h-4 text-slate-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* Notifications Slide-over Modal */}
      <AccommodationNotificationsModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllRead={handleMarkAllRead}
        selectedHotelName={selectedHotel.name}
      />
    </>
  );
}
