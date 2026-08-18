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
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
        <span>✓ Ready</span>
      </div>
    );
  }

  // 2. Cancelled State
  if (status === 'CANCELLED') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        <span>CANCELLED</span>
      </div>
    );
  }

  const effectiveStartedAt = startedAt || (status === 'PREPARING' ? receivedAt : null);
  const effectiveExpectedAt = expectedFinishAt || (effectiveStartedAt ? new Date(new Date(effectiveStartedAt).getTime() + prepTimeMinutes * 60000) : targetAt);

  // 3. Not Started / Pending / Accepted State
  if (!effectiveStartedAt || (status !== 'PREPARING' && !startedAt)) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-800/90 text-slate-400 border border-slate-700">
        <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
        <span className="font-mono">⏱ Not Started</span>
      </div>
    );
  }

  // 4. Timer Active (Preparing)
  const startTime = new Date(effectiveStartedAt).getTime();
  const expectedTime = effectiveExpectedAt ? new Date(effectiveExpectedAt).getTime() : startTime + prepTimeMinutes * 60000;
  const remainingSeconds = Math.floor((expectedTime - now) / 1000);

  if (remainingSeconds <= 0) {
    // 🔴 LATE / OVERDUE State
    const overdueSecs = Math.abs(remainingSeconds);
    const overdueMins = Math.floor(overdueSecs / 60);
    const overdueSecsRemainder = overdueSecs % 60;
    const formattedOverdue = `+${overdueMins.toString().padStart(2, '0')}:${overdueSecsRemainder.toString().padStart(2, '0')}`;

    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/60 animate-pulse shadow-md shadow-rose-500/20">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
        <span className="font-mono text-sm">⏱ {formattedOverdue}</span>
        <span className="font-bold">🔴 Late</span>
      </div>
    );
  } else if (remainingSeconds <= 300) {
    // 🟡 GETTING LATE State (<= 5 minutes)
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50">
        <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
        <span className="font-mono text-sm">⏱ {formatted}</span>
        <span className="font-bold">🟡 Getting Late</span>
      </div>
    );
  } else {
    // 🟢 ON TIME State (> 5 minutes)
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
        <Clock className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
        <span className="font-mono text-sm">⏱ {formatted}</span>
        <span className="font-bold">🟢 On Time</span>
      </div>
    );
  }
}
