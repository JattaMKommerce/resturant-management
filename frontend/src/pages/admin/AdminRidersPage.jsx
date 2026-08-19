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
      <div className="space-y-6 font-sans">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Delivery Riders Management</h1>
            <p className="text-xs text-slate-500 mt-1">
              Review partner applications, verify identity documents, and manage active delivery personnel
            </p>
          </div>
          
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold text-sm">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-bold text-sm">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-0 overflow-x-auto custom-scrollbar whitespace-nowrap">
          {[
            { id: 'applications', label: 'Pending Applications', icon: FileText, count: activeTab === 'applications' ? applications.length : null },
            { id: 'active', label: 'Active Delivery Riders', icon: Bike, count: activeTab === 'active' ? drivers.length : null },
            { id: 'rejected', label: 'Rejected Applications', icon: XCircle, count: null },
            { id: 'suspended', label: 'Suspended Riders', icon: ShieldAlert, count: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-bold text-xs border-b-2 transition-all shrink-0 ${
                  isActive
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== null && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* APPLICATIONS VIEW */}
        {(activeTab === 'applications' || activeTab === 'rejected') && (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                Loading applications...
              </div>
            ) : applications.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No {activeTab} rider applications found for this restaurant.
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[750px] text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
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
                  <tbody className="divide-y divide-slate-100">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-900">{app.full_name}</td>
                        <td className="p-4 text-slate-600">
                          <div>{app.mobile}</div>
                          <div className="text-[11px] text-slate-400">{app.email}</div>
                        </td>
                        <td className="p-4 text-slate-600">
                          <div>Home: {app.home_city || 'N/A'}</div>
                          <div className="text-[11px] text-orange-600 font-semibold">Work: {app.current_city || 'Bengaluru'}</div>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">
                          {app.vehicle_type} ({app.vehicle_number || 'N/A'})
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] uppercase ${
                            app.application_status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            app.application_status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {app.application_status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">{new Date(app.submitted_at).toLocaleDateString()}</td>
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => handleOpenApplicationModal(app)}
                            className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 ml-auto"
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
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                Loading riders...
              </div>
            ) : drivers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No {activeTab} delivery riders assigned to this restaurant.
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[750px] text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4 pl-6">Rider Name</th>
                      <th className="p-4">Contact</th>
                      <th className="p-4">Vehicle</th>
                      <th className="p-4">Availability</th>
                      <th className="p-4">Account Status</th>
                      <th className="p-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drivers.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-900">{d.full_name || d.name}</td>
                        <td className="p-4 text-slate-600">
                          <div>{d.mobile || d.user_phone}</div>
                          <div className="text-[11px] text-slate-400">{d.email || d.user_email}</div>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">
                          {d.vehicle_type} ({d.vehicle_number})
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider ${
                            d.availability_status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' :
                            d.availability_status === 'BUSY' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-600'
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
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                            d.account_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {d.account_status}
                          </span>
                        </td>
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => handleToggleDriverStatus(d.id, d.account_status)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                              d.account_status === 'ACTIVE'
                                ? 'bg-red-100 hover:bg-red-200 text-red-700'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
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
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="max-w-2xl w-full bg-white rounded-3xl p-4 sm:p-8 border border-slate-200 shadow-2xl my-auto max-h-[90vh] overflow-y-auto custom-scrollbar space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">Application Review</h3>
                  <p className="text-xs text-slate-500">Applicant: {selectedApp.full_name} (#{selectedApp.id})</p>
                </div>
                <button
                  onClick={() => { setSelectedApp(null); setAppDetails(null); }}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                  Fetching application documents...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Personal & Vehicle Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl text-xs">
                    <div>
                      <span className="text-slate-400 block font-semibold">Full Name:</span>
                      <span className="font-bold text-slate-900">{selectedApp.full_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Mobile:</span>
                      <span className="font-bold text-slate-900">{selectedApp.mobile}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Email:</span>
                      <span className="font-bold text-slate-900">{selectedApp.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Vehicle:</span>
                      <span className="font-bold text-slate-900">{selectedApp.vehicle_type} ({selectedApp.vehicle_number || 'N/A'})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Home City:</span>
                      <span className="font-bold text-slate-900">{selectedApp.home_city || 'Hubballi'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Delivery City:</span>
                      <span className="font-bold text-orange-600">{selectedApp.current_city || 'Bengaluru'}</span>
                    </div>
                  </div>

                  {/* Document Attachments */}
                  <div>
                    <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-3">Submitted Identity Documents</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {appDetails?.documents?.map((doc) => (
                        <div key={doc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-slate-800 block uppercase text-[10px] truncate">{doc.document_type.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-slate-400 truncate block">{doc.original_file_name || 'Attached File'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={getDocumentStreamUrl(appDetails.rider_id, doc.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 font-bold text-[10px] flex items-center gap-1 transition-all"
                            >
                              <Eye className="w-3 h-3" /> View
                            </a>
                            <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                              ✓
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedApp.application_status === 'PENDING' && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={submittingAction}
                        className="w-full sm:flex-1 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-2xl transition-all"
                      >
                        Reject Application
                      </button>
                      <button
                        onClick={handleApproveApplication}
                        disabled={submittingAction}
                        className="w-full sm:flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
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
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-900 text-base">Rejection Reason</h3>
              <p className="text-xs text-slate-500">Provide reason for rejecting {selectedApp?.full_name}'s application.</p>
              <form onSubmit={handleRejectApplicationSubmit} className="space-y-4">
                <textarea
                  required
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Incomplete driving licence document"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none"
                ></textarea>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs"
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
