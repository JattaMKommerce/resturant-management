import React, { useEffect, useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

/**
 * Choose what a manager or staff member may do in the admin area (REQ-029).
 */
export default function StaffPermissionsModal({ member, onClose }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get(`/admin/staff/${member.id}/permissions`)
      .then((res) => { setData(res.data); setSelected(res.data.permissions || []); })
      .catch((err) => setError(err.response?.data?.message || 'Could not load permissions.'));
  }, [member.id]);

  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const save = async (reset = false) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await api.put(`/admin/staff/${member.id}/permissions`, reset ? { reset: true } : { permissions: selected });
      setMessage(res.data.message);
      if (reset) setSelected(res.data.permissions || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save permissions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="perm-title">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 border border-[#D7E5E8] shadow-xl space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h2 id="perm-title" className="text-sm font-extrabold text-[#1F2937] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#3A7D7C]" /> Permissions · {member.name}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold" role="alert">{error}</div>}
        {message && <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold" role="status">{message}</div>}

        {!data ? (
          !error && <p className="text-[#64748B]">Loading…</p>
        ) : !data.editable ? (
          <p className="text-[#475569]">Restaurant owners always have full access.</p>
        ) : (
          <>
            <p className="text-[#64748B]">
              Role: <strong>{data.staff.role}</strong>. {data.custom ? 'Custom permissions are set.' : 'Using the role\'s default permissions.'} Kitchen, waiter and billing screens follow the role and are not affected.
            </p>
            <ul className="space-y-2">
              {data.catalog.map((p) => (
                <li key={p.key}>
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${selected.includes(p.key) ? 'bg-[#EAF4F7] border-[#3A7D7C]' : 'bg-white border-[#D7E5E8]'}`}>
                    <input type="checkbox" className="mt-0.5 accent-[#3A7D7C]" checked={selected.includes(p.key)} onChange={() => toggle(p.key)} />
                    <span>
                      <span className="font-bold text-[#1F2937] block">{p.label}</span>
                      <span className="text-[#64748B]">{p.description}</span>
                      {data.role_defaults.includes(p.key) && <span className="ml-1 text-[10px] font-bold text-[#3A7D7C]">· role default</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-between gap-2">
              <button type="button" disabled={saving} onClick={() => save(true)} className="px-3 py-2 rounded-xl bg-white border border-[#D7E5E8] font-bold hover:bg-slate-50 disabled:opacity-50">
                Reset to role defaults
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Close</button>
                <button type="button" disabled={saving} onClick={() => save(false)} className="px-4 py-2 rounded-xl bg-[#3A7D7C] text-white font-bold disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save permissions'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
