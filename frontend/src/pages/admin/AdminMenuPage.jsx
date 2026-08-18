import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Leaf, Flame, Clock, ToggleLeft, ToggleRight, X, Image as ImageIcon } from 'lucide-react';
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
  const [prepTime, setPrepTime] = useState('20');
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
      // Non-superadmin users may get 403, which is fine - backend will resolve their assigned restaurant
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
    setPrepTime('20');
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
    setPrepTime(item.prep_time_minutes ? item.prep_time_minutes.toString() : '20');
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

    try {
      const formData = new FormData();
      formData.append('category_id', categoryId);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);
      if (discountedPrice) formData.append('discounted_price', discountedPrice);
      formData.append('is_veg', isVeg ? '1' : '0');
      formData.append('prep_time_minutes', prepTime);
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
      <div className="space-y-6">
        
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white">Menu Items Management</h2>
            <p className="text-xs text-slate-400">Add, edit, upload photos, and toggle food availability</p>
          </div>

          <div className="flex items-center gap-3">
            {restaurants.length > 0 && (
              <select
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
                className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 shadow-xs"
              >
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-orange-500/20 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Food Item
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-panel bg-slate-900/90 p-4 rounded-2xl border border-slate-800/80 shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dishes by name or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-56 p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-200"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="glass-panel bg-slate-900/90 rounded-2xl border border-slate-800/80 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-4">Food Item</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status / Availability</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80'}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-800"
                        />
                        <div>
                          <span className="font-extrabold text-white block text-sm">{item.name}</span>
                          <span className="text-[11px] text-slate-400 line-clamp-1">{item.description}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="bg-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded-md text-[11px] border border-slate-700">
                        {item.category_name}
                      </span>
                    </td>

                    <td className="p-4 font-black text-amber-400">
                      ₹{item.discounted_price ? item.discounted_price : item.price}
                      {item.discounted_price && (
                        <span className="text-[10px] text-slate-500 line-through block font-normal">₹{item.price}</span>
                      )}
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                        item.is_veg === 1 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                      }`}>
                        {item.is_veg === 1 ? 'Veg 🟢' : 'Non-Veg 🔴'}
                      </span>
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          item.is_available === 1
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}
                      >
                        {item.is_available === 1 ? 'Available (ON)' : 'Out of Stock (OFF)'}
                      </button>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Edit Item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingItem ? 'Edit Food Item' : 'Add New Food Item'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Food Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paneer Butter Masala"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Detailed food description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Original Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="350"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discounted Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="299"
                    value={discountedPrice}
                    onChange={(e) => setDiscountedPrice(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Food Type</label>
                  <select
                    value={isVeg ? '1' : '0'}
                    onChange={(e) => setIsVeg(e.target.value === '1')}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="1">Vegetarian 🟢</option>
                    <option value="0">Non-Vegetarian 🔴</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prep Time (Mins)</label>
                  <input
                    type="number"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tags (Comma separated)</label>
                <input
                  type="text"
                  placeholder="Spicy, Chef Special, Tandoori"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Upload Food Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={isBestseller}
                    onChange={(e) => setIsBestseller(e.target.checked)}
                    className="text-orange-500 rounded"
                  />
                  Mark Bestseller 🔥
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="text-emerald-500 rounded"
                  />
                  Available for Order
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md"
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
