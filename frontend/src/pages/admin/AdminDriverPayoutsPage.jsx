import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  IndianRupee, DollarSign, Bike, AlertTriangle, CheckCircle2,
  Clock, Calendar, RefreshCw, Search, ArrowRight, UserCheck,
  Check, X, FileText, ChevronRight, Sparkles, Filter, Layers,
  CreditCard, Smartphone, Banknote, ShieldCheck, HelpCircle
} from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

export default function AdminDriverPayoutsPage() {
  const { slug } = useParams();

  const [drivers, setDrivers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'DUE' | 'SETTLED'
  const [schemeFilter, setSchemeFilter] = useState('ALL'); // 'ALL' | 'SALARY' | 'COMMISSION' | 'INCENTIVE'
  const [focusTarget, setFocusTarget] = useState(null);

  // Modal: Configure Compensation (Multi-Select)
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [hasSalary, setHasSalary] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryFrequency, setSalaryFrequency] = useState('MONTHLY');
  const [hasCommission, setHasCommission] = useState(false);
  const [commissionPct, setCommissionPct] = useState('');
  const [hasIncentive, setHasIncentive] = useState(false);
  const [incentiveAmt, setIncentiveAmt] = useState('');
  const [configNotes, setConfigNotes] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState('');
  const [configError, setConfigError] = useState('');

  // Modal: Settle Payout
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlingDriver, setSettlingDriver] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [settleReference, setSettleReference] = useState('');
  const [processingSettle, setProcessingSettle] = useState(false);
  const [settleSuccess, setSettleSuccess] = useState('');
  const [settleError, setSettleError] = useState('');

  // Drawer: History & Ledger with Date Filters
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyDriver, setHistoryDriver] = useState(null);
  const [historyLedger, setHistoryLedger] = useState([]);
  const [historySettlements, setHistorySettlements] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('TRANSACTIONS'); // 'TRANSACTIONS' | 'SETTLEMENTS'
  const [datePreset, setDatePreset] = useState('ALL'); // 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchPayoutsData();
  }, [slug]);

  const fetchPayoutsData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/driver-payouts', {
        params: { slug }
      });
      if (res.data.success) {
        setDrivers(res.data.drivers || []);
        setSummary(res.data.summary || null);
      }
    } catch (err) {
      console.error('Error loading driver payouts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open Configure Compensation Modal (optionally focusing Salary, Commission, or Incentive)
  const openConfigModal = (driver, targetOption = null) => {
    setSelectedDriver(driver);
    setHasSalary(targetOption === 'SALARY' ? true : (driver.settings?.has_salary || false));
    setSalaryAmount(driver.settings?.salary_amount || '');
    setSalaryFrequency(driver.settings?.salary_frequency || 'MONTHLY');
    setHasCommission(targetOption === 'COMMISSION' ? true : (driver.settings?.has_commission || false));
    setCommissionPct(driver.settings?.commission_percentage || '');
    setHasIncentive(targetOption === 'INCENTIVE' ? true : (driver.settings?.has_incentive || false));
    setIncentiveAmt(driver.settings?.incentive_amount || '');
    setFocusTarget(targetOption);
    setConfigNotes('');
    setConfigSuccess('');
    setConfigError('');
    setShowConfigModal(true);
  };

  // Save Compensation Settings
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;

    setSavingConfig(true);
    setConfigError('');
    setConfigSuccess('');

    try {
      const res = await api.post(`/admin/driver-payouts/${selectedDriver.id}/settings`, {
        has_salary: hasSalary,
        salary_amount: hasSalary ? parseFloat(salaryAmount || 0) : 0,
        salary_frequency: salaryFrequency,
        has_commission: hasCommission,
        commission_percentage: hasCommission ? parseFloat(commissionPct || 0) : 0,
        has_incentive: hasIncentive,
        incentive_amount: hasIncentive ? parseFloat(incentiveAmt || 0) : 0,
        incentive_type: 'PER_ORDER',
        notes: configNotes
      });

      if (res.data.success) {
        setConfigSuccess('🎉 Compensation model updated successfully!');
        await fetchPayoutsData();
        setTimeout(() => {
          setShowConfigModal(false);
        }, 1200);
      }
    } catch (err) {
      setConfigError(err.response?.data?.message || 'Failed to update compensation.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Open Settle Payout Modal
  const openSettleModal = (driver) => {
    setSettlingDriver(driver);
    setPaymentMethod('CASH');
    setSettleReference('');
    setSettleSuccess('');
    setSettleError('');
    setShowSettleModal(true);
  };

  // Execute Payout Settlement
  const handleConfirmSettle = async () => {
    if (!settlingDriver) return;

    setProcessingSettle(true);
    setSettleError('');
    setSettleSuccess('');

    try {
      const res = await api.post(`/admin/driver-payouts/${settlingDriver.id}/settle`, {
        payment_method: paymentMethod,
        reference_note: settleReference
      });

      if (res.data.success) {
        setSettleSuccess(`✅ ${res.data.message}`);
        await fetchPayoutsData();
        setTimeout(() => {
          setShowSettleModal(false);
        }, 1500);
      }
    } catch (err) {
      setSettleError(err.response?.data?.message || 'Failed to settle payout.');
    } finally {
      setProcessingSettle(false);
    }
  };

  // Open History Drawer
  const openHistoryDrawer = (driver) => {
    setHistoryDriver(driver);
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setHistoryTab('TRANSACTIONS');
    setShowHistoryDrawer(true);
    fetchHistoryData(driver.id, '', '');
  };

  const fetchHistoryData = async (driverId, start, end) => {
    setLoadingHistory(true);
    try {
      const params = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;

      const res = await api.get(`/admin/driver-payouts/${driverId}`, { params });
      if (res.data.success) {
        setHistoryLedger(res.data.transactions || []);
        setHistorySettlements(res.data.settlements || []);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle Preset Date Filter Change
  const handlePresetFilter = (preset) => {
    setDatePreset(preset);
    if (!historyDriver) return;

    let start = '';
    let end = '';
    const now = new Date();

    if (preset === 'TODAY') {
      start = now.toISOString().split('T')[0];
      end = start;
    } else if (preset === 'WEEK') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      start = weekAgo.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    } else if (preset === 'MONTH') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      start = monthStart.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    }

    setStartDate(start);
    setEndDate(end);
    fetchHistoryData(historyDriver.id, start, end);
  };

  const handleCustomDateSubmit = (e) => {
    e.preventDefault();
    if (!historyDriver) return;
    fetchHistoryData(historyDriver.id, startDate, endDate);
  };

  // Filter drivers for display
  const filteredDrivers = drivers.filter((drv) => {
    const term = search.toLowerCase();
    const matchSearch =
      drv.name.toLowerCase().includes(term) ||
      drv.phone.toLowerCase().includes(term) ||
      (drv.vehicle_number && drv.vehicle_number.toLowerCase().includes(term));

    if (!matchSearch) return false;

    if (filterTab === 'DUE') {
      if (!drv.wallet?.has_due) return false;
    } else if (filterTab === 'SETTLED') {
      if (drv.wallet?.has_due) return false;
    }

    if (schemeFilter === 'SALARY') {
      if (!drv.settings?.has_salary) return false;
    } else if (schemeFilter === 'COMMISSION') {
      if (!drv.settings?.has_commission) return false;
    } else if (schemeFilter === 'INCENTIVE') {
      if (!drv.settings?.has_incentive) return false;
    }

    return true;
  });

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-900">
        
        {/* Top Header Banner */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-6 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center shadow-md shadow-[#3A7D7C]/20">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Driver Money & Payouts
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure Salary, Commissions & Incentives per delivery partner, monitor wallet balances, and settle payouts.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchPayoutsData}
                disabled={loading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>
              <Link
                to={`/admin/${slug}/drivers`}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Bike className="w-3.5 h-3.5 text-[#3A7D7C]" />
                Manage Fleet
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">

          {/* ⚠️ ADMIN REMINDER BANNER: Highlights pending salary & payouts due */}
          {summary?.reminder_alert && (
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-white rounded-3xl p-5 sm:p-6 shadow-lg shadow-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 text-white">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white text-amber-900 font-black text-[10px] uppercase tracking-wider">
                      Payout Reminder Due
                    </span>
                    <span className="text-xs font-medium text-amber-100">
                      {summary.reminder_alert.count} Rider{summary.reminder_alert.count > 1 ? 's' : ''} Awaiting Payment
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight mt-0.5">
                    ₹{summary.reminder_alert.amount?.toLocaleString('en-IN')} Total Pending Delivery Boy Salary & Payout
                  </h3>
                  <p className="text-xs text-amber-50 font-medium mt-0.5">
                    Riders are notified to collect their payout from the hotel admin desk. Please review and settle pending dues.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setFilterTab('DUE')}
                className="px-5 py-3 bg-white hover:bg-amber-50 text-amber-900 font-black text-xs rounded-2xl shadow-md transition-all shrink-0 cursor-pointer self-start sm:self-center"
              >
                Review Due Riders ({summary.reminder_alert.count}) ↗
              </button>
            </div>
          )}

          {/* Executive Overview KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                  Total Pending Fleet Payout
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-amber-600">
                    ₹{summary?.total_fleet_pending_payout?.toLocaleString('en-IN') || 0}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-2">
                {summary?.drivers_with_due_payout || 0} riders awaiting disbursement
              </span>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                  Total Settled This Month
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                    ₹{summary?.total_paid_this_month?.toLocaleString('en-IN') || 0}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-emerald-600 font-bold block mt-2">
                ✓ Recorded in past settlements
              </span>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                  Active Delivery Fleet
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900">
                    {summary?.total_drivers || drivers.length}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">Riders</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-2">
                Provisioned for hotel deliveries
              </span>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                    Payout Setup Options
                  </span>
                  {schemeFilter !== 'ALL' && (
                    <button
                      onClick={() => setSchemeFilter('ALL')}
                      className="text-[10px] font-black text-[#3A7D7C] hover:underline cursor-pointer bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-lg border border-teal-100 transition-colors"
                    >
                      Reset ✕
                    </button>
                  )}
                </div>

                {/* 3 ACTIVE CLICKABLE BUTTONS FOR SALARY, COMMISSION, INCENTIVE - PERFECT 3-COL EQUAL GRID */}
                <div className="grid grid-cols-3 gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setSchemeFilter(schemeFilter === 'SALARY' ? 'ALL' : 'SALARY')}
                    className={`w-full py-2.5 px-1 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                      schemeFilter === 'SALARY'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/40'
                        : 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border-emerald-200/80'
                    }`}
                    title="Click to filter riders with Salary configured"
                  >
                    <Banknote className="w-4 h-4 shrink-0" />
                    <span className="text-[10.5px] font-extrabold tracking-tight whitespace-nowrap truncate max-w-full">
                      Salary {schemeFilter === 'SALARY' ? '✓' : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSchemeFilter(schemeFilter === 'COMMISSION' ? 'ALL' : 'COMMISSION')}
                    className={`w-full py-2.5 px-1 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                      schemeFilter === 'COMMISSION'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30 ring-2 ring-blue-400/40'
                        : 'bg-blue-50/80 hover:bg-blue-100 text-blue-800 border-blue-200/80'
                    }`}
                    title="Click to filter riders with Commission % configured"
                  >
                    <Layers className="w-4 h-4 shrink-0" />
                    <span className="text-[10.5px] font-extrabold tracking-tight whitespace-nowrap truncate max-w-full">
                      Commission {schemeFilter === 'COMMISSION' ? '✓' : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSchemeFilter(schemeFilter === 'INCENTIVE' ? 'ALL' : 'INCENTIVE')}
                    className={`w-full py-2.5 px-1 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                      schemeFilter === 'INCENTIVE'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/30 ring-2 ring-purple-400/40'
                        : 'bg-purple-50/80 hover:bg-purple-100 text-purple-800 border-purple-200/80'
                    }`}
                    title="Click to filter riders with Incentive configured"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span className="text-[10.5px] font-extrabold tracking-tight whitespace-nowrap truncate max-w-full">
                      Incentive {schemeFilter === 'INCENTIVE' ? '✓' : ''}
                    </span>
                  </button>
                </div>
              </div>

              <span className="text-[10px] text-slate-400 font-medium block mt-2 truncate">
                {schemeFilter === 'ALL'
                  ? 'Click any button to filter fleet'
                  : `Active filter: Showing ${schemeFilter.toLowerCase()} riders`}
              </span>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by rider name, mobile or vehicle plate..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3A7D7C]"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
              <button
                onClick={() => setFilterTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Riders ({drivers.length})
              </button>
              <button
                onClick={() => setFilterTab('DUE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'DUE'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                Pending Due ({drivers.filter((d) => d.wallet?.has_due).length})
              </button>
              <button
                onClick={() => setFilterTab('SETTLED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'SETTLED'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                Settled / ₹0 ({drivers.filter((d) => !d.wallet?.has_due).length})
              </button>
            </div>
          </div>

          {/* Drivers List */}
          {loading ? (
            <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 text-slate-400 space-y-3 shadow-xs">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#3A7D7C]" />
              <p className="text-sm font-bold text-slate-700">Loading delivery fleet compensation...</p>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 text-slate-400 space-y-3 shadow-xs">
              <Bike className="w-10 h-10 mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">No riders match the criteria</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No delivery partners found matching your search or filter tab.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Driver Profile */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[#EAF4F7] text-[#3A7D7C] font-black text-lg flex items-center justify-center shrink-0 border border-[#D7E5E8]">
                        <Bike className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-slate-900 text-base tracking-tight truncate">
                            {driver.name}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${
                            driver.availability_status === 'AVAILABLE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : driver.availability_status === 'BUSY'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {driver.availability_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5 flex-wrap">
                          <span>📞 {driver.phone || 'No Phone'}</span>
                          <span>•</span>
                          <span>🛵 {driver.vehicle_type} ({driver.vehicle_number || 'No Plate'})</span>
                          <span>•</span>
                          <span className="font-bold text-[#3A7D7C]">{driver.delivered_count} Delivered Orders</span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Wallet Due + Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0 self-start lg:self-center">
                      
                      {/* Collectible Balance Badge */}
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Current Collectible Balance
                        </span>
                        <span className={`text-xl sm:text-2xl font-black block ${
                          driver.wallet?.total_collectible > 0 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          ₹{driver.wallet?.total_collectible?.toLocaleString('en-IN') || '0'}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openConfigModal(driver)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                        >
                          <SettingsIcon className="w-3.5 h-3.5 text-slate-500" />
                          Configure Money
                        </button>

                        <button
                          onClick={() => openSettleModal(driver)}
                          disabled={!driver.wallet?.has_due}
                          className={`px-4 py-2 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs ${
                            driver.wallet?.has_due
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md shadow-emerald-600/20'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          }`}
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                          Pay & Settle
                        </button>

                        <button
                          onClick={() => openHistoryDrawer(driver)}
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          History
                        </button>
                      </div>

                    </div>

                  </div>

                  {/* Compensation Model Summary Strip */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    
                    {/* Active Scheme Badges - CLICKABLE BUTTONS TO CONFIGURE DIRECTLY */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Compensation:</span>
                      
                      <button
                        type="button"
                        onClick={() => openConfigModal(driver, 'SALARY')}
                        className={`px-2.5 py-1 rounded-xl font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer border ${
                          driver.settings?.has_salary
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-dashed border-slate-300'
                        }`}
                        title="Click to configure or adjust Fixed Salary"
                      >
                        <Banknote className={`w-3.5 h-3.5 ${driver.settings?.has_salary ? 'text-emerald-600' : 'text-slate-400'}`} />
                        {driver.settings?.has_salary
                          ? `Salary: ₹${driver.settings.salary_amount?.toLocaleString('en-IN')}/${driver.settings.salary_frequency?.toLowerCase()}`
                          : '+ Set Salary'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openConfigModal(driver, 'COMMISSION')}
                        className={`px-2.5 py-1 rounded-xl font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer border ${
                          driver.settings?.has_commission
                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200 shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-dashed border-slate-300'
                        }`}
                        title="Click to configure or adjust Parcel Commission %"
                      >
                        <Layers className={`w-3.5 h-3.5 ${driver.settings?.has_commission ? 'text-blue-600' : 'text-slate-400'}`} />
                        {driver.settings?.has_commission
                          ? `Commission: ${driver.settings.commission_percentage}% / parcel`
                          : '+ Set Commission %'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openConfigModal(driver, 'INCENTIVE')}
                        className={`px-2.5 py-1 rounded-xl font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer border ${
                          driver.settings?.has_incentive
                            ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200 shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-dashed border-slate-300'
                        }`}
                        title="Click to configure or adjust Delivery Incentive"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${driver.settings?.has_incentive ? 'text-purple-600' : 'text-slate-400'}`} />
                        {driver.settings?.has_incentive
                          ? `Incentive: ₹${driver.settings.incentive_amount} / order`
                          : '+ Set Incentive'}
                      </button>
                    </div>

                    {/* Breakdown of Current Pending Balance */}
                    {driver.wallet?.total_collectible > 0 && (
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                        <span className="text-slate-400 font-normal">Pending breakdown:</span>
                        {driver.wallet.pending_salary > 0 && (
                          <span className="text-emerald-700 font-bold">₹{driver.wallet.pending_salary.toLocaleString('en-IN')} Sal</span>
                        )}
                        {driver.wallet.pending_commission > 0 && (
                          <span className="text-blue-700 font-bold">+ ₹{driver.wallet.pending_commission} Comm</span>
                        )}
                        {driver.wallet.pending_incentive > 0 && (
                          <span className="text-purple-700 font-bold">+ ₹{driver.wallet.pending_incentive} Inc</span>
                        )}
                      </div>
                    )}

                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* MODAL 1: CONFIGURE COMPENSATION (Multi-Select: Salary, Commission, Incentive) */}
        {/* ========================================================================= */}
        {showConfigModal && selectedDriver && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold shadow-md shadow-[#3A7D7C]/20">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      Configure Driver Money: {selectedDriver.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Multi-select any combination: Fixed Salary, Parcel Commission, and Delivery Incentive.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {configSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {configSuccess}
                </div>
              )}

              {configError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {configError}
                </div>
              )}

              <form onSubmit={handleSaveConfig} className="space-y-4">
                
                {/* OPTION 1: FIXED SALARY */}
                <div className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                  hasSalary ? 'bg-emerald-50/50 border-emerald-400' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hasSalary}
                        onChange={(e) => setHasSalary(e.target.checked)}
                        className="w-5 h-5 rounded-lg text-emerald-600 border-slate-300 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-sm font-black text-slate-900 block flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-emerald-600" /> 1. Fixed Salary
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Assign a recurring fixed base salary to the rider
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      hasSalary ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {hasSalary ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </label>

                  {hasSalary && (
                    <div className="pt-2 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Salary Amount (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            required={hasSalary}
                            placeholder="e.g. 15000"
                            value={salaryAmount}
                            onChange={(e) => setSalaryAmount(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Frequency
                        </label>
                        <select
                          value={salaryFrequency}
                          onChange={(e) => setSalaryFrequency(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="WEEKLY">Weekly</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* OPTION 2: PARCEL DELIVERY COMMISSION */}
                <div className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                  hasCommission ? 'bg-blue-50/50 border-blue-400' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hasCommission}
                        onChange={(e) => setHasCommission(e.target.checked)}
                        className="w-5 h-5 rounded-lg text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-black text-slate-900 block flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-blue-600" /> 2. Parcel Delivery Commission (%)
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Percentage commission calculated automatically on every delivered parcel
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      hasCommission ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {hasCommission ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </label>

                  {hasCommission && (
                    <div className="pt-2 border-t border-blue-200/60">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Commission Percentage per Delivered Order (%)
                      </label>
                      <div className="relative max-w-xs">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          required={hasCommission}
                          placeholder="e.g. 5 or 10"
                          value={commissionPct}
                          onChange={(e) => setCommissionPct(e.target.value)}
                          className="w-full pr-8 pl-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">%</span>
                      </div>
                      <p className="text-[11px] text-blue-700 font-medium mt-1">
                        💡 Example: On a ₹500 delivered order, rider earns ₹{((500 * (parseFloat(commissionPct) || 0)) / 100).toFixed(0)}.
                      </p>
                    </div>
                  )}
                </div>

                {/* OPTION 3: DELIVERY INCENTIVE */}
                <div className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                  hasIncentive ? 'bg-purple-50/50 border-purple-400' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hasIncentive}
                        onChange={(e) => setHasIncentive(e.target.checked)}
                        className="w-5 h-5 rounded-lg text-purple-600 border-slate-300 focus:ring-purple-500"
                      />
                      <div>
                        <span className="text-sm font-black text-slate-900 block flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-purple-600" /> 3. Delivery Incentive Bonus (₹)
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Fixed cash bonus credited to wallet on every completed delivery trip
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      hasIncentive ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {hasIncentive ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </label>

                  {hasIncentive && (
                    <div className="pt-2 border-t border-purple-200/60">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Bonus Amount per Completed Delivery (₹)
                      </label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          required={hasIncentive}
                          placeholder="e.g. 20 or 25"
                          value={incentiveAmt}
                          onChange={(e) => setIncentiveAmt(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] text-purple-700 font-medium mt-1">
                        💡 Rider gets ₹{parseFloat(incentiveAmt || 0)} extra for every successful delivery.
                      </p>
                    </div>
                  )}
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Agreement / Internal Admin Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g., Performance incentive effective from this month"
                    value={configNotes}
                    onChange={(e) => setConfigNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#3A7D7C] focus:outline-none"
                  />
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-6 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-black rounded-xl text-xs shadow-md shadow-[#3A7D7C]/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {savingConfig ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving Settings...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save Compensation Scheme
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: PAY & SETTLE DRIVER PAYOUT (Resets wallet to ₹0 & archives ledger) */}
        {/* ========================================================================= */}
        {showSettleModal && settlingDriver && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Settle Payout: {settlingDriver.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Disburse pending earnings and clear current wallet
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettleModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {settleSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {settleSuccess}
                </div>
              )}

              {settleError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {settleError}
                </div>
              )}

              {/* Itemized Payout Breakdown */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Itemized Payout Breakdown:
                </span>
                
                <div className="flex justify-between items-center text-slate-700">
                  <span>Accrued Base Salary:</span>
                  <span className="font-bold">₹{settlingDriver.wallet?.pending_salary?.toLocaleString('en-IN') || 0}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span>Delivered Parcels Commission:</span>
                  <span className="font-bold">₹{settlingDriver.wallet?.pending_commission?.toLocaleString('en-IN') || 0}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span>Delivery Incentives Bonus:</span>
                  <span className="font-bold">₹{settlingDriver.wallet?.pending_incentive?.toLocaleString('en-IN') || 0}</span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                  <span>Total Amount to Pay:</span>
                  <span className="text-emerald-700 text-lg">
                    ₹{settlingDriver.wallet?.total_collectible?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Disbursement Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'UPI'
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    UPI / QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'BANK_TRANSFER'
                        ? 'bg-purple-50 border-purple-400 text-purple-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    Bank NEFT
                  </button>
                </div>
              </div>

              {/* Reference note */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Reference / Cashier Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid in cash at reception desk"
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-medium">
                ⚡ <strong>Wallet Refresh Notice:</strong> Confirming this payment marks all current pending items as PAID. The driver's active wallet resets to ₹0 while past transaction history remains preserved.
              </div>

              {/* Modal Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSettle}
                  disabled={processingSettle}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {processingSettle ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Settling Payout...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Payment & Clear Wallet
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DRAWER / MODAL 3: DRIVER LEDGER & HISTORY (WITH DATE FILTERS)              */}
        {/* ========================================================================= */}
        {showHistoryDrawer && historyDriver && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-6 sm:p-8 flex flex-col space-y-5 overflow-y-auto">
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Ledger History: {historyDriver.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Complete log of salary accruals, parcel commissions, incentives, and settlements
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* DATE FILTERS BAR */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3 shrink-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-slate-400" /> Date Filters
                  </span>
                  
                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5">
                    {['ALL', 'TODAY', 'WEEK', 'MONTH'].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handlePresetFilter(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          datePreset === preset
                            ? 'bg-[#3A7D7C] text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {preset === 'ALL' ? 'All Time' : preset === 'TODAY' ? 'Today' : preset === 'WEEK' ? 'Last 7 Days' : 'This Month'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Date Range Picker */}
                <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setDatePreset('CUSTOM'); }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                    <span className="text-slate-400 text-xs font-bold">to</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setDatePreset('CUSTOM'); }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                  >
                    Apply
                  </button>
                </form>
              </div>

              {/* Tabs: Transactions Ledger vs Settlements */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-1 shrink-0">
                <button
                  onClick={() => setHistoryTab('TRANSACTIONS')}
                  className={`pb-2 px-3 text-xs font-black transition-all border-b-2 ${
                    historyTab === 'TRANSACTIONS'
                      ? 'border-[#3A7D7C] text-[#3A7D7C]'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Transactions Ledger ({historyLedger.length})
                </button>
                <button
                  onClick={() => setHistoryTab('SETTLEMENTS')}
                  className={`pb-2 px-3 text-xs font-black transition-all border-b-2 ${
                    historyTab === 'SETTLEMENTS'
                      ? 'border-[#3A7D7C] text-[#3A7D7C]'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Past Settlements Receipts ({historySettlements.length})
                </button>
              </div>

              {/* Content List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loadingHistory ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#3A7D7C]" />
                    <p className="text-xs font-bold">Filtering ledger records...</p>
                  </div>
                ) : historyTab === 'TRANSACTIONS' ? (
                  historyLedger.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-1">
                      <FileText className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs font-bold text-slate-700">No transactions recorded</p>
                      <p className="text-[11px] text-slate-400">Try selecting a broader date range filter.</p>
                    </div>
                  ) : (
                    historyLedger.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            tx.entry_type === 'CREDIT_SALARY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tx.entry_type === 'CREDIT_COMMISSION'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {tx.entry_type === 'CREDIT_SALARY' ? (
                              <Banknote className="w-4 h-4" />
                            ) : tx.entry_type === 'CREDIT_COMMISSION' ? (
                              <Layers className="w-4 h-4" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">
                              {tx.description}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(tx.created_at).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-slate-900 text-sm block">
                            +₹{parseFloat(tx.amount).toLocaleString('en-IN')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-block ${
                            tx.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {tx.status === 'PAID' ? '✓ Settled' : 'Due'}
                          </span>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  historySettlements.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-1">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs font-bold text-slate-700">No past payouts settled yet</p>
                      <p className="text-[11px] text-slate-400">When you settle pending earnings, disbursement receipts appear here.</p>
                    </div>
                  ) : (
                    historySettlements.map((settle) => (
                      <div
                        key={settle.id}
                        className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-slate-900 text-xs">
                            Receipt: {settle.settlement_number}
                          </span>
                          <span className="font-black text-emerald-700 text-sm">
                            ₹{parseFloat(settle.net_amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                          <span>Mode: <strong>{settle.payment_method}</strong></span>
                          <span>Settled: {new Date(settle.settled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        {settle.reference_note && (
                          <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-emerald-100">
                            Note: {settle.reference_note}
                          </p>
                        )}
                      </div>
                    ))
                  )
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}

function SettingsIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
