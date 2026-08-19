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
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>🟢 Stock OK</span>
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>🟠 Expiring Soon</span>
          </span>
        );
      case 'EXPIRED_STOCK':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>🔴 Expired Stock</span>
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>🟡 Low Stock</span>
          </span>
        );
      case 'OUT_OF_STOCK':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-[#64748B] border border-[#D7E5E8] flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Out of Stock</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 antialiased font-sans">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#3A7D7C]" />
            <span>Kitchen Ingredient Availability</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Read-only operational stock levels, 7-day expiry warnings, and FEFO candidate highlights</p>
        </div>

        <button
          onClick={fetchAvailability}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors shadow-2xs"
          title="Refresh Stock Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KITCHEN OPERATIONAL INTELLIGENCE */}
      {kitchenIntel && (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-2">
            <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#3A7D7C]" />
              <span>Kitchen Operational Intelligence</span>
            </h3>
            <span className="text-[11px] text-[#64748B] font-semibold">Live Insights</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Most Used Ingredient */}
            <div className="p-3 rounded-xl bg-slate-50 border border-[#D7E5E8]">
              <span className="text-[10px] font-bold text-[#3A7D7C] uppercase tracking-wider flex items-center gap-1">
                <span>🥇 Most Used (30d)</span>
              </span>
              {kitchenIntel.most_used_item ? (
                <div className="mt-1">
                  <div className="font-bold text-[#1F2937] text-xs truncate">{kitchenIntel.most_used_item.item_name}</div>
                  <div className="font-black text-[#1F2937] text-sm mt-0.5">
                    {kitchenIntel.most_used_item.quantity_used.toFixed(1)} {kitchenIntel.most_used_item.unit}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[#64748B] mt-1 italic">No usage recorded yet.</p>
              )}
            </div>

            {/* 2. Fastest Depletion */}
            <div className="p-3 rounded-xl bg-slate-50 border border-[#D7E5E8]">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <span>⚡ Running Low</span>
              </span>
              {kitchenIntel.fastest_depletion ? (
                <div className="mt-1">
                  <div className="font-bold text-[#1F2937] text-xs truncate">{kitchenIntel.fastest_depletion.item_name}</div>
                  <div className="font-bold text-amber-800 text-sm mt-0.5">
                    ~{kitchenIntel.fastest_depletion.estimated_days} days left
                  </div>
                  <div className="text-[10px] text-[#64748B]">{kitchenIntel.fastest_depletion.usable_stock} {kitchenIntel.fastest_depletion.unit} usable</div>
                </div>
              ) : (
                <p className="text-[11px] text-[#64748B] mt-1 italic">Adequate stock levels.</p>
              )}
            </div>

            {/* 3. Expiring Soon Count */}
            <div className="p-3 rounded-xl bg-slate-50 border border-[#D7E5E8]">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                <span>⚠️ Expiring Soon</span>
              </span>
              <div className="mt-1">
                <div className="font-bold text-amber-800 text-sm">
                  {kitchenIntel.expiring_soon_batches ? kitchenIntel.expiring_soon_batches.length : 0} Batches
                </div>
                <div className="text-[10px] text-[#64748B]">Within next 7 days</div>
              </div>
            </div>

            {/* 4. Critical Stock Alerts */}
            <div className="p-3 rounded-xl bg-slate-50 border border-[#D7E5E8]">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                <span>🔴 Stock Alerts</span>
              </span>
              <div className="mt-1">
                <div className="font-bold text-rose-700 text-sm">
                  {kitchenIntel.critical_stock_alerts ? kitchenIntel.critical_stock_alerts.length : 0} Low/Out
                </div>
                <div className="text-[10px] text-[#64748B]">At or below min threshold</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPIRING SOON SECTION */}
      {expiringSoonItems && expiringSoonItems.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>⚠️ Expiring Soon (Within 7 Days)</span>
            </h3>
            <span className="text-xs text-amber-900 font-bold">{expiringSoonItems.length} Batch{expiringSoonItems.length === 1 ? '' : 'es'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {expiringSoonItems.map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between shadow-2xs">
                <div>
                  <div className="font-bold text-[#1F2937] text-xs">{b.item_name}</div>
                  <div className="text-[10px] text-[#64748B] font-mono">Batch: {b.batch_number}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#1F2937] text-xs">{b.current_quantity} {b.unit}</div>
                  <div className="text-[10px] font-bold text-rose-700">{b.days_remaining === 0 ? 'Expires Today' : `${b.days_remaining} day${b.days_remaining === 1 ? '' : 's'} left`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPIRED STOCK WARNING SECTION */}
      {expiredStockItems && expiredStockItems.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-rose-200 pb-2">
            <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>🔴 Expired Stock Warning (Do Not Use for Orders)</span>
            </h3>
            <span className="text-xs text-rose-900 font-bold">{expiredStockItems.length} Expired Batch{expiredStockItems.length === 1 ? '' : 'es'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {expiredStockItems.map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-white border border-rose-200 flex items-center justify-between shadow-2xs">
                <div>
                  <div className="font-bold text-[#1F2937] text-xs">{b.item_name}</div>
                  <div className="text-[10px] text-rose-800 font-mono">Batch: {b.batch_number}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rose-700 text-xs">{b.current_quantity} {b.unit}</div>
                  <div className="text-[10px] font-semibold text-[#64748B]">Expired by {b.days_expired} day{b.days_expired === 1 ? '' : 's'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 shadow-xs">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search raw ingredients (e.g. Basmati Rice, Chicken, Milk)..."
          className="w-full md:w-80 px-4 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] placeholder-[#64748B] text-xs font-semibold focus:outline-none focus:border-[#3A7D7C]"
        />
      </div>

      {/* INGREDIENT STOCK CARDS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-white border border-[#D7E5E8]"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-12 text-center text-[#64748B] shadow-xs">
          <Boxes className="w-12 h-12 text-[#64748B]/40 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-[#1F2937]">No Raw Ingredients Found</h3>
          <p className="text-xs text-[#64748B] mt-1">Try adjusting search query.</p>
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
                className="bg-white border border-[#D7E5E8] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-[#3A7D7C] uppercase tracking-wider">{item.category_name}</span>
                      <h3 className="text-lg font-bold text-[#1F2937] mt-0.5">{item.item_name}</h3>
                    </div>
                    {getStatusBadge(item.stock_status)}
                  </div>

                  {/* Stock Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 my-3 p-3 rounded-xl bg-slate-50 border border-[#D7E5E8]">
                    <div>
                      <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Usable Stock</span>
                      <div className="text-xl font-black text-[#1F2937] mt-0.5">
                        {usableVal.toFixed(2)} <span className="text-xs font-normal text-[#64748B]">{item.unit}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Used Today</span>
                      <div className="text-xl font-black text-amber-900 mt-0.5">
                        {parseFloat(item.used_today || 0).toFixed(2)} <span className="text-xs font-normal text-[#64748B]">{item.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expiry Breakdown Indicators */}
                  {(expiringSoonVal > 0 || expiredVal > 0) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {expiringSoonVal > 0 && (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>⚠️ {expiringSoonVal.toFixed(1)} {item.unit} expires &le;7d</span>
                        </span>
                      )}
                      {expiredVal > 0 && (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          <span>🔴 {expiredVal.toFixed(1)} {item.unit} expired</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recent Recipe Consumption Log */}
                  <div className="space-y-1.5 pt-2 border-t border-[#D7E5E8]">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                      <Flame className="w-3 h-3 text-[#3A7D7C]" />
                      <span>Recent Consumption Log</span>
                    </span>

                    {item.recent_consumptions && item.recent_consumptions.length > 0 ? (
                      <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                        {item.recent_consumptions.map((c) => (
                          <div key={c.id} className="text-xs p-1.5 rounded-lg bg-slate-50 border border-[#D7E5E8] flex items-center justify-between text-[#1F2937]">
                            <span className="font-mono text-[11px] truncate max-w-[180px]">{c.notes}</span>
                            <span className="font-bold text-rose-700 text-xs">{parseFloat(c.change_quantity).toFixed(2)} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#64748B] italic">No consumption recorded today yet.</p>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-[#D7E5E8] flex items-center justify-between">
                  <span className="text-[10px] text-[#64748B]">Min Alert: {item.min_stock_alert} {item.unit}</span>

                  {item.batches && item.batches.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedItemForBatches(item);
                        setIsBatchModalOpen(true);
                      }}
                      className="text-xs text-[#3A7D7C] font-bold hover:underline flex items-center gap-1"
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

      {/* READ-ONLY BATCH BREAKDOWN MODAL */}
      {selectedItemForBatches && (
        <Modal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          title={`Batch Breakdown - ${selectedItemForBatches.item_name}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-[#D7E5E8] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#64748B] font-semibold">Usable Stock: </span>
                <span className="font-bold text-emerald-800">{selectedItemForBatches.usable_stock} {selectedItemForBatches.unit}</span>
              </div>
              <div>
                <span className="text-[#64748B] font-semibold">Expiring &le;7d: </span>
                <span className="font-bold text-amber-800">{selectedItemForBatches.expiring_soon_stock} {selectedItemForBatches.unit}</span>
              </div>
              <div>
                <span className="text-[#64748B] font-semibold">Expired: </span>
                <span className="font-bold text-rose-700">{selectedItemForBatches.expired_stock} {selectedItemForBatches.unit}</span>
              </div>
            </div>

            <p className="text-xs text-[#64748B]">
              Below is the read-only batch priority. FEFO automatically consumes from the highlighted <strong className="text-[#3A7D7C]">⭐ 1st FEFO Target</strong> batch first.
            </p>

            <div className="overflow-x-auto border border-[#D7E5E8] rounded-xl">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-slate-50 text-[11px] font-bold text-[#64748B] uppercase border-b border-[#D7E5E8]">
                  <tr>
                    <th className="p-3">Batch No</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3">FEFO Priority / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {selectedItemForBatches.batches && selectedItemForBatches.batches.map((b) => (
                    <tr
                      key={b.id}
                      className={b.is_fefo_target ? 'bg-[#EAF4F7] border-l-4 border-l-[#3A7D7C] font-bold' : b.is_expired ? 'bg-rose-50 text-rose-800' : 'hover:bg-slate-50'}
                    >
                      <td className="p-3 font-mono">{b.batch_number}</td>
                      <td className="p-3 font-bold text-[#1F2937]">{b.current_quantity} {selectedItemForBatches.unit}</td>
                      <td className="p-3 font-mono">{new Date(b.expiry_date).toLocaleDateString()}</td>
                      <td className="p-3">
                        {b.is_fefo_target ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#3A7D7C] text-white flex items-center gap-1 w-max shadow-2xs">
                            <Star className="w-3 h-3 fill-white" />
                            <span>⭐ 1st FEFO Target</span>
                          </span>
                        ) : b.is_expired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            ⛔ EXPIRED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
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
                className="px-4 py-1.5 rounded-xl bg-slate-100 text-[#1F2937] hover:bg-slate-200 text-xs font-bold"
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
