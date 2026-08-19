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
  ExternalLink,
  RefreshCw,
  Send,
  Navigation
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

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'OUT_FOR_DELIVERY':
      case 'ASSIGNED_TO_DRIVER':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'READY_FOR_PICKUP':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'PREPARING':
      case 'SENT_TO_KITCHEN':
        return 'bg-[#EAF4F7] text-[#3A7D7C] border-[#3A7D7C]/30';
      case 'PENDING':
      case 'ACCEPTED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CANCELLED':
      case 'DELIVERY_FAILED':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-[#1F2937] border-[#D7E5E8]';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 antialiased font-sans">
        
        {/* Header */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-[#3A7D7C]" />
              <span>Online Orders & KOT Pipeline</span>
            </h2>
            <p className="text-[#64748B] text-xs sm:text-sm mt-0.5 font-medium">
              Live web storefront order processing, automatic kitchen department routing, and rider dispatch
            </p>
          </div>

          <button
            onClick={() => fetchOrdersAndDrivers(true)}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold shadow-2xs"
          >
            <RefreshCw className="w-4 h-4 text-[#3A7D7C]" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Tabs & Search */}
        <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs space-y-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order #, Customer Name, or Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs font-semibold text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  statusFilter === st
                    ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                    : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-slate-50 text-[#64748B] font-bold uppercase tracking-wider text-[11px] border-b border-[#D7E5E8]">
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
              <tbody className="divide-y divide-[#D7E5E8]">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-[#64748B] text-xs">Loading orders pipeline...</td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-[#64748B]">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-[#64748B]/40" />
                      <p className="font-bold text-[#1F2937] text-sm">No Orders Found</p>
                      <p className="text-xs text-[#64748B] mt-1">Try adjusting the filter status or search term.</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-bold text-[#3A7D7C] font-mono text-sm">{ord.order_number}</td>
                      <td className="p-4">
                        <span className="font-bold text-[#1F2937] block text-sm">{ord.customer_name}</span>
                        <span className="text-[11px] text-[#64748B] font-mono">{ord.customer_phone}</span>
                      </td>

                      <td className="p-4">
                        <span className="font-semibold text-[#1F2937] block">{ord.delivery_area}</span>
                        <span className="text-[10px] font-bold text-[#3A7D7C] bg-[#EAF4F7] px-2 py-0.5 rounded-md inline-block mt-0.5 border border-[#D7E5E8]">
                          {ord.distance_km} km away
                        </span>
                      </td>

                      <td className="p-4 font-bold text-[#1F2937] text-sm font-mono">₹{parseFloat(ord.total_amount).toFixed(2)}</td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-[#1F2937] border border-[#D7E5E8]">
                          {ord.payment_method} ({ord.payment_status})
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-flex items-center gap-1 uppercase tracking-wider border ${getBadgeStyle(ord.order_status)}`}>
                          {ord.order_status === 'DELIVERED' && <CheckCircle2 className="w-3 h-3" />}
                          {ord.order_status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {ord.order_status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateStatus(ord.id, 'ACCEPTED')}
                              className="bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-[11px] px-3.5 py-1.5 rounded-xl shadow-2xs transition-colors"
                            >
                              Accept Order
                            </button>
                          )}

                          {ord.order_status === 'ACCEPTED' && (
                            <button
                              onClick={() => handleUpdateStatus(ord.id, 'SENT_TO_KITCHEN')}
                              className="bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-[11px] px-3.5 py-1.5 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
                            >
                              <ChefHat className="w-3.5 h-3.5" /> Send to Kitchen
                            </button>
                          )}

                          {ord.order_status === 'READY_FOR_PICKUP' && (
                            <button
                              onClick={() => setSelectedOrder(ord)}
                              className="bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-[11px] px-3.5 py-1.5 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
                            >
                              <Bike className="w-3.5 h-3.5" /> Assign Rider
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Order Detail Drawer Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end animate-fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl p-6 overflow-y-auto space-y-6 border-l border-[#D7E5E8] animate-slide-left">
            <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-4">
              <div>
                <span className="text-xs font-bold text-[#3A7D7C] uppercase tracking-wider">Online Order Details</span>
                <h3 className="text-xl font-bold text-[#1F2937]">#{selectedOrder.order_number}</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Status Control Dropdown */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-[#D7E5E8] space-y-3">
              <label className="block text-xs font-bold text-[#1F2937]">Advance Order Status Pipeline:</label>
              <div className="flex flex-wrap gap-2">
                {['ACCEPTED', 'SENT_TO_KITCHEN', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                    disabled={selectedOrder.order_status === st}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selectedOrder.order_status === st
                        ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                        : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Rider Details */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-[#D7E5E8] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">🛵 Delivery Rider Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  selectedOrder.assigned_driver_id || selectedOrder.driver_name
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                }`}>
                  {selectedOrder.assigned_driver_id || selectedOrder.driver_name ? 'Accepted & Assigned' : 'Self-Service Pool (Waiting for Rider)'}
                </span>
              </div>

              {selectedOrder.assigned_driver_id || selectedOrder.driver_name ? (
                <div className="p-3.5 bg-white rounded-xl border border-[#D7E5E8] flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center font-bold border border-[#D7E5E8]">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1F2937] text-sm">{selectedOrder.driver_name || 'Assigned Driver'}</h4>
                      <p className="text-[#64748B] text-[11px] flex items-center gap-2 mt-0.5">
                        <span>📞 {selectedOrder.driver_phone || 'No phone provided'}</span>
                        {selectedOrder.vehicle_number && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-[10px] text-[#1F2937] border border-[#D7E5E8]">
                            {selectedOrder.vehicle_type || 'Vehicle'}: {selectedOrder.vehicle_number}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-[#64748B] block uppercase">Fulfillment</span>
                    <span className="font-bold text-[#3A7D7C] uppercase text-xs">{selectedOrder.order_status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-[#EAF4F7] rounded-xl border border-[#D7E5E8] text-xs text-[#3A7D7C] flex items-center gap-2.5">
                  <span className="text-base">⚡</span>
                  <div>
                    <span className="font-bold block">Self-Service Dispatch Active</span>
                    <span className="text-[11px] text-[#64748B]">Online delivery drivers can claim and deliver this order directly from their dashboard.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Location Map */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-[#1F2937]">Delivery Address Location Map</h4>
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
            <div className="p-4 rounded-xl bg-slate-50 border border-[#D7E5E8] space-y-1 text-xs">
              <span className="font-bold text-[#1F2937] block">Customer: {selectedOrder.customer_name} ({selectedOrder.customer_phone})</span>
              <p className="text-[#64748B]">Address: {selectedOrder.delivery_address}, {selectedOrder.delivery_area}</p>
              {selectedOrder.delivery_landmark && <p className="text-[#64748B]">Landmark: {selectedOrder.delivery_landmark}</p>}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-[#1F2937]">Ordered Items</h4>
              <div className="divide-y divide-[#D7E5E8] text-xs">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <span className="font-medium text-[#1F2937]">{item.item_name} (x{item.quantity})</span>
                    <span className="font-bold text-[#3A7D7C]">₹{parseFloat(item.item_total).toFixed(2)}</span>
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
