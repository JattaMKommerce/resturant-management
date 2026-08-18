import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Clock, ChevronRight, Utensils, CheckCircle } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/orders/my-orders');
      if (res.data.success) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error('Error loading order history:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-8">
          Your Order History
        </h1>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-xs font-semibold text-slate-500">Loading your past orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800 mt-4">No Past Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1">You haven't placed any food orders yet.</p>
            <Link
              to="/restaurant/grand-palace"
              className="inline-block mt-6 px-6 py-2.5 bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md"
            >
              Order Online Now
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-slate-900 text-base">#{ord.order_number}</span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        ord.order_status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.order_status === 'CANCELLED' || ord.order_status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {ord.order_status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-semibold mt-1">
                    {ord.restaurant_name} • {new Date(ord.created_at).toLocaleDateString()}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {ord.items?.map((item) => (
                      <span key={item.id} className="text-[11px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md">
                        {item.item_name} (x{item.quantity})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Paid ({ord.payment_method})</span>
                    <span className="text-lg font-black text-slate-900">₹{parseFloat(ord.total_amount).toFixed(2)}</span>
                  </div>

                  <Link
                    to={`/restaurant/grand-palace/order/${ord.id}`}
                    className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
                  >
                    Track <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
