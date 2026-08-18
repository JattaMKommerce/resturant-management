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
        <div className="p-4 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-between shadow-xl shadow-emerald-500/20 animate-bounce">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 animate-pulse" />
            <span className="text-sm">{notification}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-xs bg-slate-950/20 hover:bg-slate-950/40 px-3 py-1.5 rounded-lg text-slate-950 font-black"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <ConciergeBell className="w-7 h-7 text-amber-500" />
            <span>GRAND PALACE HMS — Waiter Operational Dashboard</span>
          </h2>
          <p className="text-slate-400 text-sm">Real-time table status, food ready pickup alerts, active orders & service tracking</p>
        </div>

        <button
          onClick={fetchServiceData}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* 1. TABLE SUMMARY */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Table Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-400 font-bold uppercase">🟢 Available Tables</span>
              <h4 className="text-3xl font-black text-white mt-1">{availableTablesCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Grid2X2 className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-panel bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-400 font-bold uppercase">🟡 Occupied Tables</span>
              <h4 className="text-3xl font-black text-white mt-1">{occupiedTablesCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Utensils className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-panel bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-rose-400 font-bold uppercase">🔴 Attention Required</span>
              <h4 className="text-3xl font-black text-white mt-1">{attentionTablesCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. ORDER SUMMARY */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-semibold uppercase flex items-center gap-1.5">
              🍽️ Active Orders
            </span>
            <h4 className="text-2xl font-black text-white mt-1">{activeOrdersCount}</h4>
          </div>

          <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-semibold uppercase flex items-center gap-1.5">
              🧾 Pending KOTs
            </span>
            <h4 className="text-2xl font-black text-amber-400 mt-1">{pendingKOTsCount}</h4>
          </div>

          <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-semibold uppercase flex items-center gap-1.5">
              ✓ Ready for Serving
            </span>
            <h4 className="text-2xl font-black text-emerald-400 mt-1">{readyKOTsCount}</h4>
          </div>

          <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 font-semibold uppercase flex items-center gap-1.5">
              🍽️ Served
            </span>
            <h4 className="text-2xl font-black text-sky-400 mt-1">{servedKOTsCount}</h4>
          </div>
        </div>
      </div>

      {/* 3. ORDERS REQUIRING ATTENTION (Urgent Pickup Cards) */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Orders Requiring Attention ({readyKOTs.length})</span>
        </h3>

        {readyKOTs.length === 0 ? (
          <div className="glass-panel bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-sm">
            No dishes waiting for serving at the moment. All orders up to date.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyKOTs.map((kot) => (
              <div
                key={kot.id}
                className="glass-panel bg-emerald-950/30 border border-emerald-500/60 rounded-2xl p-4 flex flex-col justify-between shadow-xl shadow-emerald-500/10"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        ✓ READY FOR SERVING
                      </span>
                      <h4 className="text-2xl font-black text-white mt-1">
                        Table {kot.table_number || 'N/A'}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium">
                        Kitchen: {kot.kitchen_department_name} • KOT #{kot.kot_number}
                      </p>
                    </div>
                  </div>

                  <div className="my-3 space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
                    {kot.items && kot.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-slate-200">
                        <span className="font-bold">{item.quantity}× {item.item_name}</span>
                        {item.special_instructions && (
                          <span className="text-[10px] text-amber-400">({item.special_instructions})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleMarkServed(kot.id)}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <CheckCheck className="w-5 h-5" />
                    <span>MARK SERVED</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. REAL-TIME TABLE STATUS GRID */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Table Status Real-time Floor Overview</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((t) => {
            const isFoodReady = readyKOTs.some(k => k.table_id === t.id);
            return (
              <div
                key={t.id}
                className={`glass-panel bg-slate-900/80 border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                  isFoodReady
                    ? 'border-emerald-500/70 shadow-emerald-500/10'
                    : t.status === 'BILL_REQUESTED'
                    ? 'border-amber-500/60 shadow-amber-500/10'
                    : t.status === 'OCCUPIED'
                    ? 'border-blue-500/40'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">{t.floor} • {t.section}</span>
                      <h4 className="text-xl font-bold text-white">{t.table_number} ({t.table_name})</h4>
                    </div>
                    {isFoodReady ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                        🟡 Food Ready
                      </span>
                    ) : (
                      <Badge status={t.status} />
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-1">Capacity: {t.capacity} Guests</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {t.status === 'OCCUPIED' && (
                    <button
                      onClick={() => handleRequestBill(t.id)}
                      className="w-full py-2 px-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>REQUEST BILL</span>
                    </button>
                  )}

                  {t.status === 'BILL_REQUESTED' && (
                    <div className="w-full py-2 px-3 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold text-center border border-amber-500/40">
                      BILL REQUESTED
                    </div>
                  )}

                  {['AVAILABLE', 'CLEANING', 'RESERVED'].includes(t.status) && (
                    <div className="text-xs text-emerald-400 font-semibold text-center w-full py-1">🟢 Available for guests</div>
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
