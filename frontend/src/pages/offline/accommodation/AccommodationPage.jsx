import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
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
  Hotel
} from 'lucide-react';

export default function AccommodationPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subTab } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminOrManager = ['ADMIN', 'MANAGER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  // Determine initial active tab from route path or query param
  const resolveTab = () => {
    if (subTab) {
      if (subTab === 'check-in') return 'checkin';
      if (subTab === 'check-out') return 'checkout';
      return subTab;
    }
    const path = location.pathname;
    if (path.includes('/accommodation/hotels')) return 'hotels';
    if (path.includes('/accommodation/rooms')) return 'rooms';
    if (path.includes('/accommodation/guests')) return 'guests';
    if (path.includes('/accommodation/checkin') || path.includes('/accommodation/check-in')) return 'checkin';
    if (path.includes('/accommodation/checkout') || path.includes('/accommodation/check-out')) return 'checkout';
    if (path.includes('/accommodation/folios')) return 'folios';
    if (path.includes('/accommodation/housekeeping')) return 'housekeeping';
    if (path.includes('/accommodation/maintenance')) return 'maintenance';
    if (path.includes('/accommodation/dashboard')) return 'dashboard';
    return searchParams.get('tab') || 'hotels';
  };

  const [activeTab, setActiveTab] = useState(resolveTab);

  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    vacant: 0,
    occupied: 0,
    cleaning: 0,
    maintenance: 0,
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
  const [folioRoom, setFolioRoom] = useState(null);

  // Notification / Alert message
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync tab state when URL route param changes
  useEffect(() => {
    const current = resolveTab();
    if (current !== activeTab) {
      setActiveTab(current);
    }
  }, [subTab, location.pathname]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/admin/accommodation/${tabId}`);
  };

  // Fetch Rooms and Summary Stats
  const fetchAccommodationData = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true);
    setRefreshing(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedFloor && selectedFloor !== 'ALL') params.floor = selectedFloor;
      if (selectedStatus && selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedType && selectedType !== 'ALL') params.room_type = selectedType;

      const res = await api.get('/rooms', { params });
      const payload = res?.data || res;

      if (payload) {
        setRooms(payload.rooms || []);
        if (payload.stats) setStats(payload.stats);
        if (payload.floors) setFloors(payload.floors);
        if (payload.room_types) setRoomTypes(payload.room_types);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedFloor, selectedStatus, selectedType]);

  useEffect(() => {
    fetchAccommodationData(true);
  }, [fetchAccommodationData, refreshKey]);

  // Handle Quick Room Status Change
  const handleStatusChange = async (roomId, newStatus) => {
    try {
      const res = await api.patch(`/rooms/${roomId}/status`, { status: newStatus });
      showToast(`Room status updated to ${newStatus}`);
      fetchAccommodationData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update room status');
    }
  };

  // Handle Room Deletion
  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/rooms/${roomId}`);
      showToast('Room deleted successfully');
      fetchAccommodationData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete room');
    }
  };

  // Open Room Form for Add/Edit
  const handleOpenAddRoom = () => {
    setEditingRoom(null);
    setIsFormOpen(true);
  };

  const handleOpenEditRoom = (room) => {
    setEditingRoom(room);
    setIsFormOpen(true);
  };

  const handleRoomSaved = (savedRoom) => {
    setIsFormOpen(false);
    setEditingRoom(null);
    showToast(editingRoom ? 'Room updated successfully' : 'New room added successfully');
    fetchAccommodationData();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & MAIN NAVIGATION TABS */}
      <div className="bg-white rounded-3xl border border-[#D7E5E8] p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D7E5E8] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[#3A7D7C] text-white shadow-md shadow-[#3A7D7C]/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Hotel Accommodation & Room Management
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Live System
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Front desk check-in/out, 20 hotel specifications, guest folios, housekeeping, and room service.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdminOrManager && (
              <button
                onClick={handleOpenAddRoom}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-white text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Room</span>
              </button>
            )}

            <button
              onClick={() => {
                setRefreshKey(k => k + 1);
                fetchAccommodationData(true);
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#D7E5E8] text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#3A7D7C]' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 2. SUB-NAVIGATION TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-4 no-scrollbar">
          {[
            { id: 'hotels', label: '20 Hotels Catalog', icon: Hotel, badge: '20 Hotels' },
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'rooms', label: 'Rooms Grid', icon: BedDouble, count: stats.total },
            { id: 'guests', label: 'Guest Directory', icon: Users, count: stats.occupied },
            { id: 'checkin', label: 'Check-In Desk', icon: UserPlus, badge: stats.vacant ? `${stats.vacant} Ready` : null },
            { id: 'checkout', label: 'Check-Out Desk', icon: LogOut, badge: stats.occupied ? `${stats.occupied} In-House` : null },
            { id: 'folios', label: 'Room Folios', icon: Receipt },
            { id: 'housekeeping', label: 'Housekeeping', icon: Sparkles, badge: stats.cleaning > 0 ? `${stats.cleaning} Pending` : null },
            { id: 'maintenance', label: 'Maintenance', icon: Wrench, badge: stats.maintenance > 0 ? `${stats.maintenance} Out` : null }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#3A7D7C] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && !tab.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TOAST NOTIFICATION */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-200 ${
          toastMessage.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. TAB CONTENTS */}

      {/* TAB A: 20 HOTELS SPECIFICATION CATALOG */}
      {activeTab === 'hotels' && (
        <HotelsTab
          refreshKey={refreshKey}
          onSelectHotel={(h) => console.log('Selected hotel:', h)}
          onBookRoomClick={(hotel) => handleTabChange('checkin')}
        />
      )}

      {/* TAB B: DASHBOARD KPI OVERVIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Rooms</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                <span className="text-[10px] font-bold text-slate-500">100%</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Vacant Ready</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-600">{stats.vacant}</span>
                <span className="text-[10px] font-bold text-emerald-600/80">
                  {stats.total > 0 ? Math.round((stats.vacant / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Occupied Stays</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-blue-600">{stats.occupied}</span>
                <span className="text-[10px] font-bold text-blue-600/80">
                  {stats.occupancy_rate}% Occ.
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Turnaround / Clean</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-amber-600">{stats.cleaning}</span>
                <span className="text-[10px] font-bold text-amber-600/80">Housekeeping</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">Maintenance</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-rose-600">{stats.maintenance}</span>
                <span className="text-[10px] font-bold text-rose-600/80">Out of Order</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">Folio Balance</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-lg font-black text-purple-700">₹{stats.total_balance.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-purple-600">Receivable</span>
              </div>
            </div>
          </div>

          {/* QUICK SHORTCUTS & FLOOR OVERVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Quick Actions */}
            <div className="bg-white p-5 rounded-3xl border border-[#D7E5E8] shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-slate-900">Front Desk Quick Actions</h3>
              <div className="space-y-2.5">
                <button
                  onClick={() => handleTabChange('checkin')}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 hover:bg-emerald-100/70 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-600 text-white">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-950 block">Express Guest Check-In</span>
                      <span className="text-[10px] text-emerald-700">Assign room & setup breakfast package</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => handleTabChange('checkout')}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 hover:bg-blue-100/70 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-600 text-white">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-blue-950 block">Guest Check-Out Desk</span>
                      <span className="text-[10px] text-blue-700">Settle balance & auto-mark cleaning</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-blue-700 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => handleTabChange('housekeeping')}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 hover:bg-amber-100/70 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500 text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-amber-950 block">Housekeeping Turnover</span>
                      <span className="text-[10px] text-amber-700">{stats.cleaning} room(s) pending sanitization</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

            {/* Right: Room Occupancy Status Summary */}
            <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-[#D7E5E8] shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Current In-House Stays & Room Status</h3>
                <button
                  onClick={() => handleTabChange('rooms')}
                  className="text-xs font-bold text-[#3A7D7C] hover:underline"
                >
                  View All Rooms ({rooms.length}) →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {rooms.slice(0, 8).map((room) => {
                  const isOccupied = room.status === 'OCCUPIED';
                  const isCleaning = room.status === 'CLEANING';
                  const isMaint = room.status === 'MAINTENANCE';
                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        setSelectedRoomDetails(room);
                      }}
                      className={`p-3 rounded-2xl border text-xs cursor-pointer hover:shadow-xs transition-all ${
                        isOccupied
                          ? 'bg-blue-50/60 border-blue-200 text-blue-900'
                          : isCleaning
                          ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                          : isMaint
                          ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                          : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm">Room {room.room_number}</span>
                        <span className="text-[10px] font-bold uppercase">{room.status}</span>
                      </div>
                      <div className="text-[11px] opacity-80 mt-1 truncate">
                        {isOccupied ? (room.guest_name || 'In-House') : room.room_type}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB C: ROOMS MANAGEMENT GRID */}
      {activeTab === 'rooms' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* FILTERS */}
          <div className="bg-white p-4 rounded-2xl border border-[#D7E5E8] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2 max-w-md bg-slate-50 border border-[#D7E5E8] rounded-xl px-3 py-2 text-xs">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search rooms by number, floor, type, guest..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent outline-hidden text-slate-800 placeholder:text-slate-400 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="VACANT">Vacant Ready ({stats.vacant})</option>
                <option value="OCCUPIED">Occupied ({stats.occupied})</option>
                <option value="CLEANING">Cleaning ({stats.cleaning})</option>
                <option value="MAINTENANCE">Maintenance ({stats.maintenance})</option>
              </select>

              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-[#D7E5E8] rounded-xl font-medium text-slate-700"
              >
                <option value="">All Floors</option>
                {floors.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {(search || selectedFloor || selectedStatus) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedFloor('');
                    setSelectedStatus('');
                  }}
                  className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ROOMS GRID */}
          {loading ? (
            <div className="py-24 text-center bg-white rounded-3xl border border-[#D7E5E8]">
              <div className="w-8 h-8 border-3 border-[#3A7D7C] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-slate-500 font-semibold">Loading rooms from database...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-[#D7E5E8] space-y-3">
              <BedDouble className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">No Rooms Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No rooms match the selected filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onViewDetails={() => setSelectedRoomDetails(room)}
                  onEdit={() => handleOpenEditRoom(room)}
                  onDelete={() => handleDeleteRoom(room.id)}
                  onStatusChange={(status) => handleStatusChange(room.id, status)}
                  onCheckIn={() => setCheckInRoom(room)}
                  onViewFolio={() => setFolioRoom(room)}
                  canManage={isAdminOrManager}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB D: GUEST DIRECTORY */}
      {activeTab === 'guests' && (
        <GuestManagementTab
          onViewFolio={(room) => setFolioRoom(room)}
          onCheckOutClick={(room) => handleTabChange('checkout')}
          refreshKey={refreshKey}
        />
      )}

      {/* TAB E: CHECK-IN DESK */}
      {activeTab === 'checkin' && (
        <CheckInDeskTab
          rooms={rooms}
          onCheckInSuccess={() => {
            showToast('Guest checked in successfully!');
            fetchAccommodationData();
            handleTabChange('rooms');
          }}
          onRefresh={() => fetchAccommodationData()}
        />
      )}

      {/* TAB F: CHECK-OUT DESK */}
      {activeTab === 'checkout' && (
        <CheckOutDeskTab
          rooms={rooms}
          onCheckOutSuccess={() => {
            showToast('Guest checked out successfully! Room marked for Housekeeping.');
            fetchAccommodationData();
            handleTabChange('housekeeping');
          }}
          onRefresh={() => fetchAccommodationData()}
        />
      )}

      {/* TAB G: ROOM FOLIOS */}
      {activeTab === 'folios' && (
        <FoliosTab
          refreshKey={refreshKey}
          onRefresh={() => fetchAccommodationData()}
        />
      )}

      {/* TAB H: HOUSEKEEPING TAB */}
      {activeTab === 'housekeeping' && (
        <HousekeepingTab
          rooms={rooms}
          onRoomUpdated={() => fetchAccommodationData()}
          onRefresh={() => fetchAccommodationData()}
        />
      )}

      {/* TAB I: MAINTENANCE TAB */}
      {activeTab === 'maintenance' && (
        <MaintenanceTab
          rooms={rooms}
          onRoomUpdated={() => fetchAccommodationData()}
          onRefresh={() => fetchAccommodationData()}
        />
      )}

      {/* 5. MODALS */}
      {selectedRoomDetails && (
        <RoomDetailsModal
          isOpen={true}
          onClose={() => setSelectedRoomDetails(null)}
          roomId={selectedRoomDetails.id}
          onCheckIn={() => {
            setCheckInRoom(selectedRoomDetails);
            setSelectedRoomDetails(null);
          }}
          onViewFolio={() => {
            setFolioRoom(selectedRoomDetails);
            setSelectedRoomDetails(null);
          }}
          onEdit={() => {
            handleOpenEditRoom(selectedRoomDetails);
            setSelectedRoomDetails(null);
          }}
        />
      )}

      {isFormOpen && (
        <RoomFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          room={editingRoom}
          onSaved={handleRoomSaved}
          floors={floors}
          roomTypes={roomTypes}
        />
      )}

      {checkInRoom && (
        <CheckInModal
          isOpen={true}
          onClose={() => setCheckInRoom(null)}
          room={checkInRoom}
          onSuccess={() => {
            setCheckInRoom(null);
            showToast(`Guest checked into Room ${checkInRoom.room_number}`);
            fetchAccommodationData();
          }}
        />
      )}

      {folioRoom && (
        <FolioModal
          isOpen={true}
          onClose={() => setFolioRoom(null)}
          roomId={folioRoom.id}
          onFolioUpdated={() => fetchAccommodationData()}
        />
      )}
    </div>
  );
}
