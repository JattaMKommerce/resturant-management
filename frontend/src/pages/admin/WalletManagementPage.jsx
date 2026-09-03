import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import {
  Gift, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2, Clock, 
  RotateCcw, DollarSign, Settings, Search, RefreshCw, Layers, ArrowUpRight,
  Receipt, User, Check, Zap, Sliders, X
} from 'lucide-react';

export default function WalletManagementPage() {
  const { slug } = useParams();
  const { restaurant } = useAuth();
  const tenantId = restaurant?.id || 1;

  const [liability, setLiability] = useState(null);
  const [campaign, setCampaign] = useState({
    campaignName: 'Kratu Rewards 10% Welcome Cashback',
    rewardType: 'PERCENTAGE',
    rewardValue: 10,
    maxCashbackPerOrder: 100,
    minOrderAmount: 250,
    maxRedemptionPercentage: 50,
    expiryDays: 30,
    campaignBudget: 25000,
    isActive: true
  });
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
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
          campaignName: c.campaign_name,
          rewardType: c.reward_type,
          rewardValue: parseFloat(c.reward_value),
          maxCashbackPerOrder: parseFloat(c.max_cashback_per_order),
          minOrderAmount: parseFloat(c.min_order_amount),
          maxRedemptionPercentage: parseFloat(c.max_redemption_percentage),
          expiryDays: parseInt(c.expiry_days),
          campaignBudget: parseFloat(c.campaign_budget),
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
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Campaign Rules Engine (Slide 11)</h3>
                  <p className="text-xs text-slate-500">Controls economics, liability caps, and expiry terms</p>
                </div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${campaign.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {campaign.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reward Percentage (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campaign.isActive}
                    onChange={(e) => setCampaign({ ...campaign, isActive: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">Campaign Active on Customer Storefront</span>
                </label>

                <button
                  type="submit"
                  disabled={savingCampaign}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{savingCampaign ? 'Saving...' : 'Save & Publish Rules'}</span>
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
                        ) : customerSearchQuery.trim().length >= 2 ? (
                          <div className="p-2 space-y-1">
                            <p className="px-2 py-1 text-[11px] text-slate-400 italic">No existing customer found</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCustomer({
                                  customer_name: customerSearchQuery.trim(),
                                  customer_phone: customerSearchQuery.trim(),
                                  available_rewards: 0
                                });
                                setIsSearchOpen(false);
                              }}
                              className="w-full p-2.5 text-left bg-emerald-50 hover:bg-emerald-100 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <span>➕ Gift rewards to: <strong>"{customerSearchQuery.trim()}"</strong></span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-400 italic">
                            {searchingCustomers ? 'Searching...' : 'Type a name or phone number to search'}
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
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-800 tracking-wider">
                          {row.event_type}
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

      </div>
    </AdminLayout>
  );
}
