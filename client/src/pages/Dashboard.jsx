import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, Table, MessageSquare, GitCompare, Send, History, 
  Sliders, Database, Download, ArrowUpRight, ArrowDownRight, 
  Plane, TrendingDown, TrendingUp, CheckCircle, RefreshCw, Calendar, Tag, Trash2, Building2,
  Search, ChevronDown, Filter, X
} from 'lucide-react';
import { api } from '../utils/api';
import ClearRatesModal from '../components/ClearRatesModal';

export default function Dashboard({ setActiveTab, onSelectRoute, masterData = {}, onRatesCleared, faresRefreshKey }) {
  const { vendors = [] } = masterData;
  const [showClearModal, setShowClearModal] = useState(false);
  const [data, setData] = useState({
    stats: {
      fares_today: 0,
      total_airlines: 0,
      total_routes: 0,
      total_vendors: 0,
      published_fares: 0,
      total_fares: 0,
      price_drops_today: 0,
      price_hikes_today: 0
    },
    recentFares: [],
    favoriteRoutes: []
  });
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardStats();
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [faresRefreshKey]);

  const stats = data.stats || {};

  // Dropdown filter states
  const [filterRoute, setFilterRoute] = useState('ALL');
  const [filterAirline, setFilterAirline] = useState('ALL');
  const [filterVendor, setFilterVendor] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');

  // Extract unique options from recentFares and favoriteRoutes
  const uniqueRoutes = useMemo(() => {
    const set = new Set();
    (data.recentFares || []).forEach(f => {
      if (f.origin && f.destination) {
        set.add(`${f.origin}-${f.destination}`);
      }
    });
    (data.favoriteRoutes || []).forEach(r => {
      if (r.origin && r.destination) {
        set.add(`${r.origin}-${r.destination}`);
      }
    });
    return Array.from(set).sort();
  }, [data.recentFares, data.favoriteRoutes]);

  const uniqueAirlines = useMemo(() => {
    const map = new Map();
    (data.recentFares || []).forEach(f => {
      const code = (f.airline_code || '').trim().toUpperCase();
      const name = f.airline_name || code;
      if (code && !map.has(code)) map.set(code, name);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [data.recentFares]);

  const uniqueVendors = useMemo(() => {
    const set = new Set();
    (data.recentFares || []).forEach(f => {
      if (f.vendor_name) set.add(f.vendor_name);
    });
    return Array.from(set).sort();
  }, [data.recentFares]);

  // Filtered recent fares list
  const filteredRecentFares = useMemo(() => {
    return (data.recentFares || []).filter(f => {
      if (filterRoute !== 'ALL') {
        const rKey = `${f.origin}-${f.destination}`;
        if (rKey !== filterRoute) return false;
      }
      if (filterAirline !== 'ALL') {
        if ((f.airline_code || '').toUpperCase() !== filterAirline.toUpperCase()) return false;
      }
      if (filterVendor !== 'ALL') {
        if (f.vendor_name !== filterVendor) return false;
      }
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase().trim();
        const str = `${f.origin} ${f.destination} ${f.airline_name || ''} ${f.airline_code || ''} ${f.vendor_name || ''} ${f.travel_date || ''} ${f.flight_number || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [data.recentFares, filterRoute, filterAirline, filterVendor, filterSearch]);

  const handlePublishAllFuture = async () => {
    const count = stats.unpublished_future_fares || 0;
    if (!count) return;
    if (!window.confirm(`Publish ${count} future fare(s) to the live B2B agent portal now?`)) {
      return;
    }
    try {
      const res = await api.publishAllFutureFares();
      if (res?.success) {
        alert(res.message || `Published ${res.updated_count || 0} fare(s) to the agent portal.`);
        loadDashboard();
        if (onRatesCleared) onRatesCleared();
      } else {
        alert(res?.error || 'Publish failed');
      }
    } catch (e) {
      console.error(e);
      alert('Connection error while publishing fares');
    }
  };

  const handleDeleteFare = async (fare) => {
    const label = `${fare.origin} → ${fare.destination} ${fare.airline_name || fare.airline_code} ₹${fare.net_fare}`;
    if (!window.confirm(`Delete ${label}? Same duplicate row bhi hat jayegi.`)) return;
    try {
      const res = await api.deleteFare(fare.id);
      if (res?.success && (res.deleted_count || 0) > 0) {
        setData((prev) => ({
          ...prev,
          recentFares: (prev.recentFares || []).filter((row) => row.id !== fare.id)
        }));
        loadDashboard();
        if (onRatesCleared) onRatesCleared();
      } else {
        alert(res?.error || 'Delete save nahi hua. Page refresh karke dubara trash dabayein.');
      }
    } catch (e) {
      console.error(e);
      alert('Delete failed');
    }
  };

  const handleClearAllFares = async () => {
    if (!window.confirm('⚠️ Are you sure you want to delete all fare records and history? (Airlines, Vendors, Routes will remain safe)')) {
      return;
    }
    try {
      const res = await api.clearAllFares();
      if (res.success) {
        loadDashboard();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-3">
      {/* Sleek Compact Header Bar */}
      <div className="bg-slate-900 rounded-xl px-4 py-2.5 text-white shadow-xs border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600/30 p-1.5 rounded-lg border border-blue-500/40">
            <Plane className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                B2B Special Fare Desk
              </h1>
              <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                v1.0 Live
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('final-rates')}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1 cursor-pointer"
            title="Open Final Selling Rates Desk"
          >
            <span>📊 Final Rates</span>
          </button>
          <button
            onClick={() => setActiveTab('all-rates')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <span>All Rates</span>
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1 cursor-pointer"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Fares</span>
          </button>
          <button
            onClick={() => setActiveTab('fast-entry')}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center space-x-1 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>+ Add Fare</span>
          </button>
          <button
            onClick={() => setShowClearModal(true)}
            className="px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white text-xs font-semibold rounded-lg border border-rose-800/80 transition flex items-center space-x-1 cursor-pointer"
            title="Clear all rates or clear a specific vendor"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Clear</span>
          </button>
          <button
            onClick={loadDashboard}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {(stats.unpublished_future_fares || 0) > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-amber-950 font-medium">
            <span className="font-black">{stats.unpublished_future_fares}</span> future fare(s) are saved but{' '}
            <span className="font-black">not visible</span> on the public agent portal until published.
          </div>
          <button
            type="button"
            onClick={handlePublishAllFuture}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
          >
            Publish All to Agent Portal
          </button>
        </div>
      )}

      {/* Recently Updated Fares with Compact Header, Dropdown Filters & Quick Favs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Compact Header Bar with Dropdown Filters */}
        <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
          {/* Title & Live Count */}
          <div className="flex items-center space-x-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">Recently Updated Fares</h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
              {filteredRecentFares.length} / {(data.recentFares || []).length} Fares
            </span>
          </div>

          {/* Dropdown Filters Bar ("drop down filter") */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Sector Dropdown Filter */}
            <div className="relative">
              <select
                value={filterRoute}
                onChange={(e) => setFilterRoute(e.target.value)}
                className="pl-2 pr-6 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:border-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none shadow-2xs"
              >
                <option value="ALL">All Sectors</option>
                {uniqueRoutes.map(r => (
                  <option key={r} value={r}>{r.replace('-', ' ➔ ')}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            {/* Airline Dropdown Filter */}
            <div className="relative">
              <select
                value={filterAirline}
                onChange={(e) => setFilterAirline(e.target.value)}
                className="pl-2 pr-6 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:border-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none shadow-2xs"
              >
                <option value="ALL">All Airlines</option>
                {uniqueAirlines.map(a => (
                  <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            {/* Vendor Dropdown Filter */}
            <div className="relative">
              <select
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
                className="pl-2 pr-6 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:border-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none shadow-2xs"
              >
                <option value="ALL">All Vendors</option>
                {uniqueVendors.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            {/* Quick Text Search Box */}
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search..."
                className="w-24 sm:w-32 pl-6 pr-5 py-1 bg-white border border-slate-300 rounded-md text-xs placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-2xs"
              />
              {filterSearch && (
                <button
                  onClick={() => setFilterSearch('')}
                  className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Reset Filter Button */}
            {(filterRoute !== 'ALL' || filterAirline !== 'ALL' || filterVendor !== 'ALL' || filterSearch) && (
              <button
                type="button"
                onClick={() => {
                  setFilterRoute('ALL');
                  setFilterAirline('ALL');
                  setFilterVendor('ALL');
                  setFilterSearch('');
                }}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md text-xs font-bold border border-rose-200 transition cursor-pointer"
                title="Reset all filters"
              >
                Reset
              </button>
            )}

            <button
              onClick={() => setActiveTab('compare')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 ml-1 whitespace-nowrap"
            >
              Compare Desk →
            </button>
          </div>
        </div>

        {/* Favorite Routes Slim Strip (Single compact row) */}
        {data.favoriteRoutes && data.favoriteRoutes.length > 0 && (
          <div className="px-3 py-1 bg-white border-b border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5 mr-0.5">
              ⭐ Favs:
            </span>
            {data.favoriteRoutes.map((r, i) => {
              const rKey = `${r.origin}-${r.destination}`;
              const isSelected = filterRoute === rKey;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setFilterRoute(isSelected ? 'ALL' : rKey);
                  }}
                  className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded border transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                      : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
                  }`}
                  title={`Filter by ${r.origin} → ${r.destination}`}
                >
                  <span>{r.origin} → {r.destination}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Travel Date</th>
                <th className="px-4 py-2.5 text-left">Route</th>
                <th className="px-4 py-2.5 text-left">Airline</th>
                <th className="px-4 py-2.5 text-left">Vendor / Source</th>
                <th className="px-4 py-2.5 text-right font-bold text-blue-700">Fare (₹)</th>
                <th className="px-4 py-2.5 text-center">Baggage</th>
                <th className="px-4 py-2.5 text-center">Refundable</th>
                <th className="px-4 py-2.5 text-center">Published</th>
                <th className="px-4 py-2.5 text-right">Updated</th>
                <th className="px-2 py-2.5 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRecentFares.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
                    {data.recentFares.length > 0
                      ? 'No fares matching current dropdown filters. Click Reset to show all.'
                      : 'No fares entered yet today. Click "+ Add Fare" or "WhatsApp Paste" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredRecentFares.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {f.travel_date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-blue-700">{f.origin}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="font-bold text-blue-700">{f.destination}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-slate-800">{f.airline_name || f.airline_code}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                      {f.vendor_name}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700 whitespace-nowrap text-sm">
                      ₹{Number(f.net_fare).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        (f.baggage || '').includes('30') ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800 font-bold'
                      }`}>
                        {f.baggage || '30kg'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        f.is_refundable === 'REFUNDABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {f.is_refundable === 'REFUNDABLE' ? 'Refundable' : 'Non-Ref'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {f.is_published ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          YES
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 text-[11px] whitespace-nowrap">
                      {f.updated_at ? f.updated_at.split(' ')[1]?.slice(0, 5) || f.updated_at : ''}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteFare(f)}
                        className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                        title="Delete this fare"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear Rates Modal */}
      <ClearRatesModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        vendors={vendors}
        onRatesCleared={() => {
          loadDashboard();
          if (onRatesCleared) onRatesCleared();
        }}
      />
    </div>
  );
}
