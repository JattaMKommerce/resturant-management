import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldAlert, Building, Users, Bike, ShoppingBag, DollarSign, Lock, Unlock,
  CheckCircle, XCircle, Eye, EyeOff, LogOut, RefreshCw, Search, ExternalLink,
  AlertTriangle, Plus, Store, Check, Layers, ChevronRight, Sparkles, Clock, Calendar,
  CreditCard, ShieldCheck, Tag, CheckCircle2, UserCheck, AlertCircle, FileText
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function SuperAdminPage() {
  const { user, login, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Super Admin Auth State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals', 'subscriptions', 'plans', 'subscription_payments', 'restaurants', 'admins', 'orders', 'drivers'
  const [kpis, setKpis] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // SaaS Subscriptions & Approvals State
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [hotelSubscriptions, setHotelSubscriptions] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscriptionPayments, setSubscriptionPayments] = useState([]);

  // Modals
  const [showNewRestModal, setShowNewRestModal] = useState(false);
  const [newRestForm, setNewRestForm] = useState({ name: '', phone: '', email: '', address: '', area: '', city: '', state: '', postal_code: '' });
  const [showNewAdminModal, setShowNewAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({ name: '', email: '', password: '', phone: '', restaurant_id: '' });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: '', restaurant_id: '', is_primary: true });

  // Subscription Modals
  const [showAssignPlanModal, setShowAssignPlanModal] = useState(false);
  const [assignPlanForm, setAssignPlanForm] = useState({ restaurant_id: '', plan_id: '', duration_days: '', notes: '' });
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendForm, setExtendForm] = useState({ restaurant_id: '', extra_days: 30, notes: '', restaurant_name: '' });
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    duration_days: 30,
    max_orders_per_month: '',
    max_menu_items: '',
    max_staff_accounts: '',
    featuresText: ''
  });

  // Approval Detail & Rejection Modals
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user && user.role === 'SUPER_ADMIN') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpiRes, restRes, adminRes, orderRes, driverRes, subHotelRes, subPlanRes, subPayRes, pendingRes] = await Promise.all([
        api.get('/superadmin/kpis'),
        api.get('/superadmin/restaurants'),
        api.get('/superadmin/admins'),
        api.get('/superadmin/orders'),
        api.get('/superadmin/drivers'),
        api.get('/superadmin/subscriptions/hotels'),
        api.get('/superadmin/subscriptions/plans'),
        api.get('/superadmin/subscriptions/payments'),
        api.get('/superadmin/subscriptions/pending-approvals')
      ]);

      if (kpiRes.data.success) setKpis(kpiRes.data.kpis);
      if (restRes.data.success) setRestaurants(restRes.data.restaurants);
      if (adminRes.data.success) setAdmins(adminRes.data.admins);
      if (orderRes.data.success) setOrders(orderRes.data.orders);
      if (driverRes.data.success) setDrivers(driverRes.data.drivers);
      if (subHotelRes.data.success) setHotelSubscriptions(subHotelRes.data.data);
      if (subPlanRes.data.success) setSubscriptionPlans(subPlanRes.data.data);
      if (subPayRes.data.success) setSubscriptionPayments(subPayRes.data.data);
      if (pendingRes.data.success) setPendingApprovals(pendingRes.data.data);
    } catch (err) {
      console.error('Super Admin Data Load Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuperAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const res = await login(authEmail, authPassword);
      if (res.success) {
        if (res.user.role !== 'SUPER_ADMIN') {
          await logout();
          setAuthError('Access Denied: Account does not have Super Admin privileges.');
        } else {
          setAuthEmail(''); setAuthPassword('');
        }
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Invalid Super Admin credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Pending Approvals Actions
  const handleApproveSubscription = async (subscriptionId) => {
    if (!window.confirm('Approve this subscription and grant immediate active HMS access? Subscription validity will start from NOW.')) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/superadmin/subscriptions/approvals/${subscriptionId}/approve`, {
        notes: 'Approved by Master Super Admin'
      });
      if (res.data.success) {
        alert('🎉 ' + res.data.message);
        setSelectedApproval(null);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubscription = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.post(`/superadmin/subscriptions/approvals/${rejectingId}/reject`, {
        reason: rejectionReason
      });
      if (res.data.success) {
        alert('❌ ' + res.data.message);
        setShowRejectModal(false);
        setRejectingId(null);
        setRejectionReason('');
        setSelectedApproval(null);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleRestaurantStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`Change restaurant status to ${nextStatus}?`)) return;
    try {
      await api.patch(`/superadmin/restaurants/${id}/status`, { status: nextStatus });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/superadmin/restaurants', newRestForm);
      if (res.data.success) {
        setShowNewRestModal(false);
        setNewRestForm({ name: '', phone: '', email: '', address: '', area: '', city: '', state: '', postal_code: '' });
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create restaurant.');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/superadmin/admins', newAdminForm);
      if (res.data.success) {
        setShowNewAdminModal(false);
        setNewAdminForm({ name: '', email: '', password: '', phone: '', restaurant_id: '' });
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create admin.');
    }
  };

  const handleAssignAdmin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/superadmin/admins/assign', assignForm);
      if (res.data.success) {
        setShowAssignModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign admin.');
    }
  };

  const handleAssignPlan = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/superadmin/subscriptions/assign', assignPlanForm);
      if (res.data.success) {
        setShowAssignPlanModal(false);
        setAssignPlanForm({ restaurant_id: '', plan_id: '', duration_days: '', notes: '' });
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign plan.');
    }
  };

  const handleExtendSubscription = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/superadmin/subscriptions/extend', {
        restaurant_id: extendForm.restaurant_id,
        extra_days: extendForm.extra_days,
        notes: extendForm.notes
      });
      if (res.data.success) {
        setShowExtendModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to extend subscription.');
    }
  };

  const handleToggleHotelSubStatus = async (restaurantId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`Change hotel subscription status to ${nextStatus}?`)) return;
    try {
      await api.patch(`/superadmin/subscriptions/hotels/${restaurantId}/status`, {
        restaurant_id: restaurantId,
        status: nextStatus
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    try {
      const features = newPlanForm.featuresText
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const res = await api.post('/superadmin/subscriptions/plans', {
        name: newPlanForm.name,
        slug: newPlanForm.slug,
        description: newPlanForm.description,
        price: parseFloat(newPlanForm.price) || 0,
        duration_days: parseInt(newPlanForm.duration_days) || 30,
        max_orders_per_month: newPlanForm.max_orders_per_month ? parseInt(newPlanForm.max_orders_per_month) : null,
        max_menu_items: newPlanForm.max_menu_items ? parseInt(newPlanForm.max_menu_items) : null,
        max_staff_accounts: newPlanForm.max_staff_accounts ? parseInt(newPlanForm.max_staff_accounts) : null,
        features
      });

      if (res.data.success) {
        setShowNewPlanModal(false);
        setNewPlanForm({
          name: '',
          slug: '',
          description: '',
          price: '',
          duration_days: 30,
          max_orders_per_month: '',
          max_menu_items: '',
          max_staff_accounts: '',
          featuresText: ''
        });
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create plan.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-[#3A7D7C] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Security Login Screen
  if (!user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col justify-center items-center p-4 font-sans antialiased">
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
          <Link to="/" className="flex items-center gap-2 text-[#64748B] hover:text-[#1F2937] text-xs font-semibold">
            ← Back to Platform
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-[#3A7D7C] bg-white border border-[#D7E5E8] px-3 py-1 rounded-full shadow-2xs font-bold">
            <ShieldAlert className="w-4 h-4 text-[#3A7D7C]" /> RESTRICTED SUPER ADMIN PORTAL
          </div>
        </div>

        <div className="max-w-md w-full bg-white border border-[#D7E5E8] rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold mx-auto shadow-md shadow-[#3A7D7C]/20">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1F2937] tracking-tight">Super Admin Portal</h2>
            <p className="text-xs text-[#64748B]">Platform administration & multi-tenant oversight</p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSuperAdminLogin} className="space-y-4 text-xs font-medium">
            <div>
              <label className="block text-[#1F2937] font-bold mb-1.5 uppercase text-[10px] tracking-wider">Super Admin Email</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="superadmin@gmail.com"
                className="w-full p-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] placeholder-[#94A3B8] focus:border-[#3A7D7C] focus:ring-2 focus:ring-[#3A7D7C]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-[#1F2937] font-bold mb-1.5 uppercase text-[10px] tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showAuthPassword ? 'text' : 'password'}
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] placeholder-[#94A3B8] focus:border-[#3A7D7C] focus:ring-2 focus:ring-[#3A7D7C]/20 outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword(!showAuthPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                >
                  {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl transition-all shadow-md shadow-[#3A7D7C]/20 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Sign In to Super Admin Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeSubsCount = hotelSubscriptions.filter(s => s.status === 'ACTIVE').length;
  const expiredSubsCount = hotelSubscriptions.filter(s => s.status === 'EXPIRED').length;

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col font-sans antialiased">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-[#D7E5E8] sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3A7D7C] text-white flex items-center justify-center font-black shadow-xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-[#1F2937] text-lg tracking-tight">Super Admin Platform Control</h1>
              <span className="bg-[#EAF4F7] text-[#3A7D7C] font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-[#D7E5E8] uppercase tracking-wider">Master Platform</span>
            </div>
            <p className="text-xs text-[#64748B]">Multi-hotel SaaS subscription approvals, plan governance & tenant administration</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData} 
            className="p-2.5 bg-white hover:bg-slate-50 text-[#1F2937] rounded-xl transition-colors border border-[#D7E5E8] shadow-2xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => { logout(); navigate('/admin/login'); }} 
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all shadow-2xs cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        {/* Master KPIs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
            pendingApprovals.length > 0 ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20' : 'bg-white border-[#D7E5E8]'
          }`}>
            <span className="text-[10px] font-bold uppercase text-amber-800 block">Pending Approvals</span>
            <span className="text-2xl font-bold text-amber-900 mt-1 block">{pendingApprovals.length}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Total Hotels</span>
            <span className="text-2xl font-bold text-[#1F2937] mt-1 block">{restaurants.length}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Active Subscriptions</span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">{activeSubsCount}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Expired Subscriptions</span>
            <span className="text-2xl font-bold text-rose-700 mt-1 block">{expiredSubsCount}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">SaaS Plans</span>
            <span className="text-2xl font-bold text-[#3A7D7C] mt-1 block">{subscriptionPlans.length}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Platform Orders</span>
            <span className="text-2xl font-bold text-[#3A7D7C] mt-1 block">{orders.length}</span>
          </div>
        </div>

        {/* Tab Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-[#D7E5E8] shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button 
              onClick={() => setActiveTab('approvals')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'approvals' 
                  ? 'bg-amber-600 text-white shadow-2xs' 
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <UserCheck className="w-4 h-4" /> Pending Approvals ({pendingApprovals.length})
            </button>

            <button 
              onClick={() => setActiveTab('subscriptions')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'subscriptions' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Hotel Subscriptions ({hotelSubscriptions.length})
            </button>

            <button 
              onClick={() => setActiveTab('plans')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'plans' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <Tag className="w-4 h-4" /> SaaS Plans ({subscriptionPlans.length})
            </button>

            <button 
              onClick={() => setActiveTab('subscription_payments')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'subscription_payments' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <CreditCard className="w-4 h-4" /> SaaS Payments ({subscriptionPayments.length})
            </button>

            <button 
              onClick={() => setActiveTab('restaurants')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'restaurants' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <Store className="w-4 h-4" /> Restaurants ({restaurants.length})
            </button>
            <button 
              onClick={() => setActiveTab('admins')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'admins' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <Users className="w-4 h-4" /> Admins ({admins.length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="w-full pl-9 pr-3 py-1.5 bg-[#EAF4F7] border border-[#D7E5E8] rounded-xl text-xs text-[#1F2937] outline-none"
              />
            </div>
            {activeTab === 'plans' && (
              <button 
                onClick={() => setShowNewPlanModal(true)} 
                className="px-3.5 py-1.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create Plan
              </button>
            )}
            {activeTab === 'subscriptions' && (
              <button 
                onClick={() => setShowAssignPlanModal(true)} 
                className="px-3.5 py-1.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Plan
              </button>
            )}
          </div>
        </div>

        {/* 1. PENDING APPROVALS QUEUE TAB */}
        {activeTab === 'approvals' && (
          <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#D7E5E8] flex justify-between items-center bg-amber-50/40">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-[#1F2937]">Pending Subscription Approvals Queue</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {pendingApprovals.length} Awaiting Super Admin Review
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Payment has been received. Review transactions and grant active HMS operational access from the moment of approval.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-[#EAF4F7] text-[#1F2937] uppercase text-[10px] tracking-wider border-b border-[#D7E5E8]">
                  <tr>
                    <th className="p-4">Hotel Name & ID</th>
                    <th className="p-4">Plan & Duration</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method & Ref</th>
                    <th className="p-4">Payment Status</th>
                    <th className="p-4">Subscription Status</th>
                    <th className="p-4">Submitted At</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {pendingApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-xs text-[#64748B]">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                        <span className="font-bold text-sm text-[#1F2937] block">No Pending Approvals</span>
                        <span>All hotel subscription requests have been reviewed and processed.</span>
                      </td>
                    </tr>
                  ) : (
                    pendingApprovals
                      .filter(p => !search || p.restaurant_name.toLowerCase().includes(search.toLowerCase()) || p.transaction_reference.toLowerCase().includes(search.toLowerCase()))
                      .map((item) => (
                        <tr key={item.subscription_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-sm text-[#1F2937]">{item.restaurant_name}</div>
                            <div className="text-[11px] text-[#64748B]">Hotel ID: #{item.restaurant_id} • {item.restaurant_slug}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-[#1F2937]">{item.plan_name}</div>
                            <div className="text-[11px] text-[#64748B]">{item.plan_duration_days} Days Access</div>
                          </td>
                          <td className="p-4 font-bold text-sm">
                            ₹{item.payment_amount.toLocaleString('en-IN')}
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-[#D7E5E8] text-[10px] font-bold block w-fit mb-1">
                              {item.payment_method}
                            </span>
                            <span className="font-mono text-[11px] text-[#64748B] block truncate max-w-[140px]" title={item.transaction_reference}>
                              {item.transaction_reference}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                              item.payment_status === 'SUCCESS'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {item.payment_status}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-300">
                              PENDING_APPROVAL
                            </span>
                          </td>
                          <td className="p-4 text-[#64748B] text-[11px]">
                            {new Date(item.submitted_at).toLocaleString('en-IN')}
                          </td>
                          <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedApproval(item)}
                              className="px-2.5 py-1.5 bg-[#EAF4F7] hover:bg-[#D7E5E8] text-[#1F2937] rounded-lg font-bold text-xs border border-[#D7E5E8] cursor-pointer"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleApproveSubscription(item.subscription_id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs cursor-pointer disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setRejectingId(item.subscription_id);
                                setRejectionReason('');
                                setShowRejectModal(true);
                              }}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-xs border border-rose-200 cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. HOTEL SUBSCRIPTIONS MASTER TABLE */}
        {activeTab === 'subscriptions' && (
          <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#D7E5E8] flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#1F2937]">Hotel Subscriptions Master Table</h2>
                <p className="text-xs text-[#64748B]">Real-time state, plan assignments, countdowns, and immediate expiry enforcement</p>
              </div>
              <button 
                onClick={() => setShowAssignPlanModal(true)}
                className="px-4 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Explicitly Assign Plan
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-[#EAF4F7] text-[#1F2937] uppercase text-[10px] tracking-wider border-b border-[#D7E5E8]">
                  <tr>
                    <th className="p-4">Hotel / Restaurant</th>
                    <th className="p-4">Assigned Plan</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Starts At</th>
                    <th className="p-4">Expires At</th>
                    <th className="p-4">Remaining Days</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {hotelSubscriptions
                    .filter(h => !search || h.restaurant_name.toLowerCase().includes(search.toLowerCase()))
                    .map((hs) => {
                      const daysLeft = hs.remaining_ms > 0 ? Math.ceil(hs.remaining_ms / (1000 * 60 * 60 * 24)) : 0;
                      return (
                        <tr key={hs.restaurant_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-bold">
                            <div className="text-sm text-[#1F2937]">{hs.restaurant_name}</div>
                            <div className="text-[11px] text-[#64748B] font-normal">{hs.restaurant_slug} • {hs.restaurant_city || 'India'}</div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#1F2937]">{hs.plan_name}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${
                                hs.is_trial || hs.subscription_type === 'TRIAL'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {hs.is_trial || hs.subscription_type === 'TRIAL' ? 'FREE TRIAL' : 'PAID'}
                              </span>
                            </div>
                            {hs.plan_price > 0 && <span className="text-[11px] text-[#64748B] block mt-0.5">₹{hs.plan_price} / {hs.plan_duration_days}d</span>}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                              hs.status === 'ACTIVE'
                                ? hs.is_trial ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : hs.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : hs.status === 'EXPIRED'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : hs.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : 'bg-slate-100 text-[#64748B] border-[#D7E5E8]'
                            }`}>
                              {hs.status}
                            </span>
                          </td>
                          <td className="p-4 text-[#64748B]">
                            {hs.starts_at ? new Date(hs.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="p-4 text-[#64748B]">
                            {hs.expires_at ? new Date(hs.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="p-4 font-mono font-bold">
                            {hs.status === 'ACTIVE' ? (
                              <span className={daysLeft <= 3 ? 'text-amber-700' : 'text-emerald-700'}>
                                {daysLeft} Days Left
                              </span>
                            ) : hs.status === 'PENDING_APPROVAL' ? (
                              <span className="text-amber-700">Awaiting Approval</span>
                            ) : (
                              <span className="text-rose-700">Blocked (0d)</span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setExtendForm({
                                  restaurant_id: hs.restaurant_id,
                                  extra_days: 30,
                                  notes: '',
                                  restaurant_name: hs.restaurant_name
                                });
                                setShowExtendModal(true);
                              }}
                              className="px-2.5 py-1 bg-[#EAF4F7] hover:bg-[#D7E5E8] text-[#3A7D7C] rounded-lg font-bold text-[11px] border border-[#D7E5E8] transition-colors cursor-pointer"
                            >
                              + Extend Days
                            </button>
                            <button
                              onClick={() => {
                                setAssignPlanForm({
                                  restaurant_id: hs.restaurant_id,
                                  plan_id: hs.plan_id || (subscriptionPlans[0]?.id || ''),
                                  duration_days: '',
                                  notes: ''
                                });
                                setShowAssignPlanModal(true);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[#1F2937] rounded-lg font-bold text-[11px] border border-[#D7E5E8] transition-colors cursor-pointer"
                            >
                              Change Plan
                            </button>
                            {hs.has_subscription && (
                              <button
                                onClick={() => handleToggleHotelSubStatus(hs.restaurant_id, hs.status)}
                                className={`px-2 py-1 rounded-lg font-bold text-[11px] border transition-colors cursor-pointer ${
                                  hs.status === 'ACTIVE'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                {hs.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. SAAS PLANS TAB */}
        {activeTab === 'plans' && (
          <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#D7E5E8] flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#1F2937]">Subscription Plans Catalog</h2>
                <p className="text-xs text-[#64748B]">Manage pricing, quotas, duration, and feature lists available to hotels</p>
              </div>
              <button 
                onClick={() => setShowNewPlanModal(true)}
                className="px-4 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create New Plan
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6">
              {subscriptionPlans.map((plan) => (
                <div key={plan.id} className="rounded-2xl border border-[#D7E5E8] p-5 bg-white shadow-2xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-center">
                      <h3 className="text-base font-extrabold text-[#1F2937]">{plan.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        plan.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {plan.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-black text-[#1F2937]">₹{plan.price.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-[#64748B]"> / {plan.duration_days} days</span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{plan.description}</p>
                    
                    <div className="mt-4 pt-3 border-t border-[#D7E5E8] space-y-1.5">
                      <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Features:</div>
                      {plan.features.map((f, i) => (
                        <div key={i} className="text-xs text-[#334155] flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#D7E5E8] flex justify-between items-center text-[11px] text-[#64748B]">
                    <span>Orders/mo: {plan.max_orders_per_month || 'Unlimited'}</span>
                    <span>Staff: {plan.max_staff_accounts || 'Unlimited'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. SAAS PAYMENTS LEDGER TAB */}
        {activeTab === 'subscription_payments' && (
          <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#D7E5E8]">
              <h2 className="text-base font-bold text-[#1F2937]">SaaS Subscription Payments Ledger</h2>
              <p className="text-xs text-[#64748B]">Online Razorpay transactions and offline payment reference history</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-[#EAF4F7] text-[#1F2937] uppercase text-[10px] tracking-wider border-b border-[#D7E5E8]">
                  <tr>
                    <th className="p-4">Transaction Ref</th>
                    <th className="p-4">Hotel</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Payment Status</th>
                    <th className="p-4">Subscription Status</th>
                    <th className="p-4">Notes / UTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {subscriptionPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-[#64748B]">
                        No subscription payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    subscriptionPayments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-mono font-bold">{pay.transaction_reference}</td>
                        <td className="p-4 font-bold text-[#1F2937]">{pay.restaurant_name}</td>
                        <td className="p-4">{pay.plan_name} ({pay.duration_days}d)</td>
                        <td className="p-4 font-bold">₹{parseFloat(pay.amount).toLocaleString('en-IN')}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-[#D7E5E8] text-[10px] font-bold">
                            {pay.payment_method}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                            pay.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : pay.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {pay.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                            pay.subscription_status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : pay.subscription_status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {pay.subscription_status || 'PENDING'}
                          </span>
                        </td>
                        <td className="p-4 text-[#64748B] text-[11px] max-w-xs truncate">
                          {pay.offline_proof_note || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. RESTAURANTS TAB */}
        {activeTab === 'restaurants' && (
          <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#D7E5E8] flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#1F2937]">Registered Restaurants & Hotels</h2>
                <p className="text-xs text-[#64748B]">Platform multi-tenancy records</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-[#EAF4F7] text-[#1F2937] uppercase text-[10px] tracking-wider border-b border-[#D7E5E8]">
                  <tr>
                    <th className="p-4">Restaurant</th>
                    <th className="p-4">Slug</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">City</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {restaurants.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-[#1F2937]">{r.name}</td>
                      <td className="p-4 font-mono text-[#64748B]">{r.slug}</td>
                      <td className="p-4 text-[#64748B]">{r.email || r.phone || '—'}</td>
                      <td className="p-4">{r.city || '—'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                          r.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => toggleRestaurantStatus(r.id, r.status)}
                          className="px-3 py-1 bg-white border border-[#D7E5E8] hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          {r.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. ADMINS TAB */}
        {activeTab === 'admins' && (
          <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#D7E5E8] flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#1F2937]">Restaurant Admins</h2>
                <p className="text-xs text-[#64748B]">Manager & Admin credentials</p>
              </div>
              <button 
                onClick={() => setShowNewAdminModal(true)}
                className="px-4 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create Admin
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-[#EAF4F7] text-[#1F2937] uppercase text-[10px] tracking-wider border-b border-[#D7E5E8]">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Assigned Hotel</th>
                    <th className="p-4">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {admins.map(a => (
                    <tr key={a.user_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-[#1F2937]">{a.name}</td>
                      <td className="p-4">{a.email}</td>
                      <td className="p-4 text-[#64748B]">{a.phone}</td>
                      <td className="p-4 font-bold text-[#3A7D7C]">{a.restaurant_name || 'Unassigned'}</td>
                      <td className="p-4 font-mono text-[10px]">{a.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* MODAL: VIEW APPROVAL DETAILS */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-[#D7E5E8] pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  PENDING SUPER ADMIN REVIEW
                </span>
                <h3 className="text-lg font-extrabold text-[#1F2937] mt-1.5">{selectedApproval.restaurant_name}</h3>
              </div>
              <button 
                onClick={() => setSelectedApproval(null)}
                className="text-[#64748B] hover:text-[#1F2937] p-1.5 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs bg-[#F8FAFC] p-4 rounded-2xl border border-[#D7E5E8]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Selected Plan</span>
                  <span className="font-bold text-[#1F2937] text-sm">{selectedApproval.plan_name} ({selectedApproval.plan_duration_days}d)</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Amount Due</span>
                  <span className="font-bold text-[#1F2937] text-sm">₹{selectedApproval.payment_amount}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Payment Method</span>
                  <span className="font-bold text-[#1F2937]">{selectedApproval.payment_method}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Payment Status</span>
                  <span className="font-bold text-emerald-700">{selectedApproval.payment_status}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#D7E5E8]">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">Transaction Reference</span>
                <span className="font-mono font-bold text-[#1F2937]">{selectedApproval.transaction_reference}</span>
              </div>

              {selectedApproval.offline_proof_note && (
                <div className="pt-2 border-t border-[#D7E5E8]">
                  <span className="text-[#64748B] block text-[10px] uppercase font-bold">Offline Proof Note / UTR</span>
                  <p className="text-[#334155] font-semibold mt-0.5 bg-white p-2.5 rounded-xl border border-[#D7E5E8]">
                    {selectedApproval.offline_proof_note}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingId(selectedApproval.subscription_id);
                  setRejectionReason('');
                  setShowRejectModal(true);
                }}
                className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 text-xs cursor-pointer"
              >
                Reject Request
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleApproveSubscription(selectedApproval.subscription_id)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-xs cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Activating...' : 'Approve & Activate Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT SUBSCRIPTION */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[#1F2937]">Reject Subscription Request</h3>
            <p className="text-xs text-[#64748B]">Please provide a specific rejection reason for the hotel.</p>
            
            <form onSubmit={handleRejectSubscription} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. UTR reference could not be verified in bank statement."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN PLAN */}
      {showAssignPlanModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#1F2937]">Explicitly Assign SaaS Plan</h3>
            <form onSubmit={handleAssignPlan} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Select Hotel / Restaurant *</label>
                <select 
                  required 
                  value={assignPlanForm.restaurant_id} 
                  onChange={e => setAssignPlanForm({...assignPlanForm, restaurant_id: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                >
                  <option value="">Select Hotel...</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name} ({r.slug})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Select SaaS Plan *</label>
                <select 
                  required 
                  value={assignPlanForm.plan_id} 
                  onChange={e => setAssignPlanForm({...assignPlanForm, plan_id: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                >
                  <option value="">Select Plan...</option>
                  {subscriptionPlans.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price} / {p.duration_days} days)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Override Duration Days (Optional)</label>
                <input 
                  type="number" 
                  placeholder="Leave empty to use plan default" 
                  value={assignPlanForm.duration_days} 
                  onChange={e => setAssignPlanForm({...assignPlanForm, duration_days: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Notes</label>
                <input 
                  type="text" 
                  placeholder="e.g. Assigned on special promo" 
                  value={assignPlanForm.notes} 
                  onChange={e => setAssignPlanForm({...assignPlanForm, notes: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowAssignPlanModal(false)} 
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl"
                >
                  Assign & Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXTEND DAYS */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#1F2937]">Extend Subscription</h3>
            <p className="text-xs text-[#64748B]">Add extra days for {extendForm.restaurant_name}</p>
            <form onSubmit={handleExtendSubscription} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Extra Days to Add *</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={extendForm.extra_days} 
                  onChange={e => setExtendForm({...extendForm, extra_days: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Reason / Notes</label>
                <input 
                  type="text" 
                  placeholder="e.g. Courtesy bonus extension" 
                  value={extendForm.notes} 
                  onChange={e => setExtendForm({...extendForm, notes: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowExtendModal(false)} 
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl"
                >
                  Add Days
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW PLAN */}
      {showNewPlanModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-[#1F2937]">Create New SaaS Plan</h3>
            <form onSubmit={handleCreatePlan} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Plan Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Premium Annual Plan"
                  value={newPlanForm.name} 
                  onChange={e => setNewPlanForm({...newPlanForm, name: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Price (₹) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    placeholder="e.g. 2999"
                    value={newPlanForm.price} 
                    onChange={e => setNewPlanForm({...newPlanForm, price: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Duration (Days) *</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    placeholder="e.g. 30"
                    value={newPlanForm.duration_days} 
                    onChange={e => setNewPlanForm({...newPlanForm, duration_days: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Description</label>
                <input 
                  type="text" 
                  placeholder="Short tagline about the plan"
                  value={newPlanForm.description} 
                  onChange={e => setNewPlanForm({...newPlanForm, description: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Features (One feature per line)</label>
                <textarea 
                  rows={4}
                  placeholder="Kitchen Display System&#10;Table QR Menus&#10;Online Storefront"
                  value={newPlanForm.featuresText} 
                  onChange={e => setNewPlanForm({...newPlanForm, featuresText: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none font-sans"
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewPlanModal(false)} 
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW RESTAURANT */}
      {showNewRestModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#1F2937]">Add New Restaurant</h3>
            <form onSubmit={handleCreateRestaurant} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Restaurant Name *</label>
                <input 
                  type="text" 
                  required 
                  value={newRestForm.name} 
                  onChange={e => setNewRestForm({...newRestForm, name: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Phone</label>
                  <input 
                    type="text" 
                    value={newRestForm.phone} 
                    onChange={e => setNewRestForm({...newRestForm, phone: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Email</label>
                  <input 
                    type="email" 
                    value={newRestForm.email} 
                    onChange={e => setNewRestForm({...newRestForm, email: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none" 
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewRestModal(false)} 
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl"
                >
                  Create Restaurant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW ADMIN */}
      {showNewAdminModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#1F2937]">Create Restaurant Admin</h3>
            <form onSubmit={handleCreateAdmin} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Full Name *</label>
                <input 
                  type="text" 
                  required 
                  value={newAdminForm.name} 
                  onChange={e => setNewAdminForm({...newAdminForm, name: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Email Address *</label>
                <input 
                  type="email" 
                  required 
                  value={newAdminForm.email} 
                  onChange={e => setNewAdminForm({...newAdminForm, email: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Password *</label>
                <input 
                  type="password" 
                  required 
                  value={newAdminForm.password} 
                  onChange={e => setNewAdminForm({...newAdminForm, password: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Phone Number *</label>
                <input 
                  type="text" 
                  required 
                  value={newAdminForm.phone} 
                  onChange={e => setNewAdminForm({...newAdminForm, phone: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Assign to Restaurant</label>
                <select 
                  value={newAdminForm.restaurant_id} 
                  onChange={e => setNewAdminForm({...newAdminForm, restaurant_id: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                >
                  <option value="">Select Restaurant...</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewAdminModal(false)} 
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl"
                >
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
