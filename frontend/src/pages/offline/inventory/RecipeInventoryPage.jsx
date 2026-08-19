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
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'EXPIRING_7':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'EXPIRING_30':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'SAFE':
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6 antialiased font-sans">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#3A7D7C]" />
            <span>Inventory & Expiry Management</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Batch tracking, dynamic expiry calculations, FEFO stock protection, and recipe BOM management</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold flex items-center gap-2 shadow-2xs text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Receive Stock Batch</span>
          </button>

          <button
            onClick={() => setIsItemModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-white text-[#1F2937] font-semibold hover:bg-slate-50 border border-[#D7E5E8] flex items-center gap-2 text-xs shadow-2xs"
          >
            <Plus className="w-4 h-4 text-[#3A7D7C]" />
            <span>Add Raw Ingredient</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors shadow-2xs"
            title="Refresh Inventory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. EXPIRY MANAGEMENT DASHBOARD KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Expiring in 30 Days */}
        <div
          onClick={() => { setActiveTab('BATCHES'); setStatusFilter('EXPIRING_30'); }}
          className={`bg-white border p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-xs ${
            statusFilter === 'EXPIRING_30' ? 'border-[#3A7D7C] ring-2 ring-[#3A7D7C]/20' : 'border-[#D7E5E8] hover:border-[#3A7D7C]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Expiring in 30 Days</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#1F2937]">{expiryStats.expiring_30_count || 0}</div>
          <p className="text-xs text-[#64748B] mt-1">Click to filter 8 - 30 days batches</p>
        </div>

        {/* Expiring in 7 Days */}
        <div
          onClick={() => { setActiveTab('BATCHES'); setStatusFilter('EXPIRING_7'); }}
          className={`bg-white border p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-xs ${
            statusFilter === 'EXPIRING_7' ? 'border-rose-400 ring-2 ring-rose-100' : 'border-[#D7E5E8] hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Expiring in 7 Days</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-700">{expiryStats.expiring_7_count || 0}</div>
          <p className="text-xs text-[#64748B] mt-1">Click to filter urgent batches</p>
        </div>

        {/* Expired */}
        <div
          onClick={() => { setActiveTab('BATCHES'); setStatusFilter('EXPIRED'); }}
          className={`bg-white border p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-xs ${
            statusFilter === 'EXPIRED' ? 'border-rose-600 ring-2 ring-rose-100' : 'border-[#D7E5E8] hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Expired Batches</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-800">{expiryStats.expired_count || 0}</div>
          <p className="text-xs text-[#64748B] mt-1">Protected from FEFO order use</p>
        </div>

        {/* Total Batches */}
        <div
          onClick={() => { setActiveTab('BATCHES'); setStatusFilter('ALL'); }}
          className={`bg-white border p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-xs ${
            statusFilter === 'ALL' ? 'border-[#3A7D7C] ring-2 ring-[#3A7D7C]/20' : 'border-[#D7E5E8] hover:border-[#3A7D7C]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Total Active Batches</span>
            <div className="p-2 rounded-xl bg-slate-100 text-[#3A7D7C]">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#1F2937]">{expiryStats.total_batches_count || 0}</div>
          <p className="text-xs text-[#64748B] mt-1">Click to view all stock batches</p>
        </div>
      </div>

      {/* ALERTS BANNER */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alt, idx) => (
            <div
              key={idx}
              onClick={() => { setActiveTab('BATCHES'); setStatusFilter(alt.filter_status); }}
              className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all hover:opacity-90 ${
                alt.type === 'EXPIRED'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : alt.type === 'EXPIRING_7'
                  ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold">{alt.title}</span> — {alt.message}
                </div>
              </div>
              <span className="text-xs font-bold underline shrink-0">View Batches →</span>
            </div>
          ))}
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-[#D7E5E8] gap-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('BATCHES')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'BATCHES' ? 'border-[#3A7D7C] text-[#3A7D7C]' : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Batch Tracking & Expiry</span>
        </button>

        <button
          onClick={() => setActiveTab('STOCK')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'STOCK' ? 'border-[#3A7D7C] text-[#3A7D7C]' : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Raw Ingredient Stock</span>
        </button>

        <button
          onClick={() => setActiveTab('RECIPES')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'RECIPES' ? 'border-[#3A7D7C] text-[#3A7D7C]' : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Recipe BOM Mapping</span>
        </button>

        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'LEDGER' ? 'border-[#3A7D7C] text-[#3A7D7C]' : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Deduction Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('EXPIRY_REPORT')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'EXPIRY_REPORT' ? 'border-[#3A7D7C] text-[#3A7D7C]' : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
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
          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#64748B] mr-1">Filter Expiry:</span>
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    statusFilter === f.key
                      ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                      : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item, batch no, supplier..."
                  className="pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] placeholder-[#64748B] text-xs focus:outline-none focus:border-[#3A7D7C] w-60 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Batch Table */}
          <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1F2937]">
                <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
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
                <tbody className="divide-y divide-[#D7E5E8]">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-[#64748B] text-xs">Loading stock batches...</td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-12 text-[#64748B]">
                        <Boxes className="w-10 h-10 mx-auto mb-2 text-[#64748B]/40" />
                        <p className="font-bold text-[#1F2937] text-sm">No Stock Batches Found</p>
                        <p className="text-xs text-[#64748B] mt-1">Try adjusting filter or receive a new batch.</p>
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-[#1F2937] text-sm">{b.item_name}</div>
                          <div className="text-[11px] text-[#3A7D7C] font-semibold">{b.category_name}</div>
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-[#3A7D7C] text-xs">
                          {b.batch_number}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-[#1F2937]">
                            {b.current_quantity} <span className="text-xs text-[#64748B] font-normal">{b.unit}</span>
                          </div>
                          <div className="text-[11px] text-[#64748B]">Init: {b.initial_quantity} {b.unit}</div>
                        </td>
                        <td className="px-5 py-4 text-xs text-[#64748B]">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#3A7D7C]" />
                            <span>{b.supplier_display_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-[#64748B] font-mono">
                          {new Date(b.purchase_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono font-bold text-[#1F2937]">
                          {new Date(b.expiry_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-bold">
                          <span className={b.days_remaining < 0 ? 'text-rose-700 font-bold' : b.days_remaining <= 7 ? 'text-rose-600' : b.days_remaining <= 30 ? 'text-amber-800' : 'text-emerald-700'}>
                            {b.days_text}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getBadgeStyle(b.expiry_status)}`}>
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
                              className="p-1.5 rounded-lg bg-slate-100 text-[#1F2937] hover:text-[#3A7D7C] hover:bg-slate-200"
                              title="Edit Batch"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBatch(b.id)}
                              className="p-1.5 rounded-lg bg-slate-100 text-[#64748B] hover:text-rose-600 hover:bg-slate-200"
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
              className="py-2 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs flex items-center gap-2 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Map Dish Recipe</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((rec) => (
              <div key={rec.recipe_id} className="bg-white border border-[#D7E5E8] rounded-2xl p-4 shadow-xs">
                <h4 className="text-base font-bold text-[#1F2937]">{rec.menu_item_name}</h4>
                <p className="text-xs text-[#3A7D7C] font-semibold mb-3">{rec.category_name}</p>

                <div className="space-y-2 pt-2 border-t border-[#D7E5E8]">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Required Ingredients</span>
                  {rec.ingredients && rec.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-[#1F2937] bg-slate-50 p-2 rounded-lg border border-[#D7E5E8]">
                      <span>{ing.item_name}</span>
                      <span className="font-bold text-[#3A7D7C]">{ing.quantity} {ing.unit}</span>
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
        <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#1F2937]">
              <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
                <tr>
                  <th className="px-6 py-4">Transaction Date</th>
                  <th className="px-6 py-4">Ingredient</th>
                  <th className="px-6 py-4">Stock Change</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Reference Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D7E5E8]">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-xs text-[#64748B]">{new Date(tx.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-[#1F2937]">{tx.item_name}</td>
                    <td className={`px-6 py-4 font-mono font-bold ${parseFloat(tx.change_quantity) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {parseFloat(tx.change_quantity) > 0 ? `+${tx.change_quantity}` : tx.change_quantity} {tx.unit}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-[#3A7D7C]">{tx.type}</td>
                    <td className="px-6 py-4 font-mono text-xs text-[#64748B]">{tx.reference_id}</td>
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
          <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#64748B]">Report Scope:</span>
              {[
                { key: 'ALL', label: 'All Active Batches' },
                { key: 'EXPIRING_7', label: '7-Day Expiring' },
                { key: 'EXPIRING_30', label: '30-Day Expiring' },
                { key: 'EXPIRED', label: 'Expired Stock Only' }
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => setReportFilter(r.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    reportFilter === r.key
                      ? 'bg-[#3A7D7C] text-white border-[#3A7D7C]'
                      : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => exportToCSV(expiryReportData, `expiry_report_${reportFilter.toLowerCase()}.csv`)}
              className="py-2 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs flex items-center gap-2 shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV Report</span>
            </button>
          </div>

          <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1F2937]">
                <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
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
                <tbody className="divide-y divide-[#D7E5E8]">
                  {expiryReportData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-[#3A7D7C] text-xs">{row.batch_number}</td>
                      <td className="px-5 py-4 font-bold text-[#1F2937]">{row.item_name}</td>
                      <td className="px-5 py-4 font-bold">{row.current_quantity} {row.unit}</td>
                      <td className="px-5 py-4 font-mono text-xs text-[#64748B]">{new Date(row.expiry_date).toLocaleDateString()}</td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-amber-800">{row.days_text}</td>
                      <td className="px-5 py-4 text-xs text-[#64748B]">{row.supplier}</td>
                      <td className="px-5 py-4 font-bold text-emerald-800">₹{parseFloat(row.estimated_value || 0).toFixed(2)}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(row.status)}`}>
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
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{batchDateError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">Select Raw Ingredient *</label>
            <select
              value={batchForm.inventory_item_id}
              onChange={(e) => {
                const itemId = e.target.value;
                const autoBatch = itemId ? generateBatchNumber(itemId) : '';
                setBatchForm({ ...batchForm, inventory_item_id: itemId, batch_number: autoBatch });
              }}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs focus:outline-none focus:border-[#3A7D7C]"
            >
              <option value="">Choose Raw Ingredient</option>
              {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.unit})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Batch Number *</label>
              <input
                type="text"
                value={batchForm.batch_number}
                onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                required
                placeholder="e.g. CHK-2026-001"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Initial Received Qty *</label>
              <input
                type="number"
                step="0.001"
                value={batchForm.initial_quantity}
                onChange={(e) => setBatchForm({ ...batchForm, initial_quantity: parseFloat(e.target.value) })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Purchase Date *</label>
              <input
                type="date"
                value={batchForm.purchase_date}
                onChange={(e) => setBatchForm({ ...batchForm, purchase_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Expiry Date *</label>
              <input
                type="date"
                value={batchForm.expiry_date}
                onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs font-bold text-[#3A7D7C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Supplier</label>
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
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Purchase Price per Unit (₹)</label>
              <input
                type="number"
                step="0.01"
                value={batchForm.unit_price}
                onChange={(e) => setBatchForm({ ...batchForm, unit_price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">Notes / Internal Reference</label>
            <input
              type="text"
              value={batchForm.notes}
              onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
              placeholder="e.g. Cold storage shelf A-3"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
            />
          </div>

          <div className="pt-3 border-t border-[#D7E5E8] flex justify-end gap-2">
            <button type="button" onClick={() => setIsBatchModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-[#1F2937] text-xs font-bold">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs">Save Stock Batch</button>
          </div>
        </form>
      </Modal>

      {/* EDIT BATCH MODAL */}
      <Modal isOpen={isEditBatchModalOpen} onClose={() => setIsEditBatchModalOpen(false)} title={`Edit Batch #${editBatchForm.batch_number}`} maxWidth="max-w-md">
        <form onSubmit={handleUpdateBatch} className="space-y-4">
          {editDateError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{editDateError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">Item Name</label>
            <input
              type="text"
              disabled
              value={editBatchForm.item_name}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-[#D7E5E8] text-[#64748B] text-xs font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Current Stock Qty</label>
              <input
                type="number"
                step="0.001"
                value={editBatchForm.current_quantity}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, current_quantity: parseFloat(e.target.value) })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Unit Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={editBatchForm.unit_price}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, unit_price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Purchase Date</label>
              <input
                type="date"
                value={editBatchForm.purchase_date}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, purchase_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Expiry Date</label>
              <input
                type="date"
                value={editBatchForm.expiry_date}
                onChange={(e) => setEditBatchForm({ ...editBatchForm, expiry_date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs font-bold text-[#3A7D7C]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#D7E5E8] flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditBatchModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-[#1F2937] text-xs font-bold">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs">Update Batch</button>
          </div>
        </form>
      </Modal>

      {/* ADD ITEM MODAL */}
      <Modal isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title="Add Raw Ingredient" maxWidth="max-w-md">
        <form onSubmit={handleSaveItem} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">Ingredient Name *</label>
            <input
              type="text"
              value={itemForm.item_name}
              onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
              required
              placeholder="e.g. Fresh Paneer"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs focus:outline-none focus:border-[#3A7D7C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Unit *</label>
              <select
                value={itemForm.unit}
                onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Initial Stock</label>
              <input
                type="number"
                step="0.001"
                value={itemForm.current_stock}
                onChange={(e) => setItemForm({ ...itemForm, current_stock: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#D7E5E8] flex justify-end gap-2">
            <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-3 py-2 rounded-xl bg-slate-100 text-[#1F2937] text-xs font-bold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs">Save</button>
          </div>
        </form>
      </Modal>

      {/* MAP RECIPE MODAL */}
      <Modal isOpen={isRecipeModalOpen} onClose={() => setIsRecipeModalOpen(false)} title="Map Recipe BOM to Dish" maxWidth="max-w-md">
        <form onSubmit={handleSaveRecipe} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">Select Menu Item *</label>
            <select
              value={selectedMenuItemId}
              onChange={(e) => setSelectedMenuItemId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
            >
              <option value="">Choose Food Item</option>
              {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#1F2937]">Ingredients Required per Dish Portion</label>
            {recipeIngredients.map((ing, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={ing.inventory_item_id}
                  onChange={(e) => {
                    const copy = [...recipeIngredients];
                    copy[idx].inventory_item_id = e.target.value;
                    setRecipeIngredients(copy);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
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
                  className="w-20 px-3 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-xs"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => setRecipeIngredients([...recipeIngredients, { inventory_item_id: '', quantity: 0.1, unit: 'kg' }])}
              className="text-xs text-[#3A7D7C] font-bold hover:underline"
            >
              + Add Another Ingredient
            </button>
          </div>

          <div className="pt-3 border-t border-[#D7E5E8] flex justify-end gap-2">
            <button type="button" onClick={() => setIsRecipeModalOpen(false)} className="px-3 py-2 rounded-xl bg-slate-100 text-[#1F2937] text-xs font-bold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs">Save Recipe</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
