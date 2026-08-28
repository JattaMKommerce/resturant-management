import React from 'react';
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
  Eye, 
  LogIn, 
  LogOut, 
  Edit3, 
  Trash2, 
  User, 
  Receipt,
  Wrench,
  CheckCircle2,
  Phone
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Visual badge mappings for room statuses
const STATUS_CONFIG = {
  VACANT: {
    label: 'Vacant / Ready',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    accent: 'border-emerald-200 hover:border-emerald-400'
  },
  OCCUPIED: {
    label: 'Occupied',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    accent: 'border-blue-200 hover:border-blue-400'
  },
  CLEANING: {
    label: 'Cleaning',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    accent: 'border-amber-200 hover:border-amber-400'
  },
  MAINTENANCE: {
    label: 'Maintenance',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    accent: 'border-rose-200 hover:border-rose-400'
  }
};

// Map amenity text to matching Lucide icons
export function getAmenityIcon(name) {
  const n = String(name).toLowerCase();
  if (n.includes('wifi')) return <Wifi className="w-3.5 h-3.5 text-[#3A7D7C]" />;
  if (n.includes('air') || n.includes('ac') || n.includes('climate')) return <Wind className="w-3.5 h-3.5 text-[#3A7D7C]" />;
  if (n.includes('tv')) return <Tv className="w-3.5 h-3.5 text-[#3A7D7C]" />;
  if (n.includes('coffee') || n.includes('tea') || n.includes('espresso')) return <Coffee className="w-3.5 h-3.5 text-[#3A7D7C]" />;
  if (n.includes('bar') || n.includes('mini')) return <Wine className="w-3.5 h-3.5 text-[#3A7D7C]" />;
  if (n.includes('bath') || n.includes('jacuzzi')) return <Bath className="w-3.5 h-3.5 text-[#3A7D7C]" />;
  if (n.includes('safe') || n.includes('lock')) return <ShieldCheck className="w-3.5 h-3.5 text-[#3A7D7C]" />;
  return <Sparkles className="w-3.5 h-3.5 text-[#3A7D7C]" />;
}

export default function RoomCard({
  room,
  onViewDetails,
  onCheckIn,
  onCheckOut,
  onViewFolio,
  onEdit,
  onDelete,
  onStatusChange
}) {
  const { user } = useAuth();
  const isAdminOrManager = ['ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const statusCfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.VACANT;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group ${statusCfg.accent}`}>
      
      {/* 1. ROOM CARD MEDIA HEADER */}
      <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100">
        <img
          src={room.image_url}
          alt={`Room ${room.room_number} - ${room.room_type}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

        {/* Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-slate-900/80 text-white backdrop-blur-md border border-white/10 shadow-xs">
            {room.floor}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-md border shadow-xs ${statusCfg.bg}`}>
            <span className={`w-2 h-2 rounded-full ${statusCfg.dot} animate-pulse`}></span>
            {statusCfg.label}
          </span>
        </div>

        {/* Bottom Title & Rate in Media overlay */}
        <div className="absolute bottom-3 inset-x-3 text-white">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-xs text-amber-300 font-semibold tracking-wider uppercase block">
                {room.room_type}
              </span>
              <h3 className="text-xl font-black tracking-tight drop-shadow-xs flex items-center gap-2">
                <span>Room {room.room_number}</span>
              </h3>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-white tracking-tight">
                ₹{Number(room.rate_per_night || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-300 block -mt-1 font-medium">/ night</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ROOM BODY INFO */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5">
        
        {/* Specifications Strip */}
        <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[11px] text-slate-600 font-medium">
          <div className="flex items-center gap-1.5 truncate" title={`Capacity: ${room.capacity} Guests`}>
            <Users className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
            <span className="truncate">{room.capacity} Guests</span>
          </div>
          <div className="flex items-center gap-1.5 truncate" title={`Bed: ${room.bed_type}`}>
            <Bed className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
            <span className="truncate">{room.bed_type}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate" title={`Size: ${room.room_size}`}>
            <Maximize2 className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
            <span className="truncate">{room.room_size}</span>
          </div>
        </div>

        {/* Description snippet */}
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
          {room.description}
        </p>

        {/* Small Amenities Preview */}
        {room.amenities && room.amenities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {room.amenities.slice(0, 3).map((amenity, idx) => (
              <span 
                key={idx} 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF4F7] text-[#1F2937] text-[10px] font-medium border border-[#D7E5E8]/60"
              >
                {getAmenityIcon(amenity)}
                <span className="truncate max-w-[90px]">{amenity}</span>
              </span>
            ))}
            {room.amenities.length > 3 && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                +{room.amenities.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* OCCUPIED GUEST BANNER */}
        {room.status === 'OCCUPIED' && (
          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">Checked In</span>
                <span className="text-xs font-bold text-slate-900 truncate block">
                  {room.guest_name || 'Guest'}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => onViewFolio(room)}
              className="text-right hover:opacity-80 transition-opacity"
              title="Click to view Room Folio & Bills"
            >
              <span className="text-[10px] text-slate-500 block">Folio Balance</span>
              <span className={`text-xs font-bold ${room.folio_balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                ₹{Number(room.folio_balance || 0).toFixed(2)}
              </span>
            </button>
          </div>
        )}

        {/* CLEANING HOUSEKEEPING BANNER */}
        {room.status === 'CLEANING' && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
              <span className="text-amber-900 font-medium text-[11px]">Housekeeping cleaning in progress</span>
            </div>
            <button
              onClick={() => onStatusChange(room.id, 'VACANT')}
              className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[10px] transition-colors shadow-2xs shrink-0"
            >
              Mark Ready
            </button>
          </div>
        )}

        {/* MAINTENANCE BANNER */}
        {room.status === 'MAINTENANCE' && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-rose-600" />
              <span className="text-rose-900 font-medium text-[11px]">Room under repair / inspection</span>
            </div>
            <button
              onClick={() => onStatusChange(room.id, 'CLEANING')}
              className="px-2 py-1 bg-slate-800 hover:bg-black text-white rounded-lg font-bold text-[10px] transition-colors shadow-2xs shrink-0"
            >
              To Cleaning
            </button>
          </div>
        )}

      </div>

      {/* 3. CARD ACTION CONTROLS */}
      <div className="p-3 bg-slate-50/80 border-t border-[#D7E5E8] flex items-center justify-between gap-2">
        
        {/* Left Secondary Actions (Admin Edit, Delete) */}
        <div className="flex items-center gap-1">
          {isAdminOrManager && (
            <>
              <button
                onClick={() => onEdit(room)}
                title="Edit Room Details"
                className="p-1.5 text-slate-600 hover:text-[#3A7D7C] hover:bg-[#EAF4F7] rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(room)}
                title="Delete Room"
                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Right Primary Actions */}
        <div className="flex items-center gap-1.5">
          {/* Quick Check-In when VACANT */}
          {room.status === 'VACANT' && (
            <button
              onClick={() => onCheckIn(room)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all hover:shadow-xs active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Check-In</span>
            </button>
          )}

          {/* Quick Check-Out when OCCUPIED */}
          {room.status === 'OCCUPIED' && (
            <button
              onClick={() => onCheckOut(room)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-2xs transition-all hover:shadow-xs active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Check-Out</span>
            </button>
          )}

          {/* View Details Primary Button */}
          <button
            onClick={() => onViewDetails(room)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs shadow-2xs transition-all hover:shadow-xs active:scale-95"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        </div>

      </div>

    </div>
  );
}
