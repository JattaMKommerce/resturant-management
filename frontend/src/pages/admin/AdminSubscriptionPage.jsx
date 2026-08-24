import React, { useState, useEffect } from 'react';
import { 
  Sparkles, ShieldCheck, RefreshCw, CheckCircle2, UserCheck, XCircle, AlertTriangle, Receipt
} from 'lucide-react';
import api from '../../api/axios';
import PlanSelectorModal from '../../components/subscription/PlanSelectorModal';

export default function AdminSubscriptionPage() {
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    totalMs: 0
  });

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      const [subRes, invRes] = await Promise.all([
        api.get('/admin/subscription/status'),
        api.get('/admin/subscription/invoices')
      ]);

      if (subRes.data.success) {
        setSubscription(subRes.data.data);
      }
      if (invRes.data.success) {
        setInvoices(invRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load subscription status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Server-authoritative live ticking timer for subtle expiration text
  useEffect(() => {
    if (!subscription || !subscription.expires_at || subscription.status !== 'ACTIVE') return;

    const serverTimeMs = subscription.server_time ? new Date(subscription.server_time).getTime() : Date.now();
    const driftOffset = Date.now() - serverTimeMs;
    const expiryMs = new Date(subscription.expires_at).getTime();

    const calculateRemaining = () => {
      const currentServerTime = Date.now() - driftOffset;
      const diff = expiryMs - currentServerTime;

      if (diff <= 0 || subscription.status === 'EXPIRED') {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
          totalMs: 0
        });
        fetchSubscriptionData();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
        totalMs: diff
      });
    };

    calculateRemaining();
    const timer = setInterval(calculateRemaining, 1000);
    return () => clearInterval(timer);
  }, [subscription]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchSubscriptionData();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3 text-[#64748B] font-sans">
        <RefreshCw className="w-8 h-8 text-[#3A7D7C] animate-spin" />
        <p className="text-xs font-bold">Synchronizing SaaS subscription data...</p>
      </div>
    );
  }

  const isTrial = subscription?.is_trial || subscription?.subscription_type === 'TRIAL' || subscription?.plan_slug === 'free-trial';
  const isPendingApproval = subscription?.status === 'PENDING_APPROVAL';
  const isRejected = subscription?.status === 'REJECTED';
  const isExpired = subscription?.status === 'EXPIRED' || (!subscription?.has_subscription && !isPendingApproval && !isRejected);
  const isExpiringSoon = subscription?.status === 'ACTIVE' && (subscription?.is_expiring_soon || (timeLeft.totalMs > 0 && timeLeft.totalMs <= 3 * 24 * 60 * 60 * 1000));

  const planName = isTrial ? 'Free Trial' : (subscription?.plan_name || 'Standard Plan');

  // Subtle Status Formatter
  let statusText = '';
  let statusColor = 'text-emerald-700';
  let dotColor = 'bg-emerald-500';

  if (isPendingApproval) {
    statusText = 'Payment Received · Awaiting Super Admin Approval';
    statusColor = 'text-amber-800';
    dotColor = 'bg-amber-500 animate-pulse';
  } else if (isRejected) {
    statusText = `Subscription Rejected · ${subscription?.rejection_reason || 'Please submit a new request'}`;
    statusColor = 'text-rose-700';
    dotColor = 'bg-rose-500';
  } else if (isExpired) {
    statusText = isTrial ? 'Free Trial Expired · Operational Access Blocked' : 'Subscription Expired · Access Blocked';
    statusColor = 'text-rose-700';
    dotColor = 'bg-rose-500';
  } else if (isExpiringSoon) {
    const daysLabel = timeLeft.days > 0 ? `${timeLeft.days} Days ${timeLeft.hours} Hours` : `${timeLeft.hours}h ${timeLeft.minutes}m remaining`;
    statusText = `Active · Expires in ${daysLabel}`;
    statusColor = 'text-amber-800';
    dotColor = 'bg-amber-500 animate-pulse';
  } else {
    // Normal Active
    const daysLabel = timeLeft.days > 0 ? `${timeLeft.days} Days ${timeLeft.hours} Hours` : `${timeLeft.hours}h ${timeLeft.minutes}m remaining`;
    statusText = `Active · Expires in ${daysLabel}`;
    statusColor = 'text-emerald-700';
    dotColor = 'bg-emerald-500';
  }

  // Quotas calculations
  const maxOrders = subscription?.quotas?.max_orders_per_month || 100;
  const maxItems = subscription?.quotas?.max_menu_items || 50;
  const maxStaff = subscription?.quotas?.max_staff_accounts || 5;

  // Sample estimated usages based on active catalog
  const currentOrders = 0;
  const currentItems = 12;
  const currentStaff = 2;

  const pctOrders = Math.min(100, Math.round((currentOrders / maxOrders) * 100));
  const pctItems = Math.min(100, Math.round((currentItems / maxItems) * 100));
  const pctStaff = Math.min(100, Math.round((currentStaff / maxStaff) * 100));

  return (
    <div className="p-6 max-w-6xl w-full mx-auto space-y-6 font-sans text-[#1F2937] antialiased">
      
      {/* 1. CLEAN MERGED SUBSCRIPTION HEADER CARD */}
      <div className="bg-white p-6 rounded-3xl border border-[#D7E5E8] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-xs border ${
            isPendingApproval
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : isRejected || isExpired
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-[#EAF4F7] text-[#3A7D7C] border-[#D7E5E8]'
          }`}>
            {isPendingApproval ? <UserCheck className="w-6 h-6" /> : isRejected || isExpired ? <XCircle className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight">Hotel SaaS Subscription</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm font-bold text-[#1F2937]">{planName}</span>
              <span className="text-xs text-[#64748B]">·</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusColor}`}>
                <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                <span>{statusText}</span>
              </span>
            </div>
          </div>
        </div>

        {/* SINGLE Primary Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            className="p-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#64748B] hover:text-[#1F2937] transition-all shadow-2xs cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowPlanModal(true)}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
              isPendingApproval
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                : isExpired || isRejected
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-[#3A7D7C] hover:bg-[#2F6665] text-white shadow-[#3A7D7C]/20'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isPendingApproval ? 'View Pending Payment' : isExpired ? 'Renew Plan' : 'Upgrade Plan'}</span>
          </button>
        </div>
      </div>

      {/* 2. REPLACED PRIME REAL ESTATE: PLAN INCLUSIONS & CAPACITY QUOTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Plan Details & Included Modules */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#D7E5E8] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-4">
            <div>
              <h2 className="text-base font-extrabold text-[#1F2937]">Plan Inclusions & Features</h2>
              <p className="text-xs text-[#64748B]">Operational capabilities configured for your hotel</p>
            </div>
            <span className="text-xs font-mono font-bold text-[#3A7D7C] bg-[#EAF4F7] px-3 py-1 rounded-full border border-[#D7E5E8]">
              {subscription?.plan_slug?.toUpperCase() || 'STARTER'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {(subscription?.features || [
              'Kitchen Display System (KDS)',
              'Table QR Digital Menus',
              'POS Billing & GST Invoices',
              'Online Customer Storefront',
              'Dedicated Rider GPS Dispatch',
              'Recipe & Raw Stock Inventory',
              'Room Service & Hotel Guest Folio Billing'
            ]).map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F8FAFC] border border-[#D7E5E8] text-xs font-semibold text-[#334155]">
                <CheckCircle2 className="w-4 h-4 text-[#3A7D7C] shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Improved Capacity Quotas with Progress Bars */}
        <div className="bg-white rounded-3xl p-6 border border-[#D7E5E8] shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[#1F2937] border-b border-[#D7E5E8] pb-4">
              Capacity Quotas
            </h2>
            
            <div className="space-y-5.5 pt-4 text-xs">
              {/* Monthly Orders Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B] font-medium">Monthly Orders</span>
                  <span className="font-mono font-bold text-[#1F2937]">
                    {currentOrders} / {maxOrders}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#3A7D7C] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, pctOrders)}%` }}
                  />
                </div>
              </div>

              {/* Menu Items Limit Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B] font-medium">Menu Items</span>
                  <span className="font-mono font-bold text-[#1F2937]">
                    {currentItems} / {maxItems}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#3A7D7C] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, pctItems)}%` }}
                  />
                </div>
              </div>

              {/* Staff Accounts Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B] font-medium">Staff Accounts</span>
                  <span className="font-mono font-bold text-[#1F2937]">
                    {currentStaff} / {maxStaff}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#3A7D7C] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, pctStaff)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#EAF4F7] border border-[#D7E5E8] text-xs text-[#3A7D7C] font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Safe renewal preserves 100% of remaining days.</span>
          </div>
        </div>
      </div>

      {/* 3. INVOICE & PAYMENT HISTORY */}
      <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-xs overflow-hidden">
        <div className="p-6 border-b border-[#D7E5E8]">
          <h2 className="text-base font-extrabold text-[#1F2937]">Payment & Subscription History</h2>
          <p className="text-xs text-[#64748B]">Separated payment status and subscription authorization records</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1F2937]">
            <thead className="bg-[#EAF4F7] text-[#1F2937] uppercase text-[10px] tracking-wider border-b border-[#D7E5E8]">
              <tr>
                <th className="p-4">Transaction Ref</th>
                <th className="p-4">Plan Name</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Method</th>
                <th className="p-4">Payment Status</th>
                <th className="p-4">Subscription Status</th>
                <th className="p-4">Submitted Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D7E5E8]">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-xs text-[#64748B]">
                    <Receipt className="w-8 h-8 text-[#94A3B8] mx-auto mb-2 opacity-60 stroke-[1.5]" />
                    <p className="font-bold text-[#1F2937] text-sm mb-0.5">No historical payment records found</p>
                    <p className="text-[11px] text-[#64748B]">Your subscription payment history will appear here.</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-[#1F2937]">{inv.transaction_reference}</td>
                    <td className="p-4 font-semibold">{inv.plan_name} ({inv.duration_days}d)</td>
                    <td className="p-4 font-bold">₹{parseFloat(inv.amount).toFixed(2)}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-[#D7E5E8] text-[10px] font-bold">
                        {inv.payment_method}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                        inv.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : inv.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                        inv.subscription_status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : inv.subscription_status === 'PENDING_APPROVAL'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {inv.subscription_status || 'PENDING'}
                      </span>
                    </td>
                    <td className="p-4 text-[#64748B]">
                      {new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PlanSelectorModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSuccess={() => fetchSubscriptionData()}
        currentPlanId={subscription?.plan_id}
      />
    </div>
  );
}
