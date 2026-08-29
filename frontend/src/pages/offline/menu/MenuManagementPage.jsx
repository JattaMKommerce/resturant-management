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
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Utensils className="w-6 h-6 text-[#3A7D7C]" />
            <span>Menu Management</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">
            Unified catalog for both <strong>Offline KOT / Dine-In</strong> and <strong>Online Customer Delivery</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`${typeof window !== 'undefined' && window.location.pathname.startsWith('/hotel') ? '/hotel' : ''}/restaurant/${liveSlug || 'grand-palace'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-3.5 rounded-xl bg-white border border-[#D7E5E8] text-[#3A7D7C] font-bold hover:bg-[#EAF4F7] transition-colors text-xs flex items-center gap-1.5 shadow-2xs"
            title="Preview your live customer online website menu"
          >
            <Globe className="w-4 h-4" />
            <span>Live Online Menu</span>
            <ExternalLink className="w-3 h-3 text-[#64748B]" />
          </a>

          <button
            onClick={() => {
              setEditingCat(null);
              setIsCatModalOpen(true);
            }}
            className="py-2.5 px-3.5 rounded-xl bg-white border border-[#D7E5E8] text-[#1F2937] font-bold hover:bg-slate-50 transition-colors text-xs flex items-center gap-1.5 shadow-2xs"
          >
            <Layers className="w-4 h-4 text-[#3A7D7C]" />
            <span>Categories</span>
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold flex items-center gap-1.5 shadow-2xs transition-all text-xs uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#64748B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu item or description..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] placeholder-[#64748B] text-xs font-semibold focus:outline-none focus:border-[#3A7D7C]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto no-scrollbar">
          <Filter className="w-4 h-4 text-[#64748B] shrink-0" />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] text-[#1F2937] text-xs font-bold focus:outline-none focus:border-[#3A7D7C]"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] text-[#1F2937] text-xs font-bold focus:outline-none focus:border-[#3A7D7C]"
          >
            <option value="">All Kitchen Depts</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select
            value={onlineFilter}
            onChange={(e) => setOnlineFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] text-[#1F2937] text-xs font-bold focus:outline-none focus:border-[#3A7D7C]"
          >
            <option value="">All Channels</option>
            <option value="true">🌐 Online Menu Only</option>
            <option value="false">🏢 Offline Only</option>
          </select>

          <select
            value={vegFilter}
            onChange={(e) => setVegFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] text-[#1F2937] text-xs font-bold focus:outline-none focus:border-[#3A7D7C]"
          >
            <option value="">All Dietary</option>
            <option value="true">Veg Only 🟢</option>
            <option value="false">Non-Veg Only 🔴</option>
          </select>

          <button
            onClick={fetchMenuData}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors"
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
            <div key={i} className="h-64 rounded-2xl bg-white border border-[#D7E5E8] animate-pulse shadow-xs"></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-12 text-center text-[#64748B] shadow-xs">
          <Utensils className="w-12 h-12 text-[#64748B]/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#1F2937]">No Menu Items Found</h3>
          <p className="text-xs text-[#64748B] mt-1">Try adjusting search filters or add a new menu item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map(item => {
            const isOnline = item.is_available_online === 1 || item.is_available_online === null || item.is_available_online === undefined;
            return (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 group ${
                  item.is_available ? 'border-[#D7E5E8] hover:border-[#3A7D7C]' : 'border-rose-200 opacity-80'
                }`}
              >
                <div>
                  {/* Image Header */}
                  <div className="h-44 w-full relative overflow-hidden bg-slate-100">
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
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs ${
                        item.is_veg ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {item.is_veg ? 'VEG 🟢' : 'NON-VEG 🔴'}
                      </span>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs flex items-center gap-1 ${
                        isOnline ? 'bg-[#EAF4F7] text-[#3A7D7C] border-[#D7E5E8]' : 'bg-slate-100 text-[#64748B] border-[#D7E5E8]'
                      }`}>
                        <Globe className="w-2.5 h-2.5" />
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-white text-[#1F2937] border border-[#D7E5E8] shadow-xs">
                        ₹{parseFloat(item.price).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#3A7D7C] font-bold">
                      <span>{item.category_name}</span>
                      <span className="text-[#64748B] font-medium text-[11px]">{item.kitchen_department_name}</span>
                    </div>

                    <h3 className="text-base font-bold text-[#1F2937] group-hover:text-[#3A7D7C] transition-colors leading-snug">
                      {item.name}
                    </h3>

                    <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed">
                      {item.description || 'No description available.'}
                    </p>

                    <div className="flex items-center justify-between text-xs text-[#64748B] pt-2 border-t border-[#D7E5E8]">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-[#3A7D7C]" />
                        <span>{item.prep_time_minutes || 15} mins</span>
                        <span className="text-[10px] text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded border border-[#D7E5E8]">
                          Cap: {item.batch_capacity || 10}
                        </span>
                      </div>

                      <span className="text-[11px] text-[#64748B]">Tax: {item.tax_percentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-4 pt-0 border-t border-[#D7E5E8] space-y-2">
                  <div className="flex items-center justify-between gap-2 pt-2">
                    {/* Overall Availability Toggle */}
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      title="Toggle item availability in kitchen / POS"
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                        item.is_available
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {item.is_available ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{item.is_available ? 'Available' : 'Unavailable'}</span>
                    </button>

                    {/* Online Toggle Button */}
                    <button
                      onClick={() => handleToggleOnline(item)}
                      title={isOnline ? 'Click to hide from Online Website' : 'Click to enable on Online Website'}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border ${
                        isOnline
                          ? 'bg-[#EAF4F7] text-[#3A7D7C] border-[#D7E5E8] hover:bg-[#d5e7ec]'
                          : 'bg-slate-100 text-[#64748B] border-[#D7E5E8] hover:bg-slate-200'
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
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-[#D7E5E8] text-[#1F2937] transition-colors"
                      title="Edit Item"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-colors"
                      title="Deactivate Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Menu Item Create/Edit Modal */}
      <MenuItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        item={editingItem}
        categories={categories}
        departments={departments}
        modifierGroups={modifierGroups}
      />

      {/* Category Management Modal */}
      <CategoryModal
        isOpen={isCatModalOpen}
        onClose={() => {
          setIsCatModalOpen(false);
          setEditingCat(null);
        }}
        onSave={handleSaveCategory}
        categories={categories}
        category={editingCat}
        onEdit={(cat) => setEditingCat(cat)}
        onRefresh={fetchMenuData}
      />
    </div>
  );
}
