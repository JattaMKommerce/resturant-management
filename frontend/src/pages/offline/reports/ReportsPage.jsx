import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import Modal from '../../../components/common/Modal';
import {
  BarChart3, Calendar, RefreshCw, DollarSign, ShoppingBag, Clock, Award, Filter,
  Download, FileSpreadsheet, AlertTriangle, Brain, TrendingUp, TrendingDown,
  Trash2, Zap, Utensils, ShieldAlert, Sparkles, ChevronRight, Layers, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [salesData, setSalesData] = useState([]);
  const [kotReport, setKotReport] = useState(null);
  const [menuReport, setMenuReport] = useState([]);
  const [expiryReport, setExpiryReport] = useState([]);
  const [expiryFilter, setExpiryFilter] = useState('ALL');

  // Intelligence State
  const [intelligencePeriod, setIntelligencePeriod] = useState('30d');
  const [customIntelStart, setCustomIntelStart] = useState('');
  const [customIntelEnd, setCustomIntelEnd] = useState('');
  const [intelligenceData, setIntelligenceData] = useState(null);
  const [selectedTrendItem, setSelectedTrendItem] = useState('');
  const [loading, setLoading] = useState(true);

  // Drilldown Modals
  const [drillModalType, setDrillModalType] = useState(null); // 'BOM', 'WASTAGE', 'DEPLETION', 'CONSUMPTION'

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const intelParams = { period: intelligencePeriod };
      if (intelligencePeriod === 'custom') {
        if (customIntelStart) intelParams.startDate = customIntelStart;
        if (customIntelEnd) intelParams.endDate = customIntelEnd;
      }
      if (selectedTrendItem) intelParams.item_id = selectedTrendItem;

      const [salesRes, kotRes, menuRes, expRes, intelRes] = await Promise.all([
        api.get('/reports/sales', { params }),
        api.get('/reports/kot'),
        api.get('/reports/menu'),
        api.get('/reports/expiry', { params: { status: expiryFilter } }),
        api.get('/inventory/intelligence', { params: intelParams })
      ]);

      if (salesRes.success) setSalesData(salesRes.data);
      if (kotRes.success) setKotReport(kotRes.data);
      if (menuRes.success) setMenuReport(menuRes.data);
      if (expRes.success) setExpiryReport(expRes.data);
      if (intelRes.success) setIntelligenceData(intelRes.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate, expiryFilter, intelligencePeriod, customIntelStart, customIntelEnd, selectedTrendItem]);

  const totalRevenueSum = salesData.reduce((sum, d) => sum + parseFloat(d.total_revenue || 0), 0);
  const totalOrdersSum = salesData.reduce((sum, d) => sum + parseInt(d.total_orders || 0), 0);

  const exportExpiryCSV = () => {
    if (!expiryReport || expiryReport.length === 0) {
      alert('No expiry data available to export');
      return;
    }
    const headers = ['Batch Number', 'Item Name', 'Category', 'Quantity', 'Unit', 'Unit Price', 'Est Value (₹)', 'Supplier', 'Purchase Date', 'Expiry Date', 'Days Remaining', 'Status'];
    const rows = expiryReport.map(r => [
      `"${r.batch_number || ''}"`,
      `"${r.item_name || ''}"`,
      `"${r.category_name || ''}"`,
      r.current_quantity,
      `"${r.unit || ''}"`,
      r.unit_price,
      r.estimated_value ? r.estimated_value.toFixed(2) : 0,
      `"${r.supplier || ''}"`,
      `"${r.purchase_date ? new Date(r.purchase_date).toLocaleDateString() : ''}"`,
      `"${r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : ''}"`,
      `"${r.days_text || r.days_remaining}"`,
      `"${r.status || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_expiry_report_${expiryFilter.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportIntelligenceCSV = () => {
    if (!intelligenceData) return;
    const lines = [];
    lines.push('INVENTORY INTELLIGENCE REPORT');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    lines.push('--- MAIN INTELLIGENCE METRICS ---');
    if (intelligenceData.most_consumed) {
      lines.push(`Most Consumed Item,${intelligenceData.most_consumed.item_name},${intelligenceData.most_consumed.quantity} ${intelligenceData.most_consumed.unit},${intelligenceData.most_consumed.change_text}`);
    }
    if (intelligenceData.highest_ingredient_cost) {
      lines.push(`Highest Recipe Cost,${intelligenceData.highest_ingredient_cost.menu_item_name},₹${intelligenceData.highest_ingredient_cost.total_cost}/serving`);
    }
    if (intelligenceData.highest_wastage) {
      lines.push(`Highest Wastage Item,${intelligenceData.highest_wastage.item_name},${intelligenceData.highest_wastage.quantity} ${intelligenceData.highest_wastage.unit},₹${intelligenceData.highest_wastage.value}`);
    }
    if (intelligenceData.fastest_depletion) {
      lines.push(`Fastest Depletion Item,${intelligenceData.fastest_depletion.item_name},${intelligenceData.fastest_depletion.usable_stock} ${intelligenceData.fastest_depletion.unit},~${intelligenceData.fastest_depletion.estimated_days_remaining} days remaining`);
    }
    lines.push('');

    lines.push('--- WASTAGE BY REASON ---');
    lines.push('Reason,Quantity,Value (₹)');
    if (intelligenceData.wastage_analytics && intelligenceData.wastage_analytics.by_reason) {
      intelligenceData.wastage_analytics.by_reason.forEach(r => {
        lines.push(`"${r.reason}",${r.quantity},${r.value}`);
      });
    }
    lines.push('');

    lines.push('--- PURCHASE COST TRENDS ---');
    lines.push('Item Name,Previous Price (₹),Current Price (₹),Change (%),Trend');
    if (intelligenceData.purchase_cost_trends) {
      intelligenceData.purchase_cost_trends.forEach(p => {
        lines.push(`"${p.item_name}",${p.previous_price},${p.current_price},${p.percentage_change}%,${p.trend}`);
      });
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_intelligence_report_${intelligencePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const intel = intelligenceData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-amber-500" />
            <span>Reports & Analytics</span>
          </h2>
          <p className="text-slate-400 text-sm">Comprehensive sales reports, KOT preparation times, inventory expiry audit, and menu performance</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-slate-500 ml-1" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchReports}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Sales Revenue</span>
            <DollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-white">₹{totalRevenueSum.toFixed(2)}</h3>
          <p className="text-xs text-slate-500 mt-1">{totalOrdersSum} Total Orders</p>
        </div>

        <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">Avg KOT Prep Time</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-white">
            {kotReport ? Math.round(parseFloat(kotReport.avg_prep_minutes) || 12) : 12} mins
          </h3>
          <p className="text-xs text-slate-500 mt-1">From order to ready</p>
        </div>

        <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">On-Time Performance</span>
            <Award className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-emerald-400">
            {kotReport ? `${kotReport.on_time_percentage}%` : '100%'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{kotReport ? `${kotReport.delayed_kots} Delayed KOTs` : '0 Delayed'}</p>
        </div>

        <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">Expiring Batches (30d)</span>
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-amber-400">{expiryReport.length}</h3>
          <p className="text-xs text-slate-500 mt-1">Active inventory audit</p>
        </div>
      </div>

      {/* Top Menu Items Breakdown Table */}
      <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top-Selling Menu Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Item Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Quantity Sold</th>
                <th className="px-6 py-4">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {menuReport.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No menu item sales recorded in this period.</td>
                </tr>
              ) : (
                menuReport.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{m.item_name}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{m.category_name}</td>
                    <td className="px-6 py-4 font-mono font-bold text-amber-400">{m.quantity_sold} portions</td>
                    <td className="px-6 py-4 font-bold text-emerald-400">₹{parseFloat(m.total_revenue).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expiry Management Report Section */}
      <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              <span>Inventory Stock Expiry Audit Report</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Filter by expiry threshold and export audit spreadsheet</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[
                { key: 'ALL', label: 'All Batches' },
                { key: 'EXPIRING_7', label: '7 Days' },
                { key: 'EXPIRING_30', label: '30 Days' },
                { key: 'EXPIRED', label: 'Expired' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setExpiryFilter(f.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    expiryFilter === f.key ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={exportExpiryCSV}
              className="py-2 px-3.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Batch Number</th>
                <th className="px-5 py-3.5">Item Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Current Stock</th>
                <th className="px-5 py-3.5">Expiry Date</th>
                <th className="px-5 py-3.5">Days Remaining</th>
                <th className="px-5 py-3.5">Supplier</th>
                <th className="px-5 py-3.5">Est Value</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {expiryReport.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-6 text-slate-500 text-xs">No inventory batches found for this report filter.</td>
                </tr>
              ) : (
                expiryReport.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30 transition-colors text-xs">
                    <td className="px-5 py-3.5 font-mono font-bold text-amber-400">{row.batch_number}</td>
                    <td className="px-5 py-3.5 font-bold text-white">{row.item_name}</td>
                    <td className="px-5 py-3.5 text-slate-400">{row.category_name}</td>
                    <td className="px-5 py-3.5 font-bold">{row.current_quantity} {row.unit}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-300">{new Date(row.expiry_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-amber-300">{row.days_text}</td>
                    <td className="px-5 py-3.5 text-slate-400">{row.supplier}</td>
                    <td className="px-5 py-3.5 font-bold text-emerald-400">₹{parseFloat(row.estimated_value || 0).toFixed(2)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                        row.status === 'EXPIRED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                        row.status === 'EXPIRING_7' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                        row.status === 'EXPIRING_30' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. 🧠 INVENTORY INTELLIGENCE SECTION (ADMIN FULL ACCESS) */}
      {/* ========================================================================= */}
      <div className="space-y-6 pt-6 border-t border-slate-800/80">
        {/* Section Header & Period Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
              <Brain className="w-7 h-7 text-amber-500" />
              <span>🧠 Inventory Intelligence</span>
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Smart insights from inventory, recipes, KOT consumption, wastage, expiry and stock movement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period selector */}
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              {[
                { key: 'today', label: 'Today' },
                { key: '7d', label: '7 Days' },
                { key: '30d', label: '30 Days' },
                { key: 'this_month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' },
                { key: 'custom', label: 'Custom' }
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setIntelligencePeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    intelligencePeriod === p.key ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {intelligencePeriod === 'custom' && (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-xs">
                <input
                  type="date"
                  value={customIntelStart}
                  onChange={e => setCustomIntelStart(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs focus:outline-none"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={customIntelEnd}
                  onChange={e => setCustomIntelEnd(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs focus:outline-none"
                />
              </div>
            )}

            <button
              onClick={exportIntelligenceCSV}
              className="py-2 px-3.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Intelligence CSV</span>
            </button>
          </div>
        </div>

        {/* 5. FOUR MAIN INTELLIGENCE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: 🥇 Most Consumed */}
          <div
            onClick={() => setDrillModalType('CONSUMPTION')}
            className="glass-panel bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-xl group relative"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>🥇 MOST CONSUMED</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </div>

            {intel?.most_consumed ? (
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">{intel.most_consumed.item_name}</h3>
                <div className="text-2xl font-black text-white mt-1">
                  {intel.most_consumed.quantity.toFixed(1)} <span className="text-xs font-normal text-slate-400">{intel.most_consumed.unit} consumed</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <TrendingUp className="w-3 h-3" />
                  <span>{intel.most_consumed.change_text}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mt-2">Not enough consumption data.</p>
            )}
          </div>

          {/* Card 2: 💰 Highest Ingredient Cost (BOM) */}
          <div
            onClick={() => setDrillModalType('BOM')}
            className="glass-panel bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-xl group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>💰 HIGHEST INGREDIENT COST</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </div>

            {intel?.highest_ingredient_cost ? (
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">{intel.highest_ingredient_cost.menu_item_name}</h3>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  ₹{intel.highest_ingredient_cost.total_cost.toFixed(2)} <span className="text-xs font-normal text-slate-400">/ serving</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Click to view recipe ingredient breakdown</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mt-2">No recipe BOM data configured.</p>
            )}
          </div>

          {/* Card 3: 🗑️ Highest Wastage */}
          <div
            onClick={() => setDrillModalType('WASTAGE')}
            className="glass-panel bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-xl group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>🗑️ HIGHEST WASTAGE</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
            </div>

            {intel?.highest_wastage ? (
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-rose-300 transition-colors">{intel.highest_wastage.item_name}</h3>
                <div className="text-2xl font-black text-rose-400 mt-1">
                  {intel.highest_wastage.quantity.toFixed(1)} <span className="text-xs font-normal text-slate-400">{intel.highest_wastage.unit} wasted</span>
                </div>
                <div className="text-xs font-bold text-slate-300 mt-2">
                  ₹{intel.highest_wastage.value.toFixed(2)} <span className="text-slate-500 font-normal">estimated wastage loss</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mt-2">No wastage recorded in this period.</p>
            )}
          </div>

          {/* Card 4: ⚡ Fastest Depletion */}
          <div
            onClick={() => setDrillModalType('DEPLETION')}
            className="glass-panel bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-xl group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡ FASTEST DEPLETION</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </div>

            {intel?.fastest_depletion ? (
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">{intel.fastest_depletion.item_name}</h3>
                <div className="text-2xl font-black text-white mt-1">
                  ~{intel.fastest_depletion.estimated_days_remaining} <span className="text-xs font-normal text-slate-400">days remaining</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>{intel.fastest_depletion.usable_stock} {intel.fastest_depletion.unit} usable</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    ⚠️ Reorder soon
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mt-2">Not enough consumption history to estimate.</p>
            )}
          </div>
        </div>

        {/* 6. 🧠 SMART INSIGHTS SECTION */}
        <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Smart Insights</span>
            </h3>
            <span className="text-xs text-slate-500">Auto-generated from database patterns</span>
          </div>

          {intel?.smart_insights && intel.smart_insights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {intel.smart_insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3 hover:border-slate-700 transition-colors"
                >
                  <span className="text-lg">{insight.icon}</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">{insight.title}</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{insight.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-3 text-center">Not enough data to generate smart insights for this period.</p>
          )}
        </div>

        {/* 8 & 9 & 10. CONSUMPTION TREND, WASTAGE & PURCHASE COST TRENDS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 8. 📊 Consumption Trend (2 Columns) */}
          <div className="lg:col-span-2 glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span>📊 Inventory Consumption Trend</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Daily recipe & KOT consumption over time</p>
              </div>

              {/* Item filter dropdown */}
              <select
                value={selectedTrendItem}
                onChange={e => setSelectedTrendItem(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="">All Raw Ingredients</option>
                {intel?.all_depletions && intel.all_depletions.map(d => (
                  <option key={d.item_id} value={d.item_id}>{d.item_name}</option>
                ))}
              </select>
            </div>

            {/* Consumption Bar Timeline Display */}
            {intel?.consumption_trend && intel.consumption_trend.length > 0 ? (
              <div className="space-y-2 pt-1 max-h-64 overflow-y-auto pr-1">
                {intel.consumption_trend.map((row, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400 text-[11px]">{new Date(row.date).toLocaleDateString()}</span>
                      <span className="font-bold text-white">{row.item_name}</span>
                    </div>
                    <div className="font-mono font-black text-amber-400">
                      {parseFloat(row.consumed).toFixed(2)} {row.unit}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic text-center py-8">No consumption recorded for the selected filter.</p>
            )}
          </div>

          {/* 9. 🗑️ Wastage Overview (Admin Only, 1 Column) */}
          <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>🗑️ Wastage Overview</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Admin-only loss breakdown by reason</p>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30">
              <span className="text-[10px] font-bold text-rose-400 uppercase">Total Wastage Loss</span>
              <div className="text-2xl font-black text-rose-300 mt-0.5">
                ₹{intel?.wastage_analytics?.total_value ? intel.wastage_analytics.total_value.toFixed(2) : '0.00'}
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Wastage by Reason</span>
              {intel?.wastage_analytics?.by_reason && intel.wastage_analytics.by_reason.length > 0 ? (
                intel.wastage_analytics.by_reason.map((r, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 uppercase text-[11px]">{r.reason}</span>
                    <span className="font-mono font-bold text-rose-400">₹{r.value.toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No wastage reported.</p>
              )}
            </div>
          </div>
        </div>

        {/* 10. 💰 PURCHASE COST TRENDS (ADMIN ONLY) */}
        <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>💰 Purchase Cost Trends</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Supplier price changes across inventory procurement batches</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Raw Ingredient</th>
                  <th className="p-3">Previous Price</th>
                  <th className="p-3">Current Price</th>
                  <th className="p-3">Price Change</th>
                  <th className="p-3">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {intel?.purchase_cost_trends && intel.purchase_cost_trends.length > 0 ? (
                  intel.purchase_cost_trends.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-bold text-white">{p.item_name}</td>
                      <td className="p-3 font-mono text-slate-400">₹{p.previous_price.toFixed(2)} / {p.unit}</td>
                      <td className="p-3 font-mono font-bold text-white">₹{p.current_price.toFixed(2)} / {p.unit}</td>
                      <td className="p-3 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                          p.percentage_change > 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {p.percentage_change > 0 ? `+${p.percentage_change}% ↑` : `${p.percentage_change}% ↓`}
                        </span>
                      </td>
                      <td className="p-3">
                        {p.trend === 'UP' ? (
                          <span className="text-rose-400 flex items-center gap-1 font-semibold text-[11px]">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Price Increased
                          </span>
                        ) : p.trend === 'DOWN' ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                            <ArrowDownRight className="w-3.5 h-3.5" /> Price Decreased
                          </span>
                        ) : (
                          <span className="text-slate-400">Stable</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-slate-500">Not enough batch price history to compute trends.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 14. CLICKABLE DRILL-DOWN MODALS */}
      {/* ========================================================================= */}
      {/* Modal 1: Recipe BOM Ingredient Cost Breakdown */}
      {drillModalType === 'BOM' && intel?.highest_ingredient_cost && (
        <Modal
          isOpen={true}
          onClose={() => setDrillModalType(null)}
          title={`Recipe BOM Cost Breakdown - ${intel.highest_ingredient_cost.menu_item_name}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Menu Category: </span>
                <span className="font-bold text-white">{intel.highest_ingredient_cost.category_name}</span>
              </div>
              <div>
                <span className="text-slate-400">Total Recipe Cost: </span>
                <span className="font-black text-emerald-400 text-base">₹{intel.highest_ingredient_cost.total_cost.toFixed(2)}</span>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Ingredient</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Unit Cost</th>
                    <th className="p-3 text-right">Cost Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {intel.highest_ingredient_cost.ingredients.map((ing, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-white">{ing.item_name}</td>
                      <td className="p-3 font-mono">{ing.quantity} {ing.unit}</td>
                      <td className="p-3 font-mono text-slate-400">₹{ing.unit_cost.toFixed(2)}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400 text-right">₹{ing.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setDrillModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: Wastage Analytics Drilldown */}
      {drillModalType === 'WASTAGE' && intel?.wastage_analytics && (
        <Modal
          isOpen={true}
          onClose={() => setDrillModalType(null)}
          title="Wastage Loss Analytics & Reasons"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-300">Total Wasted Items: </span>
                <span className="font-bold text-white">{intel.wastage_analytics.total_quantity.toFixed(1)} units</span>
              </div>
              <div>
                <span className="text-slate-300">Total Loss: </span>
                <span className="font-black text-rose-300 text-base">₹{intel.wastage_analytics.total_value.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase">Breakdown By Wastage Reason</h4>
              <div className="space-y-1.5">
                {intel.wastage_analytics.by_reason.map((r, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-white uppercase">{r.reason}</span>
                    <div className="text-right">
                      <div className="font-black text-rose-400">₹{r.value.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">{r.quantity.toFixed(1)} units</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setDrillModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 3: Depletion & Stock Run-Out Details */}
      {drillModalType === 'DEPLETION' && intel?.all_depletions && (
        <Modal
          isOpen={true}
          onClose={() => setDrillModalType(null)}
          title="Stock Depletion Rates & Estimated Days Remaining"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Estimated days remaining are calculated using actual usable non-expired inventory stock divided by recent average daily consumption rate.
            </p>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Usable Stock</th>
                    <th className="p-3">Daily Usage</th>
                    <th className="p-3">Days Left</th>
                    <th className="p-3">Alert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {intel.all_depletions.map((d, idx) => (
                    <tr key={idx} className={d.is_critical ? 'bg-amber-500/10' : 'hover:bg-slate-800/30'}>
                      <td className="p-3 font-bold text-white">{d.item_name}</td>
                      <td className="p-3 font-mono">{d.usable_stock} {d.unit}</td>
                      <td className="p-3 font-mono text-slate-400">{d.avg_daily_usage} {d.unit}/day</td>
                      <td className="p-3 font-mono font-black text-amber-300">~{d.estimated_days_remaining} days</td>
                      <td className="p-3">
                        {d.is_critical ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            Reorder Soon
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Adequate</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setDrillModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 4: Consumption Details */}
      {drillModalType === 'CONSUMPTION' && intel?.most_consumed && (
        <Modal
          isOpen={true}
          onClose={() => setDrillModalType(null)}
          title={`Consumption Details - ${intel.most_consumed.item_name}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Category: </span>
                <span className="font-bold text-white">{intel.most_consumed.category_name}</span>
              </div>
              <div>
                <span className="text-slate-400">Total Consumed: </span>
                <span className="font-black text-amber-400 text-base">{intel.most_consumed.quantity} {intel.most_consumed.unit}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
              📈 <strong>Growth Trend:</strong> {intel.most_consumed.change_text}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setDrillModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
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
