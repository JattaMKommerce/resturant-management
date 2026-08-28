import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { 
  Users, 
  Bed, 
  Maximize2, 
  Wifi, 
  Tv, 
  Wind, 
  Coffee, 
  Wine, 
  Bath, 
  ShieldCheck, 
  Sparkles, 
  LogIn, 
  LogOut, 
  Edit3, 
  User, 
  Receipt,
  Phone,
  Mail,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  FileText
} from 'lucide-react';
import { getAmenityIcon } from './RoomCard';

const STATUS_OPTIONS = [
  { value: 'VACANT', label: 'Vacant / Ready', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  { value: 'OCCUPIED', label: 'Occupied', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { value: 'CLEANING', label: 'Cleaning', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'bg-rose-50 text-rose-700 border-rose-300' }
];

export default function RoomDetailsModal({
  isOpen,
  onClose,
  room,
  onCheckIn,
  onCheckOut,
  onViewFolio,
  onEdit,
  onStatusChange
}) {
  const [activeImage, setActiveImage] = useState(room?.image_url);

  useEffect(() => {
    if (room) {
      setActiveImage(room.image_url);
    }
  }, [room]);

  if (!room) return null;

  const currentStatusObj = STATUS_OPTIONS.find(s => s.value === room.status) || STATUS_OPTIONS[0];

  // Gallery preview images
  const galleryImages = [
    room.image_url,
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'
  ].filter(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Room ${room.room_number} - Details & Hospitality`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        
        {/* 1. HERO MEDIA & GALLERY */}
        <div className="space-y-2.5">
          <div className="relative aspect-21/9 w-full rounded-2xl overflow-hidden bg-slate-900 border border-[#D7E5E8] shadow-xs">
            <img
              src={activeImage || room.image_url}
              alt={`Room ${room.room_number}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>

            {/* Overlaid Badges */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900/80 text-white backdrop-blur-md border border-white/20">
                {room.floor}
              </span>
              
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs ${currentStatusObj.color}`}>
                  {currentStatusObj.label}
                </span>
              </div>
            </div>

            {/* Bottom Title Bar */}
            <div className="absolute bottom-4 left-4 right-4 text-white flex items-end justify-between">
              <div>
                <span className="text-xs text-amber-300 font-bold uppercase tracking-wider block">
                  {room.room_type}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm">
                  Room {room.room_number}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  ₹{Number(room.rate_per_night || 0).toLocaleString('en-IN')}
                </div>
                <span className="text-xs text-slate-300 block font-medium">per night (excl. taxes)</span>
              </div>
            </div>
          </div>

          {/* Mini Gallery Strip */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {galleryImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImage(img)}
                className={`relative w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  activeImage === img ? 'border-[#3A7D7C] scale-105 shadow-xs' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="Thumb" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* 2. SPECIFICATIONS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-[#D7E5E8] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Capacity</span>
              <span className="text-sm font-bold text-slate-900">{room.capacity} Guests</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-[#D7E5E8] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center shrink-0">
              <Bed className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Bed Setup</span>
              <span className="text-sm font-bold text-slate-900 truncate">{room.bed_type}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-[#D7E5E8] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center shrink-0">
              <Maximize2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Room Size</span>
              <span className="text-sm font-bold text-slate-900">{room.room_size}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-[#D7E5E8] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Floor</span>
              <span className="text-sm font-bold text-slate-900 truncate">{room.floor}</span>
            </div>
          </div>
        </div>

        {/* 3. DESCRIPTION & AMENITIES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Room Description */}
          <div className="space-y-2 p-4 rounded-2xl bg-white border border-[#D7E5E8]">
            <h4 className="text-xs font-bold text-[#3A7D7C] uppercase tracking-wider">
              Room Overview & Atmosphere
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              {room.description || 'No detailed description available for this room.'}
            </p>
          </div>

          {/* Visual Amenities Grid */}
          <div className="space-y-2.5 p-4 rounded-2xl bg-white border border-[#D7E5E8]">
            <h4 className="text-xs font-bold text-[#3A7D7C] uppercase tracking-wider">
              Included Amenities & Perks
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {room.amenities && room.amenities.length > 0 ? (
                room.amenities.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 py-1">
                    <div className="w-6 h-6 rounded-lg bg-[#EAF4F7] flex items-center justify-center shrink-0">
                      {getAmenityIcon(amenity)}
                    </div>
                    <span className="truncate font-medium">{amenity}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-400">No amenities configured</span>
              )}
            </div>
          </div>
        </div>

        {/* 4. ACTIVE GUEST & FOLIO SECTION (WHEN OCCUPIED) */}
        {room.status === 'OCCUPIED' ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-200/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">Currently Occupied By</span>
                  <h4 className="text-base font-black text-slate-900">
                    {room.guest_name || 'Guest'}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewFolio(room)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-2xs transition-colors"
                >
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span>View Folio / Charges</span>
                </button>
              </div>
            </div>

            {/* Guest Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
              {room.guest_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{room.guest_phone}</span>
                </div>
              )}
              {room.check_in_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Checked In: {new Date(room.check_in_date).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Folio Balance:{' '}
                  <strong className={room.folio_balance > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                    ₹{Number(room.folio_balance || 0).toFixed(2)}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-[#D7E5E8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900">Room is currently {room.status}</span>
                <p className="text-[11px] text-slate-500">
                  {room.status === 'VACANT' && 'Ready for immediate check-in and reservation.'}
                  {room.status === 'CLEANING' && 'Housekeeping cleaning is required before new guest check-in.'}
                  {room.status === 'MAINTENANCE' && 'Room is currently blocked for maintenance.'}
                </p>
              </div>
            </div>

            {room.status === 'VACANT' && (
              <button
                onClick={() => {
                  onClose();
                  onCheckIn(room);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Check-In Guest</span>
              </button>
            )}
          </div>
        )}

        {/* 5. FOOTER MANAGEMENT ACTIONS */}
        <div className="pt-4 border-t border-[#D7E5E8] flex flex-wrap items-center justify-between gap-3">
          
          {/* Quick Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Change Status:</span>
            <select
              value={room.status}
              onChange={(e) => onStatusChange(room.id, e.target.value)}
              className="text-xs font-semibold py-1.5 px-3 rounded-xl border border-[#D7E5E8] bg-white text-slate-800 focus:outline-hidden focus:border-[#3A7D7C]"
            >
              <option value="VACANT">VACANT (Available)</option>
              <option value="OCCUPIED">OCCUPIED</option>
              <option value="CLEANING">CLEANING (Housekeeping)</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(room);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D7E5E8] bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-2xs transition-colors"
            >
              <Edit3 className="w-4 h-4 text-slate-500" />
              <span>Edit Room</span>
            </button>

            {room.status === 'OCCUPIED' && (
              <button
                onClick={() => {
                  onClose();
                  onCheckOut(room);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Check-Out Guest</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
            >
              Close
            </button>
          </div>

        </div>

      </div>
    </Modal>
  );
}
