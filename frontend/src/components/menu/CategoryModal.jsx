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
          <label className="block text-xs font-semibold text-slate-300 mb-1">Category Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Starters, Main Course, Beverages"
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Display Order Priority</label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-amber-500 text-sm"
          />
        </div>

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
            Save Category
          </button>
        </div>
      </form>
    </Modal>
  );
}
