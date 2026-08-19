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
    <div className="space-y-6 antialiased font-sans text-[#1F2937]">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8] rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937] flex items-center gap-2">
                Staff & Access Management
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]">
                  Live Presence
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
                Generate login accounts for Chefs & Waiters and monitor their live active status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStaff}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#1F2937] transition-colors border border-[#D7E5E8] shadow-2xs"
            title="Refresh Staff Roster"
          >
            <RefreshCw className={`w-4 h-4 text-[#3A7D7C] ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => handleOpenCreateModal('KITCHEN')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold bg-[#3A7D7C] hover:bg-[#2F6665] text-white shadow-2xs transition-all text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Staff */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Total Staff Roster</p>
            <h3 className="text-2xl font-bold text-[#1F2937] mt-1">{totalStaff}</h3>
            <p className="text-xs text-[#64748B] mt-1">Across all kitchen & service roles</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#EAF4F7] flex items-center justify-center text-[#3A7D7C] border border-[#D7E5E8]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Kitchen Staff */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Kitchen & Chefs (KDS)</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-[#1F2937]">{kitchenStaff.length}</h3>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {onlineKitchenCount} Online
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">Direct Kitchen Order Display</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-200">
            <ChefHat className="w-5 h-5" />
          </div>
        </div>

        {/* Waiter Staff */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#3A7D7C]">Service Waiters</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-[#1F2937]">{waiterStaff.length}</h3>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {onlineWaiterCount} Online
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">Table Service & Order Punching</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#EAF4F7] flex items-center justify-center text-[#3A7D7C] border border-[#D7E5E8]">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white border border-[#D7E5E8] p-3 rounded-2xl shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl border border-[#D7E5E8] overflow-x-auto">
          <button
            onClick={() => setSelectedTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTab === 'ALL'
                ? 'bg-[#3A7D7C] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            All Staff ({staff.length})
          </button>
          <button
            onClick={() => setSelectedTab('KITCHEN')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTab === 'KITCHEN'
                ? 'bg-[#3A7D7C] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            Chefs ({kitchenStaff.length})
          </button>
          <button
            onClick={() => setSelectedTab('WAITER')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTab === 'WAITER'
                ? 'bg-[#3A7D7C] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Waiters ({waiterStaff.length})
          </button>
          <button
            onClick={() => setSelectedTab('MANAGEMENT')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedTab === 'MANAGEMENT'
                ? 'bg-[#3A7D7C] text-white shadow-2xs'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Managers
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search staff by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Staff Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-[#64748B] bg-white border border-[#D7E5E8] rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
          <p className="font-bold text-xs">Loading staff roster...</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl py-14 px-6 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center mx-auto border border-[#D7E5E8]">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#1F2937]">No Staff Found</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            {searchQuery 
              ? 'No staff matched your search query. Try a different search.' 
              : `No staff configured in the ${selectedTab} category yet.`}
          </p>
          <button
            onClick={() => handleOpenCreateModal(selectedTab === 'WAITER' ? 'WAITER' : 'KITCHEN')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#3A7D7C] hover:bg-[#2F6665] text-white transition-all shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New {selectedTab === 'WAITER' ? 'Waiter' : 'Chef'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((member) => {
            const isChef = member.role === 'KITCHEN' || member.role === 'CHEF';
            const isWaiter = member.role === 'WAITER';
            const isOnline = Boolean(member.is_online);
            const showPlain = showPasswordMap[member.id];

            return (
              <div 
                key={member.id}
                className="bg-white border border-[#D7E5E8] hover:border-[#3A7D7C] rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 relative group"
              >
                <div>
                  {/* Top Bar: Role badge & Online status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      isChef 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : isWaiter
                        ? 'bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {isChef && <ChefHat className="w-3.5 h-3.5" />}
                      {isWaiter && <UserCheck className="w-3.5 h-3.5" />}
                      {!isChef && !isWaiter && <Shield className="w-3.5 h-3.5" />}
                      {isChef ? 'Chef (KDS)' : (isWaiter ? 'Waiter' : member.role)}
                    </span>

                    {/* Live Online Badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isOnline 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-slate-100 text-[#64748B] border border-[#D7E5E8]'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>

                  {/* Staff Info */}
                  <div className="mt-4">
                    <h3 className="text-base font-bold text-[#1F2937] truncate">{member.name}</h3>
                    
                    <div className="space-y-1.5 mt-2 text-xs text-[#64748B]">
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
                        <span className="font-mono text-[#1F2937] select-all truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
                        <span className="font-mono text-[#1F2937]">{member.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Credentials Box */}
                  <div className="mt-4 bg-slate-50 border border-[#D7E5E8] rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-[#3A7D7C]" />
                        Password
                      </span>
                      {member.plain_password && (
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(member.id)}
                          className="text-[#3A7D7C] hover:text-[#2F6665] transition-colors flex items-center gap-1 normal-case font-bold text-[11px]"
                        >
                          {showPlain ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showPlain ? 'Hide' : 'Reveal'}</span>
                        </button>
                      )}
                    </div>

                    <div className="font-mono text-xs font-bold text-[#1F2937] truncate select-all">
                      {member.plain_password 
                        ? (showPlain ? member.plain_password : '••••••••••••')
                        : 'Encrypted (Contact Admin)'}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-[#D7E5E8] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleCopyCredentials(member)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-[#1F2937] border border-[#D7E5E8] transition-colors shadow-2xs"
                  >
                    {copiedId === member.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#3A7D7C]" />
                        <span>Copy Login</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(member)}
                    className="p-2 rounded-xl bg-white hover:bg-slate-50 text-[#1F2937] border border-[#D7E5E8] transition-colors shadow-2xs"
                    title="Edit details or password"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleToggleStatus(member)}
                    className={`p-2 rounded-xl border transition-colors shadow-2xs ${
                      member.status === 'ACTIVE'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    }`}
                    title={member.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                  >
                    <Power className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteStaff(member)}
                    className="p-2 rounded-xl bg-white hover:bg-rose-50 text-[#64748B] hover:text-rose-700 border border-[#D7E5E8] transition-colors shadow-2xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#D7E5E8] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#D7E5E8] flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]">
                  {modalMode === 'CREATE' ? <Plus className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F2937]">
                    {modalMode === 'CREATE' ? 'Add New Staff Member' : 'Edit Staff Details'}
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    {modalMode === 'CREATE' 
                      ? 'Generate login credentials for kitchen or waiter staff' 
                      : `Update account details for ${editingStaff?.name}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 text-[#64748B] hover:text-[#1F2937] transition-colors border border-[#D7E5E8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                  Staff Role *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'KITCHEN' }))}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      formData.role === 'KITCHEN'
                        ? 'bg-[#EAF4F7] border-[#3A7D7C] text-[#1F2937] shadow-xs'
                        : 'bg-slate-50 border-[#D7E5E8] text-[#64748B] hover:border-[#3A7D7C]'
                    }`}
                  >
                    <ChefHat className={`w-5 h-5 ${formData.role === 'KITCHEN' ? 'text-[#3A7D7C]' : 'text-[#64748B]'}`} />
                    <div>
                      <p className="text-sm font-bold text-[#1F2937]">Kitchen Chef</p>
                      <p className="text-[11px] text-[#64748B]">Access Kitchen KDS screen</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role: 'WAITER' }))}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      formData.role === 'WAITER'
                        ? 'bg-[#EAF4F7] border-[#3A7D7C] text-[#1F2937] shadow-xs'
                        : 'bg-slate-50 border-[#D7E5E8] text-[#64748B] hover:border-[#3A7D7C]'
                    }`}
                  >
                    <UserCheck className={`w-5 h-5 ${formData.role === 'WAITER' ? 'text-[#3A7D7C]' : 'text-[#64748B]'}`} />
                    <div>
                      <p className="text-sm font-bold text-[#1F2937]">Service Waiter</p>
                      <p className="text-[11px] text-[#64748B]">Punch table orders & bills</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanjeev Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C] transition-colors"
                />
              </div>

              {/* Login Email / Username */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                  Login Email / Username *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. chef1@hotel.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C] transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    {modalMode === 'CREATE' ? 'Password *' : 'New Password (leave empty to keep current)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, password: generateRandomPassword() }))}
                    className="text-xs text-[#3A7D7C] hover:text-[#2F6665] font-bold flex items-center gap-1"
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
                  className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C] transition-colors"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C] transition-colors"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#D7E5E8]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-xs font-bold text-[#1F2937] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-[#3A7D7C] hover:bg-[#2F6665] text-white shadow-2xs transition-all disabled:opacity-50 text-xs"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
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
