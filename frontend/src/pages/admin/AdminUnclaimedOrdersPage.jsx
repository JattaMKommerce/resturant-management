import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Bike,
  Phone,
  MapPin,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  User,
  ArrowRight,
  ShieldAlert,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import { useSocket } from '../../context/SocketContext';
import { playServiceChime, unlockAudio } from '../../utils/audio';

export default function AdminUnclaimedOrdersPage() {
  const { slug } = useParams();
  const { socket } = useSocket();

  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedOrderForDriver, setSelectedOrderForDriver] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  // Update clock every second for live countdown / elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchUnclaimedOrders = async () => {
    try {
      const [orderRes, driverRes] = await Promise.all([
        api.get('/admin/orders/unclaimed'),
        api.get('/admin/drivers').catch(() => ({ data: { drivers: [] } }))
      ]);

      if (orderRes.data.success) {
        const newOrders = orderRes.data.orders || [];
        setOrders(newOrders);
        if (newOrders.length > 0 && soundEnabled) {
          playServiceChime('unclaimed_order_alert');
        }
      }

      if (driverRes.data && driverRes.data.drivers) {
        setDrivers(driverRes.data.drivers);
      }
    } catch (err) {
      console.error('Error loading unclaimed orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnclaimedOrders();
    const pollInterval = setInterval(fetchUnclaimedOrders, 8000);

    return () => clearInterval(pollInterval);
  }, [soundEnabled]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchUnclaimedOrders();
    socket.on('notification', handleUpdate);
    socket.on('order_update', handleUpdate);
    socket.on('order_updated', handleUpdate);

    return () => {
      socket.off('notification', handleUpdate);
      socket.off('order_update', handleUpdate);
      socket.off('order_updated', handleUpdate);
    };
  }, [socket]);

  const handleSelfDeliver = async (orderId) => {
    if (!window.confirm('Mark this order for Hotel In-House Delivery (Self-Delivery)?')) return;
    setActionLoadingId(orderId);
    try {
      unlockAudio();
      const res = await api.post(`/admin/orders/${orderId}/self-deliver`);
      if (res.data.success) {
        alert('✅ Order claimed! It is now marked as Out for Delivery by Hotel Staff.');
        fetchUnclaimedOrders();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to claim order for self-delivery.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedOrderForDriver || !selectedDriverId) return;
    setActionLoadingId(selectedOrderForDriver.id);
    try {
      unlockAudio();
      const res = await api.post(`/admin/orders/${selectedOrderForDriver.id}/assign-driver`, {
        driver_id: selectedDriverId
      });
      if (res.data.success) {
        alert('✅ Rider assigned successfully to the order.');
        setSelectedOrderForDriver(null);
        setSelectedDriverId('');
        fetchUnclaimedOrders();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign driver.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getElapsedTimeDisplay = (createdAt) => {
    const createdMs = new Date(createdAt).getTime();
    const diffSec = Math.max(0, Math.floor((nowTimestamp - createdMs) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Unclaimed Delivery Orders
                </h1>
                {orders.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black animate-pulse shadow-sm">
                    {orders.length} URGENT
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Orders not claimed by any delivery rider within 5 minutes. Deliver via hotel staff or assign a rider directly.
              </p>
            </div>
          </div>

          {/* Quick Sound & Refresh Controls */}
          <div className="flex items-center gap-3 self-end md:self-center">
            <button
              onClick={() => {
                unlockAudio();
                playServiceChime('unclaimed_order_alert');
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              title="Test Urgent Audio Chime"
            >
              <Volume2 className="w-4 h-4 text-rose-600" />
              Test Sound
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                soundEnabled
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
              title={soundEnabled ? 'Urgent Sound Alert Active' : 'Sound Muted'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <button
              onClick={fetchUnclaimedOrders}
              className="px-4 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="bg-white rounded-3xl p-16 border border-slate-200 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-500 mt-4">Checking for unclaimed delivery orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 border border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">All Delivery Orders Claimed!</h3>
            <p className="text-xs text-slate-500 max-w-md">
              There are no orders waiting longer than 5 minutes. Riders are accepting orders promptly!
            </p>
            <Link
              to={`/admin/${slug || 'grand-palace'}/orders`}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              View All Orders <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orders.map((order) => {
              const waitingDisplay = getElapsedTimeDisplay(order.created_at);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl border-2 border-rose-300 p-6 shadow-md hover:shadow-lg transition-all space-y-4 relative overflow-hidden"
                >
                  {/* Top Urgency Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-rose-100 text-rose-800 text-xs font-black flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        Waiting {waitingDisplay}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        #{order.order_number}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                      ₹{parseFloat(order.total_amount || 0).toFixed(0)} ({order.payment_method})
                    </span>
                  </div>

                  {/* Customer Information */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-800">{order.customer_name}</span>
                      </div>
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 text-[11px] shadow-xs"
                      >
                        <Phone className="w-3 h-3" /> Call {order.customer_phone}
                      </a>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <p className="line-clamp-2 leading-relaxed">
                        {order.delivery_address} {order.delivery_area ? `(${order.delivery_area})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="space-y-1.5 text-xs">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Ordered Dishes ({order.items?.length || 0})
                    </p>
                    <div className="divide-y divide-slate-100 max-h-32 overflow-y-auto">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="py-1.5 flex justify-between items-center text-slate-700">
                          <span className="font-medium">
                            {item.quantity}x {item.item_name}
                          </span>
                          <span className="font-bold text-slate-900">₹{item.item_total}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
                    {/* Deliver In-House Button */}
                    <button
                      onClick={() => handleSelfDeliver(order.id)}
                      disabled={actionLoadingId === order.id}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Bike className="w-4 h-4" />
                      {actionLoadingId === order.id ? 'Updating...' : 'Deliver In-House (Self)'}
                    </button>

                    {/* Assign Specific Rider Button */}
                    <button
                      onClick={() => setSelectedOrderForDriver(order)}
                      disabled={actionLoadingId === order.id}
                      className="py-3 px-4 bg-[#3A7D7C] hover:bg-[#2F6665] disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-4 h-4" />
                      Assign Rider
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Manual Rider Assignment Modal */}
        {selectedOrderForDriver && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-base">
                  Assign Rider for #{selectedOrderForDriver.order_number}
                </h3>
                <button
                  onClick={() => setSelectedOrderForDriver(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Select an active delivery rider to assign this order directly:
                </p>

                {drivers.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    No active registered drivers found. You can deliver this order using hotel in-house staff!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {drivers.map((d) => (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                          selectedDriverId === String(d.id)
                            ? 'border-[#3A7D7C] bg-[#EAF4F7]'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="driver_choice"
                            checked={selectedDriverId === String(d.id)}
                            onChange={() => setSelectedDriverId(String(d.id))}
                            className="text-[#3A7D7C] focus:ring-[#3A7D7C]"
                          />
                          <div>
                            <p className="font-bold text-xs text-slate-900">{d.full_name || 'Driver'}</p>
                            <p className="text-[11px] text-slate-500">{d.mobile} • {d.vehicle_type || 'Bike'} ({d.vehicle_number || 'Vehicle'})</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {d.availability_status || 'ONLINE'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setSelectedOrderForDriver(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignDriver}
                  disabled={!selectedDriverId || actionLoadingId}
                  className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
