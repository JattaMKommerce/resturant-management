import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, Phone, ArrowRight, ChefHat, Eye, EyeOff } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function KitchenRegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        phone,
        password,
        role: 'KITCHEN'
      });

      if (res.data.success) {
        // Automatically login
        await login(email, password);
        navigate('/kitchen');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col justify-center items-center p-4 font-sans antialiased">
      <div className="max-w-md w-full bg-white border border-[#D7E5E8] rounded-3xl p-8 shadow-xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold mx-auto shadow-md shadow-[#3A7D7C]/20">
            <ChefHat className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#1F2937] tracking-tight mt-3">Join Kitchen Staff</h2>
          <p className="text-xs text-[#64748B]">
            Register your chef / kitchen station account to manage incoming KOT orders
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Chef / Cook Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="e.g. Chef Sanjeev"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Kitchen Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="e.g. chef.indian@hotel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="e.g. +91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] transition-colors"
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
                placeholder="Create password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] transition-colors"
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
            className="w-full py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-extrabold rounded-xl transition-all shadow-md shadow-[#3A7D7C]/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Register & Enter Kitchen Display</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-[#64748B] pt-3 border-t border-[#D7E5E8]">
          <span>Already have a kitchen account? </span>
          <Link to="/kitchen/login" className="text-[#3A7D7C] hover:underline font-bold">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
