import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../../context/SocketContext';
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

  // Live Local Clock (Updates every second locally without backend requests)
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
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <div className="text-base font-semibold text-slate-200">Loading Live Operations Center...</div>
        <div className="text-xs text-slate-500 mt-1">Connecting to live metrics streams</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-100 mb-2">Access Error</h2>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => fetchOverview(false)}
            className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-400 transition"
          >
            Retry Connection
          </button>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* 1. TOP HEADER */}
      <header className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-6 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-black tracking-widest text-amber-400 uppercase bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
              GRAND PALACE HMS
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {connected ? 'REALTIME CONNECTED' : 'RECONNECTING'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              🟢 RESTAURANT OPEN
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Activity className="w-7 h-7 text-amber-400" />
            LIVE OPERATIONS CENTER
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Central real-time restaurant monitoring dashboard
          </p>
        </div>

        {/* Live Clock Display */}
        <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 px-4 py-3 rounded-xl">
          <Clock className="w-6 h-6 text-amber-400 shrink-0" />
          <div className="text-right">
            <div className="text-lg md:text-xl font-mono font-extrabold text-slate-100 tracking-wider">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div className="text-[11px] font-medium text-slate-400">
              {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* 2. TABLE OVERVIEW & ACTIVE ORDERS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table Overview */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Grid2X2 className="w-5 h-5 text-amber-400" />
              TABLE OVERVIEW
            </h2>
            <button
              onClick={() => navigate('/admin/offline/tables')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              Manage Tables <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div
              onClick={() => navigate('/admin/offline/tables?status=AVAILABLE')}
              className="bg-slate-950/60 border border-emerald-500/20 hover:border-emerald-500/50 p-3 rounded-xl cursor-pointer transition hover:scale-[1.02] shadow-sm"
              title="Click to view all Available Tables"
            >
              <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                🟢 AVAILABLE
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {String(tables.counts.AVAILABLE || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=OCCUPIED')}
              className="bg-slate-950/60 border border-amber-500/20 hover:border-amber-500/50 p-3 rounded-xl cursor-pointer transition hover:scale-[1.02] shadow-sm"
              title="Click to view all Occupied Tables"
            >
              <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                🟡 OCCUPIED
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {String(tables.counts.OCCUPIED || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=ATTENTION')}
              className="bg-slate-950/60 border border-rose-500/30 hover:border-rose-500/60 p-3 rounded-xl cursor-pointer transition hover:scale-[1.02] shadow-sm"
              title="Click to view Tables Needing Attention"
            >
              <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
                🔴 ATTENTION
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {String(tables.counts.ATTENTION || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=BILL_REQUESTED')}
              className="bg-slate-950/60 border border-indigo-500/20 hover:border-indigo-500/50 p-3 rounded-xl cursor-pointer transition hover:scale-[1.02] shadow-sm"
              title="Click to view Tables with Bill Requested"
            >
              <div className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5">
                💰 BILL REQUESTED
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {String(tables.counts.BILL_REQUESTED || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=CLEANING')}
              className="bg-slate-950/60 border border-purple-500/20 hover:border-purple-500/50 p-3 rounded-xl cursor-pointer transition hover:scale-[1.02] shadow-sm"
              title="Click to view Tables needing Cleaning"
            >
              <div className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5">
                🧹 CLEANING
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {String(tables.counts.CLEANING || 0).padStart(2, '0')}
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/tables?status=RESERVED')}
              className="bg-slate-950/60 border border-sky-500/20 hover:border-sky-500/50 p-3 rounded-xl cursor-pointer transition hover:scale-[1.02] shadow-sm"
              title="Click to view Reserved Tables"
            >
              <div className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                🔵 RESERVED
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {String(tables.counts.RESERVED || 0).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Active Order Summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-400" />
              ACTIVE ORDER SUMMARY
            </h2>
            <button
              onClick={() => navigate('/admin/offline/orders')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              View Orders <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-slate-400">🍽️ ACTIVE ORDERS</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{orders.active_orders || 0}</div>
              <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-800/80 text-[10px] font-bold">
                <span className="text-amber-300">🍽️ Off: {orders.offline_active || 0}</span>
                <span className="text-cyan-300">🌐 Onl: {orders.online_active || 0}</span>
              </div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-950/60 border border-slate-800 hover:border-orange-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-orange-400">🔥 IN KITCHEN</div>
              <div className="text-2xl font-black text-white mt-1">{orders.preparing || 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">Cooking live</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-950/60 border border-slate-800 hover:border-yellow-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-yellow-400">🟡 WAITING / PENDING</div>
              <div className="text-2xl font-black text-white mt-1">{orders.waiting || 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">Queued</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-emerald-400">✓ READY DISHES</div>
              <div className="text-2xl font-black text-white mt-1">{orders.ready || 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">Ready for pickup</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-950/60 border border-slate-800 hover:border-blue-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-blue-400">🍴 SERVED / OUT</div>
              <div className="text-2xl font-black text-white mt-1">{(orders.served || 0) + (orders.out_for_delivery || 0)}</div>
              <div className="text-[10px] text-slate-500 mt-1">Delivering/Served</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/orders')}
              className="bg-slate-950/60 border border-slate-800 hover:border-rose-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-rose-400">💰 BILLS PENDING</div>
              <div className="text-2xl font-black text-white mt-1">{orders.bills_pending || 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">Table checkouts</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KITCHEN LIVE STATUS & BOTTLENECK DETECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kitchen Performance Status */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ChefHat className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-slate-200">
                  KITCHEN LIVE STATUS
                </h2>
                <p className="text-[11px] text-slate-400">
                  Active Channels: <strong className="text-amber-400">🍽️ Offline ({kitchen.offline_kots || 0})</strong> • <strong className="text-cyan-400">🌐 Online ({kitchen.online_kots || 0})</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/offline/kds')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-amber-500/40"
            >
              Open KDS <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => navigate('/admin/offline/kds')}
              className="bg-slate-950/60 border border-emerald-500/20 hover:border-emerald-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-emerald-400">🟢 ON TIME</div>
              <div className="text-2xl font-black text-white mt-1">{kitchen.on_time || 0}</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/kds')}
              className="bg-slate-950/60 border border-amber-500/20 hover:border-amber-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-amber-400">🟡 GETTING LATE</div>
              <div className="text-2xl font-black text-white mt-1">{kitchen.getting_late || 0}</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/kds')}
              className="bg-slate-950/60 border border-rose-500/30 hover:border-rose-500/50 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-rose-400">🔴 LATE</div>
              <div className="text-2xl font-black text-white mt-1">{kitchen.late || 0}</div>
            </div>

            <div
              onClick={() => navigate('/admin/offline/kds')}
              className="bg-slate-950/60 border border-sky-500/20 hover:border-sky-500/40 p-3 rounded-xl cursor-pointer transition"
            >
              <div className="text-[11px] font-bold text-sky-400">✓ READY</div>
              <div className="text-2xl font-black text-white mt-1">{kitchen.ready || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div className="bg-slate-950/40 p-2.5 rounded-lg">
              <div className="text-slate-400">Active KOTs</div>
              <div className="font-bold text-slate-100 text-sm mt-0.5 flex items-center gap-1.5">
                <span>{kitchen.active_kots || 0}</span>
                <span className="text-[10px] text-slate-400 font-normal">({kitchen.offline_kots || 0} Off / {kitchen.online_kots || 0} Onl)</span>
              </div>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg">
              <div className="text-slate-400">Avg Prep Time</div>
              <div className="font-bold text-amber-400 text-sm mt-0.5">{kitchen.avg_prep_time_minutes || 15} min</div>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg">
              <div className="text-slate-400">Late KOTs</div>
              <div className="font-bold text-rose-400 text-sm mt-0.5">{kitchen.late || 0}</div>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg">
              <div className="text-slate-400">Target Prep</div>
              <div className="font-bold text-emerald-400 text-sm mt-0.5">{kitchen.target_prep_time_minutes || 15} min</div>
            </div>
          </div>
        </div>

        {/* Kitchen Bottleneck Detection */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-400" />
              BOTTLENECK DETECTOR
            </h2>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${bottleneck.detected ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
              {bottleneck.status || 'NORMAL'}
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 flex-1 flex flex-col justify-center">
            <div className="text-sm font-extrabold text-amber-400 flex items-center gap-2">
              🔥 {bottleneck.department_name || 'Main Kitchen'}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="text-slate-400">Active KOTs</div>
                <div className="font-bold text-slate-100 text-sm mt-0.5">{bottleneck.active_kots || 0}</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="text-slate-400">Late KOTs</div>
                <div className="font-bold text-rose-400 text-sm mt-0.5">{bottleneck.late_kots || 0}</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="text-slate-400">Avg Prep</div>
                <div className="font-bold text-amber-400 text-sm mt-0.5">{bottleneck.avg_prep_mins || 15} min</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="text-slate-400">Target</div>
                <div className="font-bold text-emerald-400 text-sm mt-0.5">{bottleneck.target_mins || 15} min</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. PRIORITY KOTs & INVENTORY ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority KOT Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              PRIORITY KOT QUEUE
            </h2>
            <button
              onClick={() => navigate('/admin/offline/kds')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              Open KDS <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {priorityKots.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm bg-slate-950/40 rounded-xl border border-slate-800/60">
                No active priority KOTs right now. Kitchen is clear!
              </div>
            ) : (
              priorityKots.map(kot => {
                let badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                if (kot.urgency_category === 'LATE') badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse';
                else if (kot.urgency_category === 'GETTING_LATE') badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                else if (kot.urgency_category === 'READY') badgeClass = 'bg-sky-500/20 text-sky-400 border-sky-500/30';

                const isOnline = kot.order_type === 'ONLINE' || (!kot.table_number && kot.order_token);

                return (
                  <div
                    key={kot.id}
                    onClick={() => navigate('/admin/offline/kds')}
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl cursor-pointer transition flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                        <span>#{kot.kot_number}</span>
                        <span className="text-slate-500 font-normal">|</span>
                        {isOnline ? (
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] uppercase font-black flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Online #{kot.order_token || '-----'}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-medium">Table {kot.table_number}</span>
                        )}
                        {kot.online_customer_name && (
                          <span className="text-slate-400 text-xs font-normal">({kot.online_customer_name})</span>
                        )}
                        <span className="text-slate-500 text-xs font-normal">({kot.dept_name})</span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium space-x-2">
                        {kot.items.map((it, idx) => (
                          <span key={it.id}>
                            {it.name} <span className="text-amber-400 font-bold">× {it.quantity}</span>
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
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-400" />
              INVENTORY ALERTS & IMPACT
            </h2>
            <button
              onClick={() => navigate('/admin/offline/inventory')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              Open Inventory <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {/* Inventory Alerts */}
            {inventory.alerts.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-400 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                All key ingredient stock levels are optimal.
              </div>
            ) : (
              inventory.alerts.map(inv => (
                <div
                  key={inv.id}
                  onClick={() => navigate('/admin/offline/inventory')}
                  className="bg-slate-950/80 border border-amber-500/30 hover:border-amber-500/50 p-3 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-100">{inv.item_name}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Current: <span className="font-bold text-amber-400">{inv.current_stock} {inv.unit}</span> | Min: {inv.min_stock_alert} {inv.unit}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.status === 'OUT_OF_STOCK' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    {inv.status === 'OUT_OF_STOCK' ? '🔴 OUT OF STOCK' : '🟡 LOW STOCK'}
                  </span>
                </div>
              ))
            )}

            {/* Inventory -> Menu Impact */}
            {inventory.menu_impact && inventory.menu_impact.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 space-y-2 mt-3">
                <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  MENU ITEMS IMPACTED BY STOCK
                </div>
                {inventory.menu_impact.map((impact, idx) => (
                  <div key={idx} className="text-xs text-slate-300">
                    <span className="font-semibold text-amber-400">🔴 {impact.ingredient}</span>
                    <div className="text-slate-400 text-[11px] mt-0.5">
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
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              TODAY'S SALES
            </h2>
            <button
              onClick={() => navigate('/admin/offline/billing')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              Billing <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-slate-950/80 border border-emerald-500/30 p-4 rounded-xl">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">TODAY'S REVENUE</div>
            <div className="text-3xl font-black text-emerald-400 mt-1 flex items-center">
              ₹{(sales.today_revenue || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400">COMPLETED ORDERS</div>
              <div className="text-xl font-bold text-slate-100 mt-0.5">{sales.completed_orders || 0}</div>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400">AVG ORDER VALUE</div>
              <div className="text-xl font-bold text-amber-400 mt-0.5">₹{sales.average_order_value || 0}</div>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400">PAID BILLS</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">{sales.paid_bills || 0}</div>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400">PENDING BILLS</div>
              <div className="text-xl font-bold text-rose-400 mt-0.5">{sales.pending_bills || 0}</div>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              PAYMENT BREAKDOWN
            </h2>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="font-semibold text-slate-300">CASH / COD</span>
              <span className="font-mono font-bold text-slate-100">₹{(payments.CASH || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="font-semibold text-slate-300">UPI</span>
              <span className="font-mono font-bold text-slate-100">₹{(payments.UPI || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="font-semibold text-slate-300">CARD</span>
              <span className="font-mono font-bold text-slate-100">₹{(payments.CARD || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="font-semibold text-slate-300">ROOM CHARGE</span>
              <span className="font-mono font-bold text-slate-100">₹{(payments.ROOM_CHARGE || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="font-semibold text-slate-300">OTHER</span>
              <span className="font-mono font-bold text-slate-100">₹{(payments.OTHER || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30 text-amber-400 font-bold">
              <span>TOTAL REVENUE</span>
              <span className="font-mono text-sm">₹{(payments.TOTAL || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-950/40 p-2 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Cash Reconciliation: <strong className="text-slate-300">Not configured</strong></span>
            </div>
          </div>
        </div>

        {/* Top Selling Dishes */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              TOP SELLING DISHES
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            {topDishes.length === 0 ? (
              <div className="text-center py-6 text-slate-500 bg-slate-950/40 rounded-xl">
                No dish sales recorded yet today.
              </div>
            ) : (
              topDishes.map((dish, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-black flex items-center justify-center text-xs shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-100">{dish.name}</div>
                      <div className="text-[11px] text-slate-400">{dish.quantity} portions</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-emerald-400">
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
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              SMART INSIGHTS
            </h2>
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Rule-Based Analytics</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {smartInsights.length === 0 ? (
              <div className="text-slate-500 text-center py-4 bg-slate-950/40 rounded-xl">
                Sufficient data being compiled for smart insights...
              </div>
            ) : (
              smartInsights.map((insight, idx) => (
                <div key={idx} className="bg-slate-950/80 border border-amber-500/20 p-3 rounded-xl text-slate-300 leading-relaxed flex items-start gap-2.5">
                  <span className="text-amber-400 shrink-0">💡</span>
                  <span>{insight}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ready Food & Table Attention Alerts */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              OPERATIONAL ALERTS
            </h2>
          </div>

          <div className="space-y-3 text-xs max-h-[220px] overflow-y-auto pr-1">
            {/* Table Attention Alerts */}
            {tableAttentionAlerts.map((att, idx) => (
              <div key={idx} className="bg-slate-950/80 border border-rose-500/30 p-3 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 font-bold">TABLE {att.table_number}</span>
                  <span className="text-slate-300">{att.message}</span>
                </div>
                <button
                  onClick={() => navigate('/admin/offline/tables')}
                  className="px-2 py-1 bg-rose-500/20 text-rose-300 rounded text-[10px] font-bold border border-rose-500/40 hover:bg-rose-500/30 transition shrink-0"
                >
                  View Table
                </button>
              </div>
            ))}

            {/* Ready Food Alert Banner */}
            {readyFoodAlerts.map((rf, idx) => (
              <div key={idx} className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    🔔 FOOD READY - KOT #{rf.kot_number} (Table {rf.table_number})
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {rf.items_summary}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/admin/offline/ready-orders')}
                  className="px-2.5 py-1 bg-emerald-500 text-slate-950 rounded text-[10px] font-extrabold hover:bg-emerald-400 transition shrink-0"
                >
                  Serve Order
                </button>
              </div>
            ))}

            {tableAttentionAlerts.length === 0 && readyFoodAlerts.length === 0 && (
              <div className="text-center py-6 text-slate-500 bg-slate-950/40 rounded-xl">
                No active operational alerts right now.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
