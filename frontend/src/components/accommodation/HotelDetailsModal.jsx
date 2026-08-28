import React, { useState } from 'react';
import {
  X,
  MapPin,
  Star,
  Coffee,
  CheckCircle2,
  Clock,
  BedDouble,
  ShieldCheck,
  Sparkles,
  Building2,
  CalendarCheck,
  ChevronRight,
  Info
} from 'lucide-react';

export default function HotelDetailsModal({
  isOpen,
  onClose,
  hotel,
  onBookRoomClick
}) {
  if (!isOpen || !hotel) return null;

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const images = [hotel.main_image, ...(hotel.gallery_images || [])].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl border border-[#D7E5E8] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-[#D7E5E8] flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#E8F1F2] text-[#3A7D7C]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  {hotel.name}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white">
                  {hotel.category}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#3A7D7C]" />
                <span>{hotel.location}, {hotel.city}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. IMAGE GALLERY */}
          <div className="space-y-2">
            <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={images[activeImageIndex] || hotel.main_image}
                alt={hotel.name}
                className="w-full h-full object-cover transition-all duration-300"
              />
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-amber-500/90 text-white backdrop-blur-xs font-black text-xs flex items-center gap-1 shadow-md">
                <Star className="w-3.5 h-3.5 fill-white" />
                <span>{hotel.rating} / 5.0 Rating</span>
              </div>
            </div>

            {/* Thumbnail carousel */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                      activeImageIndex === idx
                        ? 'border-[#3A7D7C] ring-2 ring-[#3A7D7C]/30 scale-95'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. KEY STATS & BREAKFAST HIGHLIGHT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 border border-[#D7E5E8] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Nightly Tariff</span>
              <div className="text-xl font-black text-[#3A7D7C] mt-1">
                ₹{hotel.price_per_night.toLocaleString()}
                <span className="text-xs text-slate-500 font-normal"> / night</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-[#D7E5E8] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Check-In / Out</span>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4 text-[#3A7D7C]" />
                <span>In: {hotel.check_in_time} | Out: {hotel.check_out_time}</span>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
              hotel.breakfast_included
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}>
              <span className="text-[10px] uppercase font-bold opacity-75">Breakfast Package</span>
              <div className="text-xs font-bold flex items-center gap-1.5 mt-1">
                <Coffee className="w-4 h-4 shrink-0" />
                <span className="truncate">{hotel.breakfast_info}</span>
              </div>
            </div>
          </div>

          {/* 3. ABOUT DESCRIPTION */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">About this Property</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {hotel.description}
            </p>
          </div>

          {/* 4. ROOM TYPES AVAILABLE */}
          {hotel.room_types && hotel.room_types.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Available Room Types</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {hotel.room_types.map((type, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-[#D7E5E8] text-center">
                    <BedDouble className="w-4 h-4 text-[#3A7D7C] mx-auto mb-1" />
                    <span className="text-[11px] font-bold text-slate-800 block truncate">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. HOTEL AMENITIES */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Featured Amenities</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {hotel.amenities.map((amenity, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
                    <span className="truncate">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. POLICIES */}
          {hotel.policies && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#3A7D7C] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block mb-0.5">Hotel Policies & Guidelines:</span>
                <span>{hotel.policies}</span>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-[#D7E5E8] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Starting Rate</span>
            <span className="text-lg font-black text-[#3A7D7C]">₹{hotel.price_per_night.toLocaleString()}</span>
            <span className="text-xs text-slate-500 font-medium"> / night</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D7E5E8] text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onBookRoomClick}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Front Desk Check-In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
