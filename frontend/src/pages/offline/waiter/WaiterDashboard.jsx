import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import Badge from '../../../components/common/Badge';
import { 
  ConciergeBell, 
  CheckCheck, 
  RefreshCw, 
  Utensils, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Grid2X2, 
  ShoppingBag,
  Bell,
  AlertCircle
} from 'lucide-react';

export default function WaiterDashboard() {
  const { joinRoom, leaveRoom, socket } = useSocket();

  const [tables, setTables] = useState([]);
  const [readyKOTs, setReadyKOTs] = useState([]);
  const [allKOTs, setAllKOTs] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ready Food Toast Alert
  const [notification, setNotification] = useState(null);

  const fetchServiceData = async () => {
    setLoading(true);
    try {
      const [tableRes, readyKotRes, allKotRes, orderRes] = await Promise.all([
        api.get('/tables'),
        api.get('/kots?status=READY'),
        api.get('/kots'),
        api.get('/orders')
      ]);

      if (tableRes.success) setTables(tableRes.data);
      if (readyKotRes.success) setReadyKOTs(readyKotRes.data);
      if (allKotRes.success) setAllKOTs(allKotRes.data);
      if (orderRes.success) setActiveOrders(orderRes.data);
    } catch (err) {
      console.error('Failed to load waiter dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceData();

    joinRoom('waiter');

    if (socket) {
      const handleOrderReady = (data) => {
        setNotification(`🔔 Food Ready! Table ${data.table_number || 'N/A'} (KOT #${data.kot_number})`);
        fetchServiceData();
        setTimeout(() => setNotification(null), 6000);
      };

      socket.on('order_ready', handleOrderReady);
      socket.on('new_order', () => fetchServiceData());
      socket.on('kot_updated', () => fetchServiceData());
      socket.on('table_status_changed', () => fetchServiceData());
    }

    return () => {
      leaveRoom('waiter');
      if (socket) {
        socket.off('order_ready');
        socket.off('new_order');
        socket.off('kot_updated');
        socket.off('table_status_changed');
      }
    };
  }, [socket]);

  const handleMarkServed = async (kotId) => {
    try {
      await api.patch(`/kots/${kotId}/status`, { status: 'SERVED' });
      fetchServiceData();
    } catch (err) {
      alert(err.message || 'Failed to mark food served');
    }
  };

  const handleRequestBill = async (tableId) => {
    try {
      await api.patch(`/tables/${tableId}/status`, { status: 'BILL_REQUESTED' });
      fetchServiceData();
    } catch (err) {
      alert(err.message || 'Failed to request bill');
    }
  };

  // Table summary counts
  const availableTablesCount = tables.filter(t => t.status === 'AVAILABLE').length;
  const occupiedTablesCount = tables.filter(t => ['OCCUPIED', 'ORDERING'].includes(t.status)).length;
  const attentionTablesCount = tables.filter(t => ['BILL_REQUESTED', 'BILL_PAID', 'CLEANING'].includes(t.status) || readyKOTs.some(k => k.table_id === t.id)).length;

  // Order summary counts
  const activeOrdersCount = activeOrders.filter(o => ['CONFIRMED', 'IN_KITCHEN', 'READY'].includes(o.order_status)).length;
  const pendingKOTsCount = allKOTs.filter(k => ['PENDING', 'ACCEPTED', 'PREPARING'].includes(k.status)).length;
  const readyKOTsCount = readyKOTs.length;
  const servedKOTsCount = allKOTs.filter(k => k.status === 'SERVED').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification Alert Banner */}
      {notification && (
        <div className="p-4 rounded-2xl bg-[#3A7D7C] text-white font-bold flex items-center justify-between shadow-md animate-bounce">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 animate-pulse" />
            <span className="text-sm">{notification}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-white font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <ConciergeBell className="w-6 h-6 text-[#3A7D7C]" />
            <span>Service & Waiter Dashboard</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Real-time food ready pickup notifications, table lifecycle, and pending service</p>
        </div>

        <button
          onClick={fetchServiceData}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 1. TABLE SUMMARY */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Table Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs text-emerald-800 font-bold uppercase">🟢 Available Tables</span>
              <h4 className="text-3xl font-extrabold text-[#1F2937] mt-1">{availableTablesCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Grid2X2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs text-amber-800 font-bold uppercase">🟡 Occupied Tables</span>
              <h4 className="text-3xl font-extrabold text-[#1F2937] mt-1">{occupiedTablesCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs text-rose-800 font-bold uppercase">🔴 Attention Required</span>
              <h4 className="text-3xl font-extrabold text-[#1F2937] mt-1">{attentionTablesCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. ORDER SUMMARY */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Order Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 shadow-xs">
            <span className="text-xs text-[#64748B] font-bold uppercase flex items-center gap-1.5">
              🍽️ Active Orders
            </span>
            <h4 className="text-2xl font-black text-[#1F2937] mt-1">{activeOrdersCount}</h4>
          </div>

          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 shadow-xs">
            <span className="text-xs text-amber-800 font-bold uppercase flex items-center gap-1.5">
              🧾 Pending KOTs
            </span>
            <h4 className="text-2xl font-black text-amber-900 mt-1">{pendingKOTsCount}</h4>
          </div>

          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 shadow-xs">
            <span className="text-xs text-emerald-800 font-bold uppercase flex items-center gap-1.5">
              ✓ Ready for Serving
            </span>
            <h4 className="text-2xl font-black text-emerald-900 mt-1">{readyKOTsCount}</h4>
          </div>

          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 shadow-xs">
            <span className="text-xs text-[#3A7D7C] font-bold uppercase flex items-center gap-1.5">
              🍽️ Served
            </span>
            <h4 className="text-2xl font-black text-[#3A7D7C] mt-1">{servedKOTsCount}</h4>
          </div>
        </div>
      </div>

      {/* 3. ORDERS REQUIRING ATTENTION (Food Ready Cards) */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Food Ready for Pickup ({readyKOTs.length})</span>
        </h3>

        {readyKOTs.length === 0 ? (
          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-6 text-center text-[#64748B] text-xs shadow-xs">
            No dishes waiting for serving at the moment. All orders are up to date.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyKOTs.map((kot) => (
              <div
                key={kot.id}
                className="bg-white border border-emerald-300 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all space-y-4 ring-2 ring-emerald-50"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                        ✓ Food Ready 🔔
                      </span>
                      <h4 className="text-2xl font-extrabold text-[#1F2937] mt-2">
                        Table {kot.table_number || 'N/A'}
                      </h4>
                      <p className="text-xs text-[#64748B] font-medium mt-0.5">
                        Kitchen: {kot.kitchen_department_name} • KOT #{kot.kot_number}
                      </p>
                    </div>
                  </div>

                  <div className="my-3 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-[#D7E5E8] text-xs">
                    {kot.items && kot.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[#1F2937]">
                        <span className="font-bold">{item.quantity}× {item.item_name}</span>
                        {item.special_instructions && (
                          <span className="text-[10px] text-amber-800 font-semibold">({item.special_instructions})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleMarkServed(kot.id)}
                    className="w-full py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Mark as Served</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. REAL-TIME TABLE STATUS GRID */}
      <div className="space-y-3 pt-4 border-t border-[#D7E5E8]">
        <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider">Restaurant Floor Overview</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((t) => {
            const isFoodReady = readyKOTs.some(k => k.table_id === t.id);
            return (
              <div
                key={t.id}
                className={`bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                  isFoodReady
                    ? 'border-emerald-400 ring-2 ring-emerald-100'
                    : t.status === 'BILL_REQUESTED'
                    ? 'border-amber-300 ring-2 ring-amber-50'
                    : t.status === 'OCCUPIED'
                    ? 'border-[#3A7D7C]/40'
                    : 'border-[#D7E5E8]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-[11px] font-bold text-[#64748B] uppercase">{t.floor} • {t.section}</span>
                      <h4 className="text-lg font-bold text-[#1F2937]">{t.table_number} ({t.table_name})</h4>
                    </div>
                    {isFoodReady ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse">
                        🟡 Food Ready
                      </span>
                    ) : (
                      <Badge status={t.status} />
                    )}
                  </div>

                  <p className="text-xs text-[#64748B] mt-1 font-medium">Capacity: {t.capacity} Guests</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#D7E5E8] flex items-center justify-between gap-2">
                  {t.status === 'OCCUPIED' && (
                    <button
                      onClick={() => handleRequestBill(t.id)}
                      className="w-full py-2 px-3 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8] hover:bg-[#d5e7ec] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Request Bill</span>
                    </button>
                  )}

                  {t.status === 'BILL_REQUESTED' && (
                    <div className="w-full py-2 px-3 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold text-center border border-amber-200">
                      Bill Requested
                    </div>
                  )}

                  {['AVAILABLE', 'CLEANING', 'RESERVED'].includes(t.status) && (
                    <div className="text-xs text-[#64748B] font-semibold text-center w-full py-1">Ready for guests</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
