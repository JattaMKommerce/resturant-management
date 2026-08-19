import React, { useState, useEffect } from 'react';
import { 
  Bike, MapPin, Navigation, RefreshCw, AlertTriangle, CheckCircle2, 
  User, Phone, ShoppingBag, RotateCcw
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api/axios';
import OrderMap from '../../components/OrderMap';
import { useSocket } from '../../context/SocketContext';

export default function AdminDeliveriesPage() {
  const { socket } = useSocket();
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Recovery Modal State
  const [selectedFailedOrder, setSelectedFailedOrder] = useState(null);
  const [recoveryAction, setRecoveryAction] = useState('REASSIGN');
  const [selectedNewDriverId, setSelectedNewDriverId] = useState('');
  const [recoveryNotes, setRecoveryNotes] = useState('');
  const [submittingRecovery, setSubmittingRecovery] = useState(false);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // Live Socket Listener for Delivery Driver actions
  useEffect(() => {
    if (!socket) return;

    const handleDeliveryUpdate = () => {
      fetchDeliveries(false);
    };

    socket.on('order_update', handleDeliveryUpdate);
    socket.on('admin_notification', handleDeliveryUpdate);
    socket.on('order_status_updated', handleDeliveryUpdate);
    socket.on('driver_location_stream', handleDeliveryUpdate);
    socket.on('driver_status_change', handleDeliveryUpdate);

    const pollInterval = setInterval(() => {
      fetchDeliveries(false);
    }, 10000);

    return () => {
      socket.off('order_update', handleDeliveryUpdate);
      socket.off('admin_notification', handleDeliveryUpdate);
      socket.off('order_status_updated', handleDeliveryUpdate);
      socket.off('driver_location_stream', handleDeliveryUpdate);
      socket.off('driver_status_change', handleDeliveryUpdate);
      clearInterval(pollInterval);
    };
  }, [socket]);

  const fetchDeliveries = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/orders');
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }

      const driverRes = await api.get('/admin/riders?accountStatus=ACTIVE');
      if (driverRes.data.success) {
        setDrivers(driverRes.data.drivers || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin deliveries:', err);
      setError('Failed to load active delivery data.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleExecuteRecovery = async (e) => {
    e.preventDefault();
    if (!selectedFailedOrder) return;
    setSubmittingRecovery(true);
    setError('');
    try {
      const res = await api.post(`/admin/orders/${selectedFailedOrder.id}/recover-delivery`, {
        action: recoveryAction,
        newDriverId: selectedNewDriverId ? parseInt(selectedNewDriverId) : null,
        notes: recoveryNotes
      });

      if (res.data.success) {
        setSuccessMsg(`Failed delivery recovery executed: ${recoveryAction}`);
        setSelectedFailedOrder(null);
        fetchDeliveries();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to execute recovery action.');
    } finally {
      setSubmittingRecovery(false);
    }
  };

  // Filter active delivery orders & failed deliveries
  const activeDeliveries = orders.filter(o =>
    ['ASSIGNED_TO_DRIVER', 'DRIVER_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.order_status)
  );

  const failedDeliveries = orders.filter(o => o.order_status === 'DELIVERY_FAILED');

  return (
    <AdminLayout>
      <div className="space-y-6 font-sans antialiased">
        
        {/* Header */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
              <Navigation className="w-6 h-6 text-[#3A7D7C]" />
              <span>Active Deliveries & Fleet Monitor</span>
            </h1>
            <p className="text-[#64748B] text-xs sm:text-sm mt-0.5 font-medium">
              Live tracking of delivery partners, active orders in transit, and delivery issue resolution
            </p>
          </div>

          <button
            onClick={fetchDeliveries}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold shadow-2xs"
          >
            <RefreshCw className="w-4 h-4 text-[#3A7D7C]" />
            <span>Refresh Fleet Map</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between font-bold">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold text-sm">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-bold text-sm">✕</button>
          </div>
        )}

        {/* FAILED DELIVERIES RECOVERY SECTION */}
        {failedDeliveries.length > 0 && (
          <div className="bg-white border border-rose-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-sm font-bold">Attention: {failedDeliveries.length} Delivery Failure(s) Requiring Recovery</h2>
            </div>
            <div className="grid gap-3">
              {failedDeliveries.map((fOrder) => (
                <div key={fOrder.id} className="p-4 bg-slate-50 rounded-xl border border-[#D7E5E8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#1F2937]">#{fOrder.order_number}</span>
                      <span className="text-xs font-semibold text-[#64748B]">— {fOrder.customer_name}</span>
                    </div>
                    <p className="text-xs text-rose-600 font-bold mt-1">Reason: {fOrder.delivery_failure_reason || 'Not specified'}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedFailedOrder(fOrder); setSelectedNewDriverId(drivers[0]?.id || ''); }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Resolve & Recover Order
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE DELIVERIES LIST & MAP */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs overflow-hidden p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-bold text-[#1F2937] flex items-center gap-2">
            <Bike className="w-5 h-5 text-[#3A7D7C]" /> Active Delivery Route Monitor ({activeDeliveries.length})
          </h2>

          {loading ? (
            <div className="py-12 text-center text-[#64748B] text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
              Loading live delivery data...
            </div>
          ) : activeDeliveries.length === 0 ? (
            <div className="py-12 text-center text-[#64748B] text-xs font-medium">
              No active deliveries currently in transit.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {activeDeliveries.map((ord) => (
                <div key={ord.id} className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] space-y-3.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#3A7D7C]">#{ord.order_number}</span>
                      <h3 className="font-bold text-sm text-[#1F2937]">{ord.customer_name}</h3>
                      <p className="text-xs text-[#64748B] leading-relaxed">{ord.delivery_address}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[10px] uppercase">
                      {ord.order_status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#D7E5E8] text-xs flex justify-between items-center shadow-2xs">
                    <div>
                      <span className="text-[#64748B] block text-[10px] uppercase font-bold">Assigned Rider</span>
                      <span className="font-bold text-[#1F2937]">{ord.driver_name || 'Assigned Driver'}</span>
                      <span className="text-[11px] text-[#64748B] block font-mono">({ord.vehicle_number})</span>
                    </div>
                    <span className="font-bold text-[#3A7D7C] text-sm font-mono">₹{ord.total_amount} ({ord.payment_method})</span>
                  </div>

                  {/* Map Preview for Active Delivery */}
                  <div className="h-44 rounded-xl overflow-hidden border border-[#D7E5E8]">
                    <OrderMap
                      customerCoords={{ lat: parseFloat(ord.customer_latitude), lng: parseFloat(ord.customer_longitude) }}
                      orderStatus={ord.order_status}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAILED DELIVERY RECOVERY MODAL */}
        {selectedFailedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-[#D7E5E8] space-y-4 shadow-xl">
              <div className="flex items-center gap-2.5 text-rose-700">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-[#1F2937] text-base">Failed Delivery Recovery</h3>
              </div>
              <p className="text-xs text-[#64748B]">
                Order <strong className="text-[#1F2937]">#{selectedFailedOrder.order_number}</strong> failed: {selectedFailedOrder.delivery_failure_reason}
              </p>

              <form onSubmit={handleExecuteRecovery} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Recovery Action *</label>
                  <select
                    value={recoveryAction}
                    onChange={(e) => setRecoveryAction(e.target.value)}
                    className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl p-2.5 text-[#1F2937] font-semibold focus:outline-none focus:border-[#3A7D7C]"
                  >
                    <option value="REASSIGN">Reassign to another active rider</option>
                    <option value="RETRY">Reset order for pickup pool (RETRY)</option>
                    <option value="CANCEL">Cancel order cleanly</option>
                  </select>
                </div>

                {recoveryAction === 'REASSIGN' && (
                  <div>
                    <label className="block font-bold text-[#1F2937] mb-1">Select New Delivery Partner *</label>
                    <select
                      value={selectedNewDriverId}
                      onChange={(e) => setSelectedNewDriverId(e.target.value)}
                      className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl p-2.5 text-[#1F2937] font-semibold focus:outline-none focus:border-[#3A7D7C]"
                    >
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.full_name || d.name} ({d.vehicle_number}) — Status: {d.availability_status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Recovery Operational Notes</label>
                  <textarea
                    rows="2"
                    value={recoveryNotes}
                    onChange={(e) => setRecoveryNotes(e.target.value)}
                    placeholder="Enter notes on resolution"
                    className="w-full bg-slate-50 border border-[#D7E5E8] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                  ></textarea>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFailedOrder(null)}
                    className="flex-1 py-2.5 bg-slate-100 text-[#1F2937] rounded-xl font-bold border border-[#D7E5E8]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRecovery}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-2xs"
                  >
                    {submittingRecovery ? 'Executing...' : 'Execute Recovery Action'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
