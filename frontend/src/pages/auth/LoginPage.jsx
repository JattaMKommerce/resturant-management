import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        if (r === 'SUPER_ADMIN') {
          navigate('/super-admin');
        } else if (r === 'KITCHEN' || r === 'CHEF') {
          navigate('/kitchen');
        } else if (r === 'WAITER') {
          navigate('/admin/offline/orders');
        } else if (r === 'DELIVERY_DRIVER' || r === 'DRIVER') {
          navigate('/rider/dashboard');
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold mx-auto shadow-md shadow-orange-500/20">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-4">Admin Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">Sign in to access your Restaurant Admin Console</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 font-extrabold text-xs text-white rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? 'Signing In...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100 space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              Are you a restaurant owner?{' '}
              <Link to="/register-restaurant" className="font-bold text-emerald-600 hover:underline">
                Register New Restaurant (Admin)
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
