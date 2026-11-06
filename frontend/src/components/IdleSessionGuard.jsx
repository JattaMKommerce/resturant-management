import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Automatic session timeout for the admin panel (REQ-014).
 *
 * - Logs the admin out after a period with no mouse, keyboard, touch or scroll activity.
 * - Activity in any open tab keeps the session alive (shared via localStorage), and coming back
 *   to a tab after the limit has passed (e.g. the laptop slept) logs out immediately.
 * - Shows a "Stay signed in" warning for the last 2 minutes.
 * - Live monitoring screens (Live Orders & Dispatch, Unclaimed Orders) are meant to be left open
 *   during service so new-order sounds keep working; they use a longer limit.
 *
 * Limits can be changed at build time with VITE_ADMIN_IDLE_MINUTES (default 30) and
 * VITE_MONITOR_IDLE_MINUTES (default 480 = one 8-hour shift).
 */
const ACTIVITY_KEY = 'hotel_last_activity';
const DEFAULT_IDLE_MIN = Number(import.meta.env.VITE_ADMIN_IDLE_MINUTES) || 30;
const MONITOR_IDLE_MIN = Number(import.meta.env.VITE_MONITOR_IDLE_MINUTES) || 480;
const WARNING_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'];

function isMonitorScreen(pathname) {
  // /admin/<slug> (Live Orders & Dispatch) and /admin/<slug>/unclaimed
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] !== 'admin' || parts.length < 2) return false;
  const reserved = ['offline', 'accommodation', 'history', 'wallet', 'subscription', 'login'];
  if (reserved.includes(parts[1])) return false;
  return parts.length === 2 || (parts.length === 3 && parts[2] === 'unclaimed');
}

function readLastActivity() {
  const v = Number(localStorage.getItem(ACTIVITY_KEY));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export default function IdleSessionGuard({ loginPath = '/admin/login' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [secondsLeft, setSecondsLeft] = useState(null);
  const lastWrite = useRef(0);

  const limitMs = (isMonitorScreen(location.pathname) ? MONITOR_IDLE_MIN : DEFAULT_IDLE_MIN) * 60 * 1000;

  const markActive = useCallback(() => {
    const now = Date.now();
    // Throttle writes: once every 5 seconds is plenty.
    if (now - lastWrite.current > 5000) {
      lastWrite.current = now;
      localStorage.setItem(ACTIVITY_KEY, String(now));
    }
  }, []);

  const signOut = useCallback(() => {
    const minutes = Math.round(limitMs / 60000);
    logout(`You were logged out after ${minutes} minutes of inactivity. Please log in again.`);
    navigate(loginPath, { replace: true });
  }, [limitMs, logout, navigate, loginPath]);

  useEffect(() => {
    if (!user) return undefined;

    // Coming back after the limit (tab was closed / computer slept): log out right away.
    const last = readLastActivity();
    if (last && Date.now() - last > limitMs) {
      signOut();
      return undefined;
    }
    if (!last) localStorage.setItem(ACTIVITY_KEY, String(Date.now()));

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));

    const tick = setInterval(() => {
      const idleFor = Date.now() - (readLastActivity() || Date.now());
      const remaining = limitMs - idleFor;
      if (remaining <= 0) {
        clearInterval(tick);
        signOut();
      } else if (remaining <= WARNING_MS) {
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, markActive));
    };
  }, [user, limitMs, markActive, signOut]);

  if (!user || secondsLeft === null) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-[#D7E5E8] text-center space-y-3">
        <div className="mx-auto w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <h2 id="idle-title" className="text-base font-bold text-slate-800">Are you still there?</h2>
        <p className="text-sm text-slate-600">
          For security you will be logged out in <strong className="font-mono">{mm}:{ss}</strong> because there has been no activity.
        </p>
        <div className="flex gap-2 justify-center pt-1">
          <button
            type="button"
            onClick={() => { lastWrite.current = 0; markActive(); setSecondsLeft(null); }}
            className="px-4 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-sm font-bold"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={signOut}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold"
          >
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}
