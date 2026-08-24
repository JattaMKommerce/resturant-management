import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Sparkles, Lock, RefreshCw, UserCheck, XCircle } from 'lucide-react';
import PlanSelectorModal from './PlanSelectorModal';

export default function SubscriptionPaywallModal({ subscription, onRenewed }) {
  const [showPlanModal, setShowPlanModal] = useState(false);

  if (!subscription) return null;

  const isPendingApproval = subscription.status === 'PENDING_APPROVAL';
  const isRejected = subscription.status === 'REJECTED';
  const isExpired = subscription.status === 'EXPIRED';
  const isNoSub = !subscription.has_subscription || subscription.status === 'NO_SUBSCRIPTION';

  if (!isPendingApproval && !isRejected && !isExpired && !isNoSub) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm font-sans antialiased">
        <div className="bg-white border border-[#D7E5E8] rounded-3xl max-w-lg w-full p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-sm border ${
            isPendingApproval
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : isRejected
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-rose-50 border-rose-200 text-rose-600'
          }`}>
            {isPendingApproval ? (
              <UserCheck className="w-8 h-8 text-amber-700" />
            ) : isRejected ? (
              <XCircle className="w-8 h-8 text-rose-700" />
            ) : (
              <Lock className="w-8 h-8 text-rose-600" />
            )}
          </div>

          <div>
            <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
              isPendingApproval
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : isRejected
                ? 'bg-rose-100 text-rose-900 border-rose-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {isPendingApproval
                ? 'Awaiting Super Admin Approval'
                : isRejected
                ? 'Subscription Request Rejected'
                : isNoSub
                ? 'Subscription Required'
                : 'Subscription Ended'}
            </span>

            <h2 className="text-2xl font-extrabold text-[#1F2937] tracking-tight mt-3">
              {isPendingApproval
                ? 'Payment Received — Awaiting Approval'
                : isRejected
                ? 'Request Rejected by Super Admin'
                : isNoSub
                ? 'Activate Hotel Subscription'
                : 'Your HMS Subscription Has Expired'}
            </h2>

            <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-2 leading-relaxed">
              {isPendingApproval
                ? 'Your payment was successfully received and verified. The platform Super Admin is reviewing your subscription request. HMS operational access will be granted immediately upon approval (Zero days lost).'
                : isRejected
                ? `Your previous subscription request was rejected (${subscription.rejection_reason || 'Administrative review'}). Please review the reason and submit a new plan request.`
                : isNoSub
                ? 'Your hotel requires an active subscription plan to access live kitchen order tickets (KOT), POS billing, table ordering, and delivery operations.'
                : 'Access to operational hotel features is currently paused. Please renew or upgrade your plan to restore real-time operations immediately.'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#D7E5E8] text-left text-xs space-y-2">
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Features unlocked upon active subscription:</div>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#334155] font-semibold">
              <div>✓ Live KDS & Kitchen Timers</div>
              <div>✓ Table QR Digital Menus</div>
              <div>✓ Guest Billing & Receipts</div>
              <div>✓ Online Store & Rider Dispatch</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {!isPendingApproval ? (
              <button
                onClick={() => setShowPlanModal(true)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-extrabold bg-[#3A7D7C] hover:bg-[#2F6665] text-white transition-all shadow-md shadow-[#3A7D7C]/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isRejected ? 'Submit New Plan Request' : isNoSub ? 'Select & Activate Plan' : 'Renew Plan Now'}</span>
              </button>
            ) : null}
            <button
              onClick={() => {
                if (onRenewed) onRenewed();
                window.location.reload();
              }}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-bold text-[#1F2937] hover:bg-slate-100 border border-[#D7E5E8] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Check Approval Status</span>
            </button>
          </div>
        </div>
      </div>

      <PlanSelectorModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSuccess={() => {
          if (onRenewed) onRenewed();
        }}
        currentPlanId={subscription?.plan_id}
      />
    </>
  );
}
