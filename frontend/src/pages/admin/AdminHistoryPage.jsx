import React, { useState, useEffect, useMemo } from 'react';
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
  Sparkles
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> {status}
          </span>
        );
      case 'CANCELLED':
      case 'REJECTED':
      case 'DELIVERY_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> {status}
          </span>
        );
      case 'PREPARING':
      case 'IN_KITCHEN':
      case 'OUT_FOR_DELIVERY':
      case 'SENT_TO_KITCHEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shadow-inner">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Past History & Orders Archive
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 uppercase">
                    Unified Data
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Instant past record inspection with dedicated Online and Offline Dine-In filtering
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all hover:border-slate-600 disabled:opacity-50 shadow-sm"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-900/20"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Channel Switcher Tabs (ALL | ONLINE | OFFLINE) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-2">
          <div className="overflow-x-auto custom-scrollbar w-full md:w-auto pb-1">
            <div className="inline-flex p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl whitespace-nowrap">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                  activeTab === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>ALL PAST DATA</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'ALL' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                  {stats.totalOrders}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ONLINE')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                  activeTab === 'ONLINE'
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>ONLINE ORDERS</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'ONLINE' ? 'bg-slate-950 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
                  {stats.onlineOrdersCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('OFFLINE')}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                  activeTab === 'OFFLINE'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>OFFLINE / DINE-IN</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'OFFLINE' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  {stats.offlineOrdersCount}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="overflow-x-auto custom-scrollbar w-full md:w-auto pb-1">
            <div className="inline-flex flex-nowrap sm:flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
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
                      ? 'bg-slate-700 text-white border border-slate-600 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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
          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-wrap items-center gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-300">Start Date:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">End Date:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={fetchHistory}
              className="px-4 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-extrabold hover:bg-amber-400 transition-all"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Past Records</p>
                <h3 className="text-2xl font-black text-white mt-1">{stats.totalOrders}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span className="text-emerald-400 font-bold">{stats.completedCount} Completed</span>
              <span>•</span>
              <span className="text-rose-400 font-bold">{stats.cancelledCount} Cancelled</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Past Revenue</p>
                <h3 className="text-2xl font-black text-emerald-400 mt-1">₹{stats.totalRevenue.toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fulfilled order total</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">Online Volume</p>
                <h3 className="text-2xl font-black text-white mt-1">{stats.onlineOrdersCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Globe className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold text-sky-300">
              ₹{stats.onlineRevenue.toLocaleString()} Delivery Total
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">Offline / Dine-In</p>
                <h3 className="text-2xl font-black text-white mt-1">{stats.offlineOrdersCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs font-semibold text-orange-300">
              ₹{stats.offlineRevenue.toLocaleString()} Dine-In Total
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order #, Customer, Phone, Table #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400 font-bold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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

        {/* History Table */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[850px] text-left text-xs text-slate-300">
              <thead className="bg-slate-950/90 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-4">Order / Channel</th>
                  <th className="px-5 py-4">Date & Time</th>
                  <th className="px-5 py-4">Customer / Destination</th>
                  <th className="px-5 py-4">Items Summary</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                  <th className="px-5 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-semibold">Loading past data archive...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <History className="w-8 h-8 text-slate-600" />
                        <p className="text-sm font-bold text-slate-300">No past orders found</p>
                        <p className="text-xs text-slate-500">Try changing the channel filter, date range, or search keyword.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr 
                      key={`${order.source_type}-${order.id}`}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      {/* Order / Channel */}
                      <td className="px-5 py-4 font-mono font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {order.source_type === 'ONLINE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-500/10 text-sky-400 border border-sky-500/30">
                              <Globe className="w-3 h-3" /> ONLINE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <UtensilsCrossed className="w-3 h-3" /> OFFLINE
                            </span>
                          )}
                          <span className="group-hover:text-amber-400 transition-colors">{order.order_number}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                        <div className="font-semibold text-slate-200">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>

                      {/* Customer / Destination */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-white truncate max-w-[160px]">{order.customer_name || 'Guest'}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {order.source_type === 'ONLINE' ? (
                            order.delivery_area || order.delivery_address || 'Online Order'
                          ) : (
                            order.table_number ? `Table ${order.table_number}` : (order.room_number ? `Room ${order.room_number}` : 'Takeaway / Counter')
                          )}
                        </div>
                      </td>

                      {/* Items Summary */}
                      <td className="px-5 py-4 text-slate-300">
                        {order.items && order.items.length > 0 ? (
                          <div className="truncate max-w-[200px]" title={order.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ')}>
                            {order.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ')}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Items archived</span>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-200">{order.payment_method || 'CASH'}</div>
                        <div className="text-[10px]">
                          {order.payment_status === 'PAID' ? (
                            <span className="text-emerald-400 font-bold">● Paid</span>
                          ) : (
                            <span className="text-amber-400 font-bold">● {order.payment_status || 'Unpaid'}</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getStatusBadge(order.order_status)}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 text-right font-black text-amber-400 font-mono text-sm whitespace-nowrap">
                        ₹{(order.total_amount || 0).toLocaleString()}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
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

        {/* Order Details Receipt Modal / Drawer */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div 
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2 truncate">
                      Receipt #{selectedOrder.order_number}
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-slate-800 text-slate-300">
                        {selectedOrder.source_type}
                      </span>
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                      Placed on {new Date(selectedOrder.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={printReceipt}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
                    title="Print Receipt"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar text-xs">
                {/* Meta details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Customer Information</span>
                    <p className="font-bold text-white text-sm mt-0.5">{selectedOrder.customer_name || 'Guest'}</p>
                    <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-amber-400" /> {selectedOrder.customer_phone || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      {selectedOrder.source_type === 'ONLINE' ? 'Delivery Address' : 'Dining Location'}
                    </span>
                    <p className="font-bold text-white mt-0.5">
                      {selectedOrder.source_type === 'ONLINE' ? (
                        selectedOrder.delivery_address || 'Online Order'
                      ) : (
                        selectedOrder.table_number ? `Table #${selectedOrder.table_number}` : (selectedOrder.room_number ? `Room #${selectedOrder.room_number}` : 'Takeaway Counter')
                      )}
                    </p>
                    {selectedOrder.delivery_area && (
                      <p className="text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-sky-400" /> {selectedOrder.delivery_area}
                      </p>
                    )}
                  </div>

                  {selectedOrder.driver_name && (
                    <div className="col-span-2 pt-2 border-t border-slate-800/60 flex items-center gap-2">
                      <Bike className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-400">Assigned Driver:</span>
                      <span className="font-bold text-white">{selectedOrder.driver_name}</span>
                      {selectedOrder.driver_phone && <span className="text-slate-500">({selectedOrder.driver_phone})</span>}
                    </div>
                  )}
                </div>

                {/* Itemized breakdown table */}
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400 mb-2">Itemized Items</h4>
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5">Item Name</th>
                          <th className="px-4 py-2.5 text-center">Qty</th>
                          <th className="px-4 py-2.5 text-right">Unit Price</th>
                          <th className="px-4 py-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {selectedOrder.items && selectedOrder.items.length > 0 ? (
                          selectedOrder.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="px-4 py-2.5 font-medium text-white">{item.item_name}</td>
                              <td className="px-4 py-2.5 text-center font-bold">{item.quantity}</td>
                              <td className="px-4 py-2.5 text-right font-mono">₹{parseFloat(item.unit_price || 0).toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-200">₹{parseFloat(item.item_total || 0).toFixed(2)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-4 py-4 text-center text-slate-500 italic">
                              Item details recorded in billing ledger
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono text-white">₹{parseFloat(selectedOrder.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {selectedOrder.tax_amount > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>GST / Tax:</span>
                      <span className="font-mono text-white">₹{parseFloat(selectedOrder.tax_amount).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_fee > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Delivery Fee:</span>
                      <span className="font-mono text-white">₹{parseFloat(selectedOrder.delivery_fee).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.service_charge > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Service Charge:</span>
                      <span className="font-mono text-white">₹{parseFloat(selectedOrder.service_charge).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount:</span>
                      <span className="font-mono">-₹{parseFloat(selectedOrder.discount_amount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-base font-black text-amber-400">
                    <span>Grand Total:</span>
                    <span className="font-mono">₹{parseFloat(selectedOrder.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Status:</span>
                  {getStatusBadge(selectedOrder.order_status)}
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
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
