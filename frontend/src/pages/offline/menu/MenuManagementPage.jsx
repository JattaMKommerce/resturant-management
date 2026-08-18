import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import MenuItemModal from '../../../components/menu/MenuItemModal';
import CategoryModal from '../../../components/menu/CategoryModal';
import { Utensils, Plus, Search, Filter, RefreshCw, Edit, Trash2, Clock, CheckCircle, XCircle, Layers, Globe, ExternalLink } from 'lucide-react';

export default function MenuManagementPage() {
  const { restaurant } = useAuth();
  const liveSlug = restaurant?.slug || 'grand-palace';

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [items, setItems] = useState([]);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [vegFilter, setVegFilter] = useState('');
  const [onlineFilter, setOnlineFilter] = useState('');

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);

  const fetchMenuData = async () => {
    setLoading(true);
    try {
      const [catRes, deptRes, modRes] = await Promise.all([
        api.get('/menu/categories'),
        api.get('/menu/departments'),
        api.get('/menu/modifiers')
      ]);

      if (catRes.success) setCategories(catRes.data);
      if (deptRes.success) setDepartments(deptRes.data);
      if (modRes.success) setModifierGroups(modRes.data);

      const params = {};
      if (search) params.search = search;
      if (selectedCategory) params.category_id = selectedCategory;
      if (selectedDept) params.kitchen_department_id = selectedDept;
      if (vegFilter) params.is_veg = vegFilter;

      const itemRes = await api.get('/menu/items', { params });
      if (itemRes.success) {
        let fetchedItems = itemRes.data;
        if (onlineFilter === 'true') {
          fetchedItems = fetchedItems.filter(i => i.is_available_online === 1 || i.is_available_online === null || i.is_available_online === undefined);
        } else if (onlineFilter === 'false') {
          fetchedItems = fetchedItems.filter(i => i.is_available_online === 0);
        }
        setItems(fetchedItems);
      }

    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, [search, selectedCategory, selectedDept, vegFilter, onlineFilter]);

  const handleSaveItem = async (formData) => {
    try {
      if (editingItem) {
        await api.put(`/menu/items/${editingItem.id}`, formData);
      } else {
        await api.post('/menu/items', formData);
      }
      setIsItemModalOpen(false);
      setEditingItem(null);
      fetchMenuData();
    } catch (err) {
      alert(err.message || 'Failed to save menu item');
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await api.put(`/menu/items/${item.id}`, { is_available: !item.is_available });
      fetchMenuData();
    } catch (err) {
      alert(err.message || 'Failed to toggle item availability');
    }
  };

  const handleToggleOnline = async (item) => {
    try {
      await api.patch(`/menu/items/${item.id}/toggle-online`);
      fetchMenuData();
    } catch (err) {
      alert(err.message || 'Failed to toggle online status');
    }
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm('Deactivate this menu item?')) {
      try {
        await api.delete(`/menu/items/${id}`);
        fetchMenuData();
      } catch (err) {
        alert(err.message || 'Failed to delete item');
      }
    }
  };

  const handleSaveCategory = async (formData) => {
    try {
      if (editingCat) {
        await api.put(`/menu/categories/${editingCat.id}`, formData);
      } else {
        await api.post('/menu/categories', formData);
      }
      setIsCatModalOpen(false);
      setEditingCat(null);
      fetchMenuData();
    } catch (err) {
      alert(err.message || 'Failed to save category');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Utensils className="w-7 h-7 text-amber-500" />
            <span>Menu Management</span>
          </h2>
          <p className="text-slate-400 text-sm">
            Unified catalog for both <strong>Offline KOT / Dine-In</strong> and <strong>Online Customer Delivery</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`/restaurant/${liveSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-700/80 text-amber-400 font-semibold hover:bg-slate-800 hover:text-amber-300 transition-colors text-xs flex items-center gap-1.5 shadow-sm"
            title="Preview your live customer online website menu"
          >
            <Globe className="w-4 h-4" />
            <span>Live Online Menu</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>

          <button
            onClick={() => {
              setEditingCat(null);
              setIsCatModalOpen(true);
            }}
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold hover:text-white transition-colors text-xs flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Categories</span>
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu item or description..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-amber-500"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-amber-500"
          >
            <option value="">All Kitchen Depts</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select
            value={onlineFilter}
            onChange={(e) => setOnlineFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-amber-500"
          >
            <option value="">All Channels</option>
            <option value="true">🌐 Online Menu Only</option>
            <option value="false">🏢 Offline Only</option>
          </select>

          <select
            value={vegFilter}
            onChange={(e) => setVegFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-amber-500"
          >
            <option value="">All Dietary</option>
            <option value="true">Veg Only 🟢</option>
            <option value="false">Non-Veg Only 🔴</option>
          </select>

          <button
            onClick={fetchMenuData}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh menu items"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Menu Item Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse"></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Utensils className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300">No Menu Items Found</h3>
          <p className="text-sm text-slate-500 mt-1">Try adjusting search filters or add a new menu item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map(item => {
            const isOnline = item.is_available_online === 1 || item.is_available_online === null || item.is_available_online === undefined;
            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-2xl overflow-hidden flex flex-col justify-between transition-all shadow-xl group ${
                  item.is_available ? 'border-slate-800 hover:border-amber-500/50' : 'border-rose-900/50 opacity-75'
                }`}
              >
                <div>
                  {/* Image Header */}
                  <div className="h-44 w-full relative overflow-hidden bg-slate-950">
                    <img
                      src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                      }}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border shadow-sm ${
                        item.is_veg ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/50' : 'bg-rose-950/90 text-rose-400 border-rose-500/50'
                      }`}>
                        {item.is_veg ? 'VEG 🟢' : 'NON-VEG 🔴'}
                      </span>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border shadow-sm flex items-center gap-1 ${
                        isOnline ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/50' : 'bg-slate-950/90 text-slate-400 border-slate-700'
                      }`}>
                        <Globe className="w-2.5 h-2.5" />
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-950/90 text-amber-400 border border-amber-500/30 shadow-md">
                        ₹{parseFloat(item.price).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                      <span>{item.category_name}</span>
                      <span className="text-slate-400 font-medium text-[11px]">{item.kitchen_department_name}</span>
                    </div>

                    <h3 className="text-base font-extrabold text-white group-hover:text-amber-400 transition-colors">
                      {item.name}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description || 'No description available.'}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{item.prep_time_minutes} mins</span>
                      </div>

                      <span className="text-[11px] text-slate-400">Tax: {item.tax_percentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-4 pt-0 border-t border-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between gap-2 pt-2">
                    {/* Overall Availability Toggle */}
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      title="Toggle item availability in kitchen / POS"
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                        item.is_available
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                      }`}
                    >
                      {item.is_available ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{item.is_available ? 'Available' : 'Unavailable'}</span>
                    </button>

                    {/* Online Toggle Button */}
                    <button
                      onClick={() => handleToggleOnline(item)}
                      title={isOnline ? 'Click to hide from Online Website' : 'Click to enable on Online Website'}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border ${
                        isOnline
                          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setIsItemModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      title="Edit Item"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                      title="Deactivate Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Item Modal */}
      <MenuItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        onSave={handleSaveItem}
        editingItem={editingItem}
        categories={categories}
        departments={departments}
        modifierGroups={modifierGroups}
      />

      {/* Category Modal */}
      <CategoryModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        onSave={handleSaveCategory}
        editingCategory={editingCat}
      />
    </div>
  );
}
