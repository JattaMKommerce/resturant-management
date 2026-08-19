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
    <div className="bg-[#EAF4F7] -m-4 sm:-m-6 p-4 sm:p-6 min-h-[calc(100vh-4rem)] text-[#1F2937] rounded-xl space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-[#3A7D7C]" />
            <span>Kitchen Preparation History</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Archived log of completed and served kitchen tickets</p>
        </div>

        <button
          onClick={fetchHistory}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* History Table */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1F2937]">
            <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
              <tr>
                <th className="px-6 py-4">KOT #</th>
                <th className="px-6 py-4">Table</th>
                <th className="px-6 py-4">Kitchen Dept</th>
                <th className="px-6 py-4">Items Count</th>
                <th className="px-6 py-4">Completed Time</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D7E5E8]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#64748B]">Loading kitchen history...</td>
                </tr>
              ) : historyKOTs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#64748B]">No completed KOTs found in history.</td>
                </tr>
              ) : (
                historyKOTs.map((kot) => (
                  <tr key={kot.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#1F2937] font-mono">#{kot.kot_number}</td>
                    <td className="px-6 py-4 text-[#1F2937] font-semibold">Table {kot.table_number || 'N/A'}</td>
                    <td className="px-6 py-4 text-[#64748B]">{kot.kitchen_department_name}</td>
                    <td className="px-6 py-4 font-medium text-[#1F2937]">{kot.items ? kot.items.length : 0} items</td>
                    <td className="px-6 py-4 text-xs text-[#64748B]">
                      {kot.completed_at ? new Date(kot.completed_at).toLocaleString() : new Date(kot.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        kot.status === 'SERVED' ? 'bg-[#EAF4F7] text-[#3A7D7C] border border-[#D7E5E8]' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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
