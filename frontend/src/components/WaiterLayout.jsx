import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  ConciergeBell, 
  Grid2X2, 
  ShoppingBag, 
  CheckSquare, 
  Receipt, 
  LogOut, 
  User, 
  Bell, 
  Utensils, 
  Volume2, 
  VolumeX, 
  Sparkles,
  Coffee,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function WaiterLayout({ children, readyCount = 0 }) {
  const { user, logout } = useAuth();
  const { socket, joinRoom } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    joinRoom('waiter');
  }, [socket]);

  const handleLogout = () => {
    logout();
    navigate('/waiter/login');
  };

  const navItems = [
    { name: 'Live Orders & Tables', path: '/waiter/dashboard', icon: Grid2X2, exact: true },
    { name: 'Ready Food for Pickup', path: '/waiter/ready', icon: ConciergeBell, badge: readyCount }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Dedicated Waiter Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed inset-y-0 z-30 shadow-2xl text-slate-300 select-none">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-orange-500/20">
            <ConciergeBell className="w-5 h-5 text-slate-950" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-white leading-tight truncate">Service Staff Portal</h1>
            <p className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">Waiter Station</p>
          </div>
        </div>

        {/* Waiter Profile Badge */}
        <div className="mx-3 mt-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'W'}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Logged In Staff</span>
              <span className="font-bold text-white text-xs block truncate">{user?.name || 'Service Waiter'}</span>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Online & Connected"></span>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 mt-2">
          <p className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Service Navigation</p>
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={idx}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                {item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-slate-950 text-amber-400' : 'bg-rose-500 text-white animate-bounce'}`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
          <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>Shift Active</span>
            </span>
            <span className="text-emerald-400 font-bold">● Ready</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Shift / Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pl-64">
        {/* Top Service Header */}
        <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold flex items-center gap-1.5">
              <ConciergeBell className="w-3.5 h-3.5" /> Floor Service Mode
            </span>
            <h2 className="text-sm font-bold text-slate-300 hidden sm:block">
              Table & Kitchen Dispatch Station
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                soundEnabled 
                  ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
              title={soundEnabled ? 'Audio Chime Enabled' : 'Audio Chime Muted'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Audio ON' : 'Audio Muted'}</span>
            </button>

            {/* Shift User Info */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-white leading-tight">{user?.name || 'Waiter'}</p>
                <p className="text-[10px] text-slate-400">Service Staff</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-6 bg-slate-950 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
