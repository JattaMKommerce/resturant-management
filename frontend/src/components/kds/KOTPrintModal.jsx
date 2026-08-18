import React from 'react';
import Modal from '../common/Modal';
import { Printer } from 'lucide-react';

export default function KOTPrintModal({ isOpen, onClose, kot }) {
  if (!kot) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Print Kitchen Ticket #${kot.kot_number}`} maxWidth="max-w-md">
      <div className="flex flex-col items-center">
        {/* Printable Thermal Receipt Container */}
        <div className="printable-area receipt-container bg-white text-black font-mono p-6 rounded border border-slate-300 w-full max-w-xs text-xs shadow-lg mb-6">
          <div className="text-center font-bold text-sm border-b-2 border-black pb-2 mb-3 uppercase">
            GRAND PALACE HOTEL & RESTAURANT
          </div>

          <div className="space-y-1 mb-3">
            <div className="font-black text-sm">KOT #: {kot.kot_number}</div>
            <div>TABLE: {kot.table_number || 'N/A'} {kot.room_number ? `(ROOM ${kot.room_number})` : ''}</div>
            <div>ORDER #: {kot.order_id}</div>
            <div>KITCHEN: {(kot.kitchen_department_name || 'MAIN KITCHEN').toUpperCase()}</div>
            <div>ORDER TYPE: {kot.order_type}</div>
            <div>TIME: {new Date(kot.kitchen_received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>

          <div className="border-t border-b border-black py-2 my-2 font-bold flex justify-between">
            <span>ITEM</span>
            <span>QTY</span>
          </div>

          <div className="space-y-2 mb-4">
            {kot.items && kot.items.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-bold text-sm">
                  <span>{item.item_name}</span>
                  <span>{item.quantity}</span>
                </div>
                {item.modifiers && item.modifiers.map((m, mIdx) => (
                  <div key={mIdx} className="text-[10px] pl-2 text-slate-700">+ {m.option_name}</div>
                ))}
                {item.special_instructions && (
                  <div className="text-[10px] pl-2 font-semibold uppercase text-red-600">** {item.special_instructions}</div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-black pt-2 text-[10px] text-center uppercase font-bold">
            *** KITCHEN COPY ***
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-colors no-print"
        >
          <Printer className="w-5 h-5" />
          <span>Print KOT Ticket</span>
        </button>
      </div>
    </Modal>
  );
}
