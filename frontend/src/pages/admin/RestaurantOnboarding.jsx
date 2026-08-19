import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { 
  Building, MapPin, Image as ImageIcon, Layers, Utensils, Eye, Globe, 
  CheckCircle, ArrowRight, ArrowLeft, Loader2, AlertCircle, Upload, Sparkles
} from 'lucide-react';

export default function RestaurantOnboarding() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [restaurant, setRestaurant] = useState(null);
  const [progress, setProgress] = useState(null);

  // Form states
  const [detailsForm, setDetailsForm] = useState({ name: '', phone: '', email: '', address: '', area: '', city: '', state: '', postal_code: '', min_order_amount: '199', delivery_fee: '49', delivery_radius_km: '10' });
  const [locationForm, setLocationForm] = useState({ latitude: '12.9716', longitude: '77.5946' });
  const [brandingForm, setBrandingForm] = useState({ tagline: '', description: '', about: '' });
  const [newCatName, setNewCatName] = useState('');
  const [newItemForm, setNewItemForm] = useState({ name: '', price: '', category_id: '', is_veg: true, description: '' });
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [restRes, progRes, catRes, menuRes] = await Promise.all([
        api.get('/admin/restaurant'),
        api.get('/admin/restaurant/setup-progress'),
        api.get('/admin/categories'),
        api.get('/admin/menu')
      ]);

      if (restRes.data.success) {
        const r = restRes.data.restaurant;
        setRestaurant(r);
        setDetailsForm({
          name: r.name || '', phone: r.phone || '', email: r.email || '',
          address: r.address || '', area: r.area || '', city: r.city || '',
          state: r.state || '', postal_code: r.postal_code || '',
          min_order_amount: r.min_order_amount || '199',
          delivery_fee: r.delivery_fee || '49',
          delivery_radius_km: r.delivery_radius_km || '10'
        });
        setLocationForm({ latitude: r.latitude || '12.9716', longitude: r.longitude || '77.5946' });
        setBrandingForm({ tagline: r.tagline || '', description: r.description || '', about: r.about || '' });
      }
      if (progRes.data.success) setProgress(progRes.data);
      if (catRes.data.success) setCategories(catRes.data.categories || []);
      if (menuRes.data.success) setMenuItems(menuRes.data.items || []);

    } catch (err) {
      console.error('Onboarding load error:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Redirecting to login...');
        localStorage.removeItem('hotel_token');
        localStorage.removeItem('hotel_user');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setError(err.response?.data?.message || 'Failed to load onboarding data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.put('/admin/restaurant/settings', { id: restaurant.id, ...detailsForm });
      await loadData();
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save details.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.put('/admin/restaurant/settings', { id: restaurant.id, ...locationForm });
      await loadData();
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.put('/admin/restaurant/settings', { id: restaurant.id, ...brandingForm });
      await loadData();
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save branding.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      await api.post('/admin/categories', { name: newCatName, restaurant_id: restaurant.id });
      setNewCatName('');
      loadData();
    } catch (err) {
      alert('Failed to add category.');
    }
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!newItemForm.name || !newItemForm.price || !newItemForm.category_id) return;
    try {
      await api.post('/admin/menu', { ...newItemForm, restaurant_id: restaurant.id });
      setNewItemForm({ name: '', price: '', category_id: '', is_veg: true, description: '' });
      loadData();
    } catch (err) {
      alert('Failed to add menu item.');
    }
  };

  const handlePublish = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.post('/admin/restaurant/publish');
      if (res.data.success) {
        navigate(`/admin/${restaurant.slug}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish website.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const stepsList = [
    { number: 1, title: 'Restaurant Details', icon: Building },
    { number: 2, title: 'Location & Radius', icon: MapPin },
    { number: 3, title: 'Branding & About', icon: ImageIcon },
    { number: 4, title: 'Menu Categories', icon: Layers },
    { number: 5, title: 'Menu Items', icon: Utensils },
    { number: 6, title: 'Website Preview', icon: Eye },
    { number: 7, title: 'Publish Website', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Bar */}
      <div className="bg-slate-950 border-b border-slate-800 p-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-orange-500" />
          <h1 className="font-bold text-lg text-white">Restaurant Setup Wizard</h1>
        </div>
        <button onClick={() => navigate(`/admin/${slug || restaurant?.slug}`)} className="text-xs text-slate-400 hover:text-white">
          Exit Wizard ✕
        </button>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
        
        {/* Step Sidebar */}
        <div className="md:col-span-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-6 h-fit space-y-3 sm:space-y-4">
          <h2 className="font-bold text-xs sm:text-sm text-slate-300 uppercase tracking-wider">Setup Steps</h2>
          <div className="flex md:flex-col gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0">
            {stepsList.map(s => {
              const Icon = s.icon;
              const isDone = s.number < step;
              const isCurrent = s.number === step;

              return (
                <button
                  key={s.number}
                  onClick={() => setStep(s.number)}
                  className={`min-w-[160px] md:min-w-0 md:w-full shrink-0 flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl text-xs font-bold transition-all text-left ${
                    isCurrent
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : isDone
                      ? 'bg-slate-900/60 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-900/40 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${isCurrent ? 'bg-white/20 text-white' : isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {isDone ? <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : s.number}
                  </div>
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content Area */}
        <div className="md:col-span-8 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-6">
          
          {error && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* STEP 1: Details */}
          {step === 1 && (
            <form onSubmit={handleSaveDetails} className="space-y-4 text-xs">
              <h2 className="text-base sm:text-lg font-bold text-white mb-4">Step 1: Restaurant Details</h2>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Restaurant Name *</label>
                <input type="text" required value={detailsForm.name} onChange={e => setDetailsForm({...detailsForm, name: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Phone *</label>
                  <input type="text" required value={detailsForm.phone} onChange={e => setDetailsForm({...detailsForm, phone: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Email *</label>
                  <input type="email" required value={detailsForm.email} onChange={e => setDetailsForm({...detailsForm, email: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Street Address *</label>
                <input type="text" required value={detailsForm.address} onChange={e => setDetailsForm({...detailsForm, address: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Area / Locality</label>
                  <input type="text" value={detailsForm.area} onChange={e => setDetailsForm({...detailsForm, area: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">City</label>
                  <input type="text" value={detailsForm.city} onChange={e => setDetailsForm({...detailsForm, city: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Postal Code</label>
                  <input type="text" value={detailsForm.postal_code} onChange={e => setDetailsForm({...detailsForm, postal_code: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
                </div>
              </div>

              <button type="submit" disabled={saving} className="w-full py-3.5 bg-orange-500 font-bold text-white rounded-xl flex items-center justify-center gap-2 mt-6">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* STEP 2: Location */}
          {step === 2 && (
            <form onSubmit={handleSaveLocation} className="space-y-4 text-xs">
              <h2 className="text-lg font-bold text-white mb-4">Step 2: Location & Delivery Radius</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Latitude</label>
                  <input type="text" value={locationForm.latitude} onChange={e => setLocationForm({...locationForm, latitude: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Longitude</label>
                  <input type="text" value={locationForm.longitude} onChange={e => setLocationForm({...locationForm, longitude: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
                </div>
              </div>
              <p className="text-slate-400">Coordinates are used for 10km Haversine server-side delivery distance checks.</p>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(1)} className="px-6 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl">Back</button>
                <button type="submit" disabled={saving} className="flex-1 py-3.5 bg-orange-500 font-bold text-white rounded-xl flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Branding */}
          {step === 3 && (
            <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
              <h2 className="text-lg font-bold text-white mb-4">Step 3: Branding & About Section</h2>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Tagline</label>
                <input type="text" placeholder="Where Every Meal is a Royal Experience" value={brandingForm.tagline} onChange={e => setBrandingForm({...brandingForm, tagline: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Short Description</label>
                <textarea rows={2} value={brandingForm.description} onChange={e => setBrandingForm({...brandingForm, description: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none resize-none" />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">About Story</label>
                <textarea rows={3} value={brandingForm.about} onChange={e => setBrandingForm({...brandingForm, about: e.target.value})} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none resize-none" />
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(2)} className="px-6 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl">Back</button>
                <button type="submit" disabled={saving} className="flex-1 py-3.5 bg-orange-500 font-bold text-white rounded-xl flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Categories */}
          {step === 4 && (
            <div className="space-y-4 text-xs">
              <h2 className="text-lg font-bold text-white mb-4">Step 4: Menu Categories</h2>
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input type="text" placeholder="Category Name (e.g. Main Course)" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" />
                <button type="submit" className="px-6 py-3 bg-orange-500 font-bold text-white rounded-xl">Add</button>
              </form>

              <div className="space-y-2 mt-4">
                {categories.map(c => (
                  <div key={c.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-white">{c.name}</span>
                    <span className="text-emerald-400 font-bold">Active</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(3)} className="px-6 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl">Back</button>
                <button type="button" onClick={() => setStep(5)} className="flex-1 py-3.5 bg-orange-500 font-bold text-white rounded-xl flex items-center justify-center gap-2">
                  Continue to Menu Items <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Menu Items */}
          {step === 5 && (
            <div className="space-y-4 text-xs">
              <h2 className="text-lg font-bold text-white mb-4">Step 5: Add Menu Items</h2>
              <form onSubmit={handleAddMenuItem} className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Item Name *" value={newItemForm.name} onChange={e => setNewItemForm({...newItemForm, name: e.target.value})} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none" />
                  <input type="number" placeholder="Price (₹) *" value={newItemForm.price} onChange={e => setNewItemForm({...newItemForm, price: e.target.value})} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none" />
                </div>
                <select value={newItemForm.category_id} onChange={e => setNewItemForm({...newItemForm, category_id: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none">
                  <option value="">Select Category *</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="submit" className="w-full py-2.5 bg-orange-500 font-bold text-white rounded-xl">Add Item</button>
              </form>

              <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
                {menuItems.map(m => (
                  <div key={m.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">{m.name}</span>
                      <span className="text-slate-400 block text-[10px]">₹{m.price}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(4)} className="px-6 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl">Back</button>
                <button type="button" onClick={() => setStep(6)} className="flex-1 py-3.5 bg-orange-500 font-bold text-white rounded-xl flex items-center justify-center gap-2">
                  Preview Website <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Preview */}
          {step === 6 && (
            <div className="space-y-4 text-xs text-center py-8">
              <Eye className="w-12 h-12 text-orange-500 mx-auto" />
              <h2 className="text-xl font-bold text-white">Preview Your Public Website</h2>
              <p className="text-slate-400">Click below to open your customer-facing ordering website in a new tab.</p>
              <a href={`/restaurant/${restaurant?.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl">
                Open Public Website Preview ↗
              </a>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setStep(5)} className="px-6 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl">Back</button>
                <button type="button" onClick={() => setStep(7)} className="flex-1 py-3.5 bg-orange-500 font-bold text-white rounded-xl flex items-center justify-center gap-2">
                  Proceed to Publish <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: Publish */}
          {step === 7 && (
            <div className="space-y-4 text-xs text-center py-8">
              <Globe className="w-12 h-12 text-emerald-500 mx-auto" />
              <h2 className="text-xl font-bold text-white">Publish Website</h2>
              <p className="text-slate-400">Your restaurant setup is complete! Click below to publish your website live and start accepting customer orders online.</p>
              <button onClick={handlePublish} disabled={saving} className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 font-black text-slate-950 text-base rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-98">
                {saving ? 'Publishing...' : '🚀 Publish Live Website'}
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
