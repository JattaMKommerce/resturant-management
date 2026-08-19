import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  ShoppingBag, IndianRupee, Bike, Clock, CheckCircle2, ChefHat, 
  PackageCheck, TrendingUp, AlertCircle, ArrowRight, ExternalLink, Sparkles, Globe, Settings
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

  // Live Socket updates for Dashboard KPIs (e.g. when order is delivered)
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-xs font-semibold text-slate-500">Loading operational KPIs...</p>
        </div>
      </AdminLayout>
    );
  }

  const k = kpis || { todayOrders: 0, todayRevenue: 0, statusCounts: {} };
  const showOnboardingBanner = setupProgress && !setupProgress.isSetupComplete;

  return (
    <AdminLayout>
      <div className="space-y-8">

        {/* Onboarding Alert Banner */}
        {showOnboardingBanner && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Complete Your Restaurant Setup</h3>
                <p className="text-xs text-white/90">Finish setup steps to publish your online ordering website ({setupProgress.completedCount}/7 steps complete).</p>
              </div>
            </div>
            <Link to={`/admin/${currentSlug}/onboarding`} className="px-6 py-3 bg-white text-orange-600 rounded-xl font-bold text-xs hover:bg-orange-50 transition-all shadow-md">
              Open Setup Wizard →
            </Link>
          </div>
        )}
        
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Today's Total Orders</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{k.todayOrders}</h3>
              <span className="text-[11px] font-bold text-emerald-600 mt-1 inline-block">Active Pipeline</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Today's Revenue</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">₹{k.todayRevenue.toFixed(2)}</h3>
              <span className="text-[11px] font-semibold text-slate-400 mt-1 block">Live Today</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Website Status</span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-1">{restaurant?.website_status || 'DRAFT'}</h3>
              <Link to={`/admin/${currentSlug}/website`} className="text-[11px] font-bold text-orange-600 hover:underline">Manage Website ↗</Link>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Globe className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Online Ordering</span>
              <h3 className={`text-lg font-extrabold mt-1 ${restaurant?.is_online_ordering_enabled ? 'text-emerald-600' : 'text-red-600'}`}>
                {restaurant?.is_online_ordering_enabled ? 'ACCEPTING' : 'PAUSED'}
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">Toggle in Header</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

        </div>

        {/* Pipeline Status Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <h3 className="font-extrabold text-base text-slate-900 mb-4">Operational Status Pipeline Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-center">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block">Pending</span>
              <span className="text-xl font-black text-amber-600 mt-1 block">{k.statusCounts?.PENDING || 0}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block">Accepted</span>
              <span className="text-xl font-black text-blue-600 mt-1 block">{k.statusCounts?.ACCEPTED || 0}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block">Kitchen</span>
              <span className="text-xl font-black text-purple-600 mt-1 block">{k.statusCounts?.SENT_TO_KITCHEN || 0}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block">Preparing</span>
              <span className="text-xl font-black text-indigo-600 mt-1 block">{k.statusCounts?.PREPARING || 0}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block">Ready</span>
              <span className="text-xl font-black text-emerald-600 mt-1 block">{k.statusCounts?.READY_FOR_PICKUP || 0}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block">In Delivery</span>
              <span className="text-xl font-black text-orange-600 mt-1 block">{k.statusCounts?.OUT_FOR_DELIVERY || 0}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block">Completed</span>
              <span className="text-xl font-black text-emerald-700 mt-1 block">{k.statusCounts?.DELIVERED || 0}</span>
            </div>
          </div>
        </div>

        {/* Recent Orders Overview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">Recent Live Orders</h3>
            <Link to={`/admin/${currentSlug}/orders`} className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1">
              View All Orders <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[650px] text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100 font-medium">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-extrabold text-slate-900">{ord.order_number}</td>
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{ord.customer_name}</span>
                      <span className="text-[11px] text-slate-400">{ord.customer_phone}</span>
                    </td>
                    <td className="p-4">{ord.delivery_area} ({ord.distance_km} km)</td>
                    <td className="p-4 font-black text-slate-900">₹{parseFloat(ord.total_amount).toFixed(2)}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-700">
                        {ord.payment_method} ({ord.payment_status})
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full font-bold text-[10px] bg-orange-100 text-orange-800">
                        {ord.order_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        to={`/admin/${currentSlug}/orders?id=${ord.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                      >
                        Manage Order →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
