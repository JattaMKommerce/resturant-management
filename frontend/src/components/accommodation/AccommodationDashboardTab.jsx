import React from 'react';
import { 
  BedDouble, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Wrench, 
  CreditCard, 
  ArrowUpRight, 
  Calendar, 
  Users, 
  Layers, 
  ArrowRight,
  TrendingUp,
  Activity,
  LogIn,
  LogOut,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AccommodationDashboardTab({
  dashboardData = {},
  selectedHotel = {},
  onNavigateTab
}) {
  const overview = dashboardData?.overview || {
    total_rooms: 0,
    occupied_rooms: 0,
    available_rooms: 0,
    reserved_rooms: 0,
    cleaning_rooms: 0,
    maintenance_rooms: 0
  };

  const todayOps = dashboardData?.today_operations || {
    today_checkins: 0,
    today_checkouts: 0
  };

  const attention = dashboardData?.attention_required || {
    cleaning_needed: [],
    maintenance_issues: [],
    pending_payments: [],
    overdue_checkouts: []
  };

  const upcomingActivities = dashboardData?.upcoming_activities || [];
  const recentActivities = dashboardData?.recent_activities || [];

  const totalUrgentCount = (attention.cleaning_needed?.length || 0) +
    (attention.maintenance_issues?.length || 0) +
    (attention.pending_payments?.length || 0) +
    (attention.overdue_checkouts?.length || 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* ═══════════════════════════════════════════════════════ */}
      {/* 1. PRIMARY ROOM OVERVIEW (EXACTLY 4 MAIN CARDS)        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Primary Room Inventory Overview
          </h2>
          <span className="text-xs font-bold text-[#006C70]">
            {selectedHotel.name || 'Selected Property'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CARD 1: TOTAL ROOMS */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Total Rooms</span>
              <div className="p-2 rounded-2xl bg-slate-100 text-slate-700">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {overview.total_rooms}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Configured property units
              </p>
            </div>
          </div>

          {/* CARD 2: OCCUPIED ROOMS */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Occupied Rooms</span>
              <div className="p-2 rounded-2xl bg-teal-50 text-[#006C70]">
                <BedDouble className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-[#006C70] tracking-tight">
                {overview.occupied_rooms}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                In-house guest stays
              </p>
            </div>
          </div>

          {/* CARD 3: AVAILABLE ROOMS */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Available Rooms</span>
              <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
                {overview.available_rooms}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Ready for check-in
              </p>
            </div>
          </div>

          {/* CARD 4: RESERVED ROOMS */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Reserved Rooms</span>
              <div className="p-2 rounded-2xl bg-purple-50 text-purple-700">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-purple-700 tracking-tight">
                {overview.reserved_rooms}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Upcoming bookings
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 2. TODAY'S OPERATIONS & SUMMARY METRICS                */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* TODAY'S CHECK-INS */}
        <div className="bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-white rounded-3xl p-6 border border-teal-200/70 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100/80 text-[#006C70] text-[10px] font-black uppercase tracking-wider">
              <LogIn className="w-3 h-3" />
              <span>Arrivals</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 pt-1">
              {todayOps.today_checkins} Stays
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Scheduled guest check-ins for today
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('checkin')}
            className="px-4 py-2.5 rounded-2xl bg-[#006C70] hover:bg-[#00585C] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <span>Open Check-in Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* TODAY'S CHECK-OUTS */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-3xl p-6 border border-amber-200/70 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/80 text-amber-800 text-[10px] font-black uppercase tracking-wider">
              <LogOut className="w-3 h-3" />
              <span>Departures</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 pt-1">
              {todayOps.today_checkouts} Stays
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Expected room departures & folio settlements
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('checkout')}
            className="px-4 py-2.5 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <span>Open Check-out Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 3. ATTENTION REQUIRED (ACTIVE OPERATIONAL ISSUES)       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-rose-50 text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900">
              Attention Required
            </h3>
            {totalUrgentCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                {totalUrgentCount} active issues
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                All clear
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Action items requiring staff resolution
          </span>
        </div>

        {totalUrgentCount === 0 ? (
          <div className="py-6 text-center text-xs font-medium text-slate-400 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>No urgent operational bottlenecks at this moment.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            
            {/* ITEM 1: HOUSEKEEPING NEEDED */}
            {attention.cleaning_needed?.length > 0 && (
              <div 
                onClick={() => onNavigateTab('housekeeping')}
                className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/60 transition-colors cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Cleaning Needed</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white text-amber-800 font-black text-[10px]">
                    {attention.cleaning_needed.length}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/80 leading-relaxed font-medium">
                  {attention.cleaning_needed.map(r => `Room ${r.room_number}`).join(', ')}
                </p>
                <div className="text-[10px] font-bold text-amber-900 flex items-center gap-1 group-hover:underline pt-1">
                  <span>Turnaround Station</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            )}

            {/* ITEM 2: MAINTENANCE ISSUES */}
            {attention.maintenance_issues?.length > 0 && (
              <div 
                onClick={() => onNavigateTab('maintenance')}
                className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 hover:bg-rose-100/60 transition-colors cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-rose-700" />
                    <span>Maintenance Lockout</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white text-rose-800 font-black text-[10px]">
                    {attention.maintenance_issues.length}
                  </span>
                </div>
                <p className="text-[11px] text-rose-800/80 leading-relaxed font-medium">
                  {attention.maintenance_issues.map(r => `Room ${r.room_number}`).join(', ')}
                </p>
                <div className="text-[10px] font-bold text-rose-900 flex items-center gap-1 group-hover:underline pt-1">
                  <span>View Work Orders</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            )}

            {/* ITEM 3: PENDING PAYMENTS */}
            {attention.pending_payments?.length > 0 && (
              <div 
                onClick={() => onNavigateTab('payments')}
                className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 hover:bg-purple-100/60 transition-colors cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-purple-700" />
                    <span>Unsettled Folios</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white text-purple-800 font-black text-[10px]">
                    {attention.pending_payments.length}
                  </span>
                </div>
                <p className="text-[11px] text-purple-800/80 leading-relaxed font-medium">
                  {attention.pending_payments.slice(0, 2).map(f => `Room ${f.room_number} (₹${f.balance})`).join(', ')}
                </p>
                <div className="text-[10px] font-bold text-purple-900 flex items-center gap-1 group-hover:underline pt-1">
                  <span>Settle Balance</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            )}

            {/* ITEM 4: OVERDUE CHECKOUTS */}
            {attention.overdue_checkouts?.length > 0 && (
              <div 
                onClick={() => onNavigateTab('checkout')}
                className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200/80 hover:bg-orange-100/60 transition-colors cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs font-bold text-orange-900">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-orange-700" />
                    <span>Overdue Departures</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white text-orange-800 font-black text-[10px]">
                    {attention.overdue_checkouts.length}
                  </span>
                </div>
                <p className="text-[11px] text-orange-800/80 leading-relaxed font-medium">
                  {attention.overdue_checkouts.map(f => `Room ${f.room_number}`).join(', ')}
                </p>
                <div className="text-[10px] font-bold text-orange-900 flex items-center gap-1 group-hover:underline pt-1">
                  <span>Extend / Check-out</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 4. UPCOMING ACTIVITY & RECENT ACTIVITY FEEDS           */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* UPCOMING ACTIVITY (7 COLS) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Upcoming Arrivals & Departures
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Next scheduled guest movements
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('bookings')}
              className="text-xs font-bold text-[#006C70] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {upcomingActivities.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center font-medium">
                No upcoming arrivals or departures scheduled.
              </p>
            ) : (
              upcomingActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl text-xs font-black shrink-0 ${
                      act.activity_type === 'Check-in'
                        ? 'bg-teal-100 text-[#006C70]'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {act.activity_type === 'Check-in' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {act.guest_name}
                        </h4>
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          act.booking_source === 'ONLINE'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            : 'bg-purple-50 text-purple-700 border border-purple-200/60'
                        }`}>
                          {act.booking_source}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Unit: <span className="font-bold text-slate-800">{act.room_number}</span> • {act.activity_type}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-[11px] font-bold text-slate-600">
                    <span className="flex items-center gap-1 justify-end text-slate-400 font-medium text-[10px]">
                      <Clock className="w-3 h-3" />
                      {new Date(act.activity_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT ACTIVITY LOG (5 COLS) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900">
              Recent Operational Events
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Live audit stream for {selectedHotel.name || 'property'}
            </p>
          </div>

          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center font-medium">
                No recent activity logged today.
              </p>
            ) : (
              recentActivities.map((event) => (
                <div key={event.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#006C70] mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800 font-semibold leading-snug">
                      {event.description}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
