import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Bike, Power, MapPin, Phone, CheckCircle2, Navigation, AlertTriangle, 
  Package, Clock, RefreshCw, LogOut, Shield, DollarSign, User, ListOrdered,
  Store, Plus, ArrowRight, Check, Sparkles, Building2, Zap, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import OrderMap from '../../components/OrderMap';

function getOrderLast5(orderNum) {
  if (!orderNum) return '-----';
  const digits = String(orderNum).replace(/\D/g, '');
  if (digits.length >= 5) return digits.slice(-5);
  return String(orderNum).length > 5 ? String(orderNum).slice(-5) : String(orderNum);
}

export default function DriverDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [driver, setDriver] = useState(null);
  const [assignedRestaurants, setAssignedRestaurants] = useState([]);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Status & Location state
  const [availabilityStatus, setAvailabilityStatus] = useState('OFFLINE');
  const [currentCoords, setCurrentCoords] = useState({ lat: 12.9716, lng: 77.5946 });
  const [lastLocationTime, setLastLocationTime] = useState(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Multi-Restaurant Apply Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [availableRestaurants, setAvailableRestaurants] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [applyingRestId, setApplyingRestId] = useState(null);
  const [connectingAll, setConnectingAll] = useState(false);

  // Claiming loading state
  const [claimingOrderId, setClaimingOrderId] = useState(null);

  // Action Modals
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const [isCodCollected, setIsCodCollected] = useState(true);
  const [deliveringOrder, setDeliveringOrder] = useState(false);

  const locationIntervalRef = useRef(null);
  const ordersPollIntervalRef = useRef(null);

  useEffect(() => {
    fetchDriverDashboard();
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (ordersPollIntervalRef.current) clearInterval(ordersPollIntervalRef.current);
    };
  }, []);

  const fetchDriverDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/driver/orders');
      if (res.data.success) {
        setDriver(res.data.driver);
        setAvailabilityStatus(res.data.driver?.availability_status || 'OFFLINE');
        if (res.data.driver?.current_latitude && res.data.driver?.current_longitude) {
          setCurrentCoords({
            lat: parseFloat(res.data.driver.current_latitude),
            lng: parseFloat(res.data.driver.current_longitude)
          });
        }
        setActiveDelivery(res.data.activeDelivery);
        setAllOrders(res.data.orders || []);
      }

      // Fetch assigned restaurants
      const profRes = await api.get('/driver/profile');
      if (profRes.data.success) {
        setAssignedRestaurants(profRes.data.assignedRestaurants || []);
      }

      // Fetch available pool
      fetchAvailableOrdersPool();

    } catch (err) {
      console.error('Failed to load driver dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load driver data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableOrdersPool = async (restFilter = selectedRestaurantFilter) => {
    try {
      const url = (restFilter && restFilter !== 'ALL')
        ? `/driver/available-orders?restaurant_id=${restFilter}`
        : '/driver/available-orders';
      const res = await api.get(url);
      if (res.data.success) {
        setAvailableOrders(res.data.orders || []);
      }
    } catch (err) {
      // Silently catch background poll failures
    }
  };

  // Poll for available unassigned orders every 4 seconds when online and no active delivery
  useEffect(() => {
    if (ordersPollIntervalRef.current) clearInterval(ordersPollIntervalRef.current);

    if (availabilityStatus === 'AVAILABLE' && !activeDelivery) {
      ordersPollIntervalRef.current = setInterval(() => {
        fetchAvailableOrdersPool();
      }, 4000);
    }

    return () => {
      if (ordersPollIntervalRef.current) clearInterval(ordersPollIntervalRef.current);
    };
  }, [availabilityStatus, activeDelivery, selectedRestaurantFilter]);

  // Start periodic GPS tracking when ONLINE or handling an active delivery
  useEffect(() => {
    if (availabilityStatus === 'AVAILABLE' || availabilityStatus === 'BUSY' || (activeDelivery && activeDelivery.order_status === 'OUT_FOR_DELIVERY')) {
      startLocationTracking();
    } else {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    }
  }, [availabilityStatus, activeDelivery]);

  const startLocationTracking = () => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    sendCurrentLocation();
    locationIntervalRef.current = setInterval(() => {
      sendCurrentLocation();
    }, 8000);
  };

  const sendCurrentLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords({ lat, lng });

        try {
          await api.post('/driver/location', {
            latitude: lat,
            longitude: lng,
            orderId: activeDelivery?.id || null
          });
          setLastLocationTime(new Date());
        } catch (err) {
          // silently handle tracking update fail
        }
      },
      (err) => {
        console.warn('Geolocation warning:', err.message);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const getQuickLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        return resolve({ lat: currentCoords.lat || 15.3647, lng: currentCoords.lng || 75.1240 });
      }
      const timeoutId = setTimeout(() => {
        resolve({ lat: currentCoords.lat || 15.3647, lng: currentCoords.lng || 75.1240 });
      }, 1500);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeoutId);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(timeoutId);
          resolve({ lat: currentCoords.lat || 15.3647, lng: currentCoords.lng || 75.1240 });
        },
        { timeout: 1500, enableHighAccuracy: false }
      );
    });
  };

  const handleToggleOnline = async () => {
    setError('');
    
    if (availabilityStatus === 'OFFLINE' && assignedRestaurants.length === 0) {
      setError('You are not assigned to any restaurant yet. Click "Apply More" to partner with a restaurant first.');
      setShowApplyModal(true);
      return;
    }

    setUpdatingLocation(true);

    try {
      if (availabilityStatus === 'OFFLINE') {
        const coords = await getQuickLocation();
        setCurrentCoords(coords);

        const res = await api.post('/driver/go-online', { latitude: coords.lat, longitude: coords.lng });
        if (res.data.success) {
          setAvailabilityStatus('AVAILABLE');
          fetchDriverDashboard();
        }
      } else {
        const res = await api.post('/driver/go-offline');
        if (res.data.success) {
          setAvailabilityStatus('OFFLINE');
          fetchDriverDashboard();
        }
      }
    } catch (err) {
      console.error('Online toggle error:', err);
      const msg = err.response?.data?.message || 'Failed to update online status.';
      setError(msg);
      if (msg.toLowerCase().includes('assignment') || msg.toLowerCase().includes('restaurant')) {
        setShowApplyModal(true);
      }
    } finally {
      setUpdatingLocation(false);
    }
  };

  // Open Multi-Restaurant Application Modal
  const handleOpenApplyModal = async () => {
    setShowApplyModal(true);
    setLoadingRestaurants(true);
    setError('');
    try {
      const res = await api.get('/driver/available-restaurants');
      if (res.data.success) {
        setAvailableRestaurants(res.data.restaurants || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load restaurant list.');
    } finally {
      setLoadingRestaurants(false);
    }
  };

  // Submit 1-Click Multi-Restaurant Application / Instant Connect
  const handleApplyToRestaurant = async (restaurantId, restaurantName) => {
    setApplyingRestId(restaurantId);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/driver/apply-restaurant', { restaurantId });
      if (res.data.success) {
        setSuccessMsg(res.data.message || `🎉 Connected to ${restaurantName}!`);
        // Refresh available restaurants list
        const refreshRes = await api.get('/driver/available-restaurants');
        if (refreshRes.data.success) {
          setAvailableRestaurants(refreshRes.data.restaurants || []);
        }
        // Refresh profile assigned stores
        const profRes = await api.get('/driver/profile');
        if (profRes.data.success) {
          setAssignedRestaurants(profRes.data.assignedRestaurants || []);
        }
        fetchAvailableOrdersPool();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to connect to restaurant.');
    } finally {
      setApplyingRestId(null);
    }
  };

  // 1-Click Connect All Active Restaurants
  const handleConnectAllRestaurants = async () => {
    setConnectingAll(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/driver/connect-all-restaurants');
      if (res.data.success) {
        setSuccessMsg(res.data.message || '🎉 Connected to all active restaurants!');
        const refreshRes = await api.get('/driver/available-restaurants');
        if (refreshRes.data.success) {
          setAvailableRestaurants(refreshRes.data.restaurants || []);
        }
        const profRes = await api.get('/driver/profile');
        if (profRes.data.success) {
          setAssignedRestaurants(profRes.data.assignedRestaurants || []);
        }
        fetchAvailableOrdersPool();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to connect all restaurants.');
    } finally {
      setConnectingAll(false);
    }
  };

  // Instant Atomic FCFS Claim Order
  const handleClaimOrder = async (orderId) => {
    setClaimingOrderId(orderId);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/driver/orders/${orderId}/claim`);
      if (res.data.success) {
        setSuccessMsg(res.data.message || '🎉 Delivery claimed successfully!');
        fetchDriverDashboard();
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response?.data?.message || '⚡ This order was just claimed by another rider!');
        fetchAvailableOrdersPool();
      } else {
        setError(err.response?.data?.message || 'Failed to claim order.');
      }
    } finally {
      setClaimingOrderId(null);
    }
  };

  // State Machine Action Handlers
  const handleAcceptOrder = async () => {
    if (!activeDelivery) return;
    try {
      const res = await api.post(`/driver/orders/${activeDelivery.id}/accept`);
      if (res.data.success) {
        fetchDriverDashboard();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept delivery.');
    }
  };

  const handleDeclineOrder = async () => {
    if (!activeDelivery) return;
    try {
      const res = await api.post(`/driver/orders/${activeDelivery.id}/decline`, { reason: 'Rider unavailable' });
      if (res.data.success) {
        fetchDriverDashboard();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to decline delivery.');
    }
  };

  const handlePickupOrder = async () => {
    if (!activeDelivery) return;
    try {
      const res = await api.post(`/driver/orders/${activeDelivery.id}/pickup`);
      if (res.data.success) {
        fetchDriverDashboard();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark picked up.');
    }
  };

  const handleStartDelivery = async () => {
    if (!activeDelivery) return;
    try {
      const res = await api.post(`/driver/orders/${activeDelivery.id}/start-delivery`);
      if (res.data.success) {
        fetchDriverDashboard();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start delivery.');
    }
  };

  const handleDeliverOrder = async () => {
    if (!activeDelivery) return;
    setDeliveringOrder(true);
    setError('');
    try {
      const res = await api.post(`/driver/orders/${activeDelivery.id}/deliver`, {
        isCodCollected,
        remainOnline: true
      });
      if (res.data.success) {
        setSuccessMsg(res.data.message || '🎉 Order delivered successfully! You are now available for the next order.');
        setActiveDelivery(null);
        setAvailabilityStatus('AVAILABLE');
        await fetchDriverDashboard();
        fetchAvailableOrdersPool();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark delivered.');
    } finally {
      setDeliveringOrder(false);
    }
  };

  const handleMarkFailedSubmit = async (e) => {
    e.preventDefault();
    if (!activeDelivery || !failureReason) return;

    try {
      const res = await api.post(`/driver/orders/${activeDelivery.id}/delivery-failed`, {
        reason: failureReason
      });
      if (res.data.success) {
        setShowFailureModal(false);
        setFailureReason('');
        fetchDriverDashboard();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark delivery as failed.');
    }
  };

  const openGoogleNav = (lat, lng, address) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(address || '')}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-400">Loading Delivery Dashboard...</p>
        </div>
      </div>
    );
  }

  const completedOrders = allOrders.filter(o => o.order_status === 'DELIVERED');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-12">
      
      {/* Mobile Top App Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black shadow-lg shadow-orange-500/20">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-white text-sm leading-tight">
              {driver?.full_name || user?.name || 'Rider Duty'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              {assignedRestaurants.length > 0 
                ? `Handling ${assignedRestaurants.length} Restaurant${assignedRestaurants.length > 1 ? 's' : ''}`
                : 'No Restaurant Assigned'}
            </p>
          </div>
        </div>

        {/* GO ONLINE / OFFLINE TOGGLE BUTTON */}
        <button
          onClick={handleToggleOnline}
          disabled={updatingLocation}
          className={`px-4 py-2 rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-lg ${
            availabilityStatus === 'AVAILABLE' || availabilityStatus === 'BUSY'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          }`}
        >
          <Power className="w-4 h-4" />
          {updatingLocation ? 'Updating...' : availabilityStatus === 'AVAILABLE' ? 'ONLINE 🟢' : availabilityStatus === 'BUSY' ? 'ON DELIVERY 🛵' : 'GO ONLINE 🔴'}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Success Alert */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white font-bold text-sm">✕</button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-slate-400 hover:text-white font-bold text-sm">✕</button>
          </div>
        )}

        {/* LIVE DUTY STATUS CARD */}
        <div className={`p-4 rounded-3xl border transition-all flex items-center justify-between shadow-xl ${
          availabilityStatus === 'AVAILABLE'
            ? 'bg-gradient-to-r from-emerald-950/80 to-emerald-900/60 border-emerald-500/40 text-emerald-100'
            : availabilityStatus === 'BUSY'
            ? 'bg-gradient-to-r from-amber-950/80 to-amber-900/60 border-amber-500/40 text-amber-100'
            : 'bg-gradient-to-r from-slate-900/90 to-slate-950 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${
              availabilityStatus === 'AVAILABLE'
                ? 'bg-emerald-400 animate-ping'
                : availabilityStatus === 'BUSY'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-red-500'
            }`} />
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider block text-slate-400">Current Rider Status</span>
              <span className="font-black text-sm tracking-wide">
                {availabilityStatus === 'AVAILABLE' ? '🟢 ONLINE — READY FOR ORDERS' : availabilityStatus === 'BUSY' ? '🛵 ON ACTIVE DELIVERY TRIP' : '🔴 OFFLINE (NOT RECEIVING ORDERS)'}
              </span>
            </div>
          </div>

          <button
            onClick={handleToggleOnline}
            disabled={updatingLocation}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
              availabilityStatus === 'AVAILABLE' || availabilityStatus === 'BUSY'
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25'
            }`}
          >
            {updatingLocation ? 'Updating...' : (availabilityStatus === 'AVAILABLE' || availabilityStatus === 'BUSY') ? 'Go Offline 🔴' : 'Go Online 🟢'}
          </button>
        </div>

        {/* MULTI-RESTAURANT MANAGEMENT WIDGET */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-xs">My Assigned Restaurants</h3>
                <p className="text-[10px] text-slate-400">
                  You can deliver orders for {assignedRestaurants.length} restaurant{assignedRestaurants.length !== 1 ? 's' : ''} simultaneously
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenApplyModal}
              className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-extrabold text-[11px] flex items-center gap-1 shadow-md shadow-orange-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Apply More
            </button>
          </div>

          {/* Assigned Restaurants Chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {assignedRestaurants.length === 0 ? (
              <div className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl w-full flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>You are not currently assigned to any restaurant. Click "Apply More" to partner with a restaurant.</span>
              </div>
            ) : (
              assignedRestaurants.map((rest) => (
                <div
                  key={rest.id}
                  className="px-3 py-1.5 bg-slate-950 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-bold text-slate-200">{rest.name}</span>
                  <span className="text-[10px] text-slate-500">({rest.city || 'Central'})</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Location Status Bar */}
        <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <MapPin className={`w-4 h-4 ${availabilityStatus === 'OFFLINE' ? 'text-slate-500' : 'text-emerald-400'}`} />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Current GPS</span>
              <span className="font-semibold text-white">
                {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
              </span>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-400">
            {lastLocationTime ? `GPS: ${new Date(lastLocationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'GPS Ready'}
          </div>
        </div>

        {/* ⚡ INSTANT AVAILABLE ORDERS POOL (FCFS Self-Service Dispatch) */}
        {!activeDelivery && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                <h2 className="font-extrabold text-white text-xs uppercase tracking-wider">
                  Available Orders Pool ({availableOrders.length})
                </h2>
              </div>
              <button
                onClick={() => fetchAvailableOrdersPool(selectedRestaurantFilter)}
                className="text-[11px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {/* Store Filter Tabs (Multi-Store Support) */}
            {assignedRestaurants.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => {
                    setSelectedRestaurantFilter('ALL');
                    fetchAvailableOrdersPool('ALL');
                  }}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                    selectedRestaurantFilter === 'ALL'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  All Stores ({assignedRestaurants.length})
                </button>
                {assignedRestaurants.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRestaurantFilter(r.id);
                      fetchAvailableOrdersPool(r.id);
                    }}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                      selectedRestaurantFilter === r.id
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}

            {availableOrders.length === 0 ? (
              <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 text-center space-y-3">
                <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-300">No Orders Waiting in Pool</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  {availabilityStatus === 'AVAILABLE'
                    ? 'Orders from your partner restaurants will appear here live. First rider to claim gets it!'
                    : 'Turn your status ONLINE to see and claim live delivery orders.'}
                </p>
                {assignedRestaurants.length === 0 && (
                  <button
                    onClick={handleOpenApplyModal}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 inline-flex items-center gap-1.5 mt-2"
                  >
                    <Store className="w-4 h-4" /> Connect to Partner Restaurants
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {availableOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-gradient-to-br from-slate-900 to-slate-900/90 rounded-3xl p-5 border-2 border-amber-500/40 shadow-xl shadow-amber-500/5 space-y-3.5 transition-all hover:border-amber-400"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-black text-[10px] uppercase tracking-wider border border-amber-500/30">
                          {order.order_status.replace(/_/g, ' ')}
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-orange-500/20 text-orange-400 font-mono font-black text-xs border border-orange-500/30">
                          #{getOrderLast5(order.order_number)}
                        </span>
                        <span className="font-mono text-slate-400 text-[10px] hidden sm:inline">
                          ({order.order_number})
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-400">₹{order.total_amount}</span>
                    </div>

                    {/* Store & Customer Details */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                        <span className="text-[9px] font-extrabold uppercase text-orange-400 block mb-0.5">🏪 Pickup Store</span>
                        <p className="font-bold text-white text-xs truncate">{order.restaurant_name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{order.restaurant_address}</p>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                        <span className="text-[9px] font-extrabold uppercase text-emerald-400 block mb-0.5">📍 Customer Drop</span>
                        <p className="font-bold text-white text-xs truncate">{order.customer_name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{order.delivery_address}</p>
                      </div>
                    </div>

                    {/* Order summary info */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Payment: <strong className="text-slate-200">{order.payment_method}</strong></span>
                      <span>Items: <strong className="text-slate-200">{order.items?.length || 1}</strong></span>
                      <span>Placed: <strong className="text-slate-200">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                    </div>

                    {/* Instant 1-Click Atomic Claim Button */}
                    <button
                      onClick={() => handleClaimOrder(order.id)}
                      disabled={claimingOrderId === order.id || availabilityStatus === 'OFFLINE'}
                      className={`w-full py-3.5 rounded-2xl font-black text-xs text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                        availabilityStatus === 'OFFLINE'
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25 active:scale-[0.98]'
                      }`}
                    >
                      {claimingOrderId === order.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Claiming Order (Securing)...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 fill-white" />
                          ⚡ CLAIM & DELIVER NOW (Instant)
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE DELIVERY CARD (Priority) */}
        {activeDelivery && (
          <div className="bg-slate-900 rounded-3xl p-6 border-2 border-orange-500/60 shadow-2xl shadow-orange-500/10 space-y-5">
            
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 font-extrabold text-xs uppercase tracking-wider border border-orange-500/30">
                  {activeDelivery.order_status.replace(/_/g, ' ')}
                </span>
                <span className="px-3 py-1 rounded-xl bg-orange-500/20 text-orange-300 font-mono font-black text-sm border border-orange-500/40 shadow-inner">
                  #{getOrderLast5(activeDelivery.order_number)}
                </span>
                <span className="font-mono text-slate-400 text-xs hidden sm:inline">
                  ({activeDelivery.order_number})
                </span>
              </div>
              <span className="text-xs font-black text-emerald-400">₹{activeDelivery.total_amount}</span>
            </div>

            {/* Pickup Restaurant Info */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Pickup Location</span>
                <button
                  onClick={() => openGoogleNav(activeDelivery.restaurant_latitude, activeDelivery.restaurant_longitude, activeDelivery.restaurant_address)}
                  className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-[11px] font-bold flex items-center gap-1 border border-orange-500/20"
                >
                  <Navigation className="w-3 h-3" /> Nav to Store ↗
                </button>
              </div>
              <p className="font-bold text-white text-sm">{activeDelivery.restaurant_name}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{activeDelivery.restaurant_address}</p>
            </div>

            {/* Customer Drop Location Info */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Customer Delivery Drop</span>
                <button
                  onClick={() => openGoogleNav(activeDelivery.customer_latitude, activeDelivery.customer_longitude, activeDelivery.delivery_address)}
                  className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-[11px] font-bold flex items-center gap-1 border border-orange-500/20"
                >
                  <Navigation className="w-3 h-3" /> Nav to Customer ↗
                </button>
              </div>
              <p className="font-bold text-white text-sm">{activeDelivery.customer_name}</p>
              <p className="text-xs text-slate-300 leading-relaxed">{activeDelivery.delivery_address}</p>
              {activeDelivery.delivery_landmark && (
                <p className="text-xs text-slate-400">Landmark: {activeDelivery.delivery_landmark}</p>
              )}
            </div>

            {/* COD Notice */}
            {activeDelivery.payment_method === 'COD' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <DollarSign className="w-4 h-4 text-amber-400" /> CASH TO COLLECT (COD)
                </span>
                <span className="font-black text-sm">₹{activeDelivery.total_amount}</span>
              </div>
            )}

            {/* Map Preview */}
            <div className="h-44 rounded-2xl overflow-hidden border border-slate-800">
              <OrderMap
                restaurantCoords={{ lat: parseFloat(activeDelivery.restaurant_latitude), lng: parseFloat(activeDelivery.restaurant_longitude) }}
                customerCoords={{ lat: parseFloat(activeDelivery.customer_latitude), lng: parseFloat(activeDelivery.customer_longitude) }}
                driverCoords={currentCoords}
                orderStatus={activeDelivery.order_status}
              />
            </div>

            {/* STATE MACHINE ACTION BUTTONS */}
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              
              {/* 1. ASSIGNED_TO_DRIVER -> ACCEPT / DECLINE */}
              {activeDelivery.order_status === 'ASSIGNED_TO_DRIVER' && (
                <div className="flex gap-3">
                  <button
                    onClick={handleDeclineOrder}
                    className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-xs text-red-400 border border-slate-700 transition-all"
                  >
                    Decline
                  </button>
                  <button
                    onClick={handleAcceptOrder}
                    className="flex-2 py-3.5 bg-orange-500 hover:bg-orange-600 rounded-2xl font-black text-xs text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Accept Delivery Assignment
                  </button>
                </div>
              )}

              {/* 2. PROGRESSIVE STEP: Food Picked Up from Store */}
              {['ACCEPTED', 'PENDING', 'SENT_TO_KITCHEN', 'PREPARING', 'READY_FOR_PICKUP', 'DRIVER_ACCEPTED'].includes(activeDelivery.order_status) && (
                <button
                  onClick={handlePickupOrder}
                  className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 rounded-2xl font-black text-xs text-white shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all"
                >
                  <Package className="w-4 h-4" /> 🛍️ Confirm Food Picked Up from Restaurant
                </button>
              )}

              {/* 3. PROGRESSIVE STEP: Start Out for Delivery */}
              {activeDelivery.order_status === 'PICKED_UP' && (
                <button
                  onClick={handleStartDelivery}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs text-white shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all"
                >
                  <Navigation className="w-4 h-4" /> 🚀 Start Delivery Route (Out for Delivery)
                </button>
              )}

              {/* COD Payment Collection Toggle */}
              {activeDelivery.payment_method === 'COD' && (
                <label className="flex items-center gap-3 p-3.5 bg-slate-950 rounded-2xl border border-amber-500/30 cursor-pointer shadow-inner">
                  <input
                    type="checkbox"
                    checked={isCodCollected}
                    onChange={(e) => setIsCodCollected(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 bg-slate-800 border-slate-700 focus:ring-0"
                  />
                  <span className="text-xs font-bold text-amber-300">
                    💰 Cash Payment Collected (₹{activeDelivery.total_amount})
                  </span>
                </label>
              )}

              {/* 4. PROMINENT DELIVERED & TAKE NEXT ORDER BUTTON */}
              <div className="space-y-2">
                <button
                  onClick={handleDeliverOrder}
                  disabled={deliveringOrder}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl font-black text-sm text-white shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] border border-emerald-400/40"
                >
                  {deliveringOrder ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Saving & Marking Delivered...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-100" />
                      ✅ Mark as DELIVERED & Ready for Next Order 🎉
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setShowFailureModal(true)}
                    className="py-2 px-3 text-red-400 hover:text-red-300 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Report Delivery Issue
                  </button>
                  <span className="text-[10px] text-slate-400 font-medium">
                    ⚡ Auto-syncs to Restaurant Admin
                  </span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* RIDER STATS & LINKS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Completed</span>
              <span className="font-black text-white text-base">{completedOrders.length} Deliveries</span>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Assigned</span>
              <span className="font-black text-white text-base">{allOrders.length} Orders</span>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => { logout(); navigate('/driver/login'); }}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl font-bold text-xs text-red-400 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign Out Rider Duty
          </button>
        </div>

      </main>

      {/* MULTI-RESTAURANT APPLICATION MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl max-h-[85vh] overflow-y-auto space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Partner with Restaurants</h3>
                  <p className="text-[11px] text-slate-400">Expand your delivery coverage across multiple stores</p>
                </div>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Seamless Document Reuse Banner & Connect All */}
            <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-2xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                  <Sparkles className="w-4 h-4" /> Instant Partner Connection
                </div>
                <button
                  onClick={handleConnectAllRestaurants}
                  disabled={connectingAll}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-[11px] rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1 transition-all"
                >
                  {connectingAll ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Connecting All...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-white" /> Connect All Stores
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                As an active approved rider, you can connect with any restaurant instantly with 1-click and immediately start receiving live orders!
              </p>
            </div>

            {/* Restaurant List */}
            {loadingRestaurants ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                Loading available restaurants...
              </div>
            ) : availableRestaurants.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No active restaurants accepting applications at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {availableRestaurants.map((rest) => (
                  <div
                    key={rest.id}
                    className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-white text-xs truncate">{rest.name}</h4>
                        {rest.city && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[9px] font-bold">
                            {rest.city}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{rest.address}</p>
                    </div>

                    {/* Status / Action */}
                    <div className="shrink-0">
                      {rest.isAssigned ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[10px] flex items-center gap-1">
                          <Check className="w-3 h-3" /> Connected
                        </span>
                      ) : rest.applicationStatus === 'PENDING' || rest.applicationStatus === 'UNDER_REVIEW' ? (
                        <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      ) : rest.applicationStatus === 'REJECTED' ? (
                        <button
                          onClick={() => handleApplyToRestaurant(rest.id, rest.name)}
                          disabled={applyingRestId === rest.id}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-400 font-bold text-[10px] transition-all"
                        >
                          {applyingRestId === rest.id ? 'Connecting...' : 'Reconnect'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApplyToRestaurant(rest.id, rest.name)}
                          disabled={applyingRestId === rest.id}
                          className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-[10px] shadow-md shadow-orange-500/20 transition-all flex items-center gap-1"
                        >
                          {applyingRestId === rest.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3 fill-white" /> Connect ⚡
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* REPORT FAILURE MODAL */}
      {showFailureModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-white text-base">Report Delivery Issue</h3>
            </div>
            <p className="text-xs text-slate-400">
              Specify the reason why this delivery could not be completed. The restaurant admin will be notified to resolve operationally.
            </p>
            <form onSubmit={handleMarkFailedSubmit} className="space-y-4">
              <textarea
                required
                rows="3"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="e.g. Customer unavailable / Wrong address / Customer refused order"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs focus:border-red-500 focus:outline-none"
              ></textarea>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFailureModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs"
                >
                  Submit Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
