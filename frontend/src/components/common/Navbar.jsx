import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { LogOut, User, Bell, Wifi, WifiOff, UtensilsCrossed } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#D7E5E8] shadow-xs px-6 flex items-center justify-between sticky top-0 z-30 font-sans antialiased">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#3A7D7C] flex items-center justify-center text-white shadow-xs">
          <UtensilsCrossed className="w-5 h-5 font-bold" />
        </div>
        <div>
          <h1 className="text-base font-bold text-[#1F2937] tracking-tight">GRAND PALACE HMS</h1>
          <p className="text-[10px] text-[#3A7D7C] font-bold uppercase tracking-wider">Restaurant & KOT System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Realtime Status Indicator */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
          connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{connected ? 'Realtime Connected' : 'Disconnected'}</span>
        </div>

        {/* User Info & Logout */}
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-[#D7E5E8]">
            <div className="w-9 h-9 rounded-full bg-[#3A7D7C] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-[#1F2937]">{user.name}</div>
              <div className="text-[10px] text-[#64748B] font-semibold capitalize">{user.role}</div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-[#64748B] hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors shadow-2xs"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
