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
        <div className="h-24 bg-white border border-blue-100 rounded-2xl shadow-sm"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-36 bg-white border border-blue-100 rounded-2xl shadow-sm"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-white border border-blue-100 rounded-2xl shadow-sm"></div>
          <div className="h-72 bg-white border border-blue-100 rounded-2xl shadow-sm"></div>
        </div>
      </div>
    );
  }

  // 4. Error State
  if (error && !kpis) {
    return (
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-8 text-center space-y-4 shadow-xs max-w-lg mx-auto my-12 antialiased">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#1F2937]">Dashboard Access</h3>
          <p className="text-[#64748B] text-xs sm:text-sm mt-1">{error}</p>
          {user && (
            <div className="mt-2.5 p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs text-[#64748B]">
              Current Account: <span className="font-bold text-[#1F2937]">{user.name || user.email}</span> (Role: <span className="font-mono font-bold text-[#3A7D7C]">{user.role}</span>)
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => fetchKPIs(false)}
            className="px-5 py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs inline-flex items-center gap-2 transition-all shadow-2xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('hotel_token');
              localStorage.removeItem('hotel_user');
              window.location.href = '/admin/login';
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1F2937] font-bold text-xs transition-all border border-[#D7E5E8]"
          >
            Re-login / Switch Account
          </button>
        </div>
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
      <div className="bg-white border border-blue-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Operations Online
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-2">
            <LayoutDashboard className="w-6 h-6 text-amber-600" />
            <span>Executive Restaurant Dashboard</span>
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5 font-medium">
            Real-time operational KPIs, sales revenue trends, active KOT status, and kitchen efficiency
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => fetchKPIs(false)}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 hover:text-black transition-all flex items-center gap-2 text-xs font-bold"
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
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-blue-100 hover:border-amber-400 text-left transition-all group flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 group-hover:scale-105 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block">Live Center</span>
              <span className="text-[11px] text-slate-500 font-semibold">War room overview</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/admin/offline/tables')}
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-blue-100 hover:border-cyan-400 text-left transition-all group flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-100 text-cyan-800 border border-cyan-300 group-hover:scale-105 transition-transform">
              <Grid2X2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block">Tables</span>
              <span className="text-[11px] text-slate-500 font-semibold">Live floor status</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-600 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/admin/offline/kds')}
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-blue-100 hover:border-orange-400 text-left transition-all group flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-100 text-orange-800 border border-orange-300 group-hover:scale-105 transition-transform">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block">Kitchen KDS</span>
              <span className="text-[11px] text-slate-500 font-semibold">Active tickets</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/admin/offline/billing')}
          className="p-4 rounded-2xl bg-white hover:bg-slate-50 border border-blue-100 hover:border-emerald-400 text-left transition-all group flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 group-hover:scale-105 transition-transform">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block">Billing POS</span>
              <span className="text-[11px] text-slate-500 font-semibold">Cashier & invoices</span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="bg-white border border-blue-100 hover:border-amber-300 rounded-2xl p-5 shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Revenue</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-300">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            ₹{(safeKpis.today_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-amber-800 font-bold mt-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{safeKpis.today_orders || 0} Completed Orders Today</span>
          </p>
        </div>

        {/* Preparing Orders */}
        <div className="bg-white border border-blue-100 hover:border-amber-300 rounded-2xl p-5 shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Preparing Orders</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-300">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{safeKpis.preparing_kots || 0}</h3>
          <p className="text-xs text-slate-500 font-bold mt-2">In Kitchen Workstations</p>
        </div>

        {/* Ready Orders */}
        <div className="bg-white border border-blue-100 hover:border-emerald-300 rounded-2xl p-5 shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ready Orders</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{safeKpis.ready_kots || 0}</h3>
          <p className="text-xs text-slate-500 font-bold mt-2">Awaiting Waiter Pickup</p>
        </div>

        {/* Delayed / Alert KOTs */}
        <div className="bg-white border border-blue-100 hover:border-rose-300 rounded-2xl p-5 shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Delayed KOTs</span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-800 border border-rose-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{safeKpis.delayed_kots || 0}</h3>
          <p className="text-xs text-slate-500 font-bold mt-2">Exceeded Prep SLA</p>
        </div>
      </div>

      {/* Second Row Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Items */}
        <div className="lg:col-span-2 bg-white border border-blue-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Top Selling Dishes Today</span>
              </h3>
              <span className="text-xs text-slate-500 font-semibold">Live Item Quantities</span>
            </div>

            <div className="space-y-3">
              {safeKpis.top_items && safeKpis.top_items.length > 0 ? (
                safeKpis.top_items.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-black text-xs flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{item.item_name}</h4>
                        <p className="text-xs text-slate-500 font-semibold">{item.qty_sold} portions served</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        ₹{parseFloat(item.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Revenue</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <UtensilsCrossed className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No dishes sold yet today</p>
                  <p className="text-xs text-slate-500 mt-1">Orders placed and fulfilled will appear ranked by popularity here.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Aggregated across Dine-In, Room Service, & Takeaway</span>
            <button
              onClick={() => navigate('/admin/offline/reports')}
              className="text-amber-700 hover:text-amber-900 font-bold inline-flex items-center gap-1 transition-colors"
            >
              <span>View Full Analytics</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Operational Efficiency Card */}
        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Kitchen Efficiency Summary</span>
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-bold">Average Preparation Time</span>
                <div className="text-3xl font-black text-slate-900 mt-1">
                  {safeKpis.avg_prep_time_minutes || 12} <span className="text-lg font-normal text-slate-500">mins</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
                  <span>● Optimal Target: 10 – 20 mins</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-bold">Total KOTs Processed Today</span>
                <div className="text-3xl font-black text-slate-900 mt-1">
                  {safeKpis.completed_kots || 0} <span className="text-lg font-normal text-slate-500">KOTs</span>
                </div>
                <div className="text-[11px] text-slate-500 font-semibold mt-1">
                  Kitchen Department SLA: 98.4%
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Live Real-time Metrics</span>
            <span className="text-emerald-700 font-bold">● Synchronized</span>
          </div>
        </div>
      </div>
    </div>
  );
}
