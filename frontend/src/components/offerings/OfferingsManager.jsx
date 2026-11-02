import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Upload, Image as ImageIcon, Loader2, Eye, EyeOff, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../common/Modal';
import { OFFERING_TYPES, getOfferingType, formatOfferingPrice } from '../../config/offerings';
import { getMediaUrl, validateImageFile } from '../../utils/media';

const EMPTY_FORM = {
  offering_type: 'TODAYS_SPECIAL',
  title: '',
  description: '',
  price: '',
  available_time: '',
  includes_text: '',
  is_veg: '',
  is_active: true
};

const inputClass =
  'w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] text-xs focus:outline-none focus:border-[#3A7D7C]';

/**
 * Add / edit / delete the restaurant's storefront offerings
 * (Today's Special, Brunch, Lunch, Dinner, Combos). Every change saves immediately.
 */
export default function OfferingsManager() {
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [busyId, setBusyId] = useState(null);

  // Modal form state. `editing` is null when closed, {} for a new offering, or the offering being edited.
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const loadOfferings = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/admin/offerings');
      setOfferings(res.data?.offerings || []);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load offerings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfferings();
  }, []);

  // Free the temporary preview URL when it is replaced or the modal closes.
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const counts = useMemo(() => {
    const byType = { ALL: offerings.length };
    offerings.forEach(o => { byType[o.offering_type] = (byType[o.offering_type] || 0) + 1; });
    return byType;
  }, [offerings]);

  const visibleOfferings = filter === 'ALL' ? offerings : offerings.filter(o => o.offering_type === filter);

  const openNew = () => {
    setEditing({});
    setForm({ ...EMPTY_FORM, offering_type: filter === 'ALL' ? EMPTY_FORM.offering_type : filter });
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setFormError('');
  };

  const openEdit = (offering) => {
    setEditing(offering);
    setForm({
      offering_type: offering.offering_type,
      title: offering.title || '',
      description: offering.description || '',
      price: offering.price ?? '',
      available_time: offering.available_time || '',
      includes_text: offering.includes_text || '',
      is_veg: offering.is_veg === null || offering.is_veg === undefined ? '' : String(Number(offering.is_veg)),
      is_active: Boolean(Number(offering.is_active))
    });
    setImageFile(null);
    setImagePreview(getMediaUrl(offering.image_url));
    setRemoveImage(false);
    setFormError('');
  };

  const closeModal = () => {
    if (saving) return;
    setEditing(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setFormError(problem);
      e.target.value = '';
      return;
    }
    setFormError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Please enter a title for this offering.');
      return;
    }
    if (form.price !== '' && (!Number.isFinite(Number(form.price)) || Number(form.price) < 0)) {
      setFormError('Price must be a positive number.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('offering_type', form.offering_type);
      fd.append('title', form.title.trim());
      fd.append('description', form.description);
      fd.append('price', form.price === null ? '' : String(form.price));
      fd.append('available_time', form.available_time);
      fd.append('includes_text', form.includes_text);
      fd.append('is_veg', form.is_veg);
      fd.append('is_active', form.is_active ? '1' : '0');
      if (imageFile) fd.append('image', imageFile);
      else if (removeImage) fd.append('remove_image', '1');

      const isEdit = Boolean(editing?.id);
      const res = isEdit
        ? await api.put(`/admin/offerings/${editing.id}`, fd)
        : await api.post('/admin/offerings', fd);

      const saved = res.data?.offering;
      if (saved) {
        setOfferings(prev => (isEdit ? prev.map(o => (o.id === saved.id ? saved : o)) : [saved, ...prev]));
      } else {
        await loadOfferings();
      }
      setEditing(null);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save this offering. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (offering) => {
    setBusyId(offering.id);
    try {
      const res = await api.put(`/admin/offerings/${offering.id}`, { is_active: Number(offering.is_active) ? 0 : 1 });
      const saved = res.data?.offering;
      if (saved) setOfferings(prev => prev.map(o => (o.id === saved.id ? saved : o)));
    } catch (err) {
      alert(err.response?.data?.message || 'Could not update this offering.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (offering) => {
    if (!window.confirm(`Delete "${offering.title}"? This cannot be undone.`)) return;
    setBusyId(offering.id);
    try {
      await api.delete(`/admin/offerings/${offering.id}`);
      setOfferings(prev => prev.filter(o => o.id !== offering.id));
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete this offering.');
    } finally {
      setBusyId(null);
    }
  };

  const selectedType = getOfferingType(form.offering_type);

  return (
    <div className="space-y-4 text-xs">
      {/* Type filter + add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: 'ALL', label: 'All', emoji: '' }, ...OFFERING_TYPES].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-xl font-bold border transition-colors ${filter === t.id
                ? 'bg-[#3A7D7C] text-white border-[#3A7D7C]'
                : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]/40'
                }`}
            >
              {t.emoji && <span className="mr-1">{t.emoji}</span>}
              {t.label}
              <span className={`ml-1.5 ${filter === t.id ? 'text-white/80' : 'text-[#64748B]'}`}>{counts[t.id] || 0}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openNew}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl shadow-2xs transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Offering
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-[#64748B] font-semibold flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading offerings...
        </div>
      ) : loadError ? (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {loadError}</span>
          <button type="button" onClick={loadOfferings} className="inline-flex items-center gap-1 text-rose-700 hover:underline">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : visibleOfferings.length === 0 ? (
        <div className="p-6 rounded-2xl border-2 border-dashed border-[#D7E5E8] bg-slate-50 text-center space-y-2">
          <p className="font-bold text-[#1F2937] text-sm">
            {filter === 'ALL' ? 'No offerings yet' : `No ${getOfferingType(filter).label} offerings yet`}
          </p>
          <p className="text-[#64748B] max-w-md mx-auto">
            Add your Today's Special, Brunch, Lunch, Dinner menus and Combos with a photo and description. They appear in the
            "What We Offer" section of your website.
          </p>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 mt-1 bg-white text-[#3A7D7C] font-bold rounded-xl border border-[#3A7D7C]/40 hover:bg-[#EAF4F7] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add your first offering
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleOfferings.map(o => {
            const type = getOfferingType(o.offering_type);
            const active = Boolean(Number(o.is_active));
            const img = getMediaUrl(o.image_url);
            const price = formatOfferingPrice(o.price);
            const busy = busyId === o.id;
            return (
              <div
                key={o.id}
                className={`rounded-2xl border bg-white overflow-hidden flex flex-col shadow-2xs ${active ? 'border-[#D7E5E8]' : 'border-dashed border-slate-300 opacity-70'}`}
              >
                <div className="relative h-28 bg-slate-100">
                  {img ? (
                    <img src={img} alt={o.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">{type.emoji}</div>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/95 text-[#1F2937] font-bold text-[10px] border border-[#D7E5E8]">
                    {type.emoji} {type.label}
                  </span>
                  {!active && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-800/90 text-white font-bold text-[10px]">
                      Hidden from website
                    </span>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-sm text-[#1F2937] flex items-center gap-1.5 min-w-0">
                      {o.is_veg !== null && o.is_veg !== undefined && (
                        <span
                          title={Number(o.is_veg) ? 'Veg' : 'Non-veg'}
                          className={`w-3 h-3 shrink-0 rounded-xs border flex items-center justify-center ${Number(o.is_veg) ? 'border-emerald-600' : 'border-rose-600'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${Number(o.is_veg) ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                        </span>
                      )}
                      <span className="truncate">{o.title}</span>
                    </span>
                    {price && <span className="font-extrabold text-[#3A7D7C] shrink-0">{price}</span>}
                  </div>
                  {o.available_time && (
                    <span className="text-[11px] text-[#64748B] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {o.available_time}
                    </span>
                  )}
                  {o.description && <p className="text-[#64748B] line-clamp-2">{o.description}</p>}
                  {o.includes_text && (
                    <p className="text-[11px] text-[#1F2937] line-clamp-1">
                      <span className="font-bold">Includes:</span> {o.includes_text}
                    </p>
                  )}
                </div>
                <div className="px-3 pb-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleToggleActive(o)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-xl border border-[#D7E5E8] bg-slate-50 hover:bg-slate-100 font-bold text-[#1F2937] disabled:opacity-50"
                    title={active ? 'Hide from website' : 'Show on website'}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openEdit(o)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-xl border border-[#3A7D7C]/40 bg-[#EAF4F7] hover:bg-[#dcecef] font-bold text-[#3A7D7C] disabled:opacity-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(o)}
                    className="inline-flex items-center justify-center p-2 rounded-xl border border-[#D7E5E8] bg-white text-[#64748B] hover:text-rose-600 hover:border-rose-200 disabled:opacity-50"
                    title="Delete offering"
                    aria-label={`Delete ${o.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit form */}
      <Modal
        isOpen={editing !== null}
        onClose={closeModal}
        title={editing?.id ? 'Edit Offering' : 'Add Offering'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <span className="block font-bold text-[#1F2937] mb-1.5">What are you offering? *</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {OFFERING_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, offering_type: t.id }))}
                  className={`py-2 px-2 rounded-xl border font-bold transition-colors ${form.offering_type === t.id
                    ? 'bg-[#3A7D7C] text-white border-[#3A7D7C]'
                    : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]/40'
                    }`}
                >
                  <span className="block text-base leading-none mb-0.5">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="offering-title" className="block font-bold text-[#1F2937] mb-1">Title *</label>
            <input
              id="offering-title"
              type="text"
              maxLength={150}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={form.offering_type === 'COMBO' ? 'e.g. Family Biryani Combo' : `e.g. ${selectedType.label} Thali`}
              className={inputClass}
            />
          </div>

          {/* Image */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-[#D7E5E8] flex items-center gap-3">
            <div className="w-24 h-20 shrink-0 rounded-xl bg-white border border-[#D7E5E8] overflow-hidden flex items-center justify-center">
              {imagePreview ? (
                <img src={imagePreview} alt="Offering" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-[#64748B]/60" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-[11px] text-[#64748B]">Photo shown on your website. JPG, PNG or WebP, up to 5MB.</p>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleImageChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" /> {imagePreview ? 'Change Photo' : 'Upload Photo'}
                </button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-white text-[#64748B] hover:text-rose-600 font-bold rounded-xl border border-[#D7E5E8]"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="offering-description" className="block font-bold text-[#1F2937] mb-1">Description</label>
            <textarea
              id="offering-description"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Tell customers what makes it special: taste, portion size, serves how many..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="offering-price" className="block font-bold text-[#1F2937] mb-1">Price (₹)</label>
              <input
                id="offering-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="Optional"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="offering-time" className="block font-bold text-[#1F2937] mb-1">Available Time</label>
              <input
                id="offering-time"
                type="text"
                maxLength={100}
                value={form.available_time}
                onChange={e => setForm(f => ({ ...f, available_time: e.target.value }))}
                placeholder={selectedType.timeHint}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="offering-includes" className="block font-bold text-[#1F2937] mb-1">What's Included</label>
            <textarea
              id="offering-includes"
              rows={2}
              value={form.includes_text}
              onChange={e => setForm(f => ({ ...f, includes_text: e.target.value }))}
              placeholder="e.g. Veg Biryani, Raita, Gulab Jamun, Soft Drink"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div>
              <span className="block font-bold text-[#1F2937] mb-1">Food Type</span>
              <div className="flex gap-1.5">
                {[
                  { value: '1', label: '🟢 Veg' },
                  { value: '0', label: '🔴 Non-Veg' },
                  { value: '', label: 'Mixed / N/A' }
                ].map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_veg: opt.value }))}
                    className={`px-3 py-1.5 rounded-xl border font-bold transition-colors ${form.is_veg === opt.value
                      ? 'bg-[#3A7D7C] text-white border-[#3A7D7C]'
                      : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:border-[#3A7D7C]/40'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 font-bold text-[#1F2937] cursor-pointer sm:mt-5">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="accent-[#3A7D7C] w-4 h-4"
              />
              Show on website
            </label>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-[#D7E5E8]">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] font-bold rounded-xl border border-[#D7E5E8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-2xs disabled:opacity-70"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing?.id ? 'Save Changes' : 'Add Offering'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
