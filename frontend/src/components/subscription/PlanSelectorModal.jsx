import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Landmark, Sparkles, ShieldCheck, Loader2 } from 'lucide-react';
import api from '../../api/axios';

export default function PlanSelectorModal({ isOpen, onClose, onSuccess, currentPlanId = null }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY'); // 'RAZORPAY' or 'MANUAL_OFFLINE'
  const [offlineNote, setOfflineNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
      setError('');
      setOfflineNote('');
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/subscription/plans');
      if (res.data.success) {
        setPlans(res.data.data);
        if (res.data.data.length > 0) {
          const defaultSelect = currentPlanId
            ? res.data.data.find(p => p.id === currentPlanId)?.id || res.data.data[0].id
            : res.data.data[0].id;
          setSelectedPlanId(defaultSelect);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plans.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedPlanId) return;
    setSubmitting(true);
    setError('');

    try {
      // 1. Initiate payment intent
      const initRes = await api.post('/admin/subscription/payment/initiate', {
        plan_id: selectedPlanId,
        payment_method: paymentMethod,
        offline_proof_note: paymentMethod === 'MANUAL_OFFLINE' ? offlineNote : ''
      });

      if (!initRes.data.success) {
        throw new Error(initRes.data.message || 'Failed to initiate payment');
      }

      const paymentData = initRes.data.data;

      // 2. Handle Razorpay Online Checkout
      if (paymentMethod === 'RAZORPAY') {
        // If window.Razorpay is available (CDN script loaded)
        if (window.Razorpay && paymentData.razorpay_key_id && !paymentData.razorpay_key_id.includes('mock')) {
          const options = {
            key: paymentData.razorpay_key_id,
            amount: Math.round(paymentData.amount * 100),
            currency: paymentData.currency || 'INR',
            name: 'Grand Palace HMS SaaS',
            description: `Subscription: ${paymentData.plan.name}`,
            order_id: paymentData.gateway_order_id,
            handler: async function (response) {
              try {
                const verifyRes = await api.post('/admin/subscription/payment/verify', {
                  transaction_reference: paymentData.transaction_reference,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                });
                if (verifyRes.data.success) {
                  alert('🎉 Payment verified! Your subscription is now ACTIVE. Full HMS operational access is enabled.');
                  if (onSuccess) onSuccess();
                  onClose();
                }
              } catch (vErr) {
                alert('Verification failed: ' + (vErr.response?.data?.message || vErr.message));
              }
            },
            prefill: {
              name: paymentData.restaurant.name
            },
            theme: {
              color: '#3A7D7C'
            }
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          // Development / Direct Simulation flow
          const simRes = await api.post('/admin/subscription/payment/verify', {
            transaction_reference: paymentData.transaction_reference,
            razorpay_payment_id: `rzp_sim_${Date.now()}`,
            razorpay_signature: 'simulated_signature'
          });
          if (simRes.data.success) {
            alert('🎉 Payment verified! Your subscription is now ACTIVE. Full HMS operational access is enabled.');
            if (onSuccess) onSuccess();
            onClose();
          }
        }
      } else {
        // Manual Offline Submission
        alert(`✅ Offline Payment Proof Submitted!\nTransaction Ref: ${paymentData.transaction_reference}\nSuper Admin will verify the transfer in the bank ledger and activate the subscription.`);
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Payment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#3A7D7C] bg-[#EAF4F7] border border-[#D7E5E8] px-3 py-1 rounded-full w-fit mb-2">
            <Sparkles className="w-3.5 h-3.5" /> HMS SAAS SUBSCRIPTION
          </div>
          <h2 className="text-2xl font-extrabold text-[#1F2937] tracking-tight">Choose Your Subscription Plan</h2>
          <p className="text-xs text-[#64748B] mt-1">
            Unlock kitchen displays, live batch timers, online ordering, and hotel room billing with transparent pricing.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#64748B] space-y-3">
            <Loader2 className="w-8 h-8 text-[#3A7D7C] animate-spin" />
            <p className="text-xs font-bold">Loading available plans...</p>
          </div>
        ) : (
          <>
            {/* Plans Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#3A7D7C] bg-[#EAF4F7]/50 shadow-md ring-2 ring-[#3A7D7C]/20'
                        : 'border-[#D7E5E8] hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#1F2937]">{plan.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#3A7D7C]" />}
                      </div>
                      <div className="mt-2">
                        <span className="text-xl font-black text-[#1F2937]">₹{plan.price.toLocaleString('en-IN')}</span>
                        <span className="text-[10px] text-[#64748B]"> / {plan.duration_days}d</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1.5 leading-snug line-clamp-2">{plan.description}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#D7E5E8]/60 space-y-1">
                      {plan.features.slice(0, 3).map((f, i) => (
                        <div key={i} className="text-[10px] text-[#475569] flex items-center gap-1 truncate">
                          <Check className="w-3 h-3 text-[#3A7D7C] shrink-0" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-extrabold text-[#1F2937]">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setPaymentMethod('RAZORPAY')}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    paymentMethod === 'RAZORPAY'
                      ? 'border-[#3A7D7C] bg-[#EAF4F7] text-[#1F2937]'
                      : 'border-[#D7E5E8] bg-white text-[#64748B]'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-[#3A7D7C]" />
                  <div>
                    <div className="text-xs font-bold text-[#1F2937]">Razorpay / Online</div>
                    <div className="text-[10px] text-[#64748B]">Cards, UPI, Netbanking (Instant)</div>
                  </div>
                </div>

                <div
                  onClick={() => setPaymentMethod('MANUAL_OFFLINE')}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    paymentMethod === 'MANUAL_OFFLINE'
                      ? 'border-[#3A7D7C] bg-[#EAF4F7] text-[#1F2937]'
                      : 'border-[#D7E5E8] bg-white text-[#64748B]'
                  }`}
                >
                  <Landmark className="w-5 h-5 text-[#3A7D7C]" />
                  <div>
                    <div className="text-xs font-bold text-[#1F2937]">Bank / Offline UPI</div>
                    <div className="text-[10px] text-[#64748B]">Super Admin Verification</div>
                  </div>
                </div>
              </div>

              {paymentMethod === 'MANUAL_OFFLINE' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-[#475569]">Transaction UTR / Bank Reference Notes</label>
                  <textarea
                    rows={2}
                    value={offlineNote}
                    onChange={(e) => setOfflineNote(e.target.value)}
                    placeholder="e.g. Paid ₹2499 via UPI Ref #1234567890 on 22 Aug"
                    className="w-full text-xs p-3 rounded-xl border border-[#D7E5E8] focus:border-[#3A7D7C] focus:ring-1 focus:ring-[#3A7D7C] outline-none"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D7E5E8]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !selectedPlanId}
                onClick={handleCheckout}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#3A7D7C] hover:bg-[#2F6665] text-white transition-all shadow-md shadow-[#3A7D7C]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{paymentMethod === 'RAZORPAY' ? 'Proceed to Instant Pay' : 'Submit for Admin Approval'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
