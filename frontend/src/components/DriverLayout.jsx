import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bike, LogOut, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DriverLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col font-sans antialiased">
      {/* Driver Light Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#D7E5E8] shadow-xs px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold shadow-xs">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-[#1F2937] text-base leading-tight">Driver Partner</h1>
            <p className="text-[10px] text-[#3A7D7C] font-bold uppercase tracking-wider">Active Duty Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="block text-xs font-bold text-[#1F2937]">{user?.name}</span>
            <span className="block text-[10px] text-[#64748B] font-semibold">{user?.phone}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/driver/login');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl mx-auto w-full p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
