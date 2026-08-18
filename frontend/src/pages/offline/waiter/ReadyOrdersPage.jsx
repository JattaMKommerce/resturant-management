import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import { Bell, CheckCheck, RefreshCw, Utensils } from 'lucide-react';

export default function ReadyOrdersPage() {
  const { joinRoom, leaveRoom, socket } = useSocket();
  const [readyKOTs, setReadyKOTs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReadyOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/kots?status=READY');
      if (res.success) {
        setReadyKOTs(res.data);
      }
    } catch (err) {
      console.error('Failed to load ready orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyOrders();
    joinRoom('waiter');

    if (socket) {
      socket.on('order_ready', () => fetchReadyOrders());
      socket.on('kot_updated', () => fetchReadyOrders());
    }

    return () => {
      leaveRoom('waiter');
      if (socket) {
        socket.off('order_ready');
        socket.off('kot_updated');
      }
    };
  }, [socket]);

  const handleMarkServed = async (kotId) => {
    try {
      await api.patch(`/kots/${kotId}/status`, { status: 'SERVED' });
      fetchReadyOrders();
    } catch (err) {
      alert(err.message || 'Failed to mark order as served');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Bell className="w-7 h-7 text-emerald-400" />
            <span>Ready Orders for Serving ({readyKOTs.length})</span>
          </h2>
          <p className="text-slate-400 text-sm">Dishes marked READY by kitchen waiting for immediate table pickup</p>
        </div>

        <button
          onClick={fetchReadyOrders}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Ready Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-slate-900/50 border border-slate-800"></div>
          ))}
        </div>
      ) : readyKOTs.length === 0 ? (
        <div className="glass-panel bg-slate-900/40 border border-slate-800 rounded-2xl p-16 text-center text-slate-400">
          <Utensils className="w-16 h-16 text-slate-700 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-slate-300">No Ready Orders Pending Pickup</h3>
          <p className="text-sm text-slate-500 mt-1">When kitchen staff marks food READY, it will appear here instantly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {readyKOTs.map((kot) => (
            <div
              key={kot.id}
              className="glass-panel bg-emerald-950/30 border border-emerald-500/60 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl shadow-emerald-500/10"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      ✓ READY FOR PICKUP
                    </span>
                    <h3 className="text-3xl font-black text-white mt-1">Table {kot.table_number || 'N/A'}</h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Kitchen: {kot.kitchen_department_name} • KOT #{kot.kot_number}
                    </p>
                  </div>
                </div>

                <div className="my-3 space-y-1.5 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs">
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
                className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <CheckCheck className="w-5 h-5" />
                <span>MARK SERVED</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
