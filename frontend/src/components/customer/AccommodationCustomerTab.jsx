import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  Hotel,
  BedDouble,
  Users,
  CheckCircle2,
  Calendar,
  Phone,
  User,
  Sparkles,
  Wifi,
  Wind,
  Coffee,
  Car,
  ShieldCheck,
  ArrowRight,
  X,
  MessageSquare,
  Clock,
  MapPin,
  Star,
  Tv,
  Bath
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:5000');

const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

import { getTemplateById } from '../../config/templates';

export default function AccommodationCustomerTab({ restaurant, slug }) {
  const template = getTemplateById(restaurant?.template_id);
  const [rooms, setRooms] = useState([]);
  const [amenities, setAmenities] = useState([
    'High-Speed Wi-Fi',
    '100% AC Suites',
    'Free Breakfast',
    'Valet Parking',
    '24/7 Housekeeping'
  ]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Booking Form State
  const [form, setForm] = useState({
    guest_name: '',
    guest_phone: '',
    check_in_date: new Date().toISOString().slice(0, 10),
    check_out_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    room_type: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const activeSlug = slug || restaurant?.slug || restaurant?.random_slug || 'default';

  useEffect(() => {
    fetchRooms();
  }, [activeSlug]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/restaurants/${activeSlug}/rooms`);
      if (res.data && res.data.success) {
        setRooms(res.data.rooms || []);
        if (res.data.hotel_amenities && res.data.hotel_amenities.length > 0) {
          setAmenities(res.data.hotel_amenities);
        }
      }
    } catch (err) {
      console.error('Failed to load public rooms catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBookingModal = (room) => {
    setSelectedRoom(room);
    setForm(prev => ({
      ...prev,
      room_type: room ? room.room_type || `Room ${room.room_number}` : 'Deluxe AC Room'
    }));
    setShowModal(true);
  };

  const handleSubmitInquiry = async (e) => {
    e.preventDefault();
    if (!form.guest_name || !form.guest_phone) {
      alert('Please enter your Name and Mobile Number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        room_id: selectedRoom?.id || null,
        room_number: selectedRoom?.room_number || null,
        room_type: selectedRoom ? selectedRoom.room_type || `Room ${selectedRoom.room_number}` : form.room_type,
        price_per_night: selectedRoom?.base_price || selectedRoom?.rate_per_night || null
      };

      const res = await api.post(`/restaurants/${activeSlug}/room-inquiry`, payload);
      if (res.data && res.data.success) {
        setSuccessMsg(res.data.message || '🎉 Your room reservation request has been sent! Front Desk will call/WhatsApp you shortly to confirm.');
        setTimeout(() => {
          setSuccessMsg(null);
          setShowModal(false);
        }, 4000);
      } else {
        alert(res.data?.message || 'Failed to send room inquiry.');
      }
    } catch (err) {
      console.error('Room inquiry submit error:', err);
      alert(err.response?.data?.message || err.message || 'Failed to send room inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HERO HOTEL BRANDING CARD */}
      <div className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${template.previewBg} text-white p-6 sm:p-10 shadow-2xl border border-white/10`}>
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 ${template.badgeStyle}`}>
              <Star className="w-3.5 h-3.5 fill-current" /> {template.category}
            </span>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-white/90 border border-white/10 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-300" /> 24/7 Front Desk Active
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            {restaurant?.name || 'Grand Palace Hotel'} Suites & Rooms
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl">
            {restaurant?.tagline || 'Experience luxury, comfort, and top-tier hospitality. Book your stay online in seconds!'}
          </p>

          {/* DYNAMIC HOTEL AMENITY BADGES (ADMIN CONTROLLED) */}
          <div className="pt-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-300 mb-2">Hotel Highlights & Amenities:</h4>
            <div className="flex flex-wrap gap-2">
              {amenities.map((item, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-xs font-bold text-white flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Ambient Glow Decorative Backdrop */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-[#3A7D7C]/30 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* ROOMS CATALOG TITLE BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D7E5E8] pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#1F2937] flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-[#3A7D7C]" />
            <span>Available Luxury Rooms & Suites</span>
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5 font-medium">Select your desired room suite and request an instant booking</p>
        </div>

        <button
          onClick={() => handleOpenBookingModal(null)}
          className="px-5 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Calendar className="w-4 h-4" /> Quick Room Inquiry
        </button>
      </div>

      {/* ROOM CARDS GRID */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-[#D7E5E8]">
          <div className="w-8 h-8 border-3 border-[#3A7D7C] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500 font-semibold">Loading luxury room suites...</p>
        </div>
      ) : rooms.length === 0 ? (
        /* DEMO ROOM CARDS IF DATABASE IS EMPTY (ADMIN CAN ADD MORE IN ROOMS TAB) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              id: 'demo-1',
              room_number: '101',
              room_type: 'Deluxe AC Room',
              base_price: 1999,
              capacity: 2,
              status: 'VACANT',
              image_url: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80',
              amenities: ['Air Conditioning', 'King Bed', 'Free Wi-Fi', 'Smart TV', 'Hot Water']
            },
            {
              id: 'demo-2',
              room_number: '202',
              room_type: 'Executive Family Suite',
              base_price: 3499,
              capacity: 4,
              status: 'VACANT',
              image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
              amenities: ['Air Conditioning', '2 Queen Beds', 'Balcony View', 'Mini Refrigerator', 'Free Breakfast']
            },
            {
              id: 'demo-3',
              room_number: '305',
              room_type: 'Royal Presidential Suite',
              base_price: 4999,
              capacity: 3,
              status: 'VACANT',
              image_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80',
              amenities: ['Air Conditioning', 'Jacuzzi Bath', 'Living Room', 'Personal Butler', 'Valet Parking']
            }
          ].map((room) => (
            <div key={room.id} className="bg-white rounded-3xl border border-[#D7E5E8] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between">
              <div>
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img
                    src={room.image_url}
                    alt={room.room_type}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-black">
                    Room {room.room_number}
                  </div>
                  <div className="absolute bottom-3 left-3 bg-[#3A7D7C] text-white px-3 py-1.5 rounded-xl text-sm font-black shadow-md">
                    ₹{room.base_price} <span className="text-[10px] font-normal opacity-90">/ night</span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-900 text-base">{room.room_type}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      👥 Max {room.capacity} Guests
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {room.amenities.map((am, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600">
                        ✓ {am}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  onClick={() => handleOpenBookingModal(room)}
                  className="w-full py-3 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BedDouble className="w-4 h-4" /> Book This Suite
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIVE ADMIN ROOMS LOADED FROM DATABASE */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => {
            const amenitiesList = room.amenities
              ? String(room.amenities).split(',').map(s => s.trim()).filter(Boolean)
              : ['Air Conditioning', 'Wi-Fi', 'Smart TV', 'Hot Water'];

            return (
              <div key={room.id} className="bg-white rounded-3xl border border-[#D7E5E8] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between">
                <div>
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    <img
                      src={getMediaUrl(room.image_url) || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80'}
                      alt={room.room_type || room.room_number}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-black">
                      Room {room.room_number}
                    </div>
                    <div className="absolute bottom-3 left-3 bg-[#3A7D7C] text-white px-3 py-1.5 rounded-xl text-sm font-black shadow-md">
                      ₹{room.base_price || 1999} <span className="text-[10px] font-normal opacity-90">/ night</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-slate-900 text-base">{room.room_type || `Room ${room.room_number}`}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        👥 Max {room.capacity || 2} Guests
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {amenitiesList.map((am, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600">
                          ✓ {am}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <button
                    onClick={() => handleOpenBookingModal(room)}
                    className="w-full py-3 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <BedDouble className="w-4 h-4" /> Book Room {room.room_number}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 30-SECOND ROOM INQUIRY BOOKING MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#D7E5E8] max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-[#D7E5E8] pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Quick Room Reservation
                </span>
                <h3 className="text-lg font-extrabold text-[#1F2937] mt-1">
                  Book Your Stay at {restaurant?.name || 'Hotel'}
                </h3>
                <p className="text-xs text-[#64748B]">Fill in your details below and front desk will confirm instantly</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
            </div>

            {successMsg ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-extrabold text-emerald-950">Inquiry Sent Successfully!</h4>
                <p className="text-xs text-emerald-700 font-medium px-4">{successMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="space-y-4 text-xs">
                {selectedRoom && (
                  <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">Selected Room</span>
                      <h4 className="font-bold text-emerald-950 text-sm">{selectedRoom.room_type || `Room ${selectedRoom.room_number}`}</h4>
                    </div>
                    <span className="text-base font-black text-emerald-900">₹{selectedRoom.base_price || 1999} / night</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#1F2937] mb-1">Check-In Date:</label>
                    <input
                      type="date"
                      value={form.check_in_date}
                      onChange={(e) => setForm({ ...form, check_in_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-[#1F2937]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#1F2937] mb-1">Check-Out Date:</label>
                    <input
                      type="date"
                      value={form.check_out_date}
                      onChange={(e) => setForm({ ...form, check_out_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-[#1F2937]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Your Full Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. Nithin Kumar"
                    value={form.guest_name}
                    onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-[#1F2937]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Mobile Number (For Confirmation):</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={form.guest_phone}
                    onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-[#1F2937]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Special Requests / Notes (Optional):</label>
                  <textarea
                    placeholder="e.g. Need extra bed, late check-in..."
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-[#1F2937]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5E8]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-extrabold rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    {submitting ? 'Sending Request...' : '📩 Request Room Reservation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
