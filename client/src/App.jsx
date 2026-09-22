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
    path.startsWith('/desk') ||
    path.startsWith('/manage') ||
    search.includes('view=admin') ||
    search.includes('admin=true') ||
    hash.includes('admin')
  );
}

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(checkAdminRoute);
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    return localStorage.getItem('travelx_admin_auth') === 'true';
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
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenAgentPortal = () => {
    if (window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
    setIsAdminMode(false);
  };

  const handleSwitchToAdmin = () => {
    if (window.history.pushState) {
      window.history.pushState({}, '', '/admin');
    }
    setIsAdminMode(true);
  };

  const handlePinSubmit = (e) => {
    e?.preventDefault();
    // Default PIN: 7788 or 1234
    if (pinInput.trim() === '7788' || pinInput.trim() === '1234') {
      localStorage.setItem('travelx_admin_auth', 'true');
      setAdminUnlocked(true);
      setPinError(false);
      setPinInput('');
    } else {
      setPinError(true);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('travelx_admin_auth');
    setAdminUnlocked(false);
    handleOpenAgentPortal();
  };

  const [faresRefreshKey, setFaresRefreshKey] = useState(0);

  const handleRatesChanged = () => {
    setFaresRefreshKey(k => k + 1);
    loadMasters();
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
    loadMasters();

    // Heartbeat ping every 8 minutes to keep backend warm while user has tab open
    const interval = setInterval(() => {
      api.getHealth().catch(() => {});
    }, 8 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSelectRouteFromDashboard = (origin, destination) => {
    setSelectedRoute({ origin, destination });
    setActiveTab('compare');
  };

  // If NOT in Admin Mode, ALWAYS render clean public B2B Agent Portal
  if (!isAdminMode) {
    return <AgentPortal onSwitchToAdmin={handleSwitchToAdmin} />;
  }

  // If in Admin Mode but not yet authenticated with PIN
  if (!adminUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-400 border border-blue-500/20 mb-3 shadow-inner">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">TravelX Operations Desk</h1>
            <p className="text-xs text-slate-400 mt-1">Authorized Management Access Only</p>
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
              <span>Unlock Admin Desk</span>
              <span>➔</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <button
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
