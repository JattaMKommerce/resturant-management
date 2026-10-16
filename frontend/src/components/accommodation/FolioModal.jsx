import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import api from '../../services/api';
import { 
  Receipt, 
  User, 
  Calendar, 
  CreditCard, 
  Building, 
  LogOut, 
  Clock, 
  ShoppingBag,
  DollarSign,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  FileText
} from 'lucide-react';

export default function FolioModal({
  isOpen,
  onClose,
  room,
  onCheckOut
}) {
  const [folioData, setFolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && room?.id) {
      fetchFolio();
    }
  }, [isOpen, room]);

  const fetchFolio = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/rooms/${room.id}/folio`);
      if (res?.success) {
        setFolioData(res.data);
      } else if (res?.data) {
        setFolioData(res.data);
      } else {
        setFolioData(res);
      }
    } catch (err) {
      console.error('Failed to fetch room folio:', err);
      setError(err.message || 'Failed to load folio details');
    } finally {
      setLoading(false);
    }
  };

  if (!room) return null;

  const folio = folioData?.folio;
  const charges = folioData?.charges || [];
  const balance = parseFloat(folio?.balance || room.folio_balance || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Room ${room.room_number} • Guest Folio & Account Statement`}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#3A7D7C] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-500">Loading room folio & charges...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !folio ? (
        <div className="py-8 text-center space-y-2">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">No Folio Found</h4>
          <p className="text-xs text-slate-500">This room currently has no open or past folios on record.</p>
        </div>
      ) : (
        <div className="space-y-5">
          
          {/* 1. FOLIO SUMMARY BANNER */}
          <div className="p-4 rounded-2xl bg-[#EAF4F7]/60 border border-[#D7E5E8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                {room.room_number}
              </div>
              <div>
                <span className="text-[10px] text-[#3A7D7C] font-bold uppercase tracking-wider block">
                  {room.floor} • {room.room_type}
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {folio.guest_name}
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                  {folio.guest_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#3A7D7C]" />
                      {folio.guest_phone}
                    </span>
                  )}
                  {folio.check_in_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#3A7D7C]" />
                      In: {new Date(folio.check_in_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 border-[#D7E5E8] pt-2 sm:pt-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Outstanding Balance
              </span>
              <div className={`text-2xl font-black ${balance > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-1 ${
                folio.folio_status === 'OPEN' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                Folio {folio.folio_status}
              </span>
            </div>
          </div>

          {/* 2. ITEMIZED ROOM CHARGES (RESTAURANT / KOT BILLS) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#3A7D7C] uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4" />
                <span>Room Charges & Restaurant Bills ({charges.length})</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Integrated Restaurant Billing
              </span>
            </div>

            {charges.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No charges added to this room folio yet</p>
                <p className="text-[11px] text-slate-400">
                  Restaurant food & drink bills charged to Room {room.room_number} will automatically reflect here.
                </p>
              </div>
            ) : (
              <div className="border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#D7E5E8] text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Bill #</th>
                      <th className="px-3.5 py-2.5">Date & Time</th>
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5">Payment</th>
                      <th className="px-3.5 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E5E8] font-medium text-slate-700">
                    {charges.map((charge, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-2.5 font-bold text-slate-900 font-mono text-[11px]">
                          {charge.bill_number || `BILL-${charge.id}`}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500 text-[11px]">
                          {new Date(charge.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#EAF4F7] text-[#3A7D7C] text-[10px] font-bold">
                            {charge.order_type || 'RESTAURANT'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            charge.payment_status === 'ROOM_CHARGED' 
                              ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                              : 'bg-emerald-100 text-emerald-900'
                          }`}>
                            {charge.payment_status}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">
                          ₹{Number(charge.grand_total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-[#D7E5E8] font-bold text-slate-900 text-xs">
                    <tr>
                      <td colSpan="4" className="px-3.5 py-2.5 text-right">Total Charges Sum:</td>
                      <td className="px-3.5 py-2.5 text-right text-[#3A7D7C] font-black">
                        ₹{charges.reduce((acc, c) => acc + Number(c.grand_total || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Notes if present */}
          {folio.notes && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-700 block">Folio Notes:</span>
                <span>{folio.notes}</span>
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="pt-3 border-t border-[#D7E5E8] flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Close
            </button>

            {folio.folio_status === 'OPEN' && (
              <button
                onClick={() => {
                  onClose();
                  onCheckOut(room);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Proceed to Check-Out</span>
              </button>
            )}
          </div>

        </div>
      )}
    </Modal>
  );
}
