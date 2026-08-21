import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldAlert, Building, Users, Bike, ShoppingBag, DollarSign, Lock, Unlock,
  CheckCircle, XCircle, Eye, EyeOff, LogOut, RefreshCw, Search, ExternalLink,
  AlertTriangle, Plus, Store, Check, Layers, ChevronRight
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

  const [activeTab, setActiveTab] = useState('restaurants'); // 'restaurants', 'admins', 'orders', 'drivers'
  const [kpis, setKpis] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Modals
  const [showNewRestModal, setShowNewRestModal] = useState(false);
  const [newRestForm, setNewRestForm] = useState({ name: '', phone: '', email: '', address: '', area: '', city: '', state: '', postal_code: '' });
  const [showNewAdminModal, setShowNewAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({ name: '', email: '', password: '', phone: '', restaurant_id: '' });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: '', restaurant_id: '', is_primary: true });

  useEffect(() => {
    if (user && user.role === 'SUPER_ADMIN') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpiRes, restRes, adminRes, orderRes, driverRes] = await Promise.all([
        api.get('/superadmin/kpis'),
        api.get('/superadmin/restaurants'),
        api.get('/superadmin/admins'),
        api.get('/superadmin/orders'),
        api.get('/superadmin/drivers')
      ]);

      if (kpiRes.data.success) setKpis(kpiRes.data.kpis);
      if (restRes.data.success) setRestaurants(restRes.data.restaurants);
      if (adminRes.data.success) setAdmins(adminRes.data.admins);
      if (orderRes.data.success) setOrders(orderRes.data.orders);
      if (driverRes.data.success) setDrivers(driverRes.data.drivers);
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

  const toggleAdminStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    if (!window.confirm(`Change admin account status to ${newStatus}?`)) return;
    try {
      await api.patch(`/superadmin/admins/${userId}/status`, { status: newStatus });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update admin status.');
    }
  };

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-[#3A7D7C] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Security Login Screen - Master Light Theme
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
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#1F2937] mt-3">Super Admin Portal</h2>
            <p className="text-xs text-[#64748B]">Platform administration & multi-tenant oversight</p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {authError}
            </div>
          )}

          <form onSubmit={handleSuperAdminLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1.5 uppercase tracking-wider text-[10px]">Super Admin Email</label>
              <input 
                type="email" 
                required 
                placeholder="superadmin@gmail.com" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                className="w-full px-4 py-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
              />
            </div>
            <div>
              <label className="block font-bold text-[#1F2937] mb-1.5 uppercase tracking-wider text-[10px]">Password</label>
              <div className="relative">
                <input 
                  type={showAuthPassword ? 'text' : 'password'} 
                  required 
                  placeholder="••••••••" 
                  value={authPassword} 
                  onChange={e => setAuthPassword(e.target.value)} 
                  className="w-full pl-4 pr-10 py-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowAuthPassword(!showAuthPassword)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937]"
                >
                  {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={authSubmitting} 
              className="w-full py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-extrabold text-xs text-white rounded-xl transition-all shadow-md shadow-[#3A7D7C]/20 active:scale-98"
            >
              {authSubmitting ? 'Authenticating...' : 'Sign In to Super Admin Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredRestaurants = restaurants.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.slug.toLowerCase().includes(search.toLowerCase()));
  const filteredAdmins = admins.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()));

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
            <p className="text-xs text-[#64748B]">Multi-restaurant platform oversight, tenancy management & operations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData} 
            className="p-2.5 bg-white hover:bg-slate-50 text-[#1F2937] rounded-xl transition-colors border border-[#D7E5E8] shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => { logout(); navigate('/admin/login'); }} 
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all shadow-2xs"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        {/* Master KPIs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Total Restaurants</span>
            <span className="text-2xl font-bold text-[#1F2937] mt-1 block">{kpis?.totalRestaurants || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Active Stores</span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">{kpis?.activeRestaurants || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Published Sites</span>
            <span className="text-2xl font-bold text-sky-700 mt-1 block">{kpis?.publishedWebsites || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Online Ordering</span>
            <span className="text-2xl font-bold text-[#3A7D7C] mt-1 block">{kpis?.orderingEnabled || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Today's Orders</span>
            <span className="text-2xl font-bold text-[#1F2937] mt-1 block">{kpis?.todayOrders || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#64748B] block">Today's Revenue</span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">₹{kpis?.todayRevenue?.toFixed(0) || 0}</span>
          </div>
        </div>

        {/* Tab Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-[#D7E5E8] shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button 
              onClick={() => setActiveTab('restaurants')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'restaurants' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <Store className="w-4 h-4" /> Restaurants ({restaurants.length})
            </button>
            <button 
              onClick={() => setActiveTab('admins')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'admins' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <Users className="w-4 h-4" /> Admins ({admins.length})
            </button>
            <button 
              onClick={() => setActiveTab('orders')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'orders' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <ShoppingBag className="w-4 h-4" /> Platform Orders ({orders.length})
            </button>
            <button 
              onClick={() => setActiveTab('drivers')} 
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'drivers' 
                  ? 'bg-[#3A7D7C] text-white shadow-2xs' 
                  : 'bg-[#EAF4F7] text-[#1F2937] hover:bg-[#D7E5E8]'
              }`}
            >
              <Bike className="w-4 h-4" /> Drivers ({drivers.length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D7E5E8] rounded-xl text-xs text-[#1F2937] placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
              />
            </div>
            {activeTab === 'restaurants' && (
              <button 
                onClick={() => setShowNewRestModal(true)} 
                className="px-3.5 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl flex items-center gap-1 whitespace-nowrap shadow-2xs"
              >
                <Plus className="w-4 h-4" /> Add Restaurant
              </button>
            )}
            {activeTab === 'admins' && (
              <button 
                onClick={() => setShowNewAdminModal(true)} 
                className="px-3.5 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl flex items-center gap-1 whitespace-nowrap shadow-2xs"
              >
                <Plus className="w-4 h-4" /> Add Admin
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: RESTAURANTS */}
        {activeTab === 'restaurants' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRestaurants.map(rest => (
              <div key={rest.id} className="bg-white border border-[#D7E5E8] rounded-2xl p-5 space-y-4 shadow-xs hover:border-[#3A7D7C]/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img src={rest.logo_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=100&q=80'} alt="" className="w-12 h-12 rounded-xl object-cover border border-[#D7E5E8]" />
                    <div>
                      <h3 className="font-bold text-[#1F2937] text-base leading-snug">{rest.name}</h3>
                      <Link to={`/restaurant/${rest.slug}`} target="_blank" className="text-xs text-[#3A7D7C] font-semibold hover:underline flex items-center gap-1 mt-0.5">
                        /restaurant/{rest.slug} <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl">
                    <span className="text-[#64748B] block text-[10px] font-bold uppercase">Status</span>
                    <span className={`font-bold ${rest.status === 'ACTIVE' ? 'text-emerald-700' : rest.status === 'SUSPENDED' ? 'text-rose-700' : 'text-amber-700'}`}>
                      {rest.status}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl">
                    <span className="text-[#64748B] block text-[10px] font-bold uppercase">Website</span>
                    <span className={`font-bold ${rest.website_status === 'PUBLISHED' ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                      {rest.website_status}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl">
                    <span className="text-[#64748B] block text-[10px] font-bold uppercase">Online Ordering</span>
                    <span className={`font-bold ${rest.is_online_ordering_enabled ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {rest.is_online_ordering_enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl">
                    <span className="text-[#64748B] block text-[10px] font-bold uppercase">Total Orders</span>
                    <span className="font-bold text-[#1F2937]">{rest.total_orders || 0}</span>
                  </div>
                </div>

                {rest.admin_names && (
                  <div className="text-xs text-[#64748B] border-t border-[#D7E5E8] pt-3">
                    <span className="font-bold text-[#1F2937] block">Admins:</span>
                    <span>{rest.admin_names}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2 border-t border-[#D7E5E8]">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleRestaurantStatus(rest.id, rest.status)} 
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                        rest.status === 'ACTIVE' 
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {rest.status === 'ACTIVE' ? 'Suspend Store' : 'Activate Store'}
                    </button>
                    <button
                      onClick={() => {
                        setAssignForm({ user_id: '', restaurant_id: rest.id, is_primary: true });
                        setShowAssignModal(true);
                      }}
                      className="px-3 py-2 bg-white hover:bg-slate-50 text-[#1F2937] border border-[#D7E5E8] rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-2xs"
                      title="Assign or change admin for this restaurant"
                    >
                      <Users className="w-3.5 h-3.5 text-[#3A7D7C]" /> Assign Admin
                    </button>
                  </div>
                  <Link 
                    to={`/admin/${rest.slug}`} 
                    className="w-full py-2 bg-[#EAF4F7] hover:bg-[#D7E5E8] text-[#3A7D7C] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-[#D7E5E8]"
                  >
                    <Building className="w-3.5 h-3.5" /> Open Restaurant Console <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: ADMINS */}
        {activeTab === 'admins' && (
          <div className="bg-white rounded-2xl border border-[#D7E5E8] overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-[#D7E5E8] flex justify-between items-center">
              <h3 className="font-bold text-sm text-[#1F2937]">Restaurant Admin Accounts</h3>
              <button 
                onClick={() => setShowAssignModal(true)} 
                className="px-3 py-1.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs"
              >
                Assign Admin to Restaurant
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead>
                  <tr className="bg-slate-50 text-[#64748B] uppercase text-[10px] font-bold border-b border-[#D7E5E8]">
                    <th className="p-4">Name & Contact</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Plain Password</th>
                    <th className="p-4">Assigned Restaurant(s)</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {filteredAdmins.map(adm => (
                    <tr key={adm.user_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-[#1F2937] block">{adm.name}</span>
                        <span className="text-[#64748B] text-[11px]">{adm.phone}</span>
                      </td>
                      <td className="p-4 font-mono text-[#1F2937]">{adm.email}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-[#D7E5E8] w-fit">
                          <span className="font-mono text-[#3A7D7C] font-bold">
                            {visiblePasswords[adm.user_id] ? adm.plain_password || 'N/A' : '••••••••'}
                          </span>
                          <button onClick={() => togglePasswordVisibility(adm.user_id)} className="text-[#64748B] hover:text-[#1F2937]">
                            {visiblePasswords[adm.user_id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-[#3A7D7C]">{adm.restaurant_names || 'Unassigned'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          adm.status === 'ACTIVE' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {adm.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => toggleAdminStatus(adm.user_id, adm.status)} 
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition-all ${
                            adm.status === 'DISABLED' 
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {adm.status === 'DISABLED' ? 'Enable' : 'Disable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PLATFORM ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-[#D7E5E8] overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-[#D7E5E8]">
              <h3 className="font-bold text-sm text-[#1F2937]">Platform-Wide Live Orders</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead>
                  <tr className="bg-slate-50 text-[#64748B] uppercase text-[10px] font-bold border-b border-[#D7E5E8]">
                    <th className="p-4">Order #</th>
                    <th className="p-4">Restaurant</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {orders.map(ord => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-[#3A7D7C]">{ord.order_number}</td>
                      <td className="p-4 font-semibold text-[#1F2937]">{ord.restaurant_name}</td>
                      <td className="p-4">
                        <span className="font-bold text-[#1F2937] block">{ord.customer_name}</span>
                        <span className="text-[#64748B] text-[11px]">{ord.customer_phone}</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-bold rounded-full text-[10px] uppercase">
                          {ord.order_status}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-[#1F2937] font-mono">₹{ord.total_amount}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-lg font-semibold bg-slate-100 text-[#1F2937] border border-[#D7E5E8]">
                          {ord.payment_method} ({ord.payment_status})
                        </span>
                      </td>
                      <td className="p-4 text-[#64748B]">{new Date(ord.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DRIVERS */}
        {activeTab === 'drivers' && (
          <div className="bg-white rounded-2xl border border-[#D7E5E8] overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-[#D7E5E8]">
              <h3 className="font-bold text-sm text-[#1F2937]">Registered Fleet Drivers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead>
                  <tr className="bg-slate-50 text-[#64748B] uppercase text-[10px] font-bold border-b border-[#D7E5E8]">
                    <th className="p-4">Name</th>
                    <th className="p-4">Vehicle</th>
                    <th className="p-4">Approval</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {drivers.map(drv => (
                    <tr key={drv.driver_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-[#1F2937] block">{drv.name}</span>
                        <span className="text-[#64748B] text-[11px]">{drv.phone}</span>
                      </td>
                      <td className="p-4 text-[#1F2937] font-medium">{drv.vehicle_type} ({drv.vehicle_number})</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold rounded-full text-[10px]">
                          {drv.approval_status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-[#1F2937] border border-[#D7E5E8] font-bold rounded-full text-[10px]">
                          {drv.availability_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* New Restaurant Modal */}
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
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Phone</label>
                  <input 
                    type="text" 
                    value={newRestForm.phone} 
                    onChange={e => setNewRestForm({...newRestForm, phone: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Email</label>
                  <input 
                    type="email" 
                    value={newRestForm.email} 
                    onChange={e => setNewRestForm({...newRestForm, email: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Address</label>
                <input 
                  type="text" 
                  value={newRestForm.address} 
                  onChange={e => setNewRestForm({...newRestForm, address: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Area</label>
                  <input 
                    type="text" 
                    value={newRestForm.area} 
                    onChange={e => setNewRestForm({...newRestForm, area: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">City</label>
                  <input 
                    type="text" 
                    value={newRestForm.city} 
                    onChange={e => setNewRestForm({...newRestForm, city: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Postal Code</label>
                  <input 
                    type="text" 
                    value={newRestForm.postal_code} 
                    onChange={e => setNewRestForm({...newRestForm, postal_code: e.target.value})} 
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewRestModal(false)} 
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl shadow-2xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl shadow-2xs"
                >
                  Create Restaurant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Admin Modal */}
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
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Email Address *</label>
                <input 
                  type="email" 
                  required 
                  value={newAdminForm.email} 
                  onChange={e => setNewAdminForm({...newAdminForm, email: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Password *</label>
                <input 
                  type="password" 
                  required 
                  value={newAdminForm.password} 
                  onChange={e => setNewAdminForm({...newAdminForm, password: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Phone Number *</label>
                <input 
                  type="text" 
                  required 
                  value={newAdminForm.phone} 
                  onChange={e => setNewAdminForm({...newAdminForm, phone: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Assign to Restaurant (Optional)</label>
                <select 
                  value={newAdminForm.restaurant_id} 
                  onChange={e => setNewAdminForm({...newAdminForm, restaurant_id: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                >
                  <option value="">Select Restaurant...</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewAdminModal(false)} 
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl shadow-2xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl shadow-2xs"
                >
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Admin Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#1F2937]">Assign Admin to Restaurant</h3>
            <form onSubmit={handleAssignAdmin} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Select Admin *</label>
                <select 
                  required 
                  value={assignForm.user_id} 
                  onChange={e => setAssignForm({...assignForm, user_id: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                >
                  <option value="">Select Admin Account...</option>
                  {admins.map(a => <option key={a.user_id} value={a.user_id}>{a.name} ({a.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Select Restaurant *</label>
                <select 
                  required 
                  value={assignForm.restaurant_id} 
                  onChange={e => setAssignForm({...assignForm, restaurant_id: e.target.value})} 
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                >
                  <option value="">Select Target Restaurant...</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name} ({r.slug})</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-3">
                <button 
                  type="button" 
                  onClick={() => setShowAssignModal(false)} 
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] font-bold rounded-xl shadow-2xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl shadow-2xs"
                >
                  Assign Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
