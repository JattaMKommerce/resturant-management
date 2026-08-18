import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import KOTCard from '../../../components/kds/KOTCard';
import KOTPrintModal from '../../../components/kds/KOTPrintModal';
import KitchenInventoryView from './KitchenInventoryView';
import { ChefHat, RefreshCw, AlertTriangle, CheckCircle, Clock, Boxes, Utensils } from 'lucide-react';

export default function KitchenDashboard() {
  const { joinRoom, leaveRoom, socket } = useSocket();

  const [activeTab, setActiveTab] = useState('QUEUE'); // 'QUEUE' or 'INGREDIENTS'
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE');
  const [delayedOnly, setDelayedOnly] = useState(false);

  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPrintKOT, setSelectedPrintKOT] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

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
      console.error('Failed to fetch kitchen dashboard KOTs:', err);
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
    if (activeTab === 'QUEUE') {
      fetchKOTs();
    }

    joinRoom('kitchen');

    if (socket) {
      socket.on('new_kot', () => fetchKOTs());
      socket.on('kot_updated', () => fetchKOTs());
      socket.on('kot_delayed', () => fetchKOTs());
    }

    return () => {
      leaveRoom('kitchen');
      if (socket) {
        socket.off('new_kot');
        socket.off('kot_updated');
        socket.off('kot_delayed');
      }
    };
  }, [selectedDept, selectedStatus, delayedOnly, activeTab, socket]);

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

    kots.forEach(kot => {
      if (kot.items && Array.isArray(kot.items)) {
        kot.items.forEach(item => {
          if (item.status === 'READY' || item.status === 'SERVED') {
            ready++;
          } else if (item.status === 'CANCELLED') {
            // ignore cancelled
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

    return { onTime, gettingLate, late, ready };
  }, [kots, currentTime]);

  // Priority sorting: 1. Late (most overdue first) -> 2. Getting Late -> 3. On Time -> 4. Ready
  const sortedKots = useMemo(() => {
    const getUrgencyValue = (kot) => {
      if (kot.status === 'READY' || kot.status === 'SERVED') return 999999999;
      if (!kot.items || kot.items.length === 0) return 5000000;

      let minSeconds = 5000000;
      kot.items.forEach(item => {
        if (item.status === 'READY' || item.status === 'SERVED' || item.status === 'CANCELLED') return;
        if (!item.started_at) return;

        const expected = item.expected_finish_at
          ? new Date(item.expected_finish_at).getTime()
          : new Date(item.started_at).getTime() + (item.prep_time_minutes || 15) * 60000;
        const remainingSecs = Math.floor((expected - currentTime) / 1000);
        if (remainingSecs < minSeconds) {
          minSeconds = remainingSecs;
        }
      });

      return minSeconds;
    };

    return [...kots].sort((a, b) => {
      const valA = getUrgencyValue(a);
      const valB = getUrgencyValue(b);
      return valA - valB;
    });
  }, [kots, currentTime]);

  return (
    <div className="space-y-6">
      {/* Top Main Navigation Tabs (KOT Queue vs Read-Only Ingredients) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-amber-500" />
            <span>GRAND PALACE HMS — Kitchen Workstation</span>
          </h2>
          <p className="text-slate-400 text-sm">Live KOT preparation timers, overdue alerts, and read-only raw ingredient availability</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('QUEUE')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeTab === 'QUEUE'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>KOT Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('INGREDIENTS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeTab === 'INGREDIENTS'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Ingredient Availability</span>
          </button>
        </div>
      </div>

      {activeTab === 'INGREDIENTS' ? (
        <KitchenInventoryView />
      ) : (
        <>
          {/* Summary KPI Indicators (On Time, Getting Late, Late, Ready) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-400 font-bold uppercase">🟢 ON TIME</span>
                <h3 className="text-3xl font-black text-white mt-1">{summaryCounts.onTime}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="glass-panel bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-400 font-bold uppercase">🟡 GETTING LATE</span>
                <h3 className="text-3xl font-black text-white mt-1">{summaryCounts.gettingLate}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className={`glass-panel border rounded-2xl p-4 flex items-center justify-between ${
              summaryCounts.late > 0 ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-500/10 animate-pulse' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div>
                <span className={`text-xs font-bold uppercase ${summaryCounts.late > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  🔴 LATE / OVERDUE
                </span>
                <h3 className={`text-3xl font-black mt-1 ${summaryCounts.late > 0 ? 'text-rose-300' : 'text-white'}`}>
                  {summaryCounts.late}
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                summaryCounts.late > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className="glass-panel bg-sky-950/20 border border-sky-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-sky-400 font-bold uppercase">✓ READY FOR PICKUP</span>
                <h3 className="text-3xl font-black text-white mt-1">{summaryCounts.ready}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 font-bold">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="glass-panel bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Department Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar">
              <button
                onClick={() => setSelectedDept('ALL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedDept === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Kitchens
              </button>
              {departments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDept(d.id.toString())}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedDept === d.id.toString()
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {d.name} ({d.code})
                </button>
              ))}
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setDelayedOnly(!delayedOnly)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                  delayedOnly
                    ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Delayed Only</span>
              </button>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-500"
              >
                <option value="ACTIVE">ACTIVE KOTS</option>
                <option value="PENDING">PENDING</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="PREPARING">PREPARING</option>
                <option value="READY">READY</option>
              </select>

              <button
                onClick={fetchKOTs}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Refresh KOTs"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* KOT Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-56 rounded-xl bg-slate-900/50 border border-slate-800 animate-pulse"></div>
              ))}
            </div>
          ) : sortedKots.length === 0 ? (
            <div className="glass-panel bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
              <ChefHat className="w-12 h-12 text-slate-700 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-slate-300">No Active KOTs</h3>
              <p className="text-xs text-slate-500 mt-1">Kitchen queue is clear or no KOTs match selected filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
              {sortedKots.map((kot) => (
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
        </>
      )}
    </div>
  );
}
