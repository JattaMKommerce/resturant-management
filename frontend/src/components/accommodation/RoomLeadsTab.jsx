import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  MessageSquare,
  Search,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
  BedDouble,
  User,
  Filter,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Tag,
  DollarSign
} from 'lucide-react';

export default function RoomLeadsTab({ showToast }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/room-inquiries').catch(() => api.get('/rooms/inquiries/list'));
      const payload = res?.data || res;
      const list =
        payload?.inquiries ||
        payload?.data?.inquiries ||
        res?.inquiries ||
        res?.data?.inquiries ||
        res?.data?.data?.inquiries ||
        (Array.isArray(payload) ? payload : []);
      setInquiries(list);
    } catch (err) {
      console.error('Failed to fetch room inquiries:', err);
      if (showToast) showToast('Failed to load room reservation leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (inquiryId, newStatus) => {
    setUpdatingId(inquiryId);
    try {
      await api.patch(`/admin/room-inquiries/${inquiryId}/status`, { status: newStatus }).catch(() =>
        api.patch(`/rooms/inquiries/${inquiryId}/status`, { status: newStatus })
      );
      setInquiries(prev =>
        prev.map(item => (item.id === inquiryId ? { ...item, status: newStatus } : item))
      );
      if (showToast) showToast(`Lead status updated to ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update lead status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteInquiry = async (inquiryId) => {
    if (!window.confirm('Are you sure you want to delete this reservation lead?')) return;
    try {
      await api.delete(`/admin/room-inquiries/${inquiryId}`).catch(() =>
        api.delete(`/rooms/inquiries/${inquiryId}`)
      );
      setInquiries(prev => prev.filter(item => item.id !== inquiryId));
      if (showToast) showToast('Lead deleted successfully');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete lead');
    }
  };

  // Filtered leads
  const filtered = inquiries.filter(item => {
    const textMatch =
      !search ||
      (item.guest_name && item.guest_name.toLowerCase().includes(search.toLowerCase())) ||
      (item.guest_phone && item.guest_phone.includes(search)) ||
      (item.room_type && item.room_type.toLowerCase().includes(search.toLowerCase())) ||
      (item.room_number && String(item.room_number).includes(search));

    const statusMatch = statusFilter === 'ALL' || item.status === statusFilter;
    return textMatch && statusMatch;
  });

  // KPI Counters
  const totalCount = inquiries.length;
  const pendingCount = inquiries.filter(i => i.status === 'PENDING_INQUIRY' || !i.status).length;
  const contactedCount = inquiries.filter(i => i.status === 'CONTACTED').length;
  const confirmedCount = inquiries.filter(i => i.status === 'CONFIRMED').length;

  const formatPhoneForWhatsapp = (phone) => {
    if (!phone) return '';
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    return cleaned;
  };

  const calculateNights = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'CONTACTED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'PENDING_INQUIRY':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & SUMMARY METRICS */}
      <div className="bg-white rounded-3xl border border-[#D7E5E8] p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D7E5E8] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[#3A7D7C] text-white shadow-md shadow-[#3A7D7C]/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Website Room Reservation Leads
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Customer Website
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                All booking inquiries submitted by guests on your public hotel website.
              </p>
            </div>
          </div>

          <button
            onClick={fetchInquiries}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#D7E5E8] text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3A7D7C]' : ''}`} />
            <span>Refresh Leads</span>
          </button>
        </div>

        {/* METRIC COUNTERS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-5">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Leads</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Action</span>
            <div className="text-2xl font-black text-amber-950 mt-1">{pendingCount}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Contacted</span>
            <div className="text-2xl font-black text-blue-950 mt-1">{contactedCount}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Confirmed Stay</span>
            <div className="text-2xl font-black text-emerald-950 mt-1">{confirmedCount}</div>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTERS */}
      <div className="bg-white rounded-3xl border border-[#D7E5E8] p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by guest name, phone, room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 scrollbar-none touch-pan-x">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PENDING_INQUIRY', label: 'Pending' },
            { id: 'CONTACTED', label: 'Contacted' },
            { id: 'CONFIRMED', label: 'Confirmed' },
            { id: 'CANCELLED', label: 'Cancelled' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#3A7D7C] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. LEADS LIST / TABLE */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-[#D7E5E8] p-12 text-center space-y-3 shadow-2xs">
          <RefreshCw className="w-8 h-8 text-[#3A7D7C] animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading website room leads...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#D7E5E8] p-12 text-center space-y-3 shadow-2xs">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-900">No Reservation Leads Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || statusFilter !== 'ALL'
              ? 'No leads matched your search or status filter criteria.'
              : 'When guests request room reservations on your website, their contact details and room choices will appear here!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const nights = calculateNights(item.check_in_date, item.check_out_date);
            const roomDisplay = item.room_number
              ? `Room ${item.room_number} (${item.room_type || 'Standard Suite'})`
              : (item.live_room_number ? `Room ${item.live_room_number} (${item.live_room_type})` : (item.room_type || 'General Room Inquiry'));

            const priceDisplay = item.price_per_night || item.base_price;
            const waPhone = formatPhoneForWhatsapp(item.guest_phone);

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-[#D7E5E8] p-5 shadow-2xs hover:shadow-md transition-all space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#D7E5E8] pb-4">
                  {/* GUEST INFO */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-base shrink-0">
                      {item.guest_name ? item.guest_name.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900">{item.guest_name || 'Guest'}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getStatusBadge(item.status)}`}>
                          {item.status ? item.status.replace('_', ' ') : 'PENDING'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-1 flex-wrap">
                        <span className="font-bold flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-[#3A7D7C]" />
                          {item.guest_phone}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 font-medium">
                          Submitted: {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QUICK CONTACT ACTIONS */}
                  <div className="flex items-center gap-2">
                    {waPhone && (
                      <a
                        href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${item.guest_name || 'Guest'}, thank you for inquiring about ${roomDisplay} for ${item.check_in_date ? item.check_in_date.slice(0, 10) : 'your stay'}. We are happy to confirm your booking!`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>WhatsApp Guest</span>
                      </a>
                    )}
                    <a
                      href={`tel:${item.guest_phone}`}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>

                {/* ROOM & STAY DETAILS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  {/* ENQUIRED ROOM HIGHLIGHT */}
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                      <BedDouble className="w-3.5 h-3.5 text-emerald-600" />
                      Enquired Room
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">{roomDisplay}</h4>
                    {priceDisplay && (
                      <span className="text-xs font-black text-emerald-800 mt-1 inline-block">
                        ₹{Number(priceDisplay).toLocaleString('en-IN')} / night
                      </span>
                    )}
                  </div>

                  {/* STAY DATES & DURATION */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#3A7D7C]" />
                      Check-In & Check-Out
                    </span>
                    <div className="font-bold text-slate-900 mt-1">
                      {item.check_in_date ? String(item.check_in_date).slice(0, 10) : 'TBD'} ➔ {item.check_out_date ? String(item.check_out_date).slice(0, 10) : 'TBD'}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 mt-0.5 inline-block">
                      Duration: <strong className="text-slate-800">{nights} {nights === 1 ? 'Night' : 'Nights'}</strong>
                    </span>
                  </div>

                  {/* SPECIAL REQUESTS / NOTES */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Special Requests / Notes
                    </span>
                    <p className="text-xs font-medium text-slate-700 italic mt-1 line-clamp-2">
                      {item.notes ? `"${item.notes}"` : 'No special requests provided.'}
                    </p>
                  </div>
                </div>

                {/* BOTTOM STATUS UPDATE CONTROL */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Update Lead Status:</span>
                    <select
                      value={item.status || 'PENDING_INQUIRY'}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      disabled={updatingId === item.id}
                      className="px-3 py-1.5 bg-white border border-[#D7E5E8] rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
                    >
                      <option value="PENDING_INQUIRY">⏳ Pending Inquiry</option>
                      <option value="CONTACTED">📞 Contacted Guest</option>
                      <option value="CONFIRMED">✅ Confirmed Booking</option>
                      <option value="CANCELLED">❌ Cancelled</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleDeleteInquiry(item.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete Lead"
                  >
                    <Trash2 className="w-4 h-4" />
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
