import React, { useState, useEffect } from 'react';
import { 
  Plane, LayoutDashboard, Zap, Table, MessageSquare, 
  GitCompare, Send, History, Database, Download, Building2, Layers, Trash2, Plus,
  FileSpreadsheet, Smartphone, Inbox, ShieldAlert, ShieldCheck
} from 'lucide-react';
import ClearRatesModal from './ClearRatesModal';
import { api } from '../utils/api';

export default function Navbar({ activeTab, setActiveTab, vendors = [], onRatesCleared, onOpenAgentPortal }) {
  const [showClearModal, setShowClearModal] = useState(false);
  const [bookingStats, setBookingStats] = useState({ pending: 0, declined: 0, docs_submitted: 0 });
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [togglingMaint, setTogglingMaint] = useState(false);

  // Poll booking stats for live badges (Pending, Declined, Passports Ready) & check maintenance state
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.getBookingRequests({ limit: 1 });
        if (res && res.success && res.stats) {
          setBookingStats({
            pending: res.stats.pending || 0,
            declined: res.stats.declined || 0,
            docs_submitted: res.stats.docs_submitted || 0
          });
        }
      } catch (e) {
        // silent
      }
    };

    const fetchMaint = async () => {
      try {
        const sRes = await api.getWhatsAppSettings();
        if (sRes?.success && sRes.settings) {
          setMaintenanceActive(!!sRes.settings.maintenance_mode);
        }
      } catch (_) {}
    };

    fetchStats();
    fetchMaint();
    const timer = setInterval(fetchStats, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleToggleMaintenance = async () => {
    if (togglingMaint) return;
    const nextVal = !maintenanceActive;
    try {
      setTogglingMaint(true);
      const res = await api.saveWhatsAppSettings({ maintenance_mode: nextVal });
      if (res?.success) {
        setMaintenanceActive(nextVal);
      }
    } catch (_) {}
    finally {
      setTogglingMaint(false);
    }
  };

  // Primary Desks (Core daily workflow)
  const primaryNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'enquiries', label: 'Booking Requests', icon: Inbox, isBooking: true },
    { id: 'final-rates', label: 'Final Rates', icon: FileSpreadsheet, isMaster: true, badgeText: 'EXCEL' },
    { id: 'all-rates', label: 'All Rates Desk', icon: Layers, isMaster: true },
    { id: 'vendor-heads', label: 'Vendor Rates Desk', icon: Building2 },
    { id: 'compare', label: 'Compare Fares', icon: GitCompare },
    { id: 'publish', label: 'Special Fares & Broadcast', icon: Send },
    { id: 'agent-portal', label: 'B2B Agent Portal', icon: Smartphone, badgeText: 'LIVE', isAgentLink: true },
  ];

  // Secondary Tools (Input modes & settings)
  const secondaryNavItems = [
    { id: 'quick-grid', label: 'Quick Grid', icon: Table },
    { id: 'fast-entry', label: 'Fast Entry', icon: Zap },
    { id: 'bulk-paste', label: 'WhatsApp Paste', icon: MessageSquare },
    { id: 'history', label: 'Fare History', icon: History },
    { id: 'masters', label: 'Master Data', icon: Database },
  ];

  return (
    <>
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40 border-b border-slate-800">
        {/* Top Brand Bar */}
        <div className="max-w-[1750px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-9">
            {/* Logo & Identity */}
            <div 
              className="flex items-center space-x-2 cursor-pointer group" 
              onClick={() => setActiveTab('dashboard')}
            >
              <div className="bg-white px-1.5 py-0.5 rounded shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform border border-slate-700">
                <img src="/travelx-logo.png" alt="TravelX" className="h-4.5 w-auto object-contain" />
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black tracking-tight text-white font-mono">TRAVELX</span>
                <span className="text-[9px] bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 font-bold px-1 py-0.2 rounded border border-amber-500/40">
                  PRO
                </span>
                <span className="hidden lg:inline text-[10px] text-slate-400 font-medium">
                  • Special Fare Desk
                </span>
              </div>
            </div>

            {/* Quick Action Buttons (Excel, Clear Rates, Add Fare, B2B Agent View, Maintenance Mode) */}
            <div className="flex items-center space-x-1.5">
              {/* Maintenance Mode Toggle Button */}
              {maintenanceActive ? (
                <button
                  type="button"
                  onClick={handleToggleMaintenance}
                  disabled={togglingMaint}
                  className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-2 py-0.5 rounded-md transition shadow-xs cursor-pointer animate-pulse border border-amber-300"
                  title="Maintenance Mode is ACTIVE on B2B Portal. Click to TURN OFF and make B2B portal live."
                >
                  <ShieldAlert className="w-3 h-3 text-slate-950" />
                  <span>⚠️ Maintenance: ON</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleMaintenance}
                  disabled={togglingMaint}
                  className="inline-flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold px-2 py-0.5 rounded-md border border-slate-700 transition cursor-pointer shadow-xs"
                  title="Click to put B2B portal in Maintenance Mode while you update bulk rates"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span className="hidden md:inline">B2B Portal: LIVE</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenAgentPortal}
                className="inline-flex items-center space-x-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-2 py-0.5 rounded-md transition shadow-xs cursor-pointer border border-emerald-400/50"
                title="Open Live B2B Agent Portal (Clean rates for 500+ agents)"
              >
                <Smartphone className="w-3 h-3 text-emerald-200" />
                <span>📱 B2B Agent View</span>
              </button>

              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="inline-flex items-center space-x-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white text-xs font-bold px-2 py-0.5 rounded-md border border-rose-800/80 transition cursor-pointer shadow-xs"
                title="Clear all rates or clear a specific vendor"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Clear Rates</span>
              </button>

              <a
                href="/api/export/excel"
                download
                className="hidden sm:inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded-md transition-colors shadow-xs"
                title="Download Master Excel with full city routes"
              >
                <Download className="w-3 h-3" />
                <span>Export Excel</span>
              </a>

              <button
                type="button"
                onClick={() => setActiveTab('fast-entry')}
                className="inline-flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-md transition shadow-xs cursor-pointer"
                title="Add New Rate"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Fare</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="bg-slate-950/90 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          <div className="max-w-[1750px] mx-auto px-4 sm:px-6">
            <nav className="flex items-center space-x-1 py-0.5">
              {/* Primary Workflows */}
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.isAgentLink && onOpenAgentPortal) {
                        onOpenAgentPortal();
                      } else {
                        setActiveTab(item.id);
                      }
                    }}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                    {item.isBooking && (
                      <div className="flex items-center space-x-1 ml-1">
                        {bookingStats.pending > 0 && (
                          <span className="px-1.5 py-0.2 text-[10px] rounded-full font-black bg-amber-500 text-white animate-pulse" title={`${bookingStats.pending} Pending Inquiries`}>
                            {bookingStats.pending}
                          </span>
                        )}
                        {bookingStats.declined > 0 && (
                          <span className="px-1.5 py-0.2 text-[10px] rounded-full font-black bg-rose-600 text-white shadow-xs" title={`${bookingStats.declined} Agent Declined Requests`}>
                            ❌ {bookingStats.declined}
                          </span>
                        )}
                        {bookingStats.docs_submitted > 0 && (
                          <span className="px-1.5 py-0.2 text-[10px] rounded-full font-black bg-teal-500 text-white shadow-xs" title={`${bookingStats.docs_submitted} Passports Ready`}>
                            📄 {bookingStats.docs_submitted}
                          </span>
                        )}
                      </div>
                    )}
                    {item.isMaster && (
                      <span className={`ml-1 px-1 py-0.2 text-[9px] rounded font-black border ${
                        item.badgeText === 'EXCEL'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                      }`}>
                        {item.badgeText || 'LIVE'}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Vertical Divider */}
              <div className="h-3.5 w-px bg-slate-800 mx-1 shrink-0"></div>

              {/* Secondary Entry Modes */}
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/90 text-white shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Global Clear Rates Modal */}
      <ClearRatesModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        vendors={vendors}
        onRatesCleared={() => {
          if (onRatesCleared) onRatesCleared();
        }}
      />
    </>
  );
}
