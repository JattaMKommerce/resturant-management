import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  RefreshCw, 
  ShoppingBag, 
  Globe, 
  UtensilsCrossed, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Eye, 
  Printer, 
  X, 
  Bike, 
  User, 
  Phone, 
  MapPin, 
  CreditCard,
  Building,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight
} from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

export default function AdminHistoryPage() {
  const [historyData, setHistoryData] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    onlineOrdersCount: 0,
    onlineRevenue: 0,
    offlineOrdersCount: 0,
    offlineRevenue: 0,
    completedCount: 0,
    cancelledCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters State
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ONLINE' | 'OFFLINE'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRangePreset, setDateRangePreset] = useState('all'); // 'today', 'yesterday', '7d', '30d', 'all', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Table Horizontal Scroll & Swipe State
  const tableScrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [dragMoved, setDragMoved] = useState(false);

  const updateScrollIndicators = () => {
    if (tableScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    updateScrollIndicators();
    const el = tableScrollRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollIndicators);
      window.addEventListener('resize', updateScrollIndicators);
      return () => {
        el.removeEventListener('scroll', updateScrollIndicators);
        window.removeEventListener('resize', updateScrollIndicators);
      };
    }
  }, [historyData, loading]);

  const scrollTable = (direction) => {
    if (tableScrollRef.current) {
      const shift = direction === 'left' ? -350 : 350;
      tableScrollRef.current.scrollBy({ left: shift, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, select, a, [role="button"]')) return;
    setIsDragging(true);
    setDragMoved(false);
    setStartX(e.pageX - tableScrollRef.current.offsetLeft);
    setScrollLeftState(tableScrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !tableScrollRef.current) return;
    const x = e.pageX - tableScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.3;
    if (Math.abs(walk) > 5) {
      setDragMoved(true);
    }
    tableScrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    handleDatePresetChange(dateRangePreset);
  }, [dateRangePreset]);

  useEffect(() => {
    fetchHistory();
  }, [activeTab, statusFilter, startDate, endDate]);

  const handleDatePresetChange = (preset) => {
    setDateRangePreset(preset);
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const todayStr = formatDate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatDate(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === '7d') {
      const past7 = new Date(today);
      past7.setDate(past7.getDate() - 7);
      setStartDate(formatDate(past7));
      setEndDate(formatDate(today));
    } else if (preset === '30d') {
      const past30 = new Date(today);
      past30.setDate(past30.getDate() - 30);
      setStartDate(formatDate(past30));
      setEndDate(formatDate(today));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = {
        type: activeTab,
        limit: 300
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/admin/history', { params });
      if (res.data.success) {
        setHistoryData(res.data.orders || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Client-side search filter for instant responsiveness
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return historyData;
    const q = searchQuery.toLowerCase();
    return historyData.filter((o) => {
      const orderNum = (o.order_number || '').toLowerCase();
      const customer = (o.customer_name || '').toLowerCase();
      const phone = (o.customer_phone || '').toLowerCase();
      const table = (o.table_number || '').toLowerCase();
      const room = (o.room_number || '').toLowerCase();
      const address = (o.delivery_address || '').toLowerCase();
      return (
        orderNum.includes(q) ||
        customer.includes(q) ||
        phone.includes(q) ||
        table.includes(q) ||
        room.includes(q) ||
        address.includes(q)
      );
    });
  }, [historyData, searchQuery]);

  // Export to CSV
  const exportToCSV = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      alert('No history records to export for current filter.');
      return;
    }

    const headers = [
      'Order Number',
      'Channel Type',
      'Date & Time',
      'Customer Name',
      'Phone',
      'Table/Room/Address',
      'Status',
      'Payment Method',
      'Payment Status',
      'Subtotal (INR)',
      'Tax (INR)',
      'Delivery/Service (INR)',
      'Total Amount (INR)'
    ];

    const rows = filteredOrders.map((o) => [
      `"${o.order_number || ''}"`,
      `"${o.source_type || 'ONLINE'}"`,
      `"${o.created_at ? new Date(o.created_at).toLocaleString() : ''}"`,
      `"${o.customer_name || ''}"`,
      `"${o.customer_phone || ''}"`,
      `"${o.source_type === 'ONLINE' ? (o.delivery_address || '') : (o.table_number ? `Table ${o.table_number}` : (o.room_number ? `Room ${o.room_number}` : 'Takeaway'))}"`,
      `"${o.order_status || ''}"`,
      `"${o.payment_method || ''}"`,
      `"${o.payment_status || ''}"`,
      o.subtotal || 0,
      o.tax_amount || 0,
      o.delivery_fee || o.service_charge || 0,
      o.total_amount || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hotel_orders_history_${activeTab.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReceipt = () => {
    window.print();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
      case 'COMPLETED':
      case 'SERVED':
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> {status}
          </span>
        );
      case 'CANCELLED':
      case 'REJECTED':
      case 'DELIVERY_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> {status}
          </span>
        );
      case 'PREPARING':
      case 'IN_KITCHEN':
      case 'OUT_FOR_DELIVERY':
      case 'SENT_TO_KITCHEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-[#1F2937] border border-[#D7E5E8]">
            {status}
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12 antialiased font-sans">
        {/* Page Header */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#EAF4F7] border border-[#D7E5E8] rounded-xl text-[#3A7D7C]">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
                  Past History & Orders Archive
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#EAF4F7] text-[#3A7D7C] font-bold border border-[#D7E5E8] uppercase">
                    Unified Data
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] font-medium">
                  Instant past record inspection with dedicated Online and Offline Dine-In filtering
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#1F2937] border border-[#D7E5E8] text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 text-[#3A7D7C] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold transition-all shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Channel Switcher Tabs (ALL | ONLINE | OFFLINE) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D7E5E8] pb-3">
          <div className="overflow-x-auto custom-scrollbar w-full md:w-auto pb-1">
            <div className="inline-flex p-1 bg-white rounded-2xl border border-[#D7E5E8] shadow-xs whitespace-nowrap">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'ALL'
                    ? 'bg-[#3A7D7C] text-white shadow-2xs'
                    : 'text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7]'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>ALL PAST DATA</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748B]'}`}>
                  {stats.totalOrders}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ONLINE')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'ONLINE'
                    ? 'bg-[#3A7D7C] text-white shadow-2xs'
                    : 'text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7]'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>ONLINE ORDERS</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === 'ONLINE' ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748B]'}`}>
                  {stats.onlineOrdersCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('OFFLINE')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'OFFLINE'
                    ? 'bg-[#3A7D7C] text-white shadow-2xs'
                    : 'text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7]'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>OFFLINE / DINE-IN</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === 'OFFLINE' ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748B]'}`}>
                  {stats.offlineOrdersCount}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="overflow-x-auto custom-scrollbar w-full md:w-auto pb-1">
            <div className="inline-flex flex-nowrap sm:flex-wrap items-center gap-1.5 bg-white p-1 rounded-2xl border border-[#D7E5E8] shadow-xs">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    dateRangePreset === p.id
                      ? 'bg-[#3A7D7C] text-white shadow-2xs'
                      : 'text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Date Picker Bar (when custom preset chosen) */}
        {dateRangePreset === 'custom' && (
          <div className="p-4 bg-white border border-[#D7E5E8] rounded-2xl flex flex-wrap items-center gap-4 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3A7D7C]" />
              <span className="text-xs font-bold text-[#1F2937]">Start Date:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-[#D7E5E8] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1F2937]">End Date:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-[#D7E5E8] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>
            <button
              onClick={fetchHistory}
              className="px-4 py-1.5 bg-[#3A7D7C] text-white rounded-xl text-xs font-bold hover:bg-[#2F6665] transition-all shadow-2xs"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-[#D7E5E8] shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Total Past Records</p>
                <h3 className="text-2xl font-bold text-[#1F2937] mt-1">{stats.totalOrders}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EAF4F7] border border-[#D7E5E8] flex items-center justify-center text-[#3A7D7C]">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium">
              <span className="text-emerald-700 font-bold">{stats.completedCount} Completed</span>
              <span className="text-[#64748B]">•</span>
              <span className="text-rose-700 font-bold">{stats.cancelledCount} Cancelled</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#D7E5E8] shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Total Past Revenue</p>
                <h3 className="text-2xl font-bold text-emerald-700 mt-1">₹{stats.totalRevenue.toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
              <span>Fulfilled order total</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#D7E5E8] shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#3A7D7C]">Online Volume</p>
                <h3 className="text-2xl font-bold text-[#1F2937] mt-1">{stats.onlineOrdersCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EAF4F7] border border-[#D7E5E8] flex items-center justify-center text-[#3A7D7C]">
                <Globe className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs font-bold text-[#3A7D7C]">
              ₹{stats.onlineRevenue.toLocaleString()} Delivery Total
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#D7E5E8] shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Offline / Dine-In</p>
                <h3 className="text-2xl font-bold text-[#1F2937] mt-1">{stats.offlineOrdersCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs font-bold text-amber-700">
              ₹{stats.offlineRevenue.toLocaleString()} Dine-In Total
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-white rounded-2xl border border-[#D7E5E8] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order #, Customer, Phone, Table #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#64748B]" />
              <span className="text-xs text-[#64748B] font-bold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-[#D7E5E8] rounded-xl px-3 py-2 text-xs font-semibold text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              >
                <option value="ALL">All Statuses</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="SERVED">SERVED</option>
                <option value="PAID">PAID</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="PREPARING">PREPARING</option>
              </select>
            </div>
          </div>
        </div>

        {/* MOBILE CARDS LIST (No horizontal scrolling on phones) */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <div className="bg-white p-8 text-center rounded-2xl border border-[#D7E5E8] text-xs text-[#64748B]">
              Loading past data archive...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-2xl border border-[#D7E5E8]">
              <History className="w-10 h-10 mx-auto mb-2 text-[#64748B]/40" />
              <p className="font-bold text-[#1F2937] text-sm">No History Records Found</p>
              <p className="text-xs text-[#64748B] mt-1">Try adjusting the date range or filter status.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={`mob-${order.source_type}-${order.id}`}
                onClick={() => setSelectedOrder(order)}
                className="bg-white rounded-2xl border border-[#D7E5E8] p-4 shadow-2xs space-y-3 cursor-pointer hover:border-[#3A7D7C] transition-all"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    {order.source_type === 'ONLINE' ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8] flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> ONLINE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <UtensilsCrossed className="w-2.5 h-2.5" /> DINE-IN
                      </span>
                    )}
                    <span className="font-bold text-[#3A7D7C] font-mono text-xs">{order.order_number}</span>
                  </div>
                  {getStatusBadge(order.order_status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#64748B] block">Customer / Ref</span>
                    <span className="font-extrabold text-[#1F2937] block truncate">{order.customer_name || 'Guest'}</span>
                    <span className="text-[10px] text-[#64748B] block truncate">
                      {order.source_type === 'ONLINE' ? (order.delivery_address || 'Delivery') : (order.table_number ? `Table #${order.table_number}` : 'Counter')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-[#64748B] block">Total Amount</span>
                    <span className="font-mono font-black text-sm text-[#1F2937]">₹{parseFloat(order.total_amount || 0).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-600 block">{order.payment_method || 'CASH'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-[#64748B]">
                  <span>🕒 {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(order);
                    }}
                    className="px-3 py-1 bg-[#EAF4F7] text-[#3A7D7C] font-extrabold rounded-lg border border-[#D7E5E8]"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* History Table Container (DESKTOP) */}
        <div className="hidden md:block bg-white border border-[#D7E5E8] rounded-2xl shadow-xs overflow-hidden">
          {/* Scroll & Swipe Helper Toolbar */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-[#D7E5E8] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#64748B] font-medium">
              <span className="inline-flex items-center justify-center p-1 rounded-md bg-[#EAF4F7] text-[#3A7D7C]">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </span>
              <span className="text-[11px] sm:text-xs">
                Swipe or drag horizontally to view full order details
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold uppercase text-[#64748B] hidden sm:inline mr-1">Scroll:</span>
              <button
                onClick={() => scrollTable('left')}
                disabled={!canScrollLeft}
                className="p-1.5 rounded-lg border border-[#D7E5E8] bg-white text-[#1F2937] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center justify-center"
                title="Scroll Left"
                aria-label="Scroll Table Left"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-[#3A7D7C]" />
              </button>
              <button
                onClick={() => scrollTable('right')}
                disabled={!canScrollRight}
                className="p-1.5 rounded-lg border border-[#D7E5E8] bg-white text-[#1F2937] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center justify-center"
                title="Scroll Right"
                aria-label="Scroll Table Right"
              >
                <ChevronRight className="w-3.5 h-3.5 text-[#3A7D7C]" />
              </button>
            </div>
          </div>

          {/* Table with visible scrollbar & drag swiping */}
          <div className="relative">
            {canScrollLeft && (
              <div className="pointer-events-none absolute left-0 top-0 bottom-3 w-8 bg-gradient-to-r from-white/90 to-transparent z-10" />
            )}
            {canScrollRight && (
              <div className="pointer-events-none absolute right-0 top-0 bottom-3 w-8 bg-gradient-to-l from-white/90 to-transparent z-10" />
            )}

            <div
              ref={tableScrollRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className={`table-scrollbar pb-2 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            >
              <table className="w-full min-w-[1050px] text-left text-xs text-[#1F2937]">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-[#64748B] border-b border-[#D7E5E8]">
                  <tr>
                    <th className="px-5 py-4 whitespace-nowrap min-w-[180px]">Order / Channel</th>
                    <th className="px-5 py-4 whitespace-nowrap min-w-[140px]">Date & Time</th>
                    <th className="px-5 py-4 whitespace-nowrap min-w-[190px]">Customer / Destination</th>
                    <th className="px-5 py-4 whitespace-nowrap min-w-[200px]">Items Summary</th>
                    <th className="px-5 py-4 whitespace-nowrap min-w-[120px]">Payment</th>
                    <th className="px-5 py-4 whitespace-nowrap min-w-[120px]">Status</th>
                    <th className="px-5 py-4 whitespace-nowrap min-w-[110px] text-right">Amount</th>
                    <th className="px-5 py-4 whitespace-nowrap min-w-[110px] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-[#64748B]">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 border-3 border-[#3A7D7C] border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs font-bold text-[#1F2937]">Loading past data archive...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-[#64748B]">
                        <History className="w-10 h-10 mx-auto mb-2 text-[#64748B]/40" />
                        <p className="font-bold text-[#1F2937] text-sm">No History Records Found</p>
                        <p className="text-xs text-[#64748B] mt-1">Try adjusting the date range, status, or search query.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr
                        key={`${order.source_type}-${order.id}`}
                        onClick={() => {
                          if (!dragMoved) setSelectedOrder(order);
                        }}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        {/* Order Number & Channel */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {order.source_type === 'ONLINE' ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8] flex items-center gap-1 shrink-0">
                                <Globe className="w-2.5 h-2.5" /> ONLINE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 shrink-0">
                                <UtensilsCrossed className="w-2.5 h-2.5" /> DINE-IN
                              </span>
                            )}
                            <span className="font-bold text-[#3A7D7C] font-mono text-xs">{order.order_number}</span>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-[#1F2937]">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </td>

                        {/* Customer / Destination */}
                        <td className="px-5 py-4 max-w-xs">
                          <div className="font-bold text-[#1F2937] truncate">{order.customer_name || 'Guest'}</div>
                          <div className="text-[11px] text-[#64748B] truncate">
                            {order.source_type === 'ONLINE' ? (
                              order.delivery_address || order.delivery_area || 'Online delivery'
                            ) : (
                              order.table_number ? `Table #${order.table_number}` : (order.room_number ? `Room #${order.room_number}` : 'Takeaway Counter')
                            )}
                          </div>
                        </td>

                        {/* Items Summary */}
                        <td className="px-5 py-4 max-w-xs">
                          <span className="text-xs text-[#1F2937] line-clamp-1" title={order.items_summary}>
                            {order.items_summary || (order.items && order.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ')) || 'Standard Meal'}
                          </span>
                        </td>

                        {/* Payment Method */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-bold text-xs text-[#1F2937]">{order.payment_method || 'CASH'}</div>
                          <div className={`text-[10px] font-bold ${order.payment_status === 'COMPLETED' || order.payment_status === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>
                            • {order.payment_status || 'PENDING'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {getStatusBadge(order.order_status)}
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <span className="font-mono font-bold text-sm text-[#1F2937]">
                            ₹{parseFloat(order.total_amount || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 mx-auto"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#3A7D7C]" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Order Details Receipt Modal / Drawer */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div 
              className="bg-white border border-[#D7E5E8] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-[#D7E5E8] flex items-center justify-between bg-slate-50 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-[#EAF4F7] border border-[#D7E5E8] text-[#3A7D7C] shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#1F2937] text-sm sm:text-base flex items-center gap-2 truncate">
                      Receipt #{selectedOrder.order_number}
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]">
                        {selectedOrder.source_type}
                      </span>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#64748B] truncate">
                      Placed on {new Date(selectedOrder.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={printReceipt}
                    className="p-2 bg-white hover:bg-slate-50 text-[#1F2937] rounded-xl border border-[#D7E5E8] transition-colors shadow-2xs"
                    title="Print Receipt"
                  >
                    <Printer className="w-4 h-4 text-[#3A7D7C]" />
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 bg-white hover:bg-slate-50 text-[#64748B] hover:text-[#1F2937] rounded-xl border border-[#D7E5E8] transition-colors shadow-2xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar text-xs">
                {/* Meta details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-[#D7E5E8]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#64748B] block">Customer Information</span>
                    <p className="font-bold text-[#1F2937] text-sm mt-0.5">{selectedOrder.customer_name || 'Guest'}</p>
                    <p className="text-[#64748B] flex items-center gap-1 mt-0.5 font-medium">
                      <Phone className="w-3 h-3 text-[#3A7D7C]" /> {selectedOrder.customer_phone || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                      {selectedOrder.source_type === 'ONLINE' ? 'Delivery Address' : 'Dining Location'}
                    </span>
                    <p className="font-bold text-[#1F2937] mt-0.5">
                      {selectedOrder.source_type === 'ONLINE' ? (
                        selectedOrder.delivery_address || 'Online Order'
                      ) : (
                        selectedOrder.table_number ? `Table #${selectedOrder.table_number}` : (selectedOrder.room_number ? `Room #${selectedOrder.room_number}` : 'Takeaway Counter')
                      )}
                    </p>
                    {selectedOrder.delivery_area && (
                      <p className="text-[#64748B] mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#3A7D7C]" /> {selectedOrder.delivery_area}
                      </p>
                    )}
                  </div>

                  {selectedOrder.driver_name && (
                    <div className="col-span-2 pt-2 border-t border-[#D7E5E8] flex items-center gap-2">
                      <Bike className="w-4 h-4 text-emerald-700" />
                      <span className="text-[#64748B]">Assigned Driver:</span>
                      <span className="font-bold text-[#1F2937]">{selectedOrder.driver_name}</span>
                      {selectedOrder.driver_phone && <span className="text-[#64748B]">({selectedOrder.driver_phone})</span>}
                    </div>
                  )}
                </div>

                {/* Itemized breakdown table */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#64748B] mb-2">Itemized Items</h4>
                  <div className="border border-[#D7E5E8] rounded-xl overflow-hidden bg-white">
                    <div className="table-scrollbar">
                      <table className="w-full text-left min-w-[380px]">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-[#64748B] border-b border-[#D7E5E8]">
                          <tr>
                            <th className="px-4 py-2.5 whitespace-nowrap">Item Name</th>
                            <th className="px-4 py-2.5 text-center whitespace-nowrap">Qty</th>
                            <th className="px-4 py-2.5 text-right whitespace-nowrap">Unit Price</th>
                            <th className="px-4 py-2.5 text-right whitespace-nowrap">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D7E5E8] text-[#1F2937]">
                          {selectedOrder.items && selectedOrder.items.length > 0 ? (
                            selectedOrder.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 font-semibold text-[#1F2937]">{item.item_name}</td>
                                <td className="px-4 py-2.5 text-center font-bold">{item.quantity}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-[#64748B] whitespace-nowrap">₹{parseFloat(item.unit_price || 0).toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-[#1F2937] whitespace-nowrap">₹{parseFloat(item.item_total || 0).toFixed(2)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="px-4 py-4 text-center text-[#64748B] italic">
                                Item details recorded in billing ledger
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-50 p-4 rounded-xl border border-[#D7E5E8] space-y-2">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold text-[#1F2937]">₹{parseFloat(selectedOrder.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {selectedOrder.tax_amount > 0 && (
                    <div className="flex justify-between text-[#64748B]">
                      <span>GST / Tax:</span>
                      <span className="font-mono text-[#1F2937]">₹{parseFloat(selectedOrder.tax_amount).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_fee > 0 && (
                    <div className="flex justify-between text-[#64748B]">
                      <span>Delivery Fee:</span>
                      <span className="font-mono text-[#1F2937]">₹{parseFloat(selectedOrder.delivery_fee).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.service_charge > 0 && (
                    <div className="flex justify-between text-[#64748B]">
                      <span>Service Charge:</span>
                      <span className="font-mono text-[#1F2937]">₹{parseFloat(selectedOrder.service_charge).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Discount:</span>
                      <span className="font-mono">-₹{parseFloat(selectedOrder.discount_amount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#D7E5E8] flex justify-between text-base font-bold text-[#1F2937]">
                    <span>Grand Total:</span>
                    <span className="font-mono text-[#3A7D7C]">₹{parseFloat(selectedOrder.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#D7E5E8] bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#64748B] font-medium">Status:</span>
                  {getStatusBadge(selectedOrder.order_status)}
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs transition-colors shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
