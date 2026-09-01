import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, Power, MapPin, Phone, Mail, Building, Image as ImageIcon, CheckCircle2, CreditCard, Upload, Trash2, AlertCircle, ShieldCheck, Star } from 'lucide-react';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [imageError, setImageError] = useState('');

  const [restaurantId, setRestaurantId] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [about, setAbout] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('12.9716');
  const [longitude, setLongitude] = useState('77.5946');
  const [openingHours, setOpeningHours] = useState('10:00 AM - 11:30 PM');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('10.0');
  const [minOrderAmount, setMinOrderAmount] = useState('199.00');
  const [deliveryFee, setDeliveryFee] = useState('49.00');
  const [taxPercentage, setTaxPercentage] = useState('5.00');
  const [isOnlineOrderingEnabled, setIsOnlineOrderingEnabled] = useState(true);
  const [isCodEnabled, setIsCodEnabled] = useState(true);
  const [isOnlinePaymentEnabled, setIsOnlinePaymentEnabled] = useState(true);

  // Branding Images
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);

  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // Dedicated Merchant Razorpay & UPI Gateway
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');

  const [websiteStatus, setWebsiteStatus] = useState('DRAFT');
  const [customSubdomainEnabled, setCustomSubdomainEnabled] = useState(false);
  const [customSubdomainSlug, setCustomSubdomainSlug] = useState('');
  const [randomSlug, setRandomSlug] = useState('');
  const [customSlugInput, setCustomSlugInput] = useState('');
  const [showSubdomainModal, setShowSubdomainModal] = useState(false);
  const [subdomainChangesLeft, setSubdomainChangesLeft] = useState(3);
  const [subdomainChangesThisMonth, setSubdomainChangesThisMonth] = useState(0);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/restaurant');
      if (res.data.success) {
        const r = res.data.restaurant;
        setRestaurantId(r.id);
        setName(r.name || '');
        setPhone(r.phone || '');
        setEmail(r.email || '');
        setTagline(r.tagline || '');
        setDescription(r.description || '');
        setAbout(r.about || '');
        setAddress(r.address || '');
        setLatitude(r.latitude || '');
        setLongitude(r.longitude || '');
        setOpeningHours(r.opening_hours || r.opening_time || '09:00 - 22:00');
        setDeliveryRadiusKm(r.delivery_radius_km || '10');
        setMinOrderAmount(r.min_order_amount || '100');
        setDeliveryFee(r.delivery_fee || '40');
        setTaxPercentage(r.tax_percentage || '5');
        setIsOnlineOrderingEnabled(r.is_online_ordering_enabled === 1 || r.is_online_ordering_enabled === true);
        setIsCodEnabled(r.is_cod_enabled === 1 || r.is_cod_enabled === true);
        setIsOnlinePaymentEnabled(r.is_online_payment_enabled === 1 || r.is_online_payment_enabled === true);
        
        if (r.logo_url) setLogoPreview(r.logo_url);
        if (r.cover_url) setCoverPreview(r.cover_url);

        // Merchant Razorpay & UPI
        setRazorpayEnabled(r.razorpay_enabled === 1 || r.razorpay_enabled === true);
        setRazorpayKeyId(r.razorpay_key_id || '');
        setRazorpayKeySecret(r.razorpay_key_secret || '');
        setUpiId(r.upi_id || '');
        setUpiName(r.upi_name || '');

        setWebsiteStatus(r.website_status || 'DRAFT');
        setCustomSubdomainEnabled(r.custom_subdomain_enabled === 1 || r.custom_subdomain_enabled === true);
        setCustomSubdomainSlug(r.custom_subdomain_slug || '');
        setRandomSlug(r.random_slug || '');
        setCustomSlugInput(r.custom_subdomain_slug || r.slug || '');
        setSubdomainChangesLeft(r.subdomain_changes_left !== undefined ? r.subdomain_changes_left : 3);
        setSubdomainChangesThisMonth(r.subdomain_changes_this_month || 0);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCustomSubdomain = async () => {
    const slugToUse = customSlugInput.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slugToUse) {
      alert('Please enter a valid custom subdomain name.');
      return;
    }

    const confirmMsg = customSubdomainEnabled 
      ? `Update your custom subdomain name to "${slugToUse}.jattamkommerce.com"?`
      : `Upgrade to Custom Subdomain "${slugToUse}.jattamkommerce.com" for ₹99/month?`;

    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const res = await api.post('/admin/restaurant/purchase-custom-subdomain', {
        restaurant_id: restaurantId,
        custom_subdomain_slug: slugToUse
      });
      if (res.data.success) {
        const successNotice = customSubdomainEnabled
          ? `🎉 Custom Subdomain Name Updated Successfully!\nNew URL: https://${slugToUse}.jattamkommerce.com`
          : '🎉 Custom Subdomain Unlocked Successfully!';
        alert(successNotice);
        if (res.data.restaurant && updateRestaurant) {
          updateRestaurant(res.data.restaurant);
        }
        await fetchSettings();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update custom subdomain.');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setImageError('');

    try {
      const formData = new FormData();
      formData.append('id', restaurantId);
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('email', email);
      formData.append('tagline', tagline);
      formData.append('description', description);
      formData.append('about', about);
      formData.append('address', address);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('opening_hours', openingHours);
      formData.append('delivery_radius_km', deliveryRadiusKm);
      formData.append('min_order_amount', minOrderAmount);
      formData.append('delivery_fee', deliveryFee);
      formData.append('tax_percentage', taxPercentage);
      formData.append('is_online_ordering_enabled', isOnlineOrderingEnabled ? '1' : '0');
      formData.append('is_cod_enabled', isCodEnabled ? '1' : '0');
      formData.append('is_online_payment_enabled', isOnlinePaymentEnabled ? '1' : '0');

      // Branding Images
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

      // Subdomain & Custom URL Slug
      if (customSlugInput) {
        const cleanSlug = customSlugInput.toLowerCase().replace(/[^a-z0-9-]/g, '');
        formData.append('custom_subdomain_slug', cleanSlug);
        formData.append('slug', cleanSlug);
      }

      // Razorpay & UPI
      formData.append('razorpay_enabled', razorpayEnabled ? '1' : '0');
      formData.append('razorpay_key_id', razorpayKeyId);
      formData.append('razorpay_key_secret', razorpayKeySecret);
      formData.append('upi_id', upiId);
      formData.append('upi_name', upiName);

      const res = await api.put('/admin/restaurant/settings', formData);

      if (res.data.success) {
        setSuccessMsg('Restaurant configuration saved successfully!');
        if (res.data.restaurant) {
          setWebsiteStatus(res.data.restaurant.website_status || websiteStatus);
          if (res.data.restaurant.logo_url) setLogoPreview(res.data.restaurant.logo_url);
          if (res.data.restaurant.cover_url) setCoverPreview(res.data.restaurant.cover_url);
        }
        setTimeout(() => setSuccessMsg(''), 4000);
      }

    } catch (err) {
      console.error('Error saving settings:', err);
      alert(err.response?.data?.message || 'Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-16 text-[#64748B] text-xs">
          Loading settings...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-6 antialiased font-sans">
        
        {/* Header */}
        <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
              <Settings className="w-6 h-6 text-[#3A7D7C]" />
              <span>Restaurant Settings & Configuration</span>
            </h2>
            <p className="text-[#64748B] text-xs sm:text-sm mt-0.5 font-medium">Configure storefront branding, online ordering availability, delivery radius, and pricing</p>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {successMsg}
          </div>
        )}

        {imageError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {imageError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-[#D7E5E8] shadow-xs space-y-6">
          
          {/* ONLINE ORDERING TOGGLE SECTION */}
          <div className="p-5 rounded-2xl bg-[#EAF4F7] border border-[#D7E5E8] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1F2937] flex items-center gap-2">
                  <Power className="w-4 h-4 text-[#3A7D7C]" /> Online Ordering Master Toggle
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  When turned OFF, customers will see a message: "Online ordering is currently unavailable."
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOnlineOrderingEnabled(!isOnlineOrderingEnabled)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                  isOnlineOrderingEnabled
                    ? 'bg-[#3A7D7C] text-white hover:bg-[#2F6665]'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                {isOnlineOrderingEnabled ? 'ONLINE ORDERING ON' : 'ONLINE ORDERING OFF'}
              </button>
            </div>

            {isOnlineOrderingEnabled && websiteStatus !== 'PUBLISHED' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2 mt-1">
                <span>⚠️ <strong>Master toggle is ON</strong>, but your website is currently in <strong>{websiteStatus}</strong> state. Customers cannot order until you go to <strong>Website Controls</strong> and click <strong>"Publish Website Live"</strong>.</span>
              </div>
            )}
          </div>

          {/* BRANDING IMAGES UPLOAD SECTION */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#3A7D7C]" />
              <span>Storefront Branding & Visual Assets</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Logo Upload Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-[#D7E5E8] flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#1F2937]">Hotel / Restaurant Logo</span>
                    <span className="text-[10px] font-bold text-[#3A7D7C] bg-[#EAF4F7] px-2 py-0.5 rounded-md border border-[#D7E5E8]">
                      Square
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B]">Square 512×512 PNG, JPG, or WebP.</p>
                </div>

                <div className="w-full flex items-center justify-center p-3 bg-white rounded-xl border border-[#D7E5E8]">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      className="w-20 h-20 rounded-2xl object-contain border border-[#D7E5E8] p-1 bg-white shadow-2xs"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[#D7E5E8] flex flex-col items-center justify-center text-[#64748B] bg-slate-50">
                      <ImageIcon className="w-5 h-5 text-[#64748B]/60 mb-1" />
                      <span className="text-[10px] font-semibold">No Logo</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex-1 py-2 px-3 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-2xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{logoPreview ? 'Change Logo' : 'Upload Logo'}</span>
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="py-2 px-3 bg-white hover:bg-rose-50 text-[#64748B] hover:text-rose-600 font-bold rounded-xl border border-[#D7E5E8] text-xs transition-colors"
                      title="Remove Logo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cover Image Upload Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-[#D7E5E8] flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#1F2937]">Storefront Cover / Hero Banner</span>
                    <span className="text-[10px] font-bold text-[#3A7D7C] bg-[#EAF4F7] px-2 py-0.5 rounded-md border border-[#D7E5E8]">
                      Landscape
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B]">Wide 16:6 banner for storefront header.</p>
                </div>

                <div className="w-full flex items-center justify-center p-2 bg-white rounded-xl border border-[#D7E5E8]">
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover Preview"
                      className="w-full h-20 rounded-xl object-cover border border-[#D7E5E8] shadow-2xs"
                    />
                  ) : (
                    <div className="w-full h-20 rounded-xl border-2 border-dashed border-[#D7E5E8] flex flex-col items-center justify-center text-[#64748B] bg-slate-50">
                      <ImageIcon className="w-5 h-5 text-[#64748B]/60 mb-1" />
                      <span className="text-[10px] font-semibold">No Cover Image</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleCoverChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="flex-1 py-2 px-3 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-2xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{coverPreview ? 'Change Cover' : 'Upload Cover'}</span>
                  </button>
                  {coverPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="py-2 px-3 bg-white hover:bg-rose-50 text-[#64748B] hover:text-rose-600 font-bold rounded-xl border border-[#D7E5E8] text-xs transition-colors"
                      title="Remove Cover Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-[#D7E5E8]">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Restaurant Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Storefront Tagline</label>
              <input
                type="text"
                value={tagline}
                placeholder="Where Every Meal is a Royal Experience"
                onChange={(e) => setTagline(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Contact Phone *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Contact Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Opening Hours</label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-[#1F2937] mb-1">Full Address *</label>
            <textarea
              rows="2"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
            ></textarea>
          </div>

          {/* Location Coordinates & Radius */}
          <div className="pt-4 border-t border-[#D7E5E8] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Restaurant Latitude *</label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Restaurant Longitude *</label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Delivery Radius (KM) *</label>
              <input
                type="number"
                step="0.1"
                required
                value={deliveryRadiusKm}
                onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                className="w-full p-2.5 bg-[#EAF4F7] border border-[#D7E5E8] rounded-xl font-bold text-[#3A7D7C] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>
          </div>

          {/* Charges & Tax */}
          <div className="pt-4 border-t border-[#D7E5E8] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Minimum Order Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Delivery Fee (₹)</label>
              <input
                type="number"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Tax Percentage (%)</label>
              <input
                type="number"
                step="0.01"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
              />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="pt-4 border-t border-[#D7E5E8] flex flex-wrap gap-6 text-xs font-bold text-[#1F2937]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCodEnabled}
                onChange={(e) => setIsCodEnabled(e.target.checked)}
                className="accent-[#3A7D7C] rounded"
              />
              Enable Cash on Delivery (COD)
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isOnlinePaymentEnabled}
                onChange={(e) => setIsOnlinePaymentEnabled(e.target.checked)}
                className="accent-[#3A7D7C] rounded"
              />
              Enable Online Payments
            </label>
          </div>

          {/* Dedicated Razorpay Merchant Account Settings */}
          <div className="pt-5 border-t border-[#D7E5E8] space-y-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-[#D7E5E8] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#3A7D7C]" />
                    <span>Restaurant Razorpay Merchant Gateway (Direct Bank Payouts)</span>
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Enter your restaurant's own Razorpay keys. All online deliveries and Table QR payments will deposit 100% directly into your bank account.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={razorpayEnabled}
                    onChange={(e) => setRazorpayEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3A7D7C]"></div>
                </label>
              </div>

              {razorpayEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                  <div>
                    <label className="block font-bold text-[#1F2937] mb-1">Razorpay Key ID (Key ID) *</label>
                    <input
                      type="text"
                      placeholder="e.g. rzp_live_xxxxxxxx or rzp_test_xxxxxxxx"
                      value={razorpayKeyId}
                      onChange={(e) => setRazorpayKeyId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-mono text-xs focus:outline-none focus:border-[#3A7D7C]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1F2937] mb-1">Razorpay Key Secret (Secret) *</label>
                    <input
                      type="password"
                      placeholder="e.g. your_secret_key"
                      value={razorpayKeySecret}
                      onChange={(e) => setRazorpayKeySecret(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-mono text-xs focus:outline-none focus:border-[#3A7D7C]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1F2937] mb-1">UPI VPA ID (For Instant UPI QR)</label>
                    <input
                      type="text"
                      placeholder="e.g. restaurant@okaxis or 9876543210@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] font-mono text-xs focus:outline-none focus:border-[#3A7D7C]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1F2937] mb-1">Merchant Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Grand Palace Restaurant Hubli"
                      value={upiName}
                      onChange={(e) => setUpiName(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#D7E5E8] rounded-xl text-[#1F2937] text-xs focus:outline-none focus:border-[#3A7D7C]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Store Subdomain Routing & Branding Settings */}
          <div className="pt-5 border-t border-[#D7E5E8] space-y-3">
            <h4 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
              <Building className="w-4 h-4 text-[#3A7D7C]" />
              <span>Digital Storefront Subdomain Routing</span>
            </h4>
                   {customSubdomainEnabled ? (
              <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-900 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                    <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-xs">Official Custom Subdomain Active</h5>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${subdomainChangesLeft > 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                        ⚡ {subdomainChangesLeft} of 3 name updates left this month
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
                      https://{customSubdomainSlug || name.toLowerCase().replace(/[^a-z0-9-]/g, '')}.jattamkommerce.com
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSubdomainModal(true)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-full shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  ✏️ Update Subdomain Name
                </button>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-[#EAF4F7] to-amber-50 p-4 rounded-2xl border border-[#3A7D7C]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <h5 className="font-bold text-xs text-[#1F2937]">Free Tier Random Subdomain</h5>
                  <p className="text-[11px] text-[#64748B] font-mono mt-0.5">
                    Current Link: <span className="font-bold text-[#3A7D7C]">https://{randomSlug || 'aK8xP2qZ'}.jattamkommerce.com</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSubdomainModal(true)}
                  className="px-5 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-extrabold rounded-full shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <CreditCard className="w-4 h-4" /> Activate Custom Subdomain (₹99/mo)
                </button>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-[#D7E5E8] flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-xs px-6 py-3 rounded-xl shadow-2xs transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Changes...' : 'Save Restaurant Settings'}
            </button>
          </div>

        </form>

      </div>

      {/* SUBDOMAIN DETAILS & UPDATE / PAYMENT CARD MODAL */}
      {showSubdomainModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#D7E5E8] max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-[#D7E5E8] pb-4">
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${customSubdomainEnabled ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-amber-100 text-amber-900 border-amber-300'}`}>
                  {customSubdomainEnabled ? 'Active Subdomain Management' : 'Subdomain Add-On'}
                </span>
                <h3 className="text-lg font-extrabold text-[#1F2937] mt-1">
                  {customSubdomainEnabled ? 'Update Subdomain Name' : 'Official Restaurant Subdomain Plan'}
                </h3>
                <p className="text-xs text-[#64748B]">
                  {customSubdomainEnabled ? 'Change your digital store URL (Max 3 changes per month)' : 'Unlock official restaurant branding for your digital store'}
                </p>
              </div>
              <button onClick={() => setShowSubdomainModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-[#1F2937]">Enter Desired Custom Subdomain Name:</label>
                <div className="relative w-full">
                  <input
                    type="text"
                    value={customSlugInput}
                    onChange={(e) => setCustomSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="e.g. nithin-hotel"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-xs font-bold text-[#1F2937] focus:outline-none focus:border-[#3A7D7C]"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-[#94A3B8] font-mono">.jattamkommerce.com</span>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 mt-1 text-[11px] font-mono">
                  <span className="text-[#64748B]">Live Preview: <strong className="text-[#3A7D7C]">https://{customSlugInput || 'yourname'}.jattamkommerce.com</strong></span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${subdomainChangesLeft > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
                    ⚡ {subdomainChangesLeft} of 3 name updates left this month
                  </span>
                </div>
              </div>

              {!customSubdomainEnabled && (
                <div className="bg-gradient-to-r from-amber-50 to-[#EAF4F7] p-4 rounded-2xl border border-amber-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black text-[#1F2937]">₹99</span>
                    <span className="text-xs text-[#64748B] font-bold"> / month</span>
                  </div>
                  <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2.5 py-1 rounded-full">
                    INSTANT ACTIVATION
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-bold text-[#1F2937] uppercase tracking-wider text-[10px]">Included Features:</h4>
                <div className="space-y-2 text-[#334155] font-medium">
                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block">Official Restaurant Subdomain</strong>
                      <span><code className="bg-white px-1 rounded border text-[#3A7D7C]">{customSlugInput || 'yourname'}.jattamkommerce.com</code></span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block">Custom Dine-In Table QR Codes</strong>
                      <span>Print high-quality branded QR codes for tables and flyers</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block">WhatsApp & Social Media Brand Identity</strong>
                      <span>Clean restaurant name link previews when sharing with customers</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D7E5E8] mt-4">
              <button
                type="button"
                onClick={() => setShowSubdomainModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || (customSubdomainEnabled && subdomainChangesLeft <= 0)}
                onClick={async () => {
                  await handlePurchaseCustomSubdomain();
                  setShowSubdomainModal(false);
                }}
                className={`px-5 py-2.5 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  customSubdomainEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-[#3A7D7C] hover:bg-[#2F6665] text-white'
                } ${subdomainChangesLeft <= 0 && customSubdomainEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <CreditCard className="w-4 h-4" />
                {saving 
                  ? 'Saving Subdomain...' 
                  : customSubdomainEnabled 
                  ? '💾 Save New Subdomain Name' 
                  : '💳 Pay ₹99 & Unlock Custom Subdomain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
