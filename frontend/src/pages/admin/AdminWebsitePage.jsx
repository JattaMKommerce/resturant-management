import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import { Globe, Power, ExternalLink, CheckCircle, AlertCircle, RefreshCw, Eye, Sparkles, ShieldCheck, Lock, Star, CreditCard } from 'lucide-react';
import { getRestaurantPublicUrl, getDisplayedSlugDetails } from '../../utils/subdomain';

export default function AdminWebsitePage() {
  const { slug } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [customSlugInput, setCustomSlugInput] = useState('');

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [restRes, progRes] = await Promise.all([
        api.get('/admin/restaurant'),
        api.get('/admin/restaurant/setup-progress')
      ]);

      if (restRes.data.success) {
        setRestaurant(restRes.data.restaurant);
        setCustomSlugInput(restRes.data.restaurant?.custom_subdomain_slug || restRes.data.restaurant?.slug || '');
      }
      if (progRes.data.success) setProgress(progRes.data);
    } catch (err) {
      console.error('Website page load error:', err);
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

    if (!window.confirm(`Unlock custom subdomain "${slugToUse}.jattamkommerce.com" for ₹99/month?`)) return;

    setActionLoading(true);
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
      alert(err.response?.data?.message || 'Failed to upgrade subdomain.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/admin/restaurant/publish', { restaurantId: restaurant?.id });
      if (res.data.success) loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to publish website.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!window.confirm('Unpublish website? Customers will not be able to order online.')) return;
    setActionLoading(true);
    try {
      const res = await api.post('/admin/restaurant/unpublish', { restaurantId: restaurant?.id });
      if (res.data.success) loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unpublish website.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleOrdering = async () => {
    if (!restaurant) return;
    setActionLoading(true);
    try {
      const nextState = !Boolean(restaurant.is_online_ordering_enabled);
      const res = await api.post('/admin/restaurant/toggle-ordering', {
        enabled: nextState,
        is_online_ordering_enabled: nextState
      });
      if (res.data.success) loadData();
    } catch (err) {
      console.error('Failed to toggle online ordering status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-16 text-[#64748B] text-xs">
          Loading website configuration...
        </div>
      </AdminLayout>
    );
  }

  const isPublished = restaurant?.website_status === 'PUBLISHED';
  const publicUrl = getRestaurantPublicUrl(restaurant);
  const slugInfo = getDisplayedSlugDetails(restaurant);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold text-[#3A7D7C] uppercase tracking-wider">Online Storefront</span>
            <h1 className="text-2xl font-black text-[#1F2937] tracking-tight">Website Builder & Subdomain Branding</h1>
          </div>
        </div>

        {/* Website Status & Quick Actions */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${isPublished ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-[#D7E5E8]'}`}>
              <Globe className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#1F2937] text-base">{restaurant?.name || 'Restaurant'}</h3>
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${isPublished ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-[#64748B] border-[#D7E5E8]'}`}>
                  {restaurant?.website_status || 'DRAFT'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-1 font-medium">
                {isPublished ? 'Your storefront is live and customers can place online orders.' : 'Your website is in DRAFT state. Complete setup and publish.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {isPublished ? (
              <button onClick={handleUnpublish} disabled={actionLoading} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] text-xs font-bold rounded-xl transition-colors border border-[#D7E5E8]">
                Unpublish
              </button>
            ) : (
              <button onClick={handlePublish} disabled={actionLoading} className="px-6 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors">
                Publish Website Live 🚀
              </button>
            )}
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-[#D7E5E8]">
              <Eye className="w-4 h-4 text-[#3A7D7C]" /> Live Website ↗
            </a>
          </div>
        </div>

        {/* Public Storefront URL & Subdomain Tier Box */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-[#1F2937] text-sm">Public Storefront Address</h3>
              <span className={`inline-flex items-center gap-1.5 mt-1 text-xs font-bold px-3 py-1 rounded-full border ${slugInfo.isCustom ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-[#64748B] border-[#D7E5E8]'}`}>
                {slugInfo.isCustom ? <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                {slugInfo.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-3.5 rounded-xl border border-[#D7E5E8] font-mono text-xs text-[#1F2937]">
            <span className="flex-1 truncate font-bold text-[#3A7D7C]">{publicUrl}</span>
            <button onClick={() => { navigator.clipboard.writeText(publicUrl); alert('Storefront URL copied to clipboard!'); }} className="px-3 py-1.5 bg-white border border-[#D7E5E8] rounded-lg text-[#1F2937] hover:bg-slate-100 text-[11px] font-bold shadow-2xs transition-colors">
              Copy Link
            </button>
          </div>
        </div>

        {/* Custom Subdomain Add-On Upgrade Card (₹99 / Month) */}
        {!slugInfo.isCustom ? (
          <div className="bg-gradient-to-r from-[#EAF4F7] to-amber-50 rounded-2xl border-2 border-[#3A7D7C]/30 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  ✨ Custom Subdomain Add-On
                </span>
                <h3 className="text-lg font-black text-[#1F2937]">Unlock Your Official Restaurant Name Subdomain</h3>
                <p className="text-xs text-[#475569] leading-relaxed max-w-2xl font-medium">
                  Currently your free storefront uses a random 7-character code (<code className="font-bold text-[#1F2937] bg-white px-1.5 py-0.5 rounded border border-[#D7E5E8]">{slugInfo.randomSlug}</code>). 
                  Upgrade to the **₹99/month Custom Subdomain Add-on** to display your official restaurant name (<code className="font-bold text-[#3A7D7C] bg-white px-1.5 py-0.5 rounded border border-[#D7E5E8]">{customSlugInput}.jattamkommerce.com</code>) across customer links, QR codes & share buttons!
                </p>
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
                  placeholder="e.g. grandpalace"
                  className="w-full px-4 py-2.5 bg-white border border-[#D7E5E8] rounded-xl text-xs font-bold text-[#1F2937] focus:outline-hidden focus:border-[#3A7D7C] transition-all"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[#94A3B8] font-mono font-medium">.jattamkommerce.com</span>
              </div>
              <button
                onClick={handlePurchaseCustomSubdomain}
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <CreditCard className="w-4 h-4" /> Unlock Custom Subdomain (₹99/mo)
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 sm:p-6 flex items-center justify-between text-emerald-900 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Custom Subdomain Active</h4>
                <p className="text-xs text-emerald-700 font-medium">Your branded storefront link <code className="font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-900">{restaurant?.custom_subdomain_slug}.jattamkommerce.com</code> is active on the ₹99/mo tier.</p>
              </div>
            </div>
            <span className="text-xs font-extrabold bg-white text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
              ACTIVE (₹99/mo)
            </span>
          </div>
        )}

        {/* Online Ordering Toggle */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#1F2937] text-sm">Online Ordering Status</h3>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">Toggle customer order acceptance on your live website.</p>
          </div>
          <button onClick={handleToggleOrdering} disabled={actionLoading} className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 text-white shadow-2xs transition-colors ${restaurant?.is_online_ordering_enabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
            <Power className="w-4 h-4" />
            {restaurant?.is_online_ordering_enabled ? 'Store Open (Click to Pause)' : 'Store Paused (Click to Accept Orders)'}
          </button>
        </div>

        {/* Onboarding Setup Progress Card */}
        {progress && (
          <div className="bg-white rounded-2xl border border-[#D7E5E8] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1F2937] text-sm">Setup Checklist ({progress.completedCount}/7)</h3>
              <Link to={`/admin/${restaurant?.slug}/onboarding`} className="text-xs text-[#3A7D7C] font-bold hover:underline flex items-center gap-1">
                Open Wizard <Sparkles className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(progress.steps).map(([key, isDone]) => (
                <div key={key} className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-[#D7E5E8] text-[#64748B]'}`}>
                  <CheckCircle className={`w-4 h-4 ${isDone ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span className="capitalize font-semibold">{key}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
