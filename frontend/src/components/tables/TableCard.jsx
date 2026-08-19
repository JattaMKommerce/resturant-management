import React from 'react';
import Badge from '../common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Users, QrCode, Edit, Trash2, RotateCw } from 'lucide-react';

export default function TableCard({ table, onEdit, onDelete, onStatusChange, onQRAction, onRegenerateQR }) {
  const { user } = useAuth();
  const isAdminOrManager = ['ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  return (
    <div className="bg-white border border-blue-100 rounded-2xl p-5 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between shadow-sm group">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block mb-1">
              {table.floor} • {table.section}
            </span>
            <h3 className="text-xl font-black text-slate-900 group-hover:text-amber-600 transition-colors">
              {table.table_number} - {table.table_name}
            </h3>
          </div>
          <Badge status={table.status} />
        </div>

        {/* Info Grid */}
        <div className="flex items-center gap-4 text-xs text-slate-600 my-4 py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-500" />
            <span>Capacity: <strong className="text-slate-900">{table.capacity} Guests</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Type: <strong className="text-slate-900">{table.table_type}</strong></span>
          </div>
        </div>

        {/* QR Token Preview Badge */}
        <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <QrCode className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-slate-600 truncate font-mono text-[10px] font-semibold">
              {table.qr_token ? table.qr_token.substring(0, 16) : 'N/A'}...
            </span>
          </div>
          <Badge status={table.qr_status} text={table.qr_status} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-nowrap">
        {/* Quick Icon Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onQRAction(table)}
            title="View & Print QR Code"
            className="p-1.5 sm:p-2 rounded-lg bg-slate-100 text-amber-700 hover:bg-amber-500 hover:text-slate-950 transition-colors"
          >
            <QrCode className="w-4 h-4" />
          </button>

          {isAdminOrManager && (
            <>
              <button
                onClick={() => onRegenerateQR(table)}
                title="Regenerate QR Code Token"
                className="p-1.5 sm:p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => onEdit(table)}
                title="Edit Table"
                className="p-1.5 sm:p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(table)}
                title="Delete Table"
                className="p-1.5 sm:p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="min-w-0 shrink">
          <select
            value={table.status}
            onChange={(e) => onStatusChange(table.id, e.target.value)}
            className="w-full max-w-[125px] bg-slate-50 border border-slate-300 text-slate-900 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500 font-bold cursor-pointer truncate"
          >
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="OCCUPIED">OCCUPIED</option>
            <option value="ORDERING">ORDERING</option>
            <option value="RESERVED">RESERVED</option>
            <option value="BILL_REQUESTED">BILL REQ</option>
            <option value="BILL_PAID">BILL PAID</option>
            <option value="CLEANING">CLEANING</option>
            <option value="OUT_OF_SERVICE">OUT OF SERVICE</option>
          </select>
        </div>
      </div>
    </div>
  );
}


