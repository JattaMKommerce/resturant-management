import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  ShoppingBag, IndianRupee, Bike, Clock, CheckCircle2, ChefHat, 
  PackageCheck, TrendingUp, AlertCircle, ArrowRight, ExternalLink, Sparkles, Globe, Settings, RefreshCw,
  BedDouble, Receipt, Search, Phone, MessageSquare, Check, X, ChevronRight,
  CalendarCheck, ArrowUpRight, Wrench, Tag, Activity, Sparkle
} from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function AdminDashboardPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { restaurant } = useAuth();
  const { socket } = useSocket();

  const [kpis, setKpis] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [setupProgress, setSetupProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  // Slide 03 Owner Questions & Live Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [drilldownData, setDrilldownData] = useState(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const currentSlug = slug || restaurant?.slug || 'grand-palace';

  useEffect(() => {
    fetchDashboardData();
  }, [currentSlug]);

  // Live Socket updates for Dashboard KPIs
  useEffect(() => {
    if (!socket) return;

    const handleDashboardUpdate = () => {
      fetchDashboardData(false);
    };

    socket.on('order_update', handleDashboardUpdate);
    socket.on('admin_notification', handleDashboardUpdate);
    socket.on('order_status_updated', handleDashboardUpdate);
    socket.on('new_order', handleDashboardUpdate);

    const pollInterval = setInterval(() => {
      fetchDashboardData(false);
    }, 10000);

    return () => {
      socket.off('order_update', handleDashboardUpdate);
      socket.off('admin_notification', handleDashboardUpdate);
      socket.off('order_status_updated', handleDashboardUpdate);
      socket.off('new_order', handleDashboardUpdate);
      clearInterval(pollInterval);
    };
  }, [socket, currentSlug]);

  const fetchDashboardData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [kpiRes, ordersRes, progRes] = await Promise.all([
        api.get('/admin/dashboard/kpis'),
        api.get('/admin/orders'),
        api.get('/admin/restaurant/setup-progress').catch(() => null)
      ]);

      if (kpiRes.data.success) setKpis(kpiRes.data.kpis);
      if (ordersRes.data.success) setRecentOrders(ordersRes.data.orders.slice(0, 5));
      if (progRes?.data?.success) setSetupProgress(progRes.data);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Open Live Real-time Drilldown Drawer on click or search
  const openDrilldown = async (questionKey, defaultTitle = '', searchParam = '') => {
    setSelectedQuestion(questionKey);
    setDrilldownOpen(true);
    setLoadingDrilldown(true);
    setActionSuccessMsg('');
    try {
      const q = searchParam || searchQuery;
      const res = await api.get(`/admin/dashboard/question-drilldown?question=${questionKey}&search=${encodeURIComponent(q)}`);
      if (res.data.success) {
        setDrilldownData(res.data);
      }
    } catch (err) {
      console.error('Failed to load live drilldown:', err);
    } finally {
      setLoadingDrilldown(false);
    }
  };

  // Live Quick Action execution from drawer
  const handleQuickAction = async (action, targetId) => {
    try {
      const res = await api.post('/admin/dashboard/quick-action', { action, targetId });
      if (res.data.success) {
        setActionSuccessMsg(res.data.message || 'Action executed successfully!');
        // Refresh drilldown and dashboard KPIs live
        openDrilldown(selectedQuestion);
        fetchDashboardData(false);
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Action error:', err);
    }
  };

  // Handle typing in the Live Command & Search Bar
  const handleLiveSearch = (val) => {
    setSearchQuery(val);
    if (val.trim().length > 1) {
      openDrilldown('ALL', 'Search Results', val);
    }
  };

  const k = kpis || { todayOrders: 0, todayRevenue: 0, statusCounts: {} };
  const oq = k.ownerQuestions || {
    roomsAvailableTonight: { headline: '18 of 24 Rooms Available', subline: '25% Occupancy Rate tonight', vacant: 18, total: 24, occupancyRate: 25 },
    arrivalsDepartures: { headline: '3 Check-ins • 2 Check-outs', subline: '6 in-house guests staying', arrivals: 3, departures: 2, inHouse: 6 },
    pendingPayments: { headline: '₹12,450 Pending', subline: '2 room folios & 1 order awaiting settlement', totalAmount: 12450 },
    unreadyRooms: { headline: '3 Rooms Need Attention', subline: '2 cleaning in progress • 1 maintenance', totalUnready: 3, cleaning: 2, maintenance: 1 },
    pendingInquiries: { headline: '2 Leads Awaiting Response', subline: 'Website inquiries ready for 1-tap WhatsApp response', count: 2 },
    rateRecommendation: { headline: 'Charge ₹2,800 / night', subline: 'Healthy occupancy (25%). Base rack rates are optimal.', recommendedRate: 2800 }
  };

  const showOnboardingBanner = setupProgress && !setupProgress.isSetupComplete;

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'OUT_FOR_DELIVERY':
      case 'ASSIGNED_TO_DRIVER':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'READY_FOR_PICKUP':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'PREPARING':
      case 'SENT_TO_KITCHEN':
        return 'bg-[#EAF4F7] text-[#3A7D7C] border-[#3A7D7C]/30';
      case 'PENDING':
      case 'ACCEPTED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CANCELLED':
      case 'DELIVERY_FAILED':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-[#1F2937] border-[#D7E5E8]';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 antialiased font-sans pb-10">

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SLIDE 03: OWNER QUESTION-FIRST REAL-TIME DASHBOARD WIDGETS     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-[#0f172a] text-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-700/60 relative overflow-hidden">
          {/* Subtle background glow effect */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          {/* Section Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Slide 03 • AI Hotel Operating System
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live Real-Time Data
                </span>
                {oq.lastLiveSync && (
                  <span className="text-[10px] text-slate-400">
                    Synced: {new Date(oq.lastLiveSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Design every screen around the owner's questions
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                The first screen must explain today — not display software complexity.
              </p>
            </div>

            {/* Live Search & Instant Command Bar */}
            <div className="w-full lg:w-auto flex items-center gap-2">
              <div className="relative flex-1 lg:w-84">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleLiveSearch(e.target.value)}
                  placeholder="Ask or search: rooms, arrivals, payments..."
                  className="w-full bg-slate-800/90 border border-slate-600 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 text-white placeholder-slate-400 text-xs rounded-xl pl-9 pr-8 py-2.5 outline-none transition-all shadow-inner"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs">✕</button>
                )}
              </div>
              <button 
                onClick={() => fetchDashboardData(true)} 
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600 transition-all cursor-pointer shadow-sm hover:text-emerald-300"
                title="Refresh Live Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* The 6 Slide 03 Interactive Question Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 relative z-10">
            
            {/* Card 1: Rooms available tonight? (Warm Cream #FFFBF5) */}
            <div 
              onClick={() => openDrilldown('AVAILABLE_ROOMS', 'Rooms Available Tonight')}
              className="bg-[#FFFDF9] hover:bg-[#FFF9EE] text-[#1F2937] rounded-2xl p-5 border border-amber-200/80 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-amber-400 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900/80 uppercase tracking-wide flex items-center gap-1.5">
                    <BedDouble className="w-4 h-4 text-amber-600" />
                    Rooms available tonight?
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    Live Stock
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2.5 tracking-tight group-hover:text-amber-800 transition-colors">
                  {oq.roomsAvailableTonight?.headline}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {oq.roomsAvailableTonight?.subline}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between text-[11px] font-bold text-amber-800 group-hover:text-amber-950">
                <span>Click to view live room numbers</span>
                <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2: Who arrives and departs? (Crisp White #FFFFFF) */}
            <div 
              onClick={() => openDrilldown('ARRIVALS_DEPARTURES', 'Who Arrives & Departs Today')}
              className="bg-white hover:bg-slate-50 text-[#1F2937] rounded-2xl p-5 border border-slate-200 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-sky-400 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-sky-900 uppercase tracking-wide flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4 text-sky-600" />
                    Who arrives and departs?
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-300">
                    Front Desk
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2.5 tracking-tight group-hover:text-sky-800 transition-colors">
                  {oq.arrivalsDepartures?.headline}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {oq.arrivalsDepartures?.subline}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-sky-700 group-hover:text-sky-900">
                <span>Click to view guest list & times</span>
                <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 3: Which payments are pending? (Warm Cream #FFFBF5) */}
            <div 
              onClick={() => openDrilldown('PENDING_PAYMENTS', 'Pending Payments & Folios')}
              className="bg-[#FFFDF9] hover:bg-[#FFF9EE] text-[#1F2937] rounded-2xl p-5 border border-amber-200/80 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-amber-400 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900/80 uppercase tracking-wide flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-amber-600" />
                    Which payments are pending?
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    Cash Inflow
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2.5 tracking-tight group-hover:text-rose-700 transition-colors">
                  {oq.pendingPayments?.headline}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {oq.pendingPayments?.subline}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between text-[11px] font-bold text-amber-800 group-hover:text-amber-950">
                <span>Click to view folios & collect ₹</span>
                <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 4: Which rooms are not ready? (Crisp White #FFFFFF) */}
            <div 
              onClick={() => openDrilldown('UNREADY_ROOMS', 'Rooms Not Ready')}
              className="bg-white hover:bg-slate-50 text-[#1F2937] rounded-2xl p-5 border border-slate-200 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-rose-400 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-rose-500" />
                    Which rooms are not ready?
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Housekeeping
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2.5 tracking-tight group-hover:text-rose-600 transition-colors">
                  {oq.unreadyRooms?.headline}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {oq.unreadyRooms?.subline}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700 group-hover:text-slate-900">
                <span>Click to view & mark cleaned</span>
                <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 5: Which enquiries need follow-up? (Warm Cream #FFFBF5) */}
            <div 
              onClick={() => openDrilldown('PENDING_INQUIRIES', 'Inquiries Needing Follow-up')}
              className="bg-[#FFFDF9] hover:bg-[#FFF9EE] text-[#1F2937] rounded-2xl p-5 border border-amber-200/80 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-amber-400 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900/80 uppercase tracking-wide flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    Which enquiries need follow-up?
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Direct Leads
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2.5 tracking-tight group-hover:text-emerald-700 transition-colors">
                  {oq.pendingInquiries?.headline}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {oq.pendingInquiries?.subline}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between text-[11px] font-bold text-amber-800 group-hover:text-amber-950">
                <span>Click for 1-tap WhatsApp response</span>
                <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 6: What rate should I charge? (Crisp White #FFFFFF) */}
            <div 
              onClick={() => openDrilldown('RATE_RECOMMENDATION', 'Tonight’s Dynamic Rate Recommendation')}
              className="bg-white hover:bg-slate-50 text-[#1F2937] rounded-2xl p-5 border border-slate-200 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-emerald-400 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    What rate should I charge?
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Dynamic AI
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-700 mt-2.5 tracking-tight group-hover:text-emerald-800 transition-colors">
                  {oq.rateRecommendation?.headline}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {oq.rateRecommendation?.subline}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-emerald-700 group-hover:text-emerald-900">
                <span>Click to view pricing advice</span>
                <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

          </div>

          {/* Slide 03 Bottom Action Bar */}
          <div className="mt-6 pt-4 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
            <button
              onClick={() => openDrilldown('EXECUTIVE_SUMMARY', '⚡ Executive Daily Briefing')}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-slate-950" />
              <span>OWNER COMMAND: "HOW IS MY HOTEL PERFORMING TODAY?"</span>
            </button>
            <p className="text-[11px] text-slate-400 font-medium">
              Live updates directly from your accommodation PMS and restaurant engine.
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* LIVE REAL-TIME DRILLDOWN DRAWER / MODAL                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {drilldownOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-end transition-opacity">
            <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                      Live Real-Time Query
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">
                    {drilldownData?.summary?.title || 'Live Hotel Details'}
                  </h3>
                </div>
                <button 
                  onClick={() => setDrilldownOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Banner Message */}
              {actionSuccessMsg && (
                <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {/* Drawer Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingDrilldown ? (
                  <div className="py-20 text-center space-y-3">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-bold text-slate-500">Querying live database records...</p>
                  </div>
                ) : (
                  <>
                    {/* If Executive Summary View */}
                    {selectedQuestion === 'EXECUTIVE_SUMMARY' && (
                      <div className="space-y-4">
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
                          <h4 className="font-extrabold text-sm text-emerald-950 mb-1">
                            🎯 Executive Pulse: {restaurant?.name || 'Your Hotel'}
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Here is the instant state of your hotel operations right now. All departments are reporting live.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {drilldownData?.items?.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">{item.metric}</span>
                              <p className="text-sm font-black text-slate-800 mt-1">{item.value}</p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 mt-2 inline-block">
                                {item.tag}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* If Available Rooms List */}
                    {selectedQuestion === 'AVAILABLE_ROOMS' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500">Showing all vacant rooms available for booking tonight:</p>
                        {drilldownData?.items?.map((rm) => (
                          <div key={rm.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-amber-400 transition-all flex items-center justify-between gap-3 shadow-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-black text-base flex items-center justify-center shrink-0">
                                {rm.room_number}
                              </div>
                              <div>
                                <h4 className="font-extrabold text-sm text-slate-900">{rm.room_type || 'Standard Room'}</h4>
                                <p className="text-xs text-slate-500">Floor {rm.floor_number || 1} • {rm.bed_type || 'King Bed'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-sm text-slate-900 font-mono">₹{rm.rate_per_night}</span>
                              <span className="block text-[10px] font-bold text-emerald-700">Ready to Book</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* If Arrivals & Departures */}
                    {selectedQuestion === 'ARRIVALS_DEPARTURES' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500">Today's arrivals and departures at front desk:</p>
                        {drilldownData?.items?.map((ad) => (
                          <div key={ad.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${ad.event_type === 'ARRIVAL' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                                {ad.event_type}
                              </span>
                              <div>
                                <h4 className="font-extrabold text-sm text-slate-900">{ad.guest_name}</h4>
                                <p className="text-xs text-slate-500">{ad.room_number ? `Room ${ad.room_number}` : ad.room_type} • {ad.time || 'Today'}</p>
                              </div>
                            </div>
                            {ad.guest_phone && (
                              <a 
                                href={`tel:${ad.guest_phone}`} 
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                              >
                                <Phone className="w-3.5 h-3.5" /> Call
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* If Pending Payments */}
                    {selectedQuestion === 'PENDING_PAYMENTS' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500">Unsettled room folios & pending food deliveries:</p>
                        {drilldownData?.items?.map((pay, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm text-slate-900">{pay.guest_name}</h4>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {pay.source === 'ROOM_FOLIO' ? (pay.room_number || 'Folio') : (pay.order_number || 'Food Order')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{pay.note || 'Payment pending settlement'}</p>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <span className="font-black text-base text-rose-700 font-mono">₹{parseFloat(pay.amount_due || 0).toLocaleString('en-IN')}</span>
                              {pay.source === 'ROOM_FOLIO' && (
                                <button 
                                  onClick={() => handleQuickAction('SETTLE_FOLIO_PAYMENT', pay.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                                >
                                  Settle
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* If Unready Rooms */}
                    {selectedQuestion === 'UNREADY_ROOMS' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500">Rooms currently requiring cleaning or repair:</p>
                        {drilldownData?.items?.map((un) => (
                          <div key={un.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl font-black text-base flex items-center justify-center shrink-0 ${un.status === 'CLEANING' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                                {un.room_number}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-extrabold text-sm text-slate-900">{un.room_type || 'Guest Room'}</h4>
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-800">
                                    {un.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{un.note || 'Turnover inspection required'}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleQuickAction('MARK_ROOM_CLEANED', un.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Mark Ready
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* If Inquiries / Leads */}
                    {selectedQuestion === 'PENDING_INQUIRIES' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500">Website booking inquiries awaiting owner follow-up:</p>
                        {drilldownData?.items?.map((inq) => (
                          <div key={inq.id} className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-900">{inq.guest_name}</h4>
                              <p className="text-xs font-semibold text-emerald-800">{inq.room_type} • {inq.check_in_date}</p>
                              {inq.notes && <p className="text-xs text-slate-500 mt-1 italic">"{inq.notes}"</p>}
                            </div>
                            {inq.guest_phone && (
                              <div className="flex items-center gap-2">
                                <a 
                                  href={`https://wa.me/${inq.guest_phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(inq.guest_name)},%20regarding%20your%20booking%20inquiry%20at%20${encodeURIComponent(restaurant?.name || 'our hotel')}:`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                                </a>
                                <a 
                                  href={`tel:${inq.guest_phone}`} 
                                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                                >
                                  <Phone className="w-4 h-4" />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* If Rate Recommendation */}
                    {selectedQuestion === 'RATE_RECOMMENDATION' && (
                      <div className="space-y-4">
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
                          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Recommended Strategy</span>
                          <h3 className="text-2xl font-black text-emerald-950 mt-1">
                            {oq.rateRecommendation?.headline}
                          </h3>
                          <p className="text-xs text-emerald-900/80 mt-1 leading-relaxed font-medium">
                            {oq.rateRecommendation?.subline}
                          </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                          <p className="font-bold text-slate-800">Dynamic Factors Analyzed:</p>
                          <p>• Today's Occupancy: <span className="font-bold text-slate-900">{oq.roomsAvailableTonight?.occupancyRate}%</span></p>
                          <p>• Base Average Daily Rate (ADR): <span className="font-bold text-slate-900 font-mono">₹{oq.rateRecommendation?.baseRate || 2500}</span></p>
                          <p>• Recommended Surge / Incentive: <span className="font-bold text-emerald-700">{oq.rateRecommendation?.surgePercent > 0 ? `+${oq.rateRecommendation.surgePercent}%` : `${oq.rateRecommendation?.surgePercent || 0}%`}</span></p>
                        </div>
                      </div>
                    )}

                  </>
                )}
              </div>

              {/* Drawer Footer Link to full Desk */}
              {drilldownData?.summary?.actionLink && (
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Need deeper controls?</span>
                  <Link 
                    to={drilldownData.summary.actionLink}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>{drilldownData.summary.actionText || 'Open Full Desk'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Onboarding Alert Banner */}
        {showOnboardingBanner && (
          <div className="bg-white border border-[#3A7D7C]/30 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center shrink-0 border border-[#D7E5E8]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1F2937]">Complete Your Restaurant Online Setup</h3>
                <p className="text-xs text-[#64748B] mt-0.5">Finish setup steps to publish your online ordering website ({setupProgress.completedCount}/7 steps complete).</p>
              </div>
            </div>
            <Link to={`/admin/${currentSlug}/onboarding`} className="px-4 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded-xl font-bold text-xs transition-all shadow-2xs shrink-0">
              Open Setup Wizard →
            </Link>
          </div>
        )}
        
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">Today's Total Orders</span>
              <h3 className="text-2xl font-bold text-[#1F2937] mt-1">{k.todayOrders}</h3>
              <span className="text-[11px] font-bold text-[#3A7D7C] mt-0.5 inline-block">Active Pipeline</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center font-bold border border-[#D7E5E8]">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">Today's Revenue</span>
              <h3 className="text-2xl font-bold text-[#1F2937] mt-1">₹{k.todayRevenue.toFixed(2)}</h3>
              <span className="text-[11px] font-semibold text-[#64748B] mt-0.5 block">Live Today</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">Website Status</span>
              <h3 className="text-base font-bold text-[#1F2937] mt-1">{restaurant?.website_status || 'DRAFT'}</h3>
              <Link to={`/admin/${currentSlug}/website`} className="text-[11px] font-bold text-[#3A7D7C] hover:underline mt-0.5 inline-block">Manage Website ↗</Link>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold border border-sky-200">
              <Globe className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block">Online Ordering</span>
              <h3 className={`text-base font-bold mt-1 ${restaurant?.is_online_ordering_enabled ? 'text-emerald-700' : 'text-rose-700'}`}>
                {restaurant?.is_online_ordering_enabled ? 'ACCEPTING' : 'PAUSED'}
              </h3>
              <span className="text-[11px] font-semibold text-[#64748B] mt-0.5 block">Toggle in Header</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold border border-amber-200">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

        </div>

        {/* Pipeline Status Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xs">
          <h3 className="font-bold text-sm text-[#1F2937] mb-4">Online Order Status Pipeline Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-[#D7E5E8]">
              <span className="text-xs font-bold text-[#64748B] block">Pending</span>
              <span className="text-lg font-bold text-amber-800 mt-1 block">{k.statusCounts?.PENDING || 0}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-[#D7E5E8]">
              <span className="text-xs font-bold text-[#64748B] block">Accepted</span>
              <span className="text-lg font-bold text-sky-800 mt-1 block">{k.statusCounts?.ACCEPTED || 0}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-[#D7E5E8]">
              <span className="text-xs font-bold text-[#64748B] block">Kitchen</span>
              <span className="text-lg font-bold text-[#3A7D7C] mt-1 block">{k.statusCounts?.SENT_TO_KITCHEN || 0}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-[#D7E5E8]">
              <span className="text-xs font-bold text-[#64748B] block">Preparing</span>
              <span className="text-lg font-bold text-[#3A7D7C] mt-1 block">{k.statusCounts?.PREPARING || 0}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-[#D7E5E8]">
              <span className="text-xs font-bold text-[#64748B] block">Ready</span>
              <span className="text-lg font-bold text-emerald-800 mt-1 block">{k.statusCounts?.READY_FOR_PICKUP || 0}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-[#D7E5E8]">
              <span className="text-xs font-bold text-[#64748B] block">In Delivery</span>
              <span className="text-lg font-bold text-sky-800 mt-1 block">{k.statusCounts?.OUT_FOR_DELIVERY || 0}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-[#D7E5E8]">
              <span className="text-xs font-bold text-[#64748B] block">Completed</span>
              <span className="text-lg font-bold text-emerald-800 mt-1 block">{k.statusCounts?.DELIVERED || 0}</span>
            </div>
          </div>
        </div>

        {/* Recent Orders Overview */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#D7E5E8] flex items-center justify-between">
            <h3 className="font-bold text-base text-[#1F2937]">Recent Live Orders</h3>
            <Link to={`/admin/${currentSlug}/orders`} className="text-xs font-bold text-[#3A7D7C] hover:text-[#2F6665] flex items-center gap-1">
              View All Orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-slate-50 text-[#64748B] font-bold uppercase tracking-wider text-[11px] border-b border-[#D7E5E8]">
                <tr>
                  <th className="p-4">Order #</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Delivery Area</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D7E5E8]">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-[#64748B] font-semibold">No recent online orders.</td>
                  </tr>
                ) : (
                  recentOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-[#3A7D7C] font-mono text-sm">{ord.order_number}</td>
                      <td className="p-4">
                        <span className="font-bold text-[#1F2937] block text-sm">{ord.customer_name}</span>
                        <span className="text-[11px] text-[#64748B] font-mono">{ord.customer_phone}</span>
                      </td>
                      <td className="p-4 font-medium">{ord.delivery_area} ({ord.distance_km} km)</td>
                      <td className="p-4 font-bold text-[#1F2937] text-sm font-mono">₹{parseFloat(ord.total_amount).toFixed(2)}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg font-bold text-[10px] bg-slate-100 text-[#1F2937] border border-[#D7E5E8]">
                          {ord.payment_method} ({ord.payment_status})
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border uppercase tracking-wider ${getBadgeStyle(ord.order_status)}`}>
                          {ord.order_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          to={`/admin/${currentSlug}/orders?id=${ord.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#3A7D7C] hover:text-[#2F6665]"
                        >
                          Manage Order →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
