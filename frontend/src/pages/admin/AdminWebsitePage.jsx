import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import AdminLayout from '../../components/AdminLayout';
import { Globe, Power, ExternalLink, CheckCircle, AlertCircle, RefreshCw, Eye, Sparkles } from 'lucide-react';

export default function AdminWebsitePage() {
  const { slug } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

      if (restRes.data.success) setRestaurant(restRes.data.restaurant);
      if (progRes.data.success) setProgress(progRes.data);
    } catch (err) {
      console.error('Website page load error:', err);
    } finally {
      setLoading(false);
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
    setActionLoading(true);
    try {
      const enabled = !restaurant.is_online_ordering_enabled;
      await api.post('/admin/restaurant/toggle-ordering', { enabled, restaurantId: restaurant?.id });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle ordering.');
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
  const publicUrl = `${window.location.origin}/restaurant/${restaurant?.slug}`;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 antialiased font-sans">

        {/* Website Status Hero Card */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white shadow-2xs ${isPublished ? 'bg-emerald-600' : 'bg-[#3A7D7C]'}`}>
              <Globe className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-[#1F2937]">Website Publishing State</h2>
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${isPublished ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-[#64748B] border-[#D7E5E8]'}`}>
                  {restaurant?.website_status}
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
                Unpublish Website
              </button>
            ) : (
              <button onClick={handlePublish} disabled={actionLoading} className="px-6 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors">
                Publish Website Live 🚀
              </button>
            )}
            <a href={`/restaurant/${restaurant?.slug}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#1F2937] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-[#D7E5E8]">
              <Eye className="w-4 h-4 text-[#3A7D7C]" /> Live Website ↗
            </a>
          </div>
        </div>

        {/* Public URL Box */}
        <div className="bg-white rounded-2xl border border-[#D7E5E8] p-5 sm:p-6 shadow-xs space-y-3">
          <h3 className="font-bold text-[#1F2937] text-sm">Public Storefront Address</h3>
          <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-[#D7E5E8] font-mono text-xs text-[#1F2937]">
            <span className="flex-1 truncate">{publicUrl}</span>
            <button onClick={() => { navigator.clipboard.writeText(publicUrl); alert('URL copied to clipboard!'); }} className="px-3 py-1 bg-white border border-[#D7E5E8] rounded-lg text-[#1F2937] hover:bg-slate-100 text-[11px] font-bold shadow-2xs transition-colors">
              Copy
            </button>
          </div>
        </div>

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
