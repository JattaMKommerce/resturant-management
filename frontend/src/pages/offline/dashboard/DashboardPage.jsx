import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import WaiterDashboard from '../waiter/WaiterDashboard';
import KitchenDashboard from '../kitchen/KitchenDashboard';
import {
  LayoutDashboard,
  DollarSign,
  ChefHat,
  Bell,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Activity,
  Grid2X2,
  Receipt,
  UtensilsCrossed,
  Sparkles,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKPIs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await api.get('/reports/dashboard-kpis');
      if (res.success && res.data) {
        setKpis(res.data);
      } else {
        throw new Error(res.message || 'Failed to load dashboard metrics');
      }
    } catch (err) {
      console.error('Failed to load executive dashboard KPIs:', err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs, user]);

  // 1. WAITER ROLE -> Render Waiter Dashboard
  if (user?.role === 'WAITER') {
    return <WaiterDashboard />;
  }

  // 2. KITCHEN ROLE -> Render Kitchen Dashboard
  if (user?.role === 'KITCHEN') {
    return <KitchenDashboard />;
  }

  // 3. Loading State
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-36 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
          <div className="h-72 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // 4. Error State
  if (error && !kpis) {
    return (
      <div className="glass-panel bg-slate-900/80 border border-rose-500/30 rounded-2xl p-8 text-center space-y-4 shadow-2xl max-w-lg mx-auto my-12">
        <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Dashboard Offline</h3>
          <p className="text-slate-400 text-sm mt-1">{error}</p>
        </div>
        <button
          onClick={() => fetchKPIs(false)}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm inline-flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const safeKpis = kpis || {
    today_revenue: 0,
    today_orders: 0,
    active_kots: 0,
    preparing_kots: 0,
    ready_kots: 0,
    delayed_kots: 0,
    completed_kots: 0,
    avg_prep_time_minutes: 12,
    sales_trend: [],
    top_items: []
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Operations Online
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2.5 mt-2">
            <LayoutDashboard className="w-7 h-7 text-amber-500" />
            <span>Executive Restaurant Dashboard</span>
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Real-time operational KPIs, sales revenue trends, active KOT status, and kitchen efficiency
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => fetchKPIs(false)}
            className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center gap-2 text-sm font-medium"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Navigation Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigate('/admin/offline/operations')}
          className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 text-left transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Live Center</span>
              <span className="text-[11px] text-slate-400">War room overview</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/admin/offline/tables')}
          className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-left transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
              <Grid2X2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Tables</span>
              <span className="text-[11px] text-slate-400">Live floor status</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/admin/offline/kds')}
          className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-orange-500/40 text-left transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 group-hover:scale-105 transition-transform">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Kitchen KDS</span>
              <span className="text-[11px] text-slate-400">Active tickets</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/admin/offline/billing')}
          className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Billing POS</span>
              <span className="text-[11px] text-slate-400">Cashier & invoices</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="glass-panel bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/20 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Revenue</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-white">
            ₹{(safeKpis.today_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-amber-400 font-medium mt-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{safeKpis.today_orders || 0} Completed Orders Today</span>
          </p>
        </div>

        {/* Preparing Orders */}
        <div className="glass-panel bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Preparing Orders</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-amber-400">{safeKpis.preparing_kots || 0}</h3>
          <p className="text-xs text-slate-400 font-medium mt-2">In Kitchen Workstations</p>
        </div>

        {/* Ready Orders */}
        <div className="glass-panel bg-slate-900/80 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ready Orders</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-emerald-400">{safeKpis.ready_kots || 0}</h3>
          <p className="text-xs text-slate-400 font-medium mt-2">Pending Waiter Pickup</p>
        </div>

        {/* Delayed KOTs */}
        <div className={`glass-panel border rounded-2xl p-5 shadow-xl transition-all ${
          safeKpis.delayed_kots > 0 ? 'bg-rose-950/20 border-rose-500/50' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Delayed KOTs</span>
            <div className={`p-2 rounded-xl border ${
              safeKpis.delayed_kots > 0 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse' 
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <h3 className={`text-3xl font-black ${safeKpis.delayed_kots > 0 ? 'text-rose-400' : 'text-white'}`}>
            {safeKpis.delayed_kots || 0}
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-2">
            {safeKpis.delayed_kots > 0 ? 'Exceeded Target Prep Time' : 'All Orders On Schedule'}
          </p>
        </div>
      </div>

      {/* Second Row Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Items */}
        <div className="lg:col-span-2 glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Top Selling Dishes Today</span>
              </h3>
              <span className="text-xs text-slate-500">Live Item Quantities</span>
            </div>

            <div className="space-y-3">
              {safeKpis.top_items && safeKpis.top_items.length > 0 ? (
                safeKpis.top_items.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-xs flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.item_name}</h4>
                        <p className="text-xs text-slate-400">{item.qty_sold} portions served</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-amber-400">
                        ₹{parseFloat(item.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Revenue</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                  <UtensilsCrossed className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-400">No dishes sold yet today</p>
                  <p className="text-xs text-slate-500 mt-1">Orders placed and fulfilled will appear ranked by popularity here.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>Aggregated across Dine-In, Room Service, & Takeaway</span>
            <button
              onClick={() => navigate('/admin/offline/reports')}
              className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <span>View Full Analytics</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Operational Efficiency Card */}
        <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Kitchen Efficiency Summary</span>
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Average Preparation Time</span>
                <div className="text-3xl font-black text-white mt-1">
                  {safeKpis.avg_prep_time_minutes || 12} <span className="text-lg font-normal text-slate-400">mins</span>
                </div>
                <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
                  <span>● Optimal Target: 10 – 20 mins</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total KOTs Processed Today</span>
                <div className="text-3xl font-black text-amber-400 mt-1">
                  {safeKpis.completed_kots || 0} <span className="text-lg font-normal text-slate-400">KOTs</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Served directly to guests at tables and rooms
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 text-center">
            HMS Real-time Operational Stream
          </div>
        </div>
      </div>
    </div>
  );
}

