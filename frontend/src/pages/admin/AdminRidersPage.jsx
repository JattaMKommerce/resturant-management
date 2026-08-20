import React, { useState, useEffect } from 'react';
import { 
  Users, Bike, CheckCircle2, XCircle, FileText, Eye, ShieldCheck, 
  AlertCircle, RefreshCw, Search, Check, X, ShieldAlert
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/axios';

export default function AdminRidersPage() {
  const [activeTab, setActiveTab] = useState('applications'); // 'applications' | 'active' | 'rejected' | 'suspended'
  const [applications, setApplications] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State (Supports both Driver & Application records)
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemType, setItemType] = useState(null); // 'APPLICATION' | 'DRIVER'
  const [itemDetails, setItemDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Rejection Modal State
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Inline Document Viewer State
  const [viewingDoc, setViewingDoc] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'applications') {
        const res = await api.get('/admin/rider-applications?status=PENDING');
        if (res.data.success) setApplications(res.data.applications || []);
      } else if (activeTab === 'rejected') {
        const res = await api.get('/admin/rider-applications?status=REJECTED');
        if (res.data.success) setApplications(res.data.applications || []);
      } else if (activeTab === 'active') {
        const res = await api.get('/admin/drivers?accountStatus=ACTIVE');
        if (res.data.success) setDrivers(res.data.drivers || []);
      } else if (activeTab === 'suspended') {
        const res = await api.get('/admin/drivers?accountStatus=SUSPENDED');
        if (res.data.success) setDrivers(res.data.drivers || []);
      }
    } catch (err) {
      console.error('Failed to load rider data:', err);
      setError(err.response?.data?.message || 'Failed to load data. Make sure you are logged in as a restaurant admin.');
    } finally {
      setLoading(false);
    }
  };

  // Open Application Modal (Pending / Rejected)
  const handleOpenApplicationModal = async (app) => {
    setSelectedItem(app);
    setItemType('APPLICATION');
    setLoadingDetails(true);
    setViewingDoc(null);
    try {
      const res = await api.get(`/admin/rider-applications/${app.id}`);
      if (res.data.success) {
        setItemDetails(res.data.application);
      }
    } catch (err) {
      console.error('Failed to load application details:', err);
      setError(err.response?.data?.message || 'Failed to load application details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Driver Details Modal (Active / Suspended)
  const handleOpenDriverModal = async (driver) => {
    setSelectedItem(driver);
    setItemType('DRIVER');
    setLoadingDetails(true);
    setViewingDoc(null);
    try {
      let driverData = null;

      // 1. Try driver profile endpoint
      try {
        const res = await api.get(`/admin/drivers/${driver.id}`);
        if (res.data?.success && res.data.driver) {
          driverData = res.data.driver;
        }
      } catch (e) {
        // Fallback for un-restarted servers
      }

      // 2. If documents aren't present yet, look up associated application
      if (!driverData || !driverData.documents || driverData.documents.length === 0) {
        try {
          const appRes = await api.get('/admin/rider-applications');
          if (appRes.data?.success && appRes.data.applications) {
            const matchedApp = appRes.data.applications.find(a => 
              (a.rider_id && a.rider_id === driver.id) ||
              (a.email && driver.email && a.email.toLowerCase() === driver.email.toLowerCase()) ||
              (a.mobile && driver.mobile && a.mobile.replace(/\D/g, '') === driver.mobile.replace(/\D/g, '')) ||
              (a.full_name && (driver.full_name || driver.name) && a.full_name.toLowerCase() === (driver.full_name || driver.name).toLowerCase())
            );

            if (matchedApp) {
              const detailRes = await api.get(`/admin/rider-applications/${matchedApp.id}`);
              if (detailRes.data?.success && detailRes.data.application) {
                const appData = detailRes.data.application;
                driverData = {
                  ...driver,
                  ...(driverData || {}),
                  created_at: driver.created_at || appData.reviewed_at || appData.submitted_at,
                  submitted_at: appData.submitted_at,
                  reviewed_at: appData.reviewed_at,
                  documents: appData.documents || [],
                  home_city: appData.home_city || driver.home_city,
                  current_city: appData.current_city || driver.current_city,
                  current_address: appData.current_address || driver.current_address,
                  emergency_contact: appData.emergency_contact || driver.emergency_contact
                };
              }
            }
          }
        } catch (e) {
          console.error('Application fallback error:', e);
        }
      }

      setItemDetails(driverData || driver);
    } catch (err) {
      console.error('Failed to load driver details:', err);
      setItemDetails(driver);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setItemType(null);
    setItemDetails(null);
    setViewingDoc(null);
  };

  const handleApproveApplication = async () => {
    if (!selectedItem) return;
    setSubmittingAction(true);
    setError('');
    try {
      const res = await api.patch(`/admin/rider-applications/${selectedItem.id}/approve`, {
        initialPassword: 'driver123'
      });
      if (res.data.success) {
        setSuccessMsg(`Application approved! Temporary credentials created: Email: ${res.data.credentials.email} / Password: ${res.data.credentials.temporaryPassword}`);
        handleCloseModal();
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve application.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectApplicationSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || !rejectionReason.trim()) return;
    setSubmittingAction(true);
    setError('');
    try {
      const res = await api.patch(`/admin/rider-applications/${selectedItem.id}/reject`, {
        rejectionReason: rejectionReason.trim()
      });
      if (res.data.success) {
        setSuccessMsg(`Application for ${selectedItem.full_name} was rejected.`);
        setShowRejectModal(false);
        setRejectionReason('');
        handleCloseModal();
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject application.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleToggleDriverStatus = async (driverId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await api.patch(`/admin/riders/${driverId}/status`, { account_status: newStatus });
      if (res.data.success) {
        setSuccessMsg(`Driver account status updated to ${newStatus}.`);
        if (itemDetails && itemDetails.id === driverId) {
          setItemDetails(prev => ({ ...prev, account_status: newStatus }));
        }
        fetchData();
      }
    } catch (err) {
      setError('Failed to update driver status.');
    }
  };

  // Helper to construct secure document streaming URL
  const getDocumentStreamUrl = (riderId, docId) => {
    const token = localStorage.getItem('hotel_token');
    return `${api.defaults.baseURL}/admin/riders/${riderId || 0}/documents/${docId}?token=${token}`;
  };

  // Filtered lists based on search
  const filteredApplications = applications.filter(app => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (app.full_name && app.full_name.toLowerCase().includes(q)) ||
      (app.mobile && app.mobile.includes(q)) ||
      (app.email && app.email.toLowerCase().includes(q)) ||
      (app.vehicle_number && app.vehicle_number.toLowerCase().includes(q)) ||
      (app.current_city && app.current_city.toLowerCase().includes(q))
    );
  });

  const filteredDrivers = drivers.filter(d => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = d.full_name || d.name || '';
    const phone = d.mobile || d.user_phone || '';
    const email = d.email || d.user_email || '';
    const vehicle = d.vehicle_number || '';
    const idStr = `rid-${d.id}`.toLowerCase();
    return (
      name.toLowerCase().includes(q) ||
      phone.includes(q) ||
      email.toLowerCase().includes(q) ||
      vehicle.toLowerCase().includes(q) ||
      idStr.includes(q)
    );
  });

  const activeData = itemDetails || selectedItem;

  return (
    <AdminLayout>
      <div className="space-y-6 font-sans antialiased">
        
        {/* Header */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
              <Bike className="w-6 h-6 text-[#3A7D7C]" />
              <span>Delivery Riders Fleet</span>
            </h1>
            <p className="text-[#64748B] text-xs sm:text-sm mt-0.5 font-medium">
              Review partner applications, verify identity documents, and manage active delivery personnel
            </p>
          </div>
          
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#3A7D7C]" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between font-bold">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold text-sm cursor-pointer">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-bold text-sm cursor-pointer">✕</button>
          </div>
        )}

        {/* Navigation Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D7E5E8] pb-1">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto custom-scrollbar">
            {[
              { id: 'applications', label: 'Pending Applications', icon: FileText, count: activeTab === 'applications' ? applications.length : null },
              { id: 'active', label: 'Active Delivery Riders', icon: Bike, count: activeTab === 'active' ? drivers.length : null },
              { id: 'rejected', label: 'Rejected Applications', icon: XCircle, count: activeTab === 'rejected' ? applications.length : null },
              { id: 'suspended', label: 'Suspended Riders', icon: ShieldAlert, count: activeTab === 'suspended' ? drivers.length : null },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                  className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-[#3A7D7C] text-[#3A7D7C]'
                      : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className="px-2 py-0.5 rounded-full bg-[#EAF4F7] text-[#3A7D7C] text-[10px] border border-[#D7E5E8]">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[200px] sm:w-56 mb-2 sm:mb-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#D7E5E8] rounded-xl text-xs text-[#1F2937] placeholder-[#94A3B8] focus:outline-none focus:border-[#3A7D7C] shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937] text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 1. APPLICATIONS VIEW (Pending & Rejected) */}
        {(activeTab === 'applications' || activeTab === 'rejected') && (
          <div className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-[#64748B] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
                Loading applications...
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="py-12 text-center text-[#64748B] text-xs font-medium">
                {search ? 'No matching applications found.' : `No ${activeTab} rider applications found for this restaurant.`}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#1F2937]">
                  <thead className="bg-slate-50 border-b border-[#D7E5E8] text-[#64748B] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4 pl-6">Applicant</th>
                      <th className="p-4">Contact</th>
                      <th className="p-4">Cities</th>
                      <th className="p-4">Vehicle</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Submitted</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5E8]">
                    {filteredApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 pl-6 font-bold text-[#1F2937] text-sm">{app.full_name}</td>
                        <td className="p-4 text-[#64748B]">
                          <div className="font-semibold text-[#1F2937]">{app.mobile}</div>
                          <div className="text-[11px] font-mono">{app.email}</div>
                        </td>
                        <td className="p-4 text-[#64748B]">
                          <div>Home: {app.home_city || 'N/A'}</div>
                          <div className="text-[11px] text-[#3A7D7C] font-bold">Work: {app.current_city || 'Bengaluru'}</div>
                        </td>
                        <td className="p-4 font-semibold text-[#1F2937]">
                          {app.vehicle_type} ({app.vehicle_number || 'N/A'})
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border ${
                            app.application_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            app.application_status === 'REJECTED' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                            'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {app.application_status}
                          </span>
                        </td>
                        <td className="p-4 text-[#64748B] font-mono text-[11px]">{new Date(app.submitted_at).toLocaleDateString()}</td>
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => handleOpenApplicationModal(app)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs transition-colors flex items-center gap-1.5 ml-auto shadow-2xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{activeTab === 'applications' ? 'Review Application' : 'View Details'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. ACTIVE / SUSPENDED RIDERS VIEW */}
        {(activeTab === 'active' || activeTab === 'suspended') && (
          <div className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-[#64748B] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
                Loading riders...
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div className="py-12 text-center text-[#64748B] text-xs font-medium">
                {search ? 'No matching riders found.' : `No ${activeTab} delivery riders assigned to this restaurant.`}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#1F2937]">
                  <thead className="bg-slate-50 border-b border-[#D7E5E8] text-[#64748B] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4 pl-6">Rider Name</th>
                      <th className="p-4">Contact</th>
                      <th className="p-4">Vehicle</th>
                      <th className="p-4">Availability</th>
                      <th className="p-4">Account Status</th>
                      <th className="p-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5E8]">
                    {filteredDrivers.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 pl-6 font-bold text-[#1F2937] text-sm">{d.full_name || d.name}</td>
                        <td className="p-4 text-[#64748B]">
                          <div className="font-semibold text-[#1F2937]">{d.mobile || d.user_phone}</div>
                          <div className="text-[11px] font-mono">{d.email || d.user_email}</div>
                        </td>
                        <td className="p-4 font-semibold text-[#1F2937]">
                          {d.vehicle_type} ({d.vehicle_number || 'N/A'})
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider border ${
                            d.availability_status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            d.availability_status === 'BUSY' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            'bg-slate-100 text-[#64748B] border-[#D7E5E8]'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              d.availability_status === 'AVAILABLE' ? 'bg-emerald-500 animate-pulse' :
                              d.availability_status === 'BUSY' ? 'bg-amber-500' :
                              'bg-slate-400'
                            }`} />
                            {d.availability_status === 'AVAILABLE' ? 'ONLINE (READY)' : d.availability_status === 'BUSY' ? 'ON TRIP' : 'OFFLINE'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border ${
                            d.account_status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {d.account_status}
                          </span>
                        </td>
                        <td className="p-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenDriverModal(d)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-[#D7E5E8] text-[#3A7D7C] font-bold text-xs transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#3A7D7C]" />
                              <span>View Details</span>
                            </button>
                            <button
                              onClick={() => handleToggleDriverStatus(d.id, d.account_status)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors border cursor-pointer ${
                                d.account_status === 'ACTIVE'
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {d.account_status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* NORMAL CENTERED REVIEW & PROFILE MODAL (PREVIOUS STYLE)       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="max-w-2xl w-full bg-white rounded-2xl p-6 sm:p-7 border border-[#D7E5E8] shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#1F2937]">
                    {itemType === 'APPLICATION' ? 'Application Review' : 'Driver Profile & Verification'}
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    {itemType === 'APPLICATION' ? 'Applicant' : 'Rider'}: {activeData?.full_name || activeData?.name} (#{activeData?.id})
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#64748B] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="py-12 text-center text-[#64748B] text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
                  Fetching verification documents...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Personal & Vehicle Info */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-[#D7E5E8] text-xs">
                    <div>
                      <span className="text-[#64748B] block font-semibold">Full Name:</span>
                      <span className="font-bold text-[#1F2937]">{activeData?.full_name || activeData?.name}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Mobile:</span>
                      <span className="font-bold text-[#1F2937]">{activeData?.mobile || activeData?.user_phone}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Email:</span>
                      <span className="font-bold text-[#1F2937] font-mono">{activeData?.email || activeData?.user_email}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Vehicle:</span>
                      <span className="font-bold text-[#1F2937]">{activeData?.vehicle_type} ({activeData?.vehicle_number || 'N/A'})</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Home City:</span>
                      <span className="font-bold text-[#1F2937]">{activeData?.home_city || 'Hubballi'}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Delivery City:</span>
                      <span className="font-bold text-[#3A7D7C]">{activeData?.current_city || 'Bengaluru'}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">
                        {itemType === 'DRIVER' ? 'Date Joined:' : 'Submitted On:'}
                      </span>
                      <span className="font-bold text-[#1F2937]">
                        {activeData?.created_at || activeData?.submitted_at
                          ? new Date(activeData.created_at || activeData.submitted_at).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Active Partner'}
                      </span>
                    </div>
                    {activeData?.account_status && (
                      <div>
                        <span className="text-[#64748B] block font-semibold">Account Status:</span>
                        <span className={`inline-block font-bold px-2 py-0.5 rounded-full text-[10px] mt-0.5 border ${
                          activeData.account_status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {activeData.account_status}
                        </span>
                      </div>
                    )}
                    {activeData?.stats && (
                      <div>
                        <span className="text-[#64748B] block font-semibold">Deliveries Completed:</span>
                        <span className="font-bold text-emerald-700">{activeData.stats.total_delivered || 0} orders</span>
                      </div>
                    )}
                    {activeData?.emergency_contact && (
                      <div>
                        <span className="text-[#64748B] block font-semibold">Emergency Contact:</span>
                        <span className="font-bold text-[#1F2937]">{activeData.emergency_contact}</span>
                      </div>
                    )}
                    {activeData?.rejection_reason && (
                      <div className="col-span-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                        <span className="font-bold block">Rejection Reason:</span>
                        <span>{activeData.rejection_reason}</span>
                      </div>
                    )}
                  </div>

                  {/* Document Attachments */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase text-[#64748B] tracking-wider">
                        Submitted Identity & Vehicle Documents ({activeData?.documents?.length || 0})
                      </h4>
                      {viewingDoc && (
                        <button
                          type="button"
                          onClick={() => setViewingDoc(null)}
                          className="text-[11px] font-bold text-[#3A7D7C] hover:underline cursor-pointer"
                        >
                          ✕ Hide Preview
                        </button>
                      )}
                    </div>

                    {/* INLINE DOCUMENT VIEWER (Directly inside modal) */}
                    {viewingDoc && (
                      <div className="bg-slate-900 rounded-2xl p-4 border border-[#D7E5E8] shadow-inner space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between text-white border-b border-slate-700 pb-2.5">
                          <div>
                            <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wide">
                              {viewingDoc.document_type?.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {viewingDoc.original_file_name || 'Document File'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={getDocumentStreamUrl(activeData?.rider_id || activeData?.id, viewingDoc.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 border border-slate-600 transition-colors"
                            >
                              <Eye className="w-3 h-3 text-[#3A7D7C]" /> Open New Tab ↗
                            </a>
                            <button
                              type="button"
                              onClick={() => setViewingDoc(null)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Document Image */}
                        <div className="flex items-center justify-center min-h-[220px] max-h-[360px] overflow-hidden rounded-xl bg-slate-950 p-2">
                          <img
                            src={getDocumentStreamUrl(activeData?.rider_id || activeData?.id, viewingDoc.id)}
                            alt={viewingDoc.document_type}
                            className="max-w-full max-h-[340px] object-contain rounded-lg"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'block';
                            }}
                          />
                          <div style={{ display: 'none' }} className="text-center p-6 text-slate-400 space-y-2">
                            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                            <p className="text-xs font-bold text-white">Image preview unavailable.</p>
                            <a
                              href={getDocumentStreamUrl(activeData?.rider_id || activeData?.id, viewingDoc.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block px-3 py-1 bg-[#3A7D7C] text-white text-[11px] font-bold rounded-lg"
                            >
                              Open in New Window
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Document Grid */}
                    {activeData?.documents && activeData.documents.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeData.documents.map((doc) => {
                          const isSelected = viewingDoc?.id === doc.id;
                          return (
                            <div
                              key={doc.id}
                              className={`p-3 rounded-xl border transition-all flex items-center justify-between text-xs ${
                                isSelected
                                  ? 'bg-[#EAF4F7] border-[#3A7D7C] ring-1 ring-[#3A7D7C]'
                                  : 'bg-slate-50 border-[#D7E5E8] hover:border-[#3A7D7C]/50'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <span className="font-bold text-[#1F2937] block uppercase text-[10px] truncate">
                                  {doc.document_type === 'SELFIE' ? 'Selfie Photograph' :
                                   doc.document_type === 'AADHAAR_FRONT' ? 'Aadhaar Card (Front)' :
                                   doc.document_type === 'AADHAAR_BACK' ? 'Aadhaar Card (Back)' :
                                   doc.document_type === 'DRIVING_LICENSE_FRONT' ? 'Driving Licence (Front)' :
                                   doc.document_type === 'DRIVING_LICENSE_BACK' ? 'Driving Licence (Back)' :
                                   doc.document_type === 'VEHICLE_RC' ? 'Vehicle RC' :
                                   doc.document_type === 'INSURANCE' ? 'Insurance' :
                                   doc.document_type.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px] text-[#64748B] block truncate font-mono">
                                  {doc.original_file_name || 'Attached File'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setViewingDoc(isSelected ? null : doc)}
                                  className={`px-2.5 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors border cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#3A7D7C] text-white border-[#3A7D7C]'
                                      : 'bg-white hover:bg-slate-100 text-[#3A7D7C] border-[#D7E5E8]'
                                  }`}
                                >
                                  <Eye className="w-3 h-3" /> {isSelected ? 'Viewing' : 'View'}
                                </button>
                                <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                  ✓
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-[#D7E5E8] rounded-xl text-center text-xs text-[#64748B]">
                        No attached document files recorded.
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {selectedItem.application_status === 'PENDING' && (
                    <div className="flex gap-4 pt-4 border-t border-[#D7E5E8]">
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={submittingAction}
                        className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Reject Application
                      </button>
                      <button
                        onClick={handleApproveApplication}
                        disabled={submittingAction}
                        className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {submittingAction ? 'Approving...' : 'Approve Rider Application ✓'}
                      </button>
                    </div>
                  )}

                  {itemType === 'DRIVER' && (
                    <div className="pt-4 border-t border-[#D7E5E8]">
                      <button
                        onClick={() => handleToggleDriverStatus(activeData.id, activeData.account_status)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors border cursor-pointer ${
                          activeData.account_status === 'ACTIVE'
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {activeData.account_status === 'ACTIVE' ? 'Suspend Driver Account' : 'Activate Driver Account'}
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* REJECTION REASON MODAL                                         */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-[#D7E5E8] space-y-4 shadow-xl">
              <h3 className="font-bold text-[#1F2937] text-base">Rejection Reason</h3>
              <p className="text-xs text-[#64748B]">Provide reason for rejecting {selectedItem?.full_name}'s application.</p>
              <form onSubmit={handleRejectApplicationSubmit} className="space-y-4">
                <textarea
                  required
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Incomplete driving licence document"
                  className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl p-3 text-xs text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                ></textarea>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-[#1F2937] rounded-xl font-bold text-xs border border-[#D7E5E8] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-2xs cursor-pointer"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
