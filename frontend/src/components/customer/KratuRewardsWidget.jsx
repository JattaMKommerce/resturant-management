import React, { useState } from 'react';
import { Gift, Sparkles, Clock, CheckCircle2, ChevronRight, X, AlertCircle } from 'lucide-react';

export default function KratuRewardsWidget({
  quote,
  rewardsToRedeem,
  setRewardsToRedeem,
  statement,
  restaurantName
}) {
  const [statementModalOpen, setStatementModalOpen] = useState(false);

  if (!quote) return null;

  const available = quote.availableRewards || 0;
  const maxRedeemable = quote.maxRedeemable || 0;
  const toEarn = quote.cashbackToEarn || 0;
  const isApplied = rewardsToRedeem > 0;

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white rounded-2xl border border-emerald-200/80 p-4 shadow-xs space-y-3">
        {/* Header with Cashback to Earn banner */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <span>Kratu Rewards</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-800">
                  Loyalty
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Available: <span className="font-bold text-slate-900 font-mono">₹{available.toFixed(0)}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStatementModalOpen(true)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
          >
            <span>Statement</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Redemption Selector */}
        {available > 0 ? (
          <div className="p-3 rounded-xl bg-white border border-emerald-100 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">
                {isApplied ? `Applied ₹${rewardsToRedeem.toFixed(0)} Rewards` : `Use up to ₹${maxRedeemable.toFixed(0)}`}
              </span>
              <span className="text-[11px] text-slate-500 block">
                Max {quote.maxRedemptionPercentage}% of bill payable via rewards
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isApplied) {
                  setRewardsToRedeem(0);
                } else {
                  setRewardsToRedeem(maxRedeemable);
                }
              }}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs ${
                isApplied
                  ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isApplied ? 'Remove' : 'Apply Now'}
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">
            You will start earning Kratu Rewards on this order!
          </div>
        )}

        {/* Cashback to Earn Preview (Slide 05: Pending until delivery) */}
        {toEarn > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {quote.rewardLabel ? (
                <>
                  <strong className="font-bold text-emerald-950">{quote.rewardLabel}</strong> on this order! (Unlocks upon delivery)
                </>
              ) : quote.rewardType === 'UPTO_LUCKY' ? (
                <>
                  Win <strong className="font-bold text-emerald-950">Up to ₹{quote.uptoAmount} cashback</strong> on this order! (1–2 in 5 get full ₹{quote.uptoAmount} 🎉, unlocks upon delivery)
                </>
              ) : (
                <>
                  Earn <strong className="font-bold text-emerald-950 font-mono">₹{toEarn.toFixed(0)} cashback</strong> on this order! (Unlocks upon delivery)
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Customer Rewards Statement Modal (Slide 14) */}
      {statementModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">Your Kratu Rewards</h3>
                  <p className="text-xs text-emerald-100">{restaurantName || 'Hotel & Restaurant Loyalty'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatementModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Balances Summary (Slide 03: Separate rules & reporting) */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Available to Spend</span>
                  <span className="text-2xl font-black text-emerald-950 font-mono mt-0.5 block">
                    ₹{statement?.availableBalance?.toFixed(0) || '0'}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-medium">Ready for checkout</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Pending Cashback</span>
                  <span className="text-2xl font-black text-amber-950 font-mono mt-0.5 block">
                    ₹{statement?.pendingBalance?.toFixed(0) || '0'}
                  </span>
                  <span className="text-[10px] text-amber-800 font-medium">Unlocks after delivery</span>
                </div>
              </div>

              {statement?.expiringSoonBalance > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>₹{statement.expiringSoonBalance.toFixed(0)}</strong> expiring within 7 days. Use it soon!
                  </span>
                </div>
              )}

              {/* Active Credit Lots (FIFO Expiry - Slide 09) */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Active Credit Lots</h4>
                {statement?.availableLots?.length > 0 ? (
                  <div className="space-y-2">
                    {statement.availableLots.map((lot) => (
                      <div key={lot.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs bg-slate-50/50">
                        <div>
                          <span className="font-bold text-slate-800 block">Reward Lot #{lot.id}</span>
                          <span className="text-[11px] text-slate-500">
                            Expires in {lot.days_until_expiry > 0 ? `${lot.days_until_expiry} days` : 'Today'}
                          </span>
                        </div>
                        <span className="font-black text-emerald-700 font-mono text-sm">
                          ₹{parseFloat(lot.remaining_amount).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No active lots currently available.</p>
                )}
              </div>

              {/* Recent Activity Stream */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Recent Transactions</h4>
                {statement?.transactions?.length > 0 ? (
                  <div className="space-y-2">
                    {statement.transactions.map((tx) => (
                      <div key={tx.id} className="p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${tx.entry_type === 'CREDIT' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <div>
                            <p className="font-semibold text-slate-800">{tx.event_type.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className={`font-mono font-bold ${tx.entry_type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {tx.entry_type === 'CREDIT' ? '+' : '-'}₹{parseFloat(tx.amount).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No transactions recorded yet.</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
              <button
                type="button"
                onClick={() => setStatementModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
