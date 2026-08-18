import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import { useAuth } from '../../../context/AuthContext';
import KOTCard from '../../../components/kds/KOTCard';
import KOTPrintModal from '../../../components/kds/KOTPrintModal';
import { ChefHat, RefreshCw, AlertTriangle, CheckCircle, Clock, Globe, Utensils, Columns, LayoutGrid, Sparkles, LogOut, Volume2 } from 'lucide-react';

export default function KitchenDisplayPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isStandalone = location.pathname === '/kitchen' || location.pathname === '/kds';

  const { joinRoom, leaveRoom, socket } = useSocket();

  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE'); // ACTIVE = PENDING + ACCEPTED + PREPARING
  const [channelFilter, setChannelFilter] = useState('ALL'); // 'ALL', 'SPLIT', 'OFFLINE', 'ONLINE'
  const [viewLayout, setViewLayout] = useState('SPLIT'); // 'SPLIT' or 'GRID'
  const [delayedOnly, setDelayedOnly] = useState(false);

  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPrintKOT, setSelectedPrintKOT] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [newOrderAlert, setNewOrderAlert] = useState(null);

  // Play Kitchen Bell Chime
  const playKitchenChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.0);
    } catch (e) {}
  };

  // 1-second live ticker to drive timers smoothly without server polling
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchKOTs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDept !== 'ALL') params.kitchen_department_id = selectedDept;
      if (selectedStatus) params.status = selectedStatus;
      if (delayedOnly) params.delayed_only = 'true';

      const res = await api.get('/kots', { params });
      if (res.success) {
        setKots(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch KOTs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadDepts() {
      const res = await api.get('/menu/departments');
      if (res.success) {
        setDepartments(res.data);
      }
    }
    loadDepts();
  }, []);

  useEffect(() => {
    fetchKOTs();

    joinRoom('kitchen');

    if (socket) {
      const handleNewKOT = (data) => {
        playKitchenChime();
        setNewOrderAlert({
          kot_number: data?.kot_number || 'New KOT',
          table_number: data?.table_number,
          order_number: data?.order_number,
          order_type: data?.order_type || 'TICKET',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        fetchKOTs();
        setTimeout(() => setNewOrderAlert(null), 8000);
      };

      socket.on('new_kot', handleNewKOT);
      socket.on('kot_updated', () => fetchKOTs());
      socket.on('kot_item_updated', () => fetchKOTs());
      socket.on('kot_delayed', () => fetchKOTs());

      return () => {
        leaveRoom('kitchen');
        socket.off('new_kot', handleNewKOT);
        socket.off('kot_updated');
        socket.off('kot_item_updated');
        socket.off('kot_delayed');
      };
    }
  }, [selectedDept, selectedStatus, delayedOnly, socket]);

  const handleStatusUpdate = async (kotId, newStatus) => {
    try {
      await api.patch(`/kots/${kotId}/status`, { status: newStatus });
      fetchKOTs();
    } catch (err) {
      alert(err.message || 'Failed to update KOT status');
    }
  };

  const handleItemStatusUpdate = async (itemId, newStatus) => {
    try {
      await api.patch(`/kots/items/${itemId}/status`, { status: newStatus });
      fetchKOTs();
    } catch (err) {
      alert(err.message || 'Failed to update item status');
    }
  };

  const handlePrintKOT = (kot) => {
    setSelectedPrintKOT(kot);
    setIsPrintModalOpen(true);
  };

  // Dashboard summary indicators calculation
  const summaryCounts = useMemo(() => {
    let onTime = 0;
    let gettingLate = 0;
    let late = 0;
    let ready = 0;
    let onlineCount = 0;
    let offlineCount = 0;

    kots.forEach(kot => {
      const isOnline = kot.order_type === 'ONLINE' || (!kot.table_number && !kot.room_number && (kot.online_customer_name || String(kot.order_number || '').includes('ORD')));
      if (isOnline) {
        onlineCount++;
      } else {
        offlineCount++;
      }

      if (kot.items && Array.isArray(kot.items)) {
        kot.items.forEach(item => {
          if (item.status === 'READY' || item.status === 'SERVED') {
            ready++;
          } else if (item.status === 'CANCELLED') {
            // ignore cancelled items
          } else if (!item.started_at) {
            // Not started yet
          } else {
            const expected = item.expected_finish_at
              ? new Date(item.expected_finish_at).getTime()
              : new Date(item.started_at).getTime() + (item.prep_time_minutes || 15) * 60000;
            const remainingSecs = Math.floor((expected - currentTime) / 1000);

            if (remainingSecs <= 0) {
              late++;
            } else if (remainingSecs <= 300) {
              gettingLate++;
            } else {
              onTime++;
            }
          }
        });
      }
    });

    return { onTime, gettingLate, late, ready, onlineCount, offlineCount };
  }, [kots, currentTime]);

  // Priority sorting: 1. Late -> 2. Getting Late -> 3. On Time -> 4. Ready
  const sortedKots = useMemo(() => {
    const getUrgencyRank = (kot) => {
      if (kot.status === 'READY' || kot.status === 'SERVED') return 4;
      if (!kot.items || kot.items.length === 0) return 3.5;

      let minRank = 3.5;
      kot.items.forEach(item => {
        if (item.status === 'READY' || item.status === 'SERVED' || item.status === 'CANCELLED') return;
        if (!item.started_at) {
          if (minRank > 3.5) minRank = 3.5;
          return;
        }

        const expected = item.expected_finish_at
          ? new Date(item.expected_finish_at).getTime()
          : new Date(item.started_at).getTime() + (item.prep_time_minutes || 15) * 60000;
        const remainingSecs = Math.floor((expected - currentTime) / 1000);

        if (remainingSecs <= 0) {
          minRank = Math.min(minRank, 1); // 🔴 Late
        } else if (remainingSecs <= 300) {
          minRank = Math.min(minRank, 2); // 🟡 Getting Late
        } else {
          minRank = Math.min(minRank, 3); // 🟢 On Time
        }
      });

      return minRank;
    };

    return [...kots].sort((a, b) => {
      const rankA = getUrgencyRank(a);
      const rankB = getUrgencyRank(b);

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [kots, currentTime]);

  // Split into Offline and Online order streams
  const offlineKots = useMemo(() => {
    return sortedKots.filter(k => !(k.order_type === 'ONLINE' || (!k.table_number && !k.room_number && (k.online_customer_name || String(k.order_number || '').includes('ORD')))));
  }, [sortedKots]);

  const onlineKots = useMemo(() => {
    return sortedKots.filter(k => (k.order_type === 'ONLINE' || (!k.table_number && !k.room_number && (k.online_customer_name || String(k.order_number || '').includes('ORD')))));
  }, [sortedKots]);

  const activeCount = kots.filter(k => ['PENDING', 'ACCEPTED', 'PREPARING'].includes(k.status)).length;

  const content = (
    <div className="space-y-4 w-full">
      {/* Live New Ticket Alert Banner */}
      {newOrderAlert && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/25 via-amber-500/20 to-orange-500/25 border-2 border-orange-500 shadow-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-slate-950 flex items-center justify-center font-black animate-bounce shadow-md">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-500 text-slate-950">
                  New Incoming Ticket
                </span>
                <span className="text-xs text-slate-400 font-mono">{newOrderAlert.time}</span>
              </div>
              <p className="text-sm font-bold text-white mt-0.5">
                {newOrderAlert.table_number ? `🍽️ Table ${newOrderAlert.table_number} ` : `🌐 Online Order #${newOrderAlert.order_number || ''} `}
                <span className="text-orange-400 font-extrabold">({newOrderAlert.kot_number})</span> sent to kitchen!
              </p>
            </div>
          </div>
          <button
            onClick={() => setNewOrderAlert(null)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* COMPACT KDS TOOLBAR HEADER */}
      <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                Kitchen Display System (KDS)
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Live Kitchen Stream</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5 hidden sm:block">
              Real-time multi-channel tickets: <strong>🍽️ Offline Table Orders</strong> & <strong>🌐 Online Delivery Orders</strong>
            </p>
          </div>
        </div>

        {/* Compact Summary Counters Bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-300">
            🍽️ Offline: <span className="font-extrabold">{summaryCounts.offlineCount}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300">
            🌐 Online: <span className="font-extrabold">{summaryCounts.onlineCount}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
            🟢 On Time: <span className="text-emerald-300 font-extrabold">{summaryCounts.onTime}</span>
          </div>

          <div className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${
            summaryCounts.late > 0
              ? 'bg-rose-500/20 border-rose-500/60 text-rose-400 animate-pulse font-bold'
              : 'bg-slate-950/80 border-slate-800 text-slate-400'
          }`}>
            🔴 Late: <span className={summaryCounts.late > 0 ? 'text-rose-300 font-extrabold' : 'text-slate-300'}>{summaryCounts.late}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs font-semibold text-sky-400">
            ✓ Ready: <span className="text-sky-300 font-extrabold">{summaryCounts.ready}</span>
          </div>

          <button
            onClick={fetchKOTs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors ml-1"
            title="Refresh KOTs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isStandalone && (
            <button
              onClick={() => {
                logout();
                navigate('/admin/login');
              }}
              className="p-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors ml-1 flex items-center gap-1.5"
              title="Logout from Kitchen Station"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Station</span>
            </button>
          )}
        </div>
      </div>

      {/* COMPACT FILTER BAR WITH DUAL-COLUMN TOGGLE */}
      <div className="glass-panel bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Department & Channel Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar">
          {/* Channel Filters */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 mr-2">
            <button
              onClick={() => { setViewLayout('SPLIT'); setChannelFilter('ALL'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'SPLIT'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split Columns</span>
            </button>

            <button
              onClick={() => { setViewLayout('GRID'); setChannelFilter('OFFLINE'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'GRID' && channelFilter === 'OFFLINE'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Offline ({summaryCounts.offlineCount})</span>
            </button>

            <button
              onClick={() => { setViewLayout('GRID'); setChannelFilter('ONLINE'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'GRID' && channelFilter === 'ONLINE'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Online ({summaryCounts.onlineCount})</span>
            </button>

            <button
              onClick={() => { setViewLayout('GRID'); setChannelFilter('ALL'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'GRID' && channelFilter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All Grid</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block"></div>

          {/* Department Filter */}
          <button
            onClick={() => setSelectedDept('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              selectedDept === 'ALL'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            All Kitchens
          </button>
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDept(d.id.toString())}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedDept === d.id.toString()
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {d.name} ({d.code})
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={() => setDelayedOnly(!delayedOnly)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-colors ${
              delayedOnly
                ? 'bg-rose-500 text-white border-rose-400 shadow'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Delayed Only</span>
          </button>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="ACTIVE">ACTIVE KOTS</option>
            <option value="PENDING">PENDING</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="PREPARING">PREPARING</option>
            <option value="READY">READY</option>
            <option value="SERVED">SERVED</option>
          </select>
        </div>
      </div>

      {/* KITCHEN TICKETS CONTAINER */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-56 rounded-xl bg-slate-900/50 border border-slate-800 animate-pulse"></div>
          ))}
        </div>
      ) : sortedKots.length === 0 ? (
        <div className="glass-panel bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400 my-4">
          <ChefHat className="w-12 h-12 text-slate-700 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-slate-300">No Kitchen Orders Pending</h3>
          <p className="text-xs text-slate-500 mt-1">All kitchen tickets are processed or no orders match selected filters.</p>
        </div>
      ) : viewLayout === 'SPLIT' ? (
        /* DUAL COLUMN SPLIT VIEW (Offline Left, Online Right) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          
          {/* COLUMN 1: OFFLINE DINE-IN / TABLE ORDERS */}
          <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-amber-500/20 shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Utensils className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Offline Dine-In & Room Service
                  </h3>
                  <p className="text-[11px] text-slate-400">Table seating & offline POS tickets</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30">
                {offlineKots.length} Tickets
              </span>
            </div>

            {offlineKots.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No active offline table orders.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {offlineKots.map((kot) => (
                  <KOTCard
                    key={kot.id}
                    kot={kot}
                    onStatusUpdate={handleStatusUpdate}
                    onItemStatusUpdate={handleItemStatusUpdate}
                    onPrintKOT={handlePrintKOT}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            )}
          </div>

          {/* COLUMN 2: ONLINE DELIVERY ORDERS */}
          <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-cyan-500/20 shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  <Globe className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Online Website & Delivery Orders
                  </h3>
                  <p className="text-[11px] text-slate-400">Orders placed by online customers & riders</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-black border border-cyan-500/30">
                {onlineKots.length} Tickets
              </span>
            </div>

            {onlineKots.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No active online delivery orders.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {onlineKots.map((kot) => (
                  <KOTCard
                    key={kot.id}
                    kot={kot}
                    onStatusUpdate={handleStatusUpdate}
                    onItemStatusUpdate={handleItemStatusUpdate}
                    onPrintKOT={handlePrintKOT}
                    currentTime={currentTime}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* SINGLE UNIFIED GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
          {(channelFilter === 'OFFLINE' ? offlineKots : channelFilter === 'ONLINE' ? onlineKots : sortedKots).map((kot) => (
            <KOTCard
              key={kot.id}
              kot={kot}
              onStatusUpdate={handleStatusUpdate}
              onItemStatusUpdate={handleItemStatusUpdate}
              onPrintKOT={handlePrintKOT}
              currentTime={currentTime}
            />
          ))}
        </div>
      )}

      {/* KOT Print Modal */}
      <KOTPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        kot={selectedPrintKOT}
      />
    </div>
  );

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 antialiased">
        {content}
      </div>
    );
  }

  return content;
}
