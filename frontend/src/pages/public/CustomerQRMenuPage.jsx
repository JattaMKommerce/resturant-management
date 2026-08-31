import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { 
  UtensilsCrossed, 
  Search, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Clock, 
  X, 
  ChevronRight, 
  AlertTriangle, 
  Check, 
  Sparkles,
  Info,
  Bell
} from 'lucide-react';

export default function CustomerQRMenuPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [table, setTable] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [vegOnly, setVegOnly] = useState(false);

  // Cart State
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Modifier Customization Modal State
  const [selectedItemForMod, setSelectedItemForMod] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState('');

  useEffect(() => {
    async function loadPublicData() {
      setLoading(true);
      try {
        const tableRes = await api.get(`/public/tables/${token}`);
        if (tableRes.success) {
          setTable(tableRes.data);
        } else {
          setTableError(tableRes.message);
          setLoading(false);
          return;
        }

        const menuRes = await api.get('/public/menu');
        if (menuRes.success) {
          setCategories(menuRes.data.categories || []);
          setItems(menuRes.data.items || []);
        }
      } catch (err) {
        setTableError(err.message || 'Invalid QR Code or server offline.');
      } finally {
        setLoading(false);
      }
    }
    loadPublicData();
  }, [token]);

  // Open item modal if item has modifiers, otherwise add directly
  const handleAddItemClick = (item) => {
    if (item.modifiers && item.modifiers.length > 0) {
      setSelectedItemForMod(item);
      setSelectedOptions({});
      setSpecialInstructions('');
    } else {
      addToCart(item, [], '');
    }
  };

  const addToCart = (item, selectedOptionIds = [], instructions = '') => {
    setCart((prevCart) => {
      const optionKey = (selectedOptionIds || []).sort().join(',');
      const existingIndex = prevCart.findIndex(
        (c) => c.item.id === item.id && c.optionKey === optionKey && (c.instructions || '') === (instructions || '')
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            item,
            quantity: 1,
            selectedOptionIds: selectedOptionIds || [],
            optionKey,
            instructions: instructions || ''
          }
        ];
      }
    });

    setSelectedItemForMod(null);
  };

  const updateQuantity = (index, delta) => {
    setCart((prevCart) => {
      if (!prevCart[index]) return prevCart;
      const newQty = prevCart[index].quantity + delta;
      if (newQty <= 0) {
        return prevCart.filter((_, i) => i !== index);
      }
      const updated = [...prevCart];
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const handleDecreaseItem = (item) => {
    setCart((prevCart) => {
      const idx = prevCart.map(c => c.item.id).lastIndexOf(item.id);
      if (idx === -1) return prevCart;
      const updated = [...prevCart];
      if (updated[idx].quantity > 1) {
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity - 1 };
        return updated;
      } else {
        return updated.filter((_, i) => i !== idx);
      }
    });
  };

  const handleIncreaseItem = (item) => {
    setCart((prevCart) => {
      const idx = prevCart.map(c => c.item.id).lastIndexOf(item.id);
      if (idx > -1) {
        const updated = [...prevCart];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      // If not in cart yet, add single item
      return [
        ...prevCart,
        {
          item,
          quantity: 1,
          selectedOptionIds: [],
          optionKey: '',
          instructions: ''
        }
      ];
    });
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'ALL' && item.category_id != selectedCategory) {
      return false;
    }
    const nameLower = (item.name || '').toLowerCase();
    const isMeatName = 
      nameLower.includes('chicken') || 
      nameLower.includes('mutton') || 
      nameLower.includes('fish') || 
      nameLower.includes('prawn') || 
      nameLower.includes('egg') || 
      nameLower.includes('meat') || 
      nameLower.includes('pork') || 
      nameLower.includes('beef') || 
      nameLower.includes('non-veg') ||
      nameLower.includes('non veg');

    const isVeg = !isMeatName && (item.is_veg === 1 || item.is_veg === true || item.is_veg === '1' || item.is_veg === 'true');
    if (vegOnly && !isVeg) {
      return false;
    }
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Calculate cart totals
  const totalItemsCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const cartSubtotal = cart.reduce((sum, c) => {
    const basePrice = parseFloat(c.item.price);
    // Find modifier option prices
    let modPrice = 0;
    if (c.selectedOptionIds && c.item.modifiers) {
      c.item.modifiers.forEach((m) => {
        if (m.options) {
          m.options.forEach((opt) => {
            if (c.selectedOptionIds.includes(opt.id)) {
              modPrice += parseFloat(opt.price_adjustment) || 0;
            }
          });
        }
      });
    }
    return sum + (basePrice + modPrice) * c.quantity;
  }, 0);

  const estimatedTax = cartSubtotal * 0.05; // 5% Tax display
  const grandTotal = cartSubtotal + estimatedTax;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const idempotencyKey = `QR-ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const orderPayload = {
        qr_token: token,
        customer_name: customerName.trim() || 'Guest',
        customer_phone: customerPhone.trim() || null,
        order_type: 'DINE_IN',
        source: 'QR',
        idempotency_key: idempotencyKey,
        items: cart.map((c) => ({
          menu_item_id: c.item.id,
          quantity: c.quantity,
          special_instructions: c.instructions,
          selected_options: c.selectedOptionIds
        }))
      };

      const res = await api.post('/public/orders', orderPayload);

      if (res.success) {
        setCart([]);
        setIsCartOpen(false);
        navigate(`/order/${res.data.id}/track`);
      } else {
        setSubmitError(res.message || 'Failed to submit order');
      }
    } catch (err) {
      setSubmitError(err.message || 'Network error occurred while placing order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F8FA] flex flex-col items-center justify-center p-6 text-[#64748B]">
        <div className="w-12 h-12 rounded-2xl bg-[#EAF4F7] border border-[#D7E5E8] flex items-center justify-center mb-3 shadow-xs">
          <UtensilsCrossed className="w-6 h-6 text-[#3A7D7C] animate-pulse" />
        </div>
        <p className="text-sm font-bold text-[#1F2937] tracking-wide">Loading Grand Palace Digital Menu...</p>
      </div>
    );
  }

  if (tableError) {
    return (
      <div className="min-h-screen bg-[#F4F8FA] flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-[#D7E5E8] rounded-3xl p-8 max-w-sm text-center shadow-xl">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1F2937] mb-2">QR Ordering Unavailable</h3>
          <p className="text-sm text-[#64748B] mb-6">{tableError}</p>
          <div className="text-xs text-[#3A7D7C] bg-[#EAF4F7] p-3 rounded-xl border border-[#D7E5E8] font-medium">
            Please ask restaurant wait staff for assistance.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F8FA] text-[#1F2937] pb-28 max-w-md mx-auto relative shadow-2xl font-sans antialiased border-x border-[#D7E5E8]">
      {/* Mobile Branding Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#D7E5E8] p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3A7D7C] flex items-center justify-center shadow-md shadow-[#3A7D7C]/20">
              <UtensilsCrossed className="w-5 h-5 text-white font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold text-[#1F2937] tracking-tight">GRAND PALACE</h1>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]">
                  HMS
                </span>
              </div>
              <p className="text-xs text-[#3A7D7C] font-bold flex items-center gap-1">
                <span>TABLE {table?.table_number || 'T01'}</span>
                <span className="text-[#94A3B8]">•</span>
                <span className="text-[#64748B] font-medium">{table?.floor || 'Main Dining'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  await api.post(`/public/tables/${token}/call-waiter`, {
                    table_number: table?.table_number,
                    message: `Customer at Table ${table?.table_number || ''} called for waiter`
                  });
                  alert(`🛎️ Waiter notified! Service staff is on their way to Table ${table?.table_number || ''}.`);
                } catch (e) {
                  alert('🛎️ Service call sent to waiter station.');
                }
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border bg-[#EAF4F7] border-[#D7E5E8] text-[#3A7D7C] hover:bg-[#D7E5E8] flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Call Waiter to this table"
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>Call Waiter</span>
            </button>
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                vegOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white text-[#64748B] border-[#D7E5E8] hover:bg-slate-50'
              }`}
            >
              Veg {vegOnly ? '🟢' : '⚪'}
            </button>
          </div>
        </div>

        {/* Sticky Search Bar */}
        <div className="mt-3 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search food items or beverages..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] placeholder-[#94A3B8] text-xs focus:outline-none focus:border-[#3A7D7C] focus:bg-white shadow-2xs transition-all"
          />
        </div>

        {/* Category Horizontal Pills */}
        <div className="flex gap-2 overflow-x-auto pt-3 pb-0.5 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-[#3A7D7C] text-white shadow-xs'
                : 'bg-white text-[#64748B] border border-[#D7E5E8] hover:bg-slate-50 hover:text-[#1F2937]'
            }`}
          >
            All Items
          </button>
          {categories.map((c, idx) => (
            <button
              key={c.id ? `cat-${c.id}-${idx}` : `cat-${idx}`}
              onClick={() => setSelectedCategory(c.id.toString())}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === c.id.toString()
                  ? 'bg-[#3A7D7C] text-white shadow-xs'
                  : 'bg-white text-[#64748B] border border-[#D7E5E8] hover:bg-slate-50 hover:text-[#1F2937]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {/* Food Items List */}
      <main className="p-4 space-y-3.5">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-[#64748B] text-sm bg-white rounded-2xl border border-[#D7E5E8] p-6 shadow-xs">
            No menu items match your search or dietary filter.
          </div>
        ) : (
          filteredItems.map((item) => {
            const inCartQty = cart
              .filter((c) => c.item.id === item.id)
              .reduce((sum, c) => sum + c.quantity, 0);

            const nameLower = (item.name || '').toLowerCase();
            const isMeatName = 
              nameLower.includes('chicken') || 
              nameLower.includes('mutton') || 
              nameLower.includes('fish') || 
              nameLower.includes('prawn') || 
              nameLower.includes('egg') || 
              nameLower.includes('meat') || 
              nameLower.includes('pork') || 
              nameLower.includes('beef') || 
              nameLower.includes('non-veg') ||
              nameLower.includes('non veg');

            const isVeg = !isMeatName && (item.is_veg === 1 || item.is_veg === true || item.is_veg === '1' || item.is_veg === 'true');

            return (
              <div
                key={item.id}
                className="bg-white border border-[#D7E5E8] rounded-2xl p-3 flex gap-3 shadow-xs hover:border-[#3A7D7C]/60 hover:shadow-sm transition-all"
              >
                {/* Food Image */}
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative border border-[#D7E5E8]">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                    isVeg 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {isVeg ? 'VEG' : 'NON-VEG'}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h3 className="text-sm font-bold text-[#1F2937] leading-snug truncate">{item.name}</h3>
                    <p className="text-[11px] text-[#64748B] line-clamp-2 mt-0.5">{item.description}</p>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#D7E5E8]/60">
                    <div>
                      <span className="text-sm font-black text-[#1F2937]">₹{parseFloat(item.price).toFixed(2)}</span>
                      <div className="text-[10px] text-[#64748B] flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-[#94A3B8]" />
                        <span>{item.prep_time_minutes} mins</span>
                      </div>
                    </div>

                    {/* Add / Controls */}
                    {inCartQty === 0 ? (
                      <button
                        onClick={() => handleAddItemClick(item)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white transition-all shadow-xs active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ADD</span>
                      </button>
                    ) : (
                      <div className="flex items-center bg-[#EAF4F7] border border-[#D7E5E8] rounded-xl overflow-hidden shadow-2xs">
                        <button
                          onClick={() => handleDecreaseItem(item)}
                          className="px-2.5 py-1.5 text-[#3A7D7C] hover:bg-[#D7E5E8] transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-extrabold text-[#1F2937] px-2 min-w-[20px] text-center font-mono">
                          {inCartQty}
                        </span>
                        <button
                          onClick={() => handleIncreaseItem(item)}
                          className="px-2.5 py-1.5 text-[#3A7D7C] hover:bg-[#D7E5E8] transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold shadow-xl shadow-[#3A7D7C]/30 flex items-center justify-between transition-transform active:scale-95 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white text-[#3A7D7C] font-black flex items-center justify-center text-xs shadow-xs">
                {totalItemsCount}
              </div>
              <div className="text-left">
                <div className="text-[11px] text-teal-100 font-semibold uppercase tracking-wider">VIEW CART</div>
                <div className="text-sm font-black">₹{grandTotal.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-extrabold uppercase">
              <span>Checkout Order</span>
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* Modifier Customization Modal */}
      {selectedItemForMod && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white border border-[#D7E5E8] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-[#D7E5E8]">
              <div>
                <h3 className="text-base font-bold text-[#1F2937]">{selectedItemForMod.name}</h3>
                <p className="text-xs text-[#3A7D7C] font-bold">₹{parseFloat(selectedItemForMod.price).toFixed(2)}</p>
              </div>
              <button
                onClick={() => setSelectedItemForMod(null)}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#1F2937] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modifiers List */}
            <div className="py-4 space-y-4">
              {selectedItemForMod.modifiers.map((mod) => (
                <div key={mod.id} className="space-y-2">
                  <label className="block text-xs font-bold text-[#1F2937]">
                    {mod.name} {mod.is_required && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="space-y-1.5">
                    {mod.options && mod.options.map((opt) => {
                      const isSelected = (selectedOptions[mod.id] || []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            const current = selectedOptions[mod.id] || [];
                            let updated;
                            if (mod.max_selection === 1) {
                              updated = [opt.id];
                            } else {
                              updated = isSelected ? current.filter((id) => id !== opt.id) : [...current, opt.id];
                            }
                            setSelectedOptions({ ...selectedOptions, [mod.id]: updated });
                          }}
                          className={`w-full p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#EAF4F7] border-[#3A7D7C] text-[#3A7D7C] font-bold'
                              : 'bg-slate-50 border-[#D7E5E8] text-[#1F2937] hover:bg-slate-100'
                          }`}
                        >
                          <span>{opt.name}</span>
                          <span className="font-semibold">{parseFloat(opt.price_adjustment) > 0 ? `+₹${parseFloat(opt.price_adjustment).toFixed(2)}` : 'Free'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs font-bold text-[#1F2937] mb-1">Special Cooking Instructions</label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows="2"
                  placeholder="e.g. Extra gravy, less chili, no onions..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs focus:outline-none focus:border-[#3A7D7C] focus:bg-white"
                ></textarea>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D7E5E8] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedItemForMod(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-[#1F2937] text-xs font-bold border border-[#D7E5E8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const allOptionIds = Object.values(selectedOptions).flat();
                  addToCart(selectedItemForMod, allOptionIds, specialInstructions);
                }}
                className="px-5 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs shadow-md shadow-[#3A7D7C]/20 cursor-pointer"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer Slide-over */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white h-full flex flex-col justify-between border-l border-[#D7E5E8] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#D7E5E8] flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#3A7D7C]" />
                <h3 className="text-base font-bold text-[#1F2937]">Your Order Cart</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1F2937] hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{submitError}</span>
                </div>
              )}

              {cart.map((c, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-[#D7E5E8] flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#1F2937] truncate">{c.item.name}</h4>
                    <div className="text-[11px] text-[#3A7D7C] font-bold mt-0.5">₹{parseFloat(c.item.price).toFixed(2)}</div>
                    {c.instructions && (
                      <p className="text-[10px] text-[#64748B] italic mt-0.5">Note: "{c.instructions}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-[#D7E5E8] rounded-xl px-2 py-1 shadow-2xs">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="p-1 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-[#1F2937] w-4 text-center">{c.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="p-1 text-[#64748B] hover:text-[#1F2937] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Customer Inputs */}
              <div className="pt-4 space-y-3 border-t border-[#D7E5E8]">
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">Your Name (Optional)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs focus:outline-none focus:border-[#3A7D7C] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">Mobile Phone (Optional for SMS updates)</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs focus:outline-none focus:border-[#3A7D7C] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Bill Summary Footer */}
            <div className="p-4 border-t border-[#D7E5E8] bg-slate-50 space-y-3">
              <div className="space-y-1.5 text-xs text-[#64748B]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-[#1F2937] font-semibold">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Taxes (5%)</span>
                  <span className="text-[#1F2937] font-semibold">₹{estimatedTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#1F2937] pt-2 border-t border-[#D7E5E8]">
                  <span>Grand Total</span>
                  <span className="text-[#3A7D7C] font-black">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-sm shadow-lg shadow-[#3A7D7C]/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{submitting ? 'Placing Order...' : 'Confirm & Send Order to Kitchen'}</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

