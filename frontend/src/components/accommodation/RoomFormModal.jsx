import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { 
  Building, 
  Layers, 
  DollarSign, 
  Users, 
  Bed, 
  Maximize2, 
  Image as ImageIcon, 
  Check, 
  Sparkles,
  AlignLeft,
  Tag
} from 'lucide-react';

const PRESET_ROOM_TYPES = [
  'Standard Room',
  'Deluxe Room',
  'Executive Suite',
  'VIP Presidential Suite',
  'Family Suite',
  'Penthouse Suite'
];

const PRESET_FLOORS = [
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  '5th Floor',
  'Terrace Floor'
];

const PRESET_BED_TYPES = [
  'Single Bed',
  'Queen Bed',
  'King Bed',
  'California King Bed',
  'Twin Beds',
  'Double King Beds'
];

const PRESET_IMAGES = [
  {
    name: 'Deluxe Room',
    url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80'
  },
  {
    name: 'Executive Suite',
    url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80'
  },
  {
    name: 'Standard Modern',
    url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80'
  },
  {
    name: 'VIP Presidential Suite',
    url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=80'
  },
  {
    name: 'Boutique Room',
    url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80'
  },
  {
    name: 'Penthouse View',
    url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=80'
  }
];

const AVAILABLE_AMENITIES = [
  'Free High-Speed WiFi',
  'Air Conditioning',
  '50" 4K Smart TV',
  'Mini Bar',
  '24/7 Room Service',
  'Private Bathroom',
  'Safe Locker',
  'Tea/Coffee Maker',
  'Espresso Machine',
  'Private Balcony',
  'Whirlpool Jacuzzi',
  'Workstation Desk',
  'Bathrobes & Slippers',
  'Hair Dryer',
  'Iron & Ironing Board'
];

export default function RoomFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  autoNextRoomNumber = ''
}) {
  const [formData, setFormData] = useState({
    room_number: '',
    floor: '1st Floor',
    room_type: 'Deluxe Room',
    status: 'VACANT',
    rate_per_night: 2500,
    capacity: 2,
    bed_type: 'King Bed',
    room_size: '320 sq.ft',
    amenities: [
      'Free High-Speed WiFi',
      'Air Conditioning',
      '50" 4K Smart TV',
      'Mini Bar',
      '24/7 Room Service',
      'Private Bathroom'
    ],
    description: '',
    image_url: PRESET_IMAGES[0].url
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        room_number: initialData.room_number || '',
        floor: initialData.floor || '1st Floor',
        room_type: initialData.room_type || 'Deluxe Room',
        status: initialData.status || 'VACANT',
        rate_per_night: initialData.rate_per_night || 2500,
        capacity: initialData.capacity || 2,
        bed_type: initialData.bed_type || 'King Bed',
        room_size: initialData.room_size || '320 sq.ft',
        amenities: Array.isArray(initialData.amenities) ? initialData.amenities : AVAILABLE_AMENITIES.slice(0, 6),
        description: initialData.description || '',
        image_url: initialData.image_url || PRESET_IMAGES[0].url
      });
    } else {
      setFormData({
        room_number: autoNextRoomNumber || '',
        floor: '1st Floor',
        room_type: 'Deluxe Room',
        status: 'VACANT',
        rate_per_night: 2500,
        capacity: 2,
        bed_type: 'King Bed',
        room_size: '320 sq.ft',
        amenities: AVAILABLE_AMENITIES.slice(0, 6),
        description: 'Spacious Deluxe Room offering an elegant blend of comfort, modern aesthetics, and luxury furnishings.',
        image_url: PRESET_IMAGES[0].url
      });
    }
    setError('');
  }, [initialData, autoNextRoomNumber, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists 
          ? prev.amenities.filter(a => a !== amenity)
          : [...prev.amenities, amenity]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.room_number || String(formData.room_number).trim() === '') {
      setError('Please provide a Room Number.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        room_number: String(formData.room_number).trim(),
        rate_per_night: parseFloat(formData.rate_per_night) || 0,
        capacity: parseInt(formData.capacity, 10) || 2
      });
    } catch (err) {
      setError(err.message || 'Failed to save room details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Edit Room ${initialData.room_number}` : 'Add New Hotel Room'}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* ROW 1: Room Number, Floor, Room Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Room Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                name="room_number"
                value={formData.room_number}
                onChange={handleChange}
                placeholder="e.g. 101, 204, 301"
                required
                className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Floor Level</label>
            <div className="relative">
              <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                name="floor"
                value={formData.floor}
                onChange={handleChange}
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              >
                {PRESET_FLOORS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Room Category</label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                name="room_type"
                value={formData.room_type}
                onChange={handleChange}
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              >
                {PRESET_ROOM_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ROW 2: Rate, Capacity, Bed Type, Room Size */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Rate / Night (₹)</label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                name="rate_per_night"
                value={formData.rate_per_night}
                onChange={handleChange}
                min="0"
                step="50"
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Guest Capacity</label>
            <div className="relative">
              <Users className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                min="1"
                max="10"
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bed Configuration</label>
            <div className="relative">
              <Bed className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                name="bed_type"
                value={formData.bed_type}
                onChange={handleChange}
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              >
                {PRESET_BED_TYPES.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Room Dimensions</label>
            <div className="relative">
              <Maximize2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                name="room_size"
                value={formData.room_size}
                onChange={handleChange}
                placeholder="e.g. 320 sq.ft"
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              />
            </div>
          </div>
        </div>

        {/* ROW 3: Room Visual Image Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Room Showcase Photography
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PRESET_IMAGES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, image_url: preset.url }))}
                className={`relative aspect-4/3 rounded-xl overflow-hidden border-2 transition-all group ${
                  formData.image_url === preset.url ? 'border-[#3A7D7C] scale-105 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-end p-1">
                  <span className="text-[9px] text-white font-bold truncate">{preset.name}</span>
                </div>
                {formData.image_url === preset.url && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#3A7D7C] text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="relative pt-1">
            <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="url"
              name="image_url"
              value={formData.image_url}
              onChange={handleChange}
              placeholder="Or paste custom image URL (https://...)"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
            />
          </div>
        </div>

        {/* ROW 4: Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Room Description & Highlights
          </label>
          <div className="relative">
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="2"
              placeholder="Brief description of the room, views, furnishings, and specialty features..."
              className="w-full p-3 text-xs rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C] leading-relaxed"
            />
          </div>
        </div>

        {/* ROW 5: Amenities Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Included Amenities ({formData.amenities.length} Selected)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-[#D7E5E8] max-h-36 overflow-y-auto">
            {AVAILABLE_AMENITIES.map(amenity => {
              const selected = formData.amenities.includes(amenity);
              return (
                <button
                  type="button"
                  key={amenity}
                  onClick={() => toggleAmenity(amenity)}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs transition-all ${
                    selected 
                      ? 'bg-[#EAF4F7] text-[#3A7D7C] font-bold border border-[#3A7D7C]/30 shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                    selected ? 'bg-[#3A7D7C] text-white' : 'border border-slate-300'
                  }`}>
                    {selected && <Check className="w-3 h-3" />}
                  </div>
                  <span className="truncate">{amenity}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FORM FOOTER */}
        <div className="pt-4 border-t border-[#D7E5E8] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{submitting ? 'Saving...' : (initialData ? 'Update Room' : 'Create Room')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
