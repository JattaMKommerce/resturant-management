import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  BedDouble, 
  CreditCard, 
  Sparkles, 
  RefreshCw, 
  X,
  ArrowRight,
  Globe,
  Tag
} from 'lucide-react';
import api from '../../services/api';

export default function BookingsTab({
  bookings = [],
  rooms = [],
  selectedHotelId = 1,
  selectedHotelName = 'The Grand Palace',
  onRefresh
}) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Walk-in Form State
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    guest_type: 'DOMESTIC',
    booking_source: 'WALK_IN',
    room_id: '',
    room_type: 'Deluxe Room',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    adults: 2,
    children: 0,
    rate_per_night: 2500,
    paid_amount: 0,
    payment_status: 'PENDING',
    special_requests: ''
  });

  // Filter bookings
  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.guest_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.booking_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.guest_phone?.includes(search) ||
      b.room_number?.toString().includes(search);

    const matchesSource = sourceFilter === 'ALL' || b.booking_source === sourceFilter;
    const matchesStatus = statusFilter === 'ALL' || b.booking_status === statusFilter;

    return matchesSearch && matchesSource && matchesStatus;
  });

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const days = Math.max(1, Math.round((new Date(formData.check_out_date) - new Date(formData.check_in_date)) / (1000 * 60 * 60 * 24)));
      const totalAmount = days * parseFloat(formData.rate_per_night || 2500);

      const payload = {
        ...formData,
        hotel_id: selectedHotelId,
        total_amount: totalAmount,
        paid_amount: parseFloat(formData.paid_amount || 0)
      };

      const res = await api.post('/rooms/bookings', payload);
      if (res.data?.success) {
        setSuccessMsg('Booking confirmed and recorded successfully!');
        setIsCreateOpen(false);
        onRefresh();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create booking.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const res = await api.put(`/rooms/bookings/${bookingId}/status`, { booking_status: 'CANCELLED' });
      if (res.data?.success) {
        onRefresh();
      }
    } catch (err) {
      alert('Failed to cancel booking.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* SUCCESS BANNER */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center animate-in fade-in">
          {successMsg}
        </div>
      )}

      {/* TOP CONTROLS & FILTERS */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Guest Name, Booking #, Phone, Room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006C70]/20 focus:border-[#006C70] transition-colors"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onRefresh}
              className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors shadow-2xs"
              title="Refresh Bookings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="py-2.5 px-4 rounded-2xl bg-[#006C70] hover:bg-[#00585C] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-sm shadow-[#006C70]/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Walk-In Booking</span>
            </button>
          </div>
        </div>

        {/* Source & Status Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          
          {/* Sources */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Source:
            </span>
            {['ALL', 'ONLINE', 'OFFLINE', 'WALK_IN'].map(src => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  sourceFilter === src
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {src === 'WALK_IN' ? 'Walk-In' : src === 'ALL' ? 'All Sources' : src}
              </button>
            ))}
          </div>

          {/* Statuses */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Status:
            </span>
            {['ALL', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-[#006C70] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All Statuses' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* BOOKINGS TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900">
              Reservation Directory
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#006C70]">
              {filteredBookings.length} Bookings
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Property: {selectedHotelName}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Booking #</th>
                <th className="py-3 px-4">Guest Details</th>
                <th className="py-3 px-4">Room & Type</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Amount / Status</th>
                <th className="py-3 px-4">Booking Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400 font-medium">
                    No reservations matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Booking Number */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#006C70]" />
                        <span>{b.booking_number}</span>
                      </div>
                    </td>

                    {/* Guest Details */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{b.guest_name}</div>
                      <div className="text-[11px] text-slate-500">{b.guest_phone || b.guest_email || 'No phone'}</div>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                        b.guest_type === 'INTERNATIONAL' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {b.guest_type}
                      </span>
                    </td>

                    {/* Room & Type */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">
                        {b.room_number ? `Room ${b.room_number}` : 'Unassigned'}
                      </div>
                      <div className="text-[11px] text-slate-500">{b.room_type}</div>
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        b.booking_source === 'ONLINE'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : b.booking_source === 'WALK_IN'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {b.booking_source}
                      </span>
                    </td>

                    {/* Dates */}
                    <td className="py-3.5 px-4 text-[11px]">
                      <div>In: <span className="font-bold text-slate-800">{new Date(b.check_in_date).toLocaleDateString()}</span></div>
                      <div>Out: <span className="font-bold text-slate-800">{new Date(b.check_out_date).toLocaleDateString()}</span></div>
                    </td>

                    {/* Amount / Payment */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">₹{parseFloat(b.total_amount || 0).toLocaleString()}</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        b.payment_status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {b.payment_status}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        b.booking_status === 'CONFIRMED'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : b.booking_status === 'CHECKED_IN'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : b.booking_status === 'CHECKED_OUT'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {b.booking_status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
                        >
                          Details
                        </button>
                        {b.booking_status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODAL: CREATE WALK-IN BOOKING                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-[#006C70]">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Create Offline / Walk-in Booking
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {selectedHotelName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateBooking} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-center">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={formData.guest_name}
                    onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006C70]/20 focus:border-[#006C70]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formData.guest_phone}
                    onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006C70]/20 focus:border-[#006C70]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="guest@example.com"
                    value={formData.guest_email}
                    onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#006C70]/20 focus:border-[#006C70]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Guest Origin Type</label>
                  <select
                    value={formData.guest_type}
                    onChange={(e) => setFormData({ ...formData, guest_type: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="DOMESTIC">Domestic Guest (India)</option>
                    <option value="INTERNATIONAL">International Guest</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assign Room (Available Inventory)</label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => {
                      const selRoom = rooms.find(r => Number(r.id) === Number(e.target.value));
                      setFormData({ 
                        ...formData, 
                        room_id: e.target.value,
                        room_type: selRoom ? selRoom.room_type : formData.room_type,
                        rate_per_night: selRoom ? selRoom.rate_per_night : formData.rate_per_night
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="">-- Assign Later / Unassigned --</option>
                    {rooms.filter(r => r.status === 'VACANT').map(r => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} ({r.room_type} - ₹{r.rate_per_night}/night)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rate Per Night (₹)</label>
                  <input
                    type="number"
                    value={formData.rate_per_night}
                    onChange={(e) => setFormData({ ...formData, rate_per_night: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Check-In Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.check_in_date}
                    onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Check-Out Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.check_out_date}
                    onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Advance Amount Paid (₹)</label>
                  <input
                    type="number"
                    value={formData.paid_amount}
                    onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Status</label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="PENDING">PENDING (Collect at Check-in)</option>
                    <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                    <option value="PAID">PAID IN FULL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Special Requests / Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Late arrival, airport shuttle, flower arrangement..."
                  value={formData.special_requests}
                  onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-[#006C70] hover:bg-[#00585C] text-white font-bold transition-all shadow-md shadow-[#006C70]/20 disabled:opacity-50"
                >
                  {loading ? 'Creating Booking...' : 'Confirm & Save Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODAL: VIEW BOOKING DETAILS                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Reservation Summary
                </span>
                <h3 className="text-base font-black text-slate-900">
                  #{selectedBooking.booking_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Guest Name:</span>
                  <span className="font-black text-slate-900">{selectedBooking.guest_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Phone:</span>
                  <span className="text-slate-700">{selectedBooking.guest_phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Origin Type:</span>
                  <span className="font-bold text-[#006C70]">{selectedBooking.guest_type}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Unit Number:</span>
                  <span className="font-black text-slate-900">
                    {selectedBooking.room_number ? `Room ${selectedBooking.room_number}` : 'Unassigned'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Category:</span>
                  <span className="text-slate-700">{selectedBooking.room_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Check-in / Check-out:</span>
                  <span className="text-slate-700">
                    {new Date(selectedBooking.check_in_date).toLocaleDateString()} → {new Date(selectedBooking.check_out_date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Total Stay Charges:</span>
                  <span className="font-black text-slate-900">₹{parseFloat(selectedBooking.total_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Paid Amount:</span>
                  <span className="font-black text-emerald-700">₹{parseFloat(selectedBooking.paid_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Payment Status:</span>
                  <span className="font-bold text-slate-800">{selectedBooking.payment_status}</span>
                </div>
              </div>

              {selectedBooking.special_requests && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-amber-900 text-[11px]">
                  <span className="font-bold block mb-0.5">Special Requests:</span>
                  {selectedBooking.special_requests}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
