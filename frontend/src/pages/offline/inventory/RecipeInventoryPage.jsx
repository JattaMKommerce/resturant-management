import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import Modal from '../../../components/common/Modal';
import { 
  Boxes, 
  Plus, 
  RefreshCw, 
  AlertTriangle, 
  BookOpen, 
  History, 
  ShieldAlert, 
  Calendar, 
  Search, 
  Download, 
  Clock, 
  CheckCircle, 
  FileSpreadsheet, 
  Edit3, 
  Trash2,
  Tag,
  Building2
} from 'lucide-react';

import KitchenInventoryView from '../kitchen/KitchenInventoryView';

export default function RecipeInventoryPage() {
  const [activeTab, setActiveTab] = useState('BATCHES'); // 'BATCHES', 'STOCK', 'RECIPES', 'LEDGER', 'EXPIRY_REPORT'

  // Data states
  const [inventoryItems, setInventoryItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Batch & Expiry states
  const [batches, setBatches] = useState([]);
  const [expiryStats, setExpiryStats] = useState({
    expired_count: 0,
    expiring_7_count: 0,
    expiring_30_count: 0,
    total_batches_count: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'EXPIRING_7', 'EXPIRING_30', 'EXPIRED', 'SAFE'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);

  // Expiry Report states
  const [expiryReportData, setExpiryReportData] = useState([]);
  const [reportFilter, setReportFilter] = useState('ALL');

  // Modal states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    category_id: 1,
    item_name: '',
    unit: 'kg',
    current_stock: 10.0,
    min_stock_alert: 5.0,
    unit_cost: 100.0
  });

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState([
    { inventory_item_id: '', quantity: 0.25, unit: 'kg' }
  ]);

  // Add Batch Modal state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [batchForm, setBatchForm] = useState({
    inventory_item_id: '',
    batch_number: '',
    supplier_id: '',
    supplier_name: '',
    initial_quantity: 10.0,
    unit_price: 100.0,
    purchase_date: todayStr,
    expiry_date: '',
    notes: ''
  });
  const [batchDateError, setBatchDateError] = useState('');

  // Edit Batch Modal state
  const [isEditBatchModalOpen, setIsEditBatchModalOpen] = useState(false);
  const [editBatchForm, setEditBatchForm] = useState({
    id: null,
    batch_number: '',
    item_name: '',
    current_quantity: 0,
    unit_price: 0,
    purchase_date: '',
    expiry_date: '',
    supplier_id: '',
    supplier_name: '',
    notes: ''
  });
  const [editDateError, setEditDateError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, recRes, txRes, menuRes, batchRes, dashRes, suppRes, reportRes] = await Promise.all([
        api.get('/inventory/items'),
        api.get('/inventory/recipes'),
        api.get('/inventory/transactions'),
        api.get('/menu/items'),
        api.get('/inventory/batches', { params: { status: statusFilter, search: searchQuery, category_id: selectedCategory } }),
        api.get('/inventory/expiry-dashboard'),
        api.get('/inventory/suppliers'),
        api.get('/inventory/expiry-report', { params: { filter: reportFilter } })
      ]);

      if (invRes.success) setInventoryItems(invRes.data);
      if (recRes.success) setRecipes(recRes.data);
      if (txRes.success) setTransactions(txRes.data);
      if (menuRes.success) setMenuItems(menuRes.data);
      if (batchRes.success) setBatches(batchRes.data);
      if (dashRes.success) {
        setExpiryStats(dashRes.data.stats || {});
        setAlerts(dashRes.data.alerts || []);
      }
      if (suppRes.success) setSuppliers(suppRes.data);
      if (reportRes.success) setExpiryReportData(reportRes.data);
    } catch (err) {
      console.error('Failed to load inventory & expiry data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, searchQuery, selectedCategory, reportFilter]);

  // Handle Add Batch submission with date validation
  const handleSaveBatch = async (e) => {
    e.preventDefault();
    setBatchDateError('');

    if (!batchForm.expiry_date) {
      setBatchDateError('Expiry date is required');
      return;
    }

    const pDate = new Date(batchForm.purchase_date);
    const eDate = new Date(batchForm.expiry_date);
    pDate.setHours(0, 0, 0, 0);
    eDate.setHours(0, 0, 0, 0);

    if (eDate < pDate) {
      setBatchDateError('Expiry date cannot be before purchase date');
      return;
    }

    try {
      const res = await api.post('/inventory/batches', batchForm);
      if (res.success) {
        setIsBatchModalOpen(false);
        setBatchForm({
          inventory_item_id: '',
          batch_number: '',
          supplier_id: '',
          supplier_name: '',
          initial_quantity: 10.0,
          unit_price: 100.0,
          purchase_date: todayStr,
          expiry_date: '',
          notes: ''
        });
        fetchData();
      }
    } catch (err) {
      setBatchDateError(err.message || 'Failed to create stock batch');
    }
  };

  // Handle Edit Batch submission
  const handleUpdateBatch = async (e) => {
    e.preventDefault();
    setEditDateError('');

    const pDate = new Date(editBatchForm.purchase_date);
    const eDate = new Date(editBatchForm.expiry_date);
    pDate.setHours(0, 0, 0, 0);
    eDate.setHours(0, 0, 0, 0);

    if (eDate < pDate) {
      setEditDateError('Expiry date cannot be before purchase date');
      return;
    }

    try {
      const res = await api.put(`/inventory/batches/${editBatchForm.id}`, editBatchForm);
      if (res.success) {
        setIsEditBatchModalOpen(false);
        fetchData();
      }
    } catch (err) {
      setEditDateError(err.message || 'Failed to update stock batch');
    }
  };

  // Handle Batch Deletion
  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to delete this stock batch?')) return;
    try {
      const res = await api.delete(`/inventory/batches/${batchId}`);
      if (res.success) {
        fetchData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete batch');
    }
  };

  // Generate suggested batch number
  const generateBatchNumber = (itemId) => {
    const item = inventoryItems.find(i => i.id === parseInt(itemId));
    const prefix = item ? item.item_name.slice(0, 3).toUpperCase() : 'STK';
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${year}-${rand}`;
  };

  // CSV Export utility
  const exportToCSV = (data, filename = 'inventory_expiry_report.csv') => {
    if (!data || data.length === 0) {
      alert('No data available to export');
      return;
    }
    const headers = ['Batch Number', 'Item Name', 'Category', 'Quantity', 'Unit', 'Unit Price', 'Est Stock Value (₹)', 'Supplier', 'Purchase Date', 'Expiry Date', 'Days Remaining', 'Status'];
    const rows = data.map(r => [
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
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/inventory/items', itemForm);
      if (res.success) {
        setIsItemModalOpen(false);
        fetchData();
      }
    } catch (err) {
      alert(err.message || 'Failed to add ingredient');
    }
  };

  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        menu_item_id: selectedMenuItemId,
        ingredients: recipeIngredients.filter(i => i.inventory_item_id && i.quantity > 0)
      };
      const res = await api.post('/inventory/recipes', payload);
      if (res.success) {
        setIsRecipeModalOpen(false);
        fetchData();
      }
    } catch (err) {
      alert(err.message || 'Failed to save recipe');
    }
  };

  // Badge Renderer helper
  const getBadgeStyle = (status) => {
    switch (status) {
      case 'EXPIRED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'EXPIRING_7':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse';
      case 'EXPIRING_30':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'SAFE':
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Boxes className="w-7 h-7 text-amber-500" />
            <span>INVENTORY & EXPIRY MANAGEMENT</span>
          </h2>
          <p className="text-slate-400 text-sm">Batch tracking, dynamic expiry calculations, FEFO stock protection, and recipe BOM management</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 flex items-center gap-2 shadow-lg shadow-amber-500/20 text-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Receive Stock Batch</span>
          </button>

          <button
            onClick={() => setIsItemModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 border border-slate-700 flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Raw Ingredient</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh Inventory"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 1. EXPIRY MANAGEMENT DASHBOARD KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Expiring in 30 Days */}
        <div
          onClick={() => { setActiveTab('BATCHES'); setStatusFilter('EXPIRING_30'); }}
          className={`glass-panel bg-slate-900/80 border p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-xl ${
            statusFilter === 'EXPIRING_30' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-amber-500/30 hover:border-amber-500/60'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Expiring in 30 Days</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{expiryStats.expiring_30_count || 0}</div>
          <p className="text-xs text-slate-400 mt-1">Click to filter 8 - 30 days batches</p>
        </div>

        {/* Expiring in 7 Days */}
        <div
          onClick={() => { setActiveTab('BATCHES'); setStatusFilter('EXPIRING_7'); }}
          className={`glass-panel bg-slate-900/80 border p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-xl ${
            statusFilter === 'EXPIRING_7' ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-rose-500/30 hover:border-rose-500/60'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Expiring in 7 Days</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-400">{expiryStats.expiring_7_count || 0}</div>
          <p className="text-xs text-slate-400 mt-1">Click to filter urgent batches</p>
        </div>

        {/* Expired */}
        <div
          onClick={() => { setActiveTab('BATCHES'); setStatusFilter('EXPIRED'); }}
          className={`glass-panel bg-slate-900/80 border p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-xl ${
            statusFilter === 'EXPIRED' ? 'border-rose-600 ring-2 ring-rose-600/30' : 'border-rose-600/30 hover:border-rose-600/60'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Expired Batches</span>
            <div className="p-2 rounded-xl bg-rose-950 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-500">{expiryStats.expired_count || 0}</div>
          <p className="text-xs text-slate-400 mt-1">Protected from FEFO order use</p>
        </div>

        {/* Total Batches */}
        <div
          onClick={() => { setActiveTab('BATCHES'); setStatusFilter('ALL'); }}
          className={`glass-panel bg-slate-900/80 border p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-xl ${
            statusFilter === 'ALL' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Batches</span>
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{expiryStats.total_batches_count || 0}</div>
          <p className="text-xs text-slate-400 mt-1">Click to view all stock batches</p>
        </div>
      </div>

      {/* 8. ALERTS BANNER */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alt, idx) => (
            <div
              key={idx}
              onClick={() => { setActiveTab('BATCHES'); setStatusFilter(alt.filter_status); }}
              className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all hover:opacity-90 ${
                alt.type === 'EXPIRED'
                  ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                  : alt.type === 'EXPIRING_7'
                  ? 'bg-rose-900/40 border-rose-500/40 text-rose-300'
                  : 'bg-amber-900/30 border-amber-500/40 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-3 text-sm font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{alt.message}</span>
              </div>
              <span className="text-xs font-semibold underline underline-offset-2">View Filtered List &rarr;</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('BATCHES')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'BATCHES' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Batch Inventory & Expiry Table ({batches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('STOCK')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'STOCK' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Live Ingredient Stock View</span>
        </button>

        <button
          onClick={() => setActiveTab('RECIPES')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'RECIPES' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Dish Recipes / BOM ({recipes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'LEDGER' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Deduction Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('EXPIRY_REPORT')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'EXPIRY_REPORT' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Expiry Report & CSV Export</span>
        </button>
      </div>

      {/* TAB 1: BATCH INVENTORY & EXPIRY MANAGEMENT TABLE */}
      {activeTab === 'BATCHES' && (
        <div className="space-y-4">
          {/* Filters & Search Bar */}
          <div className="glass-panel bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 mr-1">Filter Expiry:</span>
              {[
                { key: 'ALL', label: 'All Batches' },
                { key: 'EXPIRING_7', label: '🟠 Expiring in 7 Days' },
                { key: 'EXPIRING_30', label: '🟡 Expiring in 30 Days' },
                { key: 'EXPIRED', label: '🔴 Expired' },
                { key: 'SAFE', label: '🟢 Safe' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === f.key
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item, batch no, supplier..."
                  className="pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500 w-60"
                />
              </div>
            </div>
          </div>

          {/* Batch Table */}
          <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-4">Item & Category</th>
                    <th className="px-5 py-4">Batch Number</th>
                    <th className="px-5 py-4">Current / Initial Qty</th>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4">Purchase Date</th>
                    <th className="px-5 py-4">Expiry Date</th>
                    <th className="px-5 py-4">Days Remaining</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-slate-400 text-xs">Loading stock batches...</td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-12 text-slate-500">
                        <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                        <p className="font-bold text-slate-400 text-sm">No Stock Batches Found</p>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting filter or receive a new batch.</p>
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-sm">{b.item_name}</div>
                          <div className="text-[11px] text-amber-400 font-semibold">{b.category_name}</div>
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-amber-300 text-xs">
                          {b.batch_number}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-white">
                            {b.current_quantity} <span className="text-xs text-slate-400 font-normal">{b.unit}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">Init: {b.initial_quantity} {b.unit}</div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{b.supplier_display_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                          {new Date(b.purchase_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono font-bold text-white">
                          {new Date(b.expiry_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-bold">
                          <span className={b.days_remaining < 0 ? 'text-rose-400 font-black' : b.days_remaining <= 7 ? 'text-rose-300' : b.days_remaining <= 30 ? 'text-amber-400' : 'text-emerald-400'}>
                            {b.days_text}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border uppercase tracking-wider ${getBadgeStyle(b.expiry_status)}`}>
                            {b.expiry_status === 'EXPIRED' ? '⛔ EXPIRED' : b.expiry_status === 'EXPIRING_7' ? '🔴 EXPIRING IN 7 DAYS' : b.expiry_status === 'EXPIRING_30' ? '🟠 EXPIRING IN 30 DAYS' : '🟢 SAFE'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditBatchForm({
                                  id: b.id,
                                  batch_number: b.batch_number,
                                  item_name: b.item_name,
                                  current_quantity: b.current_quantity,
                                  unit_price: b.unit_price,
                                  purchase_date: b.purchase_date ? b.purchase_date.slice(0, 10) : todayStr,
                                  expiry_date: b.expiry_date ? b.expiry_date.slice(0, 10) : '',
                                  supplier_id: b.supplier_id || '',
                                  supplier_name: b.supplier_name || '',
                                  notes: b.notes || ''
                                });
                                setEditDateError('');
                                setIsEditBatchModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700"
                              title="Edit Batch"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBatch(b.id)}
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700"
                              title="Delete Batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RAW STOCK AVAILABILITY GRID */}
      {activeTab === 'STOCK' && (
        <div className="space-y-6">
          <KitchenInventoryView />
        </div>
      )}

      {/* TAB 3: RECIPES */}
      {activeTab === 'RECIPES' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsRecipeModalOpen(true)}
              className="py-2 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Map Dish Recipe</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((rec) => (
              <div key={rec.recipe_id} className="glass-panel bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h4 className="text-base font-bold text-white">{rec.menu_item_name}</h4>
                <p className="text-xs text-amber-400 font-semibold mb-3">{rec.category_name}</p>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Required Ingredients</span>
                  {rec.ingredients && rec.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span>{ing.item_name}</span>
                      <span className="font-bold text-amber-400">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LEDGER */}
      {activeTab === 'LEDGER' && (
        <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Transaction Date</th>
                  <th className="px-6 py-4">Ingredient</th>
                  <th className="px-6 py-4">Stock Change</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Reference Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(tx.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-white">{tx.item_name}</td>
                    <td className={`px-6 py-4 font-mono font-bold ${parseFloat(tx.change_quantity) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {parseFloat(tx.change_quantity) > 0 ? `+${tx.change_quantity}` : tx.change_quantity} {tx.unit}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-amber-400">{tx.type}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{tx.reference_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: EXPIRY REPORT & CSV EXPORT */}
      {activeTab === 'EXPIRY_REPORT' && (
        <div className="space-y-4">
          <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Report Scope:</span>
              {[
                { key: 'ALL', label: 'All Active Batches' },
                { key: 'EXPIRING_7', label: '7-Day Expiring' },
                { key: 'EXPIRING_30', label: '30-Day Expiring' },
                { key: 'EXPIRED', label: 'Expired Stock Only' }
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => setReportFilter(r.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    reportFilter === r.key
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => exportToCSV(expiryReportData, `expiry_report_${reportFilter.toLowerCase()}.csv`)}
              className="py-2 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV Report</span>
            </button>
          </div>

          <div className="glass-panel bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-4">Batch No.</th>
                    <th className="px-5 py-4">Item Name</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Expiry Date</th>
                    <th className="px-5 py-4">Days Remaining</th>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4">Est. Stock Value</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {expiryReportData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-amber-400 text-xs">{row.batch_number}</td>
                      <td className="px-5 py-4 font-bold text-white">{row.item_name}</td>
                      <td className="px-5 py-4 font-bold">{row.current_quantity} {row.unit}</td>
                      <td className="px-5 py-4 font-mono text-xs">{new Date(row.expiry_date).toLocaleDateString()}</td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-amber-300">{row.days_text}</td>
                      <td className="px-5 py-4 text-xs text-slate-400">{row.supplier}</td>
                      <td className="px-5 py-4 font-bold text-emerald-400">₹{parseFloat(row.estimated_value || 0).toFixed(2)}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${getBadgeStyle(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE STOCK BATCH MODAL */}
      <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="Receive New Stock Batch" maxWidth="max-w-lg">
        <form onSubmit={handleSaveBatch} className="space-y-4">
          {batchDateError && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{batchDateError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Raw Ingredient *</label>
            <select
              value={batchForm.inventory_item_id}
              onChange={(e) => {
                const itemId = e.target.value;
                const autoBatch = itemId ? generateBatchNumber(itemId) : '';
                setBatchForm({ ...batchForm, inventory_item_id: itemId, batch_number: autoBatch });
              }}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
            >
              <option value="">Choose Raw Ingredient</option>
              {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.unit})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Batch Number *</label>
              <input
                type="text"
                value={batchForm.batch_number}
                onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                required
                placeholder="e.g. CHK-2026-001"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Received Qty *</label>
              <input
                type="number"
                step="0.001"
                value={batchForm.initial_quantity}
                onChange={(e) => setBatchForm({ ...batchForm, initial_quantity: parseFloat(e.target.value) })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Purchase Date *</label>
              <input
                type="date"
                value={batchForm.purchase_date}
                onChange={(e) => setBatchForm({ ...batchForm, purchase_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Expiry Date *</label>
              <input
                type="date"
                value={batchForm.expiry_date}
                onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold text-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier</label>
              <select
                value={batchForm.supplier_id}
                onChange={(e) => {
                  const sId = e.target.value;
                  const sObj = suppliers.find(s => s.id === parseInt(sId));
                  setBatchForm({
                    ...batchForm,
                    supplier_id: sId,
                    supplier_name: sObj ? sObj.name : ''
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Purchase Price per Unit (₹)</label>
              <input
                type="number"
                step="0.01"
                value={batchForm.unit_price}
                onChange={(e) => setBatchForm({ ...batchForm, unit_price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Internal Reference</label>
            <input
              type="text"
              value={batchForm.notes}
              onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
              placeholder="e.g. Cold storage shelf A-3"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button type="button" onClick={() => setIsBatchModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400">Save Stock Batch</button>
          </div>
        </form>
      </Modal>

      {/* EDIT BATCH MODAL */}
      <Modal isOpen={isEditBatchModalOpen} onClose={() => setIsEditBatchModalOpen(false)} title={`Edit Batch #${editBatchForm.batch_number}`} maxWidth="max-w-md">
        <form onSubmit={handleUpdateBatch} className="space-y-4">
          {editDateError && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{editDateError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Item Name</label>
            <input
              type="text"
              disabled
              value={editBatchForm.item_name}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Current Stock Qty</label>
              <input
                type="number"
                step="0.001"
                value={editBatchForm.current_quantity}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, current_quantity: parseFloat(e.target.value) })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={editBatchForm.unit_price}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, unit_price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Purchase Date</label>
              <input
                type="date"
                value={editBatchForm.purchase_date}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, purchase_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Expiry Date</label>
              <input
                type="date"
                value={editBatchForm.expiry_date}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, expiry_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold text-amber-400"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditBatchModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400">Update Batch</button>
          </div>
        </form>
      </Modal>

      {/* ADD ITEM MODAL */}
      <Modal isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title="Add Raw Ingredient" maxWidth="max-w-md">
        <form onSubmit={handleSaveItem} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Ingredient Name *</label>
            <input
              type="text"
              value={itemForm.item_name}
              onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
              required
              placeholder="e.g. Fresh Paneer"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unit *</label>
              <select
                value={itemForm.unit}
                onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Stock</label>
              <input
                type="number"
                step="0.001"
                value={itemForm.current_stock}
                onChange={(e) => setItemForm({ ...itemForm, current_stock: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-3 py-2 rounded-xl bg-slate-800 text-xs">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs">Save</button>
          </div>
        </form>
      </Modal>

      {/* MAP RECIPE MODAL */}
      <Modal isOpen={isRecipeModalOpen} onClose={() => setIsRecipeModalOpen(false)} title="Map Recipe BOM to Dish" maxWidth="max-w-md">
        <form onSubmit={handleSaveRecipe} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Menu Item *</label>
            <select
              value={selectedMenuItemId}
              onChange={(e) => setSelectedMenuItemId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
            >
              <option value="">Choose Food Item</option>
              {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Ingredients Required per Dish Portion</label>
            {recipeIngredients.map((ing, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={ing.inventory_item_id}
                  onChange={(e) => {
                    const copy = [...recipeIngredients];
                    copy[idx].inventory_item_id = e.target.value;
                    setRecipeIngredients(copy);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                >
                  <option value="">Select Ingredient</option>
                  {inventoryItems.map(ii => <option key={ii.id} value={ii.id}>{ii.item_name} ({ii.unit})</option>)}
                </select>

                <input
                  type="number"
                  step="0.001"
                  value={ing.quantity}
                  onChange={(e) => {
                    const copy = [...recipeIngredients];
                    copy[idx].quantity = parseFloat(e.target.value);
                    setRecipeIngredients(copy);
                  }}
                  placeholder="Qty"
                  className="w-20 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => setRecipeIngredients([...recipeIngredients, { inventory_item_id: '', quantity: 0.1, unit: 'kg' }])}
              className="text-xs text-amber-400 font-semibold hover:underline"
            >
              + Add Another Ingredient
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button type="button" onClick={() => setIsRecipeModalOpen(false)} className="px-3 py-2 rounded-xl bg-slate-800 text-xs">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs">Save Recipe</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
