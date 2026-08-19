import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Layers, X, FolderTree } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [imageFile, setImageFile] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    fetchCategories();
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

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const url = selectedRestaurantId ? `/admin/categories?restaurant_id=${selectedRestaurantId}` : '/admin/categories';
      const res = await api.get(url);
      if (res.data.success) {
        setCategories(res.data.categories);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setDisplayOrder('0');
    setImageFile(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setDisplayOrder(cat.display_order ? cat.display_order.toString() : '0');
    setImageFile(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      fetchCategories();
    } catch (err) {
      alert('Failed to delete category.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('display_order', displayOrder);
      if (selectedRestaurantId) {
        formData.append('restaurant_id', selectedRestaurantId);
      }

      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (editingCategory) {
        await api.put(`/admin/categories/${editingCategory.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/admin/categories', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setShowModal(false);
      fetchCategories();

    } catch (err) {
      alert(err.response?.data?.message || 'Error saving category.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 antialiased font-sans">
        
        {/* Header */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
              <FolderTree className="w-6 h-6 text-[#3A7D7C]" />
              <span>Online Menu Categories</span>
            </h2>
            <p className="text-[#64748B] text-xs sm:text-sm mt-0.5 font-medium">Organize your online food catalog and storefront category layout</p>
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
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-[#64748B] text-xs">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="col-span-full py-12 text-center text-[#64748B] text-xs font-medium">
              No categories found. Click "Add Category" to get started.
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-2xl p-4 sm:p-5 border border-[#D7E5E8] shadow-xs flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <img
                    src={cat.image_url || 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=200&q=80'}
                    alt={cat.name}
                    className="w-14 h-14 rounded-xl object-cover border border-[#D7E5E8] shrink-0"
                  />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#3A7D7C] bg-[#EAF4F7] px-2 py-0.5 rounded-md border border-[#D7E5E8]">
                      Order #{cat.display_order}
                    </span>
                    <h3 className="font-bold text-sm text-[#1F2937] mt-1.5">{cat.name}</h3>
                    <p className="text-xs text-[#64748B] line-clamp-2 mt-0.5">{cat.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="p-2 text-[#64748B] hover:text-[#3A7D7C] hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-2 text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#D7E5E8] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-3">
              <h3 className="font-bold text-base text-[#1F2937]">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-[#64748B] hover:text-[#1F2937] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starters & Appetizers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Category description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                ></textarea>
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Display Order</label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Category Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                  className="w-full p-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                />
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
                  {formLoading ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
