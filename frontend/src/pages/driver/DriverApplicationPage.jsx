import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building, User, Camera, FileText, Bike, CheckCircle2, ChevronRight, ChevronLeft, 
  Upload, Shield, AlertCircle, ArrowLeft, ArrowRight, RefreshCw, Smartphone, MapPin,
  Lock, Eye, EyeOff, KeyRound
} from 'lucide-react';
import api from '../../api/axios';

export default function DriverApplicationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Form State
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    homeCity: 'Hubballi',
    currentCity: 'Bengaluru',
    currentAddress: '',
    emergencyContact: '',
    vehicleType: 'Bike',
    vehicleNumber: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Files State
  const [files, setFiles] = useState({
    selfie: null,
    aadhaar_front: null,
    aadhaar_back: null,
    driving_license_front: null,
    driving_license_back: null
  });

  // Previews State
  const [previews, setPreviews] = useState({});

  // Camera State for Selfie
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const res = await api.get('/restaurants/published');
      if (res.data.success) {
        setRestaurants(res.data.restaurants || []);
        if (res.data.restaurants.length > 0) {
          setSelectedRestaurantId(res.data.restaurants[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      return;
    }

    setError('');
    setFiles(prev => ({ ...prev, [fieldName]: file }));
    setPreviews(prev => ({ ...prev, [fieldName]: URL.createObjectURL(file) }));
  };

  // Camera Selfie Capture
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access failed:', err);
      setError('Unable to access camera. Please use file upload instead.');
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setFiles(prev => ({ ...prev, selfie: file }));
      setPreviews(prev => ({ ...prev, selfie: URL.createObjectURL(file) }));

      // Stop camera stream
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      setCameraActive(false);
    }, 'image/jpeg', 0.9);
  };

  const nextStep = () => {
    setError('');
    if (step === 1 && !selectedRestaurantId) {
      setError('Please select a restaurant to apply to.');
      return;
    }
    if (step === 2) {
      if (!formData.fullName || !formData.mobile || !formData.email) {
        setError('Full Name, Mobile, and Email Address are required.');
        return;
      }
      if (!formData.password) {
        setError('Please create a password for your driver account.');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match. Please re-enter matching passwords.');
        return;
      }
    }
    if (step === 3 && !files.selfie) {
      setError('A selfie photo is required for identity verification.');
      return;
    }
    if (step === 4 && (!files.aadhaar_front || !files.aadhaar_back)) {
      setError('Both Aadhaar Front and Back photos are required.');
      return;
    }
    if (step === 5 && (!files.driving_license_front || !files.driving_license_back)) {
      setError('Both Driving Licence Front and Back photos are required.');
      return;
    }
    if (step === 6 && (!formData.vehicleType || !formData.vehicleNumber)) {
      setError('Vehicle type and vehicle number are required.');
      return;
    }
    setStep(prev => Math.min(prev + 1, 7));
  };

  const prevStep = () => {
    setError('');
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = new FormData();
      data.append('restaurantId', selectedRestaurantId);
      data.append('fullName', formData.fullName);
      data.append('mobile', formData.mobile);
      data.append('email', formData.email);
      data.append('password', formData.password);
      data.append('dateOfBirth', formData.dateOfBirth);
      data.append('homeCity', formData.homeCity);
      data.append('currentCity', formData.currentCity);
      data.append('currentAddress', formData.currentAddress);
      data.append('emergencyContact', formData.emergencyContact);
      data.append('vehicleType', formData.vehicleType);
      data.append('vehicleNumber', formData.vehicleNumber);

      if (files.selfie) data.append('selfie', files.selfie);
      if (files.aadhaar_front) data.append('aadhaar_front', files.aadhaar_front);
      if (files.aadhaar_back) data.append('aadhaar_back', files.aadhaar_back);
      if (files.driving_license_front) data.append('driving_license_front', files.driving_license_front);
      if (files.driving_license_back) data.append('driving_license_back', files.driving_license_back);

      const res = await api.post('/driver-applications', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setSuccessData(res.data);
      }
    } catch (err) {
      console.error('Application Submission Error:', err);
      setError(err.response?.data?.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList = [
    { title: 'Restaurant', icon: Building },
    { title: 'Personal Info', icon: User },
    { title: 'Selfie', icon: Camera },
    { title: 'Aadhaar', icon: FileText },
    { title: 'Licence', icon: FileText },
    { title: 'Vehicle', icon: Bike },
    { title: 'Submit', icon: CheckCircle2 },
  ];

  if (successData) {
    const totalDocsCount = Object.keys(files).filter(k => files[k]).length;
    return (
      <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex items-center justify-center p-4 sm:p-6 font-sans antialiased">
        <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 border border-[#D7E5E8] shadow-xl text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-sm">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          
          <div className="space-y-1.5">
            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold uppercase rounded-full tracking-wider border border-emerald-300">
              ✓ Application Successfully Submitted
            </span>
            <h2 className="text-2xl font-black text-[#1F2937]">Welcome, {formData.fullName || 'Rider'}!</h2>
            <p className="text-[#64748B] text-xs sm:text-sm leading-relaxed">
              Your delivery partner application to join <strong className="text-[#3A7D7C]">{successData.restaurantName || 'the restaurant'}</strong> has been received and logged for review.
            </p>
          </div>

          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-[#D7E5E8] text-left space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-[#64748B]">Application ID:</span>
              <span className="font-mono text-[#1F2937] font-extrabold text-sm">#{successData.applicationId}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-1">
              <div>
                <span className="text-[#64748B] block text-[11px]">Applicant Name</span>
                <span className="font-bold text-[#1F2937]">{formData.fullName}</span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[11px]">Mobile Number</span>
                <span className="font-bold text-[#1F2937]">{formData.mobile}</span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[11px]">Vehicle Type</span>
                <span className="font-bold text-[#1F2937]">{formData.vehicleType} ({formData.vehicleNumber})</span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[11px]">Uploaded Documents</span>
                <span className="font-bold text-emerald-700">{totalDocsCount} files attached</span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
              <div className="flex justify-between text-[#64748B]">
                <span>Registered Email:</span>
                <span className="font-bold text-[#1F2937]">{formData.email}</span>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <span>Status:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold uppercase text-[10px] border border-amber-300">
                  UNDER REVIEW
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 text-left text-xs text-emerald-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-700 shrink-0" /> Next Steps:
            </p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              The restaurant manager will verify your uploaded documents. Once approved, you can immediately sign in with your email and chosen password to start accepting orders!
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setSuccessData(null);
                setStep(1);
                setFormData({
                  fullName: '', mobile: '', email: '', password: '', confirmPassword: '',
                  dateOfBirth: '', homeCity: '', currentCity: '', currentAddress: '',
                  emergencyContact: '', vehicleType: 'Bike', vehicleNumber: ''
                });
                setFiles({
                  selfie: null, aadhaar_front: null, aadhaar_back: null,
                  driving_license_front: null, driving_license_back: null
                });
              }}
              className="py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-xs font-bold text-[#1F2937] transition-all"
            >
              Submit Another Application
            </button>
            <button
              onClick={() => navigate('/driver/login')}
              className="flex-1 py-3 px-4 bg-[#3A7D7C] hover:bg-[#2F6665] rounded-2xl font-extrabold text-white shadow-md shadow-[#3A7D7C]/20 transition-all text-xs flex items-center justify-center gap-2"
            >
              Go to Driver Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAF4F7] text-[#1F2937] flex flex-col justify-between font-sans antialiased">
      {/* Header */}
      <header className="p-4 sm:p-6 border-b border-[#D7E5E8] bg-white/95 backdrop-blur sticky top-0 z-20 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-xl bg-slate-50 text-[#64748B] hover:text-[#1F2937] border border-[#D7E5E8]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#1F2937]">Delivery Partner Application</h1>
            <p className="text-xs text-[#64748B]">Join a restaurant team as a delivery rider</p>
          </div>
        </div>
        <button onClick={() => navigate('/driver/login')} className="text-xs font-bold text-[#3A7D7C] hover:underline">
          Rider Login ↗
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Step Progress Indicator */}
        <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-[#D7E5E8] shadow-xs">
          {stepsList.map((s, idx) => {
            const stepNum = idx + 1;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            const Icon = s.icon;
            return (
              <div key={stepNum} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isActive ? 'bg-[#3A7D7C] text-white shadow-md shadow-[#3A7D7C]/30 ring-2 ring-[#3A7D7C]/20' :
                  isDone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-[#94A3B8]'
                }`}>
                  {isDone ? '✓' : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-semibold mt-1 hidden sm:block ${isActive ? 'text-[#3A7D7C] font-bold' : 'text-[#64748B]'}`}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3 shadow-2xs">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step Cards */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D7E5E8] shadow-xl space-y-6">

          {/* STEP 1: Select Restaurant */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase text-[#3A7D7C] tracking-wider">Step 1 of 7</span>
                <h2 className="text-xl font-extrabold text-[#1F2937] mt-1">Select Restaurant to Apply To</h2>
                <p className="text-[#64748B] text-xs mt-1">
                  Choose the active restaurant where you want to work as an approved delivery partner.
                </p>
              </div>

              {loading ? (
                <div className="py-12 text-center text-[#64748B] text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3A7D7C]" />
                  Loading active restaurants...
                </div>
              ) : restaurants.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-[#D7E5E8] rounded-2xl text-center text-[#64748B] text-xs">
                  No published restaurants available for applications currently.
                </div>
              ) : (
                <div className="grid gap-3">
                  {restaurants.map((r) => {
                    const isSelected = parseInt(selectedRestaurantId) === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRestaurantId(r.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#EAF4F7] border-[#3A7D7C] text-[#1F2937] shadow-xs'
                            : 'bg-white border-[#D7E5E8] text-[#1F2937] hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-[#D7E5E8] flex items-center justify-center overflow-hidden">
                            {r.logo_url ? (
                              <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" />
                            ) : (
                              <Building className="w-6 h-6 text-[#3A7D7C]" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-[#1F2937]">{r.name}</h3>
                            <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-[#94A3B8]" />
                              {r.address || `${r.area || ''}, ${r.city || ''}`}
                            </p>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-[#3A7D7C] border-[#3A7D7C] text-white' : 'border-[#D7E5E8]'
                        }`}>
                          {isSelected && '✓'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Personal Information */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase text-[#3A7D7C] tracking-wider">Step 2 of 7</span>
                <h2 className="text-xl font-extrabold text-[#1F2937] mt-1">Personal Information</h2>
                <p className="text-[#64748B] text-xs mt-1">
                  Enter your legal details. You do not need to live in the restaurant city.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Full Legal Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="e.g. Rahul Kumar"
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Mobile Number *</label>
                  <input
                    type="tel"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleInputChange}
                    placeholder="+91 9876543210"
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="rahul@example.com"
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>

                {/* Password & Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">
                    Create Password * <span className="text-[10px] text-[#64748B] font-normal">(Min 6 chars)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter new password"
                      className="w-full bg-white border border-[#D7E5E8] rounded-xl pl-4 pr-11 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Re-enter password"
                      className={`w-full bg-white border rounded-xl pl-4 pr-11 py-3 text-[#1F2937] text-sm outline-none ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword
                          ? 'border-rose-400 focus:border-rose-500'
                          : 'border-[#D7E5E8] focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1F2937]"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <span className="text-[11px] text-rose-600 font-medium block mt-1">Passwords do not match</span>
                  )}
                </div>

                {/* Account Security Notice */}
                <div className="sm:col-span-2 p-3.5 bg-[#EAF4F7] border border-[#D7E5E8] rounded-2xl text-xs text-[#1F2937] flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-[#3A7D7C] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong className="text-[#3A7D7C]">Driver Portal Sign-In:</strong> You will use this <strong className="text-[#1F2937]">Email Address</strong> and <strong className="text-[#1F2937]">Password</strong> to log in to the Driver App once your application is reviewed and approved.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Home City</label>
                  <input
                    type="text"
                    name="homeCity"
                    value={formData.homeCity}
                    onChange={handleInputChange}
                    placeholder="e.g. Hubballi"
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Current Delivery City</label>
                  <input
                    type="text"
                    name="currentCity"
                    value={formData.currentCity}
                    onChange={handleInputChange}
                    placeholder="e.g. Bengaluru"
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Current Residential Address</label>
                  <textarea
                    name="currentAddress"
                    rows="2"
                    value={formData.currentAddress}
                    onChange={handleInputChange}
                    placeholder="Enter complete current local address"
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  ></textarea>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Emergency Contact Mobile</label>
                  <input
                    type="tel"
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={handleInputChange}
                    placeholder="+91 9988776655"
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Selfie Photo */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase text-[#3A7D7C] tracking-wider">Step 3 of 7</span>
                <h2 className="text-xl font-extrabold text-[#1F2937] mt-1">Take or Upload Selfie Photo</h2>
                <p className="text-[#64748B] text-xs mt-1">
                  Take a clear front-facing selfie showing your face clearly for identity review.
                </p>
              </div>

              <div className="flex flex-col items-center space-y-4">
                {previews.selfie ? (
                  <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-[#3A7D7C] shadow-lg">
                    <img src={previews.selfie} alt="Selfie preview" className="w-full h-full object-cover" />
                  </div>
                ) : cameraActive ? (
                  <div className="relative w-full max-w-sm rounded-3xl overflow-hidden bg-slate-900 aspect-square">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2.5 bg-[#3A7D7C] text-white rounded-full font-bold text-xs shadow-lg"
                    >
                      📸 Capture Photo
                    </button>
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-full bg-slate-50 border-2 border-dashed border-[#D7E5E8] flex flex-col items-center justify-center text-[#94A3B8]">
                    <Camera className="w-10 h-10 mb-2 text-[#94A3B8]" />
                    <span className="text-xs font-semibold">No Selfie Captured</span>
                  </div>
                )}

                <div className="flex gap-3">
                  {!cameraActive && (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-[#1F2937] flex items-center gap-2 border border-[#D7E5E8]"
                    >
                      <Camera className="w-4 h-4" /> Use Camera
                    </button>
                  )}

                  <label className="px-4 py-2.5 bg-[#3A7D7C] hover:bg-[#2F6665] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-2xs">
                    <Upload className="w-4 h-4" /> Upload File
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'selfie')} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Aadhaar Documents */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase text-[#3A7D7C] tracking-wider">Step 4 of 7</span>
                <h2 className="text-xl font-extrabold text-[#1F2937] mt-1">Aadhaar Card Upload</h2>
                <p className="text-[#64748B] text-xs mt-1">
                  Upload clear photos of both Aadhaar Card Front and Back.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Aadhaar Front */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] flex flex-col items-center justify-center text-center space-y-3">
                  <span className="text-xs font-bold text-[#1F2937]">Aadhaar Card (Front) *</span>
                  {previews.aadhaar_front ? (
                    <img src={previews.aadhaar_front} alt="Aadhaar Front" className="h-32 rounded-lg object-cover border border-[#D7E5E8]" />
                  ) : (
                    <FileText className="w-12 h-12 text-[#94A3B8]" />
                  )}
                  <label className="px-4 py-2 bg-white hover:bg-slate-100 rounded-xl text-xs font-bold text-[#3A7D7C] border border-[#D7E5E8] cursor-pointer shadow-2xs">
                    Select File
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'aadhaar_front')} />
                  </label>
                </div>

                {/* Aadhaar Back */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] flex flex-col items-center justify-center text-center space-y-3">
                  <span className="text-xs font-bold text-[#1F2937]">Aadhaar Card (Back) *</span>
                  {previews.aadhaar_back ? (
                    <img src={previews.aadhaar_back} alt="Aadhaar Back" className="h-32 rounded-lg object-cover border border-[#D7E5E8]" />
                  ) : (
                    <FileText className="w-12 h-12 text-[#94A3B8]" />
                  )}
                  <label className="px-4 py-2 bg-white hover:bg-slate-100 rounded-xl text-xs font-bold text-[#3A7D7C] border border-[#D7E5E8] cursor-pointer shadow-2xs">
                    Select File
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'aadhaar_back')} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Driving Licence Documents */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase text-[#3A7D7C] tracking-wider">Step 5 of 7</span>
                <h2 className="text-xl font-extrabold text-[#1F2937] mt-1">Driving Licence Upload</h2>
                <p className="text-[#64748B] text-xs mt-1">
                  Upload clear photos of your Driving Licence Front and Back.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* DL Front */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] flex flex-col items-center justify-center text-center space-y-3">
                  <span className="text-xs font-bold text-[#1F2937]">Driving Licence (Front) *</span>
                  {previews.driving_license_front ? (
                    <img src={previews.driving_license_front} alt="DL Front" className="h-32 rounded-lg object-cover border border-[#D7E5E8]" />
                  ) : (
                    <FileText className="w-12 h-12 text-[#94A3B8]" />
                  )}
                  <label className="px-4 py-2 bg-white hover:bg-slate-100 rounded-xl text-xs font-bold text-[#3A7D7C] border border-[#D7E5E8] cursor-pointer shadow-2xs">
                    Select File
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'driving_license_front')} />
                  </label>
                </div>

                {/* DL Back */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-[#D7E5E8] flex flex-col items-center justify-center text-center space-y-3">
                  <span className="text-xs font-bold text-[#1F2937]">Driving Licence (Back) *</span>
                  {previews.driving_license_back ? (
                    <img src={previews.driving_license_back} alt="DL Back" className="h-32 rounded-lg object-cover border border-[#D7E5E8]" />
                  ) : (
                    <FileText className="w-12 h-12 text-[#94A3B8]" />
                  )}
                  <label className="px-4 py-2 bg-white hover:bg-slate-100 rounded-xl text-xs font-bold text-[#3A7D7C] border border-[#D7E5E8] cursor-pointer shadow-2xs">
                    Select File
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'driving_license_back')} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Vehicle Information */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase text-[#3A7D7C] tracking-wider">Step 6 of 7</span>
                <h2 className="text-xl font-extrabold text-[#1F2937] mt-1">Vehicle Information</h2>
                <p className="text-[#64748B] text-xs mt-1">
                  Select your vehicle type and provide registration plate number.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-2">Vehicle Type *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['Bike', 'Scooter', 'EV', 'Cycle'].map((vType) => (
                      <div
                        key={vType}
                        onClick={() => setFormData(prev => ({ ...prev, vehicleType: vType }))}
                        className={`p-3 rounded-xl border text-center cursor-pointer font-bold text-xs transition-all ${
                          formData.vehicleType === vType
                            ? 'bg-[#3A7D7C] text-white border-[#3A7D7C] shadow-2xs'
                            : 'bg-white border-[#D7E5E8] text-[#64748B] hover:text-[#1F2937]'
                        }`}
                      >
                        {vType}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1.5">Vehicle Registration Number *</label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    value={formData.vehicleNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. KA-01-EQ-4589"
                    className="w-full bg-white border border-[#D7E5E8] rounded-xl px-4 py-3 text-[#1F2937] text-sm uppercase font-mono tracking-wider focus:ring-2 focus:ring-[#3A7D7C]/20 focus:border-[#3A7D7C] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Review & Submit */}
          {step === 7 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase text-[#3A7D7C] tracking-wider">Step 7 of 7</span>
                <h2 className="text-xl font-extrabold text-[#1F2937] mt-1">Review Your Application</h2>
                <p className="text-[#64748B] text-xs mt-1">
                  Please verify all details before submitting for restaurant admin review.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-[#D7E5E8] space-y-4 text-xs">
                <div className="flex justify-between border-b border-[#D7E5E8] pb-2">
                  <span className="text-[#64748B]">Target Restaurant:</span>
                  <span className="font-bold text-[#3A7D7C]">
                    {restaurants.find(r => r.id === parseInt(selectedRestaurantId))?.name || 'Selected Store'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#D7E5E8] pb-2">
                  <span className="text-[#64748B]">Full Name:</span>
                  <span className="font-semibold text-[#1F2937]">{formData.fullName}</span>
                </div>
                <div className="flex justify-between border-b border-[#D7E5E8] pb-2">
                  <span className="text-[#64748B]">Mobile & Email:</span>
                  <span className="font-semibold text-[#1F2937]">{formData.mobile} | {formData.email}</span>
                </div>
                <div className="flex justify-between border-b border-[#D7E5E8] pb-2">
                  <span className="text-[#64748B]">Portal Password:</span>
                  <span className="font-mono text-emerald-700 font-bold">•••••••• (Configured)</span>
                </div>
                <div className="flex justify-between border-b border-[#D7E5E8] pb-2">
                  <span className="text-[#64748B]">Cities:</span>
                  <span className="font-semibold text-[#1F2937]">Home: {formData.homeCity} → Work: {formData.currentCity}</span>
                </div>
                <div className="flex justify-between border-b border-[#D7E5E8] pb-2">
                  <span className="text-[#64748B]">Vehicle:</span>
                  <span className="font-semibold text-[#1F2937]">{formData.vehicleType} ({formData.vehicleNumber})</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-[#64748B]">Uploaded Documents:</span>
                  <span className="font-bold text-emerald-700">Selfie, Aadhaar (2), DL (2) Attached ✓</span>
                </div>
              </div>

              <div className="p-4 bg-[#EAF4F7] border border-[#D7E5E8] rounded-2xl text-xs text-[#1F2937] leading-relaxed">
                <Shield className="w-4 h-4 text-[#3A7D7C] inline-block mr-1.5 -mt-0.5" />
                By submitting, you confirm that your documents are authentic. Restaurant admin will review and issue login credentials upon approval.
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-[#D7E5E8]">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#D7E5E8] text-xs font-bold text-[#1F2937] flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            {step < 7 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2.5 rounded-xl bg-[#3A7D7C] hover:bg-[#2F6665] text-xs font-bold text-white shadow-md shadow-[#3A7D7C]/20 flex items-center gap-1.5 transition-all"
              >
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-extrabold text-white shadow-md flex items-center gap-2 transition-all"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Application...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Submit Application
                  </>
                )}
              </button>
            )}
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-[#D7E5E8] text-center text-xs text-[#64748B] bg-white">
        Multi-Restaurant Platform • Delivery Partner Onboarding System
      </footer>
    </div>
  );
}
