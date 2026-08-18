import React, { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import WaiterLayout from '../../../components/WaiterLayout';
import { 
  ConciergeBell, 
  CheckCheck, 
  RefreshCw, 
  Utensils, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Grid2X2, 
  ShoppingBag,
  Bell,
  AlertCircle,
  Sparkles,
  Users,
  ChevronRight,
  Flame,
  Volume2,
  X
} from 'lucide-react';

export default function WaiterDashboard() {
  const { joinRoom, leaveRoom, socket } = useSocket();

  const [tables, setTables] = useState([]);
  const [readyKOTs, setReadyKOTs] = useState([]);
  const [allKOTs, setAllKOTs] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live Alerts State
  const [liveAlert, setLiveAlert] = useState(null); // { type: 'READY' | 'NEW_ORDER', title, message, kotId, tableNumber, time }
  const [selectedTable, setSelectedTable] = useState(null);
  const [servingLoading, setServingLoading] = useState(null);

  // Play Synthesized Chime using Web Audio API
  const playChimeSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // Play a pleasant double-chime (Ding-Dong)
      const now = ctx.currentTime;

      // Note 1 (Ding - E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Note 2 (Dong - G5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.25);
      gain2.gain.setValueAtTime(0.35, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  };

  const fetchServiceData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [tableRes, readyKotRes, allKotRes, orderRes] = await Promise.all([
        api.get('/tables'),
        api.get('/kots?status=READY'),
        api.get('/kots'),
        api.get('/orders')
      ]);

      if (tableRes.success) setTables(tableRes.data || []);
      if (readyKotRes.success) setReadyKOTs(readyKotRes.data || []);
      if (allKotRes.success) setAllKOTs(allKotRes.data || []);
      if (orderRes.success) setActiveOrders(orderRes.data || []);
    } catch (err) {
      console.error('Failed to load waiter dashboard:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceData();
    joinRoom('waiter');

    if (socket) {
      // 1. Food Ready Alert Listener
      const handleOrderReady = (data) => {
        playChimeSound();
        setLiveAlert({
          type: 'READY',
          title: `🔔 Food Ready for Serving!`,
          tableNumber: data.table_number || 'Takeaway',
          kotNumber: data.kot_number,
          kotId: data.kot_id,
          dept: data.kitchen_department_name,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        fetchServiceData(false);
      };

      // 2. New Customer Order Listener
      const handleNewOrder = (data) => {
        playChimeSound();
        setLiveAlert({
          type: 'NEW_ORDER',
          title: `🛎️ New Customer Order Placed!`,
          tableNumber: data.table_number || 'Dine-In',
          orderNumber: data.order_number,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        fetchServiceData(false);
      };

      // 3. Customer Calling Waiter Listener
      const handleCallWaiter = (data) => {
        playChimeSound();
        setLiveAlert({
          type: 'CALL_WAITER',
          title: `🚨 Table ${data.table_number || ''} is Calling Waiter!`,
          tableNumber: data.table_number || 'Dine-In',
          floor: data.floor || 'Main Hall',
          message: data.message || 'Customer requested assistance at table',
          time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        fetchServiceData(false);
      };

      socket.on('order_ready', handleOrderReady);
      socket.on('new_order', handleNewOrder);
      socket.on('call_waiter', handleCallWaiter);
      socket.on('kot_updated', () => fetchServiceData(false));
      socket.on('table_status_changed', () => fetchServiceData(false));

      return () => {
        leaveRoom('waiter');
        socket.off('order_ready', handleOrderReady);
        socket.off('new_order', handleNewOrder);
        socket.off('call_waiter', handleCallWaiter);
        socket.off('kot_updated');
        socket.off('table_status_changed');
      };
    }
  }, [socket]);

  const handleMarkServed = async (kotId) => {
    try {
      setServingLoading(kotId);
      await api.patch(`/kots/${kotId}/status`, { status: 'SERVED' });
      if (liveAlert && liveAlert.kotId === kotId) {
        setLiveAlert(null);
      }
      fetchServiceData(false);
    } catch (err) {
      alert(err.message || 'Failed to mark food served');
    } finally {
      setServingLoading(null);
    }
  };

  const handleRequestBill = async (tableId) => {
    try {
      await api.patch(`/tables/${tableId}/status`, { status: 'BILL_REQUESTED' });
      fetchServiceData(false);
    } catch (err) {
      alert(err.message || 'Failed to request bill');
    }
  };

  // Table summary counts
  const availableTablesCount = tables.filter(t => t.status === 'AVAILABLE').length;
  const occupiedTablesCount = tables.filter(t => ['OCCUPIED', 'ORDERING'].includes(t.status)).length;
  const billRequestedCount = tables.filter(t => t.status === 'BILL_REQUESTED').length;

  return (
    <WaiterLayout readyCount={readyKOTs.length}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        
        {/* Real-time Alert Notification Banner */}
        {liveAlert && (
          <div className={`p-5 rounded-2xl border-2 shadow-2xl backdrop-blur-md animate-in slide-in-from-top duration-300 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            liveAlert.type === 'CALL_WAITER'
              ? 'bg-gradient-to-r from-rose-500/25 via-red-500/20 to-rose-500/25 border-rose-500 shadow-rose-950/50'
              : 'bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-amber-500/60'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black animate-bounce shadow-lg ${
                liveAlert.type === 'CALL_WAITER'
                  ? 'bg-rose-500 text-white shadow-rose-500/40'
                  : 'bg-amber-500 text-slate-950 shadow-amber-500/30'
              }`}>
                <ConciergeBell className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-md ${
                    liveAlert.type === 'CALL_WAITER'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-amber-500 text-slate-950'
                  }`}>
                    {liveAlert.type === 'CALL_WAITER' ? '🚨 Customer Calling Service' : 'Live Dispatch'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{liveAlert.time}</span>
                </div>
                <h3 className="text-lg font-black text-white mt-0.5">{liveAlert.title}</h3>
                <p className="text-xs text-slate-300 font-medium">
                  {liveAlert.type === 'READY' ? (
                    <>Table <strong className="text-amber-400 font-bold">{liveAlert.tableNumber}</strong> • KOT #{liveAlert.kotNumber} ({liveAlert.dept || 'Kitchen'}) is hot and ready for delivery!</>
                  ) : liveAlert.type === 'CALL_WAITER' ? (
                    <><strong className="text-rose-300 font-bold">Table {liveAlert.tableNumber}</strong> ({liveAlert.floor}) is calling for assistance: <em>"{liveAlert.message}"</em></>
                  ) : (
                    <>Table <strong className="text-sky-400 font-bold">{liveAlert.tableNumber}</strong> has sent a new order ticket.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end md:self-auto">
              {liveAlert.type === 'READY' && liveAlert.kotId && (
                <button
                  onClick={() => handleMarkServed(liveAlert.kotId)}
                  disabled={servingLoading === liveAlert.kotId}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Served to Table</span>
                </button>
              )}
              {liveAlert.type === 'CALL_WAITER' && (
                <button
                  onClick={() => setLiveAlert(null)}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-xl text-xs transition-all shadow-lg shadow-rose-500/30 flex items-center gap-1.5"
                >
                  <ConciergeBell className="w-4 h-4" />
                  <span>Acknowledge / Attending</span>
                </button>
              )}
              <button
                onClick={() => setLiveAlert(null)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Header & Quick Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Ready for Pickup</p>
              <h3 className="text-2xl font-black text-amber-400 mt-1">{readyKOTs.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ConciergeBell className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Occupied Tables</p>
              <h3 className="text-2xl font-black text-sky-400 mt-1">{occupiedTablesCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Available Tables</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{availableTablesCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Grid2X2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Bill Requests</p>
              <h3 className="text-2xl font-black text-violet-400 mt-1">{billRequestedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Section 1: Hot & Ready Food Station (Pick up immediately) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
              <span>Hot & Ready Food Station ({readyKOTs.length})</span>
            </h3>
            <button
              onClick={() => fetchServiceData(true)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {readyKOTs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <CheckCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-xs font-bold text-slate-300">All prepared food has been served to tables!</p>
              <p className="text-[11px] text-slate-500">New ready food notifications from the kitchen will chime and appear here automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyKOTs.map((kot) => (
                <div 
                  key={kot.id}
                  className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-amber-500/40 shadow-xl space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500 text-slate-950">
                        {kot.kitchen_department_name || 'Kitchen'}
                      </span>
                      <h4 className="text-lg font-black text-white mt-1.5 flex items-center gap-1.5">
                        Table {kot.table_number || 'Dine-In'}
                      </h4>
                      <p className="text-[11px] text-slate-400">KOT #{kot.kot_number}</p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Ready Now
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                    {kot.items && kot.items.length > 0 ? (
                      kot.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-slate-200">
                          <span className="font-medium truncate max-w-[180px]">{item.item_name}</span>
                          <span className="font-bold font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                            x{item.quantity}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">Item details on kitchen pass</span>
                    )}
                  </div>

                  {/* Serve Button */}
                  <button
                    onClick={() => handleMarkServed(kot.id)}
                    disabled={servingLoading === kot.id}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {servingLoading === kot.id ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Deliver & Mark Served</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Restaurant Tables Overview */}
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Grid2X2 className="w-4 h-4 text-sky-400" />
            <span>Floor Dining Tables Status</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {tables.map((table) => {
              const isOccupied = ['OCCUPIED', 'ORDERING'].includes(table.status);
              const isBillReq = table.status === 'BILL_REQUESTED';
              const isAvailable = table.status === 'AVAILABLE';

              return (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 relative overflow-hidden ${
                    isBillReq
                      ? 'bg-violet-950/30 border-violet-500/50 hover:border-violet-400 shadow-lg shadow-violet-950/40'
                      : isOccupied
                      ? 'bg-slate-900 border-sky-500/40 hover:border-sky-400 shadow-lg'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-white">{table.table_number}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      isBillReq ? 'bg-violet-400 animate-pulse' : isOccupied ? 'bg-sky-400' : 'bg-emerald-400'
                    }`}></span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-200 truncate">{table.table_name || `Table ${table.table_number}`}</p>
                    <p className="text-[10px] text-slate-500">{table.floor || 'Main Hall'} • {table.capacity || 4} seats</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-bold">
                    <span className={isBillReq ? 'text-violet-300' : isOccupied ? 'text-sky-300' : 'text-emerald-400'}>
                      {isBillReq ? 'BILL REQUESTED' : isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
                    </span>
                    {isOccupied && !isBillReq && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestBill(table.id);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[9px] transition-colors"
                        title="Request Table Bill"
                      >
                        Request Bill
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Table Drawer */}
        {selectedTable && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black text-white">Table #{selectedTable.table_number}</h3>
                  <p className="text-xs text-slate-400">{selectedTable.table_name} • {selectedTable.floor}</p>
                </div>
                <button
                  onClick={() => setSelectedTable(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Current Status:</span>
                  <span className="font-bold text-amber-400">{selectedTable.status}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Capacity:</span>
                  <span className="font-bold text-white">{selectedTable.capacity} Guests</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Dining Section:</span>
                  <span className="font-bold text-white">{selectedTable.section || 'General'}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    handleRequestBill(selectedTable.id);
                    setSelectedTable(null);
                  }}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/20"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Request Bill</span>
                </button>
                <button
                  onClick={() => setSelectedTable(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WaiterLayout>
  );
}
