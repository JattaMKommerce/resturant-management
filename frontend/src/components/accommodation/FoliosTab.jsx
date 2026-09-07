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
  FileText,
  QrCode,
  Smartphone,
  Banknote,
  Building,
  Globe,
  CheckCheck,
  ShieldCheck,
  X,
  Sparkles
} from 'lucide-react';
import Modal from '../common/Modal';

export default function FoliosTab({
  selectedHotelId = 1,
  selectedHotelName = 'The Grand Palace',
  onViewFolioClick,
  refreshKey
}) {
  const [folios, setFolios] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeSubView, setActiveSubView] = useState('FOLIOS'); // 'FOLIOS' | 'PAYMENTS_HISTORY'
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Add Charge Modal State
  const [chargeModalFolio, setChargeModalFolio] = useState(null);
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeError, setChargeError] = useState('');

  // Settle Payment / Demo QR Modal State
  const [settleModalFolio, setSettleModalFolio] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // 'UPI' | 'CARD' | 'CASH' | 'NET_BANKING' | 'INTERNATIONAL'
  const [upiProvider, setUpiProvider] = useState('GOOGLE_PAY'); // 'PHONEPE' | 'GOOGLE_PAY' | 'PAYTM' | 'OTHER_UPI'
  const [cardType, setCardType] = useState('VISA_DEBIT');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const fetchFolios = useCallback(async () => {
    setLoading(true);
    try {
      const params = { hotel_id: selectedHotelId };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/rooms/folios/all', { params });
      const data = res?.data || res;
      setFolios(Array.isArray(data) ? data : []);

      // Fetch payment transactions
      const payRes = await api.get(`/rooms/payments?hotel_id=${selectedHotelId}`);
      if (payRes.data?.success) {
        setPayments(payRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch folios:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, selectedHotelId]);

  useEffect(() => {
    fetchFolios();
  }, [fetchFolios, refreshKey, selectedHotelId]);

  // Aggregate metrics
  const totalOutstanding = folios
    .filter(f => f.folio_status === 'OPEN')
    .reduce((sum, f) => sum + parseFloat(f.balance || 0), 0);

  const openFoliosCount = folios.filter(f => f.folio_status === 'OPEN').length;
  const closedFoliosCount = folios.filter(f => f.folio_status === 'CLOSED').length;

  const handleOpenSettle = (folio) => {
    setSettleModalFolio(folio);
    setSettleAmount(parseFloat(folio.balance || 0).toString());
    setPaymentMethod('UPI');
    setUpiProvider('GOOGLE_PAY');
    setSettleError('');
    setPaymentSuccess(false);
  };

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

  const handleExecutePayment = async (e) => {
    if (e) e.preventDefault();
    if (!settleAmount || parseFloat(settleAmount) <= 0) {
      setSettleError('Please enter a valid positive payment amount.');
      return;
    }

    setSettleLoading(true);
    setSettleError('');

    try {
      const amountNum = parseFloat(settleAmount);

      // Record in accommodation_payments
      await api.post('/rooms/payments/record', {
        hotel_id: selectedHotelId,
        folio_id: settleModalFolio.id,
        room_id: settleModalFolio.room_id,
        guest_name: settleModalFolio.guest_name,
        amount: amountNum,
        payment_method: paymentMethod,
        payment_provider: paymentMethod === 'UPI' ? upiProvider : paymentMethod === 'CARD' ? cardType : bankName,
        payment_status: 'PAID',
        notes: `Settled via ${paymentMethod} (${paymentMethod === 'UPI' ? upiProvider : ''})`
      });

      // Settle on folio
      await api.post(`/rooms/folios/${settleModalFolio.id}/settle`, {
        amount: amountNum,
        payment_method: paymentMethod
      });

      setPaymentSuccess(true);
      setTimeout(() => {
        setSettleModalFolio(null);
        setPaymentSuccess(false);
        fetchFolios();
      }, 1500);
    } catch (err) {
      setSettleError(err.message || 'Failed to process payment.');
    } finally {
      setSettleLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ═══════════════════════════════════════════════════════ */}
      {/* 1. FINANCIAL KPI SUMMARY STRIP                         */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Outstanding Pending Balance</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 tracking-tight">
            ₹{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Across {openFoliosCount} active guest folios
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Active Open Folios</span>
            <div className="p-2 rounded-xl bg-teal-50 text-[#006C70]">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {openFoliosCount} In-House
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Stays accumulating room & ancillary billing
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Settled Historical Accounts</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            {closedFoliosCount} Closed
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Fully reconciled check-out accounts
          </p>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 2. CONTROLS & SUB-VIEWS (FOLIOS VS PAYMENT AUDIT)       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Sub-view switcher */}
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => setActiveSubView('FOLIOS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubView === 'FOLIOS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Guest Stay Accounts (Folios)
            </button>
            <button
              onClick={() => setActiveSubView('PAYMENTS_HISTORY')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubView === 'PAYMENTS_HISTORY'
                  ? 'bg-[#006C70] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Payment Audit Log
            </button>
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Room, Guest, Folio #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
            <button
              onClick={fetchFolios}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 shadow-2xs"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter chips if in Folios view */}
        {activeSubView === 'FOLIOS' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Filter Status:
            </span>
            {['ALL', 'OPEN', 'CLOSED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-[#006C70] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All Folios' : st === 'OPEN' ? '🟢 Open Balances' : '⚪ Closed / Settled'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 3. FOLIOS TABLE VIEW                                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeSubView === 'FOLIOS' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Folio #</th>
                  <th className="py-3.5 px-4">Room & Unit</th>
                  <th className="py-3.5 px-4">Guest Contact</th>
                  <th className="py-3.5 px-4">Check-In Date</th>
                  <th className="py-3.5 px-4">Outstanding Balance</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4 text-right">Settlement Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {folios.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-medium">
                      No folio records found for this property.
                    </td>
                  </tr>
                ) : (
                  folios.map((f) => {
                    const hasBalance = parseFloat(f.balance || 0) > 0;
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                        
                        {/* Folio ID */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          #{f.id}
                        </td>

                        {/* Room */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            Room {f.room_number || 'N/A'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {f.room_type}
                          </div>
                        </td>

                        {/* Guest */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{f.guest_name}</div>
                          <div className="text-[11px] text-slate-500">{f.guest_phone || 'No phone'}</div>
                        </td>

                        {/* Check-In */}
                        <td className="py-3.5 px-4 text-[11px] text-slate-600">
                          {new Date(f.check_in_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>

                        {/* Balance */}
                        <td className="py-3.5 px-4">
                          <div className={`font-black text-sm ${hasBalance ? 'text-purple-700' : 'text-emerald-700'}`}>
                            ₹{parseFloat(f.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          {f.breakfast_included ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                              🍳 Breakfast Included
                            </span>
                          ) : null}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            f.folio_status === 'OPEN'
                              ? 'bg-teal-50 text-[#006C70] border border-teal-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {f.folio_status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setChargeModalFolio(f)}
                              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                            >
                              + Charge
                            </button>
                            
                            {hasBalance ? (
                              <button
                                onClick={() => handleOpenSettle(f)}
                                className="px-3 py-1 rounded-xl bg-[#006C70] hover:bg-[#00585C] text-white font-bold text-[11px] transition-all shadow-xs flex items-center gap-1"
                              >
                                <QrCode className="w-3 h-3" />
                                <span>Settle (Demo QR)</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onViewFolioClick && onViewFolioClick(f.room_id)}
                                className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-[11px]"
                              >
                                View Bill
                              </button>
                            )}
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
      ) : (
        /* ═══════════════════════════════════════════════════════ */
        /* 4. PAYMENT AUDIT LOG VIEW                              */
        /* ═══════════════════════════════════════════════════════ */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Txn Ref</th>
                  <th className="py-3.5 px-4">Guest & Room</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Provider</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 font-medium">
                      No recorded payments found yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {p.transaction_ref || `TXN-${p.id}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.guest_name}</div>
                        <div className="text-[11px] text-slate-500">Room {p.room_number || 'N/A'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800">{p.payment_method}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {p.payment_provider}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-700 text-sm">
                        ₹{parseFloat(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500">
                        {new Date(p.paid_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-black text-[10px] uppercase tracking-wider border border-emerald-200">
                          {p.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODAL: INTERACTIVE DEMO UPI QR & PAYMENT SETTLEMENT    */}
      {/* ═══════════════════════════════════════════════════════ */}
      {settleModalFolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Guest Folio #{settleModalFolio.id} Settlement
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {settleModalFolio.guest_name} (Room {settleModalFolio.room_number})
                </h3>
              </div>
              <button
                onClick={() => setSettleModalFolio(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentSuccess ? (
              <div className="p-10 text-center space-y-3 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCheck className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-slate-900">Payment Recorded Successfully!</h4>
                <p className="text-xs text-slate-500 font-medium">
                  Folio balance updated and payment transaction logged.
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-5 text-xs font-sans">
                {settleError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-center">
                    {settleError}
                  </div>
                )}

                {/* Amount Input */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Amount to Settle (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-slate-900 focus:ring-2 focus:ring-[#006C70]/20 focus:border-[#006C70]"
                  />
                </div>

                {/* PAYMENT METHOD TABS */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-2xl text-[11px] font-bold text-center">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('UPI')}
                      className={`py-2 px-1 rounded-xl transition-all ${
                        paymentMethod === 'UPI' ? 'bg-[#006C70] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={`py-2 px-1 rounded-xl transition-all ${
                        paymentMethod === 'CARD' ? 'bg-[#006C70] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`py-2 px-1 rounded-xl transition-all ${
                        paymentMethod === 'CASH' ? 'bg-[#006C70] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('NET_BANKING')}
                      className={`py-2 px-1 rounded-xl transition-all ${
                        paymentMethod === 'NET_BANKING' ? 'bg-[#006C70] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Net Banking
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('INTERNATIONAL')}
                      className={`py-2 px-1 rounded-xl transition-all ${
                        paymentMethod === 'INTERNATIONAL' ? 'bg-[#006C70] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      International
                    </button>
                  </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* 1. UPI PROVIDER & DEMO QR FLOW              */}
                {/* ═══════════════════════════════════════════ */}
                {paymentMethod === 'UPI' && (
                  <div className="p-4 rounded-2xl bg-teal-50/40 border border-teal-200/70 space-y-4 animate-in fade-in duration-200">
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                        Choose UPI App Provider:
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'GOOGLE_PAY', name: 'Google Pay', icon: '🟢' },
                          { id: 'PHONEPE', name: 'PhonePe', icon: '🟣' },
                          { id: 'PAYTM', name: 'Paytm', icon: '🔵' },
                          { id: 'OTHER_UPI', name: 'Other UPI', icon: '📱' }
                        ].map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => setUpiProvider(provider.id)}
                            className={`p-2 rounded-xl border text-center transition-all ${
                              upiProvider === provider.id
                                ? 'bg-white border-[#006C70] ring-2 ring-[#006C70]/20 font-black text-slate-900 shadow-xs'
                                : 'bg-white/60 border-slate-200 text-slate-600 font-bold hover:bg-white'
                            }`}
                          >
                            <span className="block text-sm mb-0.5">{provider.icon}</span>
                            <span className="text-[10px] block truncate">{provider.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* DEMO QR CODE BOX */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center space-y-2 shadow-2xs">
                      <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Scan to Pay
                      </div>
                      
                      {/* SVG Realistic Demo QR Pattern */}
                      <div className="w-36 h-36 mx-auto bg-slate-900 p-2.5 rounded-2xl flex items-center justify-center shadow-inner">
                        <div className="w-full h-full bg-white p-1.5 rounded-xl flex flex-col justify-between">
                          <div className="flex justify-between">
                            <div className="w-7 h-7 bg-slate-900 rounded-sm p-1">
                              <div className="w-full h-full bg-white p-0.5">
                                <div className="w-full h-full bg-slate-900" />
                              </div>
                            </div>
                            <div className="w-7 h-7 bg-slate-900 rounded-sm p-1">
                              <div className="w-full h-full bg-white p-0.5">
                                <div className="w-full h-full bg-slate-900" />
                              </div>
                            </div>
                          </div>
                          
                          {/* Center Brand Icon */}
                          <div className="w-6 h-6 rounded-md bg-[#006C70] text-white text-[9px] font-black mx-auto flex items-center justify-center">
                            GP
                          </div>

                          <div className="flex justify-between">
                            <div className="w-7 h-7 bg-slate-900 rounded-sm p-1">
                              <div className="w-full h-full bg-white p-0.5">
                                <div className="w-full h-full bg-slate-900" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-0.5 w-6 h-6">
                              <div className="bg-slate-900" />
                              <div className="bg-slate-900" />
                              <div className="bg-slate-900" />
                              <div className="bg-slate-400" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-0.5 pt-1">
                        <div className="text-xs font-bold text-slate-900">
                          Amount: <span className="font-black text-[#006C70]">₹{parseFloat(settleAmount || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Method: UPI • Provider: <span className="font-bold text-slate-800">{upiProvider}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 text-center font-medium">
                      ⚠️ Demo Payment Flow — Clicking button below will record payment and reconcile folio balance.
                    </div>
                  </div>
                )}

                {/* 2. CARD PAYMENT */}
                {paymentMethod === 'CARD' && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Card Terminal Type</label>
                      <select
                        value={cardType}
                        onChange={(e) => setCardType(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold"
                      >
                        <option value="VISA_DEBIT">Visa Debit Card (POS Swiped)</option>
                        <option value="MASTERCARD_CREDIT">Mastercard Credit Card</option>
                        <option value="RUPAY_CARD">RuPay Platinum / Contactless</option>
                        <option value="AMEX_CARD">American Express</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Swipe or tap card on POS terminal #POS-01 and verify authorization slip.
                    </p>
                  </div>
                )}

                {/* 3. CASH PAYMENT */}
                {paymentMethod === 'CASH' && (
                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold">
                      <Banknote className="w-4 h-4 text-amber-700" />
                      <span>Front Desk Cash Drawer Collection</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Collect physical currency notes of <span className="font-bold text-slate-900">₹{parseFloat(settleAmount || 0).toLocaleString()}</span> and place in safe drawer.
                    </p>
                  </div>
                )}

                {/* 4. NET BANKING */}
                {paymentMethod === 'NET_BANKING' && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <label className="block font-bold text-slate-700 mb-1">Select Bank</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="HDFC Bank">HDFC Bank Corporate NetBanking</option>
                      <option value="ICICI Bank">ICICI Bank Instant Pay</option>
                      <option value="State Bank of India">State Bank of India (SBI)</option>
                      <option value="Axis Bank">Axis Bank NetBanking</option>
                    </select>
                  </div>
                )}

                {/* 5. INTERNATIONAL */}
                {paymentMethod === 'INTERNATIONAL' && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <span>International Card / Gateway Demo</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Processes international credit cards (USD / EUR / GBP / AUD) with DCC currency conversion.
                    </p>
                  </div>
                )}

                {/* ACTION BUTTON */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSettleModalFolio(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePayment}
                    disabled={settleLoading}
                    className="px-6 py-2.5 rounded-xl bg-[#006C70] hover:bg-[#00585C] text-white font-bold text-xs transition-all shadow-md shadow-[#006C70]/20 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>{settleLoading ? 'Processing...' : 'Mark as Paid - Demo'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODAL: ADD CUSTOM CHARGE                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      {chargeModalFolio && (
        <Modal
          isOpen={true}
          onClose={() => setChargeModalFolio(null)}
          title={`Add Custom Charge to Folio #${chargeModalFolio.id}`}
        >
          <form onSubmit={handleAddCharge} className="space-y-4 text-xs">
            {chargeError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 font-bold">
                {chargeError}
              </div>
            )}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Charge Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Airport Transfer, Spa Treatment, Extra Bed..."
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="500.00"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setChargeModalFolio(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={chargeLoading}
                className="px-5 py-2 rounded-xl bg-[#006C70] text-white font-bold"
              >
                {chargeLoading ? 'Adding...' : 'Add Charge to Folio'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
