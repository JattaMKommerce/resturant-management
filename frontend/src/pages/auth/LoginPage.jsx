import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, Eye, EyeOff, Building2, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';

export default function LoginPage() {
  const [email, setEmail] = useState('');
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
      const res = await login(email, password);
      if (res.success) {
        const r = res.user?.role;
        if (r === 'DELIVERY_DRIVER' || r === 'DRIVER') {
          setError('This account is registered as a Delivery Partner. Please sign in at the Delivery Partner Portal (/driver/login) or use an Admin account.');
          return;
        }
        if (r === 'SUPER_ADMIN') {
          navigate('/super-admin');
        } else if (r === 'KITCHEN' || r === 'CHEF') {
          navigate('/kitchen');
        } else if (r === 'WAITER') {
          navigate('/waiter/dashboard');
        } else if (r === 'ADMIN' || r === 'RESTAURANT_ADMIN' || r === 'MANAGER') {
          const targetSlug = res.restaurant?.slug;
          if (targetSlug) navigate(`/admin/${targetSlug}`);
          else navigate('/admin/offline/operations');
        } else {
          navigate('/admin/offline/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col font-sans antialiased">
      <Navbar />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 border border-[#D7E5E8] shadow-xl space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold mx-auto shadow-md shadow-[#3A7D7C]/20">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1F2937] tracking-tight mt-3">Admin Sign In</h2>
            <p className="text-xs text-[#64748B]">
              Sign in to access your Restaurant Admin Console and manage operations
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center animate-in fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="admin@hotel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937] focus:outline-none p-1 rounded-md"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-extrabold text-xs text-white rounded-xl transition-all shadow-md shadow-[#3A7D7C]/20 flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In to Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-3 border-t border-[#D7E5E8] space-y-2">
            <p className="text-xs text-[#64748B]">
              Are you a restaurant owner?{' '}
              <Link to="/register-restaurant" className="font-bold text-[#3A7D7C] hover:underline">
                Register New Restaurant
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
