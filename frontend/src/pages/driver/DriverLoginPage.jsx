import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bike, Lock, Mail, ArrowRight, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DriverLoginPage() {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await login(loginInput.trim(), password);
      if (res.success && (res.user.role === 'DRIVER' || res.user.role === 'SUPER_ADMIN')) {
        navigate('/driver/dashboard');
      } else {
        setError('Access denied. Only approved delivery partners can log in here.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid login or password. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex items-center justify-center p-4 font-sans antialiased">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#D7E5E8] shadow-xl space-y-6">
        
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold mx-auto shadow-md shadow-[#3A7D7C]/20">
            <Bike className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#1F2937] mt-3 tracking-tight">Delivery Partner Portal</h2>
          <p className="text-xs text-[#64748B] mt-1">Sign in with your Email (Gmail) and Password to start deliveries</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Email / Gmail or Mobile Number *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="your.email@gmail.com or mobile"
                className="w-full pl-10 pr-4 py-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                className="w-full pl-10 pr-11 py-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-extrabold text-xs text-white rounded-xl transition-all shadow-md shadow-[#3A7D7C]/20 flex items-center justify-center gap-2 mt-4"
          >
            {loading ? 'Signing In...' : 'Sign In to Rider Duty'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-[#D7E5E8] text-center space-y-3">
          <p className="text-xs text-[#64748B]">Want to deliver for a restaurant?</p>
          <Link
            to="/driver/apply"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-[#D7E5E8] text-xs font-bold text-[#3A7D7C] transition-all shadow-2xs"
          >
            <UserPlus className="w-4 h-4" /> Apply as Delivery Partner
          </Link>
          <p className="text-[10px] text-[#64748B] block pt-1">Demo Rider: driver1@hotel.com / driver123</p>
        </div>

      </div>
    </div>
  );
}
