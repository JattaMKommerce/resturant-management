import React, { useState, useRef, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Phone, User, X, Loader2, ArrowRight, ShieldCheck, Sparkles, MessageSquare, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';

export default function CustomerAuthModal({ isOpen, onClose, restaurant, onSuccess }) {
  const { setUser } = useAuth();

  const [step, setStep] = useState('PHONE'); // 'PHONE' or 'OTP'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpPreview, setOtpPreview] = useState(null);
  const [whatsappLink, setWhatsappLink] = useState(null);

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const digitRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setStep('PHONE');
      setPhone('');
      setName('');
      setOtpDigits(['', '', '', '']);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    const clean = phone.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
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
        setIsNewUser(res.data.isNewUser);
        setOtpPreview(res.data.otpPreview);
        setWhatsappLink(res.data.whatsappDeepLink);
        setStep('OTP');
        setTimeout(() => {
          if (digitRefs[0].current) digitRefs[0].current.focus();
        }, 150);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please check your number.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste
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

    if (newDigits.every(d => d !== '')) {
      verifyCode(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      if (digitRefs[index - 1].current) digitRefs[index - 1].current.focus();
    }
  };

  const verifyCode = async (codeToVerify) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length < 4) {
      setError('Please enter the complete 4-digit code.');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const res = await api.post('/auth/customer/verify-otp', {
        phone,
        otp: code,
        name: name.trim() || undefined,
        restaurantId: restaurant?.id || 1
      });

      if (res.data.success) {
        localStorage.setItem('hotel_token', res.data.token);
        localStorage.setItem('hotel_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        setSuccessMsg(res.data.message || 'Login successful!');

        setTimeout(() => {
          if (onSuccess) onSuccess(res.data.user);
          onClose();
        }, 600);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Kratu Rewards Enabled</span>
            </span>
          </div>

          <h2 className="text-xl font-black tracking-tight text-white">
            {step === 'PHONE' ? 'Sign In or Join' : 'Verify Mobile Number'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {step === 'PHONE'
              ? `Access your loyalty rewards, track live orders, and re-order in 1 tap at ${restaurant?.name || 'Grand Palace'}.`
              : `We sent a 4-digit code to +91 ${phone}`}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'PHONE' ? (
            <form onSubmit={handleSendOtp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name (Optional)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Nithin Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number *</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center gap-1 text-slate-500 font-bold text-xs border-r border-slate-200 pr-2 pointer-events-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-16 pr-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                    autoFocus
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  We'll check your account or create one instantly with WhatsApp verification.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with Mobile</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              
              {/* 4 Digit Boxes */}
              <div className="flex items-center justify-center gap-3 py-2">
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
                    className="w-13 h-14 text-center font-mono text-2xl font-black rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                ))}
              </div>

              {/* Free WhatsApp 1-Tap Option (User & MD Blueprint) */}
              {whatsappLink && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <span className="text-xs text-emerald-950 font-bold block flex items-center justify-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Free WhatsApp Verification</span>
                  </span>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all"
                  >
                    <span>📲 Open in WhatsApp (1-Tap Send)</span>
                  </a>
                </div>
              )}

              {/* 1-Tap Quick Fill Demo Code */}
              {otpPreview && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">Demo Testing Code:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const digits = otpPreview.split('');
                      setOtpDigits(digits);
                      verifyCode(otpPreview);
                    }}
                    className="font-mono font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    ⚡ Fill Code ({otpPreview})
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  className="font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Change Number</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  Resend Code
                </button>
              </div>

              <button
                type="button"
                onClick={() => verifyCode()}
                disabled={verifying || otpDigits.some(d => d === '')}
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </>
                )}
              </button>
            </div>
          )}

        </div>

        {/* Footer Note */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
          🔒 Secure 256-bit login • Your Kratu loyalty credits are safely encrypted.
        </div>

      </div>
    </div>
  );
}
