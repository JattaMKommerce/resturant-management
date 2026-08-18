import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { ShoppingCart, Search, Plus, Minus, ChevronRight, Clock, MapPin, Phone, Star, Leaf, X, AlertCircle } from 'lucide-react';

export default function RestaurantMenuPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { cartItems, addToCart, updateQuantity, removeFromCart, getSubtotal, getItemCount, setRestaurantSlug } = useCart();

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (slug) {
      setRestaurantSlug(slug);
      loadRestaurant();
      loadCategories();
      loadMenu();
      checkActiveOrder();
    }
  }, [slug]);

  const loadRestaurant = async () => {
    try {
      const res = await api.get(`/restaurants/${slug}`);
      setRestaurant(res.data.restaurant);
    } catch (err) {
      setError(err.response?.data?.message || 'Restaurant not found.');
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get(`/restaurants/${slug}/categories`);
      setCategories(res.data.categories || []);
    } catch (err) {}
  };

  const loadMenu = async () => {
    try {
      const res = await api.get(`/restaurants/${slug}/menu`);
      setMenuItems(res.data.items || []);
    } catch (err) {}
    setLoading(false);
  };

  const checkActiveOrder = async () => {
    try {
      const res = await api.get(`/guest/active-order/${slug}`);
      if (res.data.activeOrder) setActiveOrder(res.data.activeOrder);
    } catch (err) {}
  };

  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (activeCategory) items = items.filter(i => i.category_id === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.tags?.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, activeCategory, searchQuery]);

  const groupedItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const cat = item.category_name || 'Other';
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Restaurant Not Found</h2>
        <p className="text-slate-500">{error || 'This restaurant does not exist.'}</p>
      </div>
    );
  }

  if (restaurant.is_suspended || restaurant.status === 'SUSPENDED') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <AlertCircle className="w-16 h-16 text-amber-400 mb-4" />
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Restaurant Unavailable</h2>
        <p className="text-slate-500">This restaurant is currently unavailable. Please check back later.</p>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const itemCount = getItemCount();
  const isOpen = isRestaurantOpen();
  const canOrder = restaurant.is_online_ordering_enabled && restaurant.website_status === 'PUBLISHED' && restaurant.status === 'ACTIVE';
  const coverImg = restaurant.cover_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80';
  const logoImg = restaurant.logo_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="relative h-56 sm:h-72 md:h-80 overflow-hidden">
        <img src={coverImg} alt={restaurant.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
          <div className="max-w-5xl mx-auto flex items-end gap-4">
            <img src={logoImg} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-4 border-white shadow-xl flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white truncate">{restaurant.name}</h1>
              {restaurant.tagline && <p className="text-orange-200 text-sm sm:text-base mt-1">{restaurant.tagline}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-white/80">
                {restaurant.area && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{restaurant.area}{restaurant.city ? `, ${restaurant.city}` : ''}</span>}
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{restaurant.opening_time} - {restaurant.closing_time}</span>
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
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Welcome back 👋</p>
              <p className="text-sm text-white/90">Order #{activeOrder.order_number} · {activeOrder.order_status.replace(/_/g, ' ')}</p>
            </div>
            <button onClick={() => navigate(`/restaurant/${slug}/order/${activeOrder.id}`)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-all backdrop-blur-sm">
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
            <p className="text-sm">Online ordering is currently unavailable. You can browse the menu.</p>
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
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 shadow-sm transition-all"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          <button onClick={() => setActiveCategory(null)} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${!activeCategory ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
            All
          </button>
          {categories.filter(c => c.is_active).map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg">No items found.</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([catName, items]) => (
            <div key={catName} className="mb-8">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
                {catName}
                <span className="text-sm font-normal text-slate-400 ml-1">({items.length})</span>
              </h2>
              <div className="grid gap-4">
                {items.map(item => {
                  const qty = getCartQty(item.id);
                  const price = item.discounted_price ? parseFloat(item.discounted_price) : parseFloat(item.price);
                  const originalPrice = parseFloat(item.price);
                  const hasDiscount = item.discounted_price && item.discounted_price < item.price;

                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex overflow-hidden">
                      {/* Left: Info */}
                      <div className="flex-1 p-4 flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-4 h-4 flex items-center justify-center rounded-sm border-2 ${item.is_veg ? 'border-emerald-500' : 'border-red-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          </span>
                          {item.is_bestseller ? <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">★ Bestseller</span> : null}
                          {item.is_recommended ? <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Recommended</span> : null}
                        </div>
                        <h3 className="font-semibold text-slate-800 text-base">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-bold text-slate-800">₹{price}</span>
                          {hasDiscount && <span className="text-sm text-slate-400 line-through">₹{originalPrice}</span>}
                        </div>
                        {item.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{item.description}</p>}
                        {!item.is_available && <p className="text-xs text-red-500 mt-1 font-medium">Currently unavailable</p>}
                      </div>
                      {/* Right: Image + Add */}
                      <div className="w-32 sm:w-36 relative flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover min-h-[120px]" />
                        ) : (
                          <div className="w-full h-full min-h-[120px] bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center">
                            <span className="text-3xl">🍽️</span>
                          </div>
                        )}
                        {item.is_available && canOrder ? (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                            {qty === 0 ? (
                              <button onClick={() => handleAddToCart(item)} className="px-5 py-1.5 bg-white border-2 border-orange-500 text-orange-500 rounded-xl text-sm font-bold hover:bg-orange-500 hover:text-white transition-all shadow-lg">
                                ADD
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 bg-orange-500 rounded-xl shadow-lg">
                                <button onClick={() => updateQuantity(item.id, qty - 1)} className="px-2 py-1.5 text-white hover:bg-orange-600 rounded-l-xl transition-all">
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="text-white font-bold text-sm px-2">{qty}</span>
                                <button onClick={() => updateQuantity(item.id, qty + 1)} className="px-2 py-1.5 text-white hover:bg-orange-600 rounded-r-xl transition-all">
                                  <Plus className="w-4 h-4" />
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
              className="w-full flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-4 rounded-2xl shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-xl p-2">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className="font-semibold">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">₹{subtotal.toFixed(0)}</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
