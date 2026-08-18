import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import Badge from '../../../components/common/Badge';
import { ConciergeBell, CheckCheck, RefreshCw, AlertCircle, Utensils, Receipt, CheckCircle2 } from 'lucide-react';

export default function ServiceDashboardPage() {
  const { joinRoom, leaveRoom, socket } = useSocket();

  const [tables, setTables] = useState([]);
  const [readyKOTs, setReadyKOTs] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchServiceData = async () => {
    setLoading(true);
    try {
      const [tableRes, kotRes, orderRes] = await Promise.all([
        api.get('/tables'),
        api.get('/kots?status=READY'),
        api.get('/orders?status=CONFIRMED')
      ]);

      if (tableRes.success) setTables(tableRes.data);
      if (kotRes.success) setReadyKOTs(kotRes.data);
      if (orderRes.success) setActiveOrders(orderRes.data);
    } catch (err) {
      console.error('Failed to load service dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceData();

    joinRoom('waiter');

    if (socket) {
      socket.on('order_ready', () => {
        fetchServiceData();
      });
      socket.on('new_order', () => {
        fetchServiceData();
      });
      socket.on('kot_updated', () => {
        fetchServiceData();
      });
      socket.on('table_status_changed', () => {
        fetchServiceData();
      });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <ConciergeBell className="w-7 h-7 text-amber-500" />
            <span>Service & Waiter Dashboard</span>
          </h2>
          <p className="text-slate-400 text-sm">Real-time food ready pickup notifications, table lifecycle, and pending service</p>
        </div>

        <button
          onClick={fetchServiceData}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* FOOD READY PICKUP ALERTS (Urgent Top Section) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Food Ready for Pickup ({readyKOTs.length})</span>
          </h3>
        </div>

        {readyKOTs.length === 0 ? (
          <div className="glass-panel bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-sm">
            No dishes waiting for pickup at the moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyKOTs.map((kot) => (
              <div
                key={kot.id}
                className="glass-panel bg-emerald-950/20 border border-emerald-500/50 rounded-2xl p-4 flex flex-col justify-between shadow-xl shadow-emerald-500/5 animate-fade-in"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        FOOD READY 🔔
                      </span>
                      <h4 className="text-2xl font-black text-white mt-1">
                        TABLE {kot.table_number || 'N/A'}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium">
                        Kitchen: {kot.kitchen_department_name} • KOT #{kot.kot_number}
                      </p>
                    </div>
                  </div>

                  <div className="my-3 space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-xs">
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

                <button
                  onClick={() => handleMarkServed(kot.id)}
                  className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <CheckCheck className="w-5 h-5" />
                  <span>MARK AS SERVED</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tables Status & Active Service Grid */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Restaurant Floor Overview</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between transition-all shadow-xl ${
                t.status === 'BILL_REQUESTED'
                  ? 'border-amber-500/60 shadow-amber-500/10'
                  : t.status === 'OCCUPIED'
                  ? 'border-blue-500/40'
                  : 'border-slate-800/90'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">{t.floor} • {t.section}</span>
                    <h4 className="text-xl font-black text-white">{t.table_number} ({t.table_name})</h4>
                  </div>
                  <Badge status={t.status} />
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
                    BILL REQUESTED (CASHIER NOTIFIED)
                  </div>
                )}

                {['AVAILABLE', 'CLEANING', 'RESERVED'].includes(t.status) && (
                  <div className="text-xs text-slate-500 text-center w-full py-1">Ready for guests</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
