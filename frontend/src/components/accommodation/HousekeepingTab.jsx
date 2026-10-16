import React, { useState } from 'react';
import api from '../../services/api';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  BedDouble,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Check
} from 'lucide-react';

export default function HousekeepingTab({
  rooms = [],
  onRoomUpdated,
  onRefresh
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Filter rooms currently under cleaning
  const cleaningRooms = rooms.filter(
    (r) =>
      r.status === 'CLEANING' &&
      (!searchTerm.trim() ||
        r.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.floor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.room_type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCompleteCleaning = async (roomId, roomNumber) => {
    setSubmittingId(roomId);
    try {
      const res = await api.post(`/rooms/${roomId}/complete-cleaning`);
      setFeedbackMsg(`✅ Room ${roomNumber} cleaning verified! Room is now VACANT and ready for check-in.`);
      if (onRoomUpdated) onRoomUpdated(res?.data?.room || res?.data);
      if (onRefresh) onRefresh();
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete cleaning');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & SEARCH */}
      <div className="bg-white p-5 rounded-3xl border border-[#D7E5E8] shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              Housekeeping & Room Turnaround Station
            </h3>
            <p className="text-xs text-slate-500">
              Manage rooms undergoing sanitization, bed makeup, and housekeeping after guest check-out.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-[#D7E5E8] rounded-xl px-3 py-2 text-xs w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search cleaning rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent outline-hidden font-medium text-slate-800"
            />
          </div>

          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-[#D7E5E8] text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 2. HOUSEKEEPING ROOMS LIST */}
      {cleaningRooms.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-[#D7E5E8] space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">All Rooms Are Clean & Ready!</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no rooms pending housekeeping turnover. When a guest checks out, the room automatically appears here for turnover.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cleaningRooms.map((room) => (
            <div
              key={room.id}
              className="bg-white rounded-3xl border-2 border-amber-200 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={room.image_url}
                    alt={room.room_number}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-amber-500 text-white font-black text-xs flex items-center gap-1.5 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>UNDER CLEANING</span>
                  </div>
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-900/80 text-white font-black text-xs backdrop-blur-xs">
                    {room.floor}
                  </div>
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-black text-slate-900">
                      Room {room.room_number}
                    </h4>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {room.room_type}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 bg-amber-50/60 p-3 rounded-2xl border border-amber-100">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Housekeeping Turnover Checklist:</span>
                    </div>
                    <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5 pt-1">
                      <li>Strip bed linen & replace with fresh sanitized sheets</li>
                      <li>Disinfect bathroom surfaces & restock organic toiletries</li>
                      <li>Vacuum carpets & sanitize smart console surfaces</li>
                      <li>Restock complimentary water & tea/coffee station</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 font-bold">
                  Status: Turnaround
                </span>

                <button
                  disabled={submittingId === room.id}
                  onClick={() => handleCompleteCleaning(room.id, room.room_number)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingId === room.id ? 'Verifying...' : 'Mark Clean & Vacant'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
