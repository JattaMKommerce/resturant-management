import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, ChefHat, PackageCheck, AlertCircle, MapPin, Phone,
  ShoppingBag, ArrowLeft, RefreshCw, Bike, Navigation, AlertTriangle, Sparkles, Volume2
} from 'lucide-react';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';
import { registerWebPushSubscription } from '../../utils/pushSubscriber';
import OrderMap from '../../components/OrderMap';

export default function OrderTrackingPage({ overrideSlug }) {
  const params = useParams();
  const slug = overrideSlug || params.slug;
  const orderId = params.orderId;
  const { socket, joinRoom, leaveRoom } = useSocket();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverCoords, setDriverCoords] = useState(null);
  const [pushStatus, setPushStatus] = useState('default');
  const [remainingMinutes, setRemainingMinutes] = useState(45);

  const fetchOrderDetails = async () => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data.success) {
        setOrder(res.data.order);
        if (res.data.order.driver_latitude && res.data.order.driver_longitude) {
          setDriverCoords({
            lat: parseFloat(res.data.order.driver_latitude),
            lng: parseFloat(res.data.order.driver_longitude)
          });
        }
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
    } finally {
      setLoading(false);
    }
  };

  const enablePush = async () => {
    const res = await registerWebPushSubscription(orderId);
    if (res.success) {
      setPushStatus('granted');
    } else {
      setPushStatus('denied');
    }
  };

  useEffect(() => {
    fetchOrderDetails();

    // Auto-attempt silent Web Push registration
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setPushStatus('granted');
        registerWebPushSubscription(orderId).catch(() => { });
      } else {
        setPushStatus(Notification.permission);
      }
    }

    // 3-second auto-poll for 100% reliable real-time sync on all mobile/desktop devices
    const pollInterval = setInterval(() => {
      fetchOrderDetails();
    }, 3000);

    if (orderId) {
      const roomOrder = `order_${orderId}`;
      const roomCust = `customer_${orderId}`;
      joinRoom(roomOrder);
      joinRoom(roomCust);

      return () => {
        clearInterval(pollInterval);
        leaveRoom(roomOrder);
        leaveRoom(roomCust);
      };
    }

    return () => clearInterval(pollInterval);
  }, [orderId]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => fetchOrderDetails();

    socket.on('notification', handleUpdate);
    socket.on('order_update', handleUpdate);
    socket.on('order_updated', handleUpdate);
    socket.on('order_status_updated', handleUpdate);

    // Phase 2 Live Driver Location Stream
    socket.on('driver_location_stream', (data) => {
      if (data.latitude && data.longitude) {
        setDriverCoords({
          lat: parseFloat(data.latitude),
          lng: parseFloat(data.longitude)
        });
      }
    });

    return () => {
      socket.off('notification', handleUpdate);
      socket.off('order_update', handleUpdate);
      socket.off('order_updated', handleUpdate);
      socket.off('order_status_updated', handleUpdate);
      socket.off('driver_location_stream');
    };
  }, [socket]);

  // Calculate 45-minute countdown ticker in background
  useEffect(() => {
    if (!order) return;

    const createdAtMs = order.created_at ? new Date(order.created_at).getTime() : Date.now();
    const targetEndMs = createdAtMs + (45 * 60 * 1000); // 45 mins fulfillment window

    const updateCountdown = () => {
      const diffMs = targetEndMs - Date.now();
      const mins = Math.max(0, Math.ceil(diffMs / (60 * 1000)));
      setRemainingMinutes(mins);
    };

    updateCountdown();
    const ticker = setInterval(updateCountdown, 10000); // update every 10s

    return () => clearInterval(ticker);
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-medium text-sm">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Order Not Found</h2>
        <Link to={`/restaurant/${slug || 'grand-palace'}`} className="mt-6 px-6 py-2.5 bg-orange-500 text-white font-bold rounded-xl text-sm">
          Return to Restaurant
        </Link>
      </div>
    );
  }

  const pipeline = [
    { key: 'PENDING', label: 'Placed', icon: Clock },
    { key: 'ACCEPTED', label: 'Accepted', icon: CheckCircle2 },
    { key: 'PREPARING', label: 'Preparing', icon: ChefHat },
    { key: 'ASSIGNED_TO_DRIVER', label: 'Rider Assigned', icon: Bike },
    { key: 'OUT_FOR_DELIVERY', label: 'On The Way', icon: Navigation },
    { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 }
  ];

  const statusOrderIndex = {
    'PENDING': 0,
    'ACCEPTED': 1,
    'SENT_TO_KITCHEN': 2,
    'PREPARING': 2,
    'READY_FOR_PICKUP': 2,
    'ASSIGNED_TO_DRIVER': 3,
    'DRIVER_ACCEPTED': 3,
    'PICKED_UP': 4,
    'OUT_FOR_DELIVERY': 4,
    'DELIVERED': 5
  };

  const currentStep = statusOrderIndex[order.order_status] !== undefined ? statusOrderIndex[order.order_status] : 0;
  const isCancelled = order.order_status === 'REJECTED' || order.order_status === 'CANCELLED';
  const isFailed = order.order_status === 'DELIVERY_FAILED';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link to={`/restaurant/${slug || order.restaurant_slug}`} className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-slate-900 text-base">Order #{order.order_number}</h1>
            <p className="text-xs text-slate-500">{order.restaurant_name}</p>
          </div>
        </div>

        <button onClick={fetchOrderDetails} className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">

        {/* Status Notification Banner */}
        {isCancelled ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 text-xs font-bold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-extrabold text-sm">Order {order.order_status}</p>
              <p className="text-[11px] text-red-600">This order was cancelled or rejected by the restaurant.</p>
            </div>
          </div>
        ) : isFailed ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs font-bold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-extrabold text-sm">Delivery Issue En Route</p>
              <p className="text-[11px] text-amber-700">The restaurant team is resolving a delivery issue with your partner.</p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 block">Active Order Status</span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">
                {order.order_status === 'OUT_FOR_DELIVERY' ? 'Food is Out For Delivery! 🚀' :
                  order.order_status === 'DELIVERED' ? 'Order Delivered! Enjoy Your Meal 🎉' :
                    order.order_status.replace(/_/g, ' ')}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Amount</span>
              <span className="font-black text-slate-900 text-base">₹{order.total_amount}</span>
            </div>
          </div>
        )}

        {/* Progress Timeline */}
        {!isCancelled && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Order Progress Pipeline</h3>
            <div className="flex justify-between items-center">
              {pipeline.map((step, idx) => {
                const isCompleted = currentStep >= idx;
                const isCurrent = currentStep === idx;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCompleted ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' :
                        isCurrent ? 'bg-orange-500 text-white ring-4 ring-orange-100 animate-pulse' :
                          'bg-slate-100 text-slate-400'
                      }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-bold mt-1.5 text-center hidden sm:block ${isCompleted ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LIVE GOOGLE MAP ROUTE WITH DRIVER MARKER */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-orange-500" /> Live Delivery Map Stream
            </h3>
            {order.order_status === 'OUT_FOR_DELIVERY' && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[10px] flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Live Rider GPS Active
              </span>
            )}
          </div>

          <div className="h-72 rounded-2xl overflow-hidden">
            <OrderMap
              restaurantLat={order.restaurant_latitude}
              restaurantLng={order.restaurant_longitude}
              restaurantName={order.restaurant_name}
              customerLat={order.customer_latitude}
              customerLng={order.customer_longitude}
              customerAddress={order.delivery_address}
              driverCoords={driverCoords}
              driverName={order.driver_name}
              orderStatus={order.order_status}
              distanceKm={order.distance_km}
            />
          </div>
        </div>

        {/* DRIVER PARTNER INFO BADGE (PHASE 2) */}
        {order.driver_name && (
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
                <Bike className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Your Delivery Partner</span>
                <h4 className="font-extrabold text-slate-900 text-sm">{order.driver_name}</h4>
                <p className="text-xs text-slate-500">{order.vehicle_type || 'Motorbike'} • {order.vehicle_number || 'KA Vehicle'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                On Duty ✓
              </span>
            </div>
          </div>
        )}

        {/* Order Details & Summary */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 text-xs">
          <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Order Summary</h3>
          <div className="divide-y divide-slate-100">
            {order.items?.map((item, idx) => (
              <div key={idx} className="py-2.5 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-800">{item.quantity}x {item.item_name}</span>
                  {item.special_instructions && <p className="text-[10px] text-slate-400">Note: {item.special_instructions}</p>}
                </div>
                <span className="font-semibold text-slate-900">₹{item.item_total}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-1.5 text-slate-600">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
            <div className="flex justify-between"><span>Taxes & Charges</span><span>₹{order.tax_amount}</span></div>
            <div className="flex justify-between"><span>Delivery Fee</span><span>₹{order.delivery_fee}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-100 text-slate-900 font-extrabold text-sm">
              <span>Total Paid ({order.payment_method})</span>
              <span className="text-emerald-600">₹{order.total_amount}</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
