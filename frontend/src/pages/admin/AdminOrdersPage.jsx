import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  MapPin, 
  Phone, 
  Bike, 
  ChefHat, 
  PackageCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  X,
  ExternalLink
} from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import OrderMap from '../../components/OrderMap';
import { useSocket } from '../../context/SocketContext';

export default function AdminOrdersPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');
  const { socket } = useSocket();

  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Selected Order Drawer
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [assigningDriverId, setAssigningDriverId] = useState('');

  useEffect(() => {
    fetchOrdersAndDrivers();
  }, [statusFilter]);

  // Live Socket Listener for Order Delivery & Status Updates
  useEffect(() => {
    if (!socket) return;

    const handleLiveOrderUpdate = () => {
      fetchOrdersAndDrivers(false);
    };

    socket.on('order_update', handleLiveOrderUpdate);
    socket.on('admin_notification', handleLiveOrderUpdate);
    socket.on('order_status_updated', handleLiveOrderUpdate);
    socket.on('new_order', handleLiveOrderUpdate);

    // Fallback polling every 10 seconds to ensure consistency
    const pollInterval = setInterval(() => {
      fetchOrdersAndDrivers(false);
    }, 10000);

    return () => {
      socket.off('order_update', handleLiveOrderUpdate);
      socket.off('admin_notification', handleLiveOrderUpdate);
      socket.off('order_status_updated', handleLiveOrderUpdate);
      socket.off('new_order', handleLiveOrderUpdate);
      clearInterval(pollInterval);
    };
  }, [socket, statusFilter]);

  const fetchOrdersAndDrivers = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      let url = '/admin/orders';
      if (statusFilter !== 'ALL') {
        url += `?status=${statusFilter}`;
      }
      const res = await api.get(url);
      if (res.data.success) {
        setOrders(res.data.orders);
        if (highlightId && res.data.orders.length > 0) {
          const found = res.data.orders.find((o) => o.id === parseInt(highlightId));
          if (found) setSelectedOrder(found);
        }
        // Update selected order in drawer if open
        setSelectedOrder((prev) => {
          if (!prev) return null;
          const updated = res.data.orders.find((o) => o.id === prev.id);
          return updated ? { ...prev, ...updated } : prev;
        });
      }

      const drvRes = await api.get('/admin/drivers');
      if (drvRes.data.success) {
        setDrivers(drvRes.data.drivers.filter(d => d.is_active === 1));
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      fetchOrdersAndDrivers();
      if (selectedOrder && selectedOrder.id === orderId) {
        const updatedRes = await api.get(`/orders/${orderId}`);
        if (updatedRes.data.success) setSelectedOrder(updatedRes.data.order);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating order status');
    }
  };

  const handleAssignDriver = async (orderId) => {
    if (!assigningDriverId) return;
    try {
      await api.post(`/admin/orders/${orderId}/assign-driver`, { driver_id: assigningDriverId });
      setAssigningDriverId('');
      fetchOrdersAndDrivers();
      if (selectedOrder && selectedOrder.id === orderId) {
        const updatedRes = await api.get(`/orders/${orderId}`);
        if (updatedRes.data.success) setSelectedOrder(updatedRes.data.order);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error assigning driver');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.toLowerCase().includes(q)
    );
  });

  const statuses = [
    'ALL',
    'PENDING',
    'ACCEPTED',
    'SENT_TO_KITCHEN',
    'PREPARING',
    'READY_FOR_PICKUP',
    'ASSIGNED_TO_DRIVER',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED'
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Orders Management Console</h2>
            <p className="text-xs text-slate-500">Live order processing pipeline, kitchen handoff & rider dispatch</p>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order #, Customer Name, or Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Order #</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Delivery Area & Distance</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Status Pipeline</th>
                  <th className="p-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredOrders.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className="hover:bg-orange-50/50 cursor-pointer transition-colors"
                  >
                    <td className="p-4 font-black text-slate-900">{ord.order_number}</td>
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{ord.customer_name}</span>
                      <span className="text-[11px] text-slate-400">{ord.customer_phone}</span>
                    </td>

                    <td className="p-4">
                      <span className="font-bold text-slate-800 block">{ord.delivery_area}</span>
                      <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {ord.distance_km} km away
                      </span>
                    </td>

                    <td className="p-4 font-black text-slate-900">₹{parseFloat(ord.total_amount).toFixed(2)}</td>

                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                        {ord.payment_method} ({ord.payment_status})
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full font-black text-[10px] inline-flex items-center gap-1 uppercase tracking-wider ${
                        ord.order_status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : ord.order_status === 'OUT_FOR_DELIVERY' || ord.order_status === 'ASSIGNED_TO_DRIVER'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : ord.order_status === 'READY_FOR_PICKUP'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : ord.order_status === 'PREPARING' || ord.order_status === 'SENT_TO_KITCHEN'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : ord.order_status === 'CANCELLED' || ord.order_status === 'DELIVERY_FAILED'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-orange-100 text-orange-800 border border-orange-200'
                      }`}>
                        {ord.order_status === 'DELIVERED' && <CheckCircle2 className="w-3 h-3" />}
                        {ord.order_status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {ord.order_status === 'PENDING' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'ACCEPTED')}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-xs"
                          >
                            Accept Order
                          </button>
                        )}

                        {ord.order_status === 'ACCEPTED' && (
                          <button
                            onClick={() => handleUpdateStatus(ord.id, 'SENT_TO_KITCHEN')}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1"
                          >
                            <ChefHat className="w-3.5 h-3.5" /> Send to Kitchen
                          </button>
                        )}

                        {ord.order_status === 'READY_FOR_PICKUP' && (
                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1"
                          >
                            <Bike className="w-3.5 h-3.5" /> Assign Rider
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Order Detail Drawer Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl p-6 overflow-y-auto space-y-6 animate-slide-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Order Details</span>
                <h3 className="text-xl font-black text-slate-900">#{selectedOrder.order_number}</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Quick Status Control Dropdown */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-700">Advance Order Status Pipeline:</label>
              <div className="flex flex-wrap gap-2">
                {['ACCEPTED', 'SENT_TO_KITCHEN', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                    disabled={selectedOrder.order_status === st}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedOrder.order_status === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-orange-50'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Rider Details */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">🛵 Delivery Rider Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  selectedOrder.assigned_driver_id || selectedOrder.driver_name
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800 animate-pulse'
                }`}>
                  {selectedOrder.assigned_driver_id || selectedOrder.driver_name ? 'Accepted & Assigned' : 'Self-Service Pool (Waiting for Rider)'}
                </span>
              </div>

              {selectedOrder.assigned_driver_id || selectedOrder.driver_name ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-black">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{selectedOrder.driver_name || 'Assigned Driver'}</h4>
                      <p className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                        <span>📞 {selectedOrder.driver_phone || 'No phone provided'}</span>
                        {selectedOrder.vehicle_number && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-[10px] text-slate-700">
                            {selectedOrder.vehicle_type || 'Vehicle'}: {selectedOrder.vehicle_number}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Fulfillment</span>
                    <span className="font-bold text-orange-600 uppercase text-xs">{selectedOrder.order_status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-800 flex items-center gap-2.5">
                  <span className="text-base">⚡</span>
                  <div>
                    <span className="font-bold block">Self-Service Dispatch Active</span>
                    <span className="text-[11px] text-amber-700">Online delivery drivers can claim and deliver this order directly from their dashboard.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Location Map */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-xs text-slate-900">Delivery Address Location Map</h4>
              <OrderMap
                restaurantLat={selectedOrder.restaurant_latitude || 12.9716}
                restaurantLng={selectedOrder.restaurant_longitude || 77.5946}
                restaurantName={selectedOrder.restaurant_name}
                customerLat={selectedOrder.customer_latitude}
                customerLng={selectedOrder.customer_longitude}
                customerAddress={selectedOrder.delivery_address}
                driverLat={selectedOrder.driver_latitude}
                driverLng={selectedOrder.driver_longitude}
                distanceKm={selectedOrder.distance_km}
              />
            </div>

            {/* Customer Details */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <span className="font-bold text-slate-900 block">Customer: {selectedOrder.customer_name} ({selectedOrder.customer_phone})</span>
              <p className="text-slate-600">Address: {selectedOrder.delivery_address}, {selectedOrder.delivery_area}</p>
              {selectedOrder.delivery_landmark && <p className="text-slate-500">Landmark: {selectedOrder.delivery_landmark}</p>}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-xs text-slate-900">Ordered Items</h4>
              <div className="divide-y divide-slate-100 text-xs">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between">
                    <span>{item.item_name} (x{item.quantity})</span>
                    <span className="font-bold">₹{parseFloat(item.item_total).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </AdminLayout>
  );
}
