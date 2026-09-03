import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import CustomerAuthModal from '../../components/customer/CustomerAuthModal';
import {
  Gift, ShoppingBag, Clock, MapPin, ChevronRight, RotateCcw,
  Sparkles, CheckCircle2, ArrowRight, ShieldCheck, ArrowLeft,
  Truck, UtensilsCrossed, Phone, AlertCircle, LogOut, ChevronDown,
  Layers, User, Receipt, Star
} from 'lucide-react';

export default function CustomerPortalPage({ overrideSlug }) {
  const params = useParams();
  const slug = overrideSlug || params.slug || 'grand-palace';
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addToCart, setRestaurantSlug } = useCart();

  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ORDERS'); // 'ORDERS' or 'WALLET'
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [reordering, setReordering] = useState(null);

  useEffect(() => {
    if (!user) {
      setAuthModalOpen(true);
      setLoading(false);
      return;
    }
    loadPortal();
  }, [user, slug]);

  const loadPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/customer/portal/data?slug=${slug}`);
      if (res.data.success) {
        setPortalData(res.data.data);
      }
    } catch (err) {
      console.error('Customer portal error:', err);
      setError('Unable to load your customer portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = (order) => {
    setReordering(order.id);
    setRestaurantSlug(slug);
    if (order.items && order.items.length > 0) {
      order.items.forEach((item) => {
        addToCart(
          {
            id: item.menu_item_id,
            name: item.item_name,
            price: item.price,
            image_url: item.image_url
          },
          item.quantity || 1,
          item.notes || '',
          slug
        );
      });
    }
    setTimeout(() => {
      setReordering(null);
      navigate(`/restaurant/${slug}/checkout`);
    }, 400);
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'DELIVERED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'OUT_FOR_DELIVERY') return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
    if (s === 'PREPARING') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s === 'CANCELLED' || s === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-purple-50 text-purple-700 border-purple-200';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Customer Rewards & Orders</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Please sign in with your mobile number to view your rewards balance, track active deliveries, and re-order meals.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Sign In with Mobile OTP
          </button>
          <button
            onClick={() => navigate(`/restaurant/${slug}`)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 block mx-auto cursor-pointer"
          >
            ← Return to Restaurant Menu
          </button>
        </div>

        <CustomerAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          restaurant={portalData?.restaurant}
          onSuccess={() => loadPortal()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 mt-3">Loading your portal...</p>
      </div>
    );
  }

  const { customer, restaurant, rewards, activeOrders = [], pastOrders = [] } = portalData || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 font-sans pb-20">
      
      {/* Top Navbar */}
      <header className="border-b border-white/10 backdrop-blur-md sticky top-0 z-40 bg-slate-900/80">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            to={`/restaurant/${slug}`}
            className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {restaurant?.name || 'Menu'}</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/restaurant/${slug}`)}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Order Food</span>
            </button>
            <button
              onClick={() => {
                logout();
                navigate(`/restaurant/${slug}`);
              }}
              title="Sign Out"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Hero Customer Profile Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/90 via-slate-800/50 to-slate-900/90 border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-emerald-600/30 border border-white/20">
                {customer?.name?.charAt(0) || 'C'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white">
                    {customer?.name || 'Customer'}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-amber-300" />
                    <span>Gold VIP Guest</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  📱 +91 {customer?.phone || ''} • Verified Member
                </p>
              </div>
            </div>

            {/* Loyalty Quick Pill */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Available Rewards
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  ₹{rewards?.availableBalance || 0}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('WALLET')}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Wallet</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 max-w-sm">
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'ORDERS'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>My Orders ({activeOrders.length + pastOrders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('WALLET')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'WALLET'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Kratu Rewards</span>
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-6">
            
            {/* Live Active Orders Tracker */}
            {activeOrders.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Live In-Progress Deliveries ({activeOrders.length})</span>
                </h3>

                {activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-6 rounded-3xl bg-slate-800/80 border border-emerald-500/40 shadow-xl backdrop-blur-md space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">Order #{order.id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${getStatusBadge(order.order_status)}`}>
                            {order.order_status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Estimated Delivery to: <strong className="text-white">{order.delivery_address || 'Hotel Room / Table'}</strong>
                        </p>
                      </div>

                      <span className="font-mono font-black text-base text-white">
                        ₹{order.total_amount}
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="py-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
                        <span className="text-emerald-400">Kitchen</span>
                        <span className={order.order_status === 'OUT_FOR_DELIVERY' ? 'text-emerald-400' : ''}>On the Way 🛵</span>
                        <span>Delivered 🎉</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{
                            width:
                              order.order_status === 'OUT_FOR_DELIVERY'
                                ? '75%'
                                : order.order_status === 'PREPARING'
                                ? '45%'
                                : '20%'
                          }}
                        />
                      </div>
                    </div>

                    {/* Driver details if assigned */}
                    {order.driver_name && (
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white block">{order.driver_name} (Rider)</span>
                            <span className="text-[10px] text-slate-400 font-mono">{order.driver_vehicle || 'Motorbike'}</span>
                          </div>
                        </div>
                        {order.driver_phone && (
                          <a
                            href={`tel:${order.driver_phone}`}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call Rider</span>
                          </a>
                        )}
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {order.items?.length || 0} items ordered
                      </span>
                      <button
                        onClick={() => navigate(`/restaurant/${slug}/order/${order.id}`)}
                        className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Full Live Tracker ↗</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

            {/* Past Orders History */}
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">
                Order History ({pastOrders.length})
              </h3>

              {pastOrders.length === 0 && activeOrders.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-white/5 border border-white/10 space-y-3">
                  <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
                  <h4 className="text-base font-bold text-white">No past orders yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    You haven't ordered any delicious food from {restaurant?.name || 'this restaurant'} yet. Let's change that!
                  </p>
                  <button
                    onClick={() => navigate(`/restaurant/${slug}`)}
                    className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    Browse Delicious Dishes 🍕
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-5 rounded-3xl bg-slate-800/40 hover:bg-slate-800/70 border border-white/10 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">Order #{order.id}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(order.order_status)}`}>
                              {order.order_status}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                            {new Date(order.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-sm text-white block">
                            ₹{order.total_amount}
                          </span>
                          {parseFloat(order.rewards_discount || 0) > 0 && (
                            <span className="text-[11px] text-emerald-400 font-mono">
                              -₹{order.rewards_discount} saved pts
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items preview */}
                      <div className="text-xs text-slate-300 space-y-1">
                        {order.items?.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-slate-400 text-[11px]">
                            <span>{it.quantity}x {it.item_name}</span>
                            <span className="font-mono">₹{it.subtotal || (it.price * it.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      {/* 1-Click Reorder Button */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Delivered to: {order.delivery_address || 'Address'}
                        </span>
                        <button
                          onClick={() => handleReorder(order)}
                          disabled={reordering === order.id}
                          className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-500/30"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{reordering === order.id ? 'Adding to Cart...' : 'Re-Order 1-Click'}</span>
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>
        )}

        {/* TAB 2: KRATU REWARDS WALLET */}
        {activeTab === 'WALLET' && (
          <div className="space-y-6">
            
            {/* Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 shadow-xl space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  Available Rewards
                </span>
                <span className="text-3xl font-black text-emerald-300 font-mono block">
                  ₹{rewards?.availableBalance || 0}
                </span>
                <p className="text-[11px] text-emerald-400/80">
                  Ready to apply instantly for up to 50% discount on checkout.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-800/40 border border-white/10 space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Pending Cashback
                </span>
                <span className="text-3xl font-black text-amber-300 font-mono block">
                  ₹{rewards?.pendingBalance || 0}
                </span>
                <p className="text-[11px] text-slate-400">
                  Unlocks automatically once your active deliveries are marked complete.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-800/40 border border-white/10 space-y-2">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">
                  Expiring Soon (30 Days)
                </span>
                <span className="text-3xl font-black text-rose-300 font-mono block">
                  ₹{rewards?.expiringSoonBalance || 0}
                </span>
                <p className="text-[11px] text-slate-400">
                  Spend your rewards before expiry on your next delicious order!
                </p>
              </div>

            </div>

            {/* Active Credit Lots (FIFO) */}
            <div className="p-6 rounded-3xl bg-slate-800/40 border border-white/10 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Active Credit Lots (Slide 07 FIFO Expiry)</span>
              </h3>

              {rewards?.availableLots?.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No active credit lots right now.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {rewards?.availableLots?.map((lot) => (
                    <div key={lot.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white block">Lot #{lot.id} • {lot.source_event}</span>
                        <span className="text-[11px] text-slate-400">
                          Expires: {new Date(lot.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ₹{lot.remaining_amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Statement Ledger Activity */}
            <div className="p-6 rounded-3xl bg-slate-800/40 border border-white/10 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                <span>Recent Rewards Ledger Activity</span>
              </h3>

              {rewards?.transactions?.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No transactions recorded yet.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {rewards?.transactions?.map((tx) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-200 block">{tx.description}</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(tx.created_at).toLocaleDateString()} • {tx.event_type}
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-sm ${
                        tx.entry_type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {tx.entry_type === 'CREDIT' ? '+' : '-'}₹{tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

    </div>
  );
}
