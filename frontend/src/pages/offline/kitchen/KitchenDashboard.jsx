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
    <div className="bg-[#EAF4F7] -m-4 sm:-m-6 p-4 sm:p-6 min-h-[calc(100vh-4rem)] text-[#1F2937] rounded-xl space-y-6">
      {/* Top Main Navigation Tabs */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-[#3A7D7C]" />
            <span>Kitchen Workstation</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Live KOT preparation timers, overdue alerts, and read-only raw ingredient availability</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveTab('QUEUE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              activeTab === 'QUEUE'
                ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>KOT Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('INGREDIENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              activeTab === 'INGREDIENTS'
                ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
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
          {/* Summary KPI Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs text-emerald-800 font-bold uppercase">🟢 On Time</span>
                <h3 className="text-3xl font-extrabold text-[#1F2937] mt-1">{summaryCounts.onTime}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs text-amber-800 font-bold uppercase">🟡 Getting Late</span>
                <h3 className="text-3xl font-extrabold text-[#1F2937] mt-1">{summaryCounts.gettingLate}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className={`bg-white border rounded-2xl p-4 flex items-center justify-between shadow-xs ${
              summaryCounts.late > 0 ? 'border-rose-300' : 'border-[#D7E5E8]'
            }`}>
              <div>
                <span className={`text-xs font-bold uppercase ${summaryCounts.late > 0 ? 'text-rose-800' : 'text-[#64748B]'}`}>
                  🔴 Late / Overdue
                </span>
                <h3 className={`text-3xl font-extrabold mt-1 ${summaryCounts.late > 0 ? 'text-rose-700' : 'text-[#1F2937]'}`}>
                  {summaryCounts.late}
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                summaryCounts.late > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-[#64748B]'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs text-[#3A7D7C] font-bold uppercase">✓ Ready for Pickup</span>
                <h3 className="text-3xl font-extrabold text-[#1F2937] mt-1">{summaryCounts.ready}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EAF4F7] border border-[#D7E5E8] flex items-center justify-center text-[#3A7D7C] font-bold">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
            {/* Department Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar">
              <button
                onClick={() => setSelectedDept('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${
                    selectedDept === d.id.toString()
                      ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                      : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
                  }`}
                >
                  {d.name} ({d.code})
                </button>
              ))}
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-2 shrink-0">
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
              </select>

              <button
                onClick={fetchKOTs}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors"
                title="Refresh KOTs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* KOT Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-56 rounded-2xl bg-white border border-[#D7E5E8] animate-pulse shadow-xs"></div>
              ))}
            </div>
          ) : sortedKots.length === 0 ? (
            <div className="bg-white border border-[#D7E5E8] rounded-2xl p-12 text-center text-[#64748B] shadow-xs">
              <ChefHat className="w-12 h-12 text-[#64748B]/40 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-[#1F2937]">No Active KOTs</h3>
              <p className="text-xs text-[#64748B] mt-1">Kitchen queue is clear or no KOTs match selected filters.</p>
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
