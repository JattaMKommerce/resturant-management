import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import { useAuth } from '../../../context/AuthContext';
import { playServiceChime } from '../../../utils/audio';
import KOTCard from '../../../components/kds/KOTCard';
import KOTPrintModal from '../../../components/kds/KOTPrintModal';
import { ChefHat, RefreshCw, AlertTriangle, CheckCircle, Clock, Globe, Utensils, Columns, LayoutGrid, LogOut, Volume2 } from 'lucide-react';

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

    const tenantId = user?.restaurant_id || 1;
    const tenantRoom = `restaurant_${tenantId}_kitchen`;

    joinRoom('kitchen');
    joinRoom(tenantRoom);

    if (socket) {
      const handleNewKOT = (data) => {
        fetchKOTs();
        const isOnline = data?.order_type === 'ONLINE' || data?.is_online === true || data?.channel === 'ONLINE';
        if (isOnline) {
          playServiceChime('kitchen_online_order');
        } else {
          playServiceChime('kitchen_offline_order');
        }
      };

      const handleRefresh = () => fetchKOTs();

      socket.on('new_kot', handleNewKOT);
      socket.on('new_order', handleNewKOT);
      socket.on('kot_updated', handleRefresh);
      socket.on('order_updated', handleRefresh);
      socket.on('kot_item_updated', handleRefresh);
      socket.on('kot_delayed', handleRefresh);

      return () => {
        leaveRoom('kitchen');
        leaveRoom(tenantRoom);
        socket.off('new_kot', handleNewKOT);
        socket.off('new_order', handleNewKOT);
        socket.off('kot_updated', handleRefresh);
        socket.off('order_updated', handleRefresh);
        socket.off('kot_item_updated', handleRefresh);
        socket.off('kot_delayed', handleRefresh);
      };
    } else {
      return () => {
        leaveRoom('kitchen');
        leaveRoom(tenantRoom);
      };
    }
  }, [selectedDept, selectedStatus, delayedOnly, socket, user]);

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

  const content = (
    <div className="space-y-4 w-full">
      {/* 1. CLEAN WHITE HEADER */}
      <header className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#EAF4F7] border border-[#D7E5E8] flex items-center justify-center text-[#3A7D7C] shrink-0">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-[#1F2937] tracking-tight">
                Kitchen KOT Display (KDS)
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Live Active</span>
              </span>
            </div>
            <p className="text-[#64748B] text-xs mt-0.5 hidden sm:block">
              Hotel & Restaurant Kitchen Display • Unified Multi-Channel Management
            </p>
          </div>
        </div>

        {/* Live Metrics Summary Bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-white border border-[#D7E5E8] text-xs font-semibold text-[#1F2937]">
            🍽️ Tables: <span className="font-bold text-[#3A7D7C]">{summaryCounts.offlineCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white border border-[#D7E5E8] text-xs font-semibold text-[#1F2937]">
            🌐 Online: <span className="font-bold text-[#3A7D7C]">{summaryCounts.onlineCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
            🟢 On Time: <span>{summaryCounts.onTime}</span>
          </div>

          <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${
            summaryCounts.late > 0
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-white border-[#D7E5E8] text-[#64748B]'
          }`}>
            🔴 Late: <span>{summaryCounts.late}</span>
          </div>

          <div className="flex items-center gap-1 bg-[#EAF4F7] p-1 rounded-xl border border-[#D7E5E8] ml-1">
            <button
              onClick={() => playServiceChime('kitchen_offline_order')}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[11px] font-bold text-[#1F2937] transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
              title="Test Offline Table KOT Sound (Double Bell Ding-Ding)"
            >
              <span>🍽️</span>
              <span className="hidden sm:inline">Offline Bell</span>
            </button>
            <button
              onClick={() => playServiceChime('kitchen_online_order')}
              className="px-2.5 py-1.5 rounded-lg bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
              title="Test Online Delivery KOT Sound (Melodic Alert)"
            >
              <span>🌐</span>
              <span className="hidden sm:inline">Online Alert</span>
            </button>
          </div>

          <button
            onClick={fetchKOTs}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors ml-1"
            title="Refresh Kitchen Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isStandalone && (
            <button
              onClick={() => {
                logout();
                navigate('/admin/login');
              }}
              className="p-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#D7E5E8] text-[#1F2937] text-xs font-semibold transition-colors ml-1 flex items-center gap-1.5"
              title="Logout from Kitchen Station"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. NAVIGATION & STATUS FILTER BAR */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Layout Mode & Channel Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar">
          <div className="flex items-center bg-[#EAF4F7] p-1 rounded-xl border border-[#D7E5E8] mr-2">
            <button
              onClick={() => { setViewLayout('SPLIT'); setChannelFilter('ALL'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'SPLIT'
                  ? 'bg-[#3A7D7C] text-white shadow-2xs'
                  : 'text-[#1F2937] hover:text-[#3A7D7C]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split Channels</span>
            </button>

            <button
              onClick={() => { setViewLayout('GRID'); setChannelFilter('OFFLINE'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'GRID' && channelFilter === 'OFFLINE'
                  ? 'bg-[#3A7D7C] text-white shadow-2xs'
                  : 'text-[#1F2937] hover:text-[#3A7D7C]'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Offline ({summaryCounts.offlineCount})</span>
            </button>

            <button
              onClick={() => { setViewLayout('GRID'); setChannelFilter('ONLINE'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'GRID' && channelFilter === 'ONLINE'
                  ? 'bg-[#3A7D7C] text-white shadow-2xs'
                  : 'text-[#1F2937] hover:text-[#3A7D7C]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Online ({summaryCounts.onlineCount})</span>
            </button>

            <button
              onClick={() => { setViewLayout('GRID'); setChannelFilter('ALL'); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'GRID' && channelFilter === 'ALL'
                  ? 'bg-[#3A7D7C] text-white shadow-2xs'
                  : 'text-[#1F2937] hover:text-[#3A7D7C]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All Grid</span>
            </button>
          </div>

          <div className="h-4 w-px bg-[#D7E5E8] mx-1 hidden sm:block"></div>

          {/* Department Navigation Tabs */}
          <button
            onClick={() => setSelectedDept('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
              selectedDept === 'ALL'
                ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
            }`}
          >
            All Kitchens
          </button>
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDept(d.id.toString())}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                selectedDept === d.id.toString()
                  ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                  : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        {/* Status Filter Controls */}
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={() => setDelayedOnly(!delayedOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
              delayedOnly
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Delayed Only</span>
          </button>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-[#D7E5E8] text-[#1F2937] text-xs font-bold focus:outline-none focus:border-[#3A7D7C]"
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

      {/* 3. KITCHEN TICKETS CONTAINER */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-white border border-[#D7E5E8] animate-pulse shadow-xs"></div>
          ))}
        </div>
      ) : sortedKots.length === 0 ? (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-12 text-center text-[#64748B] my-4 shadow-xs">
          <ChefHat className="w-12 h-12 text-[#64748B]/40 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-[#1F2937]">No Kitchen Orders Pending</h3>
          <p className="text-xs text-[#64748B] mt-1">All kitchen tickets are processed or no orders match selected filters.</p>
        </div>
      ) : viewLayout === 'SPLIT' ? (
        /* DUAL COLUMN SPLIT VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          
          {/* COLUMN 1: OFFLINE DINE-IN / TABLE ORDERS */}
          <div className="space-y-3.5 bg-white/60 p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#D7E5E8]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]">
                  <Utensils className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#1F2937]">
                    Offline Dine-In & Room Service
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Restaurant tables & room folios</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EAF4F7] text-[#3A7D7C] text-xs font-bold border border-[#D7E5E8]">
                {offlineKots.length} Tickets
              </span>
            </div>

            {offlineKots.length === 0 ? (
              <div className="py-12 text-center text-[#64748B] text-xs bg-white border border-dashed border-[#D7E5E8] rounded-xl">
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
          <div className="space-y-3.5 bg-white/60 p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#D7E5E8]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]">
                  <Globe className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#1F2937]">
                    Online Storefront & Delivery
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Customer web store orders</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EAF4F7] text-[#3A7D7C] text-xs font-bold border border-[#D7E5E8]">
                {onlineKots.length} Tickets
              </span>
            </div>

            {onlineKots.length === 0 ? (
              <div className="py-12 text-center text-[#64748B] text-xs bg-white border border-dashed border-[#D7E5E8] rounded-xl">
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

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] p-3 sm:p-6 antialiased font-sans">
      {content}
    </div>
  );
}
