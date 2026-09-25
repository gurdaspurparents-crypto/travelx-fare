import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, FileSpreadsheet, Building2, Plus, Check, AlertCircle, 
  Plane, ArrowRight, Save, Zap, Filter, Trash2, Calendar, RefreshCw 
} from 'lucide-react';
import { api } from '../utils/api';
import { getAirlineName } from '../utils/airlineHelper';

export default function ExcelImportModal({ 
  isOpen, 
  onClose, 
  parsedResult, 
  masterData = {}, 
  onFaresSaved, 
  onNavigateToCompare 
}) {
  if (!isOpen || !parsedResult) return null;

  const { vendors = [], airlines = [] } = masterData;

  // Selected Vendor
  const [selectedVendorId, setSelectedVendorId] = useState(() => {
    try {
      const saved = localStorage.getItem('travelx_active_vendor_id');
      if (saved) return saved;
    } catch (_) {}
    return '';
  });
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [addingVendorLoading, setAddingVendorLoading] = useState(false);

  // Editable rows list
  const [rows, setRows] = useState(parsedResult.rows || []);
  const [selectedFilterKey, setSelectedFilterKey] = useState('ALL');

  // Fallbacks if Excel has missing routes or airlines
  const [fallbackOrigin, setFallbackOrigin] = useState('ATQ');
  const [fallbackDestination, setFallbackDestination] = useState('DXB');
  const [fallbackAirline, setFallbackAirline] = useState('AI');

  // State
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Sync rows whenever a new parsed result is provided
  useEffect(() => {
    if (parsedResult && parsedResult.rows) {
      setRows(parsedResult.rows);
      setSelectedFilterKey('ALL');
      setSaveSuccess(null);
      setError(null);
    }
  }, [parsedResult]);

  // Set default vendor if available from active selection or fallback
  useEffect(() => {
    if (vendors.length > 0 && !selectedVendorId) {
      let saved = '';
      try {
        saved = localStorage.getItem('travelx_active_vendor_id') || '';
      } catch (_) {}
      const exists = vendors.some(v => String(v.id) === String(saved));
      if (saved && exists) {
        setSelectedVendorId(saved);
      } else if (vendors[0]?.id) {
        setSelectedVendorId(vendors[0].id);
      }
    }
  }, [vendors, selectedVendorId]);

  // Handle adding new vendor inline
  const handleCreateNewVendor = async (e) => {
    e.preventDefault();
    if (!newVendorName.trim()) {
      setError('Please enter a vendor name.');
      return;
    }
    try {
      setAddingVendorLoading(true);
      setError(null);
      const res = await api.createVendor({
        name: newVendorName.trim(),
        phone: newVendorPhone.trim(),
        is_active: 1
      });
      if (res.success && res.vendor) {
        setSelectedVendorId(res.vendor.id);
        setIsAddingVendor(false);
        setNewVendorName('');
        setNewVendorPhone('');
        if (masterData.vendors) {
          masterData.vendors.push(res.vendor);
        }
      } else {
        setError(res.error || 'Failed to create vendor.');
      }
    } catch (err) {
      setError('Error creating vendor.');
    } finally {
      setAddingVendorLoading(false);
    }
  };

  // Group stats calculation
  const groups = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const orig = r.origin || fallbackOrigin;
      const dest = r.destination || fallbackDestination;
      const air = r.airline_code || fallbackAirline;
      const key = `${orig}-${dest}_${air}`;

      if (!map[key]) {
        map[key] = {
          key,
          route: `${orig}-${dest}`,
          origin: orig,
          destination: dest,
          airline_code: air,
          count: 0,
          minFare: Infinity,
          maxFare: -Infinity,
          dates: []
        };
      }
      const g = map[key];
      g.count++;
      g.dates.push(r.travel_date);
      if (r.net_fare < g.minFare) g.minFare = r.net_fare;
      if (r.net_fare > g.maxFare) g.maxFare = r.net_fare;
    });

    return Object.values(map).map(g => {
      g.dates.sort();
      return {
        ...g,
        minDate: g.dates[0],
        maxDate: g.dates[g.dates.length - 1]
      };
    });
  }, [rows, fallbackOrigin, fallbackDestination, fallbackAirline]);

  // Filtered rows for preview table
  const displayedRows = useMemo(() => {
    if (selectedFilterKey === 'ALL') return rows;
    return rows.filter(r => {
      const orig = r.origin || fallbackOrigin;
      const dest = r.destination || fallbackDestination;
      const air = r.airline_code || fallbackAirline;
      return `${orig}-${dest}_${air}` === selectedFilterKey;
    });
  }, [rows, selectedFilterKey, fallbackOrigin, fallbackDestination, fallbackAirline]);

  // Inline row edits
  const handleUpdateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDeleteRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Save all rows to Database under selected Vendor
  const handleSaveFares = async (autoNavigateToCompare = false) => {
    if (!selectedVendorId) {
      setError('Pehle vendor select karein (Please select which vendor this Excel belongs to).');
      return;
    }

    if (rows.length === 0) {
      setError('No valid fare rows to save.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSaveProgress('Preparing Excel fares…');

      const formattedFares = rows.map(r => ({
        airline_code: (r.airline_code || fallbackAirline).toUpperCase(),
        origin: (r.origin || fallbackOrigin).toUpperCase(),
        destination: (r.destination || fallbackDestination).toUpperCase(),
        flight_number: r.flight_number || '',
        travel_date: r.travel_date,
        net_fare: Number(r.net_fare),
        cabin: r.cabin || 'ECONOMY',
        baggage: r.baggage || '30kg',
        is_refundable: r.is_refundable || 'NON_REFUNDABLE',
        remarks: `Excel Import: ${parsedResult.fileName || ''}`
      }));

      const res = await api.saveBulkFares(
        Number(selectedVendorId),
        formattedFares,
        false,
        'sector',
        (p) => setSaveProgress(p.label || `Saving batch ${p.current}/${p.total}…`)
      );

      if (res.success) {
        const vendorObj = vendors.find(v => v.id === Number(selectedVendorId));
        const vendorName = vendorObj ? vendorObj.name : `Vendor #${selectedVendorId}`;

        setSaveSuccess({
          count: res.saved_count || formattedFares.length,
          vendorName,
          routeCount: groups.length,
          deletedCount: res.deleted_count || 0,
          warning: res.warning || null
        });

        if (onFaresSaved) onFaresSaved();

        if (autoNavigateToCompare && onNavigateToCompare) {
          setTimeout(() => {
            onClose();
            onNavigateToCompare();
          }, 600);
        }
      } else {
        setError(res.error || 'Failed to save fares into database.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Server error saving fares to database.');
    } finally {
      setSaving(false);
      setSaveProgress('');
    }
  };

  const selectedVendor = vendors.find(v => v.id === Number(selectedVendorId));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white flex items-center justify-between border-b border-emerald-800/80 shrink-0">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">
                  Excel Import & Vendor Assignment Wizard
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  {parsedResult.fileName}
                </span>
              </div>
              <p className="text-xs text-emerald-200/80">
                Pehle vendor select karein, fir multi-route aur multi-airline rates database mein update karein.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Success Banner */}
          {saveSuccess && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-emerald-900 animate-scale-up">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    🎉 Successfully saved {saveSuccess.count} fares for vendor "{saveSuccess.vendorName}"!
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Updated across {saveSuccess.routeCount} sector/airline groups. Data is now live for automatic comparison.
                  </p>
                  {saveSuccess.deletedCount > 0 && (
                    <p className="mt-1 text-xs font-bold text-amber-700 bg-amber-100/70 border border-amber-300/80 px-2.5 py-1 rounded-md inline-block">
                      🧹 {saveSuccess.deletedCount} purani dates jo is nayi sheet me nahi thi unhe automatically delete kar diya gaya hai (Sold-out removed).
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-lg border border-slate-300 transition"
                >
                  Import Another Sheet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigateToCompare) onNavigateToCompare();
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Go to Comparison Desk (Sorted)</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: KIS VENDOR KI EXCEL HAI? */}
          <div className="bg-slate-50 border-2 border-emerald-200 rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 mb-4 gap-2">
              <div className="flex items-center space-x-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold">
                  1
                </span>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>Kis Vendor ki Excel Sheet hai? (Assign Vendor)</span>
                  <span className="text-rose-500">*</span>
                </h3>
              </div>

              {!isAddingVendor && (
                <button
                  type="button"
                  onClick={() => setIsAddingVendor(true)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Quick Add New Vendor</span>
                </button>
              )}
            </div>

            {isAddingVendor ? (
              <form onSubmit={handleCreateNewVendor} className="bg-white p-4 rounded-xl border border-emerald-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Add New B2B Vendor
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingVendor(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Vendor Name *</label>
                    <input
                      type="text"
                      value={newVendorName}
                      onChange={(e) => setNewVendorName(e.target.value)}
                      placeholder="e.g. Fly24hrs, Riya Travels, TBO"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Phone / WhatsApp (Optional)</label>
                    <input
                      type="text"
                      value={newVendorPhone}
                      onChange={(e) => setNewVendorPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingVendor(false)}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingVendorLoading}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    {addingVendorLoading ? 'Adding...' : 'Create & Select Vendor'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-8">
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full bg-white border-2 border-emerald-500 rounded-xl px-4 py-3 text-sm font-black text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Vendor from List --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        🏢 {v.name} {v.phone ? `(${v.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4 bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <span className="font-bold text-slate-800 block">
                    Active Vendor: <span className="text-emerald-700">{selectedVendor?.name || 'None selected'}</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Is Excel sheet ke saare rates is vendor ke account mein save honge.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: MULTI-ROUTE & MULTI-AIRLINE DETECTION BREAKDOWN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                  2
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Detected Sectors & Airlines ({groups.length} Groups Found)
                </h3>
              </div>

              <span className="text-xs font-bold text-slate-500">
                Total Valid Fares: <strong className="text-slate-900">{rows.length}</strong>
              </span>
            </div>

            {/* Sector / Airline Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {groups.map(g => {
                const isSelected = selectedFilterKey === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setSelectedFilterKey(isSelected ? 'ALL' : g.key)}
                    className={`p-3.5 rounded-xl border text-left transition relative ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-xs text-slate-900 flex items-center space-x-1.5">
                        <Plane className="w-3.5 h-3.5 text-blue-600" />
                        <span>{g.origin} ➔ {g.destination}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {getAirlineName(g.airline_code, airlines)}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center justify-between">
                      <span>{g.count} Dates</span>
                      <span className="font-black text-emerald-700">
                        ₹{g.minFare.toLocaleString('en-IN')} - ₹{g.maxFare.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1 truncate">
                      📅 {g.minDate} to {g.maxDate}
                    </div>

                    {isSelected && (
                      <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedFilterKey !== 'ALL' && (
              <div className="flex items-center justify-between bg-blue-50 px-3 py-1.5 rounded-lg text-xs text-blue-800">
                <span>Filtering preview table for: <strong>{selectedFilterKey}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedFilterKey('ALL')}
                  className="font-bold underline hover:text-blue-950"
                >
                  Show All {rows.length} Rows
                </button>
              </div>
            )}
          </div>

          {/* STEP 3: PREVIEW TABLE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-white text-xs font-bold">
                  3
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Fare Records Preview ({displayedRows.length} shown)
                </h3>
              </div>

              <span className="text-[11px] text-slate-400">
                You can directly edit any Date or Net Fare before saving.
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Travel Date</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">To</th>
                    <th className="px-3 py-2">Airline</th>
                    <th className="px-3 py-2">Net Fare (₹)</th>
                    <th className="px-3 py-2">Baggage</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {displayedRows.map((r, i) => (
                    <tr key={r.id || `excel_row_${i}_${r.travel_date || ''}_${r.origin || ''}`} className="hover:bg-slate-50 transition">
                      <td className="px-3 py-1.5 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <input
                          type="date"
                          value={r.travel_date || ''}
                          onChange={(e) => handleUpdateRow(r.id, 'travel_date', e.target.value)}
                          className="bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 font-medium text-slate-900"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={r.origin || ''}
                          onChange={(e) => handleUpdateRow(r.id, 'origin', e.target.value.toUpperCase())}
                          className="w-14 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 font-bold uppercase text-slate-900"
                          maxLength={3}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={r.destination || ''}
                          onChange={(e) => handleUpdateRow(r.id, 'destination', e.target.value.toUpperCase())}
                          className="w-14 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 font-bold uppercase text-slate-900"
                          maxLength={3}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={r.airline_code || ''}
                          onChange={(e) => handleUpdateRow(r.id, 'airline_code', e.target.value.toUpperCase())}
                          className="bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 font-bold text-slate-900"
                        >
                          {airlines.map(a => (
                            <option key={a.code} value={a.code}>{a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="relative flex items-center">
                          <span className="text-slate-400 font-bold mr-1">₹</span>
                          <input
                            type="number"
                            value={r.net_fare !== undefined && r.net_fare !== null ? r.net_fare : ''}
                            onChange={(e) => handleUpdateRow(r.id, 'net_fare', e.target.value)}
                            className="w-24 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 font-black text-slate-900"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-slate-600 font-mono text-[11px]">
                        {r.baggage || '30kg'}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(r.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete this row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            Target Vendor: <strong className="text-slate-900">{selectedVendor?.name || 'Please Select Vendor'}</strong> | Ready to save <strong className="text-emerald-700">{rows.length} fares</strong>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl border border-slate-300 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSaveFares(false)}
              disabled={saving || rows.length === 0 || !selectedVendorId}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              <span>{saving ? (saveProgress || 'Saving…') : `Save ${rows.length} Fares`}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveFares(true)}
              disabled={saving || rows.length === 0 || !selectedVendorId}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center space-x-2 disabled:opacity-50"
              title="Save and immediately navigate to Comparison Desk"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>{saving ? (saveProgress || 'Saving…') : '⚡ Save & Sort (Comparison Desk)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
