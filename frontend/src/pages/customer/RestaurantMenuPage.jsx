import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { ShoppingCart, Search, Plus, Minus, ChevronRight, Clock, MapPin, Phone, Star, Leaf, X, AlertCircle, Eye, Sparkles, Lock, Utensils } from 'lucide-react';

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
  const { cartItems, addToCart, updateQuantity, removeFromCart, getSubtotal, getItemCount, setRestaurantSlug } = useCart();

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lockedInfo, setLockedInfo] = useState(null);

  useEffect(() => {
    if (slug) {
      setRestaurantSlug(slug);
      loadAllData();
    }
  }, [slug]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      setLockedInfo(null);
      const [restRes, catRes, menuRes] = await Promise.all([
        api.get(`/restaurants/${slug}`),
        api.get(`/restaurants/${slug}/categories`).catch(() => ({ data: { categories: [] } })),
        api.get(`/restaurants/${slug}/menu`).catch(() => ({ data: { items: [] } }))
      ]);

      if (restRes.data.success && restRes.data.restaurant) {
        setRestaurant(restRes.data.restaurant);
      } else {
        setError('Restaurant not found.');
      }

      if (catRes.data && catRes.data.categories) {
        setCategories(catRes.data.categories);
      }

      if (menuRes.data && menuRes.data.items) {
        setMenuItems(menuRes.data.items);
      }

      try {
        const orderRes = await api.get(`/guest/active-order/${slug}`);
        if (orderRes.data && orderRes.data.activeOrder) {
          setActiveOrder(orderRes.data.activeOrder);
        }
      } catch (e) {}

    } catch (err) {
      console.error('Error loading restaurant menu data:', err);
      if (err.response?.data?.locked) {
        setLockedInfo(err.response.data);
      } else {
        setError(err.response?.data?.message || 'Restaurant not found or unavailable.');
      }
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

  if (lockedInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center mb-4 border border-[#D7E5E8] shadow-xs">
          <Utensils className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h2 className="text-2xl font-black text-[#1F2937] mb-2">Storefront Link Updated</h2>
        <p className="text-[#64748B] text-xs max-w-sm leading-relaxed mb-6 font-medium">
          This digital menu link has moved. Please click below to view the active restaurant menu.
        </p>
        {lockedInfo.random_slug && (
          <button
            onClick={() => navigate(`/restaurant/${lockedInfo.random_slug}`)}
            className="px-6 py-3 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            Open Restaurant Menu ↗
          </button>
        )}
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
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      
      {/* DRAFT PREVIEW MODE BANNER */}
      {isDraft && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
          <Eye className="w-4 h-4" />
          <span>STOREFRONT PREVIEW MODE (DRAFT): This is how your store looks. Publish in Step 7 of the Setup Wizard to make it live for customers.</span>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative h-56 sm:h-72 md:h-80 overflow-hidden bg-slate-900">
        <img
          src={coverImg}
          alt={restaurant.name}
          className="w-full h-full object-cover"
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

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search dishes, cuisines, ingredients..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-[#D7E5E8] rounded-2xl text-sm focus:outline-none focus:border-[#3A7D7C] shadow-xs transition-all"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          <button onClick={() => setActiveCategory(null)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${!activeCategory ? 'bg-[#3A7D7C] text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-[#D7E5E8]'}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeCategory === cat.id ? 'bg-[#3A7D7C] text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-[#D7E5E8]'}`}>
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
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-[#3A7D7C] rounded-full"></span>
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
                    <div key={item.id} className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs hover:shadow-sm transition-all flex overflow-hidden">
                      {/* Left: Info */}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-xs border ${item.is_veg ? 'border-emerald-600' : 'border-rose-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                            </span>
                            {item.is_bestseller ? <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">★ Bestseller</span> : null}
                            {item.is_recommended ? <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">Chef's Pick</span> : null}
                          </div>
                          <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-extrabold text-slate-900 text-sm">₹{price}</span>
                            {hasDiscount && <span className="text-xs text-slate-400 line-through">₹{originalPrice}</span>}
                          </div>
                          {item.description && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{item.description}</p>}
                        </div>
                        {!item.is_available && <p className="text-[11px] text-rose-500 font-bold mt-2">Currently unavailable</p>}
                      </div>
                      
                      {/* Right: Image + Add */}
                      <div className="w-32 sm:w-36 relative flex-shrink-0 bg-slate-50">
                        {itemImg ? (
                          <img src={itemImg} alt={item.name} className="w-full h-full object-cover min-h-[120px]" />
                        ) : (
                          <div className="w-full h-full min-h-[120px] bg-gradient-to-br from-[#EAF4F7] to-slate-100 flex items-center justify-center">
                            <span className="text-3xl">🍽️</span>
                          </div>
                        )}
                        {item.is_available && canOrder ? (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                            {qty === 0 ? (
                              <button onClick={() => handleAddToCart(item)} className="px-5 py-1.5 bg-white border border-[#3A7D7C] text-[#3A7D7C] hover:bg-[#3A7D7C] hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                                ADD
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 bg-[#3A7D7C] text-white rounded-xl shadow-md">
                                <button onClick={() => updateQuantity(item.id, qty - 1)} className="px-2 py-1 hover:bg-[#2F6665] rounded-l-xl transition-all">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-bold text-xs px-2">{qty}</span>
                                <button onClick={() => updateQuantity(item.id, qty + 1)} className="px-2 py-1 hover:bg-[#2F6665] rounded-r-xl transition-all">
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
      </div>

      {/* Floating Cart Bar */}
      {itemCount > 0 && canOrder && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none">
          <div className="max-w-5xl mx-auto pointer-events-auto">
            <button
              onClick={() => navigate(`/restaurant/${slug}/checkout`)}
              className="w-full flex items-center justify-between bg-[#3A7D7C] hover:bg-[#2F6665] text-white px-6 py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl p-2">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm">{itemCount} {itemCount === 1 ? 'item' : 'items'} in cart</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base">₹{subtotal.toFixed(0)}</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
