import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bike, Power, MapPin, Phone, CheckCircle2, Navigation, AlertTriangle,
  Package, Clock, RefreshCw, LogOut, Shield, DollarSign, User, ListOrdered,
  Store, Plus, ArrowRight, Check, Sparkles, Building2, Zap, AlertCircle,
  ShieldCheck, FileText
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

  // Upload KYC Documents State
  const [showUploadDocsModal, setShowUploadDocsModal] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [licensePreview, setLicensePreview] = useState(null);
  const [aadhaarPreview, setAadhaarPreview] = useState(null);
  const [licenseNumberInput, setLicenseNumberInput] = useState('');
  const [vehicleNumberInput, setVehicleNumberInput] = useState('');
  const [emergencyContactInput, setEmergencyContactInput] = useState('');
  const [docsFormError, setDocsFormError] = useState('');
  const [docsFormSuccess, setDocsFormSuccess] = useState('');

  const openUploadModal = () => {
    setSelfiePreview(driver?.selfie_url || null);
    setLicensePreview(driver?.license_url || null);
    setAadhaarPreview(driver?.aadhaar_url || null);
    setLicenseNumberInput(driver?.license_number || '');
    setVehicleNumberInput(driver?.vehicle_number || '');
    setEmergencyContactInput(driver?.emergency_contact || '');
    setDocsFormError('');
    setDocsFormSuccess('');
    setShowUploadDocsModal(true);
  };

  const handleFileChange = (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUploadDocuments = async (e) => {
    e.preventDefault();
    setUploadingDocs(true);
    setDocsFormError('');
    setDocsFormSuccess('');

    try {
      const res = await api.put('/driver/profile/documents', {
        selfie: selfiePreview || undefined,
        license: licensePreview || undefined,
        aadhaar: aadhaarPreview || undefined,
        license_number: licenseNumberInput || undefined,
        vehicle_number: vehicleNumberInput || undefined,
        emergency_contact: emergencyContactInput || undefined
      });

      if (res.data.success) {
        setDocsFormSuccess('🎉 Documents uploaded successfully!');
        setDriver(prev => ({
          ...prev,
          ...res.data.driver
        }));
        setTimeout(() => {
          setShowUploadDocsModal(false);
          setDocsFormSuccess('');
          fetchDriverDashboard();
        }, 1200);
      }
    } catch (err) {
      setDocsFormError(err.response?.data?.message || 'Failed to upload documents.');
    } finally {
      setUploadingDocs(false);
    }
  };

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

        {/* HIGHLIGHTED MISSING KYC DOCUMENTS ALERT BANNER */}
        {(!driver?.kyc_status || driver?.kyc_status !== 'VERIFIED' || (driver?.missing_documents && driver?.missing_documents.length > 0)) && (
          <div className="bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-amber-500/10 border-2 border-amber-400/80 rounded-3xl p-5 shadow-lg shadow-amber-500/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-900 tracking-tight flex items-center gap-2">
                    ⚠️ Action Required: Upload Your Verification Documents
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Please upload your profile photo and KYC documents to ensure your account is fully verified.
                  </p>
                </div>
              </div>

              <button
                onClick={openUploadModal}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/25 transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" /> Upload Photos & Docs
              </button>
            </div>

            {/* Missing document tags */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Required Items:</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                driver?.has_selfie ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {driver?.has_selfie ? '✓ Photo Uploaded' : '❌ Profile Photo / Selfie'}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                driver?.has_license ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {driver?.has_license ? '✓ Driving License Uploaded' : '❌ Driving License Photo'}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                driver?.has_aadhaar ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {driver?.has_aadhaar ? '✓ Aadhaar / ID Uploaded' : '❌ Aadhaar Card Photo'}
              </span>
            </div>
          </div>
        )}

        {/* RIDER DELIVERY SCORECARD */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Today</span>
            <span className="font-black text-slate-900 text-xl block mt-1">{driver?.today_delivered_count || 0}</span>
            <span className="text-[10px] text-blue-600 font-bold block">Delivered</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">All-Time</span>
            <span className="font-black text-slate-900 text-xl block mt-1">{driver?.delivered_orders_count || 0}</span>
            <span className="text-[10px] text-teal-600 font-bold block">Completed</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-xs text-center flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">KYC Status</span>
            <div>
              <span className={`font-black text-[10px] px-2 py-1 rounded-full inline-block uppercase tracking-wider ${
                driver?.kyc_status === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }`}>
                {driver?.kyc_status === 'VERIFIED' ? 'Verified' : 'Pending'}
              </span>
            </div>
            <button 
              onClick={openUploadModal}
              className="text-[10px] font-bold text-[#3A7D7C] hover:underline cursor-pointer"
            >
              Update Docs
            </button>
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

      {/* UPLOAD KYC DOCUMENTS MODAL */}
      {showUploadDocsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-[#D7E5E8] shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-[#D7E5E8] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1F2937]">Upload KYC & Profile Photo</h3>
                  <p className="text-[11px] text-[#64748B]">Verify your identity for delivery duty</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadDocsModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#64748B] flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {docsFormSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {docsFormSuccess}
              </div>
            )}

            {docsFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {docsFormError}
              </div>
            )}

            <form onSubmit={handleUploadDocuments} className="space-y-4 text-xs">
              
              {/* 1. Profile Photo / Selfie */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-[#D7E5E8] space-y-2">
                <label className="block font-black text-slate-800">
                  1. Profile Photo / Selfie *
                </label>
                <div className="flex items-center gap-3">
                  {selfiePreview ? (
                    <img 
                      src={selfiePreview} 
                      alt="Selfie Preview" 
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => handleFileChange(e, setSelfiePreview)}
                      className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#3A7D7C] file:text-white hover:file:bg-[#2F6665] cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 block mt-1">Take a clear front-facing selfie</span>
                  </div>
                </div>
              </div>

              {/* 2. Driving License */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-[#D7E5E8] space-y-2">
                <label className="block font-black text-slate-800">
                  2. Driving License Photo *
                </label>
                <div className="flex items-center gap-3">
                  {licensePreview ? (
                    <img 
                      src={licensePreview} 
                      alt="License Preview" 
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setLicensePreview)}
                      className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#3A7D7C] file:text-white hover:file:bg-[#2F6665] cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 block mt-1">Photo of physical driving license</span>
                  </div>
                </div>
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="License Number (e.g. DL-0420110012345)"
                    value={licenseNumberInput}
                    onChange={(e) => setLicenseNumberInput(e.target.value.toUpperCase())}
                    className="w-full p-2 bg-white border border-[#D7E5E8] rounded-xl font-semibold text-slate-800 text-xs"
                  />
                </div>
              </div>

              {/* 3. Aadhaar Card */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-[#D7E5E8] space-y-2">
                <label className="block font-black text-slate-800">
                  3. Aadhaar Card / ID Proof *
                </label>
                <div className="flex items-center gap-3">
                  {aadhaarPreview ? (
                    <img 
                      src={aadhaarPreview} 
                      alt="Aadhaar Preview" 
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                      <Shield className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setAadhaarPreview)}
                      className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#3A7D7C] file:text-white hover:file:bg-[#2F6665] cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 block mt-1">Photo of Aadhaar or Government ID</span>
                  </div>
                </div>
              </div>

              {/* Plate and Emergency Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vehicle Plate #</label>
                  <input
                    type="text"
                    placeholder="e.g. GA-01-AB-1234"
                    value={vehicleNumberInput}
                    onChange={(e) => setVehicleNumberInput(e.target.value.toUpperCase())}
                    className="w-full p-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-semibold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Emergency Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={emergencyContactInput}
                    onChange={(e) => setEmergencyContactInput(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-semibold text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D7E5E8]">
                <button
                  type="button"
                  onClick={() => setShowUploadDocsModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingDocs}
                  className="px-5 py-2 bg-[#3A7D7C] hover:bg-[#2F6665] text-white font-black rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploadingDocs ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Submit Documents
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
