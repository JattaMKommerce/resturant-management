import React, { useState, useEffect } from 'react';
import { Settings, Save, Power, MapPin, Phone, Mail, Building, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [restaurantId, setRestaurantId] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('12.9716');
  const [longitude, setLongitude] = useState('77.5946');
  const [openingHours, setOpeningHours] = useState('10:00 AM - 11:30 PM');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('10.0');
  const [minOrderAmount, setMinOrderAmount] = useState('199.00');
  const [deliveryFee, setDeliveryFee] = useState('49.00');
  const [taxPercentage, setTaxPercentage] = useState('5.00');
  const [isOnlineOrderingEnabled, setIsOnlineOrderingEnabled] = useState(true);
  const [isCodEnabled, setIsCodEnabled] = useState(true);
  const [isOnlinePaymentEnabled, setIsOnlinePaymentEnabled] = useState(true);

  // Direct Merchant Razorpay & UPI Gateway
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');

  const [websiteStatus, setWebsiteStatus] = useState('DRAFT');

  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/restaurant');
      if (res.data.success) {
        const r = res.data.restaurant;
        setRestaurantId(r.id);
        setName(r.name || '');
        setPhone(r.phone || '');
        setEmail(r.email || '');
        setAddress(r.address || '');
        setLatitude(r.latitude ? r.latitude.toString() : '12.9716');
        setLongitude(r.longitude ? r.longitude.toString() : '77.5946');
        setOpeningHours(r.opening_hours || '10:00 AM - 11:30 PM');
        setDeliveryRadiusKm(r.delivery_radius_km ? r.delivery_radius_km.toString() : '10.0');
        setMinOrderAmount(r.min_order_amount ? r.min_order_amount.toString() : '199.00');
        setDeliveryFee(r.delivery_fee ? r.delivery_fee.toString() : '49.00');
        setTaxPercentage(r.tax_percentage ? r.tax_percentage.toString() : '5.00');
        setIsOnlineOrderingEnabled(r.is_online_ordering_enabled === 1 || r.is_online_ordering_enabled === true);
        setIsCodEnabled(r.is_cod_enabled === 1 || r.is_cod_enabled === true);
        setIsOnlinePaymentEnabled(r.is_online_payment_enabled === 1 || r.is_online_payment_enabled === true);
        
        // Merchant Razorpay & UPI
        setRazorpayEnabled(r.razorpay_enabled === 1 || r.razorpay_enabled === true);
        setRazorpayKeyId(r.razorpay_key_id || '');
        setRazorpayKeySecret(r.razorpay_key_secret || '');
        setUpiId(r.upi_id || '');
        setUpiName(r.upi_name || '');

        setWebsiteStatus(r.website_status || 'DRAFT');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('id', restaurantId);
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('email', email);
      formData.append('address', address);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('opening_hours', openingHours);
      formData.append('delivery_radius_km', deliveryRadiusKm);
      formData.append('min_order_amount', minOrderAmount);
      formData.append('delivery_fee', deliveryFee);
      formData.append('tax_percentage', taxPercentage);
      formData.append('is_online_ordering_enabled', isOnlineOrderingEnabled ? '1' : '0');
      formData.append('is_cod_enabled', isCodEnabled ? '1' : '0');
      formData.append('is_online_payment_enabled', isOnlinePaymentEnabled ? '1' : '0');

      // Razorpay & UPI
      formData.append('razorpay_enabled', razorpayEnabled ? '1' : '0');
      formData.append('razorpay_key_id', razorpayKeyId);
      formData.append('razorpay_key_secret', razorpayKeySecret);
      formData.append('upi_id', upiId);
      formData.append('upi_name', upiName);

      if (logoFile) formData.append('logo', logoFile);
      if (coverFile) formData.append('cover', coverFile);

      // Note: Do NOT set Content-Type header manually for FormData in Axios
      const res = await api.put('/admin/restaurant/settings', formData);

      if (res.data.success) {
        setSuccessMsg('Restaurant configuration saved successfully!');
        if (res.data.restaurant) {
          setWebsiteStatus(res.data.restaurant.website_status || websiteStatus);
        }
        setTimeout(() => setSuccessMsg(''), 4000);
      }

    } catch (err) {
      console.error('Error saving settings:', err);
      alert(err.response?.data?.message || 'Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-xs font-semibold text-slate-500">Loading settings...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Restaurant Settings & Configuration</h2>
            <p className="text-xs text-slate-500">Configure online ordering availability, delivery radius, pricing & tax rules</p>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          
          {/* ONLINE ORDERING TOGGLE SECTION */}
          <div className="p-5 rounded-2xl bg-orange-50/60 border border-orange-200 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Power className="w-4 h-4 text-orange-600" /> Online Ordering Master Toggle
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  When turned OFF, customers will see a message: "Online ordering is currently unavailable."
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOnlineOrderingEnabled(!isOnlineOrderingEnabled)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs ${
                  isOnlineOrderingEnabled
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {isOnlineOrderingEnabled ? 'ONLINE ORDERING ON' : 'ONLINE ORDERING OFF'}
              </button>
            </div>

            {isOnlineOrderingEnabled && websiteStatus !== 'PUBLISHED' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2 mt-1">
                <span>⚠️ <strong>Master toggle is ON</strong>, but your website is currently in <strong>{websiteStatus}</strong> state. Customers cannot order until you go to <strong>Website Controls</strong> and click <strong>"Publish Website Live"</strong>.</span>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Restaurant Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Phone *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Opening Hours</label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-slate-700 mb-1">Full Address *</label>
            <textarea
              rows="2"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            ></textarea>
          </div>

          {/* Location Coordinates & Radius */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Restaurant Latitude *</label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Restaurant Longitude *</label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-900 mb-1">Delivery Radius (KM) *</label>
              <input
                type="number"
                step="0.1"
                required
                value={deliveryRadiusKm}
                onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                className="w-full p-2.5 bg-orange-50 border border-orange-300 rounded-xl font-black text-orange-900"
              />
            </div>
          </div>

          {/* Charges & Tax */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Minimum Order Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Delivery Fee (₹)</label>
              <input
                type="number"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tax Percentage (%)</label>
              <input
                type="number"
                step="0.01"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-6 text-xs font-bold">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCodEnabled}
                onChange={(e) => setIsCodEnabled(e.target.checked)}
                className="text-orange-500 rounded"
              />
              Enable Cash on Delivery (COD)
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isOnlinePaymentEnabled}
                onChange={(e) => setIsOnlinePaymentEnabled(e.target.checked)}
                className="text-orange-500 rounded"
              />
              Enable Online Payments
            </label>
          </div>

          {/* Dedicated Razorpay Merchant Account Settings */}
          <div className="pt-5 border-t border-slate-100 space-y-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <span>💳 Restaurant Razorpay Merchant Gateway (Direct Bank Payouts)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter your restaurant's own Razorpay keys. All online deliveries and Table QR payments will deposit 100% directly into your bank account.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={razorpayEnabled}
                    onChange={(e) => setRazorpayEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {razorpayEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Razorpay Key ID (Key ID) *</label>
                    <input
                      type="text"
                      placeholder="e.g. rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"
                      value={razorpayKeyId}
                      onChange={(e) => setRazorpayKeyId(e.target.value)}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Razorpay Key Secret (Secret) *</label>
                    <input
                      type="password"
                      placeholder="e.g. your_secret_key"
                      value={razorpayKeySecret}
                      onChange={(e) => setRazorpayKeySecret(e.target.value)}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">UPI VPA ID (For Instant UPI QR)</label>
                    <input
                      type="text"
                      placeholder="e.g. restaurant@okaxis or 9876543210@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Merchant Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Grand Palace Restaurant Hubli"
                      value={upiName}
                      onChange={(e) => setUpiName(e.target.value)}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-lg shadow-orange-500/25 transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Changes...' : 'Save Restaurant Settings'}
            </button>
          </div>

        </form>

      </div>
    </AdminLayout>
  );
}
