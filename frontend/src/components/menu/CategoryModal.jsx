import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

export default function CategoryModal({ isOpen, onClose, onSave, editingCategory }) {
  const [name, setName] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name || '');
      setDisplayOrder(editingCategory.display_order || 0);
    } else {
      setName('');
      setDisplayOrder(0);
    }
  }, [editingCategory, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, display_order: displayOrder });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCategory ? 'Edit Menu Category' : 'Add New Category'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#1F2937] mb-1">Category Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Starters, Main Course, Beverages"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C] text-sm font-semibold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#1F2937] mb-1">Display Order Priority</label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:border-[#3A7D7C] text-sm font-semibold"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[#D7E5E8]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-[#1F2937] hover:bg-slate-200 text-sm font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-sm transition-colors shadow-2xs"
          >
            Save Category
          </button>
        </div>
      </form>
    </Modal>
  );
}
