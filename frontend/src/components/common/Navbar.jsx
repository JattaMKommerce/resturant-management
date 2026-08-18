import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { LogOut, User, Bell, Wifi, WifiOff, UtensilsCrossed } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <UtensilsCrossed className="w-6 h-6 text-slate-950 font-bold" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide">GRAND PALACE HMS</h1>
          <p className="text-xs text-amber-400 font-medium">Restaurant & KOT System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Realtime Status Indicator */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
          connected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          {connected ? <Wifi className="w-3.5 h-3.5 animate-pulse" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{connected ? 'Realtime Connected' : 'Disconnected'}</span>
        </div>

        {/* User Info & Logout */}
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-semibold text-slate-200">{user.name}</div>
              <div className="text-xs text-slate-400 capitalize">{user.role}</div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
