import React from 'react';
import { Bell, X } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function NotificationToast() {
  const { toast, setToast } = useSocket();

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white text-[#1F2937] rounded-2xl p-4 shadow-xl border border-[#D7E5E8] animate-slide-up flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#D7E5E8]">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-[#1F2937]">{toast.title}</h4>
          <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{toast.message}</p>
        </div>
      </div>
      <button
        onClick={() => setToast(null)}
        className="text-[#64748B] hover:text-[#1F2937] p-1 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
