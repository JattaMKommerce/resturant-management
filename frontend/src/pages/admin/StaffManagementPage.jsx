import React, { useState, useEffect } from 'react';
import { 
  Users, ChefHat, UserCheck, Shield, Plus, Search, RefreshCw, 
  Copy, Check, Eye, EyeOff, Edit3, Trash2, Power, Phone, Mail, 
  KeyRound, AlertCircle, X, Sparkles, CheckCircle2
} from 'lucide-react';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';

export default function StaffManagementPage() {
  const { socket } = useSocket();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('ALL'); // ALL, KITCHEN, WAITER, MANAGEMENT
  const [copiedId, setCopiedId] = useState(null);
  const [showPasswordMap, setShowPasswordMap] = useState({});

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // CREATE or EDIT
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'KITCHEN'
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  // Listen for realtime staff presence changes (online / offline)
  useEffect(() => {
    if (!socket) return;

    const handlePresenceChange = (data) => {
      setStaff(prevStaff => 
        prevStaff.map(member => 
          member.id === data.userId ? { ...member, is_online: data.isOnline } : member
        )
      );
    };

    socket.on('staff_presence_change', handlePresenceChange);
    return () => {
      socket.off('staff_presence_change', handlePresenceChange);
    };
  }, [socket]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/staff');
      if (res.data.success) {
        setStaff(res.data.staff || []);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = (defaultRole = 'KITCHEN') => {
    setModalMode('CREATE');
    setEditingStaff(null);
    setFormData({
      name: '',
      email: '',
      password: generateRandomPassword(),
      phone: '',
      role: defaultRole
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member) => {
    setModalMode('EDIT');
    setEditingStaff(member);
    setFormData({
      name: member.name || '',
      email: member.email || '',
      password: '',
      phone: member.phone || '',
      role: member.role || 'KITCHEN'
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + '@123';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (modalMode === 'CREATE' && (!formData.password || formData.password.trim().length < 6)) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'CREATE') {
        const res = await api.post('/admin/staff', formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchStaff();
        }
      } else {
        const res = await api.put(`/admin/staff/${editingStaff.id}`, formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchStaff();
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (member) => {
    try {
      const res = await api.patch(`/admin/staff/${member.id}/status`);
      if (res.data.success) {
        setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: res.data.status } : s));
      }
    } catch (err) {
      alert('Failed to toggle status: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteStaff = async (member) => {
    if (!window.confirm(`Are you sure you want to remove ${member.name} (${member.role})? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await api.delete(`/admin/staff/${member.id}`);
      if (res.data.success) {
        setStaff(prev => prev.filter(s => s.id !== member.id));
      }
    } catch (err) {
      alert('Failed to delete staff member: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCopyCredentials = (member) => {
    const portalUrl = member.role === 'KITCHEN' 
      ? `${window.location.origin}/kitchen/login` 
      : `${window.location.origin}/waiter/login`;
    
    const textToCopy = `🏨 Staff Login Details:\n• Name: ${member.name}\n• Role: ${member.role === 'KITCHEN' ? 'Kitchen Chef' : 'Service Waiter'}\n• Login / Email: ${member.email}\n• Password: ${member.plain_password || '********'}\n• Portal URL: ${portalUrl}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(member.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Metrics
  const totalStaff = staff.length;
  const kitchenStaff = staff.filter(s => s.role === 'KITCHEN' || s.role === 'CHEF');
  const onlineKitchenCount = kitchenStaff.filter(s => s.is_online).length;
  const waiterStaff = staff.filter(s => s.role === 'WAITER');
  const onlineWaiterCount = waiterStaff.filter(s => s.is_online).length;

  // Filtered staff list
  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.phone.includes(searchQuery);
    
    if (!matchesSearch) return false;

    if (selectedTab === 'KITCHEN') return member.role === 'KITCHEN' || member.role === 'CHEF';
    if (selectedTab === 'WAITER') return member.role === 'WAITER';
    if (selectedTab === 'MANAGEMENT') return member.role === 'MANAGER' || member.role === 'CASHIER';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Staff & Access Management
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Live Presence
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Generate login accounts for Chefs & Waiters and monitor their live active status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStaff}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
            title="Refresh Staff Roster"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>

          <button
            onClick={() => handleOpenCreateModal('KITCHEN')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-5 h-5 font-black" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Staff */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Staff Roster</p>
            <h3 className="text-3xl font-black text-white mt-1">{totalStaff}</h3>
            <p className="text-xs text-slate-500 mt-1">Across all kitchen & service roles</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700/50">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Kitchen Staff */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Kitchen & Chefs (KDS)</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-white">{kitchenStaff.length}</h3>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {onlineKitchenCount} Online
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Direct Kitchen Order Display</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <ChefHat className="w-6 h-6" />
          </div>
        </div>

        {/* Waiter Staff */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Service Waiters</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-white">{waiterStaff.length}</h3>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {onlineWaiterCount} Online
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Table Service & Order Punching</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setSelectedTab('ALL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTab === 'ALL'
                ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Staff ({staff.length})
          </button>
          <button
            onClick={() => setSelectedTab('KITCHEN')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTab === 'KITCHEN'
                ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            Chefs ({kitchenStaff.length})
          </button>
          <button
            onClick={() => setSelectedTab('WAITER')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTab === 'WAITER'
                ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Waiters ({waiterStaff.length})
          </button>
          <button
            onClick={() => setSelectedTab('MANAGEMENT')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTab === 'MANAGEMENT'
                ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Managers
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Staff Cards List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-medium">Loading staff roster...</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl py-16 px-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 mx-auto flex items-center justify-center text-slate-500 border border-slate-700/50">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Staff Members Found</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              {searchQuery ? 'No results matched your search term.' : 'You have not added any staff members in this category yet.'}
            </p>
          </div>
          <button
            onClick={() => handleOpenCreateModal(selectedTab === 'WAITER' ? 'WAITER' : 'KITCHEN')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add New {selectedTab === 'WAITER' ? 'Waiter' : 'Chef'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map((member) => {
            const isChef = member.role === 'KITCHEN' || member.role === 'CHEF';
            const isWaiter = member.role === 'WAITER';
            const isOnline = Boolean(member.is_online);
            const showPlain = showPasswordMap[member.id];

            return (
              <div 
                key={member.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 backdrop-blur-xl shadow-lg transition-all flex flex-col justify-between space-y-4 relative group"
              >
                <div>
                  {/* Top Bar: Role badge & Online status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      isChef 
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : isWaiter
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}>
                      {isChef && <ChefHat className="w-3.5 h-3.5" />}
                      {isWaiter && <UserCheck className="w-3.5 h-3.5" />}
                      {!isChef && !isWaiter && <Shield className="w-3.5 h-3.5" />}
                      {isChef ? 'Chef (KDS)' : (isWaiter ? 'Waiter' : member.role)}
                    </span>

                    {/* Live Online Badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isOnline 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>

                  {/* Staff Info */}
                  <div className="mt-4">
                    <h3 className="text-lg font-bold text-white truncate">{member.name}</h3>
                    
                    <div className="space-y-1.5 mt-2.5 text-xs text-slate-400">
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-mono text-slate-300 select-all truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-mono text-slate-300">{member.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Credentials Box */}
                  <div className="mt-4 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-orange-400" />
                        Password
                      </span>
                      {member.plain_password && (
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(member.id)}
                          className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 normal-case font-normal text-xs"
                        >
                          {showPlain ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showPlain ? 'Hide' : 'Reveal'}</span>
                        </button>
                      )}
                    </div>

                    <div className="font-mono text-xs font-bold text-amber-300 truncate select-all">
                      {member.plain_password 
                        ? (showPlain ? member.plain_password : '••••••••••••')
                        : 'Encrypted (Contact Admin)'}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleCopyCredentials(member)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700/50 transition-colors"
                  >
                    {copiedId === member.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Login</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(member)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-colors"
                    title="Edit details or password"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleToggleStatus(member)}
                    className={`p-2 rounded-xl border transition-colors ${
                      member.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                    }`}
                    title={member.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                  >
                    <Power className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteStaff(member)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/50 transition-colors"
                    title="Delete Staff Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  {modalMode === 'CREATE' ? <Plus className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {modalMode === 'CREATE' ? 'Add New Staff Member' : 'Edit Staff Details'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {modalMode === 'CREATE' 
                      ? 'Generate login credentials for kitchen or waiter staff' 
                      : `Update account details for ${editingStaff?.name}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Staff Role *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'KITCHEN' }))}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      formData.role === 'KITCHEN'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <ChefHat className={`w-5 h-5 ${formData.role === 'KITCHEN' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <div>
                      <p className="text-sm font-bold">Kitchen Chef</p>
                      <p className="text-[11px] text-slate-500">Access Kitchen KDS screen</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'WAITER' }))}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      formData.role === 'WAITER'
                        ? 'bg-sky-500/15 border-sky-500 text-white shadow-md shadow-sky-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <UserCheck className={`w-5 h-5 ${formData.role === 'WAITER' ? 'text-sky-400' : 'text-slate-500'}`} />
                    <div>
                      <p className="text-sm font-bold">Service Waiter</p>
                      <p className="text-[11px] text-slate-500">Punch table orders & bills</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanjeev Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Login Email / Username */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Login Email / Username *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. chef1@hotel.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    {modalMode === 'CREATE' ? 'Password *' : 'New Password (leave empty to keep current)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, password: generateRandomPassword() }))}
                    className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  required={modalMode === 'CREATE'}
                  placeholder={modalMode === 'CREATE' ? 'Enter permanent password' : 'Enter new password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  <span>{modalMode === 'CREATE' ? 'Create Staff Account' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
