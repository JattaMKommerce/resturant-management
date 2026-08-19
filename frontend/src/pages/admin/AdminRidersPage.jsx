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

  // Review Modal State
  const [selectedApp, setSelectedApp] = useState(null);
  const [appDetails, setAppDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
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
        const res = await api.get('/admin/riders?accountStatus=ACTIVE');
        if (res.data.success) setDrivers(res.data.drivers || []);
      } else if (activeTab === 'suspended') {
        const res = await api.get('/admin/riders?accountStatus=SUSPENDED');
        if (res.data.success) setDrivers(res.data.drivers || []);
      }
    } catch (err) {
      console.error('Failed to load rider data:', err);
      setError(err.response?.data?.message || 'Failed to load data. Make sure you are logged in as a restaurant admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApplicationModal = async (app) => {
    setSelectedApp(app);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/admin/rider-applications/${app.id}`);
      if (res.data.success) {
        setAppDetails(res.data.application);
      }
    } catch (err) {
      console.error('Failed to load application details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleApproveApplication = async () => {
    if (!selectedApp) return;
    setSubmittingAction(true);
    setError('');
    try {
      const res = await api.patch(`/admin/rider-applications/${selectedApp.id}/approve`, {
        initialPassword: 'driver123'
      });
      if (res.data.success) {
        setSuccessMsg(`Application approved! Temporary credentials created: Email: ${res.data.credentials.email} / Password: ${res.data.credentials.temporaryPassword}`);
        setSelectedApp(null);
        setAppDetails(null);
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
    if (!selectedApp || !rejectionReason) return;
    setSubmittingAction(true);
    setError('');
    try {
      const res = await api.patch(`/admin/rider-applications/${selectedApp.id}/reject`, {
        rejectionReason
      });
      if (res.data.success) {
        setSuccessMsg(`Application for ${selectedApp.full_name} was rejected.`);
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedApp(null);
        setAppDetails(null);
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
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold shadow-2xs"
          >
            <RefreshCw className="w-4 h-4 text-[#3A7D7C]" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between font-bold">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold text-sm">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-bold text-sm">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#D7E5E8] gap-4 overflow-x-auto custom-scrollbar">
          {[
            { id: 'applications', label: 'Pending Applications', icon: FileText, count: activeTab === 'applications' ? applications.length : null },
            { id: 'active', label: 'Active Delivery Riders', icon: Bike, count: activeTab === 'active' ? drivers.length : null },
            { id: 'rejected', label: 'Rejected Applications', icon: XCircle },
            { id: 'suspended', label: 'Suspended Riders', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
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

        {/* APPLICATIONS VIEW */}
        {(activeTab === 'applications' || activeTab === 'rejected') && (
          <div className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-[#64748B] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
                Loading applications...
              </div>
            ) : applications.length === 0 ? (
              <div className="py-12 text-center text-[#64748B] text-xs font-medium">
                No {activeTab} rider applications found for this restaurant.
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
                    {applications.map((app) => (
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
                            className="px-3.5 py-1.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs transition-colors flex items-center gap-1.5 ml-auto shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" /> Review Application
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

        {/* ACTIVE / SUSPENDED RIDERS VIEW */}
        {(activeTab === 'active' || activeTab === 'suspended') && (
          <div className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-[#64748B] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
                Loading riders...
              </div>
            ) : drivers.length === 0 ? (
              <div className="py-12 text-center text-[#64748B] text-xs font-medium">
                No {activeTab} delivery riders assigned to this restaurant.
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
                    {drivers.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 pl-6 font-bold text-[#1F2937] text-sm">{d.full_name || d.name}</td>
                        <td className="p-4 text-[#64748B]">
                          <div className="font-semibold text-[#1F2937]">{d.mobile || d.user_phone}</div>
                          <div className="text-[11px] font-mono">{d.email || d.user_email}</div>
                        </td>
                        <td className="p-4 font-semibold text-[#1F2937]">
                          {d.vehicle_type} ({d.vehicle_number})
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
                          <button
                            onClick={() => handleToggleDriverStatus(d.id, d.account_status)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors border ${
                              d.account_status === 'ACTIVE'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {d.account_status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
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

        {/* APPLICATION REVIEW MODAL */}
        {selectedApp && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="max-w-2xl w-full bg-white rounded-2xl p-6 sm:p-7 border border-[#D7E5E8] shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
              
              <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#1F2937]">Application Review</h3>
                  <p className="text-xs text-[#64748B]">Applicant: {selectedApp.full_name} (#{selectedApp.id})</p>
                </div>
                <button
                  onClick={() => { setSelectedApp(null); setAppDetails(null); }}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#64748B] font-bold"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="py-12 text-center text-[#64748B] text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
                  Fetching application documents...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Personal & Vehicle Info */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-[#D7E5E8] text-xs">
                    <div>
                      <span className="text-[#64748B] block font-semibold">Full Name:</span>
                      <span className="font-bold text-[#1F2937]">{selectedApp.full_name}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Mobile:</span>
                      <span className="font-bold text-[#1F2937]">{selectedApp.mobile}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Email:</span>
                      <span className="font-bold text-[#1F2937]">{selectedApp.email}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Vehicle:</span>
                      <span className="font-bold text-[#1F2937]">{selectedApp.vehicle_type} ({selectedApp.vehicle_number || 'N/A'})</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Home City:</span>
                      <span className="font-bold text-[#1F2937]">{selectedApp.home_city || 'Hubballi'}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block font-semibold">Delivery City:</span>
                      <span className="font-bold text-[#3A7D7C]">{selectedApp.current_city || 'Bengaluru'}</span>
                    </div>
                  </div>

                  {/* Document Attachments */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase text-[#64748B] tracking-wider">Submitted Identity Documents</h4>
                      {viewingDoc && (
                        <button
                          type="button"
                          onClick={() => setViewingDoc(null)}
                          className="text-[11px] font-bold text-[#3A7D7C] hover:underline"
                        >
                          ✕ Hide Preview
                        </button>
                      )}
                    </div>

                    {/* INLINE DOCUMENT VIEWER (Directly inside Application Review) */}
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
                              href={getDocumentStreamUrl(appDetails?.rider_id, viewingDoc.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 border border-slate-600 transition-colors"
                            >
                              <Eye className="w-3 h-3 text-[#3A7D7C]" /> Open New Tab ↗
                            </a>
                            <button
                              type="button"
                              onClick={() => setViewingDoc(null)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Document Image */}
                        <div className="flex items-center justify-center min-h-[220px] max-h-[360px] overflow-hidden rounded-xl bg-slate-950 p-2">
                          <img
                            src={getDocumentStreamUrl(appDetails?.rider_id, viewingDoc.id)}
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
                              href={getDocumentStreamUrl(appDetails?.rider_id, viewingDoc.id)}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {appDetails?.documents?.map((doc) => {
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
                                {doc.document_type.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-[#64748B] block truncate">
                                {doc.original_file_name || 'Attached File'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setViewingDoc(isSelected ? null : doc)}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors border ${
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
                  </div>

                  {/* Actions */}
                  {selectedApp.application_status === 'PENDING' && (
                    <div className="flex gap-4 pt-4 border-t border-[#D7E5E8]">
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={submittingAction}
                        className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-colors"
                      >
                        Reject Application
                      </button>
                      <button
                        onClick={handleApproveApplication}
                        disabled={submittingAction}
                        className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-2"
                      >
                        {submittingAction ? 'Approving...' : 'Approve Rider Application ✓'}
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* REJECTION REASON MODAL */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-[#D7E5E8] space-y-4 shadow-xl">
              <h3 className="font-bold text-[#1F2937] text-base">Rejection Reason</h3>
              <p className="text-xs text-[#64748B]">Provide reason for rejecting {selectedApp?.full_name}'s application.</p>
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
                    className="flex-1 py-2.5 bg-slate-100 text-[#1F2937] rounded-xl font-bold text-xs border border-[#D7E5E8]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-2xs"
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
