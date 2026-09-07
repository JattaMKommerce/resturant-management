import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  BedDouble,
  User,
  Phone,
  Mail,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Globe,
  Shield,
  Upload,
  Coffee,
  Sparkles,
  Plane,
  FileCheck
} from 'lucide-react';
import api from '../../services/api';

export default function CheckInDeskTab({
  rooms = [],
  bookings = [],
  selectedHotelId = 1,
  selectedHotelName = 'The Grand Palace',
  onCheckInSubmit,
  onCancel
}) {
  const vacantRooms = rooms.filter(r => r.status === 'VACANT' || r.status === 'RESERVED');
  const confirmedBookings = bookings.filter(b => b.booking_status === 'CONFIRMED');

  const [selectedRoomId, setSelectedRoomId] = useState(vacantRooms[0]?.id || '');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  
  // Common details
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [numGuests, setNumGuests] = useState(2);
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedCheckOut, setExpectedCheckOut] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );
  const [breakfastIncluded, setBreakfastIncluded] = useState(false);
  const [notes, setNotes] = useState('');

  // Guest Origin: DOMESTIC vs INTERNATIONAL
  const [guestType, setGuestType] = useState('DOMESTIC');

  // Domestic Specific Fields
  const [domesticIdType, setDomesticIdType] = useState('Aadhaar Card');
  const [domesticIdNumber, setDomesticIdNumber] = useState('');
  const [idFileUploaded, setIdFileUploaded] = useState(false);

  // International Specific Fields
  const [nationality, setNationality] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportCountry, setPassportCountry] = useState('');
  const [passportIssueDate, setPassportIssueDate] = useState('');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');
  const [visaNumber, setVisaNumber] = useState('');
  const [visaType, setVisaType] = useState('Tourist eVisa');
  const [visaIssueDate, setVisaIssueDate] = useState('');
  const [visaExpiryDate, setVisaExpiryDate] = useState('');
  const [arrivalDateIndia, setArrivalDateIndia] = useState('');
  const [arrivalPlaceIndia, setArrivalPlaceIndia] = useState('Kempegowda Int. Airport, Bengaluru');
  const [passportFileUploaded, setPassportFileUploaded] = useState(false);
  const [visaFileUploaded, setVisaFileUploaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const selectedRoom = rooms.find(r => String(r.id) === String(selectedRoomId));

  // Handle pre-filling from an existing booking
  const handlePreFillBooking = (bId) => {
    setSelectedBookingId(bId);
    if (!bId) return;

    const b = bookings.find(item => String(item.id) === String(bId));
    if (b) {
      setGuestName(b.guest_name || '');
      setGuestPhone(b.guest_phone || '');
      setGuestEmail(b.guest_email || '');
      setGuestType(b.guest_type || 'DOMESTIC');
      if (b.room_id) setSelectedRoomId(b.room_id);
      if (b.check_in_date) setCheckInDate(b.check_in_date.split('T')[0]);
      if (b.check_out_date) setExpectedCheckOut(b.check_out_date.split('T')[0]);
      setNotes(b.special_requests || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoomId) {
      setError('Please select a vacant room to allocate.');
      return;
    }
    if (!guestName.trim()) {
      setError('Guest full name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Submit check-in
      const checkInPayload = {
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        guest_email: guestEmail.trim(),
        guest_type: guestType,
        expected_check_out: expectedCheckOut,
        breakfast_included: breakfastIncluded ? 1 : 0,
        notes: notes.trim(),
        hotel_id: selectedHotelId
      };

      await onCheckInSubmit(selectedRoomId, checkInPayload);

      // 2. Save identity documents
      const docPayload = {
        hotel_id: selectedHotelId,
        guest_name: guestName.trim(),
        guest_type: guestType,
        id_type: guestType === 'DOMESTIC' ? domesticIdType : null,
        id_number: guestType === 'DOMESTIC' ? domesticIdNumber : null,
        nationality: guestType === 'INTERNATIONAL' ? nationality : 'Indian',
        passport_number: guestType === 'INTERNATIONAL' ? passportNumber : null,
        passport_country: guestType === 'INTERNATIONAL' ? passportCountry : null,
        passport_issue_date: guestType === 'INTERNATIONAL' ? passportIssueDate : null,
        passport_expiry_date: guestType === 'INTERNATIONAL' ? passportExpiryDate : null,
        visa_number: guestType === 'INTERNATIONAL' ? visaNumber : null,
        visa_type: guestType === 'INTERNATIONAL' ? visaType : null,
        visa_issue_date: guestType === 'INTERNATIONAL' ? visaIssueDate : null,
        visa_expiry_date: guestType === 'INTERNATIONAL' ? visaExpiryDate : null,
        arrival_date_india: guestType === 'INTERNATIONAL' ? arrivalDateIndia : null,
        arrival_place_india: guestType === 'INTERNATIONAL' ? arrivalPlaceIndia : null
      };

      try {
        await api.post('/rooms/guest-document', docPayload);
      } catch (docErr) {
        console.warn('Document save notice:', docErr);
      }

      // If tied to booking, mark as CHECKED_IN
      if (selectedBookingId) {
        try {
          await api.put(`/rooms/bookings/${selectedBookingId}/status`, { booking_status: 'CHECKED_IN', room_id: selectedRoomId });
        } catch (bErr) {
          console.warn('Booking status sync notice:', bErr);
        }
      }

      setSuccessMsg(`Guest ${guestName} successfully checked into Room ${selectedRoom?.room_number || ''}!`);
      
      // Reset
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
      setDomesticIdNumber('');
      setPassportNumber('');
      setVisaNumber('');
      setNotes('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Check-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs animate-in fade-in duration-200">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#006C70] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Front Desk Guest Check-In
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Allocate room, register verified guest credentials, and open stay folio ({selectedHotelName})
            </p>
          </div>
        </div>

        {/* Pre-fill selector if bookings exist */}
        {confirmedBookings.length > 0 && (
          <div className="hidden sm:block">
            <select
              value={selectedBookingId}
              onChange={(e) => handlePreFillBooking(e.target.value)}
              className="text-xs font-bold text-[#006C70] bg-teal-50 border border-teal-200/80 rounded-xl px-3 py-2"
            >
              <option value="">⚡ Pre-fill from Confirmed Booking</option>
              {confirmedBookings.map(b => (
                <option key={b.id} value={b.id}>
                  {b.guest_name} (#{b.booking_number})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs font-sans">
        
        {/* SECTION 1: ROOM ALLOCATION & DATES */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            1. Room Allocation & Stay Duration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Available Room *</label>
              <select
                required
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-[#006C70]/20 focus:border-[#006C70]"
              >
                {vacantRooms.length === 0 ? (
                  <option value="">No vacant rooms available</option>
                ) : (
                  vacantRooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} — {r.room_type} (₹{parseFloat(r.rate_per_night).toLocaleString()}/nt)
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Check-in Date & Time</label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Expected Check-out Date</label>
              <input
                type="date"
                required
                value={expectedCheckOut}
                onChange={(e) => setExpectedCheckOut(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: GUEST PRIMARY DETAILS */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            2. Primary Guest Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Guest Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Jane Doe"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#006C70]/20 focus:border-[#006C70]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="guest@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: DOMESTIC VS INTERNATIONAL IDENTITY VERIFICATION */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              3. Guest Origin & Government ID Verification
            </h3>

            {/* Toggle Tabs */}
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setGuestType('DOMESTIC')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  guestType === 'DOMESTIC'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                🇮🇳 Domestic Guest (India)
              </button>
              <button
                type="button"
                onClick={() => setGuestType('INTERNATIONAL')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  guestType === 'INTERNATIONAL'
                    ? 'bg-[#006C70] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                🌍 International Guest
              </button>
            </div>
          </div>

          {/* 3A. DOMESTIC GUEST FIELDS */}
          {guestType === 'DOMESTIC' ? (
            <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Government ID Type</label>
                  <select
                    value={domesticIdType}
                    onChange={(e) => setDomesticIdType(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="Aadhaar Card">Aadhaar Card (12-digit)</option>
                    <option value="Passport (India)">Indian Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Election Voter ID</option>
                    <option value="PAN Card">PAN Card</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ID Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 4589-2311-8890"
                    value={domesticIdNumber}
                    onChange={(e) => setDomesticIdNumber(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* ID Proof Upload Simulator */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">ID Proof Upload / Scan Proof</label>
                <div 
                  onClick={() => setIdFileUploaded(!idFileUploaded)}
                  className={`p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex items-center justify-center gap-2 ${
                    idFileUploaded
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {idFileUploaded ? (
                    <>
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold">ID Scan Verified & Attached (Click to remove)</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span>Click to upload or scan guest ID proof photo / PDF</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 3B. INTERNATIONAL GUEST FIELDS (PASSPORT & VISA ONLY) */
            <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-200/80 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-indigo-900 font-bold border-b border-indigo-100 pb-2">
                <Plane className="w-4 h-4 text-indigo-600" />
                <span>Form-C / International Foreigner Registration Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nationality *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. British, French, American"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Passport Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. P8839210"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Passport Issuing Country</label>
                  <input
                    type="text"
                    placeholder="e.g. United Kingdom"
                    value={passportCountry}
                    onChange={(e) => setPassportCountry(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Passport Issue Date</label>
                  <input
                    type="date"
                    value={passportIssueDate}
                    onChange={(e) => setPassportIssueDate(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Passport Expiry Date</label>
                  <input
                    type="date"
                    value={passportExpiryDate}
                    onChange={(e) => setPassportExpiryDate(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Visa Number</label>
                  <input
                    type="text"
                    placeholder="e.g. IND-V-992384"
                    value={visaNumber}
                    onChange={(e) => setVisaNumber(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Visa Type</label>
                  <select
                    value={visaType}
                    onChange={(e) => setVisaType(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Tourist eVisa">Tourist eVisa</option>
                    <option value="Business Visa">Business Visa</option>
                    <option value="Conference Visa">Conference Visa</option>
                    <option value="Employment Visa">Employment Visa</option>
                    <option value="OCI / PIO Card">OCI / PIO Card</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Visa Issue Date</label>
                  <input
                    type="date"
                    value={visaIssueDate}
                    onChange={(e) => setVisaIssueDate(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Visa Expiry Date</label>
                  <input
                    type="date"
                    value={visaExpiryDate}
                    onChange={(e) => setVisaExpiryDate(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date of Arrival in India</label>
                  <input
                    type="date"
                    value={arrivalDateIndia}
                    onChange={(e) => setArrivalDateIndia(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Place / Port of Arrival in India</label>
                  <input
                    type="text"
                    placeholder="e.g. Kempegowda International Airport, Bengaluru"
                    value={arrivalPlaceIndia}
                    onChange={(e) => setArrivalPlaceIndia(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Uploads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div
                  onClick={() => setPassportFileUploaded(!passportFileUploaded)}
                  className={`p-3 rounded-xl border-2 border-dashed cursor-pointer text-center flex items-center justify-center gap-2 ${
                    passportFileUploaded
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {passportFileUploaded ? (
                    <>
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold">Passport Copy Attached</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span>Upload Passport Copy</span>
                    </>
                  )}
                </div>

                <div
                  onClick={() => setVisaFileUploaded(!visaFileUploaded)}
                  className={`p-3 rounded-xl border-2 border-dashed cursor-pointer text-center flex items-center justify-center gap-2 ${
                    visaFileUploaded
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {visaFileUploaded ? (
                    <>
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold">Visa Copy Attached</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span>Upload Visa Copy</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: PACKAGES & NOTES */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Include Buffet Breakfast Package</span>
                <span className="text-[11px] text-slate-500">Add daily hotel breakfast inclusion to guest stay folio</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={breakfastIncluded}
              onChange={(e) => setBreakfastIncluded(e.target.checked)}
              className="w-5 h-5 accent-[#006C70] rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Special Requests / Stay Notes</label>
            <textarea
              rows="2"
              placeholder="e.g. Non-smoking floor, early morning wake-up call, extra towels..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || vacantRooms.length === 0}
            className="px-7 py-3.5 rounded-2xl bg-[#006C70] hover:bg-[#00585C] text-white font-bold text-xs transition-all shadow-md shadow-[#006C70]/20 flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            <span>{loading ? 'Processing Check-In...' : 'Complete Check-In & Open Folio'}</span>
          </button>
        </div>

      </form>
    </div>
  );
}
