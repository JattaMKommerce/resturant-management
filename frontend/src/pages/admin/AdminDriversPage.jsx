import React, { useState, useEffect } from 'react';
import { Plus, Bike, Edit2, Phone, Mail, ShieldCheck, X } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('driver123');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('Motorbike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/drivers');
      if (res.data.success) {
        setDrivers(res.data.drivers);
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      await api.post('/admin/drivers', {
        name,
        email,
        password,
        phone,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber,
        license_number: licenseNumber
      });

      setShowModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setVehicleNumber('');
      setLicenseNumber('');
      fetchDrivers();

    } catch (err) {
      alert(err.response?.data?.message || 'Error creating driver account.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Delivery Drivers Console</h2>
            <p className="text-xs text-slate-500">Manage delivery partners, active riders, and vehicle details</p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-orange-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Delivery Rider
          </button>
        </div>

        {/* Drivers Grid */}
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs">Loading drivers list...</div>
        ) : drivers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">No delivery drivers found in database.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drivers.map((drv) => (
              <div key={drv.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">{drv.full_name || drv.name || 'Delivery Partner'}</h3>
                        <span className="text-[11px] text-slate-400 block font-semibold">{drv.mobile || drv.phone || drv.user_phone || 'N/A'}</span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      drv.availability_status === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : drv.availability_status === 'BUSY'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {drv.availability_status || 'OFFLINE'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Vehicle:</span>
                      <span className="font-bold text-slate-900">{drv.vehicle_type || 'Bike'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Plate #:</span>
                      <span className="font-extrabold text-slate-900">{drv.vehicle_number || 'N/A'}</span>
                    </div>
                    {drv.license_number && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">License:</span>
                        <span className="font-semibold text-slate-700">{drv.license_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold truncate max-w-[150px]">{drv.email || drv.user_email || 'N/A'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    drv.account_status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {drv.account_status || 'ACTIVE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Create Driver Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Add New Delivery Rider</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rider Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Singh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="rider@hotel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9988776655"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Login Password *</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vehicle Type</label>
                  <input
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vehicle Plate # *</label>
                  <input
                    type="text"
                    required
                    placeholder="KA-01-EQ-4589"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Driving License Number</label>
                <input
                  type="text"
                  placeholder="DL-KA-2022-0941"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md"
                >
                  {formLoading ? 'Saving...' : 'Register Rider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
