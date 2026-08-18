import React from 'react';

const statusColorMap = {
  // Table Statuses
  AVAILABLE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  OCCUPIED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ORDERING: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  RESERVED: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  BILL_REQUESTED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  BILL_PAID: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  CLEANING: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  OUT_OF_SERVICE: 'bg-rose-500/10 text-rose-400 border-rose-500/30',

  // Order / KOT Statuses
  PENDING: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  ACCEPTED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  PREPARING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  READY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  SERVED: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',

  // QR Statuses
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  INACTIVE: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
};

export default function Badge({ status, text }) {
  const colorClass = statusColorMap[status] || 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
      {text || status}
    </span>
  );
}
