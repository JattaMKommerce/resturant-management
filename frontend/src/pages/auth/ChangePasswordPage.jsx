import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

/**
 * Change password. Also the forced step for admin accounts still using a demo password: their
 * session can do nothing else until a new password is set.
 */
function homeFor(user) {
  const r = user?.role;
  if (r === 'SUPER_ADMIN') return '/super-admin';
  if (r === 'KITCHEN' || r === 'CHEF') return '/kitchen';
  if (r === 'WAITER') return '/waiter/dashboard';
  if (r === 'DRIVER') return '/driver/dashboard';
  return '/admin/offline/dashboard';
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, restaurant } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < 8) { setError('Use at least 8 characters.'); return; }
    if (next !== confirm) { setError('The two new passwords do not match.'); return; }
    setSaving(true);
    try {
      const res = await api.post('/auth/change-password', { current_password: current, new_password: next });
      if (res.data?.token) localStorage.setItem('hotel_token', res.data.token);
      const slug = restaurant?.slug;
      const dest = (user?.role === 'RESTAURANT_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER') && slug
        ? `/admin/${slug}` : homeFor(user);
      window.location.replace(dest); // full reload so every screen picks up the new session
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full pl-10 pr-4 py-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C]';

  if (!user) {
    return (
      <div className="min-h-screen bg-[#EAF4F7] flex items-center justify-center p-6 text-sm">
        <button type="button" onClick={() => navigate('/admin/login')} className="font-bold text-[#3A7D7C] hover:underline">Please log in first</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex items-center justify-center p-4 font-sans">
      <form onSubmit={submit} className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#D7E5E8] shadow-xl space-y-5 text-xs">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto"><ShieldAlert className="w-7 h-7" /></div>
          <h1 className="text-2xl font-extrabold tracking-tight">Set a new password</h1>
          <p className="text-[#64748B]">
            {user.email ? <>Signed in as <strong>{user.email}</strong>. </> : null}
            For security, choose a new password before continuing. Demo or very common passwords are not accepted.
          </p>
        </div>
        {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-center" role="alert">{error}</div>}
        <div>
          <label htmlFor="cp-current" className="block font-bold mb-1">Current password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input id="cp-current" type={show ? 'text' : 'password'} required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="cp-new" className="block font-bold mb-1">New password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input id="cp-new" type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" className={`${inputCls} pr-11`} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide passwords' : 'Show passwords'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] p-1">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="cp-confirm" className="block font-bold mb-1">Confirm new password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input id="cp-confirm" type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-extrabold text-white rounded-xl disabled:opacity-50">
          {saving ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  );
}
