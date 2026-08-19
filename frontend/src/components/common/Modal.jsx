import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className={`w-full ${maxWidth} bg-white border border-[#D7E5E8] rounded-2xl shadow-xl overflow-hidden`}>
        <div className="px-6 py-4 border-b border-[#D7E5E8] flex items-center justify-between bg-[#EAF4F7]/40">
          <h3 className="text-lg font-bold text-[#1F2937] tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
