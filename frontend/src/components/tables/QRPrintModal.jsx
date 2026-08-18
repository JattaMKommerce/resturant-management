import React, { useEffect, useState, useRef } from 'react';
import Modal from '../common/Modal';
import QRCode from 'qrcode';
import { Download, Printer, ExternalLink, QrCode } from 'lucide-react';

export default function QRPrintModal({ isOpen, onClose, table }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const qrCanvasRef = useRef(null);

  const fullUrl = table ? `${window.location.origin}/order/table/${table.qr_token}` : '';

  useEffect(() => {
    if (table && table.qr_token) {
      QRCode.toDataURL(fullUrl, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
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
    a.download = `QR_Code_${table.table_number}.png`;
    a.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`QR Code - Table ${table.table_number}`} maxWidth="max-w-md">
      <div className="flex flex-col items-center text-center">
        {/* Printable Area */}
        <div className="printable-area receipt-container p-6 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 w-full max-w-xs mb-6">
          <div className="text-center pb-3 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 tracking-wide">GRAND PALACE HMS</h2>
            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Restaurant QR Menu</p>
          </div>

          <div className="my-4 flex justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR Code ${table.table_number}`} className="w-56 h-56 rounded-xl border border-slate-200" />
            ) : (
              <div className="w-56 h-56 bg-slate-100 flex items-center justify-center rounded-xl">
                <QrCode className="w-12 h-12 text-slate-400 animate-pulse" />
              </div>
            )}
          </div>

          <div className="text-center pt-2">
            <h3 className="text-2xl font-black text-slate-900">TABLE {table.table_number}</h3>
            <p className="text-xs text-slate-500">{table.floor} • {table.section}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">Scan QR code to view live digital menu & order food</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full flex items-center gap-3 no-print">
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!qrDataUrl}
            className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print QR Card</span>
          </button>
        </div>

        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-xs text-amber-400 hover:underline flex items-center gap-1 no-print font-mono"
        >
          <span>{fullUrl}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </Modal>
  );
}
