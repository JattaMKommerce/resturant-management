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
  const [locationName, setLocationName] = useState('Detecting live location...');
  const [lastLocationTime, setLastLocationTime] = useState(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const lastGeocodedCoordsRef = useRef({ lat: null, lng: null });

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

  // Reverse Geocode (lat, lng -> Clean Human-Readable Location Name)
  const fetchLocationName = async (lat, lng) => {
    if (!lat || !lng) return;

    // Check if coordinates have moved by at least ~80 meters (0.0008 deg) to avoid redundant requests
    const last = lastGeocodedCoordsRef.current;
    if (last.lat && last.lng) {
      const dLat = Math.abs(lat - last.lat);
      const dLng = Math.abs(lng - last.lng);
      if (dLat < 0.0008 && dLng < 0.0008) return;
    }

    try {
      // 1. Try BigDataCloud (Free, Fast, Client-Side, No CORS)
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const res = await fetch(bdcUrl);
      if (res.ok) {
        const data = await res.json();
        const parts = [
          data.locality || data.localityInfo?.administrative?.[3]?.name || data.localityInfo?.administrative?.[4]?.name,
          data.city || data.principalSubdivisionCity || data.localityInfo?.administrative?.[2]?.name,
          data.principalSubdivision
        ].filter(Boolean);

        const uniqueParts = [...new Set(parts)];
        if (uniqueParts.length > 0) {
          setLocationName(uniqueParts.join(', '));
          lastGeocodedCoordsRef.current = { lat, lng };
          return;
        }
      }
    } catch (e1) {
      // Fallback to OpenStreetMap Nominatim
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const nomRes = await fetch(nomUrl, { headers: { 'Accept-Language': 'en' } });
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          const addr = nomData.address || {};
          const nameParts = [
            addr.suburb || addr.neighbourhood || addr.road || addr.village,
            addr.city || addr.town || addr.county,
            addr.state
          ].filter(Boolean);
          const uniqueNom = [...new Set(nameParts)];
          if (uniqueNom.length > 0) {
            setLocationName(uniqueNom.join(', '));
            lastGeocodedCoordsRef.current = { lat, lng };
            return;
          }
        }
      } catch (e2) { }
    }

    // Fallback if offline/failed
    if (assignedRestaurants && assignedRestaurants.length > 0 && assignedRestaurants[0].city) {
      setLocationName(`${assignedRestaurants[0].city} (Live Location)`);
    } else {
      setLocationName('Live Location Active');
    }
  };

  useEffect(() => {
    if (currentCoords?.lat && currentCoords?.lng) {
      fetchLocationName(currentCoords.lat, currentCoords.lng);
    }
  }, [currentCoords]);

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
      <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#3A7D7C] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-[#64748B]">Loading Delivery Dashboard...</p>
        </div>
      </div>
    );
  }

  const completedOrders = allOrders.filter(o => o.order_status === 'DELIVERED');

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col font-sans antialiased pb-12">

      {/* Mobile Top App Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#D7E5E8] shadow-xs p-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#3A7D7C] text-white flex items-center justify-center font-bold shadow-xs">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-[#1F2937] text-sm leading-tight">
              {driver?.full_name || user?.name || 'Rider Duty'}
            </h1>
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              {assignedRestaurants.length > 0
                ? `Partnered with ${assignedRestaurants.length} Restaurant${assignedRestaurants.length > 1 ? 's' : ''}`
                : 'No Restaurant Assigned'}
            </p>
          </div>
        </div>

        {/* GO ONLINE / OFFLINE TOGGLE BUTTON */}
        <button
          onClick={handleToggleOnline}
          disabled={updatingLocation}
          className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 shadow-2xs ${availabilityStatus === 'AVAILABLE' || availabilityStatus === 'BUSY'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-white hover:bg-slate-50 text-[#1F2937] border border-[#D7E5E8]'
            }`}
        >
          <Power className="w-4 h-4" />
          {updatingLocation ? 'Updating...' : availabilityStatus === 'AVAILABLE' ? 'ONLINE 🟢' : availabilityStatus === 'BUSY' ? 'ON DELIVERY 🛵' : 'GO ONLINE 🔴'}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-5">

        {/* Success Alert */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-2xs">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-950 font-bold text-sm">✕</button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-2xs">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-700 hover:text-rose-950 font-bold text-sm">✕</button>
          </div>
        )}

        {/* LIVE DUTY STATUS CARD */}
        <div className={`p-4 sm:p-5 rounded-3xl border transition-all flex items-center justify-between shadow-xs bg-white ${availabilityStatus === 'AVAILABLE'
            ? 'border-emerald-300'
            : availabilityStatus === 'BUSY'
              ? 'border-amber-300'
              : 'border-[#D7E5E8]'
          }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${availabilityStatus === 'AVAILABLE'
                ? 'bg-emerald-500 animate-ping'
                : availabilityStatus === 'BUSY'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500'
              }`} />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block text-[#64748B]">Current Rider Status</span>
              <span className="font-bold text-sm text-[#1F2937] tracking-tight">
                {availabilityStatus === 'AVAILABLE' ? '🟢 ONLINE - READY FOR ORDERS' : availabilityStatus === 'BUSY' ? '🛵 ON ACTIVE DELIVERY TRIP' : '🔴 OFFLINE (NOT RECEIVING ORDERS)'}
              </span>
            </div>
          </div>

          <button
            onClick={handleToggleOnline}
            disabled={updatingLocation}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-2xs ${availabilityStatus === 'AVAILABLE' || availabilityStatus === 'BUSY'
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-[#3A7D7C] hover:bg-[#2F6665] text-white'
              }`}
          >
            {updatingLocation ? 'Updating...' : (availabilityStatus === 'AVAILABLE' || availabilityStatus === 'BUSY') ? 'Go Offline 🔴' : 'Go Online 🟢'}
          </button>
        </div>

        {/* MULTI-RESTAURANT MANAGEMENT WIDGET */}
        <div className="bg-white rounded-3xl p-5 border border-[#D7E5E8] shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center font-bold">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-[#1F2937] text-xs">My Assigned Restaurants</h3>
                <p className="text-[10px] text-[#64748B]">
                  Deliver for {assignedRestaurants.length} restaurant{assignedRestaurants.length !== 1 ? 's' : ''} simultaneously
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenApplyModal}
              className="px-3 py-1.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded-xl font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Partner More
            </button>
          </div>

          {/* Assigned Restaurants Chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {assignedRestaurants.length === 0 ? (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-2xl w-full flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>You are not currently assigned to any restaurant. Click "Partner More" to partner with a restaurant.</span>
              </div>
            ) : (
              assignedRestaurants.map((rest) => (
                <div
                  key={rest.id}
                  className="px-3 py-1.5 bg-slate-50 border border-[#D7E5E8] rounded-xl flex items-center gap-2 text-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-bold text-[#1F2937]">{rest.name}</span>
                  <span className="text-[10px] text-[#64748B]">({rest.city || 'Central'})</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Location Status Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#D7E5E8] shadow-xs flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${availabilityStatus === 'OFFLINE'
                ? 'bg-slate-50 text-[#64748B] border-slate-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-2xs'
              }`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-extrabold text-[#64748B] block tracking-wider">Current Location</span>
              <span className="font-bold text-[#1F2937] text-xs sm:text-sm truncate block" title={locationName}>
                {locationName}
              </span>
            </div>
          </div>
          <div className="text-right text-[10px] text-[#64748B] shrink-0">
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live GPS
            </span>
            <span className="block text-[9px] text-[#64748B]">
              {lastLocationTime ? new Date(lastLocationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
            </span>
          </div>
        </div>

        {/* ⚡ INSTANT AVAILABLE ORDERS POOL (FCFS Self-Service Dispatch) */}
        {!activeDelivery && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h2 className="font-bold text-[#1F2937] text-xs uppercase tracking-wider">
                  Available Orders Pool ({availableOrders.length})
                </h2>
              </div>
              <button
                onClick={() => fetchAvailableOrdersPool(selectedRestaurantFilter)}
                className="text-[11px] text-[#3A7D7C] hover:text-[#2F6665] font-bold flex items-center gap-1"
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
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${selectedRestaurantFilter === 'ALL'
                      ? 'bg-[#3A7D7C] text-white shadow-2xs'
                      : 'bg-white text-[#64748B] hover:text-[#1F2937] border border-[#D7E5E8]'
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
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${selectedRestaurantFilter === r.id
                        ? 'bg-[#3A7D7C] text-white shadow-2xs'
                        : 'bg-white text-[#64748B] hover:text-[#1F2937] border border-[#D7E5E8]'
                      }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}

            {availableOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 border border-[#D7E5E8] shadow-xs text-center space-y-3">
                <Clock className="w-8 h-8 text-[#64748B] mx-auto" />
                <p className="text-xs font-bold text-[#1F2937]">No Orders Waiting in Pool</p>
                <p className="text-[11px] text-[#64748B] max-w-xs mx-auto">
                  {availabilityStatus === 'AVAILABLE'
                    ? 'Orders from your partner restaurants will appear here live. First rider to claim gets it!'
                    : 'Turn your status ONLINE to see and claim live delivery orders.'}
                </p>
                {assignedRestaurants.length === 0 && (
                  <button
                    onClick={handleOpenApplyModal}
                    className="px-4 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold rounded-xl shadow-2xs inline-flex items-center gap-1.5 mt-2"
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
                    className="bg-white rounded-3xl p-5 border border-[#D7E5E8] shadow-xs space-y-3.5 transition-all hover:border-[#3A7D7C]"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-[10px] uppercase tracking-wider border border-amber-200">
                          {order.order_status.replace(/_/g, ' ')}
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] font-mono font-bold text-xs border border-[#D7E5E8]">
                          #{getOrderLast5(order.order_number)}
                        </span>
                        <span className="font-mono text-[#64748B] text-[10px] hidden sm:inline">
                          ({order.order_number})
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#1F2937] font-mono">₹{order.total_amount}</span>
                    </div>

                    {/* Store & Customer Details */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-[#D7E5E8]">
                        <span className="text-[9px] font-bold uppercase text-[#3A7D7C] block mb-0.5">🏪 Pickup Store</span>
                        <p className="font-bold text-[#1F2937] text-xs truncate">{order.restaurant_name}</p>
                        <p className="text-[10px] text-[#64748B] truncate">{order.restaurant_address}</p>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-2xl border border-[#D7E5E8]">
                        <span className="text-[9px] font-bold uppercase text-emerald-700 block mb-0.5">📍 Customer Drop</span>
                        <p className="font-bold text-[#1F2937] text-xs truncate">{order.customer_name}</p>
                        <p className="text-[10px] text-[#64748B] truncate">{order.delivery_address}</p>
                      </div>
                    </div>

                    {/* Order summary info */}
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                      <span>Payment: <strong className="text-[#1F2937]">{order.payment_method}</strong></span>
                      <span>Items: <strong className="text-[#1F2937]">{order.items?.length || 1}</strong></span>
                      <span>Placed: <strong className="text-[#1F2937]">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                    </div>

                    {/* Instant 1-Click Atomic Claim Button */}
                    <button
                      onClick={() => handleClaimOrder(order.id)}
                      disabled={claimingOrderId === order.id || availabilityStatus === 'OFFLINE'}
                      className={`w-full py-3.5 rounded-2xl font-bold text-xs text-white shadow-2xs transition-all flex items-center justify-center gap-2 ${availabilityStatus === 'OFFLINE'
                          ? 'bg-slate-200 text-[#94A3B8] cursor-not-allowed'
                          : 'bg-[#3A7D7C] hover:bg-[#2F6665] active:scale-[0.98]'
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
          <div className="bg-white rounded-3xl p-6 border-2 border-[#3A7D7C] shadow-md space-y-5">

            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#EAF4F7] text-[#3A7D7C] font-bold text-xs uppercase tracking-wider border border-[#D7E5E8]">
                  {activeDelivery.order_status.replace(/_/g, ' ')}
                </span>
                <span className="px-3 py-1 rounded-xl bg-slate-100 text-[#1F2937] font-mono font-bold text-sm border border-[#D7E5E8]">
                  #{getOrderLast5(activeDelivery.order_number)}
                </span>
                <span className="font-mono text-[#64748B] text-xs hidden sm:inline">
                  ({activeDelivery.order_number})
                </span>
              </div>
              <span className="text-xs font-bold text-[#1F2937] font-mono">₹{activeDelivery.total_amount}</span>
            </div>

            {/* Pickup Restaurant Info */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Pickup Location</span>
                <button
                  onClick={() => openGoogleNav(activeDelivery.restaurant_latitude, activeDelivery.restaurant_longitude, activeDelivery.restaurant_address)}
                  className="px-2.5 py-1 rounded-lg bg-white text-[#3A7D7C] hover:bg-[#EAF4F7] text-[11px] font-bold flex items-center gap-1 border border-[#D7E5E8] shadow-2xs"
                >
                  <Navigation className="w-3 h-3" /> Nav to Store ↗
                </button>
              </div>
              <p className="font-bold text-[#1F2937] text-sm">{activeDelivery.restaurant_name}</p>
              <p className="text-xs text-[#64748B] leading-relaxed">{activeDelivery.restaurant_address}</p>
            </div>

            {/* Customer Drop Location Info */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Customer Delivery Drop</span>
                <button
                  onClick={() => openGoogleNav(activeDelivery.customer_latitude, activeDelivery.customer_longitude, activeDelivery.delivery_address)}
                  className="px-2.5 py-1 rounded-lg bg-white text-[#3A7D7C] hover:bg-[#EAF4F7] text-[11px] font-bold flex items-center gap-1 border border-[#D7E5E8] shadow-2xs"
                >
                  <Navigation className="w-3 h-3" /> Nav to Customer ↗
                </button>
              </div>
              <p className="font-bold text-[#1F2937] text-sm">{activeDelivery.customer_name}</p>
              <p className="text-xs text-[#64748B] leading-relaxed">{activeDelivery.delivery_address}</p>
              {activeDelivery.delivery_landmark && (
                <p className="text-xs text-[#64748B]">Landmark: {activeDelivery.delivery_landmark}</p>
              )}
            </div>

            {/* COD Notice */}
            {activeDelivery.payment_method === 'COD' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <DollarSign className="w-4 h-4 text-amber-600" /> CASH TO COLLECT (COD)
                </span>
                <span className="font-bold text-sm">₹{activeDelivery.total_amount}</span>
              </div>
            )}

            {/* Map Preview */}
            <div className="h-44 rounded-2xl overflow-hidden border border-[#D7E5E8]">
              <OrderMap
                restaurantCoords={{ lat: parseFloat(activeDelivery.restaurant_latitude), lng: parseFloat(activeDelivery.restaurant_longitude) }}
                customerCoords={{ lat: parseFloat(activeDelivery.customer_latitude), lng: parseFloat(activeDelivery.customer_longitude) }}
                driverCoords={currentCoords}
                orderStatus={activeDelivery.order_status}
              />
            </div>

            {/* STATE MACHINE ACTION BUTTONS */}
            <div className="space-y-4 pt-2 border-t border-[#D7E5E8]">

              {/* 1. ASSIGNED_TO_DRIVER -> ACCEPT / DECLINE */}
              {activeDelivery.order_status === 'ASSIGNED_TO_DRIVER' && (
                <div className="flex gap-3">
                  <button
                    onClick={handleDeclineOrder}
                    className="flex-1 py-3.5 bg-rose-50 hover:bg-rose-100 rounded-2xl font-bold text-xs text-rose-700 border border-rose-200 transition-all shadow-2xs"
                  >
                    Decline
                  </button>
                  <button
                    onClick={handleAcceptOrder}
                    className="flex-2 py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] rounded-2xl font-bold text-xs text-white shadow-2xs flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Accept Delivery Assignment
                  </button>
                </div>
              )}

              {/* 2. PROGRESSIVE STEP: Food Picked Up from Store */}
              {['ACCEPTED', 'PENDING', 'SENT_TO_KITCHEN', 'PREPARING', 'READY_FOR_PICKUP', 'DRIVER_ACCEPTED'].includes(activeDelivery.order_status) && (
                <button
                  onClick={handlePickupOrder}
                  className="w-full py-3.5 bg-[#3A7D7C] hover:bg-[#2F6665] rounded-2xl font-bold text-xs text-white shadow-2xs flex items-center justify-center gap-2 transition-all"
                >
                  <Package className="w-4 h-4" /> 🛍️ Confirm Food Picked Up from Restaurant
                </button>
              )}

              {/* 3. PROGRESSIVE STEP: Start Out for Delivery */}
              {activeDelivery.order_status === 'PICKED_UP' && (
                <button
                  onClick={handleStartDelivery}
                  className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 rounded-2xl font-bold text-xs text-white shadow-2xs flex items-center justify-center gap-2 transition-all"
                >
                  <Navigation className="w-4 h-4" /> 🚀 Start Delivery Route (Out for Delivery)
                </button>
              )}

              {/* COD Payment Collection Toggle */}
              {activeDelivery.payment_method === 'COD' && (
                <label className="flex items-center gap-3 p-3.5 bg-amber-50 rounded-2xl border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCodCollected}
                    onChange={(e) => setIsCodCollected(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3A7D7C] border-[#D7E5E8] focus:ring-0"
                  />
                  <span className="text-xs font-bold text-amber-900">
                    💰 Cash Payment Collected (₹{activeDelivery.total_amount})
                  </span>
                </label>
              )}

              {/* 4. PROMINENT DELIVERED & TAKE NEXT ORDER BUTTON */}
              <div className="space-y-2">
                <button
                  onClick={handleDeliverOrder}
                  disabled={deliveringOrder}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                >
                  {deliveringOrder ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Saving & Marking Delivered...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      ✅ Mark as DELIVERED & Ready for Next Order 🎉
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setShowFailureModal(true)}
                    className="py-2 px-3 text-rose-700 hover:bg-rose-50 rounded-xl font-bold text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Report Delivery Issue
                  </button>
                  <span className="text-[10px] text-[#64748B] font-medium">
                    ⚡ Auto-syncs to Restaurant Admin
                  </span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* RIDER STATS & LINKS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Completed</span>
              <span className="font-bold text-[#1F2937] text-base">{completedOrders.length} Deliveries</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Total Assigned</span>
              <span className="font-bold text-[#1F2937] text-base">{allOrders.length} Orders</span>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => { logout(); navigate('/driver/login'); }}
            className="w-full py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl font-bold text-xs text-rose-700 flex items-center justify-center gap-2 transition-colors shadow-2xs"
          >
            <LogOut className="w-4 h-4" /> Sign Out Rider Duty
          </button>
        </div>

      </main>

      {/* MULTI-RESTAURANT APPLICATION MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 border border-[#D7E5E8] shadow-xl max-h-[85vh] overflow-y-auto space-y-5">

            <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EAF4F7] text-[#3A7D7C] flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F2937]">Partner with Restaurants</h3>
                  <p className="text-[11px] text-[#64748B]">Expand your delivery coverage across multiple stores</p>
                </div>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#64748B] hover:text-[#1F2937] flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Seamless Document Reuse Banner & Connect All */}
            <div className="p-4 bg-slate-50 border border-[#D7E5E8] rounded-2xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#3A7D7C] font-bold">
                  <Sparkles className="w-4 h-4" /> Instant Partner Connection
                </div>
                <button
                  onClick={handleConnectAllRestaurants}
                  disabled={connectingAll}
                  className="px-3 py-1.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-[11px] rounded-xl shadow-2xs flex items-center gap-1 transition-all"
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
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                As an active approved rider, you can connect with any restaurant instantly with 1-click and immediately start receiving live orders!
              </p>
            </div>

            {/* Restaurant List */}
            {loadingRestaurants ? (
              <div className="py-12 text-center text-[#64748B] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
                Loading available restaurants...
              </div>
            ) : availableRestaurants.length === 0 ? (
              <div className="py-8 text-center text-[#64748B] text-xs">
                No active restaurants accepting applications at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {availableRestaurants.map((rest) => (
                  <div
                    key={rest.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[#1F2937] text-xs truncate">{rest.name}</h4>
                        {rest.city && (
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#D7E5E8] text-[#64748B] text-[9px] font-bold">
                            {rest.city}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#64748B] truncate">{rest.address}</p>
                    </div>

                    {/* Status / Action */}
                    <div className="shrink-0">
                      {rest.isAssigned ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                          <Check className="w-3 h-3" /> Connected
                        </span>
                      ) : rest.applicationStatus === 'PENDING' || rest.applicationStatus === 'UNDER_REVIEW' ? (
                        <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      ) : rest.applicationStatus === 'REJECTED' ? (
                        <button
                          onClick={() => handleApplyToRestaurant(rest.id, rest.name)}
                          disabled={applyingRestId === rest.id}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-[#D7E5E8] text-[#3A7D7C] font-bold text-[10px] transition-all shadow-2xs"
                        >
                          {applyingRestId === rest.id ? 'Connecting...' : 'Reconnect'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApplyToRestaurant(rest.id, rest.name)}
                          disabled={applyingRestId === rest.id}
                          className="px-3.5 py-1.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-bold text-[10px] shadow-2xs transition-all flex items-center gap-1"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-[#D7E5E8] shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-[#1F2937] text-base">Report Delivery Issue</h3>
            </div>
            <p className="text-xs text-[#64748B]">
              Specify the reason why this delivery could not be completed. The restaurant admin will be notified to resolve operationally.
            </p>
            <form onSubmit={handleMarkFailedSubmit} className="space-y-4">
              <textarea
                required
                rows="3"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="e.g. Customer unavailable / Wrong address / Customer refused order"
                className="w-full bg-white border border-[#D7E5E8] rounded-xl p-3 text-[#1F2937] text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              ></textarea>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFailureModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-[#D7E5E8] text-[#1F2937] rounded-xl font-bold text-xs shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-2xs"
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
