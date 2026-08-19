import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  ShoppingBag, IndianRupee, Bike, Clock, CheckCircle2, ChefHat, 
  PackageCheck, TrendingUp, AlertCircle, ArrowRight, ExternalLink, Sparkles, Globe, Settings, RefreshCw
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

  const k = kpis || { todayOrders: 0, todayRevenue: 0, statusCounts: {} };
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
      <div className="space-y-6 antialiased font-sans">

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
