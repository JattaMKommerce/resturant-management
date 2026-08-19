import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  ConciergeBell, 
  Grid2X2, 
  ShoppingBag, 
  CheckSquare2, 
  Receipt, 
  LogOut, 
  User, 
  Bell, 
  Utensils, 
  Volume2, 
  VolumeX, 
  Sparkles,
  Coffee,
  CheckCircle2,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChefHat,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function WaiterLayout({ children, readyCount = 0 }) {
  const { user, logout } = useAuth();
  const { socket, joinRoom } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('waiter_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    joinRoom('waiter');
  }, [socket]);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('waiter_sidebar_collapsed', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/waiter/login');
  };

  const navItems = [
    { name: 'Live Orders & Tables', path: '/waiter/dashboard', icon: Grid2X2, exact: true },
    { name: 'Ready Food for Pickup', path: '/waiter/ready', icon: ConciergeBell, badge: readyCount }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans relative overflow-x-hidden">
      
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Dedicated Waiter Sidebar */}
      <aside 
        className={`
          bg-slate-900 border-r border-slate-800 flex flex-col fixed inset-y-0 left-0 z-50
          shadow-2xl text-slate-300 select-none transition-all duration-300 ease-in-out
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          w-72 max-w-[85vw]
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className={`p-4 border-b border-slate-800/80 bg-slate-950/90 flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-between'} justify-between h-16`}>
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-orange-500/20 shrink-0">
              <ConciergeBell className="w-5 h-5 text-slate-950" />
            </div>
            <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
              <h1 className="text-sm font-black text-white leading-tight truncate">Service Staff</h1>
              <p className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">Waiter Station</p>
            </div>
          </div>

          {/* Mobile Close Button (Always visible on mobile drawer) */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Button */}
          <button
            type="button"
            onClick={toggleCollapse}
            className={`hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${isCollapsed ? 'hidden' : ''}`}
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Waiter Profile Badge */}
        <div className={`p-3 ${isCollapsed ? 'lg:p-2' : ''}`}>
          <div className={`p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center ${isCollapsed ? 'lg:justify-center lg:p-2' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
                <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider truncate">Active Waiter</span>
                <span className="font-bold text-white text-xs block truncate">{user?.name || 'Service Staff'}</span>
              </div>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0 ${isCollapsed ? 'lg:hidden' : 'block'}`} title="Online & Connected"></span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'lg:px-2' : 'px-3'} px-3 py-2 space-y-1.5 sidebar-scroll`}>
          <p className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
            Service Navigation
          </p>

          {navItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={idx}
                to={item.path}
                end={item.exact}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center ${
                    isCollapsed
                      ? 'lg:justify-center lg:w-10 lg:h-10 lg:p-0 lg:mx-auto group relative'
                      : 'justify-between'
                  } px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'inline'}`}>{item.name}</span>
                </div>

                {/* Badge for regular & mobile view */}
                {item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isCollapsed ? 'lg:hidden' : 'inline-block'} bg-rose-500 text-white animate-bounce`}>
                    {item.badge}
                  </span>
                )}

                {/* Collapsed Tooltip (desktop only) */}
                {isCollapsed && (
                  <div className="fixed left-20 ml-2 px-2.5 py-1 bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-lg shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap hidden lg:flex items-center gap-1.5">
                    <span>{item.name}</span>
                    {item.badge > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t border-slate-800 bg-slate-950/80 ${isCollapsed ? 'lg:p-2 lg:flex lg:flex-col lg:items-center lg:gap-2' : 'space-y-2'}`}>
          <div className={`flex items-center justify-between px-2 text-[11px] text-slate-400 ${isCollapsed ? 'lg:hidden' : 'flex'}`}>
            <span className="flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>Shift Active</span>
            </span>
            <span className="text-emerald-400 font-bold">● Ready</span>
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${
              isCollapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:p-0' : 'justify-center'
            } gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors`}
            title="End Shift / Log Out"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className={isCollapsed ? 'lg:hidden' : 'inline'}>End Shift / Log Out</span>
          </button>

          {/* Expand trigger button when collapsed on desktop */}
          {isCollapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden lg:flex w-10 h-10 rounded-xl items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        } pl-0`}
      >
        {/* Top Service Header */}
        <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-1 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 lg:hidden shrink-0"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Collapse Trigger */}
            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden lg:flex p-2 -ml-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>

            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold flex items-center gap-1.5 shrink-0">
              <ConciergeBell className="w-3.5 h-3.5" /> Floor Service
            </span>
            <h2 className="text-sm font-bold text-slate-300 hidden md:block truncate">
              Table & Kitchen Dispatch Station
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
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
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-white leading-tight truncate max-w-[100px]">{user?.name || 'Waiter'}</p>
                <p className="text-[10px] text-slate-400">Service Staff</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-3 sm:p-6 pb-24 lg:pb-6 bg-slate-950 overflow-y-auto">
          {children}
        </main>

        {/* Dedicated Mobile Bottom Bar for Waiter Handheld Quick Access */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2 flex items-center justify-around shadow-2xl">
          <NavLink
            to="/waiter/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'
              }`
            }
          >
            <Grid2X2 className="w-5 h-5" />
            <span className="text-[10px]">Tables & Orders</span>
          </NavLink>

          <NavLink
            to="/waiter/ready"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
                isActive ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'
              }`
            }
          >
            <div className="relative">
              <ConciergeBell className="w-5 h-5" />
              {readyCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[9px] font-black animate-bounce">
                  {readyCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">Ready Food</span>
          </NavLink>

          <button
            onClick={() => setIsMobileOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px]">More Menu</span>
          </button>
        </nav>

      </div>
    </div>
  );
}
