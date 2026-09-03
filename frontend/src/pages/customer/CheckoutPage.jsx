import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Phone, User, ArrowLeft, ShoppingBag, AlertCircle, Loader2, CreditCard, Banknote, Minus, Plus, X, Gift } from 'lucide-react';
import KratuRewardsWidget from '../../components/customer/KratuRewardsWidget';

export default function CheckoutPage({ overrideSlug }) {
  const params = useParams();
  const slug = overrideSlug || params.slug;
  const navigate = useNavigate();
  const { cartItems, getSubtotal, updateQuantity, removeFromCart, clearCart, getItemCount } = useCart();
  const { guestInfo } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [formData, setFormData] = useState({
    customerName: guestInfo?.customerName || '',
    customerPhone: guestInfo?.customerPhone || '',
    deliveryAddress: '',
    deliveryArea: '',
    deliveryLandmark: '',
    deliveryInstructions: '',
    paymentMethod: 'COD'
  });

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Kratu Rewards State (16-Slide Blueprint)
  const [rewardsQuote, setRewardsQuote] = useState(null);
  const [rewardsStatement, setRewardsStatement] = useState(null);
  const [rewardsToRedeem, setRewardsToRedeem] = useState(0);
  const [checkoutId] = useState(() => 'CHK_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

  useEffect(() => {
    loadRestaurant();
    // Pre-fill from returning guest
    if (guestInfo?.customerName) setFormData(f => ({ ...f, customerName: guestInfo.customerName }));
    if (guestInfo?.customerPhone) setFormData(f => ({ ...f, customerPhone: guestInfo.customerPhone }));
  }, [slug]);

  const loadRestaurant = async () => {
    try {
      const res = await api.get(`/restaurants/${slug}`);
      setRestaurant(res.data.restaurant);
    } catch (err) {
      setError('Restaurant not found.');
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const subtotal = getSubtotal();

  // Load Kratu Rewards quote and balance for this restaurant cart
  useEffect(() => {
    if (restaurant?.id && subtotal > 0) {
      loadRewardsQuote();
    }
  }, [restaurant?.id, subtotal]);

  const loadRewardsQuote = async () => {
    try {
      const [qRes, sRes] = await Promise.all([
        api.post('/wallet/checkout/quote', {
          tenantId: restaurant.id,
          orderAmount: subtotal
        }),
        api.get(`/wallet/customer/statement?tenantId=${restaurant.id}`)
      ]);
      if (qRes.data.success) setRewardsQuote(qRes.data.data);
      if (sRes.data.success) setRewardsStatement(sRes.data.data);
    } catch (e) {
      console.warn('Could not load rewards quote:', e.message);
    }
  };

  const taxPercentage = parseFloat(restaurant?.tax_percentage || 5);
  const taxAmount = Math.round(subtotal * (taxPercentage / 100) * 100) / 100;
  const deliveryFee = parseFloat(restaurant?.delivery_fee || 49);
  const grossTotal = Math.round((subtotal + taxAmount + deliveryFee) * 100) / 100;
  const total = Math.max(0, Math.round((grossTotal - rewardsToRedeem) * 100) / 100);
  const minOrderMet = subtotal >= parseFloat(restaurant?.min_order_amount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.customerName || !formData.customerPhone || !formData.deliveryAddress || !formData.deliveryArea) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!minOrderMet) {
      setError(`Minimum order amount is ₹${restaurant.min_order_amount}.`);
      return;
    }

    setPlacing(true);
    let reservedOk = false;

    try {
      // 1. If customer opted to redeem rewards, lock them with a 10-minute reservation (Slide 06)
      if (rewardsToRedeem > 0) {
        await api.post('/wallet/checkout/reserve', {
          tenantId: restaurant?.id,
          checkoutId,
          requestedAmount: rewardsToRedeem
        });
        reservedOk = true;
      }

      const payload = {
        restaurantId: restaurant?.id,
        restaurantSlug: restaurant?.slug || restaurant?.random_slug || slug,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        deliveryAddress: formData.deliveryAddress,
        deliveryArea: formData.deliveryArea,
        deliveryLandmark: formData.deliveryLandmark,
        deliveryInstructions: formData.deliveryInstructions,

        // Kratu Rewards Integration
        walletCheckoutId: rewardsToRedeem > 0 ? checkoutId : null,
        rewardsDiscount: rewardsToRedeem,

        paymentMethod: formData.paymentMethod,
        items: cartItems.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || ''
        }))
      };

      const res = await api.post('/orders/checkout', payload);
      if (res.data.success) {
        const { orderId, orderNumber } = res.data.order;

        if (formData.paymentMethod === 'ONLINE') {
          // Initiate Razorpay payment
          try {
            const payRes = await api.post('/payments/initiate', { order_id: orderId });
            if (payRes.data.success && payRes.data.payment) {
              handleRazorpayPayment(payRes.data.payment, orderId, orderNumber);
              return;
            }
          } catch (payErr) {
            console.warn('Razorpay init failed, redirecting to tracking:', payErr);
          }
        }

        clearCart();
        navigate(`/restaurant/${slug}/order/${orderId}`);
      }
    } catch (err) {
      // If reservation was made, release it back to customer (Slide 06)
      if (reservedOk) {
        try {
          await api.post('/wallet/checkout/release', {
            tenantId: restaurant?.id,
            checkoutId,
            reason: 'Order checkout error'
          });
        } catch (rErr) {}
      }
      setError(err.response?.data?.message || 'Failed to place order. Please try again.');
    }
    setPlacing(false);
  };

  const handleRazorpayPayment = (paymentData, orderId, orderNumber) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: paymentData.amount,
      currency: paymentData.currency || 'INR',
      name: restaurant?.name || 'Restaurant',
      description: `Order #${orderNumber}`,
      order_id: paymentData.razorpay_order_id || paymentData.orderId,
      handler: async function (response) {
        try {
          await api.post('/payments/verify', {
            order_id: orderId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });
        } catch (err) {
          console.warn('Payment verification warning:', err);
        }
        clearCart();
        navigate(`/restaurant/${slug}/order/${orderId}`);
      },
      modal: {
        ondismiss: () => {
          clearCart();
          navigate(`/restaurant/${slug}/order/${orderId}`);
        }
      },
      prefill: { name: formData.customerName, contact: formData.customerPhone },
      theme: { color: '#f97316' }
    };

    if (typeof window.Razorpay !== 'undefined') {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      // Mock mode or Razorpay not loaded
      clearCart();
      navigate(`/restaurant/${slug}/order/${orderId}`);
    }
    setPlacing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <ShoppingBag className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">Your cart is empty</h2>
        <button onClick={() => navigate(`/restaurant/${slug}`)} className="mt-4 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-all">
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/restaurant/${slug}`)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">Checkout</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Cart Items */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Your Order</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {cartItems.map(item => (
                <div key={item.id} className="p-4 flex items-center gap-3">
                  <span className={`w-4 h-4 flex items-center justify-center rounded-sm border-2 flex-shrink-0 ${item.is_veg ? 'border-emerald-500' : 'border-red-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">{item.name}</p>
                    <p className="text-sm text-slate-500">₹{item.price} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg">
                    <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 text-orange-600 hover:bg-orange-100 rounded-l-lg">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold text-orange-600 w-6 text-center">{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 text-orange-600 hover:bg-orange-100 rounded-r-lg">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="font-semibold text-slate-800 text-sm w-16 text-right">₹{(item.price * item.quantity).toFixed(0)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <h2 className="font-semibold text-slate-800">Delivery Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Your name" required className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Mobile Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} placeholder="+91 XXXXX XXXXX" required className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 outline-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Delivery Address *</label>
              <textarea name="deliveryAddress" value={formData.deliveryAddress} onChange={handleInputChange} placeholder="Flat/House No., Building, Street" required rows={2} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 outline-none resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Area / Locality *</label>
                <input type="text" name="deliveryArea" value={formData.deliveryArea} onChange={handleInputChange} placeholder="Koramangala, Indiranagar" required className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Landmark</label>
                <input type="text" name="deliveryLandmark" value={formData.deliveryLandmark} onChange={handleInputChange} placeholder="Near Metro Station" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Delivery Instructions</label>
              <input type="text" name="deliveryInstructions" value={formData.deliveryInstructions} onChange={handleInputChange} placeholder="Any special instructions for delivery" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 outline-none" />
            </div>
          </div>



          {/* Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Payment Method</h2>
            <div className="grid grid-cols-2 gap-3">
              {restaurant?.is_cod_enabled !== 0 && (
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.paymentMethod === 'COD' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="paymentMethod" value="COD" checked={formData.paymentMethod === 'COD'} onChange={handleInputChange} className="hidden" />
                  <Banknote className={`w-6 h-6 ${formData.paymentMethod === 'COD' ? 'text-orange-600' : 'text-slate-400'}`} />
                  <div>
                    <p className={`font-medium text-sm ${formData.paymentMethod === 'COD' ? 'text-orange-700' : 'text-slate-700'}`}>Cash on Delivery</p>
                    <p className="text-xs text-slate-400">Pay when delivered</p>
                  </div>
                </label>
              )}
              {restaurant?.is_online_payment_enabled !== 0 && (
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.paymentMethod === 'ONLINE' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="paymentMethod" value="ONLINE" checked={formData.paymentMethod === 'ONLINE'} onChange={handleInputChange} className="hidden" />
                  <CreditCard className={`w-6 h-6 ${formData.paymentMethod === 'ONLINE' ? 'text-orange-600' : 'text-slate-400'}`} />
                  <div>
                    <p className={`font-medium text-sm ${formData.paymentMethod === 'ONLINE' ? 'text-orange-700' : 'text-slate-700'}`}>Pay Online</p>
                    <p className="text-xs text-slate-400">UPI, Card, Wallet</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Kratu Rewards Loyalty Component (16-Slide Blueprint) */}
          <KratuRewardsWidget
            quote={rewardsQuote}
            rewardsToRedeem={rewardsToRedeem}
            setRewardsToRedeem={setRewardsToRedeem}
            statement={rewardsStatement}
            restaurantName={restaurant?.name}
          />

          {/* Bill Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Bill Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Tax ({taxPercentage}%)</span><span>₹{taxAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Delivery Fee</span><span>₹{deliveryFee.toFixed(2)}</span></div>
              
              {rewardsToRedeem > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-50/70 p-1.5 rounded-lg">
                  <span className="flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" /> Kratu Rewards Applied
                  </span>
                  <span>-₹{rewardsToRedeem.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800 text-base">
                <span>Total to Pay</span>
                <span className="text-emerald-700 font-mono">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Place Order */}
          <button
            type="submit"
            disabled={placing || !minOrderMet}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {placing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Placing Order...
              </span>
            ) : (
              `Place Order · ₹${total.toFixed(0)}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
