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

function checkAgentRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path.startsWith('/agent') ||
    path.startsWith('/rates') ||
    search.includes('view=agent') ||
    search.includes('portal=agent') ||
    hash.includes('agent')
  );
}

export default function App() {
  const [isAgentMode, setIsAgentMode] = useState(checkAgentRoute);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [masterData, setMasterData] = useState({
    airlines: [],
    vendors: [],
    routes: []
  });
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    const handlePopState = () => {
      setIsAgentMode(checkAgentRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenAgentPortal = () => {
    if (window.history.pushState) {
      window.history.pushState({}, '', '/?view=agent');
    }
    setIsAgentMode(true);
  };

  const handleSwitchToAdmin = () => {
    if (window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
    setIsAgentMode(false);
    setActiveTab('final-rates');
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
  }, []);

  const handleSelectRouteFromDashboard = (origin, destination) => {
    setSelectedRoute({ origin, destination });
    setActiveTab('compare');
  };

  // If in B2B Agent View, render clean customer/agent-facing portal
  if (isAgentMode) {
    return <AgentPortal onSwitchToAdmin={handleSwitchToAdmin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Travelx Header & Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        vendors={masterData.vendors}
        onRatesCleared={loadMasters}
        onOpenAgentPortal={handleOpenAgentPortal}
      />

      {/* Main Workspace Area */}
      <main className={`flex-1 w-full mx-auto ${['all-rates', 'final-rates', 'enquiries'].includes(activeTab) ? 'max-w-full px-1.5 sm:px-2.5 py-1.5' : 'max-w-7xl px-3 sm:px-4 py-2.5'}`}>
        {activeTab === 'dashboard' && (
          <Dashboard
            masterData={masterData}
            setActiveTab={setActiveTab}
            onSelectRoute={handleSelectRouteFromDashboard}
            onRatesCleared={loadMasters}
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
          />
        )}

        {activeTab === 'all-rates' && (
          <AllRatesDesk
            masterData={masterData}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'vendor-heads' && (
          <VendorFaresDesk
            masterData={masterData}
            onFaresSaved={() => loadMasters()}
            setActiveTab={setActiveTab}
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
