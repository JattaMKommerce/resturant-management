import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldAlert, Building, Users, Bike, ShoppingBag, DollarSign, Lock, Unlock,
  CheckCircle, XCircle, Eye, EyeOff, LogOut, RefreshCw, Search, ExternalLink,
  AlertTriangle, Plus, Store, Check, Layers, ChevronRight, Sparkles, Clock, Calendar,
  CreditCard, ShieldCheck, Tag, CheckCircle2, UserCheck, AlertCircle, FileText,
  Sliders, Utensils, ChefHat, Grid2X2, Boxes, BarChart3, BedDouble, Gift, Globe, Receipt,
  Phone, Mail, TrendingUp, ArrowUpRight, PieChart, Filter, ArrowUpDown, Info, X, ChevronDown,
  Wallet
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

  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals', 'subscriptions', 'plans', 'subscription_payments', 'restaurants', 'admins', 'orders', 'drivers', 'controls'
  const [kpis, setKpis] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Multi-Channel Revenue & Financial Breakdown State
  const [selectedRestRevenue, setSelectedRestRevenue] = useState(null);
  const [revenueChannelFilter, setRevenueChannelFilter] = useState('all'); // 'all', 'online', 'offline'
  const [revenueSortBy, setRevenueSortBy] = useState('highest_total'); // 'highest_total', 'highest_today', 'highest_weekly', 'highest_monthly', 'most_orders', 'name'
  const [selectedAdminDetail, setSelectedAdminDetail] = useState(null);

  // Admin Specific Multi-Channel Revenue State
  const [selectedAdminRevenue, setSelectedAdminRevenue] = useState(null);
  const [adminRevenueChannelFilter, setAdminRevenueChannelFilter] = useState('all'); // 'all', 'online', 'offline'
  const [adminRevenueSortBy, setAdminRevenueSortBy] = useState('highest_total'); // 'highest_total', 'highest_today', 'highest_weekly', 'highest_monthly', 'most_orders', 'name'
  const [adminStatusUpdatingId, setAdminStatusUpdatingId] = useState(null);

  const toggleAdminStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setAdminStatusUpdatingId(userId);
    setAdmins(prev => prev.map(a => a.user_id === userId ? { ...a, status: nextStatus } : a));
    try {
      const res = await api.patch(`/superadmin/admins/${userId}/status`, { status: nextStatus });
      if (res.data?.success) {
        api.get('/superadmin/admins').then(rRes => {
          if (rRes.data?.success) setAdmins(rRes.data.admins);
        }).catch(() => {});
      }
    } catch (err) {
      setAdmins(prev => prev.map(a => a.user_id === userId ? { ...a, status: currentStatus } : a));
      alert(err.response?.data?.message || 'Failed to update admin status.');
    } finally {
      setAdminStatusUpdatingId(null);
    }
  };

  const formatInr = (val) => {
    const num = parseFloat(val) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Feature Controls & Provisioning State
  const [restaurantsWithFeatures, setRestaurantsWithFeatures] = useState([]);
  const [selectedControlRest, setSelectedControlRest] = useState(null);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlsFeedback, setControlsFeedback] = useState(null);

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
      const [kpiRes, restRes, adminRes, orderRes, driverRes, subHotelRes, subPlanRes, subPayRes, pendingRes, featRes] = await Promise.all([
        api.get('/superadmin/kpis'),
        api.get('/superadmin/restaurants'),
        api.get('/superadmin/admins'),
        api.get('/superadmin/orders'),
        api.get('/superadmin/drivers'),
        api.get('/superadmin/subscriptions/hotels'),
        api.get('/superadmin/subscriptions/plans'),
        api.get('/superadmin/subscriptions/payments'),
        api.get('/superadmin/subscriptions/pending-approvals'),
        api.get('/superadmin/restaurants-with-features')
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
      if (featRes.data?.success) setRestaurantsWithFeatures(featRes.data.restaurants);
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

  const handleToggleCustomSubdomain = async (restaurantId, currentEnabled, currentSlug) => {
    const nextState = !currentEnabled;
    const promptMsg = nextState
      ? `Enable ₹99/mo Custom Subdomain for Restaurant #${restaurantId}? Enter custom subdomain slug:`
      : `Disable Custom Subdomain for Restaurant #${restaurantId}? (Will revert to random string subdomain)`;
    const newSlug = window.prompt(promptMsg, currentSlug || '');
    if (newSlug === null) return;

    try {
      const res = await api.post(`/admin/superadmin/restaurant/${restaurantId}/toggle-custom-subdomain`, {
        enabled: nextState,
        custom_subdomain_slug: newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '')
      });
      if (res.data.success) {
        alert('✅ ' + res.data.message);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update subdomain status.');
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

  const handleToggleFeature = async (restaurantId, featureKey, currentValue) => {
    try {
      setControlsLoading(true);
      const nextValue = currentValue === 1 ? 0 : 1;
      
      setRestaurantsWithFeatures(prev => prev.map(r => {
        if (r.id === restaurantId) {
          const updated = { ...r.features, [featureKey]: nextValue };
          let active = 0;
          Object.values(updated).forEach(v => { if (v === 1) active++; });
          return { ...r, features: updated, active_features_count: active };
        }
        return r;
      }));

      if (selectedControlRest && selectedControlRest.id === restaurantId) {
        setSelectedControlRest(prev => {
          const updated = { ...prev.features, [featureKey]: nextValue };
          let active = 0;
          Object.values(updated).forEach(v => { if (v === 1) active++; });
          return { ...prev, features: updated, active_features_count: active };
        });
      }

      const res = await api.patch(`/superadmin/restaurants/${restaurantId}/features`, {
        [featureKey]: nextValue
      });

      if (res.data?.success) {
        setControlsFeedback({
          type: 'success',
          msg: `Updated ${featureKey.replace(/_/g, ' ')} to ${nextValue ? 'ON' : 'OFF'}!`
        });
        setTimeout(() => setControlsFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Failed to toggle feature:', err);
      setControlsFeedback({
        type: 'error',
        msg: err.response?.data?.message || 'Failed to toggle feature.'
      });
      setTimeout(() => setControlsFeedback(null), 4000);
      const refetch = await api.get('/superadmin/restaurants-with-features');
      if (refetch.data?.success) setRestaurantsWithFeatures(refetch.data.restaurants);
    } finally {
      setControlsLoading(false);
    }
  };

  const handleApplyPreset = async (restaurantId, presetName) => {
    try {
      setControlsLoading(true);
      const res = await api.post(`/superadmin/restaurants/${restaurantId}/features/preset`, {
        preset: presetName
      });
      if (res.data?.success) {
        const newFeats = res.data.features;
        let active = 0;
        Object.values(newFeats).forEach(v => { if (v === 1) active++; });

        setRestaurantsWithFeatures(prev => prev.map(r => {
          if (r.id === restaurantId) {
            return { ...r, features: newFeats, active_features_count: active };
          }
          return r;
        }));

        if (selectedControlRest && selectedControlRest.id === restaurantId) {
          setSelectedControlRest(prev => ({ ...prev, features: newFeats, active_features_count: active }));
        }

        setControlsFeedback({
          type: 'success',
          msg: `Applied "${presetName.replace(/_/g, ' ')}" preset successfully!`
        });
        setTimeout(() => setControlsFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Failed to apply preset:', err);
      setControlsFeedback({
        type: 'error',
        msg: err.response?.data?.message || 'Failed to apply preset.'
      });
      setTimeout(() => setControlsFeedback(null), 4000);
    } finally {
      setControlsLoading(false);
    }
  };

  const FEATURE_DEFINITIONS = [
    {
      key: 'online_ordering',
      name: 'Online Delivery Storefront',
      category: 'E-Commerce',
      icon: ShoppingBag,
      description: 'Customer online food ordering menu, cart checkout, and live order dispatch queue.'
    },
    {
      key: 'delivery_fleet',
      name: 'Delivery Drivers Fleet',
      category: 'Logistics',
      icon: Bike,
      description: 'Rider KYC verification, available orders pool, driver mobile portal & GPS route delivery.'
    },
    {
      key: 'rewards_wallet',
      name: 'Kratu Rewards & Wallet Engine',
      category: 'Loyalty & Fintech',
      icon: Gift,
      description: 'Customer loyalty wallets, automated "Up To" lucky jackpot engine, and 1-click mass airdrop campaigns.'
    },
    {
      key: 'table_dine_in',
      name: 'Table Layout & QR Code Menu',
      category: 'Dining Floor',
      icon: Grid2X2,
      description: 'Dining room floor tables layout, live occupancy status, and table digital QR code menus.'
    },
    {
      key: 'kds_kot',
      name: 'Kitchen Display System (KDS & KOT)',
      category: 'Kitchen Ops',
      icon: ChefHat,
      description: 'Live chef prep screens, automated KOT ticket dispatch, station routing, and prep timers.'
    },
    {
      key: 'pos_billing',
      name: 'POS Billing & GST Invoices',
      category: 'Cashier & POS',
      icon: Receipt,
      description: 'Cashier POS counter, table billing, split payments, cash/card receipt generation, and GST tax folio.'
    },
    {
      key: 'inventory_stock',
      name: 'Recipe Formulations & Raw Stocks',
      category: 'Supply Chain',
      icon: Boxes,
      description: 'Dish bill of materials (BOM), automatic raw ingredient deduction upon order, and low-stock alerts.'
    },
    {
      key: 'reports_analytics',
      name: 'Sales Reports & Analytics',
      category: 'Intelligence',
      icon: BarChart3,
      description: 'Daily revenue analytics, audit logs, order velocity breakdowns, and Owner Questions intelligence.'
    },
    {
      key: 'hotel_accommodations',
      name: 'Hotel Accommodations & Front Desk',
      category: 'Hospitality',
      icon: BedDouble,
      description: 'Room stays catalog, reservation inquiries, guest directory, check-in/out desk, and housekeeping.'
    },
    {
      key: 'custom_subdomain',
      name: 'Branded Custom Subdomain',
      category: 'Branding',
      icon: Globe,
      description: 'Dedicated branded subdomain (*.jattamkommerce.com) and custom URL routing.'
    }
  ];

  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  const toggleRestaurantStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setStatusUpdatingId(id);

    // Optimistic UI update so the badge and action update instantly
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, status: nextStatus } : r));

    try {
      const res = await api.patch(`/superadmin/restaurants/${id}/status`, { status: nextStatus });
      if (res.data?.success) {
        // Sync fresh list
        api.get('/superadmin/restaurants').then(rRes => {
          if (rRes.data?.success) setRestaurants(rRes.data.restaurants);
        }).catch(() => {});
      }
    } catch (err) {
      // Revert on error
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, status: currentStatus } : r));
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setStatusUpdatingId(null);
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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className={`p-3.5 rounded-2xl border shadow-xs transition-all ${pendingApprovals.length > 0 ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20' : 'bg-white border-[#D7E5E8]'
            }`}>
            <span className="text-[10px] font-bold uppercase text-amber-800 block">Pending Approvals</span>
            <span className="text-xl font-black text-amber-900 mt-1 block">{pendingApprovals.length}</span>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Total Hotels</span>
            <span className="text-xl font-black text-[#1F2937] mt-1 block">{restaurants.length}</span>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Active Subs</span>
            <span className="text-xl font-black text-emerald-700 mt-1 block">{activeSubsCount}</span>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Expired Subs</span>
            <span className="text-xl font-black text-rose-700 mt-1 block">{expiredSubsCount}</span>
          </div>
          <div 
            onClick={() => setActiveTab('admins')}
            className="bg-gradient-to-br from-white to-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 shadow-xs cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group"
            title="Click to view live Admin Earnings breakdown"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-600" /> Today's Money
              </span>
              <ArrowUpRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <span className="text-sm font-black text-emerald-950 mt-1 block truncate" title={formatInr(kpis?.todayRevenue)}>
              {formatInr(kpis?.todayRevenue)}
            </span>
            <span className="text-[9px] text-emerald-700 font-bold mt-0.5 block">View Admin Earnings ↗</span>
          </div>

          <div 
            onClick={() => setActiveTab('admins')}
            className="bg-gradient-to-br from-white to-purple-50/70 p-3.5 rounded-2xl border border-purple-200 shadow-xs cursor-pointer hover:border-purple-400 hover:shadow-md transition-all group"
            title="Click to view live Admin Earnings breakdown"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-purple-800 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-purple-600" /> Monthly (30d)
              </span>
              <ArrowUpRight className="w-3 h-3 text-purple-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <span className="text-sm font-black text-purple-950 mt-1 block truncate" title={formatInr(kpis?.monthlyRevenue)}>
              {formatInr(kpis?.monthlyRevenue)}
            </span>
            <span className="text-[9px] text-purple-700 font-bold mt-0.5 block">View Admin Earnings ↗</span>
          </div>

          <div 
            onClick={() => setActiveTab('admins')}
            className="bg-gradient-to-br from-white to-amber-50/70 p-3.5 rounded-2xl border border-amber-200 shadow-xs cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group"
            title="Click to view live Admin Earnings breakdown"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1">
                <Receipt className="w-3 h-3 text-amber-600" /> Lifetime Rev
              </span>
              <ArrowUpRight className="w-3 h-3 text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <span className="text-sm font-black text-amber-950 mt-1 block truncate" title={formatInr(kpis?.totalRevenue)}>
              {formatInr(kpis?.totalRevenue)}
            </span>
            <span className="text-[9px] text-amber-700 font-bold mt-0.5 block">View Admin Earnings ↗</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Total Orders</span>
            <span className="text-xl font-black text-[#3A7D7C] mt-1 block">{kpis?.totalOrders || orders.length}</span>
          </div>
        </div>

        {/* Tab Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-[#D7E5E8] shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'approvals'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                }`}
            >
              <UserCheck className="w-4 h-4" /> Pending Approvals ({pendingApprovals.length})
            </button>

            <button
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'admins' || activeTab === 'admin_earnings'
                  ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-400/40'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                }`}
            >
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>👑 Admin Earnings & Admins ({admins.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('restaurants')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'restaurants'
                  ? 'bg-[#3A7D7C] text-white shadow-2xs'
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
                }`}
            >
              <Store className="w-4 h-4" /> Restaurants ({restaurants.length})
            </button>

            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'subscriptions'
                  ? 'bg-[#3A7D7C] text-white shadow-2xs'
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
                }`}
            >
              <Sparkles className="w-4 h-4" /> Hotel Subscriptions ({hotelSubscriptions.length})
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'plans'
                  ? 'bg-[#3A7D7C] text-white shadow-2xs'
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
                }`}
            >
              <Tag className="w-4 h-4" /> SaaS Plans ({subscriptionPlans.length})
            </button>

            <button
              onClick={() => setActiveTab('subscription_payments')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'subscription_payments'
                  ? 'bg-[#3A7D7C] text-white shadow-2xs'
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
                }`}
            >
              <CreditCard className="w-4 h-4" /> SaaS Payments ({subscriptionPayments.length})
            </button>

            <button
              onClick={() => setActiveTab('controls')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'controls'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
                }`}
            >
              <Sliders className="w-4 h-4" /> Controls ({restaurantsWithFeatures.length})
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
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${item.payment_status === 'SUCCESS'
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
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${hs.is_trial || hs.subscription_type === 'TRIAL'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                {hs.is_trial || hs.subscription_type === 'TRIAL' ? 'FREE TRIAL' : 'PAID'}
                              </span>
                            </div>
                            {hs.plan_price > 0 && <span className="text-[11px] text-[#64748B] block mt-0.5">₹{hs.plan_price} / {hs.plan_duration_days}d</span>}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${hs.status === 'ACTIVE'
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
                            {hs.starts_at ? new Date(hs.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="p-4 text-[#64748B]">
                            {hs.expires_at ? new Date(hs.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
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
                                className={`px-2 py-1 rounded-lg font-bold text-[11px] border transition-colors cursor-pointer ${hs.status === 'ACTIVE'
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${plan.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
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
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${pay.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : pay.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                            {pay.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${pay.subscription_status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : pay.subscription_status === 'PENDING_APPROVAL'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                            {pay.subscription_status || 'PENDING'}
                          </span>
                        </td>
                        <td className="p-4 text-[#64748B] text-[11px] max-w-xs truncate">
                          {pay.offline_proof_note || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. RESTAURANTS TAB WITH LIVE MULTI-CHANNEL REVENUE TRACKING */}
        {activeTab === 'restaurants' && (() => {
          // Calculate Platform Totals across all restaurants
          const totals = restaurants.reduce((acc, r) => {
            const rev = r.revenue || {};
            const t = rev.today || {};
            const w = rev.weekly || {};
            const m = rev.monthly || {};
            const tot = rev.all_time || rev.total || {};

            acc.today_online += (t.online || 0);
            acc.today_offline += (t.offline || 0);
            acc.today_combined += (t.combined || 0);
            acc.today_orders += (t.total_orders || 0);

            acc.weekly_online += (w.online || 0);
            acc.weekly_offline += (w.offline || 0);
            acc.weekly_combined += (w.combined || 0);
            acc.weekly_orders += (w.total_orders || 0);

            acc.monthly_online += (m.online || 0);
            acc.monthly_offline += (m.offline || 0);
            acc.monthly_combined += (m.combined || 0);
            acc.monthly_orders += (m.total_orders || 0);

            acc.total_online += (tot.online || 0);
            acc.total_offline += (tot.offline || 0);
            acc.total_combined += (tot.combined || 0);
            acc.total_orders += (tot.total_orders || 0);

            return acc;
          }, {
            today_online: 0, today_offline: 0, today_combined: 0, today_orders: 0,
            weekly_online: 0, weekly_offline: 0, weekly_combined: 0, weekly_orders: 0,
            monthly_online: 0, monthly_offline: 0, monthly_combined: 0, monthly_orders: 0,
            total_online: 0, total_offline: 0, total_combined: 0, total_orders: 0
          });

          // Filter & Sort
          const filteredList = restaurants
            .filter(r => {
              if (!search) return true;
              const s = search.toLowerCase();
              return (
                (r.name && r.name.toLowerCase().includes(s)) ||
                (r.slug && r.slug.toLowerCase().includes(s)) ||
                (r.city && r.city.toLowerCase().includes(s)) ||
                (r.admin_names && r.admin_names.toLowerCase().includes(s)) ||
                (r.admin_emails && r.admin_emails.toLowerCase().includes(s)) ||
                (r.admin_phones && r.admin_phones.toLowerCase().includes(s)) ||
                (r.primary_admin?.name && r.primary_admin.name.toLowerCase().includes(s)) ||
                (r.primary_admin?.email && r.primary_admin.email.toLowerCase().includes(s)) ||
                (r.primary_admin?.phone && r.primary_admin.phone.toLowerCase().includes(s))
              );
            })
            .sort((a, b) => {
              const aRev = a.revenue || {};
              const bRev = b.revenue || {};
              if (revenueSortBy === 'highest_today') {
                const aVal = revenueChannelFilter === 'online' ? (aRev.today?.online || 0) : revenueChannelFilter === 'offline' ? (aRev.today?.offline || 0) : (aRev.today?.combined || 0);
                const bVal = revenueChannelFilter === 'online' ? (bRev.today?.online || 0) : revenueChannelFilter === 'offline' ? (bRev.today?.offline || 0) : (bRev.today?.combined || 0);
                return bVal - aVal;
              }
              if (revenueSortBy === 'highest_weekly') {
                const aVal = revenueChannelFilter === 'online' ? (aRev.weekly?.online || 0) : revenueChannelFilter === 'offline' ? (aRev.weekly?.offline || 0) : (aRev.weekly?.combined || 0);
                const bVal = revenueChannelFilter === 'online' ? (bRev.weekly?.online || 0) : revenueChannelFilter === 'offline' ? (bRev.weekly?.offline || 0) : (bRev.weekly?.combined || 0);
                return bVal - aVal;
              }
              if (revenueSortBy === 'highest_monthly') {
                const aVal = revenueChannelFilter === 'online' ? (aRev.monthly?.online || 0) : revenueChannelFilter === 'offline' ? (aRev.monthly?.offline || 0) : (aRev.monthly?.combined || 0);
                const bVal = revenueChannelFilter === 'online' ? (bRev.monthly?.online || 0) : revenueChannelFilter === 'offline' ? (bRev.monthly?.offline || 0) : (bRev.monthly?.combined || 0);
                return bVal - aVal;
              }
              if (revenueSortBy === 'most_orders') {
                const aOrders = (aRev.all_time?.total_orders || a.total_orders || 0);
                const bOrders = (bRev.all_time?.total_orders || b.total_orders || 0);
                return bOrders - aOrders;
              }
              if (revenueSortBy === 'name') {
                return (a.name || '').localeCompare(b.name || '');
              }
              // Default: highest_total
              const aVal = revenueChannelFilter === 'online' ? (aRev.all_time?.online || 0) : revenueChannelFilter === 'offline' ? (aRev.all_time?.offline || 0) : (aRev.all_time?.combined || 0);
              const bVal = revenueChannelFilter === 'online' ? (bRev.all_time?.online || 0) : revenueChannelFilter === 'offline' ? (bRev.all_time?.offline || 0) : (bRev.all_time?.combined || 0);
              return bVal - aVal;
            });

          return (
            <div className="space-y-6">
              {/* 1. LIVE MULTI-CHANNEL PLATFORM REVENUE SUMMARY BANNER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* TODAY */}
                <div className="bg-gradient-to-br from-white to-[#F0FDF4] p-5 rounded-3xl border border-emerald-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" /> Today's Earnings
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {totals.today_orders} orders
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatInr(totals.today_combined)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Online:</span>
                      <span className="font-bold text-slate-900">{formatInr(totals.today_online)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>Offline:</span>
                      <span className="font-bold text-slate-900">{formatInr(totals.today_offline)}</span>
                    </div>
                  </div>
                </div>

                {/* WEEKLY */}
                <div className="bg-gradient-to-br from-white to-[#F0F9FF] p-5 rounded-3xl border border-sky-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" /> Weekly (7 Days)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                      {totals.weekly_orders} orders
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatInr(totals.weekly_combined)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-sky-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Online:</span>
                      <span className="font-bold text-slate-900">{formatInr(totals.weekly_online)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>Offline:</span>
                      <span className="font-bold text-slate-900">{formatInr(totals.weekly_offline)}</span>
                    </div>
                  </div>
                </div>

                {/* MONTHLY */}
                <div className="bg-gradient-to-br from-white to-[#F5F3FF] p-5 rounded-3xl border border-purple-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-purple-600" /> Monthly (30 Days)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
                      {totals.monthly_orders} orders
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatInr(totals.monthly_combined)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Online:</span>
                      <span className="font-bold text-slate-900">{formatInr(totals.monthly_online)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>Offline:</span>
                      <span className="font-bold text-slate-900">{formatInr(totals.monthly_offline)}</span>
                    </div>
                  </div>
                </div>

                {/* ALL TIME LIFETIME */}
                <div className="bg-gradient-to-br from-white to-[#FFFBEB] p-5 rounded-3xl border border-amber-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-amber-600" /> Lifetime Platform Revenue
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                      {totals.total_orders} orders
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatInr(totals.total_combined)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Online:</span>
                      <span className="font-bold text-slate-900">{formatInr(totals.total_online)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>Offline:</span>
                      <span className="font-bold text-slate-900">{formatInr(totals.total_offline)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. RESTAURANTS DATA TABLE & CONTROLS */}
              <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
                <div className="p-6 border-b border-[#D7E5E8] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-[#1F2937]">Registered Restaurants & Money Making Metrics</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]">
                        {filteredList.length} of {restaurants.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Live financial performance breakdown per restaurant: Today, Weekly, Monthly across Online (Delivery/Web) & Offline (POS/Dine-In/KOT).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Channel Selector */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-[#D7E5E8]">
                      <button
                        type="button"
                        onClick={() => setRevenueChannelFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          revenueChannelFilter === 'all'
                            ? 'bg-[#3A7D7C] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Combined
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevenueChannelFilter('online')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          revenueChannelFilter === 'online'
                            ? 'bg-cyan-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🌐 Online Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevenueChannelFilter('offline')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          revenueChannelFilter === 'offline'
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🍽️ Offline Only
                      </button>
                    </div>

                    {/* Sort Selector */}
                    <div className="relative">
                      <select
                        value={revenueSortBy}
                        onChange={(e) => setRevenueSortBy(e.target.value)}
                        className="pl-3 pr-8 py-1.5 bg-white border border-[#D7E5E8] rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-2xs"
                      >
                        <option value="highest_total">Sort: Highest Lifetime</option>
                        <option value="highest_today">Sort: Highest Today</option>
                        <option value="highest_weekly">Sort: Highest Weekly</option>
                        <option value="highest_monthly">Sort: Highest Monthly</option>
                        <option value="most_orders">Sort: Most Orders</option>
                        <option value="name">Sort: Name (A-Z)</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setShowNewRestModal(true)}
                      className="px-3.5 py-1.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Restaurant
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1F2937]">
                    <thead className="bg-[#EAF4F7] text-[#1F2937] uppercase text-[10px] tracking-wider border-b border-[#D7E5E8]">
                      <tr>
                        <th className="p-4">Restaurant & Location</th>
                        <th className="p-4">Admin Owner</th>
                        <th className="p-4">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            <span>Today Money</span>
                          </div>
                        </th>
                        <th className="p-4">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sky-600" />
                            <span>Weekly (7d)</span>
                          </div>
                        </th>
                        <th className="p-4">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3 text-purple-600" />
                            <span>Monthly (30d)</span>
                          </div>
                        </th>
                        <th className="p-4">
                          <div className="flex items-center gap-1">
                            <Receipt className="w-3 h-3 text-amber-600" />
                            <span>Combined Lifetime</span>
                          </div>
                        </th>
                        <th className="p-4">Plan & Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D7E5E8]">
                      {filteredList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-xs text-[#64748B]">
                            <Store className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <span className="font-bold text-sm text-[#1F2937] block">No Restaurants Found</span>
                            <span>Try adjusting your search criteria or filter.</span>
                          </td>
                        </tr>
                      ) : (
                        filteredList.map(r => {
                          const matchedSub = hotelSubscriptions.find(s => s.restaurant_id === r.id);
                          const planName = matchedSub?.plan_name || (r.suite_mode === 'RESTAURANT_ONLY' ? 'Restaurant Only (Online + POS)' : 'Full Suite (Restaurant + Accommodation)');
                          
                          const rev = r.revenue || {};
                          const t = rev.today || {};
                          const w = rev.weekly || {};
                          const m = rev.monthly || {};
                          const tot = rev.all_time || rev.total || {};

                          const primaryAdmin = r.primary_admin || (r.admins_list && r.admins_list[0]) || null;
                          const otherAdminsCount = (r.admins_list ? r.admins_list.length : 0) - (primaryAdmin ? 1 : 0);

                          // Online vs Offline % for split bar
                          const totCombined = tot.combined || 0;
                          const onlinePct = totCombined > 0 ? Math.round(((tot.online || 0) / totCombined) * 100) : 50;
                          const offlinePct = 100 - onlinePct;

                          return (
                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* 1. RESTAURANT & CITY */}
                              <td className="p-4 font-bold text-[#1F2937]">
                                <div className="text-sm font-extrabold flex items-center gap-1.5">
                                  <span>{r.name}</span>
                                  {r.status === 'ACTIVE' && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Active"></span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#64748B] font-normal flex items-center gap-2 mt-0.5">
                                  <span>{r.city || 'India'}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] text-slate-400">ID #{r.id}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] text-[#3A7D7C]">{r.slug}</span>
                                </div>
                              </td>

                              {/* 2. ADMIN OWNER */}
                              <td className="p-4">
                                <div className="font-bold text-sm text-[#1F2937] flex items-center gap-1.5">
                                  <span>{primaryAdmin ? primaryAdmin.name : (r.admin_names || 'No Admin Assigned')}</span>
                                  {primaryAdmin && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      Owner
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 space-y-0.5">
                                  {(primaryAdmin?.phone || r.admin_phones) && (primaryAdmin?.phone || r.admin_phones) !== '-' && (
                                    <a
                                      href={`tel:${primaryAdmin?.phone || r.admin_phones}`}
                                      className="text-[11px] font-medium text-[#3A7D7C] hover:underline flex items-center gap-1 block"
                                    >
                                      <Phone className="w-3 h-3 text-[#3A7D7C]" />
                                      <span>{primaryAdmin?.phone || r.admin_phones}</span>
                                    </a>
                                  )}
                                  {(primaryAdmin?.email || r.admin_emails) && (
                                    <a
                                      href={`mailto:${primaryAdmin?.email || r.admin_emails}`}
                                      className="text-[11px] text-[#64748B] hover:text-[#1F2937] hover:underline flex items-center gap-1 block truncate max-w-[180px]"
                                      title={primaryAdmin?.email || r.admin_emails}
                                    >
                                      <Mail className="w-3 h-3 text-[#94A3B8]" />
                                      <span>{primaryAdmin?.email || r.admin_emails}</span>
                                    </a>
                                  )}
                                  {otherAdminsCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAdminDetail(r)}
                                      className="text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 mt-1 cursor-pointer flex items-center gap-1"
                                    >
                                      <Users className="w-2.5 h-2.5" /> +{otherAdminsCount} more staff/admins
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* 3. TODAY'S MONEY */}
                              <td className="p-4">
                                <div className="text-sm font-black text-slate-900">
                                  {revenueChannelFilter === 'online'
                                    ? formatInr(t.online)
                                    : revenueChannelFilter === 'offline'
                                    ? formatInr(t.offline)
                                    : formatInr(t.combined)}
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                                  <span className="font-medium text-cyan-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                    Online: <b className="font-bold">{formatInr(t.online)}</b> ({t.online_orders || 0})
                                  </span>
                                  <span className="font-medium text-emerald-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                    Offline: <b className="font-bold">{formatInr(t.offline)}</b> ({t.offline_orders || 0})
                                  </span>
                                </div>
                              </td>

                              {/* 4. WEEKLY (7d) */}
                              <td className="p-4">
                                <div className="text-sm font-black text-slate-900">
                                  {revenueChannelFilter === 'online'
                                    ? formatInr(w.online)
                                    : revenueChannelFilter === 'offline'
                                    ? formatInr(w.offline)
                                    : formatInr(w.combined)}
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                                  <span className="font-medium text-cyan-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                    Online: <b className="font-bold">{formatInr(w.online)}</b> ({w.online_orders || 0})
                                  </span>
                                  <span className="font-medium text-emerald-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                    Offline: <b className="font-bold">{formatInr(w.offline)}</b> ({w.offline_orders || 0})
                                  </span>
                                </div>
                              </td>

                              {/* 5. MONTHLY (30d) */}
                              <td className="p-4">
                                <div className="text-sm font-black text-slate-900">
                                  {revenueChannelFilter === 'online'
                                    ? formatInr(m.online)
                                    : revenueChannelFilter === 'offline'
                                    ? formatInr(m.offline)
                                    : formatInr(m.combined)}
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                                  <span className="font-medium text-cyan-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                    Online: <b className="font-bold">{formatInr(m.online)}</b> ({m.online_orders || 0})
                                  </span>
                                  <span className="font-medium text-emerald-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                    Offline: <b className="font-bold">{formatInr(m.offline)}</b> ({m.offline_orders || 0})
                                  </span>
                                </div>
                              </td>

                              {/* 6. COMBINED LIFETIME */}
                              <td className="p-4">
                                <div className="text-sm font-black text-slate-900">
                                  {formatInr(tot.combined)}
                                </div>
                                <div className="text-[10px] text-[#64748B] mt-0.5 font-medium">
                                  {tot.total_orders || 0} total orders
                                </div>
                                {/* Micro split bar */}
                                {totCombined > 0 && (
                                  <div className="w-28 mt-1.5">
                                    <div className="h-1.5 rounded-full bg-slate-100 flex overflow-hidden border border-slate-200" title={`Online: ${onlinePct}% | Offline: ${offlinePct}%`}>
                                      <div style={{ width: `${onlinePct}%` }} className="bg-cyan-500 h-full"></div>
                                      <div style={{ width: `${offlinePct}%` }} className="bg-emerald-500 h-full"></div>
                                    </div>
                                    <div className="flex justify-between text-[8px] text-[#94A3B8] font-mono mt-0.5">
                                      <span>Onl {onlinePct}%</span>
                                      <span>Off {offlinePct}%</span>
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* 7. PLAN & STATUS */}
                              <td className="p-4 space-y-1">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] border flex items-center gap-1 w-fit ${
                                  r.suite_mode === 'RESTAURANT_ONLY' || planName.includes('Restaurant Only')
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                }`}>
                                  {r.suite_mode === 'RESTAURANT_ONLY' || planName.includes('Restaurant Only')
                                    ? '🍽️ Restaurant Only'
                                    : '🍽️🏨 Full Suite'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] border ${
                                    r.status === 'ACTIVE'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-rose-50 text-rose-800 border-rose-200'
                                  }`}>
                                    {r.status}
                                  </span>
                                  <button
                                    onClick={() => handleToggleCustomSubdomain(r.id, r.custom_subdomain_enabled, r.custom_subdomain_slug || r.slug)}
                                    title={r.custom_subdomain_enabled ? 'Custom subdomain enabled' : 'Click to enable custom subdomain'}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                                      r.custom_subdomain_enabled
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    {r.custom_subdomain_enabled ? '⭐ Custom' : '🔒 Auto'}
                                  </button>
                                </div>
                              </td>

                              {/* 8. ACTIONS */}
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRestRevenue(r)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#3A7D7C] hover:bg-[#2F6665] text-white shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                                    title="View Detailed Revenue & Channel Analytics"
                                  >
                                    <BarChart3 className="w-3.5 h-3.5" />
                                    <span>Breakdown</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={statusUpdatingId === r.id}
                                    onClick={() => toggleRestaurantStatus(r.id, r.status)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                                      r.status === 'ACTIVE'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                    } ${statusUpdatingId === r.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {statusUpdatingId === r.id
                                      ? '...'
                                      : r.status === 'ACTIVE'
                                      ? 'Suspend'
                                      : 'Activate'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 6. ADMINS & RESTAURANT EARNINGS INTELLIGENCE TAB */}
        {(activeTab === 'admins' || activeTab === 'admin_earnings') && (() => {
          // 1. Calculate Aggregate Earnings across all admins
          const adminTotals = admins.reduce((acc, a) => {
            const rev = a.revenue || {};
            const t = rev.today || {};
            const w = rev.weekly || {};
            const m = rev.monthly || {};
            const tot = rev.all_time || {};

            acc.today_online += (t.online || 0);
            acc.today_offline += (t.offline || 0);
            acc.today_combined += (t.combined || 0);
            acc.today_orders += (t.total_orders || 0);

            acc.weekly_online += (w.online || 0);
            acc.weekly_offline += (w.offline || 0);
            acc.weekly_combined += (w.combined || 0);
            acc.weekly_orders += (w.total_orders || 0);

            acc.monthly_online += (m.online || 0);
            acc.monthly_offline += (m.offline || 0);
            acc.monthly_combined += (m.combined || 0);
            acc.monthly_orders += (m.total_orders || 0);

            acc.total_online += (tot.online || 0);
            acc.total_offline += (tot.offline || 0);
            acc.total_combined += (tot.combined || 0);
            acc.total_orders += (tot.total_orders || 0);

            return acc;
          }, {
            today_online: 0, today_offline: 0, today_combined: 0, today_orders: 0,
            weekly_online: 0, weekly_offline: 0, weekly_combined: 0, weekly_orders: 0,
            monthly_online: 0, monthly_offline: 0, monthly_combined: 0, monthly_orders: 0,
            total_online: 0, total_offline: 0, total_combined: 0, total_orders: 0
          });

          // 2. Filter & Sort admins list
          const filteredAdmins = admins
            .filter(a => {
              if (!search) return true;
              const s = search.toLowerCase();
              return (
                (a.name && a.name.toLowerCase().includes(s)) ||
                (a.email && a.email.toLowerCase().includes(s)) ||
                (a.phone && a.phone.toLowerCase().includes(s)) ||
                (a.restaurant_name && a.restaurant_name.toLowerCase().includes(s)) ||
                (a.restaurant_names && a.restaurant_names.toLowerCase().includes(s)) ||
                (a.restaurant_slugs && a.restaurant_slugs.toLowerCase().includes(s)) ||
                (a.role && a.role.toLowerCase().includes(s))
              );
            })
            .sort((a, b) => {
              const aRev = a.revenue || {};
              const bRev = b.revenue || {};
              if (adminRevenueSortBy === 'highest_today') {
                const aVal = adminRevenueChannelFilter === 'online' ? (aRev.today?.online || 0) : adminRevenueChannelFilter === 'offline' ? (aRev.today?.offline || 0) : (aRev.today?.combined || 0);
                const bVal = adminRevenueChannelFilter === 'online' ? (bRev.today?.online || 0) : adminRevenueChannelFilter === 'offline' ? (bRev.today?.offline || 0) : (bRev.today?.combined || 0);
                return bVal - aVal;
              }
              if (adminRevenueSortBy === 'highest_weekly') {
                const aVal = adminRevenueChannelFilter === 'online' ? (aRev.weekly?.online || 0) : adminRevenueChannelFilter === 'offline' ? (aRev.weekly?.offline || 0) : (aRev.weekly?.combined || 0);
                const bVal = adminRevenueChannelFilter === 'online' ? (bRev.weekly?.online || 0) : adminRevenueChannelFilter === 'offline' ? (bRev.weekly?.offline || 0) : (bRev.weekly?.combined || 0);
                return bVal - aVal;
              }
              if (adminRevenueSortBy === 'highest_monthly') {
                const aVal = adminRevenueChannelFilter === 'online' ? (aRev.monthly?.online || 0) : adminRevenueChannelFilter === 'offline' ? (aRev.monthly?.offline || 0) : (aRev.monthly?.combined || 0);
                const bVal = adminRevenueChannelFilter === 'online' ? (bRev.monthly?.online || 0) : adminRevenueChannelFilter === 'offline' ? (bRev.monthly?.offline || 0) : (bRev.monthly?.combined || 0);
                return bVal - aVal;
              }
              if (adminRevenueSortBy === 'most_orders') {
                const aOrders = (aRev.all_time?.total_orders || a.total_orders || 0);
                const bOrders = (bRev.all_time?.total_orders || b.total_orders || 0);
                return bOrders - aOrders;
              }
              if (adminRevenueSortBy === 'name') {
                return (a.name || '').localeCompare(b.name || '');
              }
              // Default: highest_total
              const aVal = adminRevenueChannelFilter === 'online' ? (aRev.all_time?.online || 0) : adminRevenueChannelFilter === 'offline' ? (aRev.all_time?.offline || 0) : (aRev.all_time?.combined || 0);
              const bVal = adminRevenueChannelFilter === 'online' ? (bRev.all_time?.online || 0) : adminRevenueChannelFilter === 'offline' ? (bRev.all_time?.offline || 0) : (bRev.all_time?.combined || 0);
              return bVal - aVal;
            });

          return (
            <div className="space-y-6">
              {/* TOP MASTER ADMIN FINANCIAL BANNER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* TODAY */}
                <div className="bg-gradient-to-br from-white to-[#F0FDF4] p-5 rounded-3xl border border-emerald-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" /> Today's Admin Money
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {adminTotals.today_orders} orders
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatInr(adminTotals.today_combined)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Online:</span>
                      <span className="font-bold text-slate-900">{formatInr(adminTotals.today_online)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>Offline:</span>
                      <span className="font-bold text-slate-900">{formatInr(adminTotals.today_offline)}</span>
                    </div>
                  </div>
                </div>

                {/* WEEKLY */}
                <div className="bg-gradient-to-br from-white to-[#F0F9FF] p-5 rounded-3xl border border-sky-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" /> Weekly (7 Days)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                      {adminTotals.weekly_orders} orders
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatInr(adminTotals.weekly_combined)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-sky-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Online:</span>
                      <span className="font-bold text-slate-900">{formatInr(adminTotals.weekly_online)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>Offline:</span>
                      <span className="font-bold text-slate-900">{formatInr(adminTotals.weekly_offline)}</span>
                    </div>
                  </div>
                </div>

                {/* MONTHLY */}
                <div className="bg-gradient-to-br from-white to-[#F5F3FF] p-5 rounded-3xl border border-purple-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-purple-600" /> Monthly (30 Days)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
                      {adminTotals.monthly_orders} orders
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatInr(adminTotals.monthly_combined)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Online:</span>
                      <span className="font-bold text-slate-900">{formatInr(adminTotals.monthly_online)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>Offline:</span>
                      <span className="font-bold text-slate-900">{formatInr(adminTotals.monthly_offline)}</span>
                    </div>
                  </div>
                </div>

                {/* ALL TIME LIFETIME */}
                <div className="bg-gradient-to-br from-white to-[#FFFBEB] p-5 rounded-3xl border border-amber-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-amber-600" /> Total Admin Lifetime Rev
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                      {adminTotals.total_orders} orders
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatInr(adminTotals.total_combined)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                      <span>Online:</span>
                      <span className="font-bold text-slate-900">{formatInr(adminTotals.total_online)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>Offline:</span>
                      <span className="font-bold text-slate-900">{formatInr(adminTotals.total_offline)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DATA TABLE CONTAINER */}
              <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
                <div className="p-6 border-b border-[#D7E5E8] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-[#1F2937]">👑 Admins & Restaurant Earnings Breakdown</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {filteredAdmins.length} of {admins.length} Admins
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Live tracking of money made by each restaurant administrator across <b>Online Storefront</b> and <b>Offline POS / Dine-In / KOT</b>.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Channel Selector */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-[#D7E5E8]">
                      <button
                        type="button"
                        onClick={() => setAdminRevenueChannelFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          adminRevenueChannelFilter === 'all'
                            ? 'bg-[#3A7D7C] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Combined
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminRevenueChannelFilter('online')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          adminRevenueChannelFilter === 'online'
                            ? 'bg-cyan-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🌐 Online Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminRevenueChannelFilter('offline')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          adminRevenueChannelFilter === 'offline'
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🍽️ Offline Only
                      </button>
                    </div>

                    {/* Sort Selector */}
                    <div className="relative">
                      <select
                        value={adminRevenueSortBy}
                        onChange={(e) => setAdminRevenueSortBy(e.target.value)}
                        className="pl-3 pr-8 py-1.5 bg-white border border-[#D7E5E8] rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-2xs"
                      >
                        <option value="highest_total">Sort: Highest Lifetime</option>
                        <option value="highest_today">Sort: Highest Today</option>
                        <option value="highest_weekly">Sort: Highest Weekly</option>
                        <option value="highest_monthly">Sort: Highest Monthly</option>
                        <option value="most_orders">Sort: Most Orders</option>
                        <option value="name">Sort: Name (A-Z)</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                    >
                      <Store className="w-3.5 h-3.5" /> Assign Admin
                    </button>

                    <button
                      onClick={() => setShowNewAdminModal(true)}
                      className="px-3.5 py-1.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create Admin
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1F2937]">
                    <thead className="bg-[#EAF4F7] text-[#1F2937] uppercase text-[10px] tracking-wider border-b border-[#D7E5E8]">
                      <tr>
                        <th className="p-4">Admin Profile</th>
                        <th className="p-4">Assigned Restaurant(s)</th>
                        <th className="p-4">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            <span>Today Money</span>
                          </div>
                        </th>
                        <th className="p-4">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sky-600" />
                            <span>Weekly (7d)</span>
                          </div>
                        </th>
                        <th className="p-4">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3 text-purple-600" />
                            <span>Monthly (30d)</span>
                          </div>
                        </th>
                        <th className="p-4">
                          <div className="flex items-center gap-1">
                            <Receipt className="w-3 h-3 text-amber-600" />
                            <span>Combined Lifetime</span>
                          </div>
                        </th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D7E5E8]">
                      {filteredAdmins.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-xs text-[#64748B]">
                            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <span className="font-bold text-sm text-[#1F2937] block">No Admins Found</span>
                            <span>Try adjusting your search criteria or filter.</span>
                          </td>
                        </tr>
                      ) : (
                        filteredAdmins.map(a => {
                          const rev = a.revenue || {};
                          const t = rev.today || {};
                          const w = rev.weekly || {};
                          const m = rev.monthly || {};
                          const tot = rev.all_time || {};

                          const totCombined = tot.combined || 0;
                          const onlinePct = totCombined > 0 ? Math.round(((tot.online || 0) / totCombined) * 100) : 50;
                          const offlinePct = 100 - onlinePct;

                          const myRests = a.restaurants || [];

                          return (
                            <tr key={a.user_id} className="hover:bg-slate-50/80 transition-colors">
                              {/* 1. ADMIN PROFILE */}
                              <td className="p-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-[#3A7D7C] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                                    {(a.name || 'A').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-sm text-[#1F2937] flex items-center gap-1.5">
                                      <span>{a.name}</span>
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                        #{a.user_id}
                                      </span>
                                    </div>
                                    <div className="mt-1 space-y-0.5">
                                      {a.phone && (
                                        <a
                                          href={`tel:${a.phone}`}
                                          className="text-[11px] font-medium text-[#3A7D7C] hover:underline flex items-center gap-1"
                                        >
                                          <Phone className="w-3 h-3 text-[#3A7D7C]" />
                                          <span>{a.phone}</span>
                                        </a>
                                      )}
                                      {a.email && (
                                        <a
                                          href={`mailto:${a.email}`}
                                          className="text-[11px] text-[#64748B] hover:text-[#1F2937] hover:underline flex items-center gap-1 truncate max-w-[190px]"
                                          title={a.email}
                                        >
                                          <Mail className="w-3 h-3 text-[#94A3B8]" />
                                          <span>{a.email}</span>
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. MANAGED RESTAURANT(S) */}
                              <td className="p-4">
                                {myRests.length === 0 ? (
                                  <div className="text-slate-400 font-semibold italic text-xs">
                                    Unassigned
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {myRests.slice(0, 2).map(r => (
                                      <div key={r.id} className="flex items-center gap-1.5">
                                        <Link
                                          to={`/r/${r.slug}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-bold text-xs text-[#1F2937] hover:text-[#3A7D7C] hover:underline flex items-center gap-1"
                                        >
                                          <span>{r.name}</span>
                                          <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                                        </Link>
                                        {r.is_primary === 1 && (
                                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                            Owner
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {myRests.length > 2 && (
                                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 inline-block">
                                        +{myRests.length - 2} more hotels
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* 3. TODAY'S MONEY */}
                              <td className="p-4">
                                <div className="text-sm font-black text-slate-900">
                                  {adminRevenueChannelFilter === 'online'
                                    ? formatInr(t.online)
                                    : adminRevenueChannelFilter === 'offline'
                                    ? formatInr(t.offline)
                                    : formatInr(t.combined)}
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                                  <span className="font-medium text-cyan-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                    Online: <b className="font-bold">{formatInr(t.online)}</b> ({t.online_orders || 0})
                                  </span>
                                  <span className="font-medium text-emerald-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                    Offline: <b className="font-bold">{formatInr(t.offline)}</b> ({t.offline_orders || 0})
                                  </span>
                                </div>
                              </td>

                              {/* 4. WEEKLY (7d) */}
                              <td className="p-4">
                                <div className="text-sm font-black text-slate-900">
                                  {adminRevenueChannelFilter === 'online'
                                    ? formatInr(w.online)
                                    : adminRevenueChannelFilter === 'offline'
                                    ? formatInr(w.offline)
                                    : formatInr(w.combined)}
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                                  <span className="font-medium text-cyan-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                    Online: <b className="font-bold">{formatInr(w.online)}</b> ({w.online_orders || 0})
                                  </span>
                                  <span className="font-medium text-emerald-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                    Offline: <b className="font-bold">{formatInr(w.offline)}</b> ({w.offline_orders || 0})
                                  </span>
                                </div>
                              </td>

                              {/* 5. MONTHLY (30d) */}
                              <td className="p-4">
                                <div className="text-sm font-black text-slate-900">
                                  {adminRevenueChannelFilter === 'online'
                                    ? formatInr(m.online)
                                    : adminRevenueChannelFilter === 'offline'
                                    ? formatInr(m.offline)
                                    : formatInr(m.combined)}
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
                                  <span className="font-medium text-cyan-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                    Online: <b className="font-bold">{formatInr(m.online)}</b> ({m.online_orders || 0})
                                  </span>
                                  <span className="font-medium text-emerald-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                    Offline: <b className="font-bold">{formatInr(m.offline)}</b> ({m.offline_orders || 0})
                                  </span>
                                </div>
                              </td>

                              {/* 6. COMBINED LIFETIME */}
                              <td className="p-4">
                                <div className="text-sm font-black text-slate-900">
                                  {formatInr(tot.combined)}
                                </div>
                                <div className="text-[10px] text-[#64748B] mt-0.5 font-medium">
                                  {tot.total_orders || 0} total orders
                                </div>
                                {totCombined > 0 && (
                                  <div className="w-28 mt-1.5">
                                    <div className="h-1.5 rounded-full bg-slate-100 flex overflow-hidden border border-slate-200" title={`Online: ${onlinePct}% | Offline: ${offlinePct}%`}>
                                      <div style={{ width: `${onlinePct}%` }} className="bg-cyan-500 h-full"></div>
                                      <div style={{ width: `${offlinePct}%` }} className="bg-emerald-500 h-full"></div>
                                    </div>
                                    <div className="flex justify-between text-[8px] text-[#94A3B8] font-mono mt-0.5">
                                      <span>Onl {onlinePct}%</span>
                                      <span>Off {offlinePct}%</span>
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* 7. ACTIONS */}
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAdminRevenue(a)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#3A7D7C] hover:bg-[#2F6665] text-white shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                                    title="View Granular Admin Financial Dossier"
                                  >
                                    <BarChart3 className="w-3.5 h-3.5" />
                                    <span>Breakdown</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={adminStatusUpdatingId === a.user_id}
                                    onClick={() => toggleAdminStatus(a.user_id, a.status)}
                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                      a.status === 'ACTIVE'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    } ${adminStatusUpdatingId === a.user_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {adminStatusUpdatingId === a.user_id
                                      ? '...'
                                      : a.status === 'ACTIVE'
                                      ? 'Disable'
                                      : 'Enable'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

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
                  onChange={e => setAssignPlanForm({ ...assignPlanForm, restaurant_id: e.target.value })}
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
                  onChange={e => setAssignPlanForm({ ...assignPlanForm, plan_id: e.target.value })}
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
                  onChange={e => setAssignPlanForm({ ...assignPlanForm, duration_days: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Assigned on special promo"
                  value={assignPlanForm.notes}
                  onChange={e => setAssignPlanForm({ ...assignPlanForm, notes: e.target.value })}
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

      {/* 9. RESTAURANT FEATURE CONTROLS TAB */}
      {activeTab === 'controls' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-purple-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-400/20 text-purple-200 border border-purple-400/30">
                  Super Admin Switchboard
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Real-Time Sync
                </span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight">Restaurant Feature Controls & Modular Provisioning</h2>
              <p className="text-xs text-purple-200 max-w-2xl leading-relaxed">
                Turn modules ON or OFF on a per-restaurant basis. When toggled OFF, that module is completely hidden and disabled in the restaurant admin portal without affecting other restaurants.
              </p>
            </div>

            {controlsFeedback && (
              <div className={`px-4 py-2 rounded-xl text-xs font-bold border animate-in fade-in flex items-center gap-2 shrink-0 ${
                controlsFeedback.type === 'success' 
                  ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500' 
                  : 'bg-rose-950/80 text-rose-200 border-rose-500'
              }`}>
                {controlsFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span>{controlsFeedback.msg}</span>
              </div>
            )}
          </div>

          {/* Restaurant List with Active Feature Stats */}
          <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-[#D7E5E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-700" />
                <h3 className="font-extrabold text-sm sm:text-base text-[#1F2937]">Restaurant Provisioning Matrix</h3>
                <span className="text-xs text-[#64748B] font-bold">({restaurantsWithFeatures.length} Total)</span>
              </div>
              <span className="text-xs text-[#64748B] font-medium">Click "Configure Controls" to toggle features for any restaurant</span>
            </div>

            <div className="divide-y divide-[#D7E5E8]">
              {restaurantsWithFeatures
                .filter(r => 
                  r.name?.toLowerCase().includes(search.toLowerCase()) || 
                  r.slug?.toLowerCase().includes(search.toLowerCase())
                )
                .map(r => {
                  const activeCount = r.active_features_count || 0;
                  const isAllActive = activeCount === 10;
                  const isNoneActive = activeCount === 0;

                  return (
                    <div 
                      key={r.id} 
                      className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-black bg-slate-100 text-slate-700 border border-slate-200">
                            ID #{r.id}
                          </span>
                          <h4 className="font-bold text-sm sm:text-base text-[#1F2937] truncate">{r.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            r.status === 'ACTIVE' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] font-mono flex items-center gap-2">
                          <span>Slug: <strong className="text-purple-700">{r.slug}</strong></span>
                          {r.phone && <span>• Phone: {r.phone}</span>}
                          {r.email && <span>• {r.email}</span>}
                        </p>
                      </div>

                      {/* Feature Status Badges & Quick Counter */}
                      <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                              isAllActive
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : isNoneActive
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                              <Sliders className="w-3.5 h-3.5" />
                              {activeCount} / 10 Features Active
                            </span>
                          </div>
                          <span className="text-[10px] text-[#64748B] block mt-0.5 font-medium">
                            {isAllActive ? 'Full Suite Enabled' : isNoneActive ? 'All Features Suspended' : 'Custom Modular Setup'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedControlRest(r)}
                          className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
                        >
                          <Sliders className="w-4 h-4" />
                          <span>Configure Controls</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FEATURE CONTROLS CONSOLE */}
      {selectedControlRest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#D7E5E8] bg-slate-50/80 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
                    Feature Switchboard
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                    ID #{selectedControlRest.id}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
                    {selectedControlRest.active_features_count} / 10 Active
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#1F2937]">
                  {selectedControlRest.name}
                </h3>
                <p className="text-xs text-[#64748B] font-mono">
                  Slug: <strong className="text-purple-700">{selectedControlRest.slug}</strong> • Live Real-Time Provisioning
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedControlRest(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Presets Bar */}
            <div className="px-5 sm:px-6 py-3 bg-purple-50/50 border-b border-[#D7E5E8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-purple-950 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                1-Click Presets:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={controlsLoading}
                  onClick={() => handleApplyPreset(selectedControlRest.id, 'full')}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-extrabold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  🟢 Full Suite (All 10 ON)
                </button>
                <button
                  type="button"
                  disabled={controlsLoading}
                  onClick={() => handleApplyPreset(selectedControlRest.id, 'food_dining_only')}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-extrabold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  🍽️ Food & Dining (No Rooms)
                </button>
                <button
                  type="button"
                  disabled={controlsLoading}
                  onClick={() => handleApplyPreset(selectedControlRest.id, 'cloud_kitchen')}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-extrabold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  🛵 Cloud Kitchen (Delivery Only)
                </button>
                <button
                  type="button"
                  disabled={controlsLoading}
                  onClick={() => handleApplyPreset(selectedControlRest.id, 'disable_all')}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-extrabold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  🛑 Disable All
                </button>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {FEATURE_DEFINITIONS.map(feat => {
                const Icon = feat.icon;
                const isEnabled = selectedControlRest.features?.[feat.key] === 1;

                return (
                  <div
                    key={feat.key}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-start justify-between gap-3 ${
                      isEnabled
                        ? 'border-emerald-200 bg-emerald-50/30 shadow-xs'
                        : 'border-slate-200 bg-slate-50/60 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isEnabled 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-slate-200 text-slate-500 border-slate-300'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-xs sm:text-sm text-[#1F2937] leading-tight">
                            {feat.name}
                          </h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            isEnabled 
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                              : 'bg-slate-200 text-slate-700 border-slate-300'
                          }`}>
                            {feat.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] leading-snug">
                          {feat.description}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        disabled={controlsLoading}
                        onClick={() => handleToggleFeature(selectedControlRest.id, feat.key, isEnabled ? 1 : 0)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                          isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                        } ${controlsLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={`Click to ${isEnabled ? 'Disable' : 'Enable'} ${feat.name}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className={`text-[10px] font-black ${isEnabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {isEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-[#D7E5E8] bg-slate-50/80 flex items-center justify-between">
              <span className="text-xs text-[#64748B] font-medium hidden sm:inline">
                Changes take effect instantly for this restaurant's admin portal.
              </span>
              <button
                type="button"
                onClick={() => setSelectedControlRest(null)}
                className="px-6 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer ml-auto"
              >
                Done / Close
              </button>
            </div>
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
                  onChange={e => setExtendForm({ ...extendForm, extra_days: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Courtesy bonus extension"
                  value={extendForm.notes}
                  onChange={e => setExtendForm({ ...extendForm, notes: e.target.value })}
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
                  onChange={e => setNewPlanForm({ ...newPlanForm, name: e.target.value })}
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
                    onChange={e => setNewPlanForm({ ...newPlanForm, price: e.target.value })}
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
                    onChange={e => setNewPlanForm({ ...newPlanForm, duration_days: e.target.value })}
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
                  onChange={e => setNewPlanForm({ ...newPlanForm, description: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Features (One feature per line)</label>
                <textarea
                  rows={4}
                  placeholder="Kitchen Display System&#10;Table QR Menus&#10;Online Storefront"
                  value={newPlanForm.featuresText}
                  onChange={e => setNewPlanForm({ ...newPlanForm, featuresText: e.target.value })}
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
                  onChange={e => setNewRestForm({ ...newRestForm, name: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Phone</label>
                  <input
                    type="text"
                    value={newRestForm.phone}
                    onChange={e => setNewRestForm({ ...newRestForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={newRestForm.email}
                    onChange={e => setNewRestForm({ ...newRestForm, email: e.target.value })}
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
                  onChange={e => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newAdminForm.email}
                  onChange={e => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newAdminForm.password}
                  onChange={e => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={newAdminForm.phone}
                  onChange={e => setNewAdminForm({ ...newAdminForm, phone: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Assign to Restaurant</label>
                <select
                  value={newAdminForm.restaurant_id}
                  onChange={e => setNewAdminForm({ ...newAdminForm, restaurant_id: e.target.value })}
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

      {/* MODAL: RESTAURANT REVENUE & MULTI-CHANNEL FINANCIAL BREAKDOWN */}
      {selectedRestRevenue && (() => {
        const rev = selectedRestRevenue.revenue || {};
        const t = rev.today || {};
        const w = rev.weekly || {};
        const m = rev.monthly || {};
        const tot = rev.all_time || rev.total || {};

        const totCombined = tot.combined || 0;
        const onlineTot = tot.online || 0;
        const offlineTot = tot.offline || 0;
        const onlineOrdersTot = tot.online_orders || 0;
        const offlineOrdersTot = tot.offline_orders || 0;

        const onlinePct = totCombined > 0 ? Math.round((onlineTot / totCombined) * 100) : 50;
        const offlinePct = 100 - onlinePct;

        const onlineAov = onlineOrdersTot > 0 ? (onlineTot / onlineOrdersTot) : 0;
        const offlineAov = offlineOrdersTot > 0 ? (offlineTot / offlineOrdersTot) : 0;

        const primaryAdmin = selectedRestRevenue.primary_admin || (selectedRestRevenue.admins_list && selectedRestRevenue.admins_list[0]) || null;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full border border-[#D7E5E8] shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-[#D7E5E8] flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-[#1F2937]">{selectedRestRevenue.name}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      selectedRestRevenue.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {selectedRestRevenue.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#64748B] mt-1 font-medium">
                    <span>{selectedRestRevenue.city || 'India'}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-500">ID #{selectedRestRevenue.id}</span>
                    <span>•</span>
                    <span className="font-mono text-[#3A7D7C]">{selectedRestRevenue.slug}</span>
                    {selectedRestRevenue.address && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-xs">{selectedRestRevenue.address}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRestRevenue(null)}
                  className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Admin Profile Card */}
                <div className="bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-white p-5 rounded-2xl border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-black text-lg shadow-sm">
                      {primaryAdmin ? primaryAdmin.name.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-[#1F2937]">
                          {primaryAdmin ? primaryAdmin.name : (selectedRestRevenue.admin_names || 'No Admin Assigned')}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {primaryAdmin?.role || 'Restaurant Admin Owner'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] mt-1">
                        {(primaryAdmin?.phone || selectedRestRevenue.admin_phones) && (primaryAdmin?.phone || selectedRestRevenue.admin_phones) !== '-' && (
                          <a
                            href={`tel:${primaryAdmin?.phone || selectedRestRevenue.admin_phones}`}
                            className="font-bold text-[#3A7D7C] hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5" /> {primaryAdmin?.phone || selectedRestRevenue.admin_phones}
                          </a>
                        )}
                        {(primaryAdmin?.email || selectedRestRevenue.admin_emails) && (
                          <a
                            href={`mailto:${primaryAdmin?.email || selectedRestRevenue.admin_emails}`}
                            className="text-[#64748B] hover:text-[#1F2937] hover:underline flex items-center gap-1"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-400" /> {primaryAdmin?.email || selectedRestRevenue.admin_emails}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedRestRevenue.admins_list && selectedRestRevenue.admins_list.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedAdminDetail(selectedRestRevenue)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-teal-200 text-[#3A7D7C] font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>View All {selectedRestRevenue.admins_list.length} Admins & Staff</span>
                    </button>
                  )}
                </div>

                {/* 2. 4 Performance Timeframes Matrix */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#3A7D7C]" />
                    <span>Multi-Period Revenue & Money Made</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Today */}
                    <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 uppercase mb-1">
                        <span>Today</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px]">
                          {t.total_orders || 0} orders
                        </span>
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {formatInr(t.combined)}
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> Online:
                          </span>
                          <span className="font-bold text-slate-900">{formatInr(t.online)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Offline:
                          </span>
                          <span className="font-bold text-slate-900">{formatInr(t.offline)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Weekly */}
                    <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-sky-800 uppercase mb-1">
                        <span>Weekly (7d)</span>
                        <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 text-[10px]">
                          {w.total_orders || 0} orders
                        </span>
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {formatInr(w.combined)}
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> Online:
                          </span>
                          <span className="font-bold text-slate-900">{formatInr(w.online)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Offline:
                          </span>
                          <span className="font-bold text-slate-900">{formatInr(w.offline)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Monthly */}
                    <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-purple-800 uppercase mb-1">
                        <span>Monthly (30d)</span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px]">
                          {m.total_orders || 0} orders
                        </span>
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {formatInr(m.combined)}
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> Online:
                          </span>
                          <span className="font-bold text-slate-900">{formatInr(m.online)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Offline:
                          </span>
                          <span className="font-bold text-slate-900">{formatInr(m.offline)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lifetime */}
                    <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 uppercase mb-1">
                        <span>Lifetime Total</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px]">
                          {tot.total_orders || 0} orders
                        </span>
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {formatInr(tot.combined)}
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> Online:
                          </span>
                          <span className="font-bold text-slate-900">{formatInr(tot.online)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Offline:
                          </span>
                          <span className="font-bold text-slate-900">{formatInr(tot.offline)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Deep-Dive Channel Comparison Cards */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-[#3A7D7C]" />
                    <span>Channel Comparison & Split</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Online Channel */}
                    <div className="bg-cyan-50/40 p-5 rounded-2xl border border-cyan-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold text-xs">
                            🌐
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-[#1F2937]">Online Channel</div>
                            <div className="text-[10px] text-[#64748B]">Customer Website Ordering & Delivery</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-cyan-100 text-cyan-900 border border-cyan-300">
                          {onlinePct}% Share
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-white p-3 rounded-xl border border-cyan-100 shadow-2xs">
                          <span className="text-[10px] font-bold text-[#64748B] block">Total Online Revenue</span>
                          <span className="text-base font-black text-cyan-900 mt-0.5 block">{formatInr(onlineTot)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-cyan-100 shadow-2xs">
                          <span className="text-[10px] font-bold text-[#64748B] block">Online Orders Count</span>
                          <span className="text-base font-black text-slate-900 mt-0.5 block">{onlineOrdersTot} orders</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-cyan-100 shadow-2xs">
                          <span className="text-[10px] font-bold text-[#64748B] block">Avg Order Value (AOV)</span>
                          <span className="text-base font-black text-slate-900 mt-0.5 block">{formatInr(onlineAov)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-cyan-100 shadow-2xs">
                          <span className="text-[10px] font-bold text-[#64748B] block">Today's Online Sales</span>
                          <span className="text-base font-black text-emerald-700 mt-0.5 block">{formatInr(t.online)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Offline Channel */}
                    <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                            🍽️
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-[#1F2937]">Offline Channel</div>
                            <div className="text-[10px] text-[#64748B]">POS / Dine-In / Table QR / Room Service</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                          {offlinePct}% Share
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                          <span className="text-[10px] font-bold text-[#64748B] block">Total Offline Revenue</span>
                          <span className="text-base font-black text-emerald-900 mt-0.5 block">{formatInr(offlineTot)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                          <span className="text-[10px] font-bold text-[#64748B] block">Offline Orders Count</span>
                          <span className="text-base font-black text-slate-900 mt-0.5 block">{offlineOrdersTot} orders</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                          <span className="text-[10px] font-bold text-[#64748B] block">Avg Order Value (AOV)</span>
                          <span className="text-base font-black text-slate-900 mt-0.5 block">{formatInr(offlineAov)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                          <span className="text-[10px] font-bold text-[#64748B] block">Today's Offline Sales</span>
                          <span className="text-base font-black text-emerald-700 mt-0.5 block">{formatInr(t.offline)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Split Ratio Bar */}
                  {totCombined > 0 && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-4 space-y-2">
                      <div className="flex justify-between text-xs font-extrabold">
                        <span className="text-cyan-800">Online Sales: {onlinePct}% ({formatInr(onlineTot)})</span>
                        <span className="text-emerald-800">Offline Sales: {offlinePct}% ({formatInr(offlineTot)})</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 flex overflow-hidden border border-slate-300">
                        <div style={{ width: `${onlinePct}%` }} className="bg-cyan-500 h-full transition-all"></div>
                        <div style={{ width: `${offlinePct}%` }} className="bg-emerald-600 h-full transition-all"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#D7E5E8] bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={`/r/${selectedRestRevenue.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-[#D7E5E8] text-[#1F2937] font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#3A7D7C]" />
                  <span>Visit Customer Storefront</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedRestRevenue(null)}
                  className="px-5 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs cursor-pointer transition-colors"
                >
                  Close Breakdown
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: RESTAURANT ADMINS & STAFF DETAIL */}
      {selectedAdminDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#D7E5E8] shadow-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-[#D7E5E8] flex items-center justify-between bg-purple-50/50">
              <div>
                <h3 className="text-base font-extrabold text-[#1F2937]">Associated Admins & Staff</h3>
                <p className="text-xs text-[#64748B]">{selectedAdminDetail.name} • ID #{selectedAdminDetail.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAdminDetail(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {(!selectedAdminDetail.admins_list || selectedAdminDetail.admins_list.length === 0) ? (
                <div className="text-center py-6 text-xs text-[#64748B]">
                  No admins or staff assigned to this restaurant yet.
                </div>
              ) : (
                selectedAdminDetail.admins_list.map((adm, idx) => (
                  <div key={adm.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#1F2937]">{adm.name}</span>
                        {adm.is_primary === 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Primary Owner
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">
                          {adm.role || 'Staff'}
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-1 space-y-0.5">
                        {adm.phone && (
                          <a href={`tel:${adm.phone}`} className="text-[#3A7D7C] hover:underline flex items-center gap-1 font-bold">
                            <Phone className="w-3 h-3" /> {adm.phone}
                          </a>
                        )}
                        {adm.email && (
                          <a href={`mailto:${adm.email}`} className="text-[#64748B] hover:underline flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" /> {adm.email}
                          </a>
                        )}
                      </div>
                    </div>
                    {adm.status && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        adm.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {adm.status}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[#D7E5E8] bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAdminDetail(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GRANULAR ADMIN FINANCIAL BREAKDOWN & RESTAURANTS DOSSIER */}
      {selectedAdminRevenue && (() => {
        const rev = selectedAdminRevenue.revenue || {};
        const t = rev.today || {};
        const w = rev.weekly || {};
        const m = rev.monthly || {};
        const tot = rev.all_time || {};

        const totCombined = tot.combined || 0;
        const onlinePct = totCombined > 0 ? Math.round(((tot.online || 0) / totCombined) * 100) : 50;
        const offlinePct = 100 - onlinePct;

        const myRests = selectedAdminRevenue.restaurants || [];

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full border border-[#D7E5E8] shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-6 border-b border-[#D7E5E8] flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-slate-50 to-cyan-50/70 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#3A7D7C] text-white flex items-center justify-center font-black text-xl shadow-xs">
                    {(selectedAdminRevenue.name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-[#1F2937]">{selectedAdminRevenue.name}</h2>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedAdminRevenue.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {selectedAdminRevenue.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        {selectedAdminRevenue.role}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] mt-1">
                      <span className="font-mono text-slate-500">Admin ID #{selectedAdminRevenue.user_id}</span>
                      <span>•</span>
                      {selectedAdminRevenue.phone && (
                        <a href={`tel:${selectedAdminRevenue.phone}`} className="text-[#3A7D7C] font-semibold hover:underline flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {selectedAdminRevenue.phone}
                        </a>
                      )}
                      <span>•</span>
                      {selectedAdminRevenue.email && (
                        <a href={`mailto:${selectedAdminRevenue.email}`} className="text-[#64748B] hover:text-[#1F2937] hover:underline flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" /> {selectedAdminRevenue.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAdminRevenue(null)}
                  className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* 1. MASTER 4 STAT CARDS FOR THIS ADMIN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* TODAY */}
                  <div className="bg-[#F0FDF4] p-4 rounded-2xl border border-emerald-200">
                    <span className="text-[10px] font-black uppercase text-emerald-800 block flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-600" /> Today's Money
                    </span>
                    <span className="text-xl font-black text-slate-900 mt-1 block">
                      {formatInr(t.combined)}
                    </span>
                    <div className="mt-2.5 pt-2 border-t border-emerald-200/60 text-[10px] space-y-0.5">
                      <div className="flex justify-between text-cyan-800 font-semibold">
                        <span>🌐 Online:</span>
                        <span className="font-bold">{formatInr(t.online)} ({t.online_orders || 0})</span>
                      </div>
                      <div className="flex justify-between text-emerald-800 font-semibold">
                        <span>🍽️ Offline:</span>
                        <span className="font-bold">{formatInr(t.offline)} ({t.offline_orders || 0})</span>
                      </div>
                    </div>
                  </div>

                  {/* WEEKLY */}
                  <div className="bg-[#F0F9FF] p-4 rounded-2xl border border-sky-200">
                    <span className="text-[10px] font-black uppercase text-sky-800 block flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-sky-600" /> Weekly (7 Days)
                    </span>
                    <span className="text-xl font-black text-slate-900 mt-1 block">
                      {formatInr(w.combined)}
                    </span>
                    <div className="mt-2.5 pt-2 border-t border-sky-200/60 text-[10px] space-y-0.5">
                      <div className="flex justify-between text-cyan-800 font-semibold">
                        <span>🌐 Online:</span>
                        <span className="font-bold">{formatInr(w.online)} ({w.online_orders || 0})</span>
                      </div>
                      <div className="flex justify-between text-emerald-800 font-semibold">
                        <span>🍽️ Offline:</span>
                        <span className="font-bold">{formatInr(w.offline)} ({w.offline_orders || 0})</span>
                      </div>
                    </div>
                  </div>

                  {/* MONTHLY */}
                  <div className="bg-[#F5F3FF] p-4 rounded-2xl border border-purple-200">
                    <span className="text-[10px] font-black uppercase text-purple-800 block flex items-center gap-1">
                      <BarChart3 className="w-3 h-3 text-purple-600" /> Monthly (30 Days)
                    </span>
                    <span className="text-xl font-black text-slate-900 mt-1 block">
                      {formatInr(m.combined)}
                    </span>
                    <div className="mt-2.5 pt-2 border-t border-purple-200/60 text-[10px] space-y-0.5">
                      <div className="flex justify-between text-cyan-800 font-semibold">
                        <span>🌐 Online:</span>
                        <span className="font-bold">{formatInr(m.online)} ({m.online_orders || 0})</span>
                      </div>
                      <div className="flex justify-between text-emerald-800 font-semibold">
                        <span>🍽️ Offline:</span>
                        <span className="font-bold">{formatInr(m.offline)} ({m.offline_orders || 0})</span>
                      </div>
                    </div>
                  </div>

                  {/* ALL-TIME */}
                  <div className="bg-[#FFFBEB] p-4 rounded-2xl border border-amber-200">
                    <span className="text-[10px] font-black uppercase text-amber-800 block flex items-center gap-1">
                      <Receipt className="w-3 h-3 text-amber-600" /> Lifetime Revenue
                    </span>
                    <span className="text-xl font-black text-slate-900 mt-1 block">
                      {formatInr(tot.combined)}
                    </span>
                    <div className="mt-2.5 pt-2 border-t border-amber-200/60 text-[10px] space-y-0.5">
                      <div className="flex justify-between text-cyan-800 font-semibold">
                        <span>🌐 Online:</span>
                        <span className="font-bold">{formatInr(tot.online)} ({tot.online_orders || 0})</span>
                      </div>
                      <div className="flex justify-between text-emerald-800 font-semibold">
                        <span>🍽️ Offline:</span>
                        <span className="font-bold">{formatInr(tot.offline)} ({tot.offline_orders || 0})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CHANNEL SHARE RATIO SPLIT BAR */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <PieChart className="w-3.5 h-3.5 text-[#3A7D7C]" /> Channel Revenue Share (Lifetime)
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      Total Orders: {tot.total_orders || 0}
                    </span>
                  </div>

                  <div className="h-3 rounded-full bg-slate-200 flex overflow-hidden border border-slate-300">
                    <div style={{ width: `${onlinePct}%` }} className="bg-cyan-500 h-full transition-all" title={`Online: ${onlinePct}%`}></div>
                    <div style={{ width: `${offlinePct}%` }} className="bg-emerald-500 h-full transition-all" title={`Offline: ${offlinePct}%`}></div>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-xs font-bold">
                    <div className="flex items-center gap-1.5 text-cyan-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                      <span>Online Web Storefront & Delivery: {onlinePct}% ({formatInr(tot.online)})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span>Offline POS, Dine-In & KOT: {offlinePct}% ({formatInr(tot.offline)})</span>
                    </div>
                  </div>
                </div>

                {/* 3. BREAKDOWN BY MANAGED RESTAURANT */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-[#1F2937] flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#3A7D7C]" />
                      <span>Individual Restaurant Financial Performance ({myRests.length})</span>
                    </h3>
                    <span className="text-[11px] text-[#64748B]">
                      Granular revenue generated from each assigned hotel
                    </span>
                  </div>

                  {myRests.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-[#64748B]">
                      No restaurants are currently assigned to this administrator.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myRests.map(r => {
                        const rRev = r.revenue || {};
                        const rt = rRev.today || {};
                        const rw = rRev.weekly || {};
                        const rm = rRev.monthly || {};
                        const rtot = rRev.all_time || {};

                        return (
                          <div key={r.id} className="p-4 rounded-2xl border border-[#D7E5E8] bg-white shadow-xs space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-slate-900">{r.name}</span>
                                  {r.is_primary === 1 && (
                                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      Primary Owner
                                    </span>
                                  )}
                                  <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold ${
                                    r.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                  }`}>
                                    {r.status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
                                  <span>{r.city || 'India'}</span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-400">ID #{r.id}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[#3A7D7C]">{r.slug}</span>
                                </div>
                              </div>

                              <Link
                                to={`/r/${r.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EAF4F7] hover:bg-[#D7E5E8] text-[#3A7D7C] flex items-center gap-1.5 shrink-0 transition-colors"
                              >
                                <span>Visit Storefront</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                              {/* Today */}
                              <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Today</span>
                                <span className="font-black text-slate-900 text-sm mt-0.5 block">{formatInr(rt.combined)}</span>
                                <div className="text-[9px] text-slate-600 mt-1 flex flex-col gap-0.5">
                                  <span>Onl: <b>{formatInr(rt.online)}</b> ({rt.online_orders || 0})</span>
                                  <span>Off: <b>{formatInr(rt.offline)}</b> ({rt.offline_orders || 0})</span>
                                </div>
                              </div>

                              {/* Weekly */}
                              <div className="p-2.5 rounded-xl bg-sky-50/50 border border-sky-100">
                                <span className="text-[10px] uppercase font-bold text-sky-800 block">Weekly (7d)</span>
                                <span className="font-black text-slate-900 text-sm mt-0.5 block">{formatInr(rw.combined)}</span>
                                <div className="text-[9px] text-slate-600 mt-1 flex flex-col gap-0.5">
                                  <span>Onl: <b>{formatInr(rw.online)}</b> ({rw.online_orders || 0})</span>
                                  <span>Off: <b>{formatInr(rw.offline)}</b> ({rw.offline_orders || 0})</span>
                                </div>
                              </div>

                              {/* Monthly */}
                              <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100">
                                <span className="text-[10px] uppercase font-bold text-purple-800 block">Monthly (30d)</span>
                                <span className="font-black text-slate-900 text-sm mt-0.5 block">{formatInr(rm.combined)}</span>
                                <div className="text-[9px] text-slate-600 mt-1 flex flex-col gap-0.5">
                                  <span>Onl: <b>{formatInr(rm.online)}</b> ({rm.online_orders || 0})</span>
                                  <span>Off: <b>{formatInr(rm.offline)}</b> ({rm.offline_orders || 0})</span>
                                </div>
                              </div>

                              {/* Lifetime */}
                              <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-100">
                                <span className="text-[10px] uppercase font-bold text-amber-800 block">Lifetime Total</span>
                                <span className="font-black text-slate-900 text-sm mt-0.5 block">{formatInr(rtot.combined)}</span>
                                <div className="text-[9px] text-slate-600 mt-1 flex flex-col gap-0.5">
                                  <span>Onl: <b>{formatInr(rtot.online)}</b> ({rtot.online_orders || 0})</span>
                                  <span>Off: <b>{formatInr(rtot.offline)}</b> ({rtot.offline_orders || 0})</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#D7E5E8] bg-slate-50 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedAdminRevenue(null)}
                  className="px-6 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs cursor-pointer transition-colors"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: ASSIGN ADMIN TO RESTAURANT */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[#D7E5E8] shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1F2937]">Assign Admin to Restaurant</h3>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignAdmin} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Select Administrator *</label>
                <select
                  required
                  value={assignForm.user_id}
                  onChange={e => setAssignForm({ ...assignForm, user_id: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none cursor-pointer"
                >
                  <option value="">Choose Admin...</option>
                  {admins.map(a => (
                    <option key={a.user_id} value={a.user_id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Select Restaurant *</label>
                <select
                  required
                  value={assignForm.restaurant_id}
                  onChange={e => setAssignForm({ ...assignForm, restaurant_id: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] outline-none cursor-pointer"
                >
                  <option value="">Choose Restaurant...</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} (#{r.id} - {r.city || 'India'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="assign_is_primary"
                  checked={assignForm.is_primary}
                  onChange={e => setAssignForm({ ...assignForm, is_primary: e.target.checked })}
                  className="w-4 h-4 rounded text-[#3A7D7C] cursor-pointer"
                />
                <label htmlFor="assign_is_primary" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Set as Primary Restaurant Owner
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
