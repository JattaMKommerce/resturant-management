import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import Modal from '../../../components/common/Modal';
import { Boxes, RefreshCw, AlertTriangle, CheckCircle, Flame, Calendar, ShieldAlert, Star, Layers, Eye, Brain } from 'lucide-react';

export default function KitchenInventoryView() {
  const { joinRoom, leaveRoom, socket } = useSocket();
  const [ingredients, setIngredients] = useState([]);
  const [expiringSoonItems, setExpiringSoonItems] = useState([]);
  const [expiredStockItems, setExpiredStockItems] = useState([]);
  const [kitchenIntel, setKitchenIntel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Read-only Batch Breakdown modal
  const [selectedItemForBatches, setSelectedItemForBatches] = useState(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const [res, intelRes] = await Promise.all([
        api.get('/inventory/availability'),
        api.get('/inventory/kitchen-intelligence')
      ]);

      if (res.success) {
        if (Array.isArray(res.data)) {
          setIngredients(res.data);
          setExpiringSoonItems([]);
          setExpiredStockItems([]);
        } else if (res.data && res.data.items) {
          setIngredients(res.data.items || []);
          setExpiringSoonItems(res.data.expiring_soon_items || []);
          setExpiredStockItems(res.data.expired_stock_items || []);
        }
      }
      if (intelRes.success) {
        setKitchenIntel(intelRes.data);
      }
    } catch (err) {
      console.error('Failed to load kitchen ingredient availability:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
    joinRoom('kitchen');

    if (socket) {
      socket.on('inventory_updated', () => fetchAvailability());
      socket.on('kot_updated', () => fetchAvailability());
    }

    return () => {
      leaveRoom('kitchen');
      if (socket) {
        socket.off('inventory_updated');
        socket.off('kot_updated');
      }
    };
  }, [socket]);

  const filtered = ingredients.filter(i => 
    i.item_name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category_name && i.category_name.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'STOCK_OK':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>🟢 STOCK OK</span>
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>🟠 EXPIRING SOON</span>
          </span>
        );
      case 'EXPIRED_STOCK':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>🔴 EXPIRED STOCK</span>
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>🟡 LOW STOCK</span>
          </span>
        );
      case 'OUT_OF_STOCK':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
            <span>⚫ OUT OF STOCK</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Boxes className="w-7 h-7 text-amber-500" />
            <span>Kitchen Ingredient Availability & Expiry View</span>
          </h2>
          <p className="text-slate-400 text-sm">Read-only operational stock levels, 7-day expiry warnings, expired stock protection, and FEFO candidate highlights</p>
        </div>

        <button
          onClick={fetchAvailability}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Refresh Stock Data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* 🧠 KITCHEN OPERATIONAL INTELLIGENCE (READ-ONLY, NO FINANCIALS) */}
      {kitchenIntel && (
        <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-400" />
              <span>🧠 Kitchen Operational Intelligence</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">Live Operational Insights</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Most Used Ingredient */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <span>🥇 Most Used (30d)</span>
              </span>
              {kitchenIntel.most_used_item ? (
                <div className="mt-1">
                  <div className="font-bold text-white text-xs truncate">{kitchenIntel.most_used_item.item_name}</div>
                  <div className="font-black text-amber-400 text-sm mt-0.5">
                    {kitchenIntel.most_used_item.quantity_used.toFixed(1)} {kitchenIntel.most_used_item.unit}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1 italic">No usage recorded yet.</p>
              )}
            </div>

            {/* 2. Fastest Depletion */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <span>⚡ Running Low</span>
              </span>
              {kitchenIntel.fastest_depletion ? (
                <div className="mt-1">
                  <div className="font-bold text-white text-xs truncate">{kitchenIntel.fastest_depletion.item_name}</div>
                  <div className="font-black text-amber-300 text-sm mt-0.5">
                    ~{kitchenIntel.fastest_depletion.estimated_days} days left
                  </div>
                  <div className="text-[10px] text-slate-400">{kitchenIntel.fastest_depletion.usable_stock} {kitchenIntel.fastest_depletion.unit} usable</div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1 italic">Adequate stock levels.</p>
              )}
            </div>

            {/* 3. Expiring Soon Count */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <span>⚠️ Expiring Soon</span>
              </span>
              <div className="mt-1">
                <div className="font-black text-amber-300 text-sm">
                  {kitchenIntel.expiring_soon_batches ? kitchenIntel.expiring_soon_batches.length : 0} Batches
                </div>
                <div className="text-[10px] text-slate-400">Within next 7 days</div>
              </div>
            </div>

            {/* 4. Critical Stock Alerts */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <span>🔴 Stock Alerts</span>
              </span>
              <div className="mt-1">
                <div className="font-black text-rose-400 text-sm">
                  {kitchenIntel.critical_stock_alerts ? kitchenIntel.critical_stock_alerts.length : 0} Low/Out
                </div>
                <div className="text-[10px] text-slate-400">At or below min threshold</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. EXPIRING SOON SECTION (<= 7 DAYS) */}
      {expiringSoonItems && expiringSoonItems.length > 0 && (
        <div className="glass-panel bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>⚠️ Expiring Soon (Within 7 Days)</span>
            </h3>
            <span className="text-xs text-amber-300 font-semibold">{expiringSoonItems.length} Batch{expiringSoonItems.length === 1 ? '' : 'es'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {expiringSoonItems.map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs">{b.item_name}</div>
                  <div className="text-[10px] text-amber-400 font-mono">Batch: {b.batch_number}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-amber-300 text-xs">{b.current_quantity} {b.unit}</div>
                  <div className="text-[10px] font-bold text-rose-400">{b.days_remaining === 0 ? 'Expires Today' : `${b.days_remaining} day${b.days_remaining === 1 ? '' : 's'} left`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. EXPIRED STOCK WARNING SECTION */}
      {expiredStockItems && expiredStockItems.length > 0 && (
        <div className="glass-panel bg-rose-950/40 border border-rose-500/50 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-rose-500/40 pb-2">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>🔴 Expired Stock Warning (Do Not Use for Orders)</span>
            </h3>
            <span className="text-xs text-rose-300 font-bold">{expiredStockItems.length} Expired Batch{expiredStockItems.length === 1 ? '' : 'es'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {expiredStockItems.map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-slate-900/90 border border-rose-500/40 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs">{b.item_name}</div>
                  <div className="text-[10px] text-rose-400 font-mono">Batch: {b.batch_number}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-rose-400 text-xs">{b.current_quantity} {b.unit}</div>
                  <div className="text-[10px] font-bold text-rose-300">Expired by {b.days_expired} day{b.days_expired === 1 ? '' : 's'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="glass-panel bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search raw ingredients (e.g. Basmati Rice, Chicken, Milk)..."
          className="w-full md:w-80 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* 1. INGREDIENT STOCK CARDS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-slate-900/50 border border-slate-800"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Boxes className="w-12 h-12 text-slate-700 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-slate-300">No Raw Ingredients Found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const usableVal = item.usable_stock !== undefined ? parseFloat(item.usable_stock) : parseFloat(item.current_stock);
            const expiringSoonVal = parseFloat(item.expiring_soon_stock || 0);
            const expiredVal = parseFloat(item.expired_stock || 0);

            return (
              <div
                key={item.id}
                className={`glass-panel bg-slate-900/80 border rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl ${
                  item.stock_status === 'OUT_OF_STOCK'
                    ? 'border-slate-800 shadow-slate-950/20'
                    : item.stock_status === 'EXPIRED_STOCK'
                    ? 'border-rose-500/50 shadow-rose-500/10'
                    : item.stock_status === 'EXPIRING_SOON'
                    ? 'border-amber-500/50 shadow-amber-500/10'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{item.category_name}</span>
                      <h3 className="text-xl font-bold text-white mt-0.5">{item.item_name}</h3>
                    </div>
                    {getStatusBadge(item.stock_status)}
                  </div>

                  {/* Stock Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 my-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div>
                      <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider">Usable Stock</span>
                      <div className="text-xl font-black text-white mt-0.5">
                        {usableVal.toFixed(2)} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider">Used Today</span>
                      <div className="text-xl font-black text-amber-400 mt-0.5">
                        {parseFloat(item.used_today || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Expiry Breakdown Indicators */}
                  {(expiringSoonVal > 0 || expiredVal > 0) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {expiringSoonVal > 0 && (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>⚠️ {expiringSoonVal.toFixed(1)} {item.unit} expires &le;7 days</span>
                        </span>
                      )}
                      {expiredVal > 0 && (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                          <span>🔴 {expiredVal.toFixed(1)} {item.unit} expired</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recent Recipe Consumption Log */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span>Recent KOT Consumption Log</span>
                    </span>

                    {item.recent_consumptions && item.recent_consumptions.length > 0 ? (
                      <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                        {item.recent_consumptions.map((c) => (
                          <div key={c.id} className="text-xs p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-slate-300">
                            <span className="font-mono text-[11px] truncate max-w-[180px]">{c.notes}</span>
                            <span className="font-bold text-rose-400 text-xs">{parseFloat(c.change_quantity).toFixed(2)} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">No consumption recorded today yet.</p>
                    )}
                  </div>
                </div>

                {/* Footer Action: Read-Only Batch Details */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Min Alert: {item.min_stock_alert} {item.unit}</span>

                  {item.batches && item.batches.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedItemForBatches(item);
                        setIsBatchModalOpen(true);
                      }}
                      className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Batches & FEFO</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. READ-ONLY BATCH BREAKDOWN MODAL WITH FEFO HIGHLIGHT */}
      {selectedItemForBatches && (
        <Modal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          title={`Batch Breakdown - ${selectedItemForBatches.item_name}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 font-semibold">Usable Stock: </span>
                <span className="font-black text-emerald-400">{selectedItemForBatches.usable_stock} {selectedItemForBatches.unit}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">Expiring &le;7d: </span>
                <span className="font-black text-amber-400">{selectedItemForBatches.expiring_soon_stock} {selectedItemForBatches.unit}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">Expired: </span>
                <span className="font-black text-rose-400">{selectedItemForBatches.expired_stock} {selectedItemForBatches.unit}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Below is the read-only batch priority. FEFO automatically consumes from the highlighted <strong className="text-amber-400">⭐ 1st FEFO Target</strong> batch first.
            </p>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Batch No</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3">FEFO Priority / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedItemForBatches.batches && selectedItemForBatches.batches.map((b) => (
                    <tr
                      key={b.id}
                      className={b.is_fefo_target ? 'bg-amber-500/10 border-l-4 border-l-amber-500 font-bold' : b.is_expired ? 'bg-rose-950/40 text-rose-300' : 'hover:bg-slate-800/30'}
                    >
                      <td className="p-3 font-mono">{b.batch_number}</td>
                      <td className="p-3 font-bold text-white">{b.current_quantity} {selectedItemForBatches.unit}</td>
                      <td className="p-3 font-mono">{new Date(b.expiry_date).toLocaleDateString()}</td>
                      <td className="p-3">
                        {b.is_fefo_target ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-1 w-max shadow-md shadow-amber-500/20">
                            <Star className="w-3 h-3 fill-slate-950" />
                            <span>⭐ 1st FEFO Target Batch</span>
                          </span>
                        ) : b.is_expired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            ⛔ EXPIRED - Do Not Use
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            🟢 Safe Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
