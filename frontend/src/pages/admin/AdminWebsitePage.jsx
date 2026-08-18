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
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AdminLayout>
    );
  }

  const isPublished = restaurant?.website_status === 'PUBLISHED';
  const publicUrl = `${window.location.origin}/restaurant/${restaurant?.slug}`;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Website Status Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg ${isPublished ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-slate-700'}`}>
              <Globe className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800">Website Publishing State</h2>
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {restaurant?.website_status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isPublished ? 'Your website is live and visible to customers.' : 'Your website is in DRAFT state. Complete setup and publish.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {isPublished ? (
              <button onClick={handleUnpublish} disabled={actionLoading} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all">
                Unpublish Website
              </button>
            ) : (
              <button onClick={handlePublish} disabled={actionLoading} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all">
                Publish Website Live 🚀
              </button>
            )}
            <a href={`/restaurant/${restaurant?.slug}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-orange-500/20 transition-all">
              <Eye className="w-4 h-4" /> Live Website ↗
            </a>
          </div>
        </div>

        {/* Public URL Box */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
          <h3 className="font-semibold text-slate-800 text-sm">Public Website Address</h3>
          <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-xs text-slate-700">
            <span className="flex-1 truncate">{publicUrl}</span>
            <button onClick={() => { navigator.clipboard.writeText(publicUrl); alert('URL copied!'); }} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 text-[11px] font-bold">
              Copy
            </button>
          </div>
        </div>

        {/* Online Ordering Toggle */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Online Ordering Status</h3>
            <p className="text-xs text-slate-500 mt-0.5">Toggle customer order acceptance on your live website.</p>
          </div>
          <button onClick={handleToggleOrdering} disabled={actionLoading} className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 text-white shadow-md transition-all ${restaurant?.is_online_ordering_enabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
            <Power className="w-4 h-4" />
            {restaurant?.is_online_ordering_enabled ? 'Store Open (Click to Pause)' : 'Store Paused (Click to Accept Orders)'}
          </button>
        </div>

        {/* Onboarding Setup Progress Card */}
        {progress && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">Setup Checklist ({progress.completedCount}/7)</h3>
              <Link to={`/admin/${restaurant?.slug}/onboarding`} className="text-xs text-orange-600 font-bold hover:underline flex items-center gap-1">
                Open Wizard <Sparkles className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(progress.steps).map(([key, isDone]) => (
                <div key={key} className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <CheckCircle className={`w-4 h-4 ${isDone ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span className="capitalize font-medium">{key}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
