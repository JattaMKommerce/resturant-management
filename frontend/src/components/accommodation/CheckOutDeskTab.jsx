import React from 'react';
import {
  LogOut,
  BedDouble,
  Receipt,
  AlertTriangle,
  User,
  Clock,
  CheckCircle2,
  Sparkles,
  Phone,
  ArrowRight
} from 'lucide-react';

export default function CheckOutDeskTab({
  rooms = [],
  onCheckOutClick,
  onViewFolioClick
}) {
  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED');

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* 1. HEADER */}
      <div className="bg-white p-6 rounded-3xl border border-[#D7E5E8] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Front Desk Guest Check-Out
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Review guest room folios, settle outstanding charges, and release rooms for housekeeping
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black">
            {occupiedRooms.length} Occupied Rooms
          </span>
        </div>
      </div>

      {/* 2. OCCUPIED ROOMS GRID */}
      {occupiedRooms.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-[#D7E5E8] space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No Occupied Rooms</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no in-house guests checked in. All rooms are vacant or under cleaning/maintenance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {occupiedRooms.map((r) => {
            const hasBalance = parseFloat(r.folio_balance || 0) > 0;
            return (
              <div
                key={r.id}
                className="bg-white rounded-3xl p-5 border border-[#D7E5E8] shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Room & Floor Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-black text-sm shadow-xs">
                        {r.room_number}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {r.floor}
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-900">
                          {r.room_type}
                        </h4>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      Occupied
                    </span>
                  </div>

                  {/* Guest Information Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-[#D7E5E8] space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs font-extrabold text-slate-900">
                        {r.guest_name || 'Guest In-House'}
                      </span>
                    </div>

                    {r.guest_phone && (
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{r.guest_phone}</span>
                      </div>
                    )}

                    {r.check_in_date && (
                      <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>
                          Since {new Date(r.check_in_date).toLocaleDateString()} {new Date(r.check_in_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tariff & Balance */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Room Tariff
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        ₹{parseFloat(r.rate_per_night || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className={`p-3 rounded-xl border ${hasBalance ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                      <span className="text-[10px] font-bold uppercase block opacity-80">
                        Folio Balance
                      </span>
                      <span className="text-xs font-black">
                        ₹{parseFloat(r.folio_balance || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
                  <button
                    onClick={() => onViewFolioClick(r)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-[#3A7D7C] hover:text-white text-slate-700 text-xs font-bold transition-all"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>View Folio</span>
                  </button>

                  <button
                    onClick={() => onCheckOutClick(r)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition-all shadow-xs active:scale-95"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Process Check-Out</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
