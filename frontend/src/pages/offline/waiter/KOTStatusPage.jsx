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
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 PENDING</span>;
      case 'ACCEPTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">🔵 ACCEPTED</span>;
      case 'PREPARING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 PREPARING</span>;
      case 'READY':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md animate-pulse">✓ READY TO SERVE</span>;
      case 'SERVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-400">🍽️ SERVED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-400" />
            KOT / Order Live Preparation Status
          </h1>
          <p className="text-slate-400 text-sm">Track kitchen progress from Pending → Preparing → Ready → Served</p>
        </div>
        <button
          onClick={fetchKOTs}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto border border-slate-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {['ALL', 'PENDING', 'PREPARING', 'READY', 'SERVED'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedStatus === status
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {status === 'ALL' ? 'All Statuses' : status}
            </button>
          ))}
        </div>

        {/* Channel Filters */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setChannelFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Channels
          </button>
          <button
            onClick={() => setChannelFilter('OFFLINE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'OFFLINE' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            🍽️ Table Dine-In
          </button>
          <button
            onClick={() => setChannelFilter('ONLINE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'ONLINE' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
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
            <div key={i} className="h-48 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse"></div>
          ))}
        </div>
      ) : filteredKots.length === 0 ? (
        <div className="glass-panel bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Utensils className="w-12 h-12 text-slate-700 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-slate-300">No KOT Tickets Found</h3>
          <p className="text-xs text-slate-500 mt-1">No orders match the selected filter status.</p>
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
                className={`glass-panel bg-slate-900/80 border rounded-2xl p-5 flex flex-col justify-between space-y-4 ${
                  kot.status === 'READY'
                    ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : isOnline
                    ? 'border-cyan-500/30'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      {isOnline ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] uppercase font-black inline-flex items-center gap-1">
                            <Globe className="w-3 h-3" /> ONLINE ORDER
                          </span>
                          <h3 className="text-lg font-black text-amber-400 font-mono">#{last5Digits}</h3>
                          {kot.online_customer_name && (
                            <p className="text-xs text-white font-bold">👤 {kot.online_customer_name}</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <h3 className="text-xl font-black text-white">Table {kot.table_number || 'Takeaway'}</h3>
                          <p className="text-xs text-slate-400 font-medium">
                            KOT #{kot.kot_number} • Dept: {kot.kitchen_department_name}
                          </p>
                        </div>
                      )}
                    </div>
                    {getStatusBadge(kot.status)}
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                    {kot.items && kot.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-slate-200">
                        <span className="font-bold">{item.quantity}× {item.item_name}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {kot.status === 'READY' && (
                  <button
                    onClick={() => handleMarkServed(kot.id)}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>MARK SERVED / HANDED OVER</span>
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
