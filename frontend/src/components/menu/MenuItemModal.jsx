import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { Globe, Sparkles } from 'lucide-react';

export default function MenuItemModal({ isOpen, onClose, onSave, editingItem, categories, departments, modifierGroups }) {
  const [formData, setFormData] = useState({
    category_id: '',
    kitchen_department_id: '',
    name: '',
    description: '',
    image_url: '',
    price: '',
    tax_percentage: 5.0,
    is_veg: true,
    prep_time_minutes: 15,
    is_available: true,
    is_available_online: true,
    modifier_group_ids: []
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        category_id: editingItem.category_id || '',
        kitchen_department_id: editingItem.kitchen_department_id || '',
        name: editingItem.name || '',
        description: editingItem.description || '',
        image_url: editingItem.image_url || '',
        price: editingItem.price || '',
        tax_percentage: editingItem.tax_percentage || 5.0,
        is_veg: editingItem.is_veg !== undefined ? Boolean(editingItem.is_veg) : true,
        prep_time_minutes: editingItem.prep_time_minutes || 15,
        is_available: editingItem.is_available !== undefined ? Boolean(editingItem.is_available) : true,
        is_available_online: editingItem.is_available_online !== undefined ? Boolean(editingItem.is_available_online) : true,
        modifier_group_ids: editingItem.modifiers ? editingItem.modifiers.map(m => m.id) : []
      });
    } else {
      setFormData({
        category_id: categories.length > 0 ? categories[0].id : '',
        kitchen_department_id: departments.length > 0 ? departments[0].id : '',
        name: '',
        description: '',
        image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        price: '',
        tax_percentage: 5.0,
        is_veg: true,
        prep_time_minutes: 15,
        is_available: true,
        is_available_online: true,
        modifier_group_ids: []
      });
    }
  }, [editingItem, isOpen, categories, departments]);

  const toggleModifierGroup = (groupId) => {
    const current = [...formData.modifier_group_ids];
    if (current.includes(groupId)) {
      setFormData({ ...formData, modifier_group_ids: current.filter(id => id !== groupId) });
    } else {
      setFormData({ ...formData, modifier_group_ids: [...current, groupId] });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      price: parseFloat(formData.price),
      tax_percentage: parseFloat(formData.tax_percentage),
      prep_time_minutes: parseInt(formData.prep_time_minutes)
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? `Edit Menu Item - ${editingItem.name}` : 'Add New Menu Item'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Item Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g. Chicken Biryani"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Price (₹) *</label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
              placeholder="e.g. 380.00"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Category *</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
            >
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Kitchen Department *</label>
            <select
              value={formData.kitchen_department_id}
              onChange={(e) => setFormData({ ...formData, kitchen_department_id: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
            >
              <option value="">Select Kitchen</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="2"
            placeholder="Brief item ingredients or taste description..."
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
          ></textarea>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Food Image URL</label>
          <input
            type="url"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="https://images.unsplash.com/..."
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Tax (%)</label>
            <input
              type="number"
              step="0.1"
              value={formData.tax_percentage}
              onChange={(e) => setFormData({ ...formData, tax_percentage: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Prep Time (mins)</label>
            <input
              type="number"
              value={formData.prep_time_minutes}
              onChange={(e) => setFormData({ ...formData, prep_time_minutes: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Food Type</label>
            <select
              value={formData.is_veg ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, is_veg: e.target.value === 'true' })}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
            >
              <option value="true">Veg 🟢</option>
              <option value="false">Non-Veg 🔴</option>
            </select>
          </div>
        </div>

        {/* Online Ordering Toggle Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border transition-colors ${formData.is_available_online ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Show in Online Customer Menu</span>
                {formData.is_available_online ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded border border-emerald-500/30">
                    ONLINE ACTIVE 🌐
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-800 text-slate-400 font-medium px-2 py-0.5 rounded border border-slate-700">
                    OFFLINE ONLY
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                When enabled, customers can view & order this dish on your online website.
              </div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_available_online}
              onChange={(e) => setFormData({ ...formData, is_available_online: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        {/* Modifiers Selection */}
        {modifierGroups && modifierGroups.length > 0 && (
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-2">Attach Modifier / Customization Groups</label>
            <div className="grid grid-cols-2 gap-2">
              {modifierGroups.map(mg => (
                <label
                  key={mg.id}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    formData.modifier_group_ids.includes(mg.id)
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 font-semibold'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.modifier_group_ids.includes(mg.id)}
                    onChange={() => toggleModifierGroup(mg.id)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <span>{mg.name} ({mg.options ? mg.options.length : 0} options)</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-sm transition-colors shadow-lg shadow-amber-500/20"
          >
            {editingItem ? 'Save Item Changes' : 'Create Menu Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
