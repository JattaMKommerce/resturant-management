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
    <div className="space-y-6 antialiased font-sans">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#3A7D7C]" />
            <span>Reports & Analytics</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Comprehensive sales reports, KOT preparation times, inventory audit, and intelligence</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-[#D7E5E8] p-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-[#64748B] ml-1" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-[#D7E5E8] text-[#1F2937] rounded px-2 py-1 focus:outline-none"
            />
            <span className="text-[#64748B]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-[#D7E5E8] text-[#1F2937] rounded px-2 py-1 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchReports}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors shadow-2xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase">Total Sales Revenue</span>
            <DollarSign className="w-5 h-5 text-[#3A7D7C]" />
          </div>
          <h3 className="text-2xl font-black text-[#1F2937]">₹{totalRevenueSum.toFixed(2)}</h3>
          <p className="text-xs text-[#64748B] mt-1">{totalOrdersSum} Total Orders</p>
        </div>

        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase">Avg KOT Prep Time</span>
            <Clock className="w-5 h-5 text-[#3A7D7C]" />
          </div>
          <h3 className="text-2xl font-black text-[#1F2937]">
            {kotReport ? Math.round(parseFloat(kotReport.avg_prep_minutes) || 12) : 12} mins
          </h3>
          <p className="text-xs text-[#64748B] mt-1">From order to ready</p>
        </div>

        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase">On-Time Performance</span>
            <Award className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-emerald-700">
            {kotReport ? `${kotReport.on_time_percentage}%` : '100%'}
          </h3>
          <p className="text-xs text-[#64748B] mt-1">{kotReport ? `${kotReport.delayed_kots} Delayed KOTs` : '0 Delayed'}</p>
        </div>

        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase">Expiring Batches (30d)</span>
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-2xl font-black text-amber-800">{expiryReport.length}</h3>
          <p className="text-xs text-[#64748B] mt-1">Active inventory audit</p>
        </div>
      </div>

      {/* Top Menu Items Breakdown Table */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#D7E5E8] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider">Top-Selling Menu Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1F2937]">
            <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
              <tr>
                <th className="px-6 py-4">Item Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Quantity Sold</th>
                <th className="px-6 py-4">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D7E5E8]">
              {menuReport.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-[#64748B]">No menu item sales recorded in this period.</td>
                </tr>
              ) : (
                menuReport.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#1F2937]">{m.item_name}</td>
                    <td className="px-6 py-4 text-[#64748B] text-xs">{m.category_name}</td>
                    <td className="px-6 py-4 font-mono font-bold text-[#3A7D7C]">{m.quantity_sold} portions</td>
                    <td className="px-6 py-4 font-bold text-emerald-800">₹{parseFloat(m.total_revenue).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expiry Management Report Section */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-[#D7E5E8]">
          <div>
            <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#3A7D7C]" />
              <span>Inventory Stock Expiry Audit Report</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">Filter by expiry threshold and export audit spreadsheet</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-[#D7E5E8]">
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
                    expiryFilter === f.key ? 'bg-[#3A7D7C] text-white shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={exportExpiryCSV}
              className="py-2 px-3.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1F2937]">
            <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
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
            <tbody className="divide-y divide-[#D7E5E8]">
              {expiryReport.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-6 text-[#64748B] text-xs">No inventory batches found for this report filter.</td>
                </tr>
              ) : (
                expiryReport.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors text-xs">
                    <td className="px-5 py-3.5 font-mono font-bold text-[#3A7D7C]">{row.batch_number}</td>
                    <td className="px-5 py-3.5 font-bold text-[#1F2937]">{row.item_name}</td>
                    <td className="px-5 py-3.5 text-[#64748B]">{row.category_name}</td>
                    <td className="px-5 py-3.5 font-bold">{row.current_quantity} {row.unit}</td>
                    <td className="px-5 py-3.5 font-mono text-[#64748B]">{new Date(row.expiry_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-amber-800">{row.days_text}</td>
                    <td className="px-5 py-3.5 text-[#64748B]">{row.supplier}</td>
                    <td className="px-5 py-3.5 font-bold text-emerald-800">₹{parseFloat(row.estimated_value || 0).toFixed(2)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.status === 'EXPIRED' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                        row.status === 'EXPIRING_7' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        row.status === 'EXPIRING_30' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-emerald-50 text-emerald-800 border-emerald-200'
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

      {/* 4. 🧠 INVENTORY INTELLIGENCE SECTION */}
      <div className="space-y-6 pt-6 border-t border-[#D7E5E8]">
        {/* Section Header & Period Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2.5">
              <Brain className="w-6 h-6 text-[#3A7D7C]" />
              <span>Inventory Intelligence</span>
            </h2>
            <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">
              Smart insights from inventory, recipes, KOT consumption, wastage, and stock movement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period selector */}
            <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-[#D7E5E8] text-xs font-bold">
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
                    intelligencePeriod === p.key ? 'bg-[#3A7D7C] text-white font-bold shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {intelligencePeriod === 'custom' && (
              <div className="flex items-center gap-2 bg-slate-50 border border-[#D7E5E8] p-1.5 rounded-xl text-xs">
                <input
                  type="date"
                  value={customIntelStart}
                  onChange={e => setCustomIntelStart(e.target.value)}
                  className="bg-white border border-[#D7E5E8] text-[#1F2937] rounded px-2 py-1 text-xs focus:outline-none"
                />
                <span className="text-[#64748B]">to</span>
                <input
                  type="date"
                  value={customIntelEnd}
                  onChange={e => setCustomIntelEnd(e.target.value)}
                  className="bg-white border border-[#D7E5E8] text-[#1F2937] rounded px-2 py-1 text-xs focus:outline-none"
                />
              </div>
            )}

            <button
              onClick={exportIntelligenceCSV}
              className="py-2 px-3.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Intelligence CSV</span>
            </button>
          </div>
        </div>

        {/* FOUR MAIN INTELLIGENCE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Most Consumed */}
          <div
            onClick={() => setDrillModalType('CONSUMPTION')}
            className="bg-white hover:border-[#3A7D7C] border border-[#D7E5E8] rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-xs group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#3A7D7C] uppercase tracking-wider flex items-center gap-1.5">
                <span>🥇 MOST CONSUMED</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#64748B] group-hover:text-[#3A7D7C] transition-colors" />
            </div>

            {intel?.most_consumed ? (
              <div>
                <h3 className="text-lg font-bold text-[#1F2937] group-hover:text-[#3A7D7C] transition-colors">{intel.most_consumed.item_name}</h3>
                <div className="text-2xl font-black text-[#1F2937] mt-1">
                  {intel.most_consumed.quantity.toFixed(1)} <span className="text-xs font-normal text-[#64748B]">{intel.most_consumed.unit} consumed</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <TrendingUp className="w-3 h-3" />
                  <span>{intel.most_consumed.change_text}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] italic mt-2">Not enough consumption data.</p>
            )}
          </div>

          {/* Card 2: Highest Ingredient Cost */}
          <div
            onClick={() => setDrillModalType('BOM')}
            className="bg-white hover:border-[#3A7D7C] border border-[#D7E5E8] rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-xs group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#3A7D7C] uppercase tracking-wider flex items-center gap-1.5">
                <span>💰 HIGHEST INGREDIENT COST</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#64748B] group-hover:text-[#3A7D7C] transition-colors" />
            </div>

            {intel?.highest_ingredient_cost ? (
              <div>
                <h3 className="text-lg font-bold text-[#1F2937] group-hover:text-[#3A7D7C] transition-colors">{intel.highest_ingredient_cost.menu_item_name}</h3>
                <div className="text-2xl font-black text-emerald-800 mt-1">
                  ₹{intel.highest_ingredient_cost.total_cost.toFixed(2)} <span className="text-xs font-normal text-[#64748B]">/ serving</span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-2">Click to view recipe ingredient breakdown</p>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] italic mt-2">No recipe BOM data configured.</p>
            )}
          </div>

          {/* Card 3: Highest Wastage */}
          <div
            onClick={() => setDrillModalType('WASTAGE')}
            className="bg-white hover:border-rose-300 border border-[#D7E5E8] rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-xs group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>🗑️ HIGHEST WASTAGE</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#64748B] group-hover:text-rose-600 transition-colors" />
            </div>

            {intel?.highest_wastage ? (
              <div>
                <h3 className="text-lg font-bold text-[#1F2937] group-hover:text-rose-700 transition-colors">{intel.highest_wastage.item_name}</h3>
                <div className="text-2xl font-black text-rose-700 mt-1">
                  {intel.highest_wastage.quantity.toFixed(1)} <span className="text-xs font-normal text-[#64748B]">{intel.highest_wastage.unit} wasted</span>
                </div>
                <div className="text-xs font-bold text-[#64748B] mt-2">
                  ₹{intel.highest_wastage.value.toFixed(2)} <span className="text-[#64748B] font-normal">estimated loss</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] italic mt-2">No wastage recorded in this period.</p>
            )}
          </div>

          {/* Card 4: Fastest Depletion */}
          <div
            onClick={() => setDrillModalType('DEPLETION')}
            className="bg-white hover:border-[#3A7D7C] border border-[#D7E5E8] rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-xs group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡ FASTEST DEPLETION</span>
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#64748B] group-hover:text-amber-600 transition-colors" />
            </div>

            {intel?.fastest_depletion ? (
              <div>
                <h3 className="text-lg font-bold text-[#1F2937] group-hover:text-amber-800 transition-colors">{intel.fastest_depletion.item_name}</h3>
                <div className="text-2xl font-black text-[#1F2937] mt-1">
                  ~{intel.fastest_depletion.estimated_days_remaining} <span className="text-xs font-normal text-[#64748B]">days remaining</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-2">
                  <span>{intel.fastest_depletion.usable_stock} {intel.fastest_depletion.unit} usable</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                    Reorder soon
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#64748B] italic mt-2">Not enough consumption history.</p>
            )}
          </div>
        </div>

        {/* SMART INSIGHTS SECTION */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-3">
            <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3A7D7C]" />
              <span>Smart Insights</span>
            </h3>
            <span className="text-xs text-[#64748B]">Auto-generated analytics</span>
          </div>

          {intel?.smart_insights && intel.smart_insights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {intel.smart_insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-50 border border-[#D7E5E8] flex items-start gap-3 hover:border-[#3A7D7C] transition-colors"
                >
                  <span className="text-lg">{insight.icon}</span>
                  <div>
                    <h4 className="text-xs font-bold text-[#1F2937]">{insight.title}</h4>
                    <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{insight.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#64748B] italic py-3 text-center">Not enough data to generate smart insights for this period.</p>
          )}
        </div>

        {/* CONSUMPTION TREND, WASTAGE & PURCHASE COST TRENDS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Consumption Trend */}
          <div className="lg:col-span-2 bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D7E5E8] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#3A7D7C]" />
                  <span>Inventory Consumption Trend</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">Daily recipe & KOT consumption over time</p>
              </div>

              <select
                value={selectedTrendItem}
                onChange={e => setSelectedTrendItem(e.target.value)}
                className="bg-white border border-[#D7E5E8] text-[#1F2937] rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#3A7D7C]"
              >
                <option value="">All Raw Ingredients</option>
                {intel?.all_depletions && intel.all_depletions.map(d => (
                  <option key={d.item_id} value={d.item_id}>{d.item_name}</option>
                ))}
              </select>
            </div>

            {intel?.consumption_trend && intel.consumption_trend.length > 0 ? (
              <div className="space-y-2 pt-1 max-h-64 overflow-y-auto pr-1">
                {intel.consumption_trend.map((row, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-[#D7E5E8] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[#64748B] text-[11px]">{new Date(row.date).toLocaleDateString()}</span>
                      <span className="font-bold text-[#1F2937]">{row.item_name}</span>
                    </div>
                    <div className="font-mono font-black text-[#3A7D7C]">
                      {parseFloat(row.consumed).toFixed(2)} {row.unit}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#64748B] italic text-center py-8">No consumption recorded for the selected filter.</p>
            )}
          </div>

          {/* Wastage Overview */}
          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-[#D7E5E8] pb-3">
              <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Wastage Overview</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">Loss breakdown by reason</p>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] font-bold text-rose-800 uppercase">Total Wastage Loss</span>
              <div className="text-2xl font-black text-rose-800 mt-0.5">
                ₹{intel?.wastage_analytics?.total_value ? intel.wastage_analytics.total_value.toFixed(2) : '0.00'}
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Wastage by Reason</span>
              {intel?.wastage_analytics?.by_reason && intel.wastage_analytics.by_reason.length > 0 ? (
                intel.wastage_analytics.by_reason.map((r, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-[#D7E5E8] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1F2937] uppercase text-[11px]">{r.reason}</span>
                    <span className="font-mono font-bold text-rose-700">₹{r.value.toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#64748B] italic">No wastage reported.</p>
              )}
            </div>
          </div>
        </div>

        {/* PURCHASE COST TRENDS */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Purchase Cost Trends</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">Supplier price changes across inventory procurement batches</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-slate-50 text-[11px] font-bold text-[#64748B] uppercase border-b border-[#D7E5E8]">
                <tr>
                  <th className="p-3">Raw Ingredient</th>
                  <th className="p-3">Previous Price</th>
                  <th className="p-3">Current Price</th>
                  <th className="p-3">Price Change</th>
                  <th className="p-3">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D7E5E8]">
                {intel?.purchase_cost_trends && intel.purchase_cost_trends.length > 0 ? (
                  intel.purchase_cost_trends.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-[#1F2937]">{p.item_name}</td>
                      <td className="p-3 font-mono text-[#64748B]">₹{p.previous_price.toFixed(2)} / {p.unit}</td>
                      <td className="p-3 font-mono font-bold text-[#1F2937]">₹{p.current_price.toFixed(2)} / {p.unit}</td>
                      <td className="p-3 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                          p.percentage_change > 0 ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {p.percentage_change > 0 ? `+${p.percentage_change}% ↑` : `${p.percentage_change}% ↓`}
                        </span>
                      </td>
                      <td className="p-3">
                        {p.trend === 'UP' ? (
                          <span className="text-rose-700 flex items-center gap-1 font-bold text-[11px]">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Price Increased
                          </span>
                        ) : p.trend === 'DOWN' ? (
                          <span className="text-emerald-700 flex items-center gap-1 font-bold text-[11px]">
                            <ArrowDownRight className="w-3.5 h-3.5" /> Price Decreased
                          </span>
                        ) : (
                          <span className="text-[#64748B]">Stable</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-[#64748B]">Not enough batch price history to compute trends.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CLICKABLE DRILL-DOWN MODALS */}
      {drillModalType === 'BOM' && intel?.highest_ingredient_cost && (
        <Modal
          isOpen={true}
          onClose={() => setDrillModalType(null)}
          title={`Recipe BOM Cost Breakdown - ${intel.highest_ingredient_cost.menu_item_name}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-[#D7E5E8] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#64748B]">Menu Category: </span>
                <span className="font-bold text-[#1F2937]">{intel.highest_ingredient_cost.category_name}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Total Recipe Cost: </span>
                <span className="font-black text-emerald-800 text-base">₹{intel.highest_ingredient_cost.total_cost.toFixed(2)}</span>
              </div>
            </div>

            <div className="border border-[#D7E5E8] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-slate-50 text-[11px] font-bold text-[#64748B] uppercase border-b border-[#D7E5E8]">
                  <tr>
                    <th className="p-3">Ingredient</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Unit Cost</th>
                    <th className="p-3 text-right">Cost Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {intel.highest_ingredient_cost.ingredients.map((ing, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-[#1F2937]">{ing.item_name}</td>
                      <td className="p-3 font-mono">{ing.quantity} {ing.unit}</td>
                      <td className="p-3 font-mono text-[#64748B]">₹{ing.unit_cost.toFixed(2)}</td>
                      <td className="p-3 font-mono font-bold text-emerald-800 text-right">₹{ing.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setDrillModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-[#1F2937] hover:bg-slate-200 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {drillModalType === 'WASTAGE' && intel?.wastage_analytics && (
        <Modal
          isOpen={true}
          onClose={() => setDrillModalType(null)}
          title="Wastage Loss Analytics & Reasons"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-[#64748B]">Total Wasted Items: </span>
                <span className="font-bold text-[#1F2937]">{intel.wastage_analytics.total_quantity.toFixed(1)} units</span>
              </div>
              <div>
                <span className="text-[#64748B]">Total Loss: </span>
                <span className="font-black text-rose-800 text-base">₹{intel.wastage_analytics.total_value.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#1F2937] uppercase">Breakdown By Wastage Reason</h4>
              <div className="space-y-1.5">
                {intel.wastage_analytics.by_reason.map((r, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-[#D7E5E8] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1F2937] uppercase">{r.reason}</span>
                    <div className="text-right">
                      <div className="font-black text-rose-700">₹{r.value.toFixed(2)}</div>
                      <div className="text-[10px] text-[#64748B]">{r.quantity.toFixed(1)} units</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setDrillModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-[#1F2937] hover:bg-slate-200 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {drillModalType === 'DEPLETION' && intel?.all_depletions && (
        <Modal
          isOpen={true}
          onClose={() => setDrillModalType(null)}
          title="Stock Depletion Rates & Estimated Days Remaining"
        >
          <div className="space-y-4">
            <p className="text-xs text-[#64748B]">
              Estimated days remaining are calculated using actual usable non-expired inventory stock divided by recent average daily consumption rate.
            </p>

            <div className="border border-[#D7E5E8] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-slate-50 text-[11px] font-bold text-[#64748B] uppercase border-b border-[#D7E5E8]">
                  <tr>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Usable Stock</th>
                    <th className="p-3">Daily Usage</th>
                    <th className="p-3">Days Left</th>
                    <th className="p-3">Alert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7E5E8]">
                  {intel.all_depletions.map((d, idx) => (
                    <tr key={idx} className={d.is_critical ? 'bg-amber-50' : 'hover:bg-slate-50/80'}>
                      <td className="p-3 font-bold text-[#1F2937]">{d.item_name}</td>
                      <td className="p-3 font-mono">{d.usable_stock} {d.unit}</td>
                      <td className="p-3 font-mono text-[#64748B]">{d.avg_daily_usage} {d.unit}/day</td>
                      <td className="p-3 font-mono font-black text-amber-800">~{d.estimated_days_remaining} days</td>
                      <td className="p-3">
                        {d.is_critical ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            Reorder Soon
                          </span>
                        ) : (
                          <span className="text-[#64748B] text-[11px]">Adequate</span>
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
                className="px-4 py-2 rounded-xl bg-slate-100 text-[#1F2937] hover:bg-slate-200 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {drillModalType === 'CONSUMPTION' && intel?.most_consumed && (
        <Modal
          isOpen={true}
          onClose={() => setDrillModalType(null)}
          title={`Consumption Details - ${intel.most_consumed.item_name}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-[#D7E5E8] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#64748B]">Category: </span>
                <span className="font-bold text-[#1F2937]">{intel.most_consumed.category_name}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Total Consumed: </span>
                <span className="font-black text-[#3A7D7C] text-base">{intel.most_consumed.quantity} {intel.most_consumed.unit}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold">
              📈 Growth Trend: {intel.most_consumed.change_text}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setDrillModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-[#1F2937] hover:bg-slate-200 text-xs font-bold"
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
