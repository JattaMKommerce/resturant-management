import React, { useState, useEffect } from 'react';
import { Sparkles, XCircle, Clock } from 'lucide-react';

/**
 * SubscriptionCountdownBadge
 * High-precision server-authoritative live ticking countdown pill.
 * Lightweight, subtle, and non-intrusive.
 */
export default function SubscriptionCountdownBadge({ subscription, onExpire, compact = true, onOpenRenew = null }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    totalMs: 0
  });

  useEffect(() => {
    if (!subscription || !subscription.expires_at || subscription.status !== 'ACTIVE') return;

    // Server-authoritative drift offset
    const serverTimeMs = subscription.server_time ? new Date(subscription.server_time).getTime() : Date.now();
    const driftOffset = Date.now() - serverTimeMs;
    const expiryMs = new Date(subscription.expires_at).getTime();

    const calculateRemaining = () => {
      const currentServerTime = Date.now() - driftOffset;
      const diff = expiryMs - currentServerTime;

      if (diff <= 0 || subscription.status === 'EXPIRED') {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          totalMs: 0
        });
        if (onExpire && typeof onExpire === 'function') {
          onExpire();
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
        totalMs: diff
      });
    };

    calculateRemaining();
    const timer = setInterval(calculateRemaining, 1000);

    return () => clearInterval(timer);
  }, [subscription, onExpire]);

  if (!subscription) return null;

  const isTrial = subscription.is_trial || subscription.subscription_type === 'TRIAL' || subscription.plan_slug === 'free-trial';
  const isPendingApproval = subscription.status === 'PENDING_APPROVAL';
  const isRejected = subscription.status === 'REJECTED';
  const isExpired = subscription.status === 'EXPIRED' || (!subscription.has_subscription && !isPendingApproval && !isRejected);
  const isExpiringSoon = subscription.status === 'ACTIVE' && (subscription.is_expiring_soon || (timeLeft.totalMs > 0 && timeLeft.totalMs <= 3 * 24 * 60 * 60 * 1000));

  const planLabel = isTrial ? 'Free Trial' : (subscription.plan_name || 'Plan');

  if (isPendingApproval) {
    return (
      <button
        onClick={onOpenRenew}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs hover:bg-amber-100 transition-all cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        <span>Offline Verification Pending</span>
      </button>
    );
  }

  if (isRejected) {
    return (
      <button
        onClick={onOpenRenew}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs hover:bg-rose-100 transition-all cursor-pointer"
      >
        <XCircle className="w-3.5 h-3.5 text-rose-600" />
        <span>Request Rejected</span>
      </button>
    );
  }

  if (isExpired) {
    return (
      <button
        onClick={onOpenRenew}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs hover:bg-rose-100 transition-all cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
        <span>{isTrial ? 'Free Trial Ended' : 'Subscription Expired'}</span>
        <span className="underline ml-1">Upgrade</span>
      </button>
    );
  }

  // ACTIVE Trial or Paid live pill
  return (
    <button
      onClick={onOpenRenew}
      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs transition-all cursor-pointer ${
        isTrial
          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
          : isExpiringSoon
          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
          : 'bg-[#EAF4F7] text-[#1F2937] border-[#D7E5E8] hover:bg-[#D7E5E8]'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${isTrial ? 'bg-emerald-500 animate-pulse' : isExpiringSoon ? 'bg-amber-500 animate-pulse' : 'bg-[#3A7D7C]'}`} />
      <span className="font-semibold text-[#64748B]">{planLabel}:</span>
      <span className="font-mono font-bold tracking-tight">
        {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
      </span>
    </button>
  );
}
