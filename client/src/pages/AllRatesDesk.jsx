import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Plane, Calendar, Filter, ArrowUpDown, RefreshCw, 
  Download, Search, Check, AlertCircle, Edit3, Trash2, 
  TrendingDown, TrendingUp, Sparkles, X, ArrowRight, Zap, 
  Layers, Clock, DollarSign, Tag, CheckCircle2, SlidersHorizontal,
  ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { api } from '../utils/api';
import { getAirlineName } from '../utils/airlineHelper';
import { formatRouteName, getCityName } from '../utils/airportHelper';
import ClearRatesModal from '../components/ClearRatesModal';

export default function AllRatesDesk({ masterData = {}, setActiveTab, faresRefreshKey }) {
  const { vendors = [], airlines = [], routes = [] } = masterData;

  const [fares, setFares] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    updated_today: 0,
    dropped_today: 0,
    increased_today: 0
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedFareIds, setSelectedFareIds] = useState(new Set());

  // Density mode: 'compact' (maximum rows) vs 'normal'
  const [density, setDensity] = useState('compact');
  // Collapsible advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Font Size Zoom Level: default 12px (saved in localStorage)
  const [fontSizeLevel, setFontSizeLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('travelx_rates_font_size');
      return saved ? Math.min(18, Math.max(9, Number(saved))) : 12;
    } catch (e) {
      return 12;
    }
  });

  const handleIncreaseFont = () => {
    setFontSizeLevel(prev => {
      const next = Math.min(prev + 1, 20);
      try { localStorage.setItem('travelx_rates_font_size', next); } catch (e) {}
      return next;
    });
  };

  const handleDecreaseFont = () => {
    setFontSizeLevel(prev => {
      const next = Math.max(prev - 1, 9);
      try { localStorage.setItem('travelx_rates_font_size', next); } catch (e) {}
      return next;
    });
  };

  const handleResetFont = () => {
    setFontSizeLevel(12);
    try { localStorage.setItem('travelx_rates_font_size', 12); } catch (e) {}
  };

  // Filters
  const [filters, setFilters] = useState({
    vendor_id: '',
    airline_code: '',
    origin: '',
    destination: '',
    date_from: '',
    date_to: '',
    min_fare: '',
    max_fare: '',
    update_filter: 'all', // 'all', 'today', 'dropped', 'increased', 'new'
    search: ''
  });

  // Sorting
  const [sortBy, setSortBy] = useState('route_date');

  // Edit Modal State
  const [editingFare, setEditingFare] = useState(null);
  const [editFareValue, setEditFareValue] = useState('');
  const [editBaggageValue, setEditBaggageValue] = useState('30+7 KG');
  const [savingEdit, setSavingEdit] = useState(false);

  // Load fares from API
  const loadFares = async () => {
    try {
      setLoading(true);
      const queryParams = {
        ...filters,
        sort_by: sortBy,
        limit: 1000
      };

      const res = await api.getAllFares(queryParams);
      if (res.success) {
        setFares(res.fares || []);
        if (res.stats) {
          setStats(res.stats);
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to load fares' });
      }
    } catch (err) {
      console.error('Error fetching all fares:', err);
      setStatus({ type: 'error', text: 'Error connecting to server' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFares();
  }, [filters, sortBy, faresRefreshKey]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      vendor_id: '',
      airline_code: '',
      origin: '',
      destination: '',
      date_from: '',
      date_to: '',
      min_fare: '',
      max_fare: '',
      update_filter: 'all',
      search: ''
    });
    setSortBy('route_date');
  };

  // Delete Fare
  const handleDeleteFare = async (id) => {
    if (!window.confirm('Are you sure you want to delete this fare?')) return;
    try {
      const res = await api.deleteFare(id);
      if (res.success) {
        setFares(prev => prev.filter(f => f.id !== id));
        setStatus({ type: 'success', text: 'Fare deleted successfully' });
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to delete fare' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Error deleting fare' });
    }
  };

  // Batch Row Selection Handlers
  const handleToggleSelect = (id) => {
    setSelectedFareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedFareIds.size === fares.length && fares.length > 0) {
      setSelectedFareIds(new Set());
    } else {
      setSelectedFareIds(new Set(fares.map(f => f.id)));
    }
  };

  const handleDeleteSelectedFares = async () => {
    if (selectedFareIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedFareIds.size} selected fares?`)) return;
    try {
      setLoading(true);
      const res = await api.batchDeleteFares(Array.from(selectedFareIds));
      if (res.success) {
        setStatus({ type: 'success', text: `✅ Deleted ${res.deleted_count || selectedFareIds.size} selected fares.` });
        setSelectedFareIds(new Set());
        loadFares();
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to delete selected fares.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error deleting selected fares.' });
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (fare) => {
    setEditingFare(fare);
    setEditFareValue(fare.net_fare);
    setEditBaggageValue(fare.baggage || '30kg');
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingFare) return;
    const num = Number(editFareValue);
    if (!num || num <= 0) {
      alert('Please enter a valid fare amount');
      return;
    }
    try {
      setSavingEdit(true);
      const res = await api.updateFare(editingFare.id, {
        net_fare: num,
        baggage: editBaggageValue
      });
      if (res.success) {
        setEditingFare(null);
        setStatus({ type: 'success', text: `Rate updated for ${editingFare.travel_date}!` });
        loadFares();
      } else {
        alert(res.error || 'Failed to update fare');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving updated fare');
    } finally {
      setSavingEdit(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (fares.length === 0) return;
    const headers = ['Vendor,Origin,Destination,Airline,Airline_Name,Travel_Date,Flight_No,Fare,Baggage,Updated_At'];
    const rows = fares.map(f => [
      `"${f.vendor_name || ''}"`,
      `"${f.origin || ''}"`,
      `"${f.destination || ''}"`,
      `"${f.airline_code || ''}"`,
      `"${f.airline_name || ''}"`,
      `"${f.travel_date || ''}"`,
      `"${f.flight_number || ''}"`,
      f.net_fare || 0,
      `"${f.baggage || ''}"`,
      `"${f.updated_at || ''}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TravelX_Live_Fares_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedVendor = vendors.find(v => String(v.id) === String(filters.vendor_id));
  const activeFiltersCount = Object.values(filters).filter(v => v !== '' && v !== 'all').length;

  return (
    <div className="space-y-2 animate-fade-in flex flex-col h-[calc(100vh-100px)]">
      
      {/* ============================================================ */}
      {/* 1. SLEEK COMPACT HEADER & INLINE STATS CHIP STRIP */}
      {/* ============================================================ */}
      <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left: Title + Inline Stats Chips */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-600 rounded-lg text-white">
              <Layers className="w-4 h-4" />
            </span>
            <span className="text-sm font-black tracking-tight text-white">
              All Rates Desk
            </span>
          </div>

          {/* Inline Stats Chips */}
          <div className="flex items-center space-x-1.5 text-xs font-bold">
            {/* Total Rates */}
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
              <span className="text-slate-400 font-normal">Total:</span>
              <span className="font-mono text-white font-black">{stats.total || fares.length}</span>
            </span>

            {/* Updated Today */}
            <button
              type="button"
              onClick={() => handleFilterChange('update_filter', filters.update_filter === 'today' ? 'all' : 'today')}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-bold transition cursor-pointer border ${
                filters.update_filter === 'today'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black ring-2 ring-amber-400/50'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
              }`}
              title="Click to toggle Today's Updated Rates"
            >
              <span>⚡ Today:</span>
              <span className="font-mono">{stats.updated_today || 0}</span>
            </button>

            {/* Dropped (Cheaper) */}
            <button
              type="button"
              onClick={() => handleFilterChange('update_filter', filters.update_filter === 'dropped' ? 'all' : 'dropped')}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-bold transition cursor-pointer border ${
                filters.update_filter === 'dropped'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black ring-2 ring-emerald-400/50'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
              title="Click to filter Price Dropped fares"
            >
              <TrendingDown className="w-3 h-3" />
              <span>Dropped:</span>
              <span className="font-mono">{stats.dropped_today || 0}</span>
            </button>

            {/* Increased */}
            <button
              type="button"
              onClick={() => handleFilterChange('update_filter', filters.update_filter === 'increased' ? 'all' : 'increased')}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-bold transition cursor-pointer border ${
                filters.update_filter === 'increased'
                  ? 'bg-rose-500 text-white border-rose-400 font-black ring-2 ring-rose-400/50'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
              }`}
              title="Click to filter Price Hiked fares"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Hiked:</span>
              <span className="font-mono">{stats.increased_today || 0}</span>
            </button>
          </div>
        </div>

        {/* Right: Quick Action Buttons + Density Selector + Font Size Controls */}
        <div className="flex items-center space-x-2">
          {/* Density Toggle */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                density === 'compact' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Compact View (Maximum Rates on Screen)"
            >
              📏 Compact (Max Rows)
            </button>
            <button
              type="button"
              onClick={() => setDensity('normal')}
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                density === 'normal' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Normal View"
            >
              Comfortable
            </button>
          </div>

          {/* Font Size Zoom Controller: A- / 12px / A+ */}
          <div className="flex items-center bg-blue-950 border border-blue-400 rounded-lg p-0.5 text-xs font-bold shadow-xs">
            <span className="text-[10px] uppercase font-black text-blue-300 px-1 hidden sm:inline">Size:</span>
            <button
              type="button"
              onClick={handleDecreaseFont}
              disabled={fontSizeLevel <= 9}
              className="px-2 py-0.5 rounded bg-blue-800 hover:bg-blue-600 text-white transition cursor-pointer disabled:opacity-30 font-black"
              title="Decrease Font Size (A-)"
            >
              A−
            </button>
            <button
              type="button"
              onClick={handleResetFont}
              className="px-1.5 py-0.5 text-[11px] font-mono font-black text-amber-300 hover:text-amber-200 transition cursor-pointer"
              title="Click to reset font size to default 12px"
            >
              {fontSizeLevel}px
            </button>
            <button
              type="button"
              onClick={handleIncreaseFont}
              disabled={fontSizeLevel >= 20}
              className="px-2 py-0.5 rounded bg-blue-800 hover:bg-blue-600 text-white transition cursor-pointer disabled:opacity-30 font-black"
              title="Increase Font Size (A+)"
            >
              A+
            </button>
          </div>

          <button
            type="button"
            onClick={loadFares}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition flex items-center space-x-1 cursor-pointer"
            title="Refresh All Rates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={fares.length === 0}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
            title="Export to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white text-xs font-bold rounded-lg border border-rose-800/80 transition flex items-center space-x-1 cursor-pointer"
            title="Clear all rates or clear a specific vendor"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Clear Rates</span>
          </button>

          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab('compare')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg transition flex items-center space-x-1 cursor-pointer shadow-xs"
              title="Go to Comparison Desk"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Compare Lowest</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {status && (
        <div className={`px-3 py-1.5 rounded-lg flex items-center justify-between text-xs font-bold animate-fade-in shrink-0 ${
          status.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' 
            : 'bg-rose-50 text-rose-900 border border-rose-300'
        }`}>
          <div className="flex items-center space-x-2">
            {status.type === 'success' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
            <span>{status.text}</span>
          </div>
          <button onClick={() => setStatus(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. ULTRA-COMPACT TOOLBAR: FILTERS + SORTING */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-xs space-y-2 shrink-0">
        
        {/* ROW 1: PRIMARY FILTER CONTROLS (TIGHT INLINE BAR) */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Vendor / Agent */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filters.vendor_id}
              onChange={(e) => handleFilterChange('vendor_id', e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer max-w-[150px]"
            >
              <option value="">🏢 All Vendors ({vendors.length})</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Delete Rates for Selected Vendor */}
          {filters.vendor_id && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-lg border border-rose-300 transition flex items-center space-x-1 cursor-pointer animate-fade-in shadow-2xs"
              title={`Delete updated or all rates for ${vendors.find(v => String(v.id) === String(filters.vendor_id))?.name || 'this vendor'}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete {vendors.find(v => String(v.id) === String(filters.vendor_id))?.name || 'Vendor'} Rates</span>
            </button>
          )}

          {/* Airline */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <Plane className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filters.airline_code}
              onChange={(e) => handleFilterChange('airline_code', e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer max-w-[170px]"
            >
              <option value="">✈️ All Airlines ({airlines.length})</option>
              {airlines.map(a => (
                <option key={a.code} value={a.code}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>

          {/* Route: Origin & Destination */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400">Route:</span>
            <input
              type="text"
              value={filters.origin}
              onChange={(e) => handleFilterChange('origin', e.target.value.toUpperCase())}
              placeholder="FROM"
              maxLength={3}
              className="w-12 text-center text-xs font-black uppercase text-blue-700 bg-transparent outline-none"
            />
            <span className="text-slate-300 text-xs">➔</span>
            <input
              type="text"
              value={filters.destination}
              onChange={(e) => handleFilterChange('destination', e.target.value.toUpperCase())}
              placeholder="TO"
              maxLength={3}
              className="w-12 text-center text-xs font-black uppercase text-blue-700 bg-transparent outline-none"
            />
          </div>

          {/* Travel Date Range */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-0.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="text-xs text-slate-800 bg-transparent outline-none w-28 py-0.5"
              title="From Date"
            />
            <span className="text-slate-300 text-xs">-</span>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="text-xs text-slate-800 bg-transparent outline-none w-28 py-0.5"
              title="To Date"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filters.update_filter}
              onChange={(e) => handleFilterChange('update_filter', e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
            >
              <option value="all">🌐 All Status</option>
              <option value="today">⚡ Updated Today</option>
              <option value="dropped">🟢 Price Dropped</option>
              <option value="increased">🔴 Price Hiked</option>
              <option value="new">🆕 New Today</option>
            </select>
          </div>

          {/* Quick Search */}
          <div className="flex-1 min-w-[140px] flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search..."
              className="w-full text-xs text-slate-900 bg-transparent outline-none"
            />
            {filters.search && (
              <button onClick={() => handleFilterChange('search', '')} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition cursor-pointer"
              title="Reset all filters"
            >
              Reset ↺
            </button>
          )}
        </div>

        {/* ROW 2: SORT ORDER BUTTONS & COUNT */}
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center space-x-0.5">
              <ArrowUpDown className="w-3 h-3" />
              <span>Sort:</span>
            </span>

            {[
              { id: 'route_date', label: '🔀 Route & Date Wise' },
              { id: 'updated_desc', label: '🕒 Recently Updated' },
              { id: 'fare_asc', label: '💰 Lowest Fare' },
              { id: 'date_asc', label: '📅 Date (Earliest)' },
              { id: 'vendor_asc', label: '🏢 Vendor (A-Z)' },
              { id: 'airline_asc', label: '✈️ Airline (A-Z)' }
            ].map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSortBy(s.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  sortBy === s.id
                    ? 'bg-slate-900 text-white shadow-xs font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Text / Font Size Controls */}
            <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-300 rounded-lg px-2 py-0.5 shadow-xs">
              <span className="text-[11px] font-black text-amber-950 flex items-center space-x-1">
                <span>🔤 Text Size:</span>
              </span>
              <button
                type="button"
                onClick={handleDecreaseFont}
                disabled={fontSizeLevel <= 9}
                className="w-6 h-5 flex items-center justify-center rounded bg-white hover:bg-amber-600 hover:text-white text-amber-900 font-black border border-amber-300 transition cursor-pointer text-xs shadow-xs disabled:opacity-40"
                title="Font Chhota Karein (A-)"
              >
                A−
              </button>
              <button
                type="button"
                onClick={handleResetFont}
                className="px-1.5 h-5 flex items-center justify-center rounded bg-amber-500 text-slate-950 font-mono font-black text-[11px] shadow-xs cursor-pointer hover:bg-amber-400"
                title="Reset Font Size to default 12px"
              >
                {fontSizeLevel}px
              </button>
              <button
                type="button"
                onClick={handleIncreaseFont}
                disabled={fontSizeLevel >= 20}
                className="w-6 h-5 flex items-center justify-center rounded bg-white hover:bg-amber-600 hover:text-white text-amber-900 font-black border border-amber-300 transition cursor-pointer text-xs shadow-xs disabled:opacity-40"
                title="Font Bada Karein (A+)"
              >
                A+
              </button>
            </div>

            <div className="text-[11px] font-bold text-slate-500">
              Showing <strong className="text-slate-900 font-mono">{fares.length}</strong> active rates
            </div>
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* 3. HIGH-DENSITY RATES TABLE (MAXIMUM SCREEN VISIBILITY) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="py-16 text-center text-slate-400 space-y-2 my-auto">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
            <p className="text-xs font-bold">Loading rates...</p>
          </div>
        ) : fares.length === 0 ? (
          <div className="py-12 text-center space-y-2 px-4 my-auto">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">No matching rates found</h3>
            <p className="text-[11px] text-slate-500">Try changing or resetting filters.</p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto flex-1 h-full relative">
            {/* Multi-Selection Floating Action Banner */}
            {selectedFareIds.size > 0 && (
              <div className="bg-rose-950/95 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-20 shadow-md border-b border-rose-800 animate-fade-in text-xs font-bold">
                <div className="flex items-center space-x-2.5">
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono font-black text-xs shadow-2xs">
                    {selectedFareIds.size}
                  </span>
                  <span>rates selected for deletion</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFareIds(new Set())}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedFares}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg transition cursor-pointer shadow-sm flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedFareIds.size}) Rates</span>
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left border-collapse" style={{ fontSize: `${fontSizeLevel}px` }}>
              <thead 
                className="bg-slate-900 text-white uppercase font-black tracking-wider sticky top-0 z-10 shadow-xs"
                style={{ fontSize: `${Math.max(9, Math.round(fontSizeLevel * 0.82))}px` }}
              >
                <tr>
                  <th className="px-2 py-1.5 text-slate-400 text-center w-12">
                    <div className="flex items-center justify-center space-x-1">
                      <input
                        type="checkbox"
                        checked={fares.length > 0 && selectedFareIds.size === fares.length}
                        onChange={handleSelectAll}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                        title="Select All / Deselect All"
                      />
                      <span className="text-[10px]">#</span>
                    </div>
                  </th>
                  <th 
                    className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-800 transition"
                    onClick={() => setSortBy(sortBy === 'vendor_asc' ? 'updated_desc' : 'vendor_asc')}
                    title="Click to sort by Vendor"
                  >
                    Vendor / Agent ↕
                  </th>
                  <th 
                    className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-800 transition"
                    onClick={() => setSortBy('route_date')}
                    title="Click to sort by Route"
                  >
                    Route ↕
                  </th>
                  <th 
                    className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-800 transition"
                    onClick={() => setSortBy(sortBy === 'airline_asc' ? 'updated_desc' : 'airline_asc')}
                    title="Click to sort by Airline"
                  >
                    Airline ↕
                  </th>
                  <th 
                    className="px-2.5 py-1.5 cursor-pointer hover:bg-slate-800 transition"
                    onClick={() => setSortBy(sortBy === 'date_asc' ? 'date_desc' : 'date_asc')}
                    title="Click to sort by Date"
                  >
                    Travel Date ↕
                  </th>
                  <th 
                    className="px-2.5 py-1.5 text-right cursor-pointer hover:bg-slate-800 transition"
                    onClick={() => setSortBy(sortBy === 'fare_asc' ? 'fare_desc' : 'fare_asc')}
                    title="Click to sort by Net Fare"
                  >
                    Net Fare (₹) ↕
                  </th>
                  <th className="px-2.5 py-1.5 text-center">Status / Update</th>
                  <th className="px-2.5 py-1.5 text-right w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-sans">
                {fares.map((f, index) => {
                  const hasHistory = f.last_fare_diff !== null && f.last_fare_diff !== undefined && f.last_fare_diff !== 0;
                  const isDropped = hasHistory && f.last_fare_diff < 0;
                  const isHiked = hasHistory && f.last_fare_diff > 0;
                  const isUpdatedToday = f.updated_at && f.updated_at.slice(0, 10) === new Date().toISOString().slice(0, 10);
                  const isEven = index % 2 === 1;

                  const py = density === 'compact' ? 'py-1' : 'py-2';
                  const badgeFontSize = Math.max(9, Math.round(fontSizeLevel * 0.78));
                  const subFontSize = Math.max(9, Math.round(fontSizeLevel * 0.85));

                  return (
                    <tr 
                      key={f.id} 
                      className={`hover:bg-blue-50/70 transition-colors ${selectedFareIds.has(f.id) ? 'bg-rose-50/70' : isEven ? 'bg-slate-50/40' : 'bg-white'}`}
                      style={{ fontSize: `${fontSizeLevel}px` }}
                      title={`Vendor: ${f.vendor_name} | Route: ${f.origin}➔${f.destination} | Baggage: ${f.baggage || '30kg'} | Updated: ${f.updated_at || '-'}`}
                    >
                      {/* # & Checkbox */}
                      <td className={`px-2 ${py} text-slate-400 font-mono text-center w-12`} style={{ fontSize: `${subFontSize}px` }}>
                        <div className="flex items-center justify-center space-x-1.5">
                          <input
                            type="checkbox"
                            checked={selectedFareIds.has(f.id)}
                            onChange={() => handleToggleSelect(f.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                          />
                          <span>{index + 1}</span>
                        </div>
                      </td>

                      {/* Vendor / Agent */}
                      <td className={`px-2.5 ${py} whitespace-nowrap`}>
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="text-slate-400 shrink-0" style={{ width: `${Math.max(12, fontSizeLevel)}px`, height: `${Math.max(12, fontSizeLevel)}px` }} />
                          <span className="font-bold text-slate-900">{f.vendor_name}</span>
                        </div>
                      </td>

                      {/* Route */}
                      <td className={`px-2.5 ${py} whitespace-nowrap`}>
                        <div className="font-bold text-blue-900 leading-tight">
                          {formatRouteName(f.origin, f.destination, 'TO', routes)}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {f.origin} ➔ {f.destination}
                        </div>
                      </td>

                      {/* Airline */}
                      <td className={`px-2.5 ${py} whitespace-nowrap`}>
                        <div className="flex items-center space-x-1.5">
                          <span 
                            className="px-1 py-0.2 rounded bg-slate-900 text-white font-mono font-black"
                            style={{ fontSize: `${badgeFontSize}px` }}
                          >
                            {f.airline_code}
                          </span>
                          <span className="font-bold text-slate-800 truncate max-w-[150px]" title={f.airline_name}>
                            {f.airline_name || getAirlineName(f.airline_code, airlines)}
                          </span>
                        </div>
                      </td>

                      {/* Travel Date */}
                      <td className={`px-2.5 ${py} font-semibold text-slate-900 whitespace-nowrap font-mono`}>
                        {f.travel_date}
                      </td>

                      {/* Net Fare + Inline Price Difference Badge */}
                      <td className={`px-2.5 ${py} text-right whitespace-nowrap`}>
                        <div className="flex items-center justify-end space-x-1.5">
                          <span className="font-black text-slate-950 font-mono tabular-nums" style={{ fontSize: `${fontSizeLevel + 1}px` }}>
                            ₹{Number(f.net_fare).toLocaleString('en-IN')}
                          </span>
                          {hasHistory && (
                            <span 
                              className={`font-bold px-1 rounded ${
                                isDropped ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                              }`}
                              style={{ fontSize: `${subFontSize}px` }}
                            >
                              {isDropped ? '▼' : '▲'}₹{Math.abs(f.last_fare_diff).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status / Update Badge */}
                      <td 
                        className={`px-2.5 ${py} text-center whitespace-nowrap`}
                        title={`Baggage: ${f.baggage || '30kg'} | Last Updated: ${f.updated_at || '-'}`}
                      >
                        {isDropped ? (
                          <span 
                            className="inline-flex items-center px-1.5 py-0.2 rounded font-black bg-emerald-100 text-emerald-800 border border-emerald-300"
                            style={{ fontSize: `${badgeFontSize}px` }}
                          >
                            ▼ DROPPED
                          </span>
                        ) : isHiked ? (
                          <span 
                            className="inline-flex items-center px-1.5 py-0.2 rounded font-black bg-rose-100 text-rose-800 border border-rose-300"
                            style={{ fontSize: `${badgeFontSize}px` }}
                          >
                            ▲ HIKED
                          </span>
                        ) : isUpdatedToday ? (
                          <span 
                            className="inline-flex items-center px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300"
                            style={{ fontSize: `${badgeFontSize}px` }}
                          >
                            ⚡ TODAY
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center px-1.5 py-0.2 rounded text-slate-400 bg-slate-100"
                            style={{ fontSize: `${badgeFontSize}px` }}
                          >
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className={`px-2.5 ${py} text-right whitespace-nowrap`}>
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(f)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="Quick Edit Rate"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFare(f.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Delete Fare"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. EDIT FARE MODAL */}
      {/* ============================================================ */}
      {editingFare && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
                  <Edit3 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Update Rate</h3>
                  <p className="text-[11px] text-slate-500">
                    {editingFare.origin} ➔ {editingFare.destination} | {editingFare.travel_date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingFare(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Vendor / Head</label>
                <input
                  type="text"
                  disabled
                  value={editingFare.vendor_name || ''}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Net Fare (₹) *</label>
                <input
                  type="number"
                  value={editFareValue}
                  onChange={(e) => setEditFareValue(e.target.value)}
                  className="w-full bg-white border-2 border-indigo-500 rounded-lg px-2.5 py-1.5 text-sm font-black text-slate-900 focus:outline-none"
                  placeholder="e.g. 15000"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Original: ₹{Number(editingFare.net_fare).toLocaleString('en-IN')}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Baggage Allowance</label>
                <input
                  type="text"
                  value={editBaggageValue}
                  onChange={(e) => setEditBaggageValue(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs"
                  placeholder="e.g. 30kg or 30 + 07 KG"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingFare(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg transition cursor-pointer shadow-xs flex items-center space-x-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{savingEdit ? 'Updating...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Rates Modal */}
      <ClearRatesModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        vendors={vendors}
        defaultVendorId={filters.vendor_id}
        defaultOrigin={filters.origin}
        defaultDestination={filters.destination}
        initialScope={filters.update_filter === 'today' ? 'today' : 'today'}
        onRatesCleared={() => {
          setSelectedFareIds(new Set());
          loadFares();
          setStatus({ type: 'success', text: 'Rates successfully cleared.' });
        }}
      />
    </div>
  );
}
