import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import { Clock, CheckCheck, RefreshCw, AlertCircle, Utensils, Globe } from 'lucide-react';

export default function KOTStatusPage() {
  const { joinRoom, leaveRoom, socket } = useSocket();
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL'); // 'ALL', 'OFFLINE', 'ONLINE'

  const fetchKOTs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/kots');
      if (res.success) {
        setKots(res.data);
      }
    } catch (err) {
      console.error('Failed to load KOT status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKOTs();
    joinRoom('waiter');

    if (socket) {
      socket.on('kot_updated', () => fetchKOTs());
      socket.on('order_ready', () => fetchKOTs());
      socket.on('new_kot', () => fetchKOTs());
    }

    return () => {
      leaveRoom('waiter');
      if (socket) {
        socket.off('kot_updated');
        socket.off('order_ready');
        socket.off('new_kot');
      }
    };
  }, [socket]);

  const handleMarkServed = async (kotId) => {
    try {
      await api.patch(`/kots/${kotId}/status`, { status: 'SERVED' });
      fetchKOTs();
    } catch (err) {
      alert(err.message || 'Failed to mark food served');
    }
  };

  const filteredKots = kots.filter(kot => {
    const isOnline = kot.order_type === 'ONLINE' || (!kot.table_number && !kot.room_number && (kot.online_customer_name || String(kot.order_number || '').includes('ORD')));
    if (channelFilter === 'OFFLINE' && isOnline) return false;
    if (channelFilter === 'ONLINE' && !isOnline) return false;
    if (selectedStatus !== 'ALL' && kot.status !== selectedStatus) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">🟡 Pending</span>;
      case 'ACCEPTED':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">🔵 Accepted</span>;
      case 'PREPARING':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#EAF4F7] text-[#3A7D7C] border border-[#3A7D7C]/30">🟢 Preparing</span>;
      case 'READY':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">✓ Ready</span>;
      case 'SERVED':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-[#64748B] border border-[#D7E5E8]">🍽️ Served</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-[#1F2937] border border-[#D7E5E8]">{status}</span>;
    }
  };

  return (
    <div className="bg-[#EAF4F7] -m-4 sm:-m-6 p-4 sm:p-6 min-h-[calc(100vh-4rem)] text-[#1F2937] rounded-xl space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#3A7D7C]" />
            <span>KOT Order Live Preparation Status</span>
          </h1>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Track kitchen progress from Pending → Preparing → Ready → Served</p>
        </div>
        <button
          onClick={fetchKOTs}
          className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#1F2937] text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto border border-[#D7E5E8]"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {['ALL', 'PENDING', 'PREPARING', 'READY', 'SERVED'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                selectedStatus === status
                  ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                  : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
              }`}
            >
              {status === 'ALL' ? 'All Statuses' : status}
            </button>
          ))}
        </div>

        {/* Channel Filters */}
        <div className="flex items-center bg-[#EAF4F7] p-1 rounded-xl border border-[#D7E5E8] text-xs">
          <button
            onClick={() => setChannelFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'ALL' ? 'bg-[#3A7D7C] text-white shadow-2xs' : 'text-[#1F2937] hover:text-[#3A7D7C]'
            }`}
          >
            All Channels
          </button>
          <button
            onClick={() => setChannelFilter('OFFLINE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'OFFLINE' ? 'bg-[#3A7D7C] text-white shadow-2xs' : 'text-[#1F2937] hover:text-[#3A7D7C]'
            }`}
          >
            🍽️ Table Dine-In
          </button>
          <button
            onClick={() => setChannelFilter('ONLINE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'ONLINE' ? 'bg-[#3A7D7C] text-white shadow-2xs' : 'text-[#1F2937] hover:text-[#3A7D7C]'
            }`}
          >
            🌐 Online Delivery
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-white border border-[#D7E5E8] animate-pulse shadow-xs"></div>
          ))}
        </div>
      ) : filteredKots.length === 0 ? (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-12 text-center text-[#64748B] shadow-xs">
          <Utensils className="w-12 h-12 text-[#64748B]/40 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-[#1F2937]">No KOT Tickets Found</h3>
          <p className="text-xs text-[#64748B] mt-1">No orders match the selected filter status.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKots.map((kot) => {
            const isOnline = kot.order_type === 'ONLINE' || (!kot.table_number && !kot.room_number && (kot.online_customer_name || String(kot.order_number || '').includes('ORD')));
            const rawOrderNum = String(kot.order_number || (kot.order_id ? `ORD-${kot.order_id}` : 'N/A'));
            const orderDigits = rawOrderNum.replace(/\D/g, '');
            const last5Digits = orderDigits.length >= 5 ? orderDigits.slice(-5) : rawOrderNum.slice(-5) || '-----';

            return (
              <div
                key={kot.id}
                className="bg-white border border-[#D7E5E8] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 kot-card-hover"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      {isOnline ? (
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-lg bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8] text-[10px] uppercase font-bold inline-flex items-center gap-1">
                            <Globe className="w-3 h-3 text-[#3A7D7C]" /> Online Order
                          </span>
                          <h3 className="text-lg font-bold text-[#1F2937] font-mono">#{last5Digits}</h3>
                          {kot.online_customer_name && (
                            <p className="text-xs text-[#1F2937] font-medium">👤 {kot.online_customer_name}</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <h3 className="text-xl font-bold text-[#1F2937]">Table {kot.table_number || 'Takeaway'}</h3>
                          <p className="text-xs text-[#64748B] font-medium">
                            KOT #{kot.kot_number} • Dept: {kot.kitchen_department_name || 'Kitchen'}
                          </p>
                        </div>
                      )}
                    </div>
                    {getStatusBadge(kot.status)}
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-white border border-[#D7E5E8] space-y-1.5 text-xs">
                    {kot.items && kot.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[#1F2937]">
                        <span className="font-semibold">{item.quantity}× {item.item_name}</span>
                        <span className="text-[10px] text-[#64748B] uppercase font-bold">{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {kot.status === 'READY' && (
                  <button
                    onClick={() => handleMarkServed(kot.id)}
                    className="w-full py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 uppercase tracking-wider"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Mark Served / Handed Over</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
