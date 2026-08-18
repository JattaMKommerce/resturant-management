import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import { Receipt, CreditCard, Printer, Search, RefreshCw, CheckCircle2, DollarSign, Building, Globe } from 'lucide-react';
import { useSocket } from '../../../context/SocketContext';

export default function BillingPage() {
  const { socket, joinRoom, leaveRoom } = useSocket();

  const [bills, setBills] = useState([]);
  const [unbilledOrders, setUnbilledOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('ALL'); // 'ALL', 'OFFLINE', 'ONLINE'
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedBill, setSelectedBill] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [billsRes, ordersRes] = await Promise.all([
        api.get('/billing'),
        api.get('/orders?status=SERVED')
      ]);

      if (billsRes.success) setBills(billsRes.data);
      if (ordersRes.success) setUnbilledOrders(ordersRes.data);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
    joinRoom('admin');
    joinRoom('cashier');

    if (socket) {
      socket.on('bill_requested', () => fetchBillingData());
      socket.on('table_status_changed', () => fetchBillingData());
      socket.on('order_served', () => fetchBillingData());
    }

    return () => {
      leaveRoom('admin');
      leaveRoom('cashier');
      if (socket) {
        socket.off('bill_requested');
        socket.off('table_status_changed');
        socket.off('order_served');
      }
    };
  }, [socket]);

  const handleGenerateBill = async (orderId) => {
    try {
      const res = await api.post('/billing', { order_id: orderId });
      if (res.success) {
        fetchBillingData();
        // Automatically open payment modal for generated bill
        const billRes = await api.get(`/billing/${res.data.id}`);
        if (billRes.success) {
          setSelectedBill(billRes.data);
          setIsPaymentModalOpen(true);
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to generate bill');
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedBill) return;
    setSubmittingPayment(true);
    try {
      const payload = {
        payment_method: paymentMethod,
        transaction_ref: transactionRef
      };

      const res = await api.post(`/billing/${selectedBill.id}/payment`, payload);
      if (res.success) {
        setIsPaymentModalOpen(false);
        setSelectedBill(null);
        fetchBillingData();
      }
    } catch (err) {
      alert(err.message || 'Failed to process payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleOpenInvoice = async (billId) => {
    try {
      const res = await api.get(`/billing/${billId}`);
      if (res.success) {
        setSelectedBill(res.data);
        setIsInvoiceModalOpen(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to fetch bill details');
    }
  };

  const filteredBills = bills.filter(bill => {
    if (channelFilter === 'OFFLINE' && bill.channel === 'ONLINE') return false;
    if (channelFilter === 'ONLINE' && bill.channel !== 'ONLINE') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBill = String(bill.bill_number || '').toLowerCase().includes(q);
      const matchOrder = String(bill.order_number || '').toLowerCase().includes(q);
      const matchCustomer = String(bill.customer_name || '').toLowerCase().includes(q);
      const matchTable = String(bill.table_number || '').toLowerCase().includes(q);
      if (!matchBill && !matchOrder && !matchCustomer && !matchTable) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Receipt className="w-7 h-7 text-amber-500" />
            <span>Billing, Invoices & Room Charges</span>
          </h2>
          <p className="text-slate-400 text-sm">Restaurant tax invoices, online order billing receipts, payment collection, and Room Folio postings</p>
        </div>

        <button
          onClick={fetchBillingData}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setChannelFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'ALL' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Invoices ({bills.length})
          </button>
          <button
            onClick={() => setChannelFilter('OFFLINE')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'OFFLINE' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🍽️ Offline Restaurant ({bills.filter(b => b.channel !== 'ONLINE').length})
          </button>
          <button
            onClick={() => setChannelFilter('ONLINE')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              channelFilter === 'ONLINE' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🌐 Online Delivery ({bills.filter(b => b.channel === 'ONLINE').length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bill #, order #, customer..."
            className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Orders Ready for Billing (Top Section) */}
      {unbilledOrders.length > 0 && (
        <div className="glass-panel bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>Served Orders Pending Bill Generation ({unbilledOrders.length})</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unbilledOrders.map((ord) => (
              <div key={ord.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Order #{ord.order_number}</h4>
                  <p className="text-xs text-slate-400">{ord.table_number ? `Table ${ord.table_number}` : 'Room Service'}</p>
                  <div className="text-xs font-black text-amber-400 mt-1">₹{parseFloat(ord.total_amount).toFixed(2)}</div>
                </div>

                <button
                  onClick={() => handleGenerateBill(ord.id)}
                  className="py-2 px-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
                >
                  Generate Bill
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bills Ledger Table */}
      <div className="glass-panel bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Bill / Invoice #</th>
                <th className="px-6 py-4">Order #</th>
                <th className="px-6 py-4">Channel / Destination</th>
                <th className="px-6 py-4">Subtotal</th>
                <th className="px-6 py-4">Tax (5%)</th>
                <th className="px-6 py-4">Grand Total</th>
                <th className="px-6 py-4">Payment Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-500">Loading bills ledger...</td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-500">No bills or invoices found.</td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const isOnline = bill.channel === 'ONLINE';
                  const rawOrderNum = String(bill.order_number || '');
                  const cleanDigits = rawOrderNum.replace(/\D/g, '');
                  const last5 = cleanDigits.length >= 5 ? cleanDigits.slice(-5) : rawOrderNum.slice(-5) || '-----';

                  return (
                    <tr key={bill.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-white font-mono flex items-center gap-2">
                        {isOnline ? (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px]">
                            ONLINE
                          </span>
                        ) : null}
                        <span>{bill.bill_number}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-xs">
                        <div className="font-bold text-slate-100">#{bill.order_number}</div>
                        {isOnline && <span className="text-[10px] text-amber-400 font-mono">Token: #{last5}</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-medium">
                        {isOnline ? (
                          <div>
                            <span className="text-cyan-400 font-bold">🌐 Online Delivery</span>
                            {bill.customer_name && <div className="text-xs text-slate-400">👤 {bill.customer_name}</div>}
                          </div>
                        ) : bill.table_number ? (
                          <span className="text-amber-400 font-bold">🍽️ Table {bill.table_number}</span>
                        ) : bill.room_number ? (
                          <span className="text-sky-400 font-bold">🏨 Room {bill.room_number}</span>
                        ) : (
                          'Takeaway'
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono">₹{parseFloat(bill.subtotal || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 font-mono">₹{parseFloat(bill.tax_amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 font-black text-amber-400 font-mono">₹{parseFloat(bill.grand_total || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <Badge status={bill.payment_status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenInvoice(bill.id)}
                            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs font-bold"
                            title="View & Print Tax Invoice"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Invoice</span>
                          </button>

                          {bill.payment_status === 'UNPAID' && (
                            <button
                              onClick={async () => {
                                const res = await api.get(`/billing/${bill.id}`);
                                if (res.success) {
                                  setSelectedBill(res.data);
                                  setIsPaymentModalOpen(true);
                                }
                              }}
                              className="py-1.5 px-3 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-1"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Collect Payment</span>
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

      {/* Collect Payment Modal */}
      {selectedBill && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`Collect Payment - Bill #${selectedBill.bill_number}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 uppercase font-semibold">Total Amount Due</span>
              <h3 className="text-3xl font-black text-amber-400 mt-1">₹{parseFloat(selectedBill.grand_total).toFixed(2)}</h3>
              <p className="text-xs text-slate-500 mt-1">{selectedBill.table_number ? `Table ${selectedBill.table_number}` : `Room ${selectedBill.room_number || 'N/A'}`}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {['CASH', 'CARD', 'UPI', 'ROOM_CHARGE'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-colors ${
                      paymentMethod === method
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'ROOM_CHARGE' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                Charge will be posted to Open Room Folio for {selectedBill.room_number ? `Room ${selectedBill.room_number}` : 'associated room'}.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Transaction Ref / Note (Optional)</label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g. UPI Ref #987213, Card Slip #123"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={submittingPayment}
                className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {submittingPayment ? 'Processing...' : 'Complete Payment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Printable Tax Invoice Modal */}
      {selectedBill && (
        <Modal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          title={`Tax Invoice - #${selectedBill.bill_number}`}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col items-center">
            <div className="printable-area receipt-container invoice-print bg-white text-black font-mono p-5 rounded border border-slate-300 w-full max-w-xs text-xs shadow-lg mb-6">
              <div className="text-center font-bold text-sm border-b-2 border-black pb-2 mb-3">
                GRAND PALACE HOTEL & RESTAURANT
                <div className="text-[10px] font-normal text-slate-600">GSTIN: 27AAAAA0000A1Z5</div>
              </div>

              <div className="space-y-1 mb-3">
                <div className="font-bold">INVOICE #: {selectedBill.bill_number}</div>
                <div>ORDER #: {selectedBill.order_number}</div>
                <div>TABLE: {selectedBill.table_number || 'N/A'} {selectedBill.room_number ? `(ROOM ${selectedBill.room_number})` : ''}</div>
                <div>DATE: {new Date(selectedBill.created_at).toLocaleDateString()}</div>
              </div>

              <div className="border-t border-b border-black py-1 my-2 font-bold flex justify-between">
                <span>ITEM</span>
                <span>QTY</span>
                <span>PRICE</span>
              </div>

              <div className="space-y-1.5 mb-3">
                {selectedBill.items && selectedBill.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>{item.item_name} ×{item.quantity}</span>
                    <span>₹{parseFloat(item.total_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-black pt-2 space-y-1 text-right">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{parseFloat(selectedBill.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST+SGST (5%):</span>
                  <span>₹{parseFloat(selectedBill.tax_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
                  <span>GRAND TOTAL:</span>
                  <span>₹{parseFloat(selectedBill.grand_total).toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-center pt-2 font-bold uppercase">
                  PAYMENT METHOD: {selectedBill.payment_method || selectedBill.payment_status}
                </div>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 no-print"
            >
              <Printer className="w-5 h-5" />
              <span>Print Tax Invoice</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
