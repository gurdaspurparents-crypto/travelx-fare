import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Building2, Check, X, ShieldAlert, Zap, Layers, RefreshCw, Plane } from 'lucide-react';
import { api } from '../utils/api';
import { formatRouteName } from '../utils/airportHelper';

export default function ClearRatesModal({ 
  isOpen, 
  onClose, 
  vendors = [], 
  onRatesCleared, 
  defaultVendorId = '',
  defaultOrigin = '',
  defaultDestination = '',
  initialScope = 'today' // 'today' | 'all'
}) {
  const [mode, setMode] = useState('vendor'); // 'vendor' | 'all'
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedSector, setSelectedSector] = useState(''); // "" for all, or "ORIGIN-DESTINATION"
  const [vendorScope, setVendorScope] = useState('today'); // 'today' | 'all'
  const [vendorStats, setVendorStats] = useState({ total: 0, updated_today: 0, sectors: [], loading: false });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  // Sync state whenever modal opens or defaultVendorId changes
  useEffect(() => {
    if (isOpen) {
      setStatus(null);
      setLoading(false);
      const initialVendor = defaultVendorId || (vendors.length > 0 ? String(vendors[0].id) : '');
      setSelectedVendorId(initialVendor);
      if (defaultOrigin && defaultDestination) {
        setSelectedSector(`${defaultOrigin.toUpperCase()}-${defaultDestination.toUpperCase()}`);
      } else {
        setSelectedSector('');
      }
      setVendorScope(initialScope);
      setMode('vendor'); // Default to vendor mode for safety
    }
  }, [isOpen, defaultVendorId, defaultOrigin, defaultDestination, initialScope, vendors]);

  // Fetch vendor live stats whenever selectedVendorId changes
  useEffect(() => {
    if (isOpen && selectedVendorId && mode === 'vendor') {
      let isMounted = true;
      setVendorStats(prev => ({ ...prev, loading: true }));
      api.getVendorStats(selectedVendorId)
        .then(res => {
          if (isMounted) {
            if (res.success) {
              setVendorStats({ 
                total: res.total || 0, 
                updated_today: res.updated_today || 0, 
                sectors: res.sectors || [],
                loading: false 
              });
              // If vendor has today's updates, default to 'today', else 'all'
              if (res.updated_today > 0) {
                setVendorScope('today');
              } else {
                setVendorScope('all');
              }
            } else {
              setVendorStats({ total: 0, updated_today: 0, sectors: [], loading: false });
            }
          }
        })
        .catch(err => {
          if (isMounted) setVendorStats({ total: 0, updated_today: 0, sectors: [], loading: false });
        });
      return () => { isMounted = false; };
    }
  }, [isOpen, selectedVendorId, mode]);

  if (!isOpen) return null;

  const selectedVendor = vendors.find(v => String(v.id) === String(selectedVendorId));

  // Compute stats for current sector selection
  const activeSector = selectedSector 
    ? (vendorStats.sectors || []).find(s => `${s.origin}-${s.destination}` === selectedSector)
    : null;

  const totalInScope = activeSector ? activeSector.total : vendorStats.total;
  const todayInScope = activeSector ? activeSector.updated_today : vendorStats.updated_today;
  const deleteCount = vendorScope === 'today' ? todayInScope : totalInScope;

  const handleClear = async () => {
    try {
      setLoading(true);
      setStatus(null);

      if (mode === 'all') {
        const res = await api.clearAllFares();
        if (res.success) {
          setStatus({ type: 'success', text: '✅ All fares and price history have been cleared successfully.' });
          setTimeout(() => {
            if (onRatesCleared) onRatesCleared();
            onClose();
          }, 800);
        } else {
          setStatus({ type: 'error', text: res.error || 'Failed to clear all fares.' });
        }
      } else {
        if (!selectedVendorId) {
          setStatus({ type: 'error', text: 'Please select a vendor first.' });
          setLoading(false);
          return;
        }

        const isOnlyToday = vendorScope === 'today';
        const [selOrigin, selDest] = selectedSector ? selectedSector.split('-') : ['', ''];

        const res = await api.clearVendorFares(selectedVendorId, {
          only_today: isOnlyToday,
          origin: selOrigin || undefined,
          destination: selDest || undefined
        });

        if (res.success) {
          const vName = selectedVendor ? selectedVendor.name : 'Selected vendor';
          const scopeLabel = isOnlyToday ? "today's updated rates" : "rates";
          const sectorLabel = selectedSector ? ` on sector ${selectedSector}` : '';
          setStatus({ 
            type: 'success', 
            text: `✅ ${res.deleted_count || 0} ${scopeLabel} for ${vName}${sectorLabel} deleted successfully.` 
          });
          setTimeout(() => {
            if (onRatesCleared) onRatesCleared(selectedVendorId, isOnlyToday, selectedSector);
            onClose();
          }, 800);
        } else {
          setStatus({ type: 'error', text: res.error || 'Failed to clear vendor fares.' });
        }
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Network or server error while clearing fares.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-pop-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-rose-50 px-5 py-3.5 border-b border-rose-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shadow-2xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Delete / Clear Rates</h3>
              <p className="text-xs text-rose-700 font-bold">Select vendor & sector to delete rates accurately</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/80 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => { setMode('vendor'); setStatus(null); }}
              className={`py-2 px-3 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                mode === 'vendor'
                  ? 'bg-white text-rose-700 shadow-xs border border-rose-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Delete Vendor Rates</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('all'); setStatus(null); }}
              className={`py-2 px-3 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                mode === 'all'
                  ? 'bg-white text-rose-700 shadow-xs border border-rose-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Full System Reset</span>
            </button>
          </div>

          {/* MODE 1: VENDOR SELECTION */}
          {mode === 'vendor' && (
            <div className="space-y-3.5">
              {/* Step 1: Vendor Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>1. Vendor / Agent Choose Karein:</span>
                  </span>
                  {vendorStats.loading && (
                    <span className="text-[11px] font-bold text-blue-600 flex items-center space-x-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Checking inventory...</span>
                    </span>
                  )}
                </label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => {
                    setSelectedVendorId(e.target.value);
                    setSelectedSector(''); // Reset sector when vendor changes
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-rose-500 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:outline-none cursor-pointer shadow-2xs transition"
                >
                  <option value="" disabled>-- Select a Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Sector / Route Selector */}
              {selectedVendor && (
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      <Plane className="w-3.5 h-3.5 text-indigo-600" />
                      <span>2. Kon sa Sector delete karna hai? (Select Sector):</span>
                    </span>
                    {selectedSector && (
                      <button
                        type="button"
                        onClick={() => setSelectedSector('')}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        Reset to All Sectors
                      </button>
                    )}
                  </label>
                  <select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 focus:border-rose-500 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:outline-none cursor-pointer shadow-2xs transition"
                  >
                    <option value="">🌐 All Sectors (Sabhi Sectors) — {vendorStats.total} total rates</option>
                    {(vendorStats.sectors || []).map(s => {
                      const routeName = formatRouteName(s.origin, s.destination, '➔');
                      return (
                        <option key={`${s.origin}-${s.destination}`} value={`${s.origin}-${s.destination}`}>
                          🛫 {routeName} ({s.origin} ➔ {s.destination}) — {s.total} rates ({s.updated_today} today)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Vendor Live Inventory Info for chosen sector */}
              {selectedVendor && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-blue-600 block">
                      Total Active Rates {selectedSector ? `(${selectedSector})` : ''}
                    </span>
                    <strong className="text-sm font-black text-blue-950 font-mono">
                      {vendorStats.loading ? '...' : totalInScope}
                    </strong>
                    <span className="text-[10px] text-blue-700 block">
                      {selectedSector ? 'In this sector' : 'Across all sectors'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">
                      Updated Today {selectedSector ? `(${selectedSector})` : ''}
                    </span>
                    <strong className="text-sm font-black text-amber-950 font-mono">
                      {vendorStats.loading ? '...' : todayInScope}
                    </strong>
                    <span className="text-[10px] text-amber-700 block">Newest rate sheet updates</span>
                  </div>
                </div>
              )}

              {/* Step 3: Choose Scope to Delete */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 block">3. Kitne rates delete karne hain?</label>
                
                {/* Option A: Today's Updated Rates */}
                <div 
                  onClick={() => setVendorScope('today')}
                  className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-start space-x-3 ${
                    vendorScope === 'today'
                      ? 'bg-amber-50/60 border-amber-500 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="vendorScope"
                    checked={vendorScope === 'today'}
                    onChange={() => setVendorScope('today')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 font-black flex items-center space-x-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Delete Today's Updated Rates Only</span>
                      </strong>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900 font-mono">
                        {todayInScope} rates
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                      Removes rates uploaded or updated today for <strong>{selectedVendor?.name}</strong> {selectedSector ? `on ${selectedSector}` : ''}. Older previous rates safe rahenge.
                    </p>
                  </div>
                </div>

                {/* Option B: All Rates */}
                <div 
                  onClick={() => setVendorScope('all')}
                  className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-start space-x-3 ${
                    vendorScope === 'all'
                      ? 'bg-rose-50/60 border-rose-500 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="vendorScope"
                    checked={vendorScope === 'all'}
                    onChange={() => setVendorScope('all')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 font-black flex items-center space-x-1">
                        <Layers className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete ALL Rates {selectedSector ? `for ${selectedSector}` : `for ${selectedVendor?.name || 'this Vendor'}`}</span>
                      </strong>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-200 text-rose-900 font-mono">
                        {totalInScope} rates
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                      {selectedSector 
                        ? `Completely clears all inventory for ${selectedVendor?.name} on ${selectedSector}. (Baaki sectors safe rahenge).`
                        : `Completely clears all inventory across all sectors for ${selectedVendor?.name}. (Baaki vendors safe rahenge).`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: FULL SYSTEM RESET */}
          {mode === 'all' && (
            <div className="space-y-3">
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-2">
                <div className="flex items-center space-x-2 font-black text-rose-800 text-sm">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>Full Database Fares Reset</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-700">
                  This will wipe out <strong>ALL active fare records and price history across EVERY vendor</strong>.
                </p>
                <div className="bg-white/80 p-2.5 rounded-lg border border-rose-100 text-[11px] text-slate-700">
                  ✅ Your Airlines list, Vendors list, and Routes master data will remain <strong>100% safe</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {status && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in ${
              status.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}>
              {status.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{status.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-bold">
            {mode === 'vendor' && selectedVendor && (
              <span>
                Target: <strong className="text-slate-800">{selectedVendor.name}</strong> 
                {selectedSector && <span className="text-indigo-700 ml-1 font-mono font-bold">[{selectedSector}]</span>}
                <span className="text-rose-600 ml-1">({deleteCount} rates)</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={loading || (mode === 'vendor' && deleteCount === 0)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-sm transition flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {loading 
                  ? 'Deleting...' 
                  : (mode === 'all' 
                      ? 'Confirm Full System Reset' 
                      : `Delete ${deleteCount} ${vendorScope === 'today' ? "Today's" : "All"} Rates`
                    )
                }
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
