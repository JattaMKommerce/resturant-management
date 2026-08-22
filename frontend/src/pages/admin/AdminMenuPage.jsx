import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Leaf, Flame, Clock, ToggleLeft, ToggleRight, X, Image as ImageIcon, UtensilsCrossed } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

export default function AdminMenuPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [prepTime, setPrepTime] = useState('15');
  const [batchCapacity, setBatchCapacity] = useState('10');
  const [ingredients, setIngredients] = useState('');
  const [tags, setTags] = useState('');
  const [isBestseller, setIsBestseller] = useState(false);
  const [isRecommended, setIsRecommended] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageFile, setImageFile] = useState(null);

  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedRestaurantId]);

  const fetchRestaurants = async () => {
    try {
      const res = await api.get('/superadmin/restaurants');
      if (res.data.success && res.data.restaurants?.length > 0) {
        setRestaurants(res.data.restaurants);
        setSelectedRestaurantId(res.data.restaurants[0].id.toString());
      }
    } catch (err) {
      // Non-superadmin users will have restaurant auto-resolved by backend
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const urlQuery = selectedRestaurantId ? `?restaurant_id=${selectedRestaurantId}` : '';
      const catRes = await api.get(`/admin/categories${urlQuery}`);
      if (catRes.data.success) {
        setCategories(catRes.data.categories);
      }

      const menuRes = await api.get(`/admin/menu${urlQuery}`);
      if (menuRes.data.success) {
        setMenuItems(menuRes.data.items);
      }
    } catch (err) {
      console.error('Error fetching menu items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setCategoryId(categories[0]?.id || '');
    setName('');
    setDescription('');
    setPrice('');
    setDiscountedPrice('');
    setIsVeg(true);
    setPrepTime('15');
    setBatchCapacity('10');
    setIngredients('');
    setTags('');
    setIsBestseller(false);
    setIsRecommended(false);
    setIsAvailable(true);
    setImageFile(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setCategoryId(item.category_id);
    setName(item.name);
    setDescription(item.description || '');
    setPrice(item.price);
    setDiscountedPrice(item.discounted_price || '');
    setIsVeg(item.is_veg === 1);
    setPrepTime(item.prep_time_minutes ? item.prep_time_minutes.toString() : '15');
    setBatchCapacity(item.batch_capacity ? item.batch_capacity.toString() : '10');
    setIngredients(item.ingredients || '');
    setTags(item.tags || '');
    setIsBestseller(item.is_bestseller === 1);
    setIsRecommended(item.is_recommended === 1);
    setIsAvailable(item.is_available === 1);
    setImageFile(null);
    setShowModal(true);
  };

  const handleToggleAvailability = async (item) => {
    const newStatus = item.is_available === 1 ? false : true;
    try {
      await api.patch(`/admin/menu/${item.id}/availability`, { is_available: newStatus });
      fetchData();
    } catch (err) {
      alert('Failed to update availability.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await api.delete(`/admin/menu/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete item.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    const parsedPrep = parseInt(prepTime);
    if (isNaN(parsedPrep) || parsedPrep <= 0) {
      alert('Preparation Time must be a valid number greater than 0.');
      setFormLoading(false);
      return;
    }

    const parsedCap = parseInt(batchCapacity);
    if (isNaN(parsedCap) || parsedCap <= 0) {
      alert('Batch Capacity must be a valid number greater than 0.');
      setFormLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('category_id', categoryId);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);
      if (discountedPrice) formData.append('discounted_price', discountedPrice);
      formData.append('is_veg', isVeg ? '1' : '0');
      formData.append('prep_time_minutes', prepTime);
      formData.append('batch_capacity', batchCapacity);
      formData.append('ingredients', ingredients);
      formData.append('tags', tags);
      formData.append('is_bestseller', isBestseller ? '1' : '0');
      formData.append('is_recommended', isRecommended ? '1' : '0');
      formData.append('is_available', isAvailable ? '1' : '0');
      if (selectedRestaurantId) {
        formData.append('restaurant_id', selectedRestaurantId);
      }

      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (editingItem) {
        await api.put(`/admin/menu/${editingItem.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/admin/menu', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setShowModal(false);
      fetchData();

    } catch (err) {
      alert(err.response?.data?.message || 'Error saving menu item.');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    if (categoryFilter && item.category_id !== parseInt(categoryFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.name.toLowerCase().includes(q) || (item.tags && item.tags.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6 antialiased font-sans">
        
        {/* Top Header & Actions */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-[#3A7D7C]" />
              <span>Online Menu Management</span>
            </h2>
            <p className="text-[#64748B] text-xs sm:text-sm mt-0.5 font-medium">Add, edit, upload photos, and toggle online food availability</p>
          </div>

          <div className="flex items-center gap-3">
            {restaurants.length > 0 && (
              <select
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
                className="p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs font-bold text-[#1F2937] shadow-2xs focus:outline-none focus:border-[#3A7D7C]"
              >
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Food Item
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dishes by name or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs font-semibold text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-56 p-2 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs font-semibold text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-slate-50 text-[#64748B] font-bold uppercase tracking-wider text-[11px] border-b border-[#D7E5E8]">
                <tr>
                  <th className="p-4">Food Item</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Prep & Batch</th>
                  <th className="p-4">Status / Availability</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D7E5E8] font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-[#64748B] text-xs">Loading food items...</td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-[#64748B] text-xs font-medium">No menu items found.</td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80'}
                            alt={item.name}
                            className="w-12 h-12 rounded-xl object-cover border border-[#D7E5E8]"
                          />
                          <div>
                            <span className="font-bold text-[#1F2937] block text-sm">{item.name}</span>
                            <span className="text-[11px] text-[#64748B] line-clamp-1">{item.description}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="bg-[#EAF4F7] text-[#3A7D7C] font-bold px-2.5 py-1 rounded-md text-[11px] border border-[#D7E5E8]">
                          {item.category_name}
                        </span>
                      </td>

                      <td className="p-4 font-bold text-[#1F2937] font-mono text-sm">
                        ₹{item.discounted_price ? item.discounted_price : item.price}
                        {item.discounted_price && (
                          <span className="text-[10px] text-[#64748B] line-through block font-normal">₹{item.price}</span>
                        )}
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                          item.is_veg === 1 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {item.is_veg === 1 ? 'Veg 🟢' : 'Non-Veg 🔴'}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-bold text-[#1F2937] text-xs">
                            <Clock className="w-3.5 h-3.5 text-[#3A7D7C]" />
                            <span>{item.prep_time_minutes || 15} mins</span>
                          </div>
                          <div className="text-[10px] text-[#64748B] font-medium">
                            Batch: {item.batch_capacity || 10} portions
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                            item.is_available === 1
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {item.is_available === 1 ? 'Available (ON)' : 'Out of Stock (OFF)'}
                        </button>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-[#3A7D7C] hover:bg-[#EAF4F7] border border-[#D7E5E8] rounded-lg transition-colors"
                            title="Edit Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#D7E5E8] shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-3">
              <h3 className="font-bold text-base text-[#1F2937]">{editingItem ? 'Edit Food Item' : 'Add New Food Item'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Category *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Food Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paneer Butter Masala"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Detailed food description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Original Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="350"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Discounted Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="299"
                    value={discountedPrice}
                    onChange={(e) => setDiscountedPrice(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Food Type</label>
                <select
                  value={isVeg ? '1' : '0'}
                  onChange={(e) => setIsVeg(e.target.value === '1')}
                  className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                >
                  <option value="1">Vegetarian 🟢</option>
                  <option value="0">Non-Vegetarian 🔴</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Preparation Time (minutes) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="15"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1F2937] mb-1">Batch Capacity (portions) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="10"
                    value={batchCapacity}
                    onChange={(e) => setBatchCapacity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Tags (Comma separated)</label>
                <input
                  type="text"
                  placeholder="Spicy, Chef Special, Tandoori"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Upload Food Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                  className="w-full p-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#1F2937]">
                  <input
                    type="checkbox"
                    checked={isBestseller}
                    onChange={(e) => setIsBestseller(e.target.checked)}
                    className="accent-[#3A7D7C] rounded"
                  />
                  Mark Bestseller 🔥
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#1F2937]">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="accent-[#3A7D7C] rounded"
                  />
                  Available for Order
                </label>
              </div>

              <div className="pt-4 border-t border-[#D7E5E8] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-[#1F2937] font-bold rounded-xl border border-[#D7E5E8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl shadow-2xs transition-colors"
                >
                  {formLoading ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
