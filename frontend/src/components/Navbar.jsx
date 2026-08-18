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
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand / Logo */}
          <Link to={`/restaurant/${slug}`} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 tracking-tight block">Online Ordering</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-orange-600 block -mt-1">Fine Dining & Delivery</span>
            </div>
          </Link>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-600">
            <Link to={`/restaurant/${slug}`} className="hover:text-orange-600 transition-colors flex items-center gap-1.5">
              <Compass className="w-4 h-4" /> Menu & Offers
            </Link>
            {user && (user.role === 'ADMIN' || user.role === 'RESTAURANT_ADMIN') && (
              <Link to="/admin" className="text-orange-600 font-semibold flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors">
                <Shield className="w-4 h-4" /> Admin Portal
              </Link>
            )}
            {user && user.role === 'SUPER_ADMIN' && (
              <Link to="/super-admin" className="text-purple-600 font-semibold flex items-center gap-1.5 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors">
                <Shield className="w-4 h-4" /> Super Admin
              </Link>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            
            {/* Cart Button - Visible to all customers */}
            <Link
              to={`/restaurant/${slug}/checkout`}
              className="relative flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-md shadow-orange-500/20 transition-all hover:shadow-orange-500/30 active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {itemCount > 0 && (
                <span className="bg-white text-orange-600 font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Auth Info / Portal Access */}
            {user ? (
              <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                <div className="text-right hidden sm:block">
                  <span className="block text-xs font-semibold text-slate-800">{user.name}</span>
                  <span className="block text-[10px] text-slate-500 uppercase font-bold">{user.role}</span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate(`/restaurant/${slug}`);
                  }}
                  title="Logout"
                  className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                <Link
                  to="/admin/login"
                  className="text-xs font-semibold text-slate-700 hover:text-orange-600 px-3 py-2 rounded-lg transition-colors"
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
