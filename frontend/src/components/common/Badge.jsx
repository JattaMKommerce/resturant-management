import React from 'react';

const statusColorMap = {
  // Table Statuses
  AVAILABLE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  OCCUPIED: 'bg-blue-100 text-blue-800 border-blue-300',
  ORDERING: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  RESERVED: 'bg-purple-100 text-purple-800 border-purple-300',
  BILL_REQUESTED: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse',
  BILL_PAID: 'bg-cyan-100 text-cyan-900 border-cyan-300',
  CLEANING: 'bg-teal-100 text-teal-900 border-teal-300',
  OUT_OF_SERVICE: 'bg-rose-100 text-rose-900 border-rose-300',

  // Order / KOT Statuses
  PENDING: 'bg-amber-100 text-amber-900 border-amber-300',
  ACCEPTED: 'bg-blue-100 text-blue-900 border-blue-300',
  PREPARING: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  READY: 'bg-emerald-600 text-white border-transparent shadow-xs',
  SERVED: 'bg-slate-200 text-slate-800 border-slate-300',
  COMPLETED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  CANCELLED: 'bg-rose-100 text-rose-900 border-rose-300',

  // QR Statuses
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  INACTIVE: 'bg-slate-200 text-slate-700 border-slate-300'
};

export default function Badge({ status, text }) {
  const colorClass = statusColorMap[status] || 'bg-slate-100 text-slate-800 border-slate-300';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
      {text || status}
    </span>
  );
}

