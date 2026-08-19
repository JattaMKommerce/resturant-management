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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <QrCode className="w-7 h-7 text-amber-500" />
            <span>QR Code Security & Management</span>
          </h2>
          <p className="text-slate-400 text-sm">Monitor table QR codes, security tokens, status toggling, and printable cards</p>
        </div>

        <button
          onClick={fetchTables}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* QR List Table */}
      <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[750px] text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Table</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Secure Token</th>
                <th className="px-6 py-4">QR Status</th>
                <th className="px-6 py-4">Table Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Loading QR code security system...</td>
                </tr>
              ) : tables.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No tables configured in system.</td>
                </tr>
              ) : (
                tables.map((table) => {
                  const orderUrl = `/order/table/${table.qr_token}`;
                  return (
                    <tr key={table.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                          <span>{table.table_number} ({table.table_name})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{table.floor} • {table.section}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-amber-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
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
                                className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                                  table.qr_status === 'ACTIVE'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                }`}
                                title={table.qr_status === 'ACTIVE' ? 'Disable QR Ordering' : 'Enable QR Ordering'}
                              >
                                {table.qr_status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </button>

                              <button
                                onClick={() => handleRegenerate(table)}
                                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                                title="Regenerate Security Token"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => {
                              setSelectedTable(table);
                              setIsPrintModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors"
                            title="Print / View QR"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <a
                            href={orderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Preview Customer QR Ordering Page"
                          >
                            <ExternalLink className="w-4 h-4" />
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
