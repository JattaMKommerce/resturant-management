import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Shield,
  Cloud,
  Headphones,
  ShoppingBag,
  BookOpen,
  Receipt,
  UtensilsCrossed,
  Building,
  BedDouble,
  Users,
  CalendarCheck,
  FileText,
  Wrench
} from 'lucide-react';

export default function ProductSelectionPage() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(
    localStorage.getItem('hotel_product_mode') || 'RESTAURANT_ACCOMMODATION'
  );

  const handleSelectAndProceed = (mode) => {
    localStorage.setItem('hotel_product_mode', mode);
    setSelectedMode(mode);
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#1E293B] relative overflow-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans antialiased selection:bg-[#006C70] selection:text-white">
      
      {/* ═══════════════════════════════════════════════════════ */}
      {/* BACKGROUND LINE ART / SUBTLE AMBIENT ILLUSTRATIONS    */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 select-none">
        {/* Left: Subtle Restaurant Interior Line Art */}
        <svg
          className="absolute -left-12 top-1/4 w-[420px] lg:w-[540px] text-slate-300 stroke-current stroke-[0.8] fill-none"
          viewBox="0 0 500 500"
        >
          <path d="M 50 100 L 450 100" strokeDasharray="4 4" opacity="0.4" />
          <rect x="70" y="140" width="80" height="120" rx="4" opacity="0.5" />
          <line x1="110" y1="140" x2="110" y2="260" opacity="0.3" />
          <line x1="70" y1="200" x2="150" y2="200" opacity="0.3" />
          <ellipse cx="220" cy="380" rx="140" ry="40" />
          <path d="M 90 380 Q 90 480 120 500 L 320 500 Q 350 480 350 380" />
          <path d="M 60 300 Q 70 240 110 240 Q 130 240 135 300 L 135 440" />
          <path d="M 330 300 Q 340 240 380 240 Q 400 240 405 300 L 405 440" />
          <line x1="220" y1="0" x2="220" y2="120" />
          <path d="M 190 140 C 190 120 250 120 250 140 Z" />
        </svg>

        {/* Right: Subtle Hotel Architecture Line Art */}
        <svg
          className="absolute -right-16 top-16 w-[450px] lg:w-[580px] text-slate-300 stroke-current stroke-[0.8] fill-none"
          viewBox="0 0 500 500"
        >
          <rect x="150" y="80" width="280" height="380" rx="8" />
          <line x1="290" y1="80" x2="290" y2="460" opacity="0.4" />
          <rect x="180" y="120" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="235" y="120" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="310" y="120" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="365" y="120" width="35" height="45" rx="3" opacity="0.6" />

          <rect x="180" y="190" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="235" y="190" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="310" y="190" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="365" y="190" width="35" height="45" rx="3" opacity="0.6" />

          <rect x="180" y="260" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="235" y="260" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="310" y="260" width="35" height="45" rx="3" opacity="0.6" />
          <rect x="365" y="260" width="35" height="45" rx="3" opacity="0.6" />

          <rect x="240" y="55" width="100" height="25" rx="4" />
          <line x1="290" y1="55" x2="290" y2="40" />
          <path d="M 80 460 Q 95 320 120 220" strokeWidth="2.5" />
          <path d="M 120 220 Q 80 180 30 200" />
          <path d="M 120 220 Q 140 160 190 180" />
          <path d="M 120 220 Q 160 220 180 260" />
          <path d="M 120 220 Q 70 230 40 260" />
        </svg>

        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#006C70]/5 via-amber-100/10 to-transparent blur-3xl -z-10" />
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 1. TOP HEADER & TRUST PILL                             */}
      {/* ═══════════════════════════════════════════════════════ */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between pt-2 pb-6">
        <div className="w-28 hidden sm:block" />

        {/* Brand Center */}
        <div className="text-center mx-auto space-y-1">
          <div className="inline-flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[#C69238] drop-shadow-xs"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 18h16l-2-10-4 4-2-6-2 6-4-4-2 10z" fill="#C69238" fillOpacity="0.15" />
              <circle cx="12" cy="4" r="1.2" fill="#C69238" />
              <circle cx="4" cy="8" r="1.2" fill="#C69238" />
              <circle cx="20" cy="8" r="1.2" fill="#C69238" />
            </svg>
          </div>
          <h2 className="text-sm font-black tracking-[0.25em] text-[#1E293B] uppercase">
            THE GRAND PALACE
          </h2>
          <p className="text-[9px] font-bold tracking-[0.22em] text-[#64748B] uppercase">
            HOSPITALITY MANAGEMENT SUITE
          </p>
        </div>

        {/* Right: Secure & Trusted Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-slate-200/80 shadow-2xs text-[11px] font-semibold text-slate-600 backdrop-blur-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#006C70]" />
          <span>Secure & Trusted</span>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 2. MAIN HEADLINE                                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <main className="relative z-10 w-full max-w-5xl mx-auto my-auto space-y-8 py-2">
        <div className="text-center space-y-2.5">
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-[#0F172A] tracking-tight leading-tight">
            How would you like to manage <br className="hidden sm:inline" />
            <span className="text-[#006C70]">your business?</span>
          </h1>
          <p className="text-sm sm:text-[15px] font-medium text-slate-500 max-w-lg mx-auto">
            Choose the workspace that fits your operation.
          </p>
        </div>

        {/* ═════════════════════════════════════════════════════ */}
        {/* 3. PRODUCT CARDS (EXACT SAME PROPORTIONS & SIZES)     */}
        {/* ═════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch pt-2">

          {/* ─────────────────────────────────────────────────── */}
          {/* OPTION 1: RESTAURANT ONLY                           */}
          {/* ─────────────────────────────────────────────────── */}
          <div
            onClick={() => handleSelectAndProceed('RESTAURANT_ONLY')}
            className={`w-full h-full bg-white rounded-3xl p-6 sm:p-7 border transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:border-slate-300 group relative ${
              selectedMode === 'RESTAURANT_ONLY'
                ? 'border-[#006C70]/40 shadow-lg ring-2 ring-[#006C70]/10'
                : 'border-slate-200/90 shadow-md shadow-slate-200/50'
            }`}
          >
            <div className="space-y-6">
              {/* Restaurant Illustration (Identical h-44 container) */}
              <div className="relative h-44 w-full rounded-2xl bg-gradient-to-b from-amber-50/70 via-orange-50/30 to-white flex items-center justify-center overflow-hidden border border-amber-100/40">
                <div className="absolute w-32 h-32 rounded-full bg-amber-200/40 blur-xl" />

                <svg
                  className="w-36 h-36 relative z-10 drop-shadow-sm transition-transform duration-500 group-hover:scale-105"
                  viewBox="0 0 160 160"
                  fill="none"
                >
                  <line x1="80" y1="0" x2="80" y2="35" stroke="#94A3B8" strokeWidth="1.5" />
                  <path d="M 68 45 C 68 35 92 35 92 45 Z" fill="#F8FAFC" stroke="#64748B" strokeWidth="1.5" />
                  <ellipse cx="80" cy="45" rx="14" ry="4" fill="#FEF3C7" fillOpacity="0.8" />
                  <circle cx="80" cy="45" r="2.5" fill="#D97706" />

                  <rect x="36" y="70" width="16" height="28" rx="3" fill="#E2E8F0" stroke="#334155" strokeWidth="2.2" />
                  <line x1="40" y1="98" x2="36" y2="128" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="48" y1="98" x2="52" y2="128" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
                  <rect x="34" y="94" width="20" height="5" rx="2" fill="#CBD5E1" stroke="#334155" strokeWidth="1.5" />

                  <rect x="108" y="70" width="16" height="28" rx="3" fill="#E2E8F0" stroke="#334155" strokeWidth="2.2" />
                  <line x1="112" y1="98" x2="108" y2="128" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="120" y1="98" x2="124" y2="128" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
                  <rect x="106" y="94" width="20" height="5" rx="2" fill="#CBD5E1" stroke="#334155" strokeWidth="1.5" />

                  <ellipse cx="80" cy="98" rx="38" ry="7" fill="#F1F5F9" stroke="#334155" strokeWidth="2.5" />
                  <path d="M 52 98 L 48 135" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 108 98 L 112 135" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 80 102 L 80 135" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />

                  <path d="M 68 94 C 68 80 92 80 92 94 Z" fill="#F8FAFC" stroke="#334155" strokeWidth="2" />
                  <circle cx="80" cy="78" r="2.5" fill="#C69238" stroke="#334155" strokeWidth="1.5" />
                  <ellipse cx="80" cy="94" rx="14" ry="2" fill="#E2E8F0" stroke="#334155" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Title & Description */}
              <div className="text-center space-y-1.5">
                <h3 className="text-xl font-black text-slate-900">
                  Restaurant Only
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium px-2 min-h-[32px] flex items-center justify-center">
                  Everything you need to run your restaurant operations efficiently.
                </p>
              </div>

              {/* Feature Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200/80 shadow-2xs group-hover:border-amber-200/80 transition-colors">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700 truncate">Orders</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200/80 shadow-2xs group-hover:border-amber-200/80 transition-colors">
                  <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700 truncate">Menu</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200/80 shadow-2xs group-hover:border-amber-200/80 transition-colors">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700 truncate">KOT</span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200/80 shadow-2xs group-hover:border-amber-200/80 transition-colors">
                  <Receipt className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700 truncate">Billing</span>
                </div>
              </div>
            </div>

            {/* Bottom CTA Button */}
            <div className="pt-6 mt-6 border-t border-slate-100">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-xl bg-[#006C70] hover:bg-[#00585C] text-white text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
              >
                <span>Continue to Sign In</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────── */}
          {/* OPTION 2: RESTAURANT + ACCOMMODATION               */}
          {/* ─────────────────────────────────────────────────── */}
          <div
            onClick={() => handleSelectAndProceed('RESTAURANT_ACCOMMODATION')}
            className={`w-full h-full bg-gradient-to-b from-[#E6F4F5] via-[#F1F9FA] to-white rounded-3xl p-6 sm:p-7 border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-2xl group relative ${
              selectedMode === 'RESTAURANT_ACCOMMODATION'
                ? 'border-[#006C70] shadow-xl ring-4 ring-[#006C70]/10'
                : 'border-[#006C70]/60 shadow-lg shadow-[#006C70]/10 hover:border-[#006C70]'
            }`}
          >
            {/* Recommended Floating Badge */}
            <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-[#C69238] text-white text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
              <span>★</span>
              <span>RECOMMENDED</span>
            </div>

            <div className="space-y-6">
              {/* Hotel Illustration (Identical h-44 container) */}
              <div className="relative h-44 w-full rounded-2xl bg-gradient-to-b from-[#CCEBEB] via-[#E2F3F4] to-transparent flex items-center justify-center overflow-hidden border border-teal-200/50">
                <div className="absolute w-40 h-40 rounded-full bg-white/80 blur-md top-2" />

                <svg
                  className="w-64 h-36 relative z-10 drop-shadow-sm transition-transform duration-500 group-hover:scale-105"
                  viewBox="0 0 240 140"
                  fill="none"
                >
                  <line x1="10" y1="128" x2="230" y2="128" stroke="#334155" strokeWidth="2" strokeLinecap="round" />

                  <rect x="30" y="85" width="40" height="42" rx="3" fill="#649E9E" stroke="#334155" strokeWidth="2" />
                  <path d="M 28 85 Q 50 82 72 85 L 70 94 Q 50 90 30 94 Z" fill="#006C70" stroke="#334155" strokeWidth="1.5" />
                  <rect x="36" y="73" width="28" height="10" rx="2" fill="#E2F3F4" stroke="#334155" strokeWidth="1.2" />
                  <text x="50" y="80.5" fill="#006C70" fontSize="5.5" fontWeight="bold" textAnchor="middle">HOTEL</text>
                  <rect x="42" y="102" width="16" height="25" rx="2" fill="#F8FAFC" stroke="#334155" strokeWidth="1.5" />

                  <rect x="75" y="42" width="90" height="85" rx="4" fill="#508F90" stroke="#334155" strokeWidth="2.2" />

                  <rect x="100" y="26" width="40" height="14" rx="2" fill="#004D50" stroke="#334155" strokeWidth="1.8" />
                  <text x="120" y="36" fill="#FFFFFF" fontSize="7" fontWeight="900" textAnchor="middle" letterSpacing="0.5">HOTEL</text>

                  <rect x="85" y="52" width="14" height="14" rx="2" fill="#FEF3C7" stroke="#334155" strokeWidth="1.5" />
                  <rect x="113" y="52" width="14" height="14" rx="2" fill="#FEF3C7" stroke="#334155" strokeWidth="1.5" />
                  <rect x="141" y="52" width="14" height="14" rx="2" fill="#FEF3C7" stroke="#334155" strokeWidth="1.5" />

                  <rect x="85" y="74" width="14" height="14" rx="2" fill="#E2F3F4" stroke="#334155" strokeWidth="1.5" />
                  <rect x="113" y="74" width="14" height="14" rx="2" fill="#FEF3C7" stroke="#334155" strokeWidth="1.5" />
                  <rect x="141" y="74" width="14" height="14" rx="2" fill="#E2F3F4" stroke="#334155" strokeWidth="1.5" />

                  <path d="M 102 96 L 138 96 L 142 103 L 98 103 Z" fill="#C69238" stroke="#334155" strokeWidth="1.5" />
                  <path d="M 108 127 L 108 107 Q 120 101 132 107 L 132 127 Z" fill="#FEF3C7" stroke="#334155" strokeWidth="1.8" />
                  <line x1="120" y1="104" x2="120" y2="127" stroke="#334155" strokeWidth="1.2" />

                  <path d="M 188 128 Q 185 85 178 50" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 178 50 Q 150 35 140 48" stroke="#004D50" strokeWidth="2.5" fill="#508F90" />
                  <path d="M 178 50 Q 170 20 195 28" stroke="#004D50" strokeWidth="2.5" fill="#508F90" />
                  <path d="M 178 50 Q 205 38 215 58" stroke="#004D50" strokeWidth="2.5" fill="#508F90" />
                  <path d="M 178 50 Q 195 65 198 80" stroke="#004D50" strokeWidth="2.5" fill="#508F90" />
                  <path d="M 178 50 Q 155 65 152 75" stroke="#004D50" strokeWidth="2.5" fill="#508F90" />

                  <ellipse cx="18" cy="125" rx="8" ry="4" fill="#649E9E" stroke="#334155" strokeWidth="1.2" />
                  <ellipse cx="205" cy="125" rx="10" ry="4" fill="#649E9E" stroke="#334155" strokeWidth="1.2" />
                </svg>
              </div>

              {/* Title & Description */}
              <div className="text-center space-y-1.5">
                <h3 className="text-xl font-black text-slate-900">
                  Restaurant + Accommodation
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium px-2 min-h-[32px] flex items-center justify-center">
                  Manage your entire hospitality business from one powerful suite.
                </p>
              </div>

              {/* Feature Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-white/90 border border-teal-200/70 shadow-2xs">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-[#006C70] shrink-0" />
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">Restaurant</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-white/90 border border-teal-200/70 shadow-2xs">
                  <Building className="w-3.5 h-3.5 text-[#006C70] shrink-0" />
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">Hotels</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-white/90 border border-teal-200/70 shadow-2xs">
                  <BedDouble className="w-3.5 h-3.5 text-[#006C70] shrink-0" />
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">Rooms</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-white/90 border border-teal-200/70 shadow-2xs">
                  <Users className="w-3.5 h-3.5 text-[#006C70] shrink-0" />
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">Guests</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-white/90 border border-teal-200/70 shadow-2xs">
                  <CalendarCheck className="w-3.5 h-3.5 text-[#006C70] shrink-0" />
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">Check-in/out</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-white/90 border border-teal-200/70 shadow-2xs">
                  <FileText className="w-3.5 h-3.5 text-[#006C70] shrink-0" />
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">Folios</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-white/90 border border-teal-200/70 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-[#006C70] shrink-0" />
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">Cleaning</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-white/90 border border-teal-200/70 shadow-2xs">
                  <Wrench className="w-3.5 h-3.5 text-[#006C70] shrink-0" />
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">Service</span>
                </div>
              </div>
            </div>

            {/* Bottom CTA Button */}
            <div className="pt-6 mt-6 border-t border-teal-200/40">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-xl bg-[#006C70] hover:bg-[#00585C] text-white text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-[#006C70]/20 active:scale-[0.98]"
              >
                <span>Enter Hospitality Suite</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 4. BOTTOM TRUST & INFORMATION STRIP                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto pt-6">
        <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-2xs backdrop-blur-xs flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#006C70]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                You'll be able to sign in after selecting your workspace.
              </p>
              <p className="text-[11px] text-slate-500">
                Your choice helps us personalize your experience.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 sm:gap-7 text-left shrink-0">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#006C70] shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-800 block leading-tight">Secure</span>
                <span className="text-[10px] text-slate-500">Enterprise grade security</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#006C70] shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-800 block leading-tight">Reliable</span>
                <span className="text-[10px] text-slate-500">99.9% uptime guarantee</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-[#006C70] shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-800 block leading-tight">Support</span>
                <span className="text-[10px] text-slate-500">24/7 customer support</span>
              </div>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
