import React, { useEffect } from 'react';
import LiveTimerBadge from './LiveTimerBadge';
import { ChefHat, Check, Play, Printer, AlertTriangle, MessageSquare, Globe, Bike } from 'lucide-react';

function getFoodEmoji(name = '') {
  const n = name.toLowerCase();
  if (n.includes('biryani') || n.includes('rice') || n.includes('pulao')) return '🍛';
  if (n.includes('naan') || n.includes('roti') || n.includes('paratha') || n.includes('bread')) return '🍞';
  if (n.includes('coke') || n.includes('soda') || n.includes('drink') || n.includes('juice') || n.includes('beverage') || n.includes('lime') || n.includes('coffee') || n.includes('tea')) return '🥤';
  if (n.includes('chicken') || n.includes('tikka') || n.includes('kebab') || n.includes('meat') || n.includes('mutton') || n.includes('wing')) return '🍗';
  if (n.includes('paneer') || n.includes('veg') || n.includes('roll') || n.includes('salad') || n.includes('soup')) return '🥗';
  if (n.includes('ice cream') || n.includes('jamun') || n.includes('dessert') || n.includes('cake') || n.includes('sweet')) return '🍨';
  return '🍽️';
}

function getStatusBadge(status, isDelayed) {
  if (isDelayed && status !== 'READY' && status !== 'SERVED') {
    return (
      <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/60 animate-pulse shrink-0">
        🔴 LATE
      </span>
    );
  }

  switch (status) {
    case 'PENDING':
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
          🟡 PENDING
        </span>
      );
    case 'ACCEPTED':
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40 shrink-0">
          🔵 ACCEPTED
        </span>
      );
    case 'PREPARING':
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
          🟢 PREPARING
        </span>
      );
    case 'READY':
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
          ✅ READY
        </span>
      );
    case 'SERVED':
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 shrink-0">
          🍽️ SERVED
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-slate-300 shrink-0">
          {status}
        </span>
      );
  }
}

export default function KOTCard({ kot, onStatusUpdate, onItemStatusUpdate, onPrintKOT, currentTime }) {
  const hasItems = kot && Array.isArray(kot.items) && kot.items.length > 0;

  useEffect(() => {
    if (!hasItems) {
      console.error(`[KDS Warning] KOT ID #${kot?.id} (${kot?.kot_number}) loaded without items payload.`, kot);
    }
  }, [hasItems, kot]);

  // Check if any item in this KOT is currently late/overdue
  const now = currentTime || Date.now();
  const hasLateItem = hasItems && kot.items.some(item => {
    if (item.status === 'READY' || item.status === 'SERVED' || item.status === 'CANCELLED') return false;
    if (!item.started_at) return false;
    const expected = item.expected_finish_at
      ? new Date(item.expected_finish_at).getTime()
      : new Date(item.started_at).getTime() + (item.prep_time_minutes || 15) * 60000;
    return expected < now;
  });

  const isDelayed = kot.is_delayed || hasLateItem;

  const orderTimeStr = kot.kitchen_received_at || kot.created_at
    ? new Date(kot.kitchen_received_at || kot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const isOnlineOrder = kot.order_type === 'ONLINE' || (!kot.table_number && !kot.room_number && (kot.online_customer_name || String(kot.order_number || '').includes('ORD')));
  const rawOrderNum = String(kot.order_number || (kot.order_id ? `ORD-${kot.order_id}` : 'N/A'));
  const orderDigits = rawOrderNum.replace(/\D/g, '');
  const last5Digits = orderDigits.length >= 5 ? orderDigits.slice(-5) : rawOrderNum.length > 5 ? rawOrderNum.slice(-5) : rawOrderNum || '00000';

  // Collect all special instructions and modifiers across items for the Special Instructions section
  const allInstructions = [];
  if (hasItems) {
    kot.items.forEach(item => {
      if (item.modifiers && item.modifiers.length > 0) {
        item.modifiers.forEach(m => {
          allInstructions.push(m.option_name);
        });
      }
      if (
        item.special_instructions &&
        item.special_instructions !== 'null' &&
        item.special_instructions !== 'undefined' &&
        item.special_instructions.trim().length > 0
      ) {
        allInstructions.push(item.special_instructions.trim());
      }
    });
  }

  return (
    <div
      className={`glass-panel bg-slate-900/90 border rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-lg transition-all hover:border-slate-700 h-full ${
        isDelayed && kot.status !== 'READY'
          ? 'border-rose-500/70 shadow-rose-500/10 ring-1 ring-rose-500/30'
          : isOnlineOrder
          ? 'border-indigo-500/40 shadow-indigo-500/10'
          : kot.status === 'PREPARING'
          ? 'border-emerald-500/40 shadow-emerald-500/10'
          : kot.status === 'ACCEPTED'
          ? 'border-blue-500/40 shadow-blue-500/10'
          : 'border-slate-800'
      }`}
    >
      <div className="space-y-3">
        {/* CARD HEADER SECTION */}
        <div className="pb-2.5 border-b border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {/* KOT / Order Number Header */}
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                <span>KOT #{kot.kot_number}</span>
              </h2>
            </div>

            {getStatusBadge(kot.status, isDelayed)}
          </div>

          {/* ONLINE vs OFFLINE / TABLE SECTION */}
          {isOnlineOrder ? (
            <div className="bg-gradient-to-r from-indigo-950/80 to-slate-950 p-2.5 rounded-xl border border-indigo-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-black text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40 uppercase tracking-wider">
                  <Globe className="w-3 h-3" /> ONLINE ORDER
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  🕕 {orderTimeStr}
                </span>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <div>
                  <span className="text-[9px] uppercase font-extrabold text-indigo-300 block">Order Token (Last 5 Digits)</span>
                  <span className="font-mono font-black text-lg text-amber-400 tracking-wider">
                    #{last5Digits}
                  </span>
                </div>
                <div className="text-right">
                  {kot.online_customer_name && (
                    <div className="font-bold text-white text-xs truncate max-w-[130px]">👤 {kot.online_customer_name}</div>
                  )}
                  <div className="text-[10px] text-slate-500 font-mono">{rawOrderNum}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-300 font-bold">
                  🪑 Table {kot.table_number || (kot.room_number ? `Room ${kot.room_number}` : 'Takeaway')}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  🕕 {orderTimeStr}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Order: <strong className="text-slate-300 font-mono">#{last5Digits}</strong> ({rawOrderNum})</span>
                <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-medium uppercase text-[10px]">
                  {kot.kitchen_department_name || 'Kitchen'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* FOOD ITEMS SECTION (No inner scrollbar, items expand naturally) */}
        <div className="space-y-2">
          {!hasItems ? (
            /* Fallback when items unavailable */
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>⚠️ ITEMS UNAVAILABLE</span>
              </div>
              <div className="text-[11px] text-slate-400">Unable to load items for this KOT.</div>
            </div>
          ) : (
            kot.items.map((item, idx) => {
              const emoji = getFoodEmoji(item.item_name);

              return (
                <div
                  key={item.id || idx}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5"
                >
                  {/* Dish Name & Quantity on SAME line (Quantity aligned right) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-white text-xs sm:text-sm truncate flex-1">
                      <span className="text-base shrink-0">{emoji}</span>
                      <span className="truncate">{item.item_name}</span>
                    </div>
                    <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-black shrink-0">
                      ×{item.quantity}
                    </span>
                  </div>

                  {/* Prep Time & Live Timer */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-400">
                    <span>
                      Prep: <strong className="text-slate-300">{item.prep_time_minutes || 15}m</strong>
                    </span>

                    <LiveTimerBadge
                      startedAt={item.started_at}
                      expectedFinishAt={item.expected_finish_at}
                      readyAt={item.ready_at}
                      prepTimeMinutes={item.prep_time_minutes || 15}
                      status={item.status}
                      currentTime={currentTime}
                      receivedAt={kot.kitchen_received_at}
                      targetAt={kot.target_completion_at}
                    />
                  </div>

                  {/* Compact Item-Level Actions (if needed) */}
                  {onItemStatusUpdate && (item.status === 'PENDING' || item.status === 'ACCEPTED' || item.status === 'PREPARING') && (
                    <div className="flex justify-end pt-1">
                      {(item.status === 'PENDING' || item.status === 'ACCEPTED') && (
                        <button
                          onClick={() => onItemStatusUpdate(item.id, 'PREPARING')}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-[10px] font-bold transition-all flex items-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5 fill-amber-400" />
                          <span>Start Item</span>
                        </button>
                      )}
                      {item.status === 'PREPARING' && (
                        <button
                          onClick={() => onItemStatusUpdate(item.id, 'READY')}
                          className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black transition-all flex items-center gap-1"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Mark Item Ready</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* SPECIAL INSTRUCTIONS SECTION (Compact box) */}
          {allInstructions.length > 0 && (
            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-1 mt-1.5">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-amber-400" />
                <span>Special Instructions</span>
              </div>
              <ul className="space-y-0.5 text-[11px] text-amber-300 font-medium">
                {allInstructions.map((ins, iIdx) => (
                  <li key={iIdx} className="flex items-start gap-1">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* KOT CARD ACTION BUTTONS (Single Primary Action Per State) */}
      <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-2">
        {kot.status === 'PENDING' && (
          <button
            onClick={() => onStatusUpdate(kot.id, 'ACCEPTED')}
            className="w-full py-2.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>ACCEPT ORDER</span>
          </button>
        )}

        {kot.status === 'ACCEPTED' && (
          <button
            onClick={() => onStatusUpdate(kot.id, 'PREPARING')}
            className="w-full py-2.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>START PREPARING</span>
          </button>
        )}

        {kot.status === 'PREPARING' && (
          <button
            onClick={() => onStatusUpdate(kot.id, 'READY')}
            className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
          >
            <ChefHat className="w-4 h-4" />
            <span>MARK READY</span>
          </button>
        )}

        {kot.status === 'READY' && (
          <div className="w-full py-2 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center uppercase tracking-wider">
            ✓ READY
          </div>
        )}

        {kot.status === 'SERVED' && (
          <div className="w-full py-2 px-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold text-center uppercase tracking-wider">
            🍽️ SERVED
          </div>
        )}

        {/* Print Ticket Link */}
        <div className="flex justify-end pt-0.5">
          <button
            onClick={() => onPrintKOT(kot)}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <Printer className="w-3 h-3" />
            <span>Print Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
}
