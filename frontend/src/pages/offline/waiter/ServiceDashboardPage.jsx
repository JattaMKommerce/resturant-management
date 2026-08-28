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
      const handleServiceUpdate = () => fetchServiceData();

      socket.on('order_ready', handleServiceUpdate);
      socket.on('new_order', handleServiceUpdate);
      socket.on('kot_updated', handleServiceUpdate);
      socket.on('table_status_changed', handleServiceUpdate);
      socket.on('call_waiter', handleServiceUpdate);
      socket.on('bill_requested', handleServiceUpdate);
    }

    return () => {
      leaveRoom('waiter');
      if (socket) {
        socket.off('order_ready');
        socket.off('new_order');
        socket.off('kot_updated');
        socket.off('table_status_changed');
        socket.off('call_waiter');
        socket.off('bill_requested');
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
    <div className="space-y-6 antialiased font-sans">
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
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors shadow-2xs"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* FOOD READY PICKUP ALERTS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Food Ready for Pickup ({readyKOTs.length})</span>
          </h3>
        </div>

        {readyKOTs.length === 0 ? (
          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-6 text-center text-[#64748B] text-xs shadow-xs">
            No dishes waiting for pickup at the moment. All orders are up to date.
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

                <button
                  onClick={() => handleMarkServed(kot.id)}
                  className="w-full py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-2xs flex items-center justify-center gap-2"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark as Served</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tables Status & Active Service Grid */}
      <div className="space-y-3 pt-4 border-t border-[#D7E5E8]">
        <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider">Restaurant Floor Overview</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                t.status === 'BILL_REQUESTED'
                  ? 'border-amber-300 ring-2 ring-amber-50'
                  : t.status === 'OCCUPIED'
                  ? 'border-[#3A7D7C]/40'
                  : 'border-[#D7E5E8]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">{t.floor} • {t.section}</span>
                    <h4 className="text-lg font-bold text-[#1F2937]">{t.table_number} ({t.table_name})</h4>
                  </div>
                  <Badge status={t.status} />
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
                    Bill Requested (Cashier Notified)
                  </div>
                )}

                {['AVAILABLE', 'CLEANING', 'RESERVED'].includes(t.status) && (
                  <div className="text-xs text-[#64748B] font-semibold text-center w-full py-1">Ready for guests</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
