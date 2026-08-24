import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, UtensilsCrossed, LogOut, Compass, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { getItemCount, restaurantSlug } = useCart();
  const navigate = useNavigate();
  const itemCount = getItemCount();
  const slug = restaurantSlug || 'grand-palace';

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#D7E5E8] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand / Logo */}
          <Link to={`/restaurant/${slug}`} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#3A7D7C] flex items-center justify-center text-white shadow-xs group-hover:bg-[#2F6665] transition-colors">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-[#1F2937] tracking-tight block leading-tight">Online Ordering</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#3A7D7C] block">Fine Dining & Delivery</span>
            </div>
          </Link>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-6 font-semibold text-sm text-[#64748B]">
            <Link to={`/restaurant/${slug}`} className="hover:text-[#3A7D7C] transition-colors flex items-center gap-1.5">
              <Compass className="w-4 h-4" /> Menu & Offers
            </Link>
            {user && (user.role === 'ADMIN' || user.role === 'RESTAURANT_ADMIN') && (
              <Link to="/admin" className="text-[#3A7D7C] font-bold flex items-center gap-1.5 bg-[#EAF4F7] px-3 py-1.5 rounded-xl border border-[#D7E5E8] hover:bg-[#EAF4F7]/80 transition-colors">
                <Shield className="w-4 h-4" /> Admin Portal
              </Link>
            )}
            {user && user.role === 'SUPER_ADMIN' && (
              <Link to="/super-admin" className="text-[#3A7D7C] font-bold flex items-center gap-1.5 bg-[#EAF4F7] px-3 py-1.5 rounded-xl border border-[#D7E5E8] hover:bg-[#EAF4F7]/80 transition-colors">
                <Shield className="w-4 h-4" /> Super Admin
              </Link>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            
            {/* Cart Button */}
            <Link
              to={`/restaurant/${slug}/checkout`}
              className="relative flex items-center gap-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {itemCount > 0 && (
                <span className="bg-white text-[#3A7D7C] font-black text-xs w-5 h-5 rounded-full flex items-center justify-center shadow-2xs">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Auth Info / Portal Access */}
            {user ? (
              <div className="flex items-center gap-3 border-l border-[#D7E5E8] pl-3">
                <div className="text-right hidden sm:block">
                  <span className="block text-xs font-bold text-[#1F2937]">{user.name}</span>
                  <span className="block text-[10px] text-[#64748B] uppercase font-semibold">{user.role}</span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate(`/restaurant/${slug}`);
                  }}
                  title="Logout"
                  className="p-2 rounded-xl text-[#64748B] hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-l border-[#D7E5E8] pl-3">
                <Link
                  to="/admin/login"
                  className="text-xs font-bold text-[#1F2937] hover:text-[#3A7D7C] hover:bg-[#EAF4F7] px-3 py-2 rounded-xl transition-colors border border-transparent hover:border-[#D7E5E8]"
                >
                  Admin Login
                </Link>
              </div>
            )}

          </div>

        </div>
      </div>
    </nav>
  );
}
