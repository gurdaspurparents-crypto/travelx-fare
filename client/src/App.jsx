import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import FinalRatesDesk from './pages/FinalRatesDesk';
import AllRatesDesk from './pages/AllRatesDesk';
import VendorFaresDesk from './pages/VendorFaresDesk';
import FastEntry from './pages/FastEntry';
import QuickGrid from './pages/QuickGrid';
import BulkPaste from './pages/BulkPaste';
import ComparisonDesk from './pages/ComparisonDesk';
import PublishDesk from './pages/PublishDesk';
import HistoryDesk from './pages/HistoryDesk';
import MarginRules from './pages/MarginRules';
import MasterData from './pages/MasterData';
import AgentPortal from './pages/AgentPortal';
import BookingRequestsDesk from './pages/BookingRequestsDesk';
import { api } from './utils/api';

function checkAdminRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path.startsWith('/admin') ||
    path.startsWith('/staff') ||
    path.startsWith('/ops') ||
    path.startsWith('/desk') ||
    path.startsWith('/manage') ||
    search.includes('view=admin') ||
    search.includes('view=staff') ||
    search.includes('admin=true') ||
    hash.includes('admin') ||
    hash.includes('staff')
  );
}

function checkIsStaffRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path.startsWith('/staff') ||
    path.startsWith('/ops') ||
    search.includes('view=staff') ||
    hash.includes('staff')
  );
}

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(checkAdminRoute);
  const [isStaffRoute, setIsStaffRoute] = useState(checkIsStaffRoute);
  const [userRole, setUserRole] = useState(() => {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('travelx_user_role')) || 'admin';
  });
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('travelx_admin_token');
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [masterData, setMasterData] = useState({
    airlines: [],
    vendors: [],
    routes: []
  });
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    const handlePopState = () => {
      setIsAdminMode(checkAdminRoute());
      setIsStaffRoute(checkIsStaffRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenAgentPortal = () => {
    if (window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
    setIsAdminMode(false);
    setIsStaffRoute(false);
  };

  const handleSwitchToAdmin = () => {
    if (window.history.pushState) {
      window.history.pushState({}, '', '/admin');
    }
    setIsAdminMode(true);
    setIsStaffRoute(false);
  };

  const handleSwitchToStaff = () => {
    if (window.history.pushState) {
      window.history.pushState({}, '', '/staff');
    }
    setIsAdminMode(true);
    setIsStaffRoute(true);
  };

  const handlePinSubmit = async (e) => {
    e?.preventDefault();
    try {
      const res = await api.adminLogin(pinInput.trim());
      if (res?.success && res.token) {
        const role = res.role || (isStaffRoute ? 'staff' : 'admin');
        localStorage.setItem('travelx_admin_token', res.token);
        localStorage.setItem('travelx_user_role', role);
        localStorage.removeItem('travelx_admin_auth');
        setUserRole(role);
        setAdminUnlocked(true);
        setPinError(false);
        setPinInput('');
        if (role !== 'staff') {
          await loadMasters();
        }
      } else {
        setPinError(true);
      }
    } catch (_) {
      setPinError(true);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('travelx_admin_token');
    localStorage.removeItem('travelx_user_role');
    localStorage.removeItem('travelx_admin_auth');
    setAdminUnlocked(false);
    setUserRole('admin');
    handleOpenAgentPortal();
  };

  const [faresRefreshKey, setFaresRefreshKey] = useState(0);

  const handleRatesChanged = () => {
    setFaresRefreshKey(k => k + 1);
    if (userRole !== 'staff') {
      loadMasters();
    }
  };

  const loadMasters = async () => {
    try {
      const [resA, resV, resR] = await Promise.all([
        api.getAirlines(),
        api.getVendors(),
        api.getRoutes()
      ]);
      setMasterData({
        airlines: resA.success ? resA.airlines : [],
        vendors: resV.success ? resV.vendors : [],
        routes: resR.success ? resR.routes : []
      });
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  useEffect(() => {
    // Heartbeat ping every 8 minutes to keep backend warm while user has tab open
    const interval = setInterval(() => {
      api.getHealth().catch(() => {});
    }, 8 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAdminMode || !adminUnlocked) return;
    api.verifyAdminSession().then((res) => {
      if (res?.success && res.authenticated) {
        const role = res.role || userRole || 'admin';
        setUserRole(role);
        localStorage.setItem('travelx_user_role', role);
        if (role !== 'staff') {
          loadMasters();
        }
      } else {
        localStorage.removeItem('travelx_admin_token');
        localStorage.removeItem('travelx_user_role');
        setAdminUnlocked(false);
      }
    }).catch(() => {
      localStorage.removeItem('travelx_admin_token');
      localStorage.removeItem('travelx_user_role');
      setAdminUnlocked(false);
    });
  }, [isAdminMode, adminUnlocked]);

  const handleSelectRouteFromDashboard = (origin, destination) => {
    setSelectedRoute({ origin, destination });
    setActiveTab('compare');
  };

  // If NOT in Admin/Staff Mode, ALWAYS render clean public B2B Agent Portal
  if (!isAdminMode) {
    return <AgentPortal onSwitchToAdmin={handleSwitchToAdmin} onSwitchToStaff={handleSwitchToStaff} />;
  }

  // If in Admin/Staff Mode but not yet authenticated with PIN
  if (!adminUnlocked) {
    const isStaffScreen = isStaffRoute;
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-400 border border-blue-500/20 mb-3 shadow-inner">
              <span className="text-2xl">{isStaffScreen ? '🎧' : '🔒'}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {isStaffScreen ? 'TravelX Staff Operations Desk' : 'TravelX Operations Desk'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isStaffScreen ? 'Staff Access • Enter Staff PIN (2233)' : 'Authorized Management Access Only'}
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
                Enter Security PIN
              </label>
              <input
                type="password"
                maxLength={6}
                autoFocus
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                placeholder="• • • •"
                className={`w-full text-center text-2xl tracking-[0.6em] py-3.5 px-4 bg-slate-950 border ${pinError ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} rounded-2xl text-white font-mono outline-none transition-all placeholder:text-slate-600 placeholder:tracking-normal`}
              />
              {pinError && (
                <p className="text-xs text-rose-400 text-center mt-2 font-medium">
                  Incorrect Security PIN. Please try again.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 transition-all text-sm flex items-center justify-center space-x-2"
            >
              <span>{isStaffScreen ? 'Unlock Staff Operations Desk' : 'Unlock Operations Desk'}</span>
              <span>➔</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center flex flex-col space-y-2">
            {!isStaffScreen ? (
              <button
                type="button"
                onClick={handleSwitchToStaff}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Switch to Staff Operations Login (PIN 2233) →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSwitchToAdmin}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Switch to Master Admin Login (PIN 7788) →
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenAgentPortal}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Public B2B Agent Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated as STAFF (or on staff route with staff role):
  // Renders the clean Staff Operations Desk (no Admin Navbar, no profit margins, no vendor heads)
  if (userRole === 'staff') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
        {/* Staff Top Navigation Bar */}
        <header className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3 shadow-md sticky top-0 z-30">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
                TX
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                    TRAVELX <span className="text-blue-400">STAFF OPERATIONS DESK</span>
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Staff Ops
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Live Agent Inquiries • Passports & Availability Verification
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleOpenAgentPortal}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                🌐 Agent Portal
              </button>
              <button
                type="button"
                onClick={handleAdminLogout}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition flex items-center space-x-1"
              >
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Staff Body - strictly Booking Requests Desk with vendor rates masked */}
        <main className="flex-1 w-full mx-auto max-w-full px-1.5 sm:px-2.5 py-1.5">
          <BookingRequestsDesk isStaffMode={true} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Travelx Header & Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        vendors={masterData.vendors}
        onRatesCleared={handleRatesChanged}
        onOpenAgentPortal={handleOpenAgentPortal}
      />

      {/* Main Workspace Area */}
      <main className={`flex-1 w-full mx-auto ${['all-rates', 'final-rates', 'enquiries'].includes(activeTab) ? 'max-w-full px-1.5 sm:px-2.5 py-1.5' : 'max-w-7xl px-3 sm:px-4 py-2.5'}`}>
        {activeTab === 'dashboard' && (
          <Dashboard
            masterData={masterData}
            setActiveTab={setActiveTab}
            onSelectRoute={handleSelectRouteFromDashboard}
            onRatesCleared={handleRatesChanged}
            faresRefreshKey={faresRefreshKey}
          />
        )}

        <div style={{ display: activeTab === 'enquiries' ? 'block' : 'none' }}>
          <BookingRequestsDesk 
            onSwitchToEnquiries={() => setActiveTab('enquiries')}
          />
        </div>

        {activeTab === 'final-rates' && (
          <FinalRatesDesk
            masterData={masterData}
            setActiveTab={setActiveTab}
            faresRefreshKey={faresRefreshKey}
          />
        )}

        {activeTab === 'all-rates' && (
          <AllRatesDesk
            masterData={masterData}
            setActiveTab={setActiveTab}
            faresRefreshKey={faresRefreshKey}
          />
        )}

        {activeTab === 'vendor-heads' && (
          <VendorFaresDesk
            masterData={masterData}
            onFaresSaved={handleRatesChanged}
            setActiveTab={setActiveTab}
            faresRefreshKey={faresRefreshKey}
          />
        )}

        {activeTab === 'fast-entry' && (
          <FastEntry
            masterData={masterData}
            onFareAdded={() => loadMasters()}
          />
        )}

        {activeTab === 'quick-grid' && (
          <QuickGrid
            masterData={masterData}
            onFaresSaved={() => loadMasters()}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'bulk-paste' && (
          <BulkPaste
            masterData={masterData}
            onFaresSaved={() => loadMasters()}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'compare' && (
          <ComparisonDesk
            masterData={masterData}
            initialRoute={selectedRoute}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'publish' && (
          <PublishDesk
            onFaresChanged={() => loadMasters()}
            masterData={masterData}
          />
        )}

        {activeTab === 'history' && (
          <HistoryDesk
            masterData={masterData}
          />
        )}

        {activeTab === 'margins' && (
          <MarginRules
            masterData={masterData}
          />
        )}

        {activeTab === 'masters' && (
          <MasterData
            onMasterDataChanged={loadMasters}
          />
        )}
      </main>

      {/* Professional Travel Agency Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white tracking-wide">TRAVELX</span>
            <span className="text-slate-600">•</span>
            <span>Special Fare Manager & Automatic Comparison System</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <span>Fast Manual Input + Smart WhatsApp Text Parser</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-semibold">SQLite WAL Storage Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
