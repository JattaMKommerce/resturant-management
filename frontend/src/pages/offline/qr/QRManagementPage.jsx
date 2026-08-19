import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import QRPrintModal from '../../../components/tables/QRPrintModal';
import Badge from '../../../components/common/Badge';
import { QrCode, RefreshCw, Printer, ExternalLink, ShieldCheck, ShieldAlert, History } from 'lucide-react';

export default function QRManagementPage() {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tables');
      if (res.success) {
        setTables(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch tables for QR management:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleToggleQR = async (tableId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/tables/${tableId}/qr/status`, { status: newStatus });
      fetchTables();
    } catch (err) {
      alert(err.message || 'Failed to update QR status');
    }
  };

  const handleRegenerate = async (table) => {
    if (window.confirm(`Regenerate QR token for Table ${table.table_number}? The current QR code will instantly become invalid for customer ordering.`)) {
      try {
        await api.post(`/tables/${table.id}/qr/regenerate`);
        fetchTables();
      } catch (err) {
        alert(err.message || 'Failed to regenerate QR code');
      }
    }
  };

  return (
    <div className="space-y-6 antialiased font-sans">
      {/* Header */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <QrCode className="w-6 h-6 text-[#3A7D7C]" />
            <span>QR Code Security & Management</span>
          </h2>
          <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">Monitor table QR codes, security tokens, status toggling, and printable cards</p>
        </div>

        <button
          onClick={fetchTables}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] transition-colors shadow-2xs self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* QR List Table */}
      <div className="bg-white border border-[#D7E5E8] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#1F2937]">
            <thead className="bg-slate-50 text-xs font-bold text-[#64748B] uppercase tracking-wider border-b border-[#D7E5E8]">
              <tr>
                <th className="px-6 py-4">Table</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Secure Token</th>
                <th className="px-6 py-4">QR Status</th>
                <th className="px-6 py-4">Table Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D7E5E8]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#64748B]">Loading QR code security system...</td>
                </tr>
              ) : tables.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#64748B]">No tables configured in system.</td>
                </tr>
              ) : (
                tables.map((table) => {
                  const orderUrl = `/order/table/${table.qr_token}`;
                  return (
                    <tr key={table.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-[#1F2937]">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#3A7D7C]"></span>
                          <span>{table.table_number} ({table.table_name})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#64748B] text-xs">{table.floor} • {table.section}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-[#3A7D7C] bg-[#EAF4F7] px-2.5 py-1 rounded-lg border border-[#D7E5E8]">
                          {table.qr_token.substring(0, 16)}...
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={table.qr_status} />
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={table.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isAdminOrManager && (
                            <>
                              <button
                                onClick={() => handleToggleQR(table.id, table.qr_status)}
                                className={`p-2 rounded-lg text-xs font-bold border transition-colors ${
                                  table.qr_status === 'ACTIVE'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                }`}
                                title={table.qr_status === 'ACTIVE' ? 'Disable QR Ordering' : 'Enable QR Ordering'}
                              >
                                {table.qr_status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </button>

                              <button
                                onClick={() => handleRegenerate(table)}
                                className="p-2 rounded-lg bg-slate-100 text-[#1F2937] hover:bg-slate-200 border border-[#D7E5E8] transition-colors"
                                title="Regenerate Security Token"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => {
                              setSelectedTable(table);
                              setIsPrintModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold transition-colors shadow-2xs"
                            title="Print / View QR"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <a
                            href={orderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-slate-100 text-[#1F2937] hover:bg-slate-200 border border-[#D7E5E8] transition-colors"
                            title="Preview Customer QR Ordering Page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <QRPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        table={selectedTable}
      />
    </div>
  );
}
