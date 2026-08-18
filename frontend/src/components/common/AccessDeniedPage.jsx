import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">403 Access Denied</h2>
        <p className="text-slate-400 text-sm mt-1 max-w-md">
          You do not have permission to access this page ({user?.role || 'Guest'} role restricted). Please contact your restaurant system administrator if you believe this is an error.
        </p>
      </div>
      <button
        onClick={() => navigate('/dashboard')}
        className="py-2.5 px-5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 flex items-center gap-2 shadow-lg shadow-amber-500/20 text-sm transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </button>
    </div>
  );
}
