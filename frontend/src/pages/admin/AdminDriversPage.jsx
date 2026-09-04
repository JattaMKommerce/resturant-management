import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Plus, Bike, Edit2, Phone, Mail, ShieldCheck, X, AlertTriangle, 
  CheckCircle2, Clock, Package, Eye, ChevronRight, RefreshCw,
  Search, ShieldAlert, Award, Calendar, DollarSign, MapPin, User,
  FileText, ExternalLink
} from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

export default function AdminDriversPage() {
  const { slug } = useParams();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'KYC_PENDING'

  // Modal State for Add Driver
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('driver123');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('Bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Selected Driver for Drawer / Inspection
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [driverDetail, setDriverDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Zoom Document Modal
  const [zoomedImage, setZoomedImage] = useState(null);

  useEffect(() => {
    fetchDrivers();
  }, [slug]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/drivers');
      if (res.data.success) {
        setDrivers(res.data.drivers || []);
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDriverDetail = async (id) => {
    setSelectedDriverId(id);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/admin/drivers/${id}`);
      if (res.data.success) {
        setDriverDetail(res.data.driver);
      }
    } catch (err) {
      console.error('Error loading driver details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDriverDetail = () => {
    setSelectedDriverId(null);
    setDriverDetail(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      const res = await api.post('/admin/drivers', {
        name,
        email: email || `${phone.replace(/\D/g, '')}@hotel.com`,
        password,
        phone,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber,
        license_number: licenseNumber
      });

      if (res.data.success) {
        setShowModal(false);
        setName('');
        setEmail('');
        setPhone('');
        setVehicleNumber('');
        setLicenseNumber('');
        fetchDrivers();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error creating driver account.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleDriverStatus = async (id, currentStatus) => {
    try {
      const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await api.patch(`/admin/drivers/${id}/status`, { account_status: nextStatus });
      fetchDrivers();
      if (driverDetail && driverDetail.id === id) {
        setDriverDetail(prev => ({ ...prev, account_status: nextStatus }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update driver status');
    }
  };

  // Metrics calculations
  const totalFleet = drivers.length;
  const availableCount = drivers.filter(d => d.availability_status === 'AVAILABLE').length;
  const busyCount = drivers.filter(d => d.availability_status === 'BUSY').length;
  const kycPendingCount = drivers.filter(d => d.kyc_status !== 'VERIFIED').length;
  const totalDeliveredOrders = drivers.reduce((sum, d) => sum + (Number(d.delivered_orders_count) || 0), 0);

  // Filtered drivers list
  const filteredDrivers = drivers.filter(drv => {
    const matchesSearch = 
      (drv.full_name || drv.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (drv.mobile || drv.phone || '').includes(search) ||
      (drv.vehicle_number || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'AVAILABLE') return drv.availability_status === 'AVAILABLE';
    if (statusFilter === 'BUSY') return drv.availability_status === 'BUSY';
    if (statusFilter === 'OFFLINE') return drv.availability_status === 'OFFLINE';
    if (statusFilter === 'KYC_PENDING') return drv.kyc_status !== 'VERIFIED';
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        
        {/* Top Header & Add Rider Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Dedicated Delivery Fleet</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Exclusive in-house riders for this hotel. Track live shifts, delivered orders, and KYC verifications.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDrivers}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
              title="Refresh Fleet"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[#3A7D7C] hover:bg-[#2C6261] text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md shadow-[#3A7D7C]/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Delivery Boy
            </button>
          </div>
        </div>

        {/* Fleet KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Fleet</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-black text-slate-900">{totalFleet}</span>
              <Bike className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-1 block">Dedicated Riders</span>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Available Now</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-black text-emerald-700">{availableCount}</span>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-1 block">Ready for orders</span>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">On Delivery</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-black text-amber-700">{busyCount}</span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-1 block">Currently on road</span>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Total Delivered</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-black text-blue-700">{totalDeliveredOrders}</span>
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-1 block">Completed orders</span>
          </div>

          {/* Highlighted Missing KYC Card */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'KYC_PENDING' ? 'ALL' : 'KYC_PENDING')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
              kycPendingCount > 0 
                ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/70 shadow-xs' 
                : 'bg-white border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                kycPendingCount > 0 ? 'text-rose-700 font-black' : 'text-slate-400'
              }`}>
                Docs Pending
              </span>
              {kycPendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black animate-pulse">
                  ALERT
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className={`text-2xl font-black ${kycPendingCount > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                {kycPendingCount}
              </span>
              <AlertTriangle className={`w-5 h-5 ${kycPendingCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            </div>
            <span className="text-[10px] text-rose-600 font-semibold mt-1 block">
              {kycPendingCount > 0 ? 'Click to filter missing' : 'All drivers verified'}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search rider name, phone, plate #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3A7D7C]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { label: 'All Fleet', key: 'ALL' },
              { label: '🟢 Available', key: 'AVAILABLE' },
              { label: '🟡 On Delivery', key: 'BUSY' },
              { label: '⚫ Offline', key: 'OFFLINE' },
              { label: '⚠️ Docs Pending', key: 'KYC_PENDING' }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === f.key
                    ? 'bg-[#3A7D7C] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drivers Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-[#3A7D7C] animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading delivery fleet...</p>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Bike className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800">No delivery drivers found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search || statusFilter !== 'ALL'
                ? 'No drivers match your search filters.'
                : 'You have not added any delivery boys yet. Click "+ Add Delivery Boy" above to onboard your first rider.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDrivers.map((drv) => {
              const hasMissingDocs = drv.kyc_status !== 'VERIFIED';
              return (
                <div 
                  key={drv.id} 
                  className={`bg-white rounded-3xl p-5 border transition-all flex flex-col justify-between space-y-4 hover:shadow-lg ${
                    hasMissingDocs 
                      ? 'border-amber-200/90 shadow-xs' 
                      : 'border-slate-200/80 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header Row: Photo + Name + Status Pill */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {drv.selfie_url ? (
                            <img 
                              src={drv.selfie_url} 
                              alt={drv.full_name} 
                              className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold">
                              <User className="w-6 h-6" />
                            </div>
                          )}
                          {/* Live indicator dot */}
                          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            drv.availability_status === 'AVAILABLE' ? 'bg-emerald-500' :
                            drv.availability_status === 'BUSY' ? 'bg-amber-500' : 'bg-slate-400'
                          }`} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-black text-sm text-slate-900 truncate flex items-center gap-1.5">
                            {drv.full_name || drv.name}
                          </h3>
                          <a 
                            href={`tel:${drv.mobile || drv.phone}`}
                            className="text-xs text-slate-500 hover:text-[#3A7D7C] font-semibold flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            {drv.mobile || drv.phone || 'No phone'}
                          </a>
                        </div>
                      </div>

                      {/* Availability badge */}
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        drv.availability_status === 'AVAILABLE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : drv.availability_status === 'BUSY'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {drv.availability_status === 'AVAILABLE' ? 'Available' :
                         drv.availability_status === 'BUSY' ? 'Delivering' : 'Offline'}
                      </span>
                    </div>

                    {/* Vehicle & Plate Specs */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Vehicle & Plate:</span>
                        <span className="font-extrabold text-slate-900 flex items-center gap-1">
                          <Bike className="w-3.5 h-3.5 text-slate-400" />
                          {drv.vehicle_type || 'Bike'} • {drv.vehicle_number || 'N/A'}
                        </span>
                      </div>
                      
                      {/* Active delivery if any */}
                      {drv.active_order && (
                        <div className="pt-1.5 mt-1 border-t border-slate-200/60 flex items-center justify-between text-amber-700 font-bold text-[11px]">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            Order #{drv.active_order.order_number || drv.active_order.id}
                          </span>
                          <span className="text-[10px] uppercase font-black tracking-wider bg-amber-100 px-2 py-0.5 rounded-full">
                            {drv.active_order.order_status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* KYC Document Status Card (Highlighted if missing) */}
                    <div className="mt-3">
                      {hasMissingDocs ? (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-[11px] font-black text-rose-800 block">
                              Documents Incomplete
                            </span>
                            <span className="text-[10px] font-semibold text-rose-600 leading-tight block mt-0.5">
                              Missing: {drv.missing_documents?.join(', ') || 'Photo & ID'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-black text-emerald-800">
                            All KYC Documents Verified
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Stats & Drawer Trigger */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-center px-2 py-1 bg-slate-100 rounded-lg">
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">Today</span>
                        <span className="text-xs font-black text-slate-900">{drv.today_delivered_count || 0}</span>
                      </div>
                      <div className="text-center px-2 py-1 bg-teal-50 rounded-lg border border-teal-100">
                        <span className="text-[9px] text-teal-600 font-bold block uppercase">All-Time</span>
                        <span className="text-xs font-black text-teal-800">{drv.delivered_orders_count || 0}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => openDriverDetail(drv.id)}
                      className="flex items-center gap-1 text-xs font-bold text-[#3A7D7C] hover:text-[#2C6261] bg-[#3A7D7C]/10 hover:bg-[#3A7D7C]/15 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Driver Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">Add New Delivery Boy</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Create login credentials for in-house driver</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rider Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mobile Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Login Password *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. driver123"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Vehicle Type *</label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
                    >
                      <option value="Bike">Motorbike</option>
                      <option value="Scooter">Scooter</option>
                      <option value="EV">EV Bike</option>
                      <option value="Cycle">Bicycle</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Plate / Registration # *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GA-01-AB-1234"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Driving License Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. DL-0420110012345"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
                  />
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium leading-relaxed">
                  💡 <strong>Tip:</strong> Rider will log in with their mobile number & password. When they open their portal, they will be prompted to take a selfie and upload their license and Aadhaar.
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 bg-[#3A7D7C] hover:bg-[#2C6261] text-white font-black rounded-xl shadow-md shadow-[#3A7D7C]/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {formLoading ? 'Creating...' : 'Create Driver'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Driver Detail & Performance Drawer */}
        {selectedDriverId && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
              
              {/* Drawer Top Bar */}
              <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">
                      {driverDetail?.full_name || driverDetail?.name || 'Driver Profile'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-semibold">
                      Performance & Verification Console
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeDriverDetail}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loadingDetail || !driverDetail ? (
                  <div className="py-20 text-center">
                    <RefreshCw className="w-8 h-8 text-[#3A7D7C] animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500">Loading driver details...</p>
                  </div>
                ) : (
                  <>
                    {/* Top Identity Hero Card */}
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      {driverDetail.selfie_url ? (
                        <img 
                          src={driverDetail.selfie_url} 
                          alt="Driver" 
                          className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs cursor-pointer hover:opacity-90"
                          onClick={() => setZoomedImage(driverDetail.selfie_url)}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-400 flex items-center justify-center">
                          <User className="w-8 h-8" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-base text-slate-900 truncate">
                            {driverDetail.full_name || driverDetail.name}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            driverDetail.account_status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {driverDetail.account_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{driverDetail.mobile || driverDetail.phone}</p>
                        <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                          {driverDetail.vehicle_type} • Plate: <span className="text-slate-800 font-bold">{driverDetail.vehicle_number}</span>
                        </p>
                      </div>
                    </div>

                    {/* Performance Metrics Tiles */}
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Delivery Performance</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                          <span className="text-[10px] font-bold text-blue-600 block uppercase">Today</span>
                          <span className="text-xl font-black text-blue-900">{driverDetail.stats?.today_delivered || 0}</span>
                          <span className="text-[10px] text-blue-500 font-medium block">Orders</span>
                        </div>
                        <div className="p-3.5 bg-teal-50 rounded-2xl border border-teal-100 text-center">
                          <span className="text-[10px] font-bold text-teal-600 block uppercase">All-Time</span>
                          <span className="text-xl font-black text-teal-900">{driverDetail.stats?.total_delivered || 0}</span>
                          <span className="text-[10px] text-teal-500 font-medium block">Completed</span>
                        </div>
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Live Status</span>
                          <span className="text-sm font-black text-slate-900 block mt-1">{driverDetail.availability_status}</span>
                        </div>
                      </div>
                    </div>

                    {/* Active Order if any */}
                    {driverDetail.active_order && (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            Live Delivery in Progress
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/80 px-2.5 py-0.5 rounded-full text-amber-900">
                            {driverDetail.active_order.order_status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-amber-950 font-bold">
                          Order #{driverDetail.active_order.order_number || driverDetail.active_order.id} • ₹{driverDetail.active_order.total_amount}
                        </div>
                        <p className="text-[11px] text-amber-800 font-medium">
                          📍 {driverDetail.active_order.delivery_address || 'Customer Location'}
                        </p>
                      </div>
                    )}

                    {/* KYC Documents Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          KYC Documents & Verification
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          driverDetail.kyc_status === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {driverDetail.kyc_status === 'VERIFIED' ? 'Verified' : 'Incomplete'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {/* Selfie / Profile Photo */}
                        <div className="border border-slate-200 rounded-2xl p-2.5 text-center bg-slate-50/50 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-slate-500 block mb-1.5">1. Profile Photo</span>
                          {driverDetail.selfie_url ? (
                            <img 
                              src={driverDetail.selfie_url} 
                              alt="Selfie" 
                              onClick={() => setZoomedImage(driverDetail.selfie_url)}
                              className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-90 border border-slate-200"
                            />
                          ) : (
                            <div className="w-full h-24 rounded-xl bg-rose-50 border border-dashed border-rose-200 flex flex-col items-center justify-center p-2 text-rose-600">
                              <AlertTriangle className="w-5 h-5 mb-1" />
                              <span className="text-[9px] font-black uppercase">Missing</span>
                            </div>
                          )}
                          <span className="text-[9px] text-slate-400 font-semibold block mt-1.5">
                            {driverDetail.selfie_url ? '✅ Uploaded' : '❌ Not Provided'}
                          </span>
                        </div>

                        {/* Driving License */}
                        <div className="border border-slate-200 rounded-2xl p-2.5 text-center bg-slate-50/50 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-slate-500 block mb-1.5">2. Driving License</span>
                          {driverDetail.license_url ? (
                            <img 
                              src={driverDetail.license_url} 
                              alt="License" 
                              onClick={() => setZoomedImage(driverDetail.license_url)}
                              className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-90 border border-slate-200"
                            />
                          ) : (
                            <div className="w-full h-24 rounded-xl bg-rose-50 border border-dashed border-rose-200 flex flex-col items-center justify-center p-2 text-rose-600">
                              <AlertTriangle className="w-5 h-5 mb-1" />
                              <span className="text-[9px] font-black uppercase">Missing</span>
                            </div>
                          )}
                          <span className="text-[9px] text-slate-400 font-semibold block mt-1.5">
                            {driverDetail.license_url ? '✅ Uploaded' : '❌ Not Provided'}
                          </span>
                        </div>

                        {/* Aadhaar Card */}
                        <div className="border border-slate-200 rounded-2xl p-2.5 text-center bg-slate-50/50 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-slate-500 block mb-1.5">3. Aadhaar / ID</span>
                          {driverDetail.aadhaar_url ? (
                            <img 
                              src={driverDetail.aadhaar_url} 
                              alt="Aadhaar" 
                              onClick={() => setZoomedImage(driverDetail.aadhaar_url)}
                              className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-90 border border-slate-200"
                            />
                          ) : (
                            <div className="w-full h-24 rounded-xl bg-rose-50 border border-dashed border-rose-200 flex flex-col items-center justify-center p-2 text-rose-600">
                              <AlertTriangle className="w-5 h-5 mb-1" />
                              <span className="text-[9px] font-black uppercase">Missing</span>
                            </div>
                          )}
                          <span className="text-[9px] text-slate-400 font-semibold block mt-1.5">
                            {driverDetail.aadhaar_url ? '✅ Uploaded' : '❌ Not Provided'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delivered Orders History */}
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                        Recent Deliveries ({driverDetail.recent_deliveries?.length || 0})
                      </h4>

                      {(!driverDetail.recent_deliveries || driverDetail.recent_deliveries.length === 0) ? (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-400 font-medium">
                          No deliveries completed by this rider yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {driverDetail.recent_deliveries.map(ord => (
                            <div key={ord.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-extrabold text-slate-900 block">
                                  Order #{ord.order_number || ord.id}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {ord.customer_name || 'Customer'} • ₹{ord.total_amount} ({ord.payment_method})
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                Delivered
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Drawer Footer Actions */}
              {driverDetail && (
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <button
                    onClick={() => toggleDriverStatus(driverDetail.id, driverDetail.account_status)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      driverDetail.account_status === 'ACTIVE'
                        ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                        : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                    }`}
                  >
                    {driverDetail.account_status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
                  </button>

                  <button
                    onClick={closeDriverDetail}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Zoom Image Lightbox Modal */}
        {zoomedImage && (
          <div 
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2">
              <img src={zoomedImage} alt="Document Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute top-4 right-4 p-1.5 bg-black/60 text-white rounded-full hover:bg-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
