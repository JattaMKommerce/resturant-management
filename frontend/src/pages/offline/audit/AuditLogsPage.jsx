import React, { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import { ShieldAlert, RefreshCw, Search } from 'lucide-react';

/**
 * Audit trail (REQ-035): every change made by staff and admins, plus logins, logouts and
 * password changes. Passwords, secrets and codes are never stored.
 */
const PAGE = 200;

function friendlyAction(action) {
  const map = {
    LOGIN: 'Logged in', LOGIN_FAILED: 'Failed login', LOGOUT: 'Logged out',
    PASSWORD_RESET: 'Reset password', PASSWORD_CHANGED: 'Changed password'
  };
  if (map[action]) return map[action];
  const m = String(action || '').match(/^(POST|PUT|PATCH|DELETE)\s+(.*)$/);
  if (!m) return action;
  const verb = { POST: 'Created / ran', PUT: 'Updated', PATCH: 'Changed', DELETE: 'Deleted' }[m[1]];
  return `${verb} ${m[2]}`;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', from: '', to: '' });
  const [hasMore, setHasMore] = useState(false);
  const [open, setOpen] = useState(null);

  const fetchAuditLogs = useCallback(async ({ append = false, beforeId } = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (beforeId) params.set('before_id', String(beforeId));
      const res = await api.get(`/audit-logs?${params.toString()}`);
      if (res.success) {
        setLogs((prev) => (append ? [...prev, ...res.data] : res.data));
        setHasMore(res.data.length === PAGE);
      }
    } catch (err) {
      setError(err.message || 'Could not load the audit trail.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchAuditLogs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const details = (log) => {
    if (!log.metadata_json) return null;
    // The column is JSON on some databases (comes back as an object) and TEXT on others
    if (typeof log.metadata_json === 'object') return JSON.stringify(log.metadata_json, null, 2);
    try { return JSON.stringify(JSON.parse(log.metadata_json), null, 2); } catch (e) { return String(log.metadata_json); }
  };

  return (
    <div className="space-y-6 antialiased font-sans">
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#3A7D7C]" />
            <span>Audit Logs</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Every change made by staff and admins, plus logins and password changes. Passwords and secrets are never recorded.</p>
        </div>
        <button onClick={() => fetchAuditLogs()} aria-label="Refresh"
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors shadow-2xs">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <form className="flex flex-wrap items-end gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); fetchAuditLogs(); }}>
        <label className="flex flex-col gap-0.5 font-semibold text-[#64748B] grow min-w-[180px]">Search
          <span className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="menu, refund, login, order number…"
              className="w-full pl-8 pr-2 py-2 border border-[#D7E5E8] rounded-xl bg-white" />
          </span>
        </label>
        <label className="flex flex-col gap-0.5 font-semibold text-[#64748B]">From
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="p-2 border border-[#D7E5E8] rounded-xl bg-white" />
        </label>
        <label className="flex flex-col gap-0.5 font-semibold text-[#64748B]">To
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="p-2 border border-[#D7E5E8] rounded-xl bg-white" />
        </label>
        <button type="submit" className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold">Apply</button>
      </form>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold" role="alert">{error}</div>}

      <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">What</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">IP address</th>
                <th className="px-4 py-3"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D7E5E8] text-xs">
              {logs.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-[#64748B]">{loading ? 'Loading audit trail…' : 'No audit entries for these filters.'}</td></tr>
              ) : logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className={`hover:bg-slate-50/80 ${log.action === 'LOGIN_FAILED' ? 'bg-rose-50/40' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-[#64748B]">{new Date(log.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#1F2937]">{log.user_name || (log.action === 'LOGIN_FAILED' ? 'Unknown' : 'System')}</div>
                      {log.user_role && <div className="text-[11px] text-[#64748B]">{log.user_role}</div>}
                    </td>
                    <td className="px-4 py-3 text-[#1F2937] font-semibold">{friendlyAction(log.action)}</td>
                    <td className="px-4 py-3 text-[#475569]">{log.entity || '—'}{log.entity_id ? ` #${log.entity_id}` : ''}</td>
                    <td className="px-4 py-3 font-mono text-[#64748B]">{log.ip_address || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {log.metadata_json && (
                        <button type="button" onClick={() => setOpen(open === log.id ? null : log.id)} aria-expanded={open === log.id}
                          className="font-bold text-[#3A7D7C] hover:underline">{open === log.id ? 'Hide' : 'Details'}</button>
                      )}
                    </td>
                  </tr>
                  {open === log.id && (
                    <tr><td colSpan="6" className="px-4 pb-3"><pre className="text-[11px] bg-slate-50 border border-[#D7E5E8] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">{details(log)}</pre></td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="p-3 text-center border-t border-[#D7E5E8]">
            <button type="button" disabled={loading} onClick={() => fetchAuditLogs({ append: true, beforeId: logs[logs.length - 1]?.id })}
              className="px-4 py-2 rounded-xl bg-white border border-[#D7E5E8] text-xs font-bold hover:bg-slate-50 disabled:opacity-50">
              {loading ? 'Loading…' : 'Load older entries'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
