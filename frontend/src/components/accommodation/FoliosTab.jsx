import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Receipt,
  Search,
  Plus,
  CreditCard,
  User,
  BedDouble,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  DollarSign,
  FileText
} from 'lucide-react';
import Modal from '../common/Modal';

export default function FoliosTab({
  onViewFolioClick,
  refreshKey
}) {
  const [folios, setFolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLOSED'

  // Add Charge Modal State
  const [chargeModalFolio, setChargeModalFolio] = useState(null);
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeError, setChargeError] = useState('');

  // Settle Payment Modal State
  const [settleModalFolio, setSettleModalFolio] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState('');

  const fetchFolios = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/rooms/folios/all', { params });
      const data = res?.data || res;
      setFolios(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch folios:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchFolios();
  }, [fetchFolios, refreshKey]);

  const handleAddCharge = async (e) => {
    e.preventDefault();
    if (!chargeDescription.trim() || !chargeAmount || parseFloat(chargeAmount) <= 0) {
      setChargeError('Please enter a valid description and positive amount.');
      return;
    }

    setChargeLoading(true);
    setChargeError('');

    try {
      await api.post(`/rooms/folios/${chargeModalFolio.id}/charge`, {
        description: chargeDescription.trim(),
        amount: parseFloat(chargeAmount)
      });
      setChargeModalFolio(null);
      setChargeDescription('');
      setChargeAmount('');
      fetchFolios();
    } catch (err) {
      setChargeError(err.message || 'Failed to add charge.');
    } finally {
      setChargeLoading(false);
    }
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    if (!settleAmount || parseFloat(settleAmount) <= 0) {
      setSettleError('Please enter a valid positive payment amount.');
      return;
    }

    setSettleLoading(true);
    setSettleError('');

    try {
      await api.post(`/rooms/folios/${settleModalFolio.id}/settle`, {
        amount: parseFloat(settleAmount),
        payment_method: paymentMethod
      });
      setSettleModalFolio(null);
      setSettleAmount('');
      fetchFolios();
    } catch (err) {
      setSettleError(err.message || 'Failed to record payment.');
    } finally {
      setSettleLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-slate-50 border border-[#D7E5E8] rounded-xl px-3 py-2 text-xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by guest name, room #, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-hidden text-slate-800 placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-[#D7E5E8] text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-[#3A7D7C] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Folios
            </button>
            <button
              onClick={() => setStatusFilter('OPEN')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'OPEN'
                  ? 'bg-white text-[#3A7D7C] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Open Folios
            </button>
            <button
              onClick={() => setStatusFilter('CLOSED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'CLOSED'
                  ? 'bg-white text-[#3A7D7C] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Closed Folios
            </button>
          </div>

          <button
            onClick={() => fetchFolios()}
            className="p-2 rounded-xl border border-[#D7E5E8] text-slate-600 hover:bg-slate-50 hover:text-[#3A7D7C] transition-colors"
            title="Refresh Folios"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. FOLIOS TABLE */}
      <div className="bg-white rounded-3xl border border-[#D7E5E8] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-[#3A7D7C] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500 font-semibold">Loading room folios...</p>
          </div>
        ) : folios.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No Folios Found</h4>
            <p className="text-xs text-slate-500">No folio records matched your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D7E5E8] bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Room & Floor</th>
                  <th className="py-3.5 px-4">Connected Guest</th>
                  <th className="py-3.5 px-4">Stay Duration</th>
                  <th className="py-3.5 px-4">Charges</th>
                  <th className="py-3.5 px-4">Folio Status</th>
                  <th className="py-3.5 px-4">Outstanding Balance</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {folios.map((f) => {
                  const isOpen = f.folio_status === 'OPEN';
                  const balance = parseFloat(f.balance || 0);

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Room & Floor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#3A7D7C] text-white flex items-center justify-center font-black text-xs shadow-2xs">
                            {f.room_number}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block">
                              Room {f.room_number}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {f.floor} • {f.room_type}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Connected Guest */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-extrabold text-slate-900 block">
                            {f.guest_name}
                          </span>
                          {f.guest_phone && (
                            <span className="text-[11px] text-slate-500 block">
                              {f.guest_phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stay Duration */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-600">
                        <div>
                          <span className="block font-semibold">
                            In: {new Date(f.check_in_date).toLocaleDateString()}
                          </span>
                          {f.check_out_date && (
                            <span className="block text-slate-400">
                              Out: {new Date(f.check_out_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Charges */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {f.charge_count || 0} bills attached
                        </span>
                      </td>

                      {/* Folio Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isOpen
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isOpen ? 'Open' : 'Closed'}
                        </span>
                      </td>

                      {/* Outstanding Balance */}
                      <td className="py-3.5 px-4">
                        <span className={`font-black text-sm ${balance > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                          ₹{balance.toFixed(2)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOpen && (
                            <>
                              <button
                                onClick={() => {
                                  setChargeModalFolio(f);
                                  setChargeDescription('');
                                  setChargeAmount('');
                                  setChargeError('');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#3A7D7C] hover:text-white text-slate-700 text-[11px] font-bold transition-all shadow-2xs"
                                title="Add Extra Charge"
                              >
                                + Charge
                              </button>

                              {balance > 0 && (
                                <button
                                  onClick={() => {
                                    setSettleModalFolio(f);
                                    setSettleAmount(balance.toFixed(2));
                                    setPaymentMethod('CASH');
                                    setSettleError('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-2xs"
                                  title="Record Payment"
                                >
                                  Settle
                                </button>
                              )}
                            </>
                          )}

                          <button
                            onClick={() => onViewFolioClick({ id: f.room_id, room_number: f.room_number, floor: f.floor, room_type: f.room_type, folio_balance: balance, guest_name: f.guest_name })}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all shadow-2xs"
                            title="View Statement"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. ADD CHARGE MODAL */}
      {chargeModalFolio && (
        <Modal
          isOpen={true}
          onClose={() => setChargeModalFolio(null)}
          title={`Add Extra Charge • Room ${chargeModalFolio.room_number}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleAddCharge} className="space-y-4 text-xs">
            {chargeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {chargeError}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-800 mb-1">Charge Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Laundry Service, Airport Transfer, Extra Bed"
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="500.00"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] font-medium"
              />
            </div>

            <div className="pt-3 border-t border-[#D7E5E8] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setChargeModalFolio(null)}
                className="px-4 py-2 rounded-xl border border-[#D7E5E8] text-slate-700 font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={chargeLoading}
                className="px-4 py-2 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold transition-all shadow-xs"
              >
                {chargeLoading ? 'Adding...' : 'Add to Folio'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. SETTLE PAYMENT MODAL */}
      {settleModalFolio && (
        <Modal
          isOpen={true}
          onClose={() => setSettleModalFolio(null)}
          title={`Settle Payment • Room ${settleModalFolio.room_number}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSettlePayment} className="space-y-4 text-xs">
            {settleError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {settleError}
              </div>
            )}

            <div className="p-3 rounded-2xl bg-slate-50 border border-[#D7E5E8] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Guest:</span>
                <span className="font-extrabold text-slate-900">{settleModalFolio.guest_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Balance:</span>
                <span className="font-black text-rose-600">₹{parseFloat(settleModalFolio.balance || 0).toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Payment Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={settleModalFolio.balance}
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#D7E5E8] rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] font-medium"
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="NET_BANKING">Net Banking / Direct Transfer</option>
              </select>
            </div>

            <div className="pt-3 border-t border-[#D7E5E8] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettleModalFolio(null)}
                className="px-4 py-2 rounded-xl border border-[#D7E5E8] text-slate-700 font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={settleLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs"
              >
                {settleLoading ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
