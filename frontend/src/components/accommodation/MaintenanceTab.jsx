import React, { useState } from 'react';
import api from '../../services/api';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Search,
  RefreshCw,
  Plus,
  X,
  Check,
  Building2
} from 'lucide-react';

export default function MaintenanceTab({
  rooms = [],
  onRoomUpdated,
  onRefresh
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Maintenance rooms
  const maintenanceRooms = rooms.filter(
    (r) =>
      r.status === 'MAINTENANCE' &&
      (!searchTerm.trim() ||
        r.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.floor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.room_type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Available vacant rooms that can be placed in maintenance
  const eligibleRooms = rooms.filter((r) => r.status === 'VACANT' || r.status === 'CLEANING');

  const handleSetMaintenance = async (e) => {
    e.preventDefault();
    if (!selectedRoomId) return;

    setSubmittingId(selectedRoomId);
    try {
      const res = await api.post(`/rooms/${selectedRoomId}/set-maintenance`, {
        notes: maintenanceNotes || 'Scheduled preventive maintenance and fixture inspection.'
      });
      setShowAddModal(false);
      setSelectedRoomId('');
      setMaintenanceNotes('');
      setFeedbackMsg('✅ Room placed into MAINTENANCE status. It cannot be booked or checked into until resolved.');
      if (onRoomUpdated) onRoomUpdated(res?.data?.room || res?.data);
      if (onRefresh) onRefresh();
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to place room into maintenance');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleCompleteMaintenance = async (roomId, roomNumber) => {
    setSubmittingId(roomId);
    try {
      const res = await api.post(`/rooms/${roomId}/complete-maintenance`);
      setFeedbackMsg(`✅ Maintenance resolved for Room ${roomNumber}! Room is now VACANT and open for bookings.`);
      if (onRoomUpdated) onRoomUpdated(res?.data?.room || res?.data);
      if (onRefresh) onRefresh();
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete maintenance');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. TOP BAR */}
      <div className="bg-white p-5 rounded-3xl border border-[#D7E5E8] shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              Facility & Room Maintenance Station
            </h3>
            <p className="text-xs text-slate-500">
              Manage repairs, HVAC servicing, and plumbing upgrades. Rooms in maintenance are locked from booking & check-in.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Place Room in Maintenance</span>
          </button>

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

      {/* 2. MAINTENANCE ROOMS LIST */}
      {maintenanceRooms.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-[#D7E5E8] space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">Zero Maintenance Issues!</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All rooms are currently in operational order and available for guest stays.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {maintenanceRooms.map((room) => (
            <div
              key={room.id}
              className="bg-white rounded-3xl border-2 border-rose-200 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={room.image_url}
                    alt={room.room_number}
                    className="w-full h-full object-cover grayscale-[30%]"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-rose-600 text-white font-black text-xs flex items-center gap-1.5 shadow-xs">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>MAINTENANCE</span>
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

                  <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs space-y-1">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Reported Maintenance Scope:</span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                      {room.maintenance_notes || 'Scheduled preventive HVAC and plumbing upgrade in progress.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Out of Order</span>
                </span>

                <button
                  disabled={submittingId === room.id}
                  onClick={() => handleCompleteMaintenance(room.id, room.room_number)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingId === room.id ? 'Resolving...' : 'Complete & Mark Vacant'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. PLACE IN MAINTENANCE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#D7E5E8] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#D7E5E8] flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <Wrench className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  Place Room into Maintenance
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSetMaintenance} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Room *
                </label>
                <select
                  required
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D7E5E8] text-xs font-bold text-slate-800 focus:outline-hidden focus:border-rose-500 bg-white"
                >
                  <option value="">-- Choose Vacant/Turnover Room --</option>
                  {eligibleRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} ({r.room_type} - {r.floor}) [Status: {r.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Maintenance Issue / Service Scope *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. AC cooling coil repair, plumbing fixture replacement, deep carpet shampooing..."
                  value={maintenanceNotes}
                  onChange={(e) => setMaintenanceNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D7E5E8] text-xs font-medium text-slate-800 focus:outline-hidden focus:border-rose-500"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Placing a room into maintenance prevents it from being checked into at the Front Desk until resolved.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#D7E5E8] text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingId !== null}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
                >
                  Confirm & Lock Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
