import React from 'react';
import { Bell, X } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function NotificationToast() {
  const { toast, setToast } = useSocket();

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-800 animate-slide-up flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-white">{toast.title}</h4>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>
        </div>
      </div>
      <button
        onClick={() => setToast(null)}
        className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
