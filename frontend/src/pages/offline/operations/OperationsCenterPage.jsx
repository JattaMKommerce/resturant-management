import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../../context/SocketContext';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import {
  Activity,
  Radio,
  Grid2X2,
  Utensils,
  Clock,
  ChefHat,
  AlertTriangle,
  Boxes,
  Receipt,
  IndianRupee,
  Lightbulb,
  CheckCircle2,
  Bell,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Package,
  Layers,
  ArrowUpRight,
  Flame,
  ShieldCheck,
  HelpCircle,
  Globe
} from 'lucide-react';

export default function OperationsCenterPage() {
  const navigate = useNavigate();
  const { socket, connected, joinRoom } = useSocket();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Live Local Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOverview = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/operations/overview');
      if (res.success) {
        setData(res.data);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch operations overview:', err);
      setError(err.message || 'Failed to load operations center data.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview(false);
  }, [fetchOverview]);

  // Join admin room & listen for Socket.IO realtime events
  useEffect(() => {
    if (connected) {
      joinRoom('admin');
    }

    if (!socket) return;

    const handleRealtimeUpdate = () => {
      fetchOverview(true);
    };

    socket.on('new_kot', handleRealtimeUpdate);
    socket.on('kot_updated', handleRealtimeUpdate);
    socket.on('kot_item_updated', handleRealtimeUpdate);
    socket.on('order_ready', handleRealtimeUpdate);
    socket.on('order_served', handleRealtimeUpdate);
    socket.on('kot_delayed', handleRealtimeUpdate);
    socket.on('inventory_updated', handleRealtimeUpdate);
    socket.on('table_status_changed', handleRealtimeUpdate);
    socket.on('order_updated', handleRealtimeUpdate);
    socket.on('new_order', handleRealtimeUpdate);
    socket.on('bill_generated', handleRealtimeUpdate);
    socket.on('payment_recorded', handleRealtimeUpdate);

    return () => {
      socket.off('new_kot', handleRealtimeUpdate);
      socket.off('kot_updated', handleRealtimeUpdate);
      socket.off('kot_item_updated', handleRealtimeUpdate);
      socket.off('order_ready', handleRealtimeUpdate);
      socket.off('order_served', handleRealtimeUpdate);
      socket.off('kot_delayed', handleRealtimeUpdate);
      socket.off('inventory_updated', handleRealtimeUpdate);
      socket.off('table_status_changed', handleRealtimeUpdate);
      socket.off('order_updated', handleRealtimeUpdate);
      socket.off('new_order', handleRealtimeUpdate);
      socket.off('bill_generated', handleRealtimeUpdate);
      socket.off('payment_recorded', handleRealtimeUpdate);
    };
  }, [socket, connected, joinRoom, fetchOverview]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#EAF4F7] p-6 flex flex-col items-center justify-center text-[#64748B]">
        <RefreshCw className="w-10 h-10 animate-spin text-[#3A7D7C] mb-4" />
        <div className="text-base font-bold text-[#1F2937]">Loading Live Operations Center...</div>
        <div className="text-xs text-[#64748B] mt-1">Connecting to live metrics streams</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#EAF4F7] p-6 flex flex-col items-center justify-center antialiased font-sans">
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-8 max-w-md w-full text-center shadow-xs space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1F2937] mb-1">Live Operation Center</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">{error}</p>
            {user && (
              <div className="mt-3 p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs text-[#64748B] text-left">
                <div>Account: <span className="font-bold text-[#1F2937]">{user.name || user.email}</span></div>
                <div>Role: <span className="font-mono font-bold text-[#3A7D7C]">{user.role}</span></div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fetchOverview(false)}
              className="px-5 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-2xs inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('hotel_token');
                localStorage.removeItem('hotel_user');
                window.location.href = '/admin/login';
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] font-bold rounded-xl text-xs transition border border-[#D7E5E8]"
            >
              Re-login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tables = data?.tables || { counts: {}, items: [] };
  const orders = data?.orders || {};
  const kitchen = data?.kitchen || {};
  const bottleneck = data?.bottleneck || {};
  const priorityKots = data?.priority_kots || [];
  const inventory = data?.inventory || { items: [], alerts: [], menu_impact: [] };
  const sales = data?.sales || {};
  const payments = data?.payments || {};
  const waiterService = data?.waiter_service || {};
  const readyFoodAlerts = data?.ready_food_alerts || [];
  const tableAttentionAlerts = data?.table_attention_alerts || [];
  const topDishes = data?.top_dishes || [];
  const smartInsights = data?.smart_insights || [];

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] p-4 md:p-6 space-y-6 antialiased font-sans">
      {/* 1. TOP HEADER */}
      <header className="bg-white border border-[#D7E5E8] rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className="text-[11px] font-bold tracking-wider text-[#3A7D7C] uppercase bg-[#EAF4F7] px-2.5 py-0.5 rounded-md border border-[#D7E5E8]">
              Grand Palace HMS
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {connected ? 'Realtime Connected' : 'Reconnecting'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              🟢 Restaurant Open
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1F2937] flex items-center gap-3">
            <Activity className="w-7 h-7 text-[#3A7D7C]" />
            <span>Live Operations Center</span>
          </h1>
          <p className="text-xs md:text-sm text-[#64748B] mt-0.5">
            Central real-time restaurant monitoring dashboard
          </p>
        </div>

        {/* Live Clock Display */}
        <div className="flex items-center gap-3.5 bg-slate-50 border border-[#D7E5E8] px-4 py-2.5 rounded-xl">
          <Clock className="w-5 h-5 text-[#3A7D7C] shrink-0" />
          <div className="text-right">
            <div className="text-base md:text-lg font-mono font-bold text-[#1F2937] tracking-wider">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div className="text-[11px] font-medium text-[#64748B]">
              {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* 2. TABLE OVERVIEW & ACTIVE ORDERS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table Overview */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Grid2X2 className="w-4 h-4 text-[#3A7D7C]" />
              <span>Table Overview</span>
            </h2>
            <button
              onClick={() => navigate('/admin/offline/tables')}
              className="text-xs font-bold text-[#3A7D7C] hover:text-[#2F6665] flex items-center gap-1 transition"
            >
              <span>Manage Tables</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div
              onClick={() => navigate('/admin/offline/tables?status=AVAILABLE')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition shadow-2xs"
              title="Click to view all Available Tables"
            >
              <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                🟢 AVAILABLE
              </div>
              <div className="text-2xl font-extrabold text-[#1F2937] mt-1">
                {String(tables.counts.AVAILABLE || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=OCCUPIED')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition shadow-2xs"
              title="Click to view all Occupied Tables"
            >
              <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                🟡 OCCUPIED
              </div>
              <div className="text-2xl font-extrabold text-[#1F2937] mt-1">
                {String(tables.counts.OCCUPIED || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=ATTENTION')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition shadow-2xs"
              title="Click to view Tables Needing Attention"
            >
              <div className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                🔴 ATTENTION
              </div>
              <div className="text-2xl font-extrabold text-[#1F2937] mt-1">
                {String(tables.counts.ATTENTION || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=BILL_REQUESTED')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition shadow-2xs"
              title="Click to view Tables with Bill Requested"
            >
              <div className="text-[11px] font-bold text-[#3A7D7C] flex items-center gap-1.5">
                💰 BILL REQUESTED
              </div>
              <div className="text-2xl font-extrabold text-[#1F2937] mt-1">
                {String(tables.counts.BILL_REQUESTED || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=CLEANING')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition shadow-2xs"
              title="Click to view Tables needing Cleaning"
            >
              <div className="text-[11px] font-bold text-purple-800 flex items-center gap-1.5">
                🧹 CLEANING
              </div>
              <div className="text-2xl font-extrabold text-[#1F2937] mt-1">
                {String(tables.counts.CLEANING || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=RESERVED')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition shadow-2xs"
              title="Click to view Reserved Tables"
            >
              <div className="text-[11px] font-bold text-sky-800 flex items-center gap-1.5">
                🔵 RESERVED
              </div>
              <div className="text-2xl font-extrabold text-[#1F2937] mt-1">
                {String(tables.counts.RESERVED || 0).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Active Order Summary */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Utensils className="w-4 h-4 text-[#3A7D7C]" />
              <span>Active Order Summary</span>
            </h2>
            <button
              onClick={() => navigate('/admin/offline/orders')}
              className="text-xs font-bold text-[#3A7D7C] hover:text-[#2F6665] flex items-center gap-1 transition"
            >
              <span>View Orders</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-[#64748B]">🍽️ ACTIVE ORDERS</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{orders.active_orders || 0}</div>
              <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-[#D7E5E8] text-[10px] font-bold">
                <span className="text-[#3A7D7C]">Off: {orders.offline_active || 0}</span>
                <span className="text-sky-700">Onl: {orders.online_active || 0}</span>
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-orange-800">🔥 IN KITCHEN</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{orders.preparing || 0}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Cooking live</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-amber-800">🟡 WAITING / PENDING</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{orders.waiting || 0}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Queued</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-emerald-800">✓ READY DISHES</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{orders.ready || 0}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Ready for pickup</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-sky-800">🍴 SERVED / OUT</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{(orders.served || 0) + (orders.out_for_delivery || 0)}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Delivering/Served</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-rose-800">💰 BILLS PENDING</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{orders.bills_pending || 0}</div>
              <div className="text-[10px] text-[#64748B] mt-1">Table checkouts</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KITCHEN LIVE STATUS & BOTTLENECK DETECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kitchen Performance Status */}
        <div className="lg:col-span-2 bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ChefHat className="w-5 h-5 text-[#3A7D7C]" />
              <div>
                <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider">
                  Kitchen Live Status
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Active Channels: <strong className="text-[#3A7D7C]">🍽️ Offline ({kitchen.offline_kots || 0})</strong> • <strong className="text-sky-700">🌐 Online ({kitchen.online_kots || 0})</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/offline/kds')}
              className="text-xs font-bold text-[#3A7D7C] hover:text-[#2F6665] flex items-center gap-1 transition bg-[#EAF4F7] px-2.5 py-1.5 rounded-lg border border-[#D7E5E8]"
            >
              <span>Open KDS</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => navigate('/admin/offline/kds')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-emerald-800">🟢 ON TIME</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{kitchen.on_time || 0}</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/kds')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-amber-800">🟡 GETTING LATE</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{kitchen.getting_late || 0}</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/kds')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-rose-800">🔴 LATE</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{kitchen.late || 0}</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/kds')}
              className="bg-slate-50 border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-[#3A7D7C]">✓ READY</div>
              <div className="text-2xl font-black text-[#1F2937] mt-1">{kitchen.ready || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#D7E5E8] text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-[#D7E5E8]">
              <div className="text-[#64748B]">Active KOTs</div>
              <div className="font-bold text-[#1F2937] text-sm mt-0.5 flex items-center gap-1.5">
                <span>{kitchen.active_kots || 0}</span>
                <span className="text-[10px] text-[#64748B] font-normal">({kitchen.offline_kots || 0} Off / {kitchen.online_kots || 0} Onl)</span>
              </div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-[#D7E5E8]">
              <div className="text-[#64748B]">Avg Prep Time</div>
              <div className="font-bold text-[#1F2937] text-sm mt-0.5">{kitchen.avg_prep_time_minutes || 15} min</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-[#D7E5E8]">
              <div className="text-[#64748B]">Late KOTs</div>
              <div className="font-bold text-rose-700 text-sm mt-0.5">{kitchen.late || 0}</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-[#D7E5E8]">
              <div className="text-[#64748B]">Target Prep</div>
              <div className="font-bold text-emerald-700 text-sm mt-0.5">{kitchen.target_prep_time_minutes || 15} min</div>
            </div>
          </div>
        </div>

        {/* Kitchen Bottleneck Detection */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Flame className="w-4 h-4 text-orange-600" />
              <span>Bottleneck Detector</span>
            </h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${bottleneck.detected ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
              {bottleneck.status || 'NORMAL'}
            </span>
          </div>

          <div className="bg-slate-50 border border-[#D7E5E8] rounded-xl p-4 space-y-3 flex-1 flex flex-col justify-center">
            <div className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
              🔥 {bottleneck.department_name || 'Main Kitchen'}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg border border-[#D7E5E8]">
                <div className="text-[#64748B]">Active KOTs</div>
                <div className="font-bold text-[#1F2937] text-sm mt-0.5">{bottleneck.active_kots || 0}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#D7E5E8]">
                <div className="text-[#64748B]">Late KOTs</div>
                <div className="font-bold text-rose-700 text-sm mt-0.5">{bottleneck.late_kots || 0}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#D7E5E8]">
                <div className="text-[#64748B]">Avg Prep</div>
                <div className="font-bold text-[#1F2937] text-sm mt-0.5">{bottleneck.avg_prep_mins || 15} min</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#D7E5E8]">
                <div className="text-[#64748B]">Target</div>
                <div className="font-bold text-emerald-700 text-sm mt-0.5">{bottleneck.target_mins || 15} min</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. PRIORITY KOTs & INVENTORY ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority KOT Section */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-[#3A7D7C]" />
              <span>Priority KOT Queue</span>
            </h2>
            <button
              onClick={() => navigate('/admin/offline/kds')}
              className="text-xs font-bold text-[#3A7D7C] hover:text-[#2F6665] flex items-center gap-1 transition"
            >
              <span>Open KDS</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {priorityKots.length === 0 ? (
              <div className="text-center py-8 text-[#64748B] text-xs bg-slate-50 rounded-xl border border-[#D7E5E8]">
                No active priority KOTs right now. Kitchen is clear!
              </div>
            ) : (
              priorityKots.map(kot => {
                let badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (kot.urgency_category === 'LATE') badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
                else if (kot.urgency_category === 'GETTING_LATE') badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                else if (kot.urgency_category === 'READY') badgeClass = 'bg-[#EAF4F7] text-[#3A7D7C] border-[#D7E5E8]';

                const isOnline = kot.order_type === 'ONLINE' || (!kot.table_number && kot.order_token);

                return (
                  <div
                    key={kot.id}
                    onClick={() => navigate('/admin/offline/kds')}
                    className="bg-white border border-[#D7E5E8] hover:border-[#3A7D7C] p-3.5 rounded-xl cursor-pointer transition flex items-start justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                        <span>#{kot.kot_number}</span>
                        <span className="text-[#64748B] font-normal">|</span>
                        {isOnline ? (
                          <span className="px-2 py-0.5 rounded bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8] text-[10px] uppercase font-bold flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Online #{kot.order_token || '-----'}
                          </span>
                        ) : (
                          <span className="text-[#3A7D7C] font-semibold">Table {kot.table_number}</span>
                        )}
                        {kot.online_customer_name && (
                          <span className="text-[#64748B] text-xs font-normal">({kot.online_customer_name})</span>
                        )}
                        <span className="text-[#64748B] text-xs font-normal">({kot.dept_name})</span>
                      </div>
                      <div className="text-xs text-[#1F2937] font-medium space-x-2">
                        {kot.items.map((it, idx) => (
                          <span key={it.id}>
                            {it.name} <span className="text-[#3A7D7C] font-bold">× {it.quantity}</span>
                            {idx < kot.items.length - 1 ? ' • ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold shrink-0 ${badgeClass}`}>
                      {kot.timer_text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Inventory Monitoring & Recipe Menu Impact */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Boxes className="w-4 h-4 text-[#3A7D7C]" />
              <span>Inventory Alerts & Impact</span>
            </h2>
            <button
              onClick={() => navigate('/admin/offline/inventory')}
              className="text-xs font-bold text-[#3A7D7C] hover:text-[#2F6665] flex items-center gap-1 transition"
            >
              <span>Open Inventory</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {/* Inventory Alerts */}
            {inventory.alerts.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                All key ingredient stock levels are optimal.
              </div>
            ) : (
              inventory.alerts.map(inv => (
                <div
                  key={inv.id}
                  onClick={() => navigate('/admin/offline/inventory')}
                  className="bg-white border border-[#D7E5E8] hover:border-[#3A7D7C] p-3 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 text-xs shadow-2xs"
                >
                  <div>
                    <span className="font-bold text-[#1F2937]">{inv.item_name}</span>
                    <div className="text-[11px] text-[#64748B] mt-0.5">
                      Current: <span className="font-bold text-[#1F2937]">{inv.current_stock} {inv.unit}</span> | Min: {inv.min_stock_alert} {inv.unit}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.status === 'OUT_OF_STOCK' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                    {inv.status === 'OUT_OF_STOCK' ? '🔴 OUT OF STOCK' : '🟡 LOW STOCK'}
                  </span>
                </div>
              ))
            )}

            {/* Inventory -> Menu Impact */}
            {inventory.menu_impact && inventory.menu_impact.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2 mt-3">
                <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  MENU ITEMS IMPACTED BY STOCK
                </div>
                {inventory.menu_impact.map((impact, idx) => (
                  <div key={idx} className="text-xs text-[#1F2937]">
                    <span className="font-bold text-rose-800">🔴 {impact.ingredient}</span>
                    <div className="text-[#64748B] text-[11px] mt-0.5">
                      Affected Menu Items: {impact.menu_items.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. TODAY'S SALES & PAYMENT SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Sales */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Today's Sales</span>
            </h2>
            <button
              onClick={() => navigate('/admin/offline/billing')}
              className="text-xs font-bold text-[#3A7D7C] hover:text-[#2F6665] flex items-center gap-1 transition"
            >
              <span>Billing</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-slate-50 border border-[#D7E5E8] p-4 rounded-xl">
            <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider">TODAY'S REVENUE</div>
            <div className="text-3xl font-black text-[#1F2937] mt-1 flex items-center">
              ₹{(sales.today_revenue || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-[#D7E5E8]">
              <div className="text-[#64748B]">COMPLETED ORDERS</div>
              <div className="text-xl font-bold text-[#1F2937] mt-0.5">{sales.completed_orders || 0}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-[#D7E5E8]">
              <div className="text-[#64748B]">AVG ORDER VALUE</div>
              <div className="text-xl font-bold text-[#1F2937] mt-0.5">₹{sales.average_order_value || 0}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-[#D7E5E8]">
              <div className="text-[#64748B]">PAID BILLS</div>
              <div className="text-xl font-bold text-emerald-800 mt-0.5">{sales.paid_bills || 0}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-[#D7E5E8]">
              <div className="text-[#64748B]">PENDING BILLS</div>
              <div className="text-xl font-bold text-rose-800 mt-0.5">{sales.pending_bills || 0}</div>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Receipt className="w-4 h-4 text-[#3A7D7C]" />
              <span>Payment Breakdown</span>
            </h2>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-[#D7E5E8]">
              <span className="font-semibold text-[#1F2937]">CASH / COD</span>
              <span className="font-mono font-bold text-[#1F2937]">₹{(payments.CASH || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-[#D7E5E8]">
              <span className="font-semibold text-[#1F2937]">UPI</span>
              <span className="font-mono font-bold text-[#1F2937]">₹{(payments.UPI || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-[#D7E5E8]">
              <span className="font-semibold text-[#1F2937]">CARD</span>
              <span className="font-mono font-bold text-[#1F2937]">₹{(payments.CARD || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-[#D7E5E8]">
              <span className="font-semibold text-[#1F2937]">ROOM CHARGE</span>
              <span className="font-mono font-bold text-[#1F2937]">₹{(payments.ROOM_CHARGE || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-[#D7E5E8]">
              <span className="font-semibold text-[#1F2937]">OTHER</span>
              <span className="font-mono font-bold text-[#1F2937]">₹{(payments.OTHER || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-[#EAF4F7] p-2.5 rounded-xl border border-[#D7E5E8] text-[#3A7D7C] font-bold">
              <span>TOTAL REVENUE</span>
              <span className="font-mono text-sm">₹{(payments.TOTAL || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Top Selling Dishes */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Flame className="w-4 h-4 text-[#3A7D7C]" />
              <span>Top Selling Dishes</span>
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            {topDishes.length === 0 ? (
              <div className="text-center py-6 text-[#64748B] bg-slate-50 rounded-xl border border-[#D7E5E8]">
                No dish sales recorded yet today.
              </div>
            ) : (
              topDishes.map((dish, idx) => (
                <div key={idx} className="bg-slate-50 border border-[#D7E5E8] p-2.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-[#EAF4F7] text-[#3A7D7C] font-bold flex items-center justify-center text-xs shrink-0 border border-[#D7E5E8]">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-[#1F2937]">{dish.name}</div>
                      <div className="text-[11px] text-[#64748B]">{dish.quantity} portions</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-[#1F2937]">
                    ₹{dish.revenue.toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 6. SMART INSIGHTS & READY FOOD / ATTENTION ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Smart Insights Section */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Lightbulb className="w-4 h-4 text-[#3A7D7C]" />
              <span>Smart Insights</span>
            </h2>
            <span className="text-[10px] font-semibold text-[#64748B] uppercase">Analytics</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {smartInsights.length === 0 ? (
              <div className="text-[#64748B] text-center py-4 bg-slate-50 rounded-xl border border-[#D7E5E8]">
                Sufficient data being compiled for smart insights...
              </div>
            ) : (
              smartInsights.map((insight, idx) => (
                <div key={idx} className="bg-slate-50 border border-[#D7E5E8] p-3 rounded-xl text-[#1F2937] leading-relaxed flex items-start gap-2.5">
                  <span className="text-[#3A7D7C] shrink-0">💡</span>
                  <span>{insight}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Operational Alerts */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937] flex items-center gap-2 uppercase tracking-wider">
              <Bell className="w-4 h-4 text-[#3A7D7C]" />
              <span>Operational Alerts</span>
            </h2>
          </div>

          <div className="space-y-3 text-xs max-h-[220px] overflow-y-auto pr-1">
            {/* Table Attention Alerts */}
            {tableAttentionAlerts.map((att, idx) => (
              <div key={idx} className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-rose-800 font-bold">TABLE {att.table_number}</span>
                  <span className="text-[#1F2937]">{att.message}</span>
                </div>
                <button
                  onClick={() => navigate('/admin/offline/tables')}
                  className="px-2 py-1 bg-white text-rose-800 rounded text-[10px] font-bold border border-rose-200 hover:bg-rose-100 transition shrink-0"
                >
                  View Table
                </button>
              </div>
            ))}

            {/* Ready Food Alert Banner */}
            {readyFoodAlerts.map((rf, idx) => (
              <div key={idx} className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                    🔔 FOOD READY - KOT #{rf.kot_number} (Table {rf.table_number})
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    {rf.items_summary}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/admin/offline/ready-orders')}
                  className="px-2.5 py-1 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded text-[10px] font-bold transition shrink-0"
                >
                  Serve Order
                </button>
              </div>
            ))}

            {tableAttentionAlerts.length === 0 && readyFoodAlerts.length === 0 && (
              <div className="text-center py-6 text-[#64748B] bg-slate-50 rounded-xl border border-[#D7E5E8]">
                No active operational alerts right now.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
