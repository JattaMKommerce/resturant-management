import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bike, Lock, Mail, ArrowRight, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DriverLoginPage() {
  const [loginInput, setLoginInput] = useState('driver1@hotel.com');
  const [password, setPassword] = useState('driver123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await login(loginInput, password);
      if (res.success && (res.user.role === 'DRIVER' || res.user.role === 'SUPER_ADMIN')) {
        navigate('/driver/dashboard');
      } else {
        setError('Access denied. Only approved delivery partners can log in here.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid login or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6">
        
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black mx-auto shadow-xl shadow-orange-500/20">
            <Bike className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white mt-4">Delivery Partner Portal</h2>
          <p className="text-xs text-slate-400 mt-1">Sign in with email/mobile to access your delivery dashboard</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold text-center flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">Email or Mobile Number</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="driver1@hotel.com or +91 9988776655"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 font-extrabold text-xs text-white rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 mt-4"
          >
            {loading ? 'Signing In...' : 'Sign In to Rider Duty'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center space-y-3">
          <p className="text-xs text-slate-400">Want to deliver for a restaurant?</p>
          <Link
            to="/driver/apply"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-orange-400 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Apply as Delivery Partner
          </Link>
          <p className="text-[10px] text-slate-500 block pt-1">Demo Rider: driver1@hotel.com / driver123</p>
        </div>

      </div>
    </div>
  );
}
