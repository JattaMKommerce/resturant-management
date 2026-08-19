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
      <div className="space-y-6 font-sans">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Active Deliveries & Fleet Monitor</h1>
            <p className="text-xs text-slate-500 mt-1">
              Live tracking of delivery partners, active orders in transit, and delivery issue resolution
            </p>
          </div>

          <button
            onClick={fetchDeliveries}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Map & Status
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold text-sm">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-bold text-sm">✕</button>
          </div>
        )}

        {/* FAILED DELIVERIES RECOVERY SECTION (HIGH PRIORITY) */}
        {failedDeliveries.length > 0 && (
          <div className="bg-red-500/10 border-2 border-red-500/30 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-lg font-black">Attention: {failedDeliveries.length} Delivery Failure(s) Requiring Recovery</h2>
            </div>
            <div className="grid gap-3">
              {failedDeliveries.map((fOrder) => (
                <div key={fOrder.id} className="p-4 bg-white rounded-2xl border border-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900">#{fOrder.order_number}</span>
                      <span className="text-xs font-semibold text-slate-600">— {fOrder.customer_name}</span>
                    </div>
                    <p className="text-xs text-red-600 font-bold mt-1">Reason: {fOrder.delivery_failure_reason || 'Not specified'}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedFailedOrder(fOrder); setSelectedNewDriverId(drivers[0]?.id || ''); }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Resolve & Recover Order
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE DELIVERIES LIST & MAP */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 space-y-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Bike className="w-5 h-5 text-orange-500" /> Active Delivery Route Monitor ({activeDeliveries.length})
          </h2>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
              Loading live delivery data...
            </div>
          ) : activeDeliveries.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No active deliveries currently in transit.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {activeDeliveries.map((ord) => (
                <div key={ord.id} className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-900">#{ord.order_number}</span>
                      <h3 className="font-bold text-sm text-slate-800 truncate">{ord.customer_name}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{ord.delivery_address}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-extrabold text-[10px] uppercase shrink-0">
                      {ord.order_status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Rider</span>
                      <span className="font-bold text-slate-900">{ord.driver_name || 'Assigned Driver'}</span>
                      <span className="text-[11px] text-slate-500 ml-1">({ord.vehicle_number})</span>
                    </div>
                    <span className="font-black text-emerald-600 text-sm shrink-0">₹{ord.total_amount} ({ord.payment_method})</span>
                  </div>

                  {/* Map Preview for Active Delivery */}
                  <div className="h-44 sm:h-48 rounded-xl overflow-hidden border border-slate-200">
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
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="max-w-md w-full bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 space-y-4 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-bold text-slate-900 text-base">Failed Delivery Recovery</h3>
              </div>
              <p className="text-xs text-slate-500">
                Order <strong className="text-slate-900">#{selectedFailedOrder.order_number}</strong> failed: {selectedFailedOrder.delivery_failure_reason}
              </p>

              <form onSubmit={handleExecuteRecovery} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Recovery Action *</label>
                  <select
                    value={recoveryAction}
                    onChange={(e) => setRecoveryAction(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="REASSIGN">Reassign to another active rider</option>
                    <option value="RETRY">Reset order for pickup pool (RETRY)</option>
                    <option value="CANCEL">Cancel order cleanly</option>
                  </select>
                </div>

                {recoveryAction === 'REASSIGN' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select New Delivery Partner *</label>
                    <select
                      value={selectedNewDriverId}
                      onChange={(e) => setSelectedNewDriverId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none"
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
                  <label className="block font-bold text-slate-700 mb-1">Recovery Operational Notes</label>
                  <textarea
                    rows="2"
                    value={recoveryNotes}
                    onChange={(e) => setRecoveryNotes(e.target.value)}
                    placeholder="Enter notes on resolution"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none"
                  ></textarea>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFailedOrder(null)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRecovery}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md"
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
