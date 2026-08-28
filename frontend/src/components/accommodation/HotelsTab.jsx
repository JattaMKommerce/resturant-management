import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Building2,
  Search,
  MapPin,
  Star,
  Coffee,
  CheckCircle2,
  Clock,
  BedDouble,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Filter
} from 'lucide-react';
import HotelDetailsModal from './HotelDetailsModal';

export default function HotelsTab({
  onSelectHotel,
  onBookRoomClick,
  refreshKey
}) {
  const [hotels, setHotels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedHotelForModal, setSelectedHotelForModal] = useState(null);

  const fetchHotels = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedCity && selectedCity !== 'ALL') params.city = selectedCity;

      const res = await api.get('/hotels', { params });
      const payload = res?.data || res;
      if (payload && Array.isArray(payload.hotels)) {
        setHotels(payload.hotels);
        if (payload.categories) setCategories(payload.categories);
        if (payload.cities) setCities(payload.cities);
      } else if (Array.isArray(payload)) {
        setHotels(payload);
      }
    } catch (err) {
      console.error('Failed to fetch hotels:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedCity]);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels, refreshKey]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. TOP FILTERS BAR */}
      <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-slate-50 border border-[#D7E5E8] rounded-xl px-3 py-2 text-xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search 20 hotels by name, location, city, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-hidden text-slate-800 placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="">All Categories ({hotels.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* City Filter */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="">All Cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          {(search || selectedCategory || selectedCity) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('');
                setSelectedCity('');
              }}
              className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold transition-all"
            >
              Clear
            </button>
          )}

          <button
            onClick={() => fetchHotels()}
            className="p-2 rounded-xl border border-[#D7E5E8] text-slate-600 hover:bg-slate-50 hover:text-[#3A7D7C] transition-colors"
            title="Refresh Hotels"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. HOTELS GRID */}
      {loading ? (
        <div className="py-24 text-center bg-white rounded-3xl border border-[#D7E5E8]">
          <div className="w-8 h-8 border-3 border-[#3A7D7C] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500 font-semibold">Loading hotel catalog from database...</p>
        </div>
      ) : hotels.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-[#D7E5E8] space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">No Hotels Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No hotels matched your selected filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {hotels.map((hotel) => {
            const hasBreakfast = hotel.breakfast_included;
            return (
              <div
                key={hotel.id}
                onClick={() => setSelectedHotelForModal(hotel)}
                className="group bg-white rounded-3xl border border-[#D7E5E8] shadow-2xs hover:shadow-md hover:border-[#3A7D7C]/50 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
              >
                <div>
                  {/* Hotel Image & Floating Badges */}
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={hotel.main_image}
                      alt={hotel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    
                    {/* Category Tag */}
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900/80 text-white backdrop-blur-xs shadow-xs">
                      {hotel.category}
                    </span>

                    {/* Rating Badge */}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-500/90 text-white backdrop-blur-xs font-black text-xs flex items-center gap-1 shadow-xs">
                      <Star className="w-3.5 h-3.5 fill-white" />
                      <span>{hotel.rating}</span>
                    </div>

                    {/* Breakfast Banner Overlay */}
                    <div className={`absolute bottom-0 inset-x-0 px-3 py-1 text-[10px] font-bold flex items-center gap-1.5 ${
                      hasBreakfast 
                        ? 'bg-emerald-600/90 text-white backdrop-blur-xs' 
                        : 'bg-slate-900/80 text-slate-200 backdrop-blur-xs'
                    }`}>
                      <Coffee className="w-3 h-3 shrink-0" />
                      <span className="truncate">{hotel.breakfast_info}</span>
                    </div>
                  </div>

                  {/* Hotel Details */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 leading-snug group-hover:text-[#3A7D7C] transition-colors">
                          {hotel.name}
                        </h3>
                        <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-[#3A7D7C] shrink-0" />
                          <span className="truncate">{hotel.location}, {hotel.city}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {hotel.description}
                    </p>

                    {/* Amenities chips */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {hotel.amenities.slice(0, 3).map((amenity, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold truncate max-w-[140px]"
                        >
                          {amenity}
                        </span>
                      ))}
                      {hotel.amenities.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold">
                          +{hotel.amenities.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Price & CTA */}
                <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between mt-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Starting from
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-black text-[#3A7D7C]">
                        ₹{hotel.price_per_night.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">/ night</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHotelForModal(hotel);
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
                  >
                    <span>View Hotel</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. HOTEL DETAILS MODAL */}
      {selectedHotelForModal && (
        <HotelDetailsModal
          isOpen={true}
          onClose={() => setSelectedHotelForModal(null)}
          hotel={selectedHotelForModal}
          onBookRoomClick={() => {
            setSelectedHotelForModal(null);
            if (onBookRoomClick) onBookRoomClick(selectedHotelForModal);
          }}
        />
      )}
    </div>
  );
}
