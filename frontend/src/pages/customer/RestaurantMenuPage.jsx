import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import AccommodationCustomerTab from '../../components/customer/AccommodationCustomerTab';
import CustomerAuthModal from '../../components/customer/CustomerAuthModal';
import CustomerAuthPage from './CustomerAuthPage';
import { ShoppingCart, Search, Plus, Minus, ChevronRight, Clock, MapPin, Phone, Star, Leaf, X, AlertCircle, Eye, Sparkles, Lock, Utensils, BedDouble, Hotel, Gift, User, ShieldCheck } from 'lucide-react';
import { getTemplateById } from '../../config/templates';

const API_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:5000');

const getMediaUrl = (url, fallback) => {
  if (!url) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function RestaurantMenuPage({ overrideSlug }) {
  const params = useParams();
  const slug = overrideSlug || params.slug;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cartItems, addToCart, updateQuantity, removeFromCart, getSubtotal, getItemCount, setRestaurantSlug } = useCart();

  // Main mode switcher tab: 'dining' or 'stay'
  const [mainTab, setMainTab] = useState(searchParams.get('tab') === 'stay' ? 'stay' : 'dining');

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [customerRewards, setCustomerRewards] = useState(null);
  const [guestBypass, setGuestBypass] = useState(false);

  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  useEffect(() => {
    if (getItemCount() === 0) setCartDrawerOpen(false);
  }, [cartItems]);

  useEffect(() => {
    if (slug) {
      setRestaurantSlug(slug);
      loadAllData();
    }
  }, [slug]);

  // Load customer rewards if logged in
  useEffect(() => {
    if (user && slug) {
      api.get(`/customer/portal/data?slug=${slug}`)
        .then(res => {
          if (res.data?.success && res.data.data?.rewards) {
            setCustomerRewards(res.data.data.rewards);
          }
        })
        .catch(() => {});
    } else {
      setCustomerRewards(null);
    }
  }, [user, slug]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const restRes = await api.get(`/restaurants/${slug}`);

      if (restRes.data && restRes.data.success && restRes.data.restaurant) {
        const r = restRes.data.restaurant;
        setRestaurant(r);
        const targetSlug = r.slug || r.random_slug || slug;

        const [catRes, menuRes] = await Promise.all([
          api.get(`/restaurants/${targetSlug}/categories`).catch(() => ({ data: { categories: [] } })),
          api.get(`/restaurants/${targetSlug}/menu`).catch(() => ({ data: { items: [] } }))
        ]);

        if (catRes.data && catRes.data.categories) {
          setCategories(catRes.data.categories);
        }

        if (menuRes.data && menuRes.data.items) {
          setMenuItems(menuRes.data.items);
        }
      } else {
        setError('Restaurant not found.');
      }

      try {
        const orderRes = await api.get(`/guest/active-order/${slug}`);
        if (orderRes.data && orderRes.data.activeOrder) {
          setActiveOrder(orderRes.data.activeOrder);
        }
      } catch (e) {}

    } catch (err) {
      console.error('Error loading restaurant menu data:', err);
      setError(err.response?.data?.message || 'Restaurant not found or unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (activeCategory) items = items.filter(i => i.category_id === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.tags?.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, activeCategory, searchQuery]);

  const groupedItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const cat = item.category_name || 'Menu Items';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  const getCartQty = (itemId) => {
    const found = cartItems.find(i => i.id === itemId);
    return found ? found.quantity : 0;
  };

  const handleAddToCart = (item) => {
    addToCart(item, 1, '', slug);
  };

  const isRestaurantOpen = () => {
    if (!restaurant) return false;
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();
    const currentMins = hrs * 60 + mins;
    const [openH, openM] = (restaurant.opening_time || '10:00').split(':').map(Number);
    const [closeH, closeM] = (restaurant.closing_time || '23:00').split(':').map(Number);
    return currentMins >= (openH * 60 + openM) && currentMins <= (closeH * 60 + closeM);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#3A7D7C] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-[#64748B] mt-3">Loading storefront...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Menu Currently Unavailable</h2>
        <p className="text-slate-500 text-sm max-w-sm mb-6">{error || 'Unable to load the menu right now. Please refresh the page.'}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-[#3A7D7C] hover:bg-[#2e6463] text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
          Refresh Menu
        </button>
      </div>
    );
  }

  if (restaurant.is_suspended || restaurant.status === 'SUSPENDED') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="w-16 h-16 text-amber-400 mb-4 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Restaurant Unavailable</h2>
        <p className="text-slate-500 text-sm max-w-sm">This restaurant is currently paused. Please check back later.</p>
      </div>
    );
  }

  // FIRST STEP GATEKEEPER: Show Login or Sign Up page first if customer is not signed in
  if (!user && !guestBypass) {
    return (
      <CustomerAuthPage
        overrideSlug={slug}
        onSkip={() => setGuestBypass(true)}
        onSuccessRedirect={() => setGuestBypass(true)}
      />
    );
  }

  const template = getTemplateById(restaurant?.template_id);
  const subtotal = getSubtotal();
  const itemCount = getItemCount();
  const isOpen = isRestaurantOpen();
  const isDraft = restaurant.website_status === 'DRAFT';
  const canOrder = Boolean(restaurant.is_online_ordering_enabled && restaurant.status === 'ACTIVE');

  const coverImg = getMediaUrl(
    restaurant.cover_url,
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80'
  );
  
  const logoImg = getMediaUrl(
    restaurant.logo_url,
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80'
  );

  return (
    <div className={`min-h-screen ${template.bgClass} font-sans antialiased transition-colors duration-300`}>
      
      {/* DRAFT PREVIEW MODE BANNER */}
      {isDraft && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
          <Eye className="w-4 h-4" />
          <span>STOREFRONT PREVIEW MODE (DRAFT): This is how your store looks. Publish in Step 7 of the Setup Wizard to make it live for customers.</span>
        </div>
      )}

      {/* Sleek Customer Header Bar */}
      <div className="bg-slate-900/95 text-white border-b border-white/10 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-tight text-white">{restaurant.name}</span>
            <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
              Kratu Rewards Active
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/restaurant/${slug}/portal`)}
                  className="px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Gift className="w-3.5 h-3.5 text-emerald-400" />
                  <span>₹{customerRewards?.availableBalance || 0} pts</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/restaurant/${slug}/portal`)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">My Orders & Portal</span>
                  <span className="sm:hidden">Portal</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Sign In / Rewards</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className={`relative h-56 sm:h-72 md:h-80 overflow-hidden bg-gradient-to-br ${template.previewBg}`}>
        <img
          src={coverImg}
          alt={restaurant.name}
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
          <div className="max-w-5xl mx-auto flex items-end gap-4">
            <img
              src={logoImg}
              alt={restaurant.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain bg-white p-1 border-2 sm:border-4 border-white shadow-xl flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${template.badgeStyle}`}>
                  {template.category}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white truncate">{restaurant.name}</h1>
              {restaurant.tagline && <p className="text-orange-200 text-sm sm:text-base mt-1">{restaurant.tagline}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-white/80">
                {restaurant.area && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#3A7D7C]" />
                    {restaurant.area}{restaurant.city ? `, ${restaurant.city}` : ''}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  {restaurant.opening_time || '10:00'} - {restaurant.closing_time || '23:30'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isOpen ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                  {isOpen ? '● Open Now' : '● Closed'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Order Banner */}
      {activeOrder && (
        <div className="bg-gradient-to-r from-emerald-600 to-[#3A7D7C] text-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-xs">Welcome back 👋</p>
              <p className="text-sm font-bold text-white/90">Order #{activeOrder.order_number} · {activeOrder.order_status.replace(/_/g, ' ')}</p>
            </div>
            <button onClick={() => navigate(`/restaurant/${slug}/order/${activeOrder.id}`)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all backdrop-blur-sm">
              Track Order
            </button>
          </div>
        </div>
      )}

      {/* Ordering Disabled Notice */}
      {!canOrder && (
        <div className="bg-amber-50 border-b border-amber-100">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 text-amber-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-semibold">Online ordering is currently paused by the restaurant. You can browse the menu.</p>
          </div>
        </div>
      )}

      {/* 2-IN-1 MODE SWITCHER HEADER BAR (FOOD vs ACCOMMODATION) */}
      <div className="bg-slate-900/80 border-b border-white/10 backdrop-blur-md sticky top-0 z-40 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-center sm:justify-start">
          <div className="bg-slate-950/60 p-1.5 rounded-2xl flex items-center gap-1.5 border border-white/10 shadow-inner w-full sm:w-auto">
            <button
              onClick={() => {
                setMainTab('dining');
                setSearchParams({ tab: 'dining' });
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mainTab === 'dining'
                  ? `${template.buttonStyle}`
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>🍽️ Food & Dining</span>
            </button>

            <button
              onClick={() => {
                setMainTab('stay');
                setSearchParams({ tab: 'stay' });
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mainTab === 'stay'
                  ? `${template.buttonStyle}`
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <BedDouble className="w-4 h-4" />
              <span>🛏️ Rooms & Hotel Stay</span>
            </button>
          </div>
        </div>
      </div>

      <div className={`max-w-5xl mx-auto px-4 pt-6 transition-all duration-300 ${itemCount > 0 ? 'pb-44 sm:pb-36' : 'pb-16'}`}>
        {mainTab === 'stay' ? (
          <AccommodationCustomerTab restaurant={restaurant} slug={slug} />
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search dishes, cuisines, ingredients..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 ${template.cardClass} rounded-2xl text-sm focus:outline-none focus:border-amber-400 shadow-xs transition-all`}
              />
            </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          <button onClick={() => setActiveCategory(null)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${!activeCategory ? template.buttonStyle : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-white/10'}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeCategory === cat.id ? template.buttonStyle : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-white/10'}`}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-base font-semibold">No dishes found in this category.</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([catName, items]) => (
            <div key={catName} className="mb-8">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-amber-400 rounded-full"></span>
                {catName}
                <span className="text-xs font-normal text-slate-400 ml-1">({items.length})</span>
              </h2>
              <div className="grid gap-4">
                {items.map(item => {
                  const qty = getCartQty(item.id);
                  const price = item.discounted_price ? parseFloat(item.discounted_price) : parseFloat(item.price);
                  const originalPrice = parseFloat(item.price);
                  const hasDiscount = item.discounted_price && item.discounted_price < item.price;
                  const itemImg = getMediaUrl(item.image_url, null);

                  return (
                    <div key={item.id} className={`${template.cardClass} rounded-2xl border shadow-md hover:shadow-lg transition-all flex overflow-hidden`}>
                      {/* Left: Info */}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-xs border ${item.is_veg ? 'border-emerald-500' : 'border-rose-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            </span>
                            {item.is_bestseller ? <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">★ Bestseller</span> : null}
                            {item.is_recommended ? <span className="text-[10px] font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-500/30">Chef's Pick</span> : null}
                          </div>
                          <h3 className="font-bold text-white text-sm">{item.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-extrabold text-amber-400 text-sm">₹{price}</span>
                            {hasDiscount && <span className="text-xs text-slate-400 line-through">₹{originalPrice}</span>}
                          </div>
                          {item.description && <p className="text-xs text-slate-300 mt-1.5 line-clamp-2">{item.description}</p>}
                        </div>
                        {!item.is_available && <p className="text-[11px] text-rose-400 font-bold mt-2">Currently unavailable</p>}
                      </div>
                      
                      {/* Right: Image + Add */}
                      <div className="w-32 sm:w-36 relative flex-shrink-0 bg-slate-900">
                        {itemImg ? (
                          <img src={itemImg} alt={item.name} className="w-full h-full object-cover min-h-[120px]" />
                        ) : (
                          <div className="w-full h-full min-h-[120px] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                            <span className="text-3xl">🍽️</span>
                          </div>
                        )}
                        {item.is_available && canOrder ? (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                            {qty === 0 ? (
                              <button onClick={() => handleAddToCart(item)} className={`px-5 py-1.5 rounded-xl text-xs font-bold transition-all ${template.buttonStyle}`}>
                                ADD
                              </button>
                            ) : (
                              <div className={`flex items-center gap-1 ${template.buttonStyle} rounded-xl shadow-md`}>
                                <button onClick={() => updateQuantity(item.id, qty - 1)} className="px-2 py-1 hover:opacity-80 rounded-l-xl transition-all">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-bold text-xs px-2">{qty}</span>
                                <button onClick={() => updateQuantity(item.id, qty + 1)} className="px-2 py-1 hover:opacity-80 rounded-r-xl transition-all">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        </>
        )}
      </div>

      {/* Floating Cart & Checkout Bar */}
      {itemCount > 0 && canOrder && (
        <aside
          aria-label="Shopping Cart Summary"
          className="fixed bottom-3 left-3 right-3 sm:bottom-6 sm:right-6 sm:left-auto sm:w-[400px] md:w-[440px] z-40 pointer-events-auto animate-in slide-in-from-bottom-4 duration-200"
        >
          <div className="bg-slate-900/95 backdrop-blur-xl border border-white/15 p-2.5 sm:p-3 rounded-2xl shadow-2xl shadow-black/60 flex items-center justify-between gap-3 text-white">
            {/* Left: Cart Info & Quick Drawer Trigger */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="flex items-center gap-2.5 text-left hover:opacity-90 transition-all cursor-pointer group py-1 pl-1"
              title="View Cart Items"
            >
              <div className="relative p-2.5 rounded-xl bg-white/10 group-hover:bg-white/15 transition-colors">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-slate-950 text-[11px] font-black rounded-full flex items-center justify-center shadow-xs">
                  {itemCount}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base text-white tracking-tight">₹{subtotal.toFixed(0)}</span>
                  <span className="text-[10px] text-amber-300 font-bold bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-0.5 group-hover:text-amber-300 transition-colors">
                  View items <ChevronRight className="w-3 h-3 inline" />
                </span>
              </div>
            </button>

            {/* Right: Checkout Button */}
            <button
              onClick={() => navigate(`/restaurant/${slug}/checkout`)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black shadow-lg transition-all active:scale-[0.98] cursor-pointer ${template.buttonStyle}`}
            >
              <span>Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Slide-Up Mini-Cart Drawer / Modal */}
      {cartDrawerOpen && itemCount > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 p-0 sm:p-4">
          {/* Backdrop dismiss */}
          <div className="absolute inset-0" onClick={() => setCartDrawerOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-in slide-in-from-bottom-6 duration-200 flex flex-col max-h-[85vh]">
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Your Cart Summary</h3>
                  <p className="text-[11px] text-slate-400 font-medium">{itemCount} {itemCount === 1 ? 'dish selected' : 'dishes selected'}</p>
                </div>
              </div>
              <button 
                onClick={() => setCartDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close cart preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 divide-y divide-white/5 custom-scrollbar">
              {cartItems.map(item => (
                <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`w-3 h-3 flex items-center justify-center rounded-xs border shrink-0 ${item.is_veg ? 'border-emerald-500' : 'border-rose-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-white truncate">{item.name}</p>
                      <p className="text-[11px] text-amber-400/90 font-semibold">₹{item.price} each</p>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-800 border border-white/10 rounded-xl px-1 py-0.5">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Reduce quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-xs px-2 text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="font-mono font-extrabold text-xs text-white w-14 text-right">
                      ₹{(item.price * item.quantity).toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-white/10 bg-slate-950/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Item Subtotal</span>
                <span className="font-black text-base text-white">₹{subtotal.toFixed(0)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setCartDrawerOpen(false)}
                  className="w-full py-3 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>+ Add More Dishes</span>
                </button>
                <button
                  onClick={() => {
                    setCartDrawerOpen(false);
                    navigate(`/restaurant/${slug}/checkout`);
                  }}
                  className={`w-full py-3 px-3 rounded-xl ${template.buttonStyle} text-xs font-black shadow-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5`}
                >
                  <span>Checkout ➔</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Mobile/WhatsApp OTP Auth Modal */}
      <CustomerAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        restaurant={restaurant}
        onSuccess={() => {
          api.get(`/customer/portal/data?slug=${slug}`)
            .then(res => {
              if (res.data?.success && res.data.data?.rewards) {
                setCustomerRewards(res.data.data.rewards);
              }
            })
            .catch(() => {});
        }}
      />
    </div>
  );
}
