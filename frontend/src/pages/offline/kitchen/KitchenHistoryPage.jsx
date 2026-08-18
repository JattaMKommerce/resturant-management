import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { ChefHat, History, RefreshCw } from 'lucide-react';

export default function KitchenHistoryPage() {
  const [historyKOTs, setHistoryKOTs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [readyRes, servedRes] = await Promise.all([
        api.get('/kots?status=READY'),
        api.get('/kots?status=SERVED')
      ]);

      let combined = [];
      if (readyRes.success) combined = combined.concat(readyRes.data);
      if (servedRes.success) combined = combined.concat(servedRes.data);

      combined.sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at));
      setHistoryKOTs(combined);
    } catch (err) {
      console.error('Failed to load kitchen history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <History className="w-7 h-7 text-amber-500" />
            <span>Kitchen Preparation History</span>
          </h2>
          <p className="text-slate-400 text-sm">Archived log of completed and served kitchen tickets</p>
        </div>

        <button
          onClick={fetchHistory}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* History Table */}
      <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">KOT #</th>
                <th className="px-6 py-4">Table</th>
                <th className="px-6 py-4">Kitchen Dept</th>
                <th className="px-6 py-4">Items Count</th>
                <th className="px-6 py-4">Completed Time</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Loading kitchen history...</td>
                </tr>
              ) : historyKOTs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No completed KOTs found in history.</td>
                </tr>
              ) : (
                historyKOTs.map((kot) => (
                  <tr key={kot.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white font-mono">#{kot.kot_number}</td>
                    <td className="px-6 py-4 text-slate-300 font-semibold">Table {kot.table_number || 'N/A'}</td>
                    <td className="px-6 py-4 text-slate-400">{kot.kitchen_department_name}</td>
                    <td className="px-6 py-4 font-medium">{kot.items ? kot.items.length : 0} items</td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {kot.completed_at ? new Date(kot.completed_at).toLocaleString() : new Date(kot.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        kot.status === 'SERVED' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        {kot.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
