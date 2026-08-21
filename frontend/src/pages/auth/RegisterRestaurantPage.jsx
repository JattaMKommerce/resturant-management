import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building, User, Mail, Phone, Lock, MapPin, ShieldCheck, UtensilsCrossed, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';

export default function RegisterRestaurantPage() {
  const { registerRestaurant } = useAuth();
  const navigate = useNavigate();

  // Admin Account Details
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Restaurant Profile Details
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [restaurantEmail, setRestaurantEmail] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [taxPercentage, setTaxPercentage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await registerRestaurant({
        adminName,
        adminEmail,
        adminPassword,
        adminPhone,
        restaurantName,
        restaurantPhone: restaurantPhone || adminPhone,
        restaurantEmail: restaurantEmail || adminEmail,
        address,
        latitude,
        longitude,
        deliveryRadiusKm,
        minOrderAmount,
        deliveryFee,
        taxPercentage
      });

      if (res.success) {
        navigate('/admin');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (err.message?.includes('Network Error') || !err.response) {
        setError('Network Error: Cannot connect to backend server. Make sure the backend server is running and reachable.');
      } else {
        setError(err.message || 'Failed to register restaurant. Please check all fields.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col font-sans antialiased">
      <Navbar />

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#D7E5E8] shadow-xl space-y-6">
          
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold mx-auto shadow-md shadow-[#3A7D7C]/20">
              <Building className="w-7 h-7" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937] mt-4 tracking-tight">Register Your Restaurant</h2>
            <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto">
              Create a new Admin Account and set up online food ordering & delivery for your hotel/restaurant in minutes.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            
            {/* Step 1: Admin Account Information */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-[#D7E5E8] space-y-4">
              <div className="flex items-center gap-2 border-b border-[#D7E5E8] pb-3">
                <div className="w-6 h-6 rounded-md bg-[#3A7D7C] text-white font-bold text-xs flex items-center justify-center">1</div>
                <h3 className="font-bold text-sm text-[#1F2937]">Admin Account Information</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Admin Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hotel Manager Name"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Admin Login Email *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="admin@myhotel.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Admin Phone Number *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 9876543210"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937] focus:outline-none p-1 rounded-md"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Restaurant Profile & Location */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-[#D7E5E8] space-y-4">
              <div className="flex items-center gap-2 border-b border-[#D7E5E8] pb-3">
                <div className="w-6 h-6 rounded-md bg-[#3A7D7C] text-white font-bold text-xs flex items-center justify-center">2</div>
                <h3 className="font-bold text-sm text-[#1F2937]">Restaurant Profile & Delivery Rules</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Restaurant Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Taj Residency Dining"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl font-medium focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Restaurant Phone</label>
                  <input
                    type="tel"
                    placeholder="Same as Admin phone if empty"
                    value={restaurantPhone}
                    onChange={(e) => setRestaurantPhone(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl font-medium focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Full Address *</label>
                <textarea
                  required
                  rows="2"
                  placeholder="Complete hotel/restaurant address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl font-medium focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none transition-colors"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Delivery Radius (KM) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="10.0"
                    value={deliveryRadiusKm}
                    onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                    className="w-full p-2.5 bg-[#EAF4F7] border border-[#D7E5E8] rounded-xl font-bold text-[#3A7D7C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Min Order Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="199.00"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl font-medium focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Delivery Charge (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="49.00"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl font-medium focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#3A7D7C] hover:bg-[#2F6665] font-extrabold text-sm text-white rounded-2xl transition-all shadow-md shadow-[#3A7D7C]/20 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              {loading ? 'Creating Restaurant Console...' : 'Register Restaurant & Open Admin Console'}
            </button>

          </form>

          <div className="text-center pt-2 border-t border-[#D7E5E8]">
            <p className="text-xs text-[#64748B] font-medium">
              Already have an Admin account?{' '}
              <Link to="/login" className="font-bold text-[#3A7D7C] hover:underline">
                Sign In to Admin Console
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
