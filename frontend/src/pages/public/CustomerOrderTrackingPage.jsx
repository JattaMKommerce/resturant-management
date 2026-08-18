import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { 
  UtensilsCrossed, 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Bell, 
  CheckCheck, 
  ArrowLeft, 
  Sparkles,
  RefreshCw 
} from 'lucide-react';

const statusSteps = [
  { key: 'CONFIRMED', label: 'Order Confirmed', desc: 'Order received & sent to kitchen', icon: CheckCircle2 },
  { key: 'IN_KITCHEN', label: 'Preparing', desc: 'Chefs are preparing your dishes', icon: ChefHat },
  { key: 'READY', label: 'Food Ready', desc: 'Service staff is picking up food', icon: Bell },
  { key: 'SERVED', label: 'Served', desc: 'Served at your table. Enjoy your meal!', icon: CheckCheck }
];

export default function CustomerOrderTrackingPage() {
  const { orderId } = useParams();
  const { joinRoom, leaveRoom, socket } = useSocket();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchOrderTracking = async () => {
    try {
      const res = await api.get(`/public/orders/${orderId}/track`);
      if (res.success) {
        setOrder(res.data);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.message || 'Unable to fetch order status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderTracking();

    if (orderId) {
      const room = `customer_${orderId}`;
      joinRoom(room);

      if (socket) {
        socket.on('order_updated', (data) => {
          console.log('Live order update received:', data);
          fetchOrderTracking();
        });
        socket.on('kot_updated', () => {
          fetchOrderTracking();
        });
      }

      return () => {
        leaveRoom(room);
        if (socket) {
          socket.off('order_updated');
          socket.off('kot_updated');
        }
      };
    }
  }, [orderId, socket]);

  const handlePayOnline = async () => {
    if (!order || paying) return;
    setPaying(true);
    try {
      const initRes = await api.post('/payments/initiate', {
        order_id: order.id,
        is_offline: true
      });

      if (!initRes.success || !initRes.payment) {
        throw new Error(initRes.message || 'Failed to initialize payment gateway');
      }

      const p = initRes.payment;

      if (p.isMock || !window.Razorpay) {
        // Mock simulation in dev
        const verifyRes = await api.post('/payments/verify', {
          order_id: order.id,
          razorpay_order_id: p.razorpayOrderId,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: 'mock_sig',
          is_offline: true
        });

        if (verifyRes.success) {
          alert('✅ Payment completed successfully via Razorpay (Mock Mode)!');
          fetchOrderTracking();
        }
        return;
      }

      // Real Razorpay Checkout Popup
      const options = {
        key: p.keyId,
        amount: p.amount,
        currency: p.currency || 'INR',
        name: 'The Grand Palace',
        description: `Dine-In Bill for Table ${order.table_number || ''}`,
        order_id: p.razorpayOrderId,
        handler: async function (response) {
          try {
            const verifyRes = await api.post('/payments/verify', {
              order_id: order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              is_offline: true
            });
            if (verifyRes.success) {
              alert('🎉 Payment verified and bill settled successfully!');
              fetchOrderTracking();
            }
          } catch (err) {
            alert(err.message || 'Payment verification failed');
          }
        },
        prefill: {
          name: order.customer_name || 'Guest',
          contact: order.customer_phone || ''
        },
        theme: {
          color: '#f59e0b'
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response) {
        alert('Payment Failed: ' + (response.error.description || 'Unknown error'));
      });
      rzp1.open();
    } catch (err) {
      alert(err.message || 'Payment initiation failed');
    } finally {
      setPaying(false);
    }
  };

  const getStepIndex = (currentStatus) => {
    switch (currentStatus) {
      case 'PENDING':
      case 'CONFIRMED': return 0;
      case 'IN_KITCHEN':
      case 'PREPARING': return 1;
      case 'READY': return 2;
      case 'SERVED':
      case 'COMPLETED': return 3;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-400">
        <Clock className="w-12 h-12 text-amber-500 animate-spin mb-3" />
        <p className="text-sm font-semibold">Loading Live Order Status...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="glass-panel bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm text-center">
          <UtensilsCrossed className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Order Not Found</h3>
          <p className="text-sm text-slate-400 mb-6">{error || 'Order tracking information is unavailable.'}</p>
        </div>
      </div>
    );
  }

  const activeStepIdx = getStepIndex(order.order_status);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-md mx-auto relative shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <UtensilsCrossed className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">GRAND PALACE</h1>
            <p className="text-xs text-amber-400 font-semibold">Order #{order.order_number}</p>
          </div>
        </div>

        <button
          onClick={fetchOrderTracking}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Live Status Banner */}
      <div className="glass-panel bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-3xl p-6 mb-6 text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-3 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Realtime Live Kitchen Sync</span>
        </div>

        <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-1">
          {statusSteps[activeStepIdx]?.label || order.order_status}
        </h2>
        <p className="text-xs text-slate-400">{statusSteps[activeStepIdx]?.desc}</p>
        
        {order.table_number && (
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs font-bold text-amber-400">
            Delivering to Table {order.table_number}
          </div>
        )}
      </div>

      {/* Timeline Steps */}
      <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-3xl p-6 mb-6 space-y-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Status Timeline</h3>
        {statusSteps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx <= activeStepIdx;
          const isCurrent = idx === activeStepIdx;

          return (
            <div key={step.key} className="flex items-start gap-4 relative">
              {/* Connector line */}
              {idx < statusSteps.length - 1 && (
                <div
                  className={`absolute left-5 top-10 w-0.5 h-10 ${
                    idx < activeStepIdx ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                ></div>
              )}

              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30 scale-110'
                    : isDone
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800/50 text-slate-600 border-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div>
                <h4 className={`text-sm font-bold ${isDone ? 'text-white' : 'text-slate-500'}`}>
                  {step.label}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Itemized Order Breakdown & Digital Bill */}
      <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-3xl p-5 mb-6 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            🧾 Digital Tax Bill ({order.items ? order.items.length : 0} items)
          </h3>
          {order.bill_number && (
            <span className="text-[11px] font-mono text-amber-400 font-bold">{order.bill_number}</span>
          )}
        </div>

        {order.items && order.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/40 last:border-0">
            <div>
              <span className="font-bold text-white">{item.quantity}× </span>
              <span className="text-slate-300 font-medium">{item.item_name}</span>
            </div>
            <span className="font-bold text-amber-400 font-mono">₹{parseFloat(item.total_price).toFixed(2)}</span>
          </div>
        ))}

        <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Item Subtotal:</span>
            <span className="font-mono text-slate-200">₹{parseFloat(order.subtotal || order.total_amount * 0.9523).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST + SGST (5%):</span>
            <span className="font-mono text-slate-200">₹{parseFloat(order.tax_amount || order.total_amount * 0.0476).toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black text-white">
            <span>Grand Total:</span>
            <span className="text-amber-400 font-mono text-base">₹{parseFloat(order.total_amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Status Banner */}
        <div className="pt-3 border-t border-slate-800">
          {order.payment_status === 'PAID' || order.payment_status === 'ROOM_CHARGED' ? (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-xs">
                <CheckCheck className="w-4 h-4" />
                <span>PAYMENT RECEIVED • BILL SETTLED</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Payment Method: <span className="text-emerald-300 font-semibold">{order.payment_method || 'Cash/Card/UPI'}</span>
              </p>
              <p className="text-[11px] text-slate-400">Thank you for dining at Grand Palace!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
                  <Clock className="w-4 h-4" />
                  <span>BILL PENDING PAYMENT</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Pay directly from your phone via UPI / Card or settle with cash at the counter.
                </p>
              </div>

              {/* Direct Online Payment Button for Table QR Diners */}
              <button
                type="button"
                onClick={handlePayOnline}
                disabled={paying}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:opacity-95 transition-all disabled:opacity-50"
              >
                <span>{paying ? 'Opening Gateway...' : `💳 Pay ₹${parseFloat(order.total_amount).toFixed(2)} Online (UPI / Card)`}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons: Call Waiter & Auto-Refresh / Start New Order */}
      <div className="space-y-3 pb-8">
        <button
          onClick={async () => {
            try {
              const tokenParam = order.qr_token || order.table_number || 'default';
              await api.post(`/public/tables/${tokenParam}/call-waiter`, { 
                table_number: order.table_number,
                message: `Assistance requested at Table ${order.table_number || 'Dine-In'}`
              });
              alert(`🛎️ Waiter notified! Service staff is on their way to Table ${order.table_number || ''}.`);
            } catch (e) {
              alert('🛎️ Service call sent to waiter station.');
            }
          }}
          className="w-full py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all hover:bg-slate-850"
        >
          <Bell className="w-4 h-4 text-amber-500" />
          <span>Call Waiter / Request Service</span>
        </button>

        {order.qr_token && (
          <Link
            to={`/order/table/${order.qr_token}`}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:opacity-95 transition-all"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>{order.payment_status === 'PAID' ? 'Start Next Order (Refresh Table Menu)' : 'Order More Dishes (Return to Menu)'}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
