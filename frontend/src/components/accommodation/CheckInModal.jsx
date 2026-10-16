import React, { useState } from 'react';
import Modal from '../common/Modal';
import { 
  User, 
  Phone, 
  Mail, 
  FileText, 
  LogIn, 
  Building, 
  DollarSign, 
  Calendar, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function CheckInModal({
  isOpen,
  onClose,
  room,
  onCheckInSubmit
}) {
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!room) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.guest_name || String(formData.guest_name).trim() === '') {
      setError('Please enter the primary guest full name.');
      return;
    }

    setSubmitting(true);
    try {
      await onCheckInSubmit(room.id, formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete guest check-in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Guest Check-In • Room ${room.room_number}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Room Brief Banner */}
        <div className="p-3 rounded-2xl bg-[#EAF4F7]/60 border border-[#D7E5E8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold text-xs">
              {room.room_number}
            </div>
            <div>
              <span className="text-[10px] text-[#3A7D7C] font-bold uppercase tracking-wider block">
                {room.floor} • {room.room_type}
              </span>
              <span className="text-xs font-bold text-slate-800">
                ₹{Number(room.rate_per_night || 0).toLocaleString('en-IN')} / night
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
            Available
          </span>
        </div>

        {/* Guest Full Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Guest Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              name="guest_name"
              value={formData.guest_name}
              onChange={handleChange}
              placeholder="e.g. Mr. Robert Downey / John Doe"
              required
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
            />
          </div>
        </div>

        {/* Contact Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                name="guest_phone"
                value={formData.guest_phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                name="guest_email"
                value={formData.guest_email}
                onChange={handleChange}
                placeholder="guest@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
              />
            </div>
          </div>
        </div>

        {/* Special Requests / Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Special Requests / Remarks (Optional)
          </label>
          <div className="relative">
            <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="2"
              placeholder="e.g. Late check-out requested, Extra towels, Vegetarian preference..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#D7E5E8] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#3A7D7C]"
            />
          </div>
        </div>

        {/* Info Note */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#3A7D7C] shrink-0 mt-0.5" />
          <span>
            Checking in will open a fresh Room Folio with an initial balance of ₹0.00 and transition the room status to <strong>OCCUPIED</strong>.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#D7E5E8] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{submitting ? 'Checking In...' : 'Confirm Check-In'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
