import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import {
  Gift, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2, Clock, 
  RotateCcw, DollarSign, Settings, Search, RefreshCw, Layers, ArrowUpRight,
  Receipt, User, Check, Zap, Sliders, X, Sparkles, Send, HelpCircle
} from 'lucide-react';

export default function WalletManagementPage() {
  const { slug } = useParams();
  const { restaurant } = useAuth();
  const tenantId = restaurant?.id || 1;

  const [liability, setLiability] = useState(null);
  const [campaign, setCampaign] = useState({
    campaignName: 'Kratu Rewards Up to ₹70 Welcome Lucky Draw',
    rewardType: 'UPTO_LUCKY', // 'UPTO_LUCKY' | 'PERCENTAGE' | 'FIXED'
    rewardValue: 10,
    uptoAmount: 70,
    minRewardAmount: 10,
    luckyRatio: 35, // 1-2 in 5 (~35%)
    maxCashbackPerOrder: 70,
    minOrderAmount: 250,
    maxRedemptionPercentage: 50,
    expiryDays: 30,
    campaignBudget: 25000,
    autoDistributeOnOrder: true,
    autoDistributeOnSignup: true,
    isActive: true
  });
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Automated Campaign Distribution Modal State
  const [showAutoDistributeModal, setShowAutoDistributeModal] = useState(false);
  const [autoDistributing, setAutoDistributing] = useState(false);
  const [autoDistributeResult, setAutoDistributeResult] = useState(null);
  const [autoDistributeLimit, setAutoDistributeLimit] = useState(25);
  
  // Invariant Audit State (Slide 15)
  const [auditResult, setAuditResult] = useState(null);
  const [auditing, setAuditing] = useState(false);

  // Manual Adjustment State (Slide 12)
  const [adjustData, setAdjustData] = useState({ customerId: '', customerPhone: '', amount: '', reason: '' });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustSuccess, setAdjustSuccess] = useState(null);

  // Smart Customer Search State
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    loadAllData();
  }, [tenantId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [liabRes, campRes, ledgRes] = await Promise.all([
        api.get(`/wallet/admin/liability?restaurantId=${tenantId}`),
        api.get(`/wallet/admin/campaigns?restaurantId=${tenantId}`),
        api.get(`/wallet/admin/ledger?restaurantId=${tenantId}${categoryFilter ? `&category=${categoryFilter}` : ''}`)
      ]);

      if (liabRes.data.success) setLiability(liabRes.data.data);
      if (campRes.data.success && campRes.data.data?.length > 0) {
        const c = campRes.data.data[0];
        setCampaign({
          campaignName: c.campaign_name || 'Kratu Rewards Up to ₹70 Welcome Lucky Draw',
          rewardType: c.reward_type || 'UPTO_LUCKY',
          rewardValue: parseFloat(c.reward_value) || 10,
          uptoAmount: parseFloat(c.upto_amount) || 70,
          minRewardAmount: parseFloat(c.min_reward_amount) || 10,
          luckyRatio: parseFloat(c.lucky_ratio) || 35,
          maxCashbackPerOrder: parseFloat(c.max_cashback_per_order) || 70,
          minOrderAmount: parseFloat(c.min_order_amount) || 250,
          maxRedemptionPercentage: parseFloat(c.max_redemption_percentage) || 50,
          expiryDays: parseInt(c.expiry_days) || 30,
          campaignBudget: parseFloat(c.campaign_budget) || 25000,
          autoDistributeOnOrder: c.auto_distribute_on_order !== undefined ? Boolean(c.auto_distribute_on_order) : true,
          autoDistributeOnSignup: c.auto_distribute_on_signup !== undefined ? Boolean(c.auto_distribute_on_signup) : true,
          isActive: Boolean(c.is_active)
        });
      }
      if (ledgRes.data.success) setLedger(ledgRes.data.data);
    } catch (err) {
      console.error('Failed to load wallet management data:', err);
    }
    setLoading(false);
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    setSavingCampaign(true);
    setSaveSuccess(false);
    try {
      await api.post('/wallet/admin/campaigns', {
        restaurantId: tenantId,
        ...campaign
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      loadAllData();
    } catch (err) {
      alert('Failed to save campaign rules: ' + (err.response?.data?.message || err.message));
    }
    setSavingCampaign(false);
  };

  const handleAutoDistribute = async () => {
    setAutoDistributing(true);
    setAutoDistributeResult(null);
    try {
      const res = await api.post('/wallet/admin/campaigns/auto-distribute', {
        restaurantId: tenantId,
        limit: autoDistributeLimit
      });
      if (res.data.success) {
        setAutoDistributeResult(res.data.data);
        loadAllData();
      }
    } catch (err) {
      alert('Auto-distribute failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setAutoDistributing(false);
    }
  };

  const handleRunAudit = async () => {
    setAuditing(true);
    try {
      const res = await api.get(`/wallet/admin/audit-invariants?restaurantId=${tenantId}`);
      if (res.data.success) setAuditResult(res.data.data);
    } catch (err) {
      alert('Audit check failed: ' + err.message);
    }
    setAuditing(false);
  };

  // Live search customers whenever query changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setSearchingCustomers(true);
        const res = await api.get(`/wallet/admin/customers/search?restaurantId=${tenantId}&q=${encodeURIComponent(customerSearchQuery)}`);
        if (res.data.success) {
          setCustomerSearchResults(res.data.data || []);
        }
      } catch (err) {
        console.error('Customer search error:', err);
      } finally {
        setSearchingCustomers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearchQuery, tenantId]);

  const handleManualAdjustment = async (e) => {
    e.preventDefault();
    const targetIdentifier = selectedCustomer?.customer_id || selectedCustomer?.customer_phone || customerSearchQuery.trim();
    if (!targetIdentifier || !adjustData.amount) {
      alert('Please select or enter a customer mobile number or name.');
      return;
    }
    setAdjusting(true);
    setAdjustSuccess(null);
    try {
      const res = await api.post('/wallet/admin/adjust', {
        restaurantId: tenantId,
        customerId: selectedCustomer?.customer_id || null,
        customerPhone: selectedCustomer?.customer_phone || (isNaN(targetIdentifier) || targetIdentifier.length >= 7 ? targetIdentifier : null),
        amount: parseFloat(adjustData.amount),
        reason: adjustData.reason
      });
      if (res.data.success) {
        setAdjustSuccess(`Successfully granted ₹${adjustData.amount} courtesy rewards to ${selectedCustomer?.customer_name || targetIdentifier}!`);
        setAdjustData({ customerId: '', customerPhone: '', amount: '', reason: '' });
        setSelectedCustomer(null);
        setCustomerSearchQuery('');
        loadAllData();
        setTimeout(() => setAdjustSuccess(null), 4000);
      }
    } catch (err) {
      alert('Failed adjustment: ' + (err.response?.data?.message || err.message));
    }
    setAdjusting(false);
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
        
        {/* Page Title & Status Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kratu Rewards & Double-Entry Wallet</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Fintech Architecture
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-tenant immutable ledger • Anti-fraud earn-redeem lock • FIFO lot expiry engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAudit}
              disabled={auditing}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
            >
              <ShieldCheck className={`w-4 h-4 text-emerald-600 ${auditing ? 'animate-spin' : ''}`} />
              <span>{auditing ? 'Verifying Ledger...' : 'Audit Invariants (Slide 15)'}</span>
            </button>
            <button
              onClick={loadAllData}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Slide 15 Audit Result Banner (if run) */}
        {auditResult && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 animate-in fade-in duration-200 ${auditResult.passed ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
            <div className="flex items-center gap-3">
              {auditResult.passed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              )}
              <div>
                <h4 className="font-extrabold text-sm">
                  {auditResult.passed ? 'Financial Integrity Invariants Verified (Slide 15)' : 'Ledger Invariant Discrepancy Alert!'}
                </h4>
                <p className="text-xs opacity-80 mt-0.5">
                  Total Materialized Active Lots: <span className="font-mono font-bold">₹{auditResult.totalActiveLots}</span> • Total Account Balances: <span className="font-mono font-bold">₹{auditResult.totalCachedAvailable}</span> • Discrepancy: <span className="font-mono font-bold">₹{auditResult.discrepancy}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setAuditResult(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Executive Metrics Cards (Slide 14: Owner Screens Expose Liability & Truths) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Outstanding Liability */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-emerald-400 transition-all">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Outstanding Liability</span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 font-mono mt-2">
              ₹{liability?.outstandingLiability?.toLocaleString('en-IN') || '0'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Active spendable credits ({liability?.activeLotsCount || 0} valid lots)
            </p>
          </div>

          {/* Pending Activation */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-amber-400 transition-all">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Activation</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 font-mono mt-2">
              ₹{liability?.pendingCashback?.toLocaleString('en-IN') || '0'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Unlocks when orders are delivered ({liability?.pendingLotsCount || 0} lots)
            </p>
          </div>

          {/* Total Redeemed */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-sky-400 transition-all">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Redeemed</span>
              <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 font-mono mt-2">
              ₹{liability?.totalRedeemed?.toLocaleString('en-IN') || '0'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Settlement benefits applied to completed orders
            </p>
          </div>

          {/* Expired Breakage */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-purple-400 transition-all">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Expired Breakage</span>
              <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
                <RotateCcw className="w-4 h-4" />
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 font-mono mt-2">
              ₹{liability?.totalBreakage?.toLocaleString('en-IN') || '0'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Extinguished merchant liability (unspent expired credits)
            </p>
          </div>

        </div>

        {/* 2-Column Grid: Campaign Rules (Slide 11) & Manual Courtesy Credit (Slide 12) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Campaign Economics & Limits Controller (Slide 11) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Campaign Rules Engine (Slide 11)</h3>
                  <p className="text-xs text-slate-500">Automated probability rewards & customer distribution engine</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAutoDistributeResult(null);
                    setShowAutoDistributeModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>⚡ 1-Click Auto-Distribute</span>
                </button>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${campaign.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {campaign.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-4">
              {/* Reward Engine Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Reward Distribution Model</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCampaign({ ...campaign, rewardType: 'UPTO_LUCKY' })}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${campaign.rewardType === 'UPTO_LUCKY'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-extrabold text-xs text-slate-900">Smart "Up To" Engine</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      1-2 in 5 get full amount; rest get up to cap. <strong>Zero manual effort.</strong>
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCampaign({ ...campaign, rewardType: 'PERCENTAGE' })}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${campaign.rewardType === 'PERCENTAGE'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-700" />
                      <span className="font-extrabold text-xs text-slate-900">Fixed Percentage</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      Flat percentage cashback (e.g. 10% of order value)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCampaign({ ...campaign, rewardType: 'FIXED' })}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${campaign.rewardType === 'FIXED'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Gift className="w-3.5 h-3.5 text-slate-700" />
                      <span className="font-extrabold text-xs text-slate-900">Flat Amount</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      Same exact fixed amount for every qualified order
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={campaign.campaignName}
                  onChange={(e) => setCampaign({ ...campaign, campaignName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Dynamic Engine Inputs */}
              {campaign.rewardType === 'UPTO_LUCKY' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Max Credit Amount (₹) <span className="text-emerald-600 font-black">"Up To"</span>
                      </label>
                      <input
                        type="number"
                        min="5"
                        value={campaign.uptoAmount || 70}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCampaign({ ...campaign, uptoAmount: val, maxCashbackPerOrder: val });
                        }}
                        className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50/30 font-mono text-sm font-black text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Top jackpot prize</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Guaranteed Min (₹)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={campaign.minRewardAmount || 10}
                        onChange={(e) => setCampaign({ ...campaign, minRewardAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Floor for non-jackpot</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Full Amount Odds
                      </label>
                      <div className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm font-black text-slate-800 flex items-center justify-between">
                        <span>1 to 2 in 5</span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">35% chance</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Automated lucky ratio</span>
                    </div>
                  </div>

                  {/* Visual Probability Rule Card */}
                  <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                      <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Automated Probability Distribution in Effect</span>
                    </div>
                    <div className="text-[11px] text-emerald-900/90 space-y-1">
                      <p>
                        • <strong>1 or 2 out of every 5 customers (~35%)</strong> automatically win the <strong>full ₹{campaign.uptoAmount || 70}</strong> credit amount.
                      </p>
                      <p>
                        • The remaining customers win a randomized reward between <strong>₹{campaign.minRewardAmount || 10} and ₹{(campaign.uptoAmount || 70) - 1}</strong>.
                      </p>
                      <p className="text-emerald-700 font-bold">
                        • <strong>Zero manual effort:</strong> The system automatically rolls this engine on qualifying orders without requiring manual courtesy adjustments!
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {campaign.rewardType === 'PERCENTAGE' ? 'Reward Percentage (%)' : 'Fixed Reward Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={campaign.rewardValue}
                      onChange={(e) => setCampaign({ ...campaign, rewardValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Max Cap / Order (₹)</label>
                    <input
                      type="number"
                      min="1"
                      value={campaign.maxCashbackPerOrder}
                      onChange={(e) => setCampaign({ ...campaign, maxCashbackPerOrder: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Thresholds & Economics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Order Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={campaign.minOrderAmount}
                    onChange={(e) => setCampaign({ ...campaign, minOrderAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Redemption (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={campaign.maxRedemptionPercentage}
                    onChange={(e) => setCampaign({ ...campaign, maxRedemptionPercentage: parseFloat(e.target.value) || 50 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={campaign.expiryDays}
                    onChange={(e) => setCampaign({ ...campaign, expiryDays: parseInt(e.target.value) || 30 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Campaign Budget (₹)</label>
                  <input
                    type="number"
                    min="1000"
                    value={campaign.campaignBudget}
                    onChange={(e) => setCampaign({ ...campaign, campaignBudget: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={campaign.isActive}
                      onChange={(e) => setCampaign({ ...campaign, isActive: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Campaign Active on Customer Storefront</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={campaign.autoDistributeOnOrder}
                      onChange={(e) => setCampaign({ ...campaign, autoDistributeOnOrder: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      Auto-roll rewards on qualifying orders (≥ ₹{campaign.minOrderAmount})
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingCampaign}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{savingCampaign ? 'Saving Rules...' : 'Save & Publish Rules'}</span>
                </button>
              </div>

              {saveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Kratu Rewards campaign rules updated & active!</span>
                </div>
              )}
            </form>
          </div>

          {/* Courtesy Staff Manual Adjustment (Slide 12) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Courtesy Adjustment</h3>
                <p className="text-xs text-slate-500">Staff credit with admin audit (Slide 12)</p>
              </div>
            </div>

            <form onSubmit={handleManualAdjustment} className="space-y-3.5">
              <div ref={searchContainerRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer (Name or Mobile Number)</label>
                
                {selectedCustomer ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        {selectedCustomer.customer_name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">{selectedCustomer.customer_name}</span>
                        <span className="text-[11px] text-slate-500 block font-mono">
                          {selectedCustomer.customer_phone || `ID #${selectedCustomer.customer_id}`} • Balance: ₹{selectedCustomer.available_rewards || 0}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearchQuery('');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Name or mobile number..."
                      value={customerSearchQuery}
                      onChange={(e) => {
                        setCustomerSearchQuery(e.target.value);
                        setIsSearchOpen(true);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />

                    {/* Live search dropdown */}
                    {isSearchOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {customerSearchResults.length > 0 ? (
                          customerSearchResults.map((cust, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(cust);
                                setCustomerSearchQuery(cust.customer_name || cust.customer_phone);
                                setIsSearchOpen(false);
                              }}
                              className="w-full p-2.5 text-left hover:bg-amber-50/70 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                            >
                              <div>
                                <span className="font-bold text-xs text-slate-800 block">{cust.customer_name}</span>
                                <span className="text-[11px] text-slate-500 font-mono block">
                                  {cust.customer_phone || `ID #${cust.customer_id}`}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                ₹{cust.available_rewards || 0} pts
                              </span>
                            </button>
                          ))
                        ) : customerSearchQuery.replace(/[^0-9]/g, '').length >= 7 ? (
                          <div className="p-2 space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                const cleanNum = customerSearchQuery.trim();
                                setSelectedCustomer({
                                  customer_name: `Customer (${cleanNum})`,
                                  customer_phone: cleanNum,
                                  available_rewards: 0
                                });
                                setIsSearchOpen(false);
                              }}
                              className="w-full p-2.5 text-left bg-emerald-50 hover:bg-emerald-100 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <span>➕ Gift rewards to mobile: <strong>"{customerSearchQuery.trim()}"</strong></span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-500">
                            {customerSearchQuery.trim().length >= 2 ? (
                              <span>No customer found. Please select from the list or enter a 10-digit mobile number.</span>
                            ) : (
                              <span className="text-slate-400 italic">Type a name or phone number to search</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Credit Amount (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 100"
                  value={adjustData.amount}
                  onChange={(e) => setAdjustData({ ...adjustData, amount: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Note</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Service delay courtesy or loyalty perk"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={adjusting}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{adjusting ? 'Granting...' : 'Grant Courtesy Rewards'}</span>
              </button>

              {adjustSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{adjustSuccess}</span>
                </div>
              )}
            </form>
          </div>

        </div>

        {/* Immutable Double-Entry Ledger Stream (Slide 08: Double-Entry Explains Every Rupee) */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Immutable Double-Entry Ledger Stream (Slide 08)</h3>
                <p className="text-xs text-slate-500">Every rupee has a debit and credit. Posted entries are never deleted.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white cursor-pointer focus:outline-none"
              >
                <option value="">All Categories</option>
                <option value="CUSTOMER_REWARD_BALANCE">Customer Reward Balance</option>
                <option value="MERCHANT_REWARD_LIABILITY">Merchant Reward Liability</option>
                <option value="ORDER_SETTLEMENT_BENEFIT">Order Settlement Benefit</option>
                <option value="EXPIRED_BREAKAGE">Expired Breakage</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3">Date / Time</th>
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3">Event Type</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Entry & Amount</th>
                  <th className="py-3 px-3">Actor</th>
                  <th className="py-3 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {ledger.length > 0 ? (
                  ledger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(row.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-slate-800">
                        {row.reference_id || `#${row.id}`}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${row.event_type === 'CAMPAIGN_AUTO_DROP'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-slate-100 text-slate-800'
                        }`}>
                          {row.event_type === 'CAMPAIGN_AUTO_DROP' ? '⚡ AUTO REWARD' : row.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-medium">
                        {row.account_category.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-bold">
                        <span className={row.entry_type === 'CREDIT' ? 'text-emerald-700' : 'text-slate-800'}>
                          {row.entry_type === 'CREDIT' ? '+ CR' : '- DR'} ₹{parseFloat(row.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-medium">
                        {row.actor}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={row.description}>
                        {row.description?.includes('Jackpot') && (
                          <span className="inline-block mr-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 font-extrabold rounded text-[9px] border border-amber-300">
                            ⭐ JACKPOT
                          </span>
                        )}
                        {row.description}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400 italic">
                      No ledger transactions recorded yet. Transactions will appear as customers earn and redeem rewards.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Automated Campaign Airdrop Modal */}
        {showAutoDistributeModal && (
          <div
            onClick={() => setShowAutoDistributeModal(false)}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 font-black">
                    <Sparkles className="w-5 h-5 text-amber-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Automated Campaign Airdrop
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Zero manual work: automated 1-2 in 5 full reward engine
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAutoDistributeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!autoDistributeResult ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-slate-50 border border-emerald-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                        Target Promotion Cap
                      </span>
                      <span className="text-sm font-black text-emerald-950">
                        Up to ₹{campaign.uptoAmount || 70}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                      <p className="flex items-center gap-1.5 font-bold text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        1 to 2 out of every 5 customers will win full ₹{campaign.uptoAmount || 70}
                      </p>
                      <p className="flex items-center gap-1.5 text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                        Remaining customers receive random amount between ₹{campaign.minRewardAmount || 10} and ₹{(campaign.uptoAmount || 70) - 1}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Batch Audience Size
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 25, 50, 100].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAutoDistributeLimit(num)}
                          className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${autoDistributeLimit === num
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {num} Diners
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Estimated Full Jackpot Winners (~35%):</span>
                      <strong className="text-slate-900">{Math.round(autoDistributeLimit * 0.35)} customers</strong>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Estimated Up-To Winners (~65%):</span>
                      <strong className="text-slate-900">{autoDistributeLimit - Math.round(autoDistributeLimit * 0.35)} customers</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-emerald-800">
                      <span>Estimated Campaign Burn:</span>
                      <span>~₹{Math.round(autoDistributeLimit * ((campaign.uptoAmount || 70) * 0.65))}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAutoDistributeModal(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={autoDistributing}
                      onClick={handleAutoDistribute}
                      className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      <span>{autoDistributing ? 'Disbursing Rewards...' : `Airdrop to ${autoDistributeLimit} Diners`}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Results celebration */
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-xl font-black">
                      🎉
                    </div>
                    <h4 className="font-black text-sm text-emerald-950">
                      Campaign Rewards Successfully Distributed!
                    </h4>
                    <p className="text-xs text-emerald-800">
                      Total credited: <strong>₹{autoDistributeResult.totalDistributed}</strong> across <strong>{autoDistributeResult.totalRewarded} customers</strong>.
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/80 text-xs font-bold text-left">
                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-500 block uppercase">⭐ Full ₹{autoDistributeResult.uptoCap} Jackpot</span>
                        <span className="text-emerald-700 font-black text-base">{autoDistributeResult.luckyCount} Winners</span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-slate-500 block uppercase">🎁 Up to ₹{autoDistributeResult.uptoCap} Winners</span>
                        <span className="text-teal-700 font-black text-base">{autoDistributeResult.upToCount} Customers</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer list sample */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
                    {autoDistributeResult.results?.map((cust, idx) => (
                      <div key={idx} className="pt-1.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800 block">{cust.customerName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{cust.customerPhone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {cust.isLucky && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                              JACKPOT
                            </span>
                          )}
                          <span className="font-mono font-black text-emerald-700">
                            +₹{cust.amount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAutoDistributeModal(false)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Done & View Ledger
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
