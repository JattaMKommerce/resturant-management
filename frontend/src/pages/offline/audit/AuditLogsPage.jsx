import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { ShieldAlert, RefreshCw, Clock } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs');
      if (res.success) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <div className="space-y-6 antialiased font-sans">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#3A7D7C]" />
            <span>System Audit Logs</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Security audit trail recording table operations, QR regenerations, KOT transitions, billing, and inventory changes</p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors shadow-2xs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1F2937]">
            <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Entity ID</th>
                <th className="px-6 py-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D7E5E8]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#64748B]">Loading audit trail...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#64748B]">No audit logs recorded yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-xs text-[#64748B] font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-[#1F2937]">
                      {log.user_name || 'System / Customer'}
                    </td>
                    <td className="px-6 py-4 text-[#3A7D7C] font-bold">{log.action}</td>
                    <td className="px-6 py-4 text-[#1F2937]">{log.entity}</td>
                    <td className="px-6 py-4 font-mono text-xs text-[#64748B]">#{log.entity_id || 'N/A'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-[#64748B]">{log.ip_address || '127.0.0.1'}</td>
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
