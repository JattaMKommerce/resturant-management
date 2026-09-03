import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  Phone, User, ArrowRight, ShieldCheck, Sparkles, MessageSquare,
  CheckCircle2, RotateCcw, AlertCircle, Utensils, Star, Lock,
  ChevronRight, ArrowLeft, Flame, Award
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:5000');

const getMediaUrl = (url, fallback) => {
  if (!url) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function CustomerAuthPage({ overrideSlug, onSkip, onSuccessRedirect }) {
  const params = useParams();
  const slug = overrideSlug || params.slug || 'grand-palace';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser } = useAuth();

  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'SIGNUP' : 'LOGIN'); // 'LOGIN' or 'SIGNUP'
  const [step, setStep] = useState('PHONE'); // 'PHONE' or 'OTP'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpPreview, setOtpPreview] = useState(null);
  const [whatsappLink, setWhatsappLink] = useState(null);

  const [restaurant, setRestaurant] = useState(null);
  const [loadingRest, setLoadingRest] = useState(true);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const digitRefs = [useRef(), useRef(), useRef(), useRef()];

  // Fetch restaurant branding
  useEffect(() => {
    if (slug) {
      api.get(`/restaurants/${slug}`)
        .then(res => {
          if (res.data?.success && res.data.restaurant) {
            setRestaurant(res.data.restaurant);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingRest(false));
    }
  }, [slug]);

  // If already logged in, redirect to menu or portal
  useEffect(() => {
    if (user && !loadingRest) {
      if (onSuccessRedirect) {
        onSuccessRedirect();
      } else {
        navigate(`/restaurant/${slug}`);
      }
    }
  }, [user, loadingRest]);

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    const clean = phone.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length < 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (mode === 'SIGNUP' && !name.trim()) {
      setError('Please enter your full name to create your account.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/customer/send-otp', {
        phone: clean,
        name: name.trim() || undefined,
        restaurantId: restaurant?.id || 1
      });

      if (res.data.success) {
        setOtpPreview(res.data.otpPreview);
        setWhatsappLink(res.data.whatsappDeepLink);
        setStep('OTP');
        setTimeout(() => {
          if (digitRefs[0].current) digitRefs[0].current.focus();
        }, 200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index, value) => {
    if (value.length > 1) {
      const pasted = value.replace(/[^0-9]/g, '').slice(0, 4).split('');
      const newDigits = [...otpDigits];
      pasted.forEach((d, idx) => {
        if (index + idx < 4) newDigits[index + idx] = d;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(index + pasted.length, 3);
      if (digitRefs[nextIdx].current) digitRefs[nextIdx].current.focus();
      if (newDigits.every(d => d !== '')) {
        verifyCode(newDigits.join(''));
      }
      return;
    }

    const clean = value.replace(/[^0-9]/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = clean;
    setOtpDigits(newDigits);

    if (clean && index < 3 && digitRefs[index + 1].current) {
      digitRefs[index + 1].current.focus();
    }

    // Do not auto-submit on typing 4th digit so the user has full control and time
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      if (digitRefs[index - 1].current) digitRefs[index - 1].current.focus();
    }
  };

  const verifyingRef = useRef(false);

  const verifyCode = async (codeToVerify) => {
    if (verifyingRef.current) return;

    const code = codeToVerify || otpDigits.join('');
    if (code.length < 4) {
      setError('Please enter all 4 digits of the verification code.');
      return;
    }

    verifyingRef.current = true;
    setVerifying(true);
    setError(null);
    try {
      const clean = phone.replace(/[^0-9]/g, '').slice(-10);
      const res = await api.post('/auth/customer/verify-otp', {
        phone: clean,
        otp: code,
        name: name.trim() || undefined,
        restaurantId: restaurant?.id || 1
      });

      if (res.data.success) {
        localStorage.setItem('hotel_token', res.data.token);
        localStorage.setItem('hotel_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        setSuccessMsg(res.data.message || 'Verification successful! Welcome.');

        setTimeout(() => {
          if (onSuccessRedirect) {
            onSuccessRedirect();
          } else {
            navigate(`/restaurant/${slug}`);
          }
        }, 600);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP code.');
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const logoImg = getMediaUrl(
    restaurant?.logo_url,
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between relative overflow-hidden selection:bg-emerald-500 selection:text-white">
      
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-teal-500/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 max-w-5xl mx-auto w-full px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={logoImg}
            alt={restaurant?.name || 'Restaurant'}
            className="w-10 h-10 rounded-2xl object-cover border border-white/20 shadow-md bg-white p-0.5"
          />
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white">{restaurant?.name || 'Grand Palace'}</h1>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
              ● Kratu Rewards Storefront
            </span>
          </div>
        </div>

        {onSkip && (
          <button
            onClick={onSkip}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-xl hover:bg-white/10"
          >
            Skip & Browse Menu →
          </button>
        )}
      </header>

      {/* Main Hero Card Container */}
      <main className="relative z-10 max-w-md mx-auto w-full px-4 py-8">
        
        {/* Glowing glass container */}
        <div className="rounded-[2.5rem] bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-white/15 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6">
          
          {/* Segmented Mode Switcher (Login vs Sign Up) */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setStep('PHONE');
                setError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'LOGIN'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔑 Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('SIGNUP');
                setStep('PHONE');
                setError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'SIGNUP'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>New Account</span>
            </button>
          </div>

          {/* Heading */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black tracking-tight text-white">
              {step === 'PHONE'
                ? mode === 'LOGIN'
                  ? 'Welcome Back!'
                  : 'Create Your Account'
                : 'Enter Verification Code'}
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {step === 'PHONE'
                ? mode === 'LOGIN'
                  ? 'Enter your registered mobile number to access your Kratu Rewards and order history.'
                  : 'Sign up in 30 seconds to unlock welcome cashback rewards on your meal!'
                : `Enter the 4-digit code sent to +91 ${phone}`}
            </p>
          </div>

          {/* Alert messages */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: PHONE & NAME INPUT */}
          {step === 'PHONE' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              
              {mode === 'SIGNUP' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">Your Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Nithin Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                      required={mode === 'SIGNUP'}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">Mobile Number *</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1.5 text-slate-400 font-bold text-xs border-r border-white/10 pr-2.5 pointer-events-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-20 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 font-mono text-sm font-bold text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    required
                    autoFocus
                  />
                </div>
                <span className="text-[11px] text-slate-400 block pt-0.5">
                  {mode === 'SIGNUP'
                    ? '🎁 New members receive instant welcome Kratu Rewards cashback.'
                    : 'We will verify your number securely in 1 tap.'}
                </span>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all transform active:scale-[0.98] cursor-pointer"
              >
                {loading ? (
                  <span>Sending Verification Code...</span>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>
          ) : (
            /* STEP 2: HIGH-AESTHETIC OTP INPUT */
            <div className="space-y-5">
              
              {/* 4 Glowing Digit Boxes */}
              <div className="flex items-center justify-center gap-3.5 py-1">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={digitRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-14 h-16 text-center font-mono text-2xl font-black rounded-2xl bg-white/10 border-2 border-white/20 text-white focus:border-emerald-400 focus:bg-white/15 focus:ring-4 focus:ring-emerald-500/30 outline-none transition-all shadow-inner"
                  />
                ))}
              </div>

              {/* 100% Free WhatsApp Option */}
              {whatsappLink && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/70 to-slate-900 border border-emerald-500/40 text-center space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-300">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>Free WhatsApp Verification</span>
                  </div>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <span>📲 Open WhatsApp (Send Pre-Filled Code)</span>
                  </a>
                </div>
              )}

              {/* Instant 1-Tap Demo Code Fill */}
              {otpPreview && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-slate-400 font-medium">Quick Demo Test Code:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const digits = otpPreview.split('');
                      setOtpDigits(digits);
                      setError(null);
                    }}
                    className="font-mono font-bold text-emerald-300 hover:text-white bg-emerald-500/20 hover:bg-emerald-500/40 px-3 py-1.5 rounded-xl border border-emerald-500/40 transition-colors cursor-pointer"
                  >
                    ⚡ Auto-Fill Code ({otpPreview})
                  </button>
                </div>
              )}

              {/* Back / Resend */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  className="font-bold hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Change Number</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors"
                >
                  Resend Code
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={() => verifyCode()}
                disabled={verifying || otpDigits.some(d => d === '')}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all transform active:scale-[0.98] cursor-pointer"
              >
                {verifying ? (
                  <span>Verifying Code...</span>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>

            </div>
          )}

          {/* Loyalty Guarantee Banner */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-amber-300 font-bold">
              <Award className="w-3.5 h-3.5" />
              <span>Earn Up to 10% Cashback</span>
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <Lock className="w-3 h-3" />
              <span>256-bit Encrypted</span>
            </span>
          </div>

        </div>

        {/* Guest fallback button */}
        {onSkip && (
          <div className="text-center mt-6">
            <button
              onClick={onSkip}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Just hungry? <span className="underline underline-offset-4 text-emerald-400">Continue to Food Menu as Guest →</span>
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full px-6 py-4 text-center text-[11px] text-slate-600">
        Powered by Kratu Hospitality Solutions • {restaurant?.name || 'Grand Palace'}
      </footer>

    </div>
  );
}
