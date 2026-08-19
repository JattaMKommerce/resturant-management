import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';

export default function LiveTimerBadge({
  startedAt,
  expectedFinishAt,
  readyAt,
  prepTimeMinutes = 15,
  status,
  currentTime,
  receivedAt,
  targetAt
}) {
  const [localTime, setLocalTime] = useState(Date.now());

  useEffect(() => {
    if (currentTime) return;

    const interval = setInterval(() => {
      setLocalTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTime]);

  const now = currentTime || localTime;

  // 1. Ready / Served State
  if (status === 'READY' || status === 'SERVED') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
        <span>Ready</span>
      </div>
    );
  }

  // 2. Cancelled State
  if (status === 'CANCELLED') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-[#64748B] border border-[#D7E5E8]">
        <span>Cancelled</span>
      </div>
    );
  }

  const effectiveStartedAt = startedAt || (status === 'PREPARING' ? receivedAt : null);
  const effectiveExpectedAt = expectedFinishAt || (effectiveStartedAt ? new Date(new Date(effectiveStartedAt).getTime() + prepTimeMinutes * 60000) : targetAt);

  // 3. Not Started / Pending / Accepted State
  if (!effectiveStartedAt || (status !== 'PREPARING' && !startedAt)) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-[#64748B] border border-[#D7E5E8]">
        <Clock className="w-3.5 h-3.5 shrink-0 text-[#64748B]" />
        <span className="font-mono">Not Started</span>
      </div>
    );
  }

  // 4. Timer Active (Preparing)
  const startTime = new Date(effectiveStartedAt).getTime();
  const expectedTime = effectiveExpectedAt ? new Date(effectiveExpectedAt).getTime() : startTime + prepTimeMinutes * 60000;
  const remainingSeconds = Math.floor((expectedTime - now) / 1000);

  if (remainingSeconds <= 0) {
    // 🔴 LATE (Soft Red Indicator - Calm & Eye-Comfortable)
    const overdueSecs = Math.abs(remainingSeconds);
    const overdueMins = Math.floor(overdueSecs / 60);
    const overdueSecsRemainder = overdueSecs % 60;
    const formattedOverdue = `+${overdueMins.toString().padStart(2, '0')}:${overdueSecsRemainder.toString().padStart(2, '0')}`;

    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
        <span className="font-mono">{formattedOverdue}</span>
        <span className="text-[11px] font-semibold text-rose-700">Late</span>
      </div>
    );
  } else if (remainingSeconds <= 300) {
    // 🟡 GETTING LATE (Soft Amber/Yellow Indicator <= 5 minutes)
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
        <span className="font-mono">{formatted}</span>
        <span className="text-[11px] font-semibold text-amber-700">Getting Late</span>
      </div>
    );
  } else {
    // 🟢 ON TIME (Calm Green Indicator > 5 minutes)
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <Clock className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
        <span className="font-mono">{formatted}</span>
        <span className="text-[11px] font-semibold text-emerald-700">On Time</span>
      </div>
    );
  }
}
