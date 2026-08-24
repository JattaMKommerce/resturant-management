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
  const [requestingCounter, setRequestingCounter] = useState(false);

  const handlePayAtCounter = async () => {
    if (!order || requestingCounter) return;
    setRequestingCounter(true);
    try {
      const res = await api.post(`/public/orders/${order.id}/request-counter-payment`);
      if (res.success) {
        alert('🔔 Pay at Counter request sent! The Cashier & Waiter have been notified.');
        fetchOrderTracking();
      } else {
        alert(res.message || 'Failed to send request to counter');
      }
    } catch (err) {
      alert(err.message || 'Failed to connect to cashier counter');
    } finally {
      setRequestingCounter(false);
    }
  };

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

      // Auto-poll every 3 seconds for continuous mobile live-sync
      const pollInterval = setInterval(() => {
        fetchOrderTracking();
      }, 3000);

      if (socket) {
        socket.on('order_updated', (data) => {
          console.log('Live order update received:', data);
          fetchOrderTracking();
        });
        socket.on('kot_updated', () => {
          fetchOrderTracking();
        });
        socket.on('table_status_changed', () => {
          fetchOrderTracking();
        });
      }

      return () => {
        clearInterval(pollInterval);
        leaveRoom(room);
        if (socket) {
          socket.off('order_updated');
          socket.off('kot_updated');
          socket.off('table_status_changed');
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
      <div className="min-h-screen bg-[#F4F8FA] flex flex-col items-center justify-center p-6 text-[#64748B]">
        <div className="w-12 h-12 rounded-2xl bg-[#EAF4F7] border border-[#D7E5E8] flex items-center justify-center mb-3 shadow-xs">
          <Clock className="w-6 h-6 text-[#3A7D7C] animate-spin" />
        </div>
        <p className="text-sm font-bold text-[#1F2937]">Loading Live Order Status...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#F4F8FA] flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-[#D7E5E8] rounded-3xl p-8 max-w-sm text-center shadow-xl">
          <UtensilsCrossed className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1F2937] mb-2">Order Not Found</h3>
          <p className="text-sm text-[#64748B] mb-6">{error || 'Order tracking information is unavailable.'}</p>
        </div>
      </div>
    );
  }

  const activeStepIdx = getStepIndex(order.order_status);

  return (
    <div className="min-h-screen bg-[#F4F8FA] text-[#1F2937] p-4 max-w-md mx-auto relative shadow-2xl font-sans antialiased border-x border-[#D7E5E8]">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-[#D7E5E8] mb-6">
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
            <p className="text-xs text-[#3A7D7C] font-bold">Order #{order.order_number}</p>
          </div>
        </div>

        <button
          onClick={fetchOrderTracking}
          className="p-2.5 rounded-xl bg-white border border-[#D7E5E8] text-[#64748B] hover:text-[#1F2937] shadow-2xs hover:bg-slate-50 cursor-pointer"
          title="Refresh Status"
        >
          <RefreshCw className="w-4 h-4 text-[#3A7D7C]" />
        </button>
      </div>

      {/* Live Status Banner */}
      <div className="bg-white border border-[#D7E5E8] rounded-3xl p-6 mb-6 text-center relative overflow-hidden shadow-sm">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8] mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#3A7D7C]" />
          <span>Realtime Kitchen KOT Sync</span>
        </div>

        <h2 className="text-2xl font-black text-[#1F2937] uppercase tracking-wider mb-1">
          {statusSteps[activeStepIdx]?.label || order.order_status}
        </h2>
        <p className="text-xs text-[#64748B]">{statusSteps[activeStepIdx]?.desc}</p>
        
        {order.table_number && (
          <div className="mt-4 pt-3 border-t border-[#D7E5E8] text-xs font-bold text-[#3A7D7C]">
            Delivering to Table {order.table_number}
          </div>
        )}
      </div>

      {/* Timeline Steps */}
      <div className="bg-white border border-[#D7E5E8] rounded-3xl p-6 mb-6 space-y-6 shadow-xs">
        <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Order Status Timeline</h3>
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
                    idx < activeStepIdx ? 'bg-[#3A7D7C]' : 'bg-[#D7E5E8]'
                  }`}
                ></div>
              )}

              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                  isCurrent
                    ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-md shadow-[#3A7D7C]/20 scale-110'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-50 text-[#94A3B8] border-[#D7E5E8]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div>
                <h4 className={`text-sm font-bold ${isDone ? 'text-[#1F2937]' : 'text-[#94A3B8]'}`}>
                  {step.label}
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Itemized Order Breakdown & Digital Bill */}
      <div className="bg-white border border-[#D7E5E8] rounded-3xl p-5 mb-6 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-2">
          <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
            🧾 Digital Tax Bill ({order.items ? order.items.length : 0} items)
          </h3>
          {order.bill_number && (
            <span className="text-[11px] font-mono text-[#3A7D7C] font-bold">{order.bill_number}</span>
          )}
        </div>

        {order.items && order.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-[#D7E5E8]/60 last:border-0">
            <div>
              <span className="font-extrabold text-[#1F2937]">{item.quantity}× </span>
              <span className="text-[#1F2937] font-medium">{item.item_name}</span>
            </div>
            <span className="font-bold text-[#1F2937] font-mono">₹{parseFloat(item.total_price).toFixed(2)}</span>
          </div>
        ))}

        <div className="pt-2 border-t border-[#D7E5E8] space-y-1.5 text-xs text-[#64748B]">
          <div className="flex justify-between">
            <span>Item Subtotal:</span>
            <span className="font-mono text-[#1F2937] font-semibold">₹{parseFloat(order.subtotal || order.total_amount * 0.9523).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST + SGST (5%):</span>
            <span className="font-mono text-[#1F2937] font-semibold">₹{parseFloat(order.tax_amount || order.total_amount * 0.0476).toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-[#D7E5E8] flex justify-between items-center text-sm font-black text-[#1F2937]">
            <span>Grand Total:</span>
            <span className="text-[#3A7D7C] font-mono text-base font-black">₹{parseFloat(order.total_amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Status Banner */}
        <div className="pt-3 border-t border-[#D7E5E8]">
          {order.payment_status === 'PAID' || order.payment_status === 'ROOM_CHARGED' ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-bold text-xs">
                <CheckCheck className="w-4 h-4" />
                <span>PAYMENT RECEIVED • BILL SETTLED</span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Payment Method: <span className="text-emerald-800 font-semibold">{order.payment_method || 'Cash/Card/UPI'}</span>
              </p>
              <p className="text-[11px] text-[#64748B]">Thank you for dining at Grand Palace!</p>
            </div>
          ) : order.payment_status === 'BILL_REQUESTED' ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
                <Clock className="w-4 h-4" />
                <span>PAY AT COUNTER REQUESTED • CASHIER NOTIFIED</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Please visit the Cashier Counter to settle your bill of <span className="text-amber-400 font-bold font-mono">₹{parseFloat(order.total_amount).toFixed(2)}</span> in cash or card.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-amber-800 font-bold text-xs">
                  <Clock className="w-4 h-4" />
                  <span>SELECT PAYMENT METHOD</span>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Pay directly online or request to settle with cash/card at the counter.
                </p>
              </div>

              {/* 2 Payment Options: Pay Online vs Pay at Counter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handlePayOnline}
                  disabled={paying}
                  className="w-full py-3.5 px-3 rounded-2xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#3A7D7C]/20 hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span>{paying ? 'Opening Gateway...' : `💳 Pay ₹${parseFloat(order.total_amount).toFixed(2)} Online`}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePayAtCounter}
                  disabled={requestingCounter}
                  className="w-full py-3.5 px-3 rounded-2xl bg-white border border-[#D7E5E8] text-[#1F2937] hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span>{requestingCounter ? 'Sending Request...' : '💵 Pay at Counter (Cash)'}</span>
                </button>
              </div>
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
          className="w-full py-3 rounded-2xl bg-[#EAF4F7] border border-[#D7E5E8] text-[#3A7D7C] hover:bg-[#D7E5E8] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Bell className="w-4 h-4 text-amber-500" />
          <span>Call Waiter / Request Service</span>
        </button>

        {order.qr_token && (
          <Link
            to={`/order/table/${order.qr_token}`}
            className="w-full py-3.5 rounded-2xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#3A7D7C]/20 hover:opacity-95 transition-all"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>{order.payment_status === 'PAID' ? 'Start Next Order (Refresh Table Menu)' : 'Order More Dishes (Return to Menu)'}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
