import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  BedDouble,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Search,
  X,
  Users,
  Building2,
  Sliders,
  DollarSign,
  Tag,
  ImageIcon,
  Check,
  UploadCloud,
  Star,
  Image as ImageIcon2
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '') || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:5000');

const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function RoomStoreSettingsTab({ showToast }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingRoom, setEditingRoom] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Room Form State
  const [form, setForm] = useState({
    room_number: '',
    room_type: 'Deluxe Suite',
    floor: '1st Floor',
    rate_per_night: 1999,
    capacity: 2,
    bed_type: 'King Bed',
    room_size: '350 sq.ft',
    description: '',
    amenities: 'High-Speed Wi-Fi, 100% AC, Free Breakfast, Smart TV, Mini Bar',
    image_url: '',
    images: [],
    status: 'VACANT'
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  // Website Amenities Editor State
  const [websiteAmenities, setWebsiteAmenities] = useState([
    'High-Speed Wi-Fi',
    '100% AC Suites',
    'Free Breakfast',
    'Valet Parking',
    '24/7 Housekeeping'
  ]);
  const [newAmenityInput, setNewAmenityInput] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rooms');
      const payload = res?.data || res;
      const list =
        payload?.rooms ||
        payload?.data?.rooms ||
        res?.rooms ||
        res?.data?.rooms ||
        res?.data?.data?.rooms ||
        (Array.isArray(payload) ? payload : []);
      setRooms(list);
    } catch (err) {
      console.error('Failed to load rooms for store management:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingRoom(null);
    const defaultCover = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80';
    setForm({
      room_number: `${Math.floor(100 + Math.random() * 900)}`,
      room_type: 'Deluxe Suite',
      floor: '1st Floor',
      rate_per_night: 2499,
      capacity: 2,
      bed_type: 'King Bed',
      room_size: '350 sq.ft',
      description: 'Luxury air-conditioned suite with modern decor, high-speed Wi-Fi, and plush king bedding.',
      amenities: 'High-Speed Wi-Fi, 100% AC, Free Breakfast, Smart TV, Mini Bar',
      image_url: defaultCover,
      images: [defaultCover],
      status: 'VACANT'
    });
    setCustomUrlInput('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room) => {
    setEditingRoom(room);
    const primaryImg = room.image_url || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80';
    let roomImages = [];
    if (Array.isArray(room.images) && room.images.length > 0) {
      roomImages = room.images;
    } else {
      roomImages = [primaryImg];
    }

    setForm({
      room_number: room.room_number || '',
      room_type: room.room_type || 'Deluxe Suite',
      floor: room.floor || '1st Floor',
      rate_per_night: room.rate_per_night || room.base_price || 1999,
      capacity: room.capacity || 2,
      bed_type: room.bed_type || 'King Bed',
      room_size: room.room_size || '350 sq.ft',
      description: room.description || '',
      amenities: Array.isArray(room.amenities) ? room.amenities.join(', ') : (room.amenities || ''),
      image_url: primaryImg,
      images: roomImages,
      status: room.status || 'VACANT'
    });
    setCustomUrlInput('');
    setIsModalOpen(true);
  };

  // Upload image files from computer
  const handleImageFilesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingImages(true);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('images', file));

      const res = await api.post('/admin/upload-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success && res.data.imageUrls) {
        const uploaded = res.data.imageUrls;
        setForm(prev => {
          const currentImages = prev.images || [];
          const combined = [...currentImages, ...uploaded];
          return {
            ...prev,
            images: combined,
            image_url: prev.image_url || uploaded[0] || ''
          };
        });
        if (showToast) showToast(`🎉 ${uploaded.length} photo(s) uploaded successfully!`);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      alert(err.response?.data?.message || err.message || 'Failed to upload images from system.');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleAddCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    const url = customUrlInput.trim();
    setForm(prev => {
      const combined = [...(prev.images || []), url];
      return {
        ...prev,
        images: combined,
        image_url: prev.image_url || url
      };
    });
    setCustomUrlInput('');
  };

  const handleRemoveImage = (indexToRemove) => {
    setForm(prev => {
      const updatedImages = (prev.images || []).filter((_, idx) => idx !== indexToRemove);
      const newCover = updatedImages.length > 0
        ? (prev.image_url === prev.images[indexToRemove] ? updatedImages[0] : prev.image_url)
        : '';
      return {
        ...prev,
        images: updatedImages,
        image_url: newCover
      };
    });
  };

  const handleSetPrimaryCover = (imgUrl) => {
    setForm(prev => ({
      ...prev,
      image_url: imgUrl
    }));
    if (showToast) showToast('Set as primary cover photo');
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        image_url: form.image_url || (form.images && form.images[0]) || ''
      };

      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.id}`, payload);
        if (showToast) showToast('Room updated successfully!');
      } else {
        await api.post('/rooms', payload);
        if (showToast) showToast('New room added to website store!');
      }
      setIsModalOpen(false);
      fetchRooms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save room details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to delete this room from the website store?')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      if (showToast) showToast('Room deleted successfully');
      fetchRooms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete room');
    }
  };

  const handleAddWebsiteAmenity = () => {
    if (!newAmenityInput.trim()) return;
    if (!websiteAmenities.includes(newAmenityInput.trim())) {
      const updated = [...websiteAmenities, newAmenityInput.trim()];
      setWebsiteAmenities(updated);
      if (showToast) showToast('Website amenity added!');
    }
    setNewAmenityInput('');
  };

  const handleRemoveWebsiteAmenity = (index) => {
    const updated = websiteAmenities.filter((_, i) => i !== index);
    setWebsiteAmenities(updated);
  };

  const filteredRooms = rooms.filter(r =>
    !search ||
    String(r.room_number).toLowerCase().includes(search.toLowerCase()) ||
    String(r.room_type).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="bg-white rounded-3xl border border-[#D7E5E8] p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D7E5E8] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[#3A7D7C] text-white shadow-md shadow-[#3A7D7C]/20">
              <BedDouble className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Website Room Store & Multi-Image Gallery
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Multiple Photos Support
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Add rooms, upload multiple photos from your system, and manage pricing for your website.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Room</span>
          </button>
        </div>

        {/* WEBSITE HOTEL AMENITIES SETTINGS */}
        <div className="pt-5 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#3A7D7C]" />
            Hotel Amenities Displayed on Website
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            {websiteAmenities.map((amenity, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5"
              >
                <span>{amenity}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveWebsiteAmenity(idx)}
                  className="text-slate-400 hover:text-rose-600 font-bold ml-1"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 max-w-md pt-1">
            <input
              type="text"
              placeholder="Add amenity (e.g. Swimming Pool, Valet Parking)..."
              value={newAmenityInput}
              onChange={(e) => setNewAmenityInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWebsiteAmenity()}
              className="flex-1 px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
            />
            <button
              onClick={handleAddWebsiteAmenity}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & ROOMS GRID */}
      <div className="bg-white rounded-3xl border border-[#D7E5E8] p-4 flex items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search room number or suite name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-[#D7E5E8] rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3A7D7C]"
          />
        </div>

        <span className="text-xs font-bold text-slate-500">
          Total Rooms: <strong className="text-slate-900">{filteredRooms.length}</strong>
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-[#D7E5E8] p-12 text-center space-y-3 shadow-2xs">
          <RefreshCw className="w-8 h-8 text-[#3A7D7C] animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading hotel rooms catalog...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#D7E5E8] p-12 text-center space-y-3 shadow-2xs">
          <BedDouble className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-900">No Rooms Found</h3>
          <p className="text-xs text-slate-500">Click "Add New Room" to add rooms to your website store.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room) => {
            const price = room.rate_per_night || room.base_price || 1999;
            const photosCount = Array.isArray(room.images) ? room.images.length : (room.image_url ? 1 : 0);

            return (
              <div
                key={room.id}
                className="bg-white rounded-3xl border border-[#D7E5E8] overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* ROOM IMAGE PREVIEW */}
                <div className="relative h-48 bg-slate-100 overflow-hidden">
                  <img
                    src={getMediaUrl(room.image_url) || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80'}
                    alt={`Room ${room.room_number}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-xs text-white text-xs font-extrabold px-3 py-1 rounded-full border border-white/20">
                    Room {room.room_number}
                  </div>
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                    ₹{Number(price).toLocaleString('en-IN')} / night
                  </div>

                  {photosCount > 1 && (
                    <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 border border-white/20">
                      <ImageIcon2 className="w-3 h-3" />
                      <span>{photosCount} Photos</span>
                    </div>
                  )}
                </div>

                {/* ROOM CONTENT */}
                <div className="p-5 space-y-3 flex-1">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{room.room_type || 'Deluxe Suite'}</h3>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-0.5">
                      {room.description || 'Spacious air-conditioned room with modern amenities.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 font-bold border-t border-[#D7E5E8] pt-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#3A7D7C]" /> Max {room.capacity || 2} Guests
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>{room.bed_type || 'King Bed'}</span>
                    <span className="text-slate-300">•</span>
                    <span>{room.floor || '1st Floor'}</span>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="p-4 bg-slate-50 border-t border-[#D7E5E8] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEdit(room)}
                    className="px-3.5 py-2 rounded-xl bg-white border border-[#D7E5E8] hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Room & Photos ({photosCount})</span>
                  </button>

                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="p-2 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                    title="Remove Room"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT ROOM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#D7E5E8] max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingRoom ? `Edit Room ${editingRoom.room_number}` : 'Add New Room to Website'}
                </h3>
                <p className="text-xs text-slate-500">Configure specifications and upload photos from your system</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room Number:</label>
                  <input
                    type="text"
                    required
                    value={form.room_number}
                    onChange={(e) => setForm({ ...form, room_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price Per Night (₹):</label>
                  <input
                    type="number"
                    required
                    value={form.rate_per_night}
                    onChange={(e) => setForm({ ...form, rate_per_night: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room Type / Category:</label>
                  <input
                    type="text"
                    required
                    value={form.room_type}
                    onChange={(e) => setForm({ ...form, room_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Floor:</label>
                  <input
                    type="text"
                    value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Guest Capacity:</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bed Type:</label>
                  <input
                    type="text"
                    value={form.bed_type}
                    onChange={(e) => setForm({ ...form, bed_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* MULTI-IMAGE UPLOAD SECTION */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-extrabold text-slate-900">
                    Room Photos Gallery ({form.images?.length || 0})
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Upload System Files</span>
                </div>

                {/* UPLOADER ACTION BUTTON */}
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-xs cursor-pointer transition-all">
                    <UploadCloud className="w-4 h-4" />
                    <span>{uploadingImages ? 'Uploading Photos...' : '📁 Upload Local Photos from Computer'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageFilesUpload}
                      disabled={uploadingImages}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* MANUAL URL INPUT ALTERNATIVE */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Or paste external image URL..."
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomUrl())}
                    className="flex-1 px-3 py-2 bg-white border border-[#D7E5E8] rounded-xl font-bold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomUrl}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl"
                  >
                    Add URL
                  </button>
                </div>

                {/* THUMBNAIL PREVIEWS GRID */}
                {form.images && form.images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-2">
                    {form.images.map((imgUrl, idx) => {
                      const isPrimary = form.image_url === imgUrl || (!form.image_url && idx === 0);
                      return (
                        <div
                          key={idx}
                          className={`relative group h-24 rounded-xl overflow-hidden border-2 transition-all ${
                            isPrimary ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
                          }`}
                        >
                          <img
                            src={getMediaUrl(imgUrl)}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />

                          {isPrimary && (
                            <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-white" /> Cover
                            </span>
                          )}

                          {/* HOVER OVERLAY CONTROLS */}
                          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                            {!isPrimary && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryCover(imgUrl)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-extrabold rounded-md shadow-xs"
                              >
                                Set Cover
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-extrabold rounded-md shadow-xs"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description:</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5E8]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-extrabold rounded-xl shadow-md cursor-pointer"
                >
                  {submitting ? 'Saving...' : (editingRoom ? 'Save Changes' : 'Add Room')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
