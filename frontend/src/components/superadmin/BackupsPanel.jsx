import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DatabaseBackup, Download, Upload, RotateCcw, Trash2, RefreshCw, ShieldAlert, X } from 'lucide-react';
import api from '../../api/axios';

/**
 * Database backup & recovery (REQ-034): back up now, daily automatic backups, download, upload a
 * saved backup and restore. Restoring replaces all data, so it asks for the password and RESTORE.
 */
const KIND = { daily: 'Daily (automatic)', manual: 'Made by hand', 'pre-restore': 'Saved before a restore', uploaded: 'Uploaded' };
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function RestoreDialog({ backup, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/superadmin/backups/${backup.name}/restore`, { password, confirm });
      onDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'The restore failed.');
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="restore-title">
      <form onSubmit={go} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3 shadow-xl text-sm">
        <div className="flex items-center justify-between">
          <h2 id="restore-title" className="text-lg font-extrabold text-slate-900">Restore this backup?</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-semibold flex gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          Every restaurant's data goes back to {when(backup.created_at)}. Orders, bookings and changes made after that are removed. The current data is saved as a backup first.
        </p>
        <label className="block font-bold text-slate-800">Your password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300" />
        </label>
        <label className="block font-bold text-slate-800">Type RESTORE to confirm
          <input required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 font-mono" />
        </label>
        {error && <p className="text-rose-700 font-semibold" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancel</button>
          <button type="submit" disabled={busy || confirm !== 'RESTORE' || !password} className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold disabled:opacity-50">{busy ? 'Restoring…' : 'Restore'}</button>
        </div>
      </form>
    </div>
  );
}

export default function BackupsPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [restoring, setRestoring] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.get('/superadmin/backups').then((res) => setData(res.data.data)).catch((err) => setError(err.response?.data?.message || 'Could not load backups.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (label, fn) => {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong.');
    } finally {
      setBusy('');
    }
  };

  const download = (b) => run(`dl-${b.name}`, async () => {
    const res = await api.get(`/superadmin/backups/${b.name}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = b.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return `Downloading ${b.name}. Keep it somewhere private: it contains all data.`;
  });

  const upload = (file) => run('upload', async () => {
    const form = new FormData();
    form.append('backup', file);
    const res = await api.post('/superadmin/backups/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.message;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><DatabaseBackup className="w-5 h-5 text-purple-700" /> Database backups</h2>
          {data && (
            <p className="text-xs text-slate-600 mt-1">
              {data.auto_backup ? `A backup is made every day after 3 AM; the last ${data.keep_daily} are kept.` : 'Daily automatic backups are switched off (AUTO_BACKUP=false).'}
              {data.last_daily ? ` Last daily backup: ${when(data.last_daily.created_at)}.` : ' No daily backup yet.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
          <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"><Upload className="w-4 h-4" /> Upload backup</button>
          <input ref={fileRef} type="file" accept=".gz,application/gzip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />
          <button type="button" disabled={!!busy} onClick={() => run('create', async () => (await api.post('/superadmin/backups')).data.message)} className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50">
            <DatabaseBackup className="w-4 h-4" /> {busy === 'create' ? 'Backing up…' : 'Back up now'}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
        Backups are stored on the server. Download one regularly (for example weekly) and keep it off the server, so you still have your data if the hosting account has a problem. Hostinger's own database backups (hPanel → Databases) are a second safety net.
      </p>
      {notice && <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold" role="status">{notice}</p>}
      {error && <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold" role="alert">{error}</p>}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        {!data ? <p className="p-6 text-sm text-slate-500">Loading…</p> : data.backups.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">No backups yet. Use “Back up now” to make the first one.</p>
        ) : (
          <table className="w-full text-xs">
            <caption className="sr-only">Database backups</caption>
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pl-4 pr-2 font-bold">Made</th><th className="py-2 px-2 font-bold">Type</th><th className="py-2 px-2 font-bold text-right">Size</th><th className="py-2 pl-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {data.backups.map((b) => (
                <tr key={b.name} className="border-b border-slate-100">
                  <td className="py-2 pl-4 pr-2"><span className="font-bold text-slate-900 block">{when(b.created_at)}</span><span className="font-mono text-[10px] text-slate-500">{b.name}</span></td>
                  <td className="py-2 px-2">{KIND[b.kind] || b.kind}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{size(b.size)}</td>
                  <td className="py-2 pl-2 pr-4">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" disabled={!!busy} onClick={() => download(b)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold flex items-center gap-1 disabled:opacity-50"><Download className="w-3.5 h-3.5" /> Download</button>
                      <button type="button" disabled={!!busy} onClick={() => setRestoring(b)} className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 font-bold flex items-center gap-1 disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5" /> Restore</button>
                      <button type="button" disabled={!!busy} onClick={() => { if (window.confirm(`Delete ${b.name}?`)) run(`del-${b.name}`, async () => (await api.delete(`/superadmin/backups/${b.name}`)).data.message); }} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-700 disabled:opacity-50" aria-label={`Delete ${b.name}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {restoring && <RestoreDialog backup={restoring} onClose={() => setRestoring(null)} onDone={(msg) => { setRestoring(null); setNotice(msg); load(); }} />}
    </div>
  );
}
