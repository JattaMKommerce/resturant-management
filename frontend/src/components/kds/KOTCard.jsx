import React, { useEffect } from 'react';
import LiveTimerBadge from './LiveTimerBadge';
import { ChefHat, Check, Play, Printer, AlertTriangle, MessageSquare, Globe, Utensils } from 'lucide-react';

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
      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shrink-0">
        🔴 Late
      </span>
    );
  }

  switch (status) {
    case 'PENDING':
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
          🟡 Pending
        </span>
      );
    case 'ACCEPTED':
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200 shrink-0">
          🔵 Accepted
        </span>
      );
    case 'PREPARING':
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#EAF4F7] text-[#3A7D7C] border border-[#3A7D7C]/30 shrink-0">
          🟢 Preparing
        </span>
      );
    case 'READY':
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
          ✓ Ready
        </span>
      );
    case 'SERVED':
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-[#64748B] border border-[#D7E5E8] shrink-0">
          🍽️ Served
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-[#1F2937] border border-[#D7E5E8] shrink-0">
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

  // Collect all special instructions and modifiers across items
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
      className={`bg-white border rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 kot-card-hover h-full ${
        isDelayed && kot.status !== 'READY'
          ? 'border-rose-300'
          : isOnlineOrder
          ? 'border-[#D7E5E8]'
          : kot.status === 'PREPARING'
          ? 'border-[#3A7D7C]/40'
          : 'border-[#D7E5E8]'
      }`}
    >
      <div className="space-y-3.5">
        {/* CARD HEADER SECTION */}
        <div className="pb-3 border-b border-[#D7E5E8] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* KOT Number */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-[#3A7D7C] bg-[#EAF4F7] px-2.5 py-1 rounded-lg border border-[#D7E5E8] uppercase tracking-wider shrink-0">
                KOT #{kot.kot_number}
              </span>
            </div>

            {getStatusBadge(kot.status, isDelayed)}
          </div>

          {/* TABLE / DESTINATION METADATA BOX */}
          {isOnlineOrder ? (
            <div className="bg-[#EAF4F7]/60 p-3 rounded-xl border border-[#D7E5E8] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#3A7D7C] uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Online Delivery Order</span>
                </span>
                <span className="text-[#64748B] font-mono text-xs font-medium">
                  {orderTimeStr}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block">Order Token</span>
                  <span className="font-mono font-extrabold text-lg text-[#1F2937] tracking-wider">
                    #{last5Digits}
                  </span>
                </div>
                <div className="text-right">
                  {kot.online_customer_name && (
                    <div className="font-bold text-[#1F2937] text-xs truncate max-w-[140px]">
                      {kot.online_customer_name}
                    </div>
                  )}
                  <div className="text-[10px] text-[#64748B] font-mono">{rawOrderNum}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#EAF4F7]/60 p-3 rounded-xl border border-[#D7E5E8] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#1F2937]">
                  <Utensils className="w-3.5 h-3.5 text-[#3A7D7C]" />
                  <span>Table {kot.table_number || (kot.room_number ? `Room ${kot.room_number}` : 'Takeaway')}</span>
                </span>
                <span className="text-[#64748B] font-mono text-xs font-medium">
                  {orderTimeStr}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#64748B] pt-0.5">
                <span>Order Ref: <strong className="text-[#1F2937] font-mono font-bold">#{last5Digits}</strong></span>
                <span className="text-[11px] text-[#3A7D7C] font-semibold">
                  {kot.kitchen_department_name || 'Kitchen'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* FOOD ITEMS LIST */}
        <div className="space-y-2">
          {!hasItems ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Items Unavailable</span>
              </div>
              <div className="text-[11px] text-[#64748B]">Unable to load items for this KOT.</div>
            </div>
          ) : (
            kot.items.map((item, idx) => {
              const emoji = getFoodEmoji(item.item_name);

              return (
                <div
                  key={item.id || idx}
                  className="p-3 rounded-xl bg-white border border-[#D7E5E8] space-y-2 hover:border-[#3A7D7C]/40 transition-colors"
                >
                  {/* Food Name & Quantity Hierarchy */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-base shrink-0">{emoji}</span>
                      <span className="font-bold text-[#1F2937] text-sm sm:text-base leading-snug truncate">
                        {item.item_name}
                      </span>
                    </div>
                    <span className="bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8] px-2.5 py-0.5 rounded-lg text-xs font-black shrink-0">
                      × {item.quantity}
                    </span>
                  </div>

                  {/* Prep Time & Live Timer */}
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs pt-0.5 text-[#64748B]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>
                        Prep: <strong className="text-[#1F2937] font-semibold">{item.prep_time_minutes || 15}m</strong>
                      </span>
                      {item.batch_capacity && (
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-[#64748B] border border-[#D7E5E8]">
                          Cap: {item.batch_capacity}
                        </span>
                      )}
                      {(item.number_of_batches > 1 || (item.batch_capacity && item.quantity > item.batch_capacity)) && (
                        <span className="text-[10px] bg-[#EAF4F7] text-[#3A7D7C] px-1.5 py-0.5 rounded font-bold border border-[#D7E5E8]">
                          {item.number_of_batches || Math.ceil(item.quantity / item.batch_capacity)} Batches ({item.estimated_prep_time_minutes || (Math.ceil(item.quantity / item.batch_capacity) * (item.prep_time_minutes || 15))}m)
                        </span>
                      )}
                    </div>

                    <LiveTimerBadge
                      startedAt={item.started_at}
                      expectedFinishAt={item.expected_finish_at}
                      readyAt={item.ready_at}
                      prepTimeMinutes={item.estimated_prep_time_minutes || item.prep_time_minutes || 15}
                      status={item.status}
                      currentTime={currentTime}
                      receivedAt={kot.kitchen_received_at}
                      targetAt={kot.target_completion_at}
                    />
                  </div>

                  {/* Item-Level Action Controls */}
                  {onItemStatusUpdate && (item.status === 'PENDING' || item.status === 'ACCEPTED' || item.status === 'PREPARING') && (
                    <div className="flex justify-end pt-1">
                      {(item.status === 'PENDING' || item.status === 'ACCEPTED') && (
                        <button
                          onClick={() => onItemStatusUpdate(item.id, 'PREPARING')}
                          className="px-2.5 py-1 rounded-lg bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Start Item</span>
                        </button>
                      )}
                      {item.status === 'PREPARING' && (
                        <button
                          onClick={() => onItemStatusUpdate(item.id, 'READY')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Mark Ready</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* SPECIAL INSTRUCTIONS */}
          {allInstructions.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1.5 mt-2">
              <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                <span>Special Instructions</span>
              </div>
              <ul className="space-y-1 text-xs text-amber-950 font-medium">
                {allInstructions.map((ins, iIdx) => (
                  <li key={iIdx} className="flex items-start gap-1.5">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* KOT CARD BOTTOM ACTION BUTTONS */}
      <div className="pt-3.5 mt-3.5 border-t border-[#D7E5E8] space-y-2">
        {kot.status === 'PENDING' && (
          <button
            onClick={() => onStatusUpdate(kot.id, 'ACCEPTED')}
            className="w-full py-2.5 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Accept Order</span>
          </button>
        )}

        {kot.status === 'ACCEPTED' && (
          <button
            onClick={() => onStatusUpdate(kot.id, 'PREPARING')}
            className="w-full py-2.5 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Preparing</span>
          </button>
        )}

        {kot.status === 'PREPARING' && (
          <button
            onClick={() => onStatusUpdate(kot.id, 'READY')}
            className="w-full py-2.5 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <ChefHat className="w-4 h-4" />
            <span>Mark Ready</span>
          </button>
        )}

        {kot.status === 'READY' && (
          <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center uppercase tracking-wider">
            ✓ Ready to Serve
          </div>
        )}

        {kot.status === 'SERVED' && (
          <div className="w-full py-2.5 px-4 rounded-xl bg-slate-100 border border-[#D7E5E8] text-[#64748B] text-xs font-bold text-center uppercase tracking-wider">
            🍽️ Order Served
          </div>
        )}

        {/* Print Ticket Link */}
        <div className="flex justify-end pt-1">
          <button
            onClick={() => onPrintKOT(kot)}
            className="text-xs font-medium text-[#64748B] hover:text-[#1F2937] transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
}
