import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, MailCheck, User } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';

const RESEND_WAIT_SECONDS = 45;
const looksLikeEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());

/**
 * Forgot password (REQ-011) for admins, managers, staff and drivers.
 * Step 1 (REQUEST): the email or mobile number they log in with.
 * Step 2 (EMAIL):   only when a mobile number was typed: the email address on the account.
 * Step 3 (RESET):   the 6-digit code from the email + a new password.
 * The code is only ever emailed to the address already saved on the account.
 * All existing sessions of the account are ended on success.
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('REQUEST');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const inputCls = 'w-full pl-10 pr-4 py-3 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-medium placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] transition-colors';
  const primaryBtn = 'w-full py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-extrabold text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50';

  // The address the code was sent to: what they typed first if that was an email, otherwise the one we asked for.
  const sentTo = looksLikeEmail(identifier) ? identifier.trim() : email.trim();

  const requestCode = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = { identifier: identifier.trim() };
      if (step !== 'REQUEST' && email.trim()) body.email = email.trim();
      const res = await api.post('/auth/forgot-password', body);
      if (res.data?.need_email) {
        setStep('EMAIL');
        return;
      }
      setInfo(res.data?.message || 'If these details match an account, a 6-digit code has been sent to its email address.');
      if (res.data?.dev_code) setCode(res.data.dev_code); // local testing only (ALLOW_DEMO_OTP)
      setResendIn(RESEND_WAIT_SECONDS);
      setStep('RESET');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        identifier: sentTo || identifier.trim(),
        code: code.trim(),
        new_password: password
      });
      try {
        sessionStorage.setItem('hotel_logout_reason', res.data?.message || 'Password updated. Please log in with your new password.');
      } catch (storageErr) {}
      navigate('/admin/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep('REQUEST');
    setEmail('');
    setCode('');
    setError('');
    setInfo('');
  };

  const intro = {
    REQUEST: 'Enter the email or mobile number you log in with. We will email a 6-digit code to the address on your account.',
    EMAIL: 'Now enter the email address on your account. We will send the 6-digit code there.',
    RESET: 'Enter the 6-digit code from the email and choose a new password.'
  }[step];

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col font-sans antialiased">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 border border-[#D7E5E8] shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center mx-auto shadow-md shadow-[#3A7D7C]/20">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight mt-3">Reset your password</h1>
            <p className="text-xs text-[#64748B]">{intro}</p>
          </div>

          {info && step === 'RESET' && !error && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex gap-2" role="status">
              <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center" role="alert">
              {error}
            </div>
          )}

          {step === 'REQUEST' && (
            <form onSubmit={requestCode} className="space-y-4 text-xs">
              <div>
                <label htmlFor="fp-identifier" className="block font-bold mb-1">Email or Mobile Number</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input id="fp-identifier" type="text" required autoFocus autoComplete="username" value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)} placeholder="admin@hotel.com or 98765 43210" className={inputCls} />
                </div>
              </div>
              <button type="submit" disabled={loading || !identifier.trim()} className={primaryBtn}>
                {loading ? 'Please wait…' : (<><span>Continue</span><ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>
          )}

          {step === 'EMAIL' && (
            <form onSubmit={requestCode} className="space-y-4 text-xs">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F1F8F8] border border-[#D7E5E8]">
                <span className="font-semibold text-[#475569] truncate">Mobile: {identifier.trim()}</span>
                <button type="button" onClick={startOver} className="font-bold text-[#3A7D7C] hover:underline shrink-0">Change</button>
              </div>
              <div>
                <label htmlFor="fp-email" className="block font-bold mb-1">Email address on your account</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input id="fp-email" type="email" required autoFocus autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="admin@hotel.com" className={inputCls} />
                </div>
                <p className="mt-1.5 text-[11px] text-[#64748B]">
                  For your safety the code only goes to the email already saved on this account.
                </p>
              </div>
              <button type="submit" disabled={loading || !looksLikeEmail(email)} className={primaryBtn}>
                {loading ? 'Sending code…' : (<><span>Email me the code</span><ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>
          )}

          {step === 'RESET' && (
            <form onSubmit={resetPassword} className="space-y-4 text-xs">
              <div>
                <label htmlFor="fp-code" className="block font-bold mb-1">6-digit code</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input id="fp-code" type="text" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={6}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
                    className={`${inputCls} font-mono tracking-[0.3em]`} />
                </div>
              </div>
              <div>
                <label htmlFor="fp-new" className="block font-bold mb-1">New password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input id="fp-new" type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete="new-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className={`${inputCls} pr-11`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937] p-1 rounded-md">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="fp-confirm" className="block font-bold mb-1">Confirm new password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input id="fp-confirm" type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete="new-password"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
                </div>
              </div>
              <button type="submit" disabled={loading || code.length !== 6} className={primaryBtn}>
                {loading ? 'Updating…' : 'Set new password'}
              </button>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={requestCode} disabled={loading || resendIn > 0}
                  className="font-bold text-[#3A7D7C] hover:underline disabled:opacity-50 disabled:no-underline">
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Didn't get it? Send a new code"}
                </button>
                <button type="button" onClick={startOver} disabled={loading} className="font-bold text-[#64748B] hover:underline">
                  Use different details
                </button>
              </div>
            </form>
          )}

          <div className="text-center pt-3 border-t border-[#D7E5E8]">
            <Link to="/admin/login" className="inline-flex items-center gap-1 text-xs font-bold text-[#3A7D7C] hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
