import React, { useState } from 'react';
import {
  UserPlus,
  BedDouble,
  User,
  Phone,
  Mail,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function CheckInDeskTab({
  rooms = [],
  onCheckInSubmit,
  onCancel
}) {
  const vacantRooms = rooms.filter(r => r.status === 'VACANT');
  const [selectedRoomId, setSelectedRoomId] = useState(vacantRooms[0]?.id || '');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedRoom = rooms.find(r => String(r.id) === String(selectedRoomId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoomId) {
      setError('Please select a vacant room.');
      return;
    }
    if (!guestName.trim()) {
      setError('Guest name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onCheckInSubmit(selectedRoomId, {
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        guest_email: guestEmail.trim(),
        notes: notes.trim()
      });
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
      setNotes('');
    } catch (err) {
      setError(err.message || 'Check-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-[#D7E5E8] shadow-sm animate-in fade-in duration-200">
      <div className="flex items-center gap-3 border-b border-[#D7E5E8] pb-5 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
          <UserPlus className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Front Desk Guest Check-In
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Allocate a vacant room and open a guest account folio
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {vacantRooms.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-[#D7E5E8] space-y-2">
          <BedDouble className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">No Vacant Rooms Available</h4>
          <p className="text-xs text-slate-500">
            All rooms are currently occupied, under cleaning, or undergoing maintenance.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Room Selection */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Select Available Room *
              </label>

              <div className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {vacantRooms.map((r) => {
                  const isSelected = String(r.id) === String(selectedRoomId);
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setSelectedRoomId(r.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#3A7D7C] bg-[#EAF4F7] ring-2 ring-[#3A7D7C]/20 shadow-xs'
                          : 'border-[#D7E5E8] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-black text-slate-900">
                          Room {r.room_number}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Vacant
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium truncate">
                        {r.floor} • {r.room_type}
                      </span>
                      <span className="text-xs font-black text-[#3A7D7C] mt-2 block">
                        ₹{parseFloat(r.rate_per_night || 0).toFixed(2)}/night
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedRoom && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-[#D7E5E8] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Selected Room:</span>
                    <span className="font-bold text-slate-900">Room {selectedRoom.room_number} ({selectedRoom.room_type})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Bed Type & Capacity:</span>
                    <span className="font-bold text-slate-800">{selectedRoom.bed_type} (Max {selectedRoom.capacity} Guests)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Standard Tariff:</span>
                    <span className="font-extrabold text-[#3A7D7C]">₹{parseFloat(selectedRoom.rate_per_night || 0).toFixed(2)} / night</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Guest Information */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Guest Details *
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="guest@example.com"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Check-in Notes / ID Details
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <textarea
                    rows={3}
                    placeholder="e.g. Passport #, Gov ID verified, airport pickup requested..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] font-medium resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#D7E5E8] flex justify-end gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl border border-[#D7E5E8] bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !selectedRoomId || !guestName.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold shadow-md shadow-[#3A7D7C]/20 transition-all disabled:opacity-50 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Completing Check-In...' : 'Confirm & Check In'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
