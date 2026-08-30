import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { 
  Building, MapPin, Image as ImageIcon, Layers, Utensils, Eye, Globe, 
  CheckCircle, ArrowRight, ArrowLeft, Loader2, AlertCircle, Upload, Sparkles,
  Trash2, Clock, ShieldCheck, Star, CreditCard, Lock
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:5000');

const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

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

  // Branding Images State
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);

  const [imageError, setImageError] = useState('');

  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const [newCatName, setNewCatName] = useState('');
  const [newItemForm, setNewItemForm] = useState({ name: '', price: '', category_id: '', is_veg: true, description: '' });
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [customSlugInput, setCustomSlugInput] = useState('');

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
        setCustomSlugInput(r.custom_subdomain_slug || r.slug || '');
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
        
        if (r.logo_url) setLogoPreview(getMediaUrl(r.logo_url));
        if (r.cover_url) setCoverPreview(getMediaUrl(r.cover_url));
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
        setTimeout(() => navigate('/admin/login'), 1500);
      } else {
        setError(err.response?.data?.message || 'Failed to load onboarding data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSubdomainInWizard = async () => {
    const slugToUse = customSlugInput.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slugToUse) {
      alert('Please enter a valid custom subdomain name.');
      return;
    }
    if (!window.confirm(`Unlock custom subdomain "${slugToUse}.jattamkommerce.com" for ₹99/month?`)) return;

    setSaving(true);
    try {
      const res = await api.post('/admin/restaurant/purchase-custom-subdomain', {
        restaurant_id: restaurant?.id,
        custom_subdomain_slug: slugToUse
      });
      if (res.data.success) {
        alert('🎉 Custom Subdomain Unlocked Successfully!');
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unlock custom subdomain.');
    } finally {
      setSaving(false);
    }
  };

  const validateImageFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return 'Please upload a JPG, PNG, or WebP image.';
    }
    if (file.size > 5 * 1024 * 1024) {
      return 'Image is too large (max 5MB). Please choose a smaller image.';
    }
    return null;
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageError('');
    const validationError = validateImageFile(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageError('');
    const validationError = validateImageFile(file);
    if (validationError) {
      setImageError(validationError);
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
    if (coverInputRef.current) coverInputRef.current.value = '';
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
    setSaving(true); setError(''); setImageError('');
    try {
      const formData = new FormData();
      formData.append('id', restaurant.id);
      formData.append('tagline', brandingForm.tagline);
      formData.append('description', brandingForm.description);
      formData.append('about', brandingForm.about);

      if (logoFile) {
        formData.append('logo', logoFile);
      } else if (removeLogo) {
        formData.append('remove_logo', '1');
      }

      if (coverFile) {
        formData.append('cover', coverFile);
      } else if (removeCover) {
        formData.append('remove_cover', '1');
      }

      const res = await api.put('/admin/restaurant/settings', formData);
      if (res.data.success) {
        setLogoFile(null);
        setCoverFile(null);
        setRemoveLogo(false);
        setRemoveCover(false);
        await loadData();
        setStep(4);
      }
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
      <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-[#3A7D7C] mx-auto" />
          <p className="text-xs font-bold text-[#64748B]">Loading setup wizard...</p>
        </div>
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
    { number: 7, title: 'Subdomain Branding', icon: Star },
    { number: 8, title: 'Publish Website', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col font-sans antialiased">
      {/* Top Bar */}
      <div className="bg-white border-b border-[#D7E5E8] p-4 px-6 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center font-bold border border-[#D7E5E8]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base text-[#1F2937]">Online Storefront Setup Wizard</h1>
            <p className="text-[11px] text-[#64748B]">Follow the steps to configure and launch your digital ordering portal</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/admin/${slug || restaurant?.slug}`)}
          className="text-xs font-bold text-[#64748B] hover:text-[#1F2937] px-3 py-1.5 rounded-xl border border-[#D7E5E8] bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          Exit Wizard ✕
        </button>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Step Sidebar */}
        <div className="md:col-span-4 bg-white border border-[#D7E5E8] rounded-2xl p-5 h-fit space-y-3 shadow-xs">
          <h2 className="font-bold text-xs text-[#64748B] uppercase tracking-wider">Setup Progress</h2>
          <div className="space-y-1.5">
            {stepsList.map(s => {
              const isCurrent = s.number === step;

              return (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => setStep(s.number)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all text-left border ${
                    isCurrent
                      ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                      : 'bg-white text-[#1F2937] border-[#D7E5E8] hover:bg-slate-50 hover:border-[#3A7D7C]/40'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                    isCurrent
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-[#64748B] border border-[#D7E5E8]'
                  }`}>
                    {s.number}
                  </div>
                  <span className={isCurrent ? 'text-white font-bold' : 'text-[#1F2937] font-semibold'}>
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content Area */}
        <div className="md:col-span-8 bg-white border border-[#D7E5E8] rounded-2xl p-6 shadow-xs">
          
          {error && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* STEP 1: Details */}
          {step === 1 && (
            <form onSubmit={handleSaveDetails} className="space-y-4 text-xs">
              <h2 className="text-base font-bold text-[#1F2937] mb-2">Step 1: Restaurant Basic Details</h2>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Restaurant Name *</label>
                <input type="text" required value={detailsForm.name} onChange={e => setDetailsForm({...detailsForm, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Phone *</label>
                  <input type="text" required value={detailsForm.phone} onChange={e => setDetailsForm({...detailsForm, phone: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Email *</label>
                  <input type="email" required value={detailsForm.email} onChange={e => setDetailsForm({...detailsForm, email: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                </div>
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Street Address *</label>
                <input type="text" required value={detailsForm.address} onChange={e => setDetailsForm({...detailsForm, address: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Area / Locality</label>
                  <input type="text" value={detailsForm.area} onChange={e => setDetailsForm({...detailsForm, area: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">City</label>
                  <input type="text" value={detailsForm.city} onChange={e => setDetailsForm({...detailsForm, city: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Postal Code</label>
                  <input type="text" value={detailsForm.postal_code} onChange={e => setDetailsForm({...detailsForm, postal_code: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                </div>
              </div>

              <button type="submit" disabled={saving} className="w-full py-3 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl flex items-center justify-center gap-2 mt-6 shadow-2xs transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* STEP 2: Location */}
          {step === 2 && (
            <form onSubmit={handleSaveLocation} className="space-y-4 text-xs">
              <h2 className="text-base font-bold text-[#1F2937] mb-2">Step 2: Location & Delivery Radius</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Latitude</label>
                  <input type="text" value={locationForm.latitude} onChange={e => setLocationForm({...locationForm, latitude: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                </div>
                <div>
                  <label className="block text-[#1F2937] font-bold mb-1">Longitude</label>
                  <input type="text" value={locationForm.longitude} onChange={e => setLocationForm({...locationForm, longitude: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                </div>
              </div>
              <p className="text-[#64748B]">Coordinates are used for Haversine server-side delivery distance validation.</p>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(1)} className="px-6 py-2.5 bg-slate-100 text-[#1F2937] font-bold rounded-xl border border-[#D7E5E8]">Back</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Branding & Image Upload */}
          {step === 3 && (
            <form onSubmit={handleSaveBranding} className="space-y-5 text-xs">
              <h2 className="text-base font-bold text-[#1F2937] mb-2">Step 3: Branding & Visual Assets</h2>

              {imageError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {imageError}
                </div>
              )}

              {/* Upload Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Logo */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1F2937]">Restaurant Logo</span>
                    <span className="text-[10px] font-bold text-[#3A7D7C] bg-[#EAF4F7] px-2 py-0.5 rounded border border-[#D7E5E8]">Square</span>
                  </div>
                  <div className="w-full h-24 bg-white rounded-xl border border-[#D7E5E8] flex items-center justify-center p-2">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-20 h-20 rounded-xl object-contain" />
                    ) : (
                      <span className="text-[11px] text-[#64748B]">No Logo Uploaded</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="flex-1 py-2 px-3 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl flex items-center justify-center gap-1 text-xs shadow-2xs">
                      <Upload className="w-3.5 h-3.5" /> {logoPreview ? 'Change' : 'Upload'}
                    </button>
                    {logoPreview && (
                      <button type="button" onClick={handleRemoveLogo} className="py-2 px-3 bg-white text-[#64748B] hover:text-rose-600 font-bold rounded-xl border border-[#D7E5E8] text-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cover */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1F2937]">Storefront Cover Banner</span>
                    <span className="text-[10px] font-bold text-[#3A7D7C] bg-[#EAF4F7] px-2 py-0.5 rounded border border-[#D7E5E8]">Landscape</span>
                  </div>
                  <div className="w-full h-24 bg-white rounded-xl border border-[#D7E5E8] flex items-center justify-center p-1">
                    {coverPreview ? (
                      <img src={coverPreview} alt="Cover" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      <span className="text-[11px] text-[#64748B]">No Cover Image</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                    <button type="button" onClick={() => coverInputRef.current?.click()} className="flex-1 py-2 px-3 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl flex items-center justify-center gap-1 text-xs shadow-2xs">
                      <Upload className="w-3.5 h-3.5" /> {coverPreview ? 'Change' : 'Upload'}
                    </button>
                    {coverPreview && (
                      <button type="button" onClick={handleRemoveCover} className="py-2 px-3 bg-white text-[#64748B] hover:text-rose-600 font-bold rounded-xl border border-[#D7E5E8] text-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Tagline</label>
                <input type="text" placeholder="Where Every Meal is a Royal Experience" value={brandingForm.tagline} onChange={e => setBrandingForm({...brandingForm, tagline: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">Short Description</label>
                <textarea rows={2} value={brandingForm.description} onChange={e => setBrandingForm({...brandingForm, description: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C] resize-none" />
              </div>
              <div>
                <label className="block text-[#1F2937] font-bold mb-1">About Story</label>
                <textarea rows={3} value={brandingForm.about} onChange={e => setBrandingForm({...brandingForm, about: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C] resize-none" />
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(2)} className="px-6 py-2.5 bg-slate-100 text-[#1F2937] font-bold rounded-xl border border-[#D7E5E8]">Back</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Categories */}
          {step === 4 && (
            <div className="space-y-4 text-xs">
              <h2 className="text-base font-bold text-[#1F2937] mb-2">Step 4: Menu Categories</h2>
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input type="text" placeholder="Category Name (e.g. Main Course)" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="flex-1 p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                <button type="submit" className="px-5 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl shadow-2xs transition-colors">Add</button>
              </form>

              <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
                {categories.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-[#D7E5E8] flex items-center justify-between">
                    <span className="font-bold text-[#1F2937]">{c.name}</span>
                    <span className="text-[#3A7D7C] font-bold">Active</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(3)} className="px-6 py-2.5 bg-slate-100 text-[#1F2937] font-bold rounded-xl border border-[#D7E5E8]">Back</button>
                <button type="button" onClick={() => setStep(5)} className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors">
                  Continue to Menu Items <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Menu Items */}
          {step === 5 && (
            <div className="space-y-4 text-xs">
              <h2 className="text-base font-bold text-[#1F2937] mb-2">Step 5: Add Menu Items</h2>
              <form onSubmit={handleAddMenuItem} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-[#D7E5E8]">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Item Name *" value={newItemForm.name} onChange={e => setNewItemForm({...newItemForm, name: e.target.value})} className="p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                  <input type="number" placeholder="Price (₹) *" value={newItemForm.price} onChange={e => setNewItemForm({...newItemForm, price: e.target.value})} className="p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]" />
                </div>
                <select value={newItemForm.category_id} onChange={e => setNewItemForm({...newItemForm, category_id: e.target.value})} className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]">
                  <option value="">Select Category *</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="submit" className="w-full py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl shadow-2xs transition-colors">Add Item</button>
              </form>

              <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
                {menuItems.map(m => (
                  <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-[#D7E5E8] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#1F2937]">{m.name}</span>
                      <span className="text-[#64748B] block text-[10px] font-mono">₹{m.price}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(4)} className="px-6 py-2.5 bg-slate-100 text-[#1F2937] font-bold rounded-xl border border-[#D7E5E8]">Back</button>
                <button type="button" onClick={() => setStep(6)} className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors">
                  Preview Website <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Visual Storefront Preview */}
          {step === 6 && (
            <div className="space-y-5 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1F2937]">Step 6: Visual Storefront Preview</h2>
                  <p className="text-[#64748B] text-xs mt-0.5">Review your uploaded cover image, logo, and digital menu dishes before publishing live.</p>
                </div>
                <a
                  href={`${typeof window !== 'undefined' && window.location.pathname.startsWith('/hotel') ? '/hotel' : ''}/restaurant/${restaurant?.slug || 'grand-palace'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-[#3A7D7C] font-bold rounded-xl border border-[#D7E5E8] text-xs shadow-2xs transition-colors shrink-0"
                >
                  <Eye className="w-4 h-4" /> Open Full Page ↗
                </a>
              </div>

              {/* Visual Storefront Mockup Frame */}
              <div className="rounded-2xl border border-[#D7E5E8] overflow-hidden bg-slate-50 shadow-xs">
                {/* Hero Header */}
                <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-slate-900">
                  <img
                    src={coverPreview || getMediaUrl(restaurant?.cover_url) || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80'}
                    alt="Storefront Cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  
                  {/* Floating Branding Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end gap-3.5">
                    <img
                      src={logoPreview || getMediaUrl(restaurant?.logo_url) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80'}
                      alt="Logo"
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-contain bg-white p-1 border-2 border-white shadow-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-white">
                      <h3 className="text-lg sm:text-xl font-bold truncate">{detailsForm.name || restaurant?.name || 'Restaurant Name'}</h3>
                      <p className="text-orange-200 text-xs truncate mt-0.5">{brandingForm.tagline || restaurant?.tagline || 'Where Every Meal is a Royal Experience'}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-white/80 font-medium">
                        {detailsForm.area && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#3A7D7C]" /> {detailsForm.area}{detailsForm.city ? `, ${detailsForm.city}` : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-300" /> 10:00 AM – 11:30 PM
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ● Open Now
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Categories Bar */}
                <div className="p-3 bg-white border-b border-[#D7E5E8] flex items-center gap-2 overflow-x-auto">
                  <span className="px-3 py-1 rounded-xl bg-[#3A7D7C] text-white text-[11px] font-bold">All</span>
                  {categories.map(c => (
                    <span key={c.id} className="px-3 py-1 rounded-xl bg-slate-50 border border-[#D7E5E8] text-[#1F2937] text-[11px] font-semibold whitespace-nowrap">
                      {c.name}
                    </span>
                  ))}
                </div>

                {/* Sample Dishes Preview */}
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {menuItems.slice(0, 4).map(item => (
                    <div key={item.id} className="bg-white p-3 rounded-xl border border-[#D7E5E8] flex items-center justify-between shadow-2xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-3 h-3 rounded-xs border flex items-center justify-center ${item.is_veg ? 'border-emerald-600' : 'border-rose-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                          </span>
                          <span className="font-bold text-slate-800 text-xs">{item.name}</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-slate-900 block mt-0.5">₹{item.price}</span>
                      </div>
                      <span className="px-3 py-1 bg-slate-50 border border-[#3A7D7C] text-[#3A7D7C] rounded-lg text-[11px] font-bold">
                        ADD +
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(5)} className="px-6 py-2.5 bg-slate-100 text-[#1F2937] font-bold rounded-xl border border-[#D7E5E8]">Back</button>
                <button type="button" onClick={() => setStep(7)} className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors">
                  Subdomain Branding <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: Subdomain Branding Add-On (₹99/mo) */}
          {step === 7 && (
            <div className="space-y-5 text-xs">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Step 7: Custom Subdomain Branding
                </span>
                <h2 className="text-base font-bold text-[#1F2937] mt-1.5">Official Restaurant Name Subdomain (₹99/mo)</h2>
                <p className="text-[#64748B] text-xs mt-0.5 leading-relaxed">
                  By default, your free digital storefront link uses a random 7-character code (<code className="font-bold bg-slate-100 px-1 py-0.5 rounded border">{restaurant?.random_slug || 'aK8xP2qZ'}</code>). 
                  Upgrade to the **₹99/month Custom Subdomain Plan** to display your official restaurant name (<code className="font-bold text-[#3A7D7C] bg-white px-1 py-0.5 rounded border">{customSlugInput || restaurant?.slug}.jattamkommerce.com</code>) across customer links, QR codes & social share buttons!
                </p>
              </div>

              {!restaurant?.custom_subdomain_enabled ? (
                <div className="bg-gradient-to-r from-[#EAF4F7] to-amber-50 rounded-2xl border-2 border-[#3A7D7C]/30 p-5 space-y-4 shadow-xs">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-black text-[#1F2937] text-sm">₹99/mo Custom Subdomain Plan Includes:</h3>
                      <ul className="space-y-1.5 text-xs text-[#475569] font-medium pt-1">
                        <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> <span>Official Name Domain (<code className="font-bold text-slate-800">{customSlugInput || restaurant?.slug}.jattamkommerce.com</code>)</span></li>
                        <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> <span>Custom Branded Dine-In QR Codes & Flyers</span></li>
                        <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> <span>Professional Identity on WhatsApp & Social Shares</span></li>
                      </ul>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xl font-black text-[#1F2937]">₹99</span>
                      <span className="text-xs text-[#64748B] font-bold"> / month</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <div className="relative flex-1 w-full">
                      <input
                        type="text"
                        value={customSlugInput}
                        onChange={(e) => setCustomSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="e.g. niti-hotel"
                        className="w-full px-4 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-xs font-bold text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-[#94A3B8] font-mono">.jattamkommerce.com</span>
                    </div>
                    <button
                      onClick={handlePurchaseSubdomainInWizard}
                      disabled={saving}
                      className="w-full sm:w-auto px-6 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" /> Pay ₹99 & Unlock Custom Name
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 flex items-center justify-between text-emerald-900 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                      <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Custom Subdomain Active</h4>
                      <p className="text-xs text-emerald-700 font-medium">Your official restaurant name <code className="font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-900">{restaurant?.custom_subdomain_slug}.jattamkommerce.com</code> is active on the ₹99/mo tier.</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold bg-white text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                    ACTIVE (₹99/mo)
                  </span>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setStep(6)} className="px-6 py-2.5 bg-slate-100 text-[#1F2937] font-bold rounded-xl border border-[#D7E5E8]">Back</button>
                <button type="button" onClick={() => setStep(8)} className="flex-1 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors">
                  Proceed to Publish <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: Publish Website */}
          {step === 8 && (
            <div className="space-y-4 text-xs text-center py-8">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
                <Globe className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-[#1F2937]">Step 8: Publish Website Live</h2>
              <p className="text-[#64748B]">Your storefront setup is ready! Click below to publish your website live and start receiving customer orders.</p>
              <button onClick={handlePublish} disabled={saving} className="px-8 py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] font-bold text-white text-sm rounded-xl shadow-2xs transition-colors cursor-pointer">
                {saving ? 'Publishing...' : '🚀 Publish Live Website'}
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
