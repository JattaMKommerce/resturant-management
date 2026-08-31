import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Phone,
  Mail,
  Calendar,
  BedDouble,
  Receipt,
  LogOut,
  RefreshCw,
  Clock,
  FileText,
  UserPlus
} from 'lucide-react';

export default function GuestManagementTab({
  selectedHotelId = 1,
  selectedHotelName = 'The Grand Palace',
  onCheckInClick,
  onCheckOutClick,
  onViewFolioClick,
  refreshKey
}) {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('IN_HOUSE'); // 'ALL' | 'IN_HOUSE' | 'CHECKED_OUT'

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    try {
      const params = { hotel_id: selectedHotelId };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/rooms/guests/list', { params });
      const data = res?.data || res;
      setGuests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch guest list:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, selectedHotelId]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests, refreshKey]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-slate-50 border border-[#D7E5E8] rounded-xl px-3 py-2 text-xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by guest name, phone, email, room #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-hidden text-slate-800 placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-[#D7E5E8] text-xs font-bold">
            <button
              onClick={() => setStatusFilter('IN_HOUSE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'IN_HOUSE'
                  ? 'bg-white text-[#3A7D7C] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In-House Guests
            </button>
            <button
              onClick={() => setStatusFilter('CHECKED_OUT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'CHECKED_OUT'
                  ? 'bg-white text-[#3A7D7C] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past / Checked-Out
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-[#3A7D7C] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
          </div>

          <button
            onClick={() => fetchGuests()}
            className="p-2 rounded-xl border border-[#D7E5E8] text-slate-600 hover:bg-slate-50 hover:text-[#3A7D7C] transition-colors"
            title="Refresh Guests"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {onCheckInClick && (
            <button
              onClick={onCheckInClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold shadow-2xs transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New Check-In</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. GUEST LIST TABLE / CARDS */}
      {loading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-[#D7E5E8]">
          <div className="w-8 h-8 border-3 border-[#3A7D7C] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500 font-semibold">Loading guest directory...</p>
        </div>
      ) : guests.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-[#D7E5E8] space-y-3">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">No Guests Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search ? 'No guests matched your search filter.' : 'No registered guests for the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guests.map((g) => {
            const isOpen = g.folio_status === 'OPEN';
            return (
              <div
                key={g.folio_id}
                className="bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Row: Room & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-[#3A7D7C] text-white flex items-center justify-center font-black text-xs shadow-2xs">
                        {g.room_number}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {g.floor}
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">
                          {g.room_type}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isOpen
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isOpen ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      {isOpen ? 'In-House' : 'Checked Out'}
                    </span>
                  </div>

                  {/* Guest Info */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {g.guest_name}
                    </h4>

                    {g.guest_phone && (
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{g.guest_phone}</span>
                      </div>
                    )}

                    {g.guest_email && (
                      <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{g.guest_email}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Checked In: {new Date(g.check_in_date).toLocaleDateString()} {new Date(g.check_in_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {g.check_out_date && (
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        <LogOut className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          Checked Out: {new Date(g.check_out_date).toLocaleDateString()} {new Date(g.check_out_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}

                    {g.notes && (
                      <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 text-amber-800 text-[10px] italic">
                        {g.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Balance & Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Folio Balance
                    </span>
                    <span className={`text-sm font-black ${g.balance > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      ₹{g.balance.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onViewFolioClick && (
                      <button
                        onClick={() => onViewFolioClick({ id: g.room_id, room_number: g.room_number, floor: g.floor, room_type: g.room_type, folio_balance: g.balance, guest_name: g.guest_name })}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-[#3A7D7C] hover:text-white text-slate-700 text-xs font-bold transition-all shadow-2xs"
                        title="View Room Folio & Charges"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isOpen && onCheckOutClick && (
                      <button
                        onClick={() => onCheckOutClick({ id: g.room_id, room_number: g.room_number, guest_name: g.guest_name })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs active:scale-95"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Check-Out</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
