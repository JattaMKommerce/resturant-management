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
    <div className="bg-[#EAF4F7] -m-4 sm:-m-6 p-4 sm:p-6 min-h-[calc(100vh-4rem)] text-[#1F2937] rounded-xl space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#3A7D7C]" />
            <span>Ready Orders for Serving ({readyKOTs.length})</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Dishes marked READY by kitchen waiting for immediate table pickup</p>
        </div>

        <button
          onClick={fetchReadyOrders}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Ready Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-white border border-[#D7E5E8] shadow-xs"></div>
          ))}
        </div>
      ) : readyKOTs.length === 0 ? (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-16 text-center text-[#64748B] shadow-xs">
          <Utensils className="w-16 h-16 text-[#64748B]/40 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-[#1F2937]">No Ready Orders Pending Pickup</h3>
          <p className="text-sm text-[#64748B] mt-1">When kitchen staff marks food READY, it will appear here instantly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {readyKOTs.map((kot) => (
            <div
              key={kot.id}
              className="bg-white border border-emerald-300 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all kot-card-hover"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                      ✓ Ready for Pickup
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-[#1F2937] mt-2">Table {kot.table_number || 'N/A'}</h3>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5">
                      Kitchen: {kot.kitchen_department_name} • KOT #{kot.kot_number}
                    </p>
                  </div>
                </div>

                {/* Items in ticket */}
                <div className="mt-4 p-3 rounded-xl bg-white border border-[#D7E5E8] space-y-1.5 text-xs">
                  {kot.items && kot.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[#1F2937]">
                      <span className="font-semibold">{item.quantity}× {item.item_name}</span>
                      <span className="text-emerald-700 font-bold">READY</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleMarkServed(kot.id)}
                className="w-full py-3 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-2xs flex items-center justify-center gap-2"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark Food Delivered & Served</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
