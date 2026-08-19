import React, { useEffect, useState, useRef } from 'react';
import Modal from '../common/Modal';
import QRCode from 'qrcode';
import { Download, Printer, ExternalLink, QrCode } from 'lucide-react';

export default function QRPrintModal({ isOpen, onClose, table }) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Single permanent origin: use network IP on dev so mobile works immediately, or live domain in prod
  const networkIp = '192.168.1.3';
  const effectiveOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${networkIp}:5173`
    : window.location.origin;

  const fullUrl = table ? `${effectiveOrigin}/order/table/${table.qr_token}` : '';

  useEffect(() => {
    if (table && table.qr_token) {
      QRCode.toDataURL(fullUrl, {
        width: 350,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code:', err));
    }
  }, [table, fullUrl]);

  if (!table) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `GrandPalace_Table_${table.table_number}_QR.png`;
    a.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Official Table QR Card - Table ${table.table_number}`} maxWidth="max-w-md">
      <div className="flex flex-col items-center text-center">
        {/* Printable Physical Table Stand / Card */}
        <div className="printable-area receipt-container p-6 bg-white text-slate-900 rounded-3xl shadow-2xl border-2 border-slate-200 w-full max-w-xs mb-6">
          <div className="text-center pb-3 border-b border-slate-200">
            <h2 className="text-lg font-black text-slate-900 tracking-wide">GRAND PALACE HMS</h2>
            <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wider">Digital Table Menu</p>
          </div>

          <div className="my-4 flex justify-center p-2 bg-slate-50 rounded-2xl border border-slate-100">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`Table ${table.table_number} QR Code`} className="w-56 h-56 rounded-xl" />
            ) : (
              <div className="w-56 h-56 bg-slate-100 flex items-center justify-center rounded-xl">
                <QrCode className="w-12 h-12 text-slate-400 animate-pulse" />
              </div>
            )}
          </div>

          <div className="text-center pt-1">
            <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider block">Scan to Order</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">TABLE {table.table_number}</h3>
            <p className="text-xs text-slate-500 font-medium">{table.floor} • {table.section}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">Scan with your phone camera to view live menu, order food & call waiter</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full flex items-center gap-3 no-print">
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="flex-1 py-3 px-3 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!qrDataUrl}
            className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black hover:from-amber-400 hover:to-orange-400 text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print QR Stand</span>
          </button>
        </div>

        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-[11px] text-amber-400 hover:underline flex items-center gap-1 no-print font-mono"
        >
          <span>{fullUrl}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </Modal>
  );
}
