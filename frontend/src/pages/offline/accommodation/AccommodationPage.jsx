import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import AccommodationHeader from '../../../components/accommodation/AccommodationHeader';
import AccommodationDashboardTab from '../../../components/accommodation/AccommodationDashboardTab';
import BookingsTab from '../../../components/accommodation/BookingsTab';
import RoomCard from '../../../components/accommodation/RoomCard';
import RoomDetailsModal from '../../../components/accommodation/RoomDetailsModal';
import RoomFormModal from '../../../components/accommodation/RoomFormModal';
import CheckInModal from '../../../components/accommodation/CheckInModal';
import FolioModal from '../../../components/accommodation/FolioModal';
import HotelsTab from '../../../components/accommodation/HotelsTab';
import GuestManagementTab from '../../../components/accommodation/GuestManagementTab';
import CheckInDeskTab from '../../../components/accommodation/CheckInDeskTab';
import CheckOutDeskTab from '../../../components/accommodation/CheckOutDeskTab';
import FoliosTab from '../../../components/accommodation/FoliosTab';
import HousekeepingTab from '../../../components/accommodation/HousekeepingTab';
import MaintenanceTab from '../../../components/accommodation/MaintenanceTab';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  BedDouble, 
  Users, 
  Sparkles, 
  Wrench, 
  CheckCircle2, 
  Layers, 
  Receipt,
  X,
  SlidersHorizontal,
  Home,
  Check,
  LayoutDashboard,
  UserCheck,
  UserPlus,
  LogOut,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Coffee,
  Hotel,
  Calendar
} from 'lucide-react';

export default function AccommodationPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subTab } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminOrManager = ['ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  // 1. Hotel selection state (persisted)
  const [hotels, setHotels] = useState([]);
  const [selectedHotelId, setSelectedHotelId] = useState(() => {
    return parseInt(localStorage.getItem('accommodation_selected_hotel_id') || '1', 10);
  });

  const handleSelectHotel = (hotelId) => {
    setSelectedHotelId(hotelId);
    localStorage.setItem('accommodation_selected_hotel_id', hotelId.toString());
  };

  // Determine active tab from route path or query param
  const resolveTab = () => {
    if (subTab) {
      if (subTab === 'checkin-checkout' || subTab === 'check-in' || subTab === 'checkin') return 'checkin-checkout';
      if (subTab === 'payments-folios' || subTab === 'payments' || subTab === 'folios') return 'payments-folios';
      return subTab;
    }
    const path = location.pathname;
    if (path.includes('/accommodation/hotels')) return 'hotels';
    if (path.includes('/accommodation/rooms')) return 'rooms';
    if (path.includes('/accommodation/bookings')) return 'bookings';
    if (path.includes('/accommodation/guests')) return 'guests';
    if (path.includes('/accommodation/checkin-checkout') || path.includes('/accommodation/checkin') || path.includes('/accommodation/checkout')) return 'checkin-checkout';
    if (path.includes('/accommodation/payments-folios') || path.includes('/accommodation/payments') || path.includes('/accommodation/folios')) return 'payments-folios';
    if (path.includes('/accommodation/housekeeping')) return 'housekeeping';
    if (path.includes('/accommodation/maintenance')) return 'maintenance';
    if (path.includes('/accommodation/dashboard')) return 'dashboard';
    return searchParams.get('tab') || 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(resolveTab);

  useEffect(() => {
    setActiveTab(resolveTab());
  }, [subTab, location.pathname]);

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [dashboardData, setDashboardData] = useState({});
  const [stats, setStats] = useState({
    total: 0,
    vacant: 0,
    occupied: 0,
    cleaning: 0,
    maintenance: 0,
    reserved: 0,
    total_balance: 0,
    occupancy_rate: 0
  });
  const [floors, setFloors] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters for Rooms view
  const [search, setSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState(searchParams.get('floor') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');

  // Modals state
  const [selectedRoomDetails, setSelectedRoomDetails] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [checkInRoom, setCheckInRoom] = useState(null);
  const [folioRoomId, setFolioRoomId] = useState(null);

  // Internal desk toggle for Check-in / Check-out tab
  const [deskSubMode, setDeskSubMode] = useState('CHECK_IN'); // 'CHECK_IN' | 'CHECK_OUT'

  // Fetch all hotels
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const res = await api.get('/hotels');
        if (res.data?.success) {
          setHotels(res.data.data || []);
        }
      } catch (err) {
        console.warn('Hotels load notice:', err);
      }
    };
    fetchHotels();
  }, []);

  const selectedHotel = hotels.find(h => Number(h.id) === Number(selectedHotelId)) || hotels[0] || {
    id: 1,
    name: 'The Grand Palace Heritage & Spa',
    city: 'Bengaluru',
    rating: 4.9
  };

  // Main Data Fetcher scoped by selectedHotelId
  const fetchData = useCallback(async () => {
    try {
      // 1. Dashboard summary
      const dashRes = await api.get(`/rooms/dashboard?hotel_id=${selectedHotelId}`);
      if (dashRes.data?.success) {
        setDashboardData(dashRes.data.data || {});
      }

      // 2. Aggregate stats
      const statsRes = await api.get(`/rooms/stats/summary?hotel_id=${selectedHotelId}`);
      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
      }

      // 3. Rooms inventory
      const roomsRes = await api.get(`/rooms?hotel_id=${selectedHotelId}`);
      if (roomsRes.data?.success) {
        const data = roomsRes.data.data || [];
        setRooms(data);
        
        // Extract unique floors & room types
        const uniqueFloors = [...new Set(data.map(r => r.floor).filter(Boolean))];
        const uniqueTypes = [...new Set(data.map(r => r.room_type).filter(Boolean))];
        setFloors(uniqueFloors);
        setRoomTypes(uniqueTypes);
      }

      // 4. Bookings
      const bookRes = await api.get(`/rooms/bookings?hotel_id=${selectedHotelId}`);
      if (bookRes.data?.success) {
        setBookings(bookRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch accommodation data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedHotelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey, selectedHotelId]);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/admin/accommodation/${tabId}`);
  };

  // ROOM ACTIONS
  const handleSaveRoom = async (formData) => {
    try {
      const payload = { ...formData, hotel_id: selectedHotelId };
      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.id}`, payload);
      } else {
        await api.post('/rooms', payload);
      }
      setIsFormOpen(false);
      setEditingRoom(null);
      handleRefresh();
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      setSelectedRoomDetails(null);
      handleRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete room.');
    }
  };

  const handleStatusUpdate = async (roomId, newStatus) => {
    try {
      await api.patch(`/rooms/${roomId}/status`, { status: newStatus });
      handleRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleCheckInSubmit = async (roomId, guestData) => {
    try {
      await api.post(`/rooms/${roomId}/check-in`, { ...guestData, hotel_id: selectedHotelId });
      setCheckInRoom(null);
      handleRefresh();
    } catch (err) {
      throw err;
    }
  };

  const handleCheckOut = async (roomId) => {
    try {
      await api.post(`/rooms/${roomId}/check-out`);
      handleRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Check-out failed.');
    }
  };

  // Filtered rooms for Rooms Tab
  const filteredRooms = rooms.filter(r => {
    const matchesSearch = 
      r.room_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.room_type?.toLowerCase().includes(search.toLowerCase()) ||
      r.guest_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.floor?.toLowerCase().includes(search.toLowerCase());

    const matchesFloor = !selectedFloor || r.floor === selectedFloor;
    const matchesStatus = !selectedStatus || r.status === selectedStatus;
    const matchesType = !selectedType || r.room_type === selectedType;

    return matchesSearch && matchesFloor && matchesStatus && matchesType;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* 1. GLOBAL ACCOMMODATION HEADER WITH HOTEL SELECTOR & NOTIFICATIONS */}
      <AccommodationHeader
        hotels={hotels}
        selectedHotelId={selectedHotelId}
        onSelectHotel={handleSelectHotel}
        title="Accommodation Management"
        subtitle={`Admin Operations • Property: ${selectedHotel.name || 'Selected Property'}`}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* 2. SUB-NAVIGATION TABS */}
        <div className="bg-white rounded-3xl p-1.5 border border-slate-200/80 shadow-2xs overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1 min-w-max">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'rooms', label: 'Rooms', icon: BedDouble },
              { id: 'bookings', label: 'Bookings', icon: Calendar },
              { id: 'guests', label: 'Guests', icon: Users },
              { id: 'checkin-checkout', label: 'Check-in / Check-out', icon: UserPlus },
              { id: 'housekeeping', label: 'Housekeeping', icon: Sparkles },
              { id: 'maintenance', label: 'Maintenance', icon: Wrench },
              { id: 'payments-folios', label: 'Payments & Folios', icon: Receipt },
              { id: 'hotels', label: 'Hotels Directory', icon: Hotel },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#006C70] text-white shadow-xs scale-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. DEDICATED TAB VIEWS */}
        
        {/* 3A. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <AccommodationDashboardTab
            dashboardData={dashboardData}
            selectedHotel={selectedHotel}
            onNavigateTab={handleTabChange}
          />
        )}

        {/* 3B. ROOMS TAB */}
        {activeTab === 'rooms' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Filter & Action Controls */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Room #, Type, Guest Name, Floor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#006C70]/20 focus:border-[#006C70]"
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 shadow-2xs"
                    title="Refresh Rooms"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>

                  {isAdminOrManager && (
                    <button
                      onClick={() => {
                        setEditingRoom(null);
                        setIsFormOpen(true);
                      }}
                      className="py-2.5 px-4 rounded-2xl bg-[#006C70] hover:bg-[#00585C] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Room</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status & Category Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Status:
                </span>
                {['', 'VACANT', 'OCCUPIED', 'RESERVED', 'CLEANING', 'CLEANING_IN_PROGRESS', 'MAINTENANCE', 'OUT_OF_ORDER'].map(st => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatus(st)}
                    className={`px-3 py-1 rounded-xl font-bold transition-all ${
                      selectedStatus === st
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === '' ? 'All Rooms' : st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Rooms Grid */}
            {filteredRooms.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 space-y-3">
                <BedDouble className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No Rooms Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No rooms match your filter criteria for {selectedHotel.name}.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredRooms.map(room => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onViewDetails={() => setSelectedRoomDetails(room)}
                    onCheckIn={() => setCheckInRoom(room)}
                    onCheckOut={() => handleCheckOut(room.id)}
                    onViewFolio={() => setFolioRoomId(room.id)}
                    onStatusChange={(status) => handleStatusUpdate(room.id, status)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3C. BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <BookingsTab
            bookings={bookings}
            rooms={rooms}
            selectedHotelId={selectedHotelId}
            selectedHotelName={selectedHotel.name}
            onRefresh={handleRefresh}
          />
        )}

        {/* 3D. GUEST MANAGEMENT TAB */}
        {activeTab === 'guests' && (
          <GuestManagementTab
            selectedHotelId={selectedHotelId}
            selectedHotelName={selectedHotel.name}
            onCheckInClick={() => handleTabChange('checkin-checkout')}
            onCheckOutClick={() => handleTabChange('checkin-checkout')}
            onViewFolioClick={(roomId) => setFolioRoomId(roomId)}
            refreshKey={refreshKey}
          />
        )}

        {/* 3E. CHECK-IN / CHECK-OUT OPERATIONAL DESK */}
        {activeTab === 'checkin-checkout' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Desk Toggle */}
            <div className="flex justify-center">
              <div className="inline-flex p-1.5 bg-slate-200/80 rounded-2xl shadow-inner text-xs font-black">
                <button
                  type="button"
                  onClick={() => setDeskSubMode('CHECK_IN')}
                  className={`px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                    deskSubMode === 'CHECK_IN'
                      ? 'bg-[#006C70] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Check-In Desk (Arrivals)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeskSubMode('CHECK_OUT')}
                  className={`px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                    deskSubMode === 'CHECK_OUT'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Check-Out Desk (Departures)</span>
                </button>
              </div>
            </div>

            {deskSubMode === 'CHECK_IN' ? (
              <CheckInDeskTab
                rooms={rooms}
                bookings={bookings}
                selectedHotelId={selectedHotelId}
                selectedHotelName={selectedHotel.name}
                onCheckInSubmit={handleCheckInSubmit}
              />
            ) : (
              <CheckOutDeskTab
                rooms={rooms}
                onCheckOutClick={(r) => handleCheckOut(r.id)}
                onViewFolioClick={(roomId) => setFolioRoomId(roomId)}
              />
            )}
          </div>
        )}

        {/* 3F. HOUSEKEEPING TAB */}
        {activeTab === 'housekeeping' && (
          <HousekeepingTab
            rooms={rooms}
            onCompleteCleaning={(roomId) => handleStatusUpdate(roomId, 'VACANT')}
            onStatusChange={(roomId, status) => handleStatusUpdate(roomId, status)}
          />
        )}

        {/* 3G. MAINTENANCE TAB */}
        {activeTab === 'maintenance' && (
          <MaintenanceTab
            rooms={rooms}
            onSetMaintenance={(roomId, notes) => handleStatusUpdate(roomId, 'MAINTENANCE')}
            onCompleteMaintenance={(roomId) => handleStatusUpdate(roomId, 'VACANT')}
          />
        )}

        {/* 3H. PAYMENTS & FOLIOS TAB */}
        {activeTab === 'payments-folios' && (
          <FoliosTab
            selectedHotelId={selectedHotelId}
            selectedHotelName={selectedHotel.name}
            onViewFolioClick={(roomId) => setFolioRoomId(roomId)}
            refreshKey={refreshKey}
          />
        )}

        {/* 3I. HOTELS DIRECTORY TAB */}
        {activeTab === 'hotels' && (
          <HotelsTab />
        )}

      </div>

      {/* 4. MODALS */}
      {selectedRoomDetails && (
        <RoomDetailsModal
          room={selectedRoomDetails}
          onClose={() => setSelectedRoomDetails(null)}
          onEdit={() => {
            setEditingRoom(selectedRoomDetails);
            setSelectedRoomDetails(null);
            setIsFormOpen(true);
          }}
          onDelete={() => handleDeleteRoom(selectedRoomDetails.id)}
          onCheckIn={() => {
            setCheckInRoom(selectedRoomDetails);
            setSelectedRoomDetails(null);
          }}
          onCheckOut={() => {
            handleCheckOut(selectedRoomDetails.id);
            setSelectedRoomDetails(null);
          }}
          onViewFolio={() => {
            setFolioRoomId(selectedRoomDetails.id);
            setSelectedRoomDetails(null);
          }}
        />
      )}

      {isFormOpen && (
        <RoomFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingRoom(null);
          }}
          onSave={handleSaveRoom}
          initialData={editingRoom}
        />
      )}

      {checkInRoom && (
        <CheckInModal
          isOpen={!!checkInRoom}
          onClose={() => setCheckInRoom(null)}
          room={checkInRoom}
          onCheckIn={(guestData) => handleCheckInSubmit(checkInRoom.id, guestData)}
        />
      )}

      {folioRoomId && (
        <FolioModal
          isOpen={!!folioRoomId}
          onClose={() => setFolioRoomId(null)}
          roomId={folioRoomId}
          onChargeAdded={handleRefresh}
          onSettled={handleRefresh}
        />
      )}

    </div>
  );
}
