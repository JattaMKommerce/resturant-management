import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, X, ArrowRight, Receipt } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function NotificationToast() {
  const { toast, setToast } = useSocket();

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-in slide-in-from-bottom duration-300 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            {toast.link ? <Receipt className="w-5 h-5 text-amber-400" /> : <Bell className="w-5 h-5" />}
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

      {toast.link && (
        <Link
          to={toast.link}
          onClick={() => setToast(null)}
          className="mt-1 w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-orange-500/20"
        >
          <span>Open Billing Desk & Generate Bill</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
