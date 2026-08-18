import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bike, LogOut, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DriverLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Driver Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-emerald-500/20">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-white text-base leading-tight">Driver Partner</h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Active Duty Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="block text-xs font-bold text-slate-200">{user?.name}</span>
            <span className="block text-[10px] text-slate-400">{user?.phone}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/driver/login');
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4">
        {children}
      </main>
    </div>
  );
}
