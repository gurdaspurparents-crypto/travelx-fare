import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, Copy, Check, Download, RefreshCw, Trash2, 
  Sparkles, MessageSquare, FileSpreadsheet, Eye, 
  Sliders, ArrowRight, Zap, CheckCircle2, AlertCircle, TrendingUp,
  Layers, CheckSquare, Square
} from 'lucide-react';
import { api } from '../utils/api';
import { getAirlineName } from '../utils/airlineHelper';
import { formatRouteName, getCityName, getCanonicalAirportCode, compareRoutesUpDown, sortSectorsUpAndDown } from '../utils/airportHelper';
import { groupFaresByDateRanges, formatWhatsAppBroadcast } from '../utils/dateGroupingHelper';
import { exportPublishDeskToExcel } from '../utils/excelExportHelper';

export default function PublishDesk({ onFaresChanged, masterData = {} }) {
  const [fares, setFares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  // View Mode: 'CONSOLIDATED' (Merged Date Ranges like user's image) or 'DETAILED' (Individual Dates)
  const [tableViewMode, setTableViewMode] = useState('CONSOLIDATED');

  // WhatsApp Broadcast state
  const [whatsappText, setWhatsappText] = useState('');
  const [whatsappMode, setWhatsappMode] = useState('GROUPED'); // 'GROUPED' (like image) or 'DETAILED'
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState('✈️ TRAVELX SPECIAL FARE');
  const [footer, setFooter] = useState('🔥 BEST FARE GUARANTEE\n⚡ LIMITED SEATS AVAILABLE\n📞 Contact Travelx Desk for Instant Issuance');

  const loadPublishedFares = async () => {
    try {
      setLoading(true);
      const res = await api.getAllFares({ is_published: 1 });
      if (res.success && res.fares && res.fares.length > 0) {
        const loaded = res.fares.map(f => {
          const net = Number(f.net_fare) || 0;
          return {
            ...f,
            net_fare: net,
            margin_amount: 0,
            publish_fare: net
          };
        });
        setFares(loaded);
        generateBroadcast(loaded);
      } else {
        // Fallback: If no fares explicitly marked as published yet, auto-load all winning/best fares from comparison engine!
        const bestRes = await api.getBestFares();
        if (bestRes.success && bestRes.bestFares && bestRes.bestFares.length > 0) {
          const loaded = bestRes.bestFares.map(f => {
            const net = Number(f.net_fare) || 0;
            return {
              ...f,
              net_fare: net,
              margin_amount: 0,
              publish_fare: net
            };
          });
          setFares(loaded);
          generateBroadcast(loaded);
        }
      }
    } catch (err) {
      console.error('Error loading published fares:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load All Best/Lowest Net Fares from Comparison Desk into this Final Sheet
  const handleLoadBestFares = async () => {
    try {
      setLoading(true);
      setStatus(null);
      const res = await api.getBestFares();
      if (res.success) {
        if (res.bestFares.length === 0) {
          setStatus({ type: 'info', text: 'No active fares found in comparison engine. Enter fares in Fast Entry or Quick Grid first.' });
        } else {
          const loaded = res.bestFares.map(f => {
            const net = Number(f.net_fare) || 0;
            return {
              ...f,
              net_fare: net,
              margin_amount: 0,
              publish_fare: net
            };
          });
          setFares(loaded);
          generateBroadcast(loaded);
          setStatus({ 
            type: 'success', 
            text: `⚡ Successfully loaded ${loaded.length} best/lowest net quotes from Comparison Desk!` 
          });
        }
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to load best fares from comparison desk.' });
    } finally {
      setLoading(false);
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // Feature 03: Past Dates Auto-Hide (Default: false to show all active rates)
  const [hidePastDates, setHidePastDates] = useState(false);

  // Count expired/past dates
  const pastDatesCount = useMemo(() => {
    return fares.filter(f => f.travel_date && f.travel_date < todayStr).length;
  }, [fares, todayStr]);

  // Active fares respecting hidePastDates toggle
  const activeFares = useMemo(() => {
    if (!hidePastDates) return fares;
    return fares.filter(f => !f.travel_date || f.travel_date >= todayStr);
  }, [fares, hidePastDates, todayStr]);

  // Sector Selection State: which sectors to publish/broadcast
  // Ordered array of selected sector keys (Empty array = ALL sectors selected by default)
  // Preserves the exact chronological sequence of sectors chosen by the user!
  const [selectedSectorKeys, setSelectedSectorKeys] = useState([]);

  // Extract all available sectors from active fares
  const availableSectors = useMemo(() => {
    const map = new Map();
    for (const f of activeFares) {
      const orig = getCanonicalAirportCode(f.origin);
      const dest = getCanonicalAirportCode(f.destination);
      const key = `${orig}-${dest}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          origin: orig,
          destination: dest,
          label: formatRouteName(orig, dest, 'TO'),
          codeLabel: `${orig} → ${dest}`,
          count: 0
        });
      }
      map.get(key).count += 1;
    }
    return sortSectorsUpAndDown(Array.from(map.values()));
  }, [activeFares]);

  const isAllSectorsSelected = selectedSectorKeys.length === 0;

  const isSectorSelected = (key) => {
    return selectedSectorKeys.includes(key);
  };

  const getSectorSelectionOrder = (key) => {
    const idx = selectedSectorKeys.indexOf(key);
    return idx !== -1 ? idx + 1 : null;
  };

  const handleSelectAllSectors = () => {
    setSelectedSectorKeys([]);
  };

  const handleToggleSector = (sectorKey, e) => {
    if (e) e.stopPropagation();
    setSelectedSectorKeys(prev => {
      // If currently all sectors active, clicking one starts the custom sequence (#1)
      if (prev.length === 0) {
        return [sectorKey];
      }
      if (prev.includes(sectorKey)) {
        const next = prev.filter(k => k !== sectorKey);
        return next;
      } else {
        // Append at the end: preserves exact selection order (1st, 2nd, 3rd...)
        return [...prev, sectorKey];
      }
    });
  };

  const handleIsolateSector = (sectorKey) => {
    setSelectedSectorKeys(prev => {
      if (prev.length === 1 && prev[0] === sectorKey) {
        return [];
      }
      return [sectorKey];
    });
  };

  // Displayed / Published Fares filtered and strictly ordered by user's selection order OR UP & DOWN default order
  const displayedFares = useMemo(() => {
    if (selectedSectorKeys.length === 0) {
      // Default: Sort all active fares so UP & DOWN sectors stay immediately next to each other!
      return activeFares.slice().sort((a, b) => {
        const routeCmp = compareRoutesUpDown(a.origin, a.destination, b.origin, b.destination);
        if (routeCmp !== 0) return routeCmp;
        const airA = a.airline_name || a.airline_code || '';
        const airB = b.airline_name || b.airline_code || '';
        if (airA !== airB) return airA.localeCompare(airB);
        return (a.travel_date || '').localeCompare(b.travel_date || '');
      });
    }

    const sectorOrderMap = new Map();
    selectedSectorKeys.forEach((key, idx) => {
      sectorOrderMap.set(key, idx);
    });

    const filtered = activeFares.filter(f => {
      const orig = getCanonicalAirportCode(f.origin);
      const dest = getCanonicalAirportCode(f.destination);
      return sectorOrderMap.has(`${orig}-${dest}`);
    });

    return filtered.slice().sort((a, b) => {
      const keyA = `${getCanonicalAirportCode(a.origin)}-${getCanonicalAirportCode(a.destination)}`;
      const keyB = `${getCanonicalAirportCode(b.origin)}-${getCanonicalAirportCode(b.destination)}`;
      const orderA = sectorOrderMap.get(keyA) ?? 9999;
      const orderB = sectorOrderMap.get(keyB) ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      const airA = a.airline_name || a.airline_code || '';
      const airB = b.airline_name || b.airline_code || '';
      if (airA !== airB) return airA.localeCompare(airB);
      return (a.travel_date || '').localeCompare(b.travel_date || '');
    });
  }, [activeFares, selectedSectorKeys]);

  const consolidatedList = useMemo(() => {
    return groupFaresByDateRanges(displayedFares);
  }, [displayedFares]);

  const generateBroadcast = (faresList = displayedFares, mode = whatsappMode) => {
    if (!faresList || faresList.length === 0) {
      setWhatsappText('');
      return;
    }
    const text = formatWhatsAppBroadcast(faresList, {
      title,
      footer,
      groupByRanges: mode === 'GROUPED'
    });
    setWhatsappText(text);
  };

  useEffect(() => {
    loadPublishedFares();
  }, []);

  useEffect(() => {
    if (displayedFares.length > 0) {
      generateBroadcast(displayedFares, whatsappMode);
    } else {
      setWhatsappText('');
    }
  }, [displayedFares, title, footer, whatsappMode]);

  // Remove an entire consolidated streak from final sheet
  const handleRemoveConsolidatedStreak = async (streakItem) => {
    try {
      await api.togglePublish(streakItem.fare_ids, 0);
      const targetIds = new Set(streakItem.fare_ids);
      setFares(prev => {
        const updated = prev.filter(f => !targetIds.has(f.id));
        generateBroadcast(updated);
        return updated;
      });
      if (onFaresChanged) onFaresChanged();
    } catch (err) {
      console.error('Failed to remove streak:', err);
    }
  };

  // Export to Excel handler
  const handleExportExcel = () => {
    if (displayedFares.length === 0) {
      setStatus({ type: 'error', text: 'No fares on sheet to export.' });
      return;
    }
    exportPublishDeskToExcel(displayedFares, consolidatedList);
    setStatus({ 
      type: 'success', 
      text: `📥 Excel downloaded! Includes ${displayedFares.length} fares for selected sector(s).` 
    });
  };

  // Final Action: Lock Fares to Database
  const handleSaveAndPublishAll = async () => {
    if (fares.length === 0) {
      setStatus({ type: 'error', text: 'No fares on sheet to save.' });
      return;
    }

    try {
      setSaving(true);
      setStatus(null);

      const updates = fares.map(f => ({
        id: f.id,
        net_fare: Number(f.net_fare),
        margin_amount: 0,
        publish_fare: Number(f.net_fare)
      }));

      const res = await api.batchUpdateMargins(updates, 1, 'Final Special Fare Broadcast');
      if (res.success) {
        setStatus({
          type: 'success',
          text: `🎉 Successfully saved all ${res.updated_count} special fares! Synced to database.`
        });
        generateBroadcast(fares);
        if (onFaresChanged) onFaresChanged();
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to save fares.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error saving fares to database.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleRemoveRow = async (fareId) => {
    try {
      await api.togglePublish([fareId], 0);
      setFares(prev => {
        const updated = prev.filter(f => f.id !== fareId);
        generateBroadcast(updated);
        return updated;
      });
      if (onFaresChanged) onFaresChanged();
    } catch (err) {
      console.error('Failed to remove row:', err);
    }
  };

  const handleClearAll = async () => {
    if (fares.length === 0) return;
    if (!window.confirm('Clear all fares from sheet?')) return;

    try {
      const ids = fares.map(f => f.id);
      await api.togglePublish(ids, 0);
      setFares([]);
      setWhatsappText('');
      if (onFaresChanged) onFaresChanged();
    } catch (err) {
      console.error(err);
    }
  };

  // Total net fare
  const totalNet = displayedFares.reduce((sum, f) => sum + (Number(f.net_fare) || 0), 0);

  // Pre-calculate alternating sector colors for consolidated list (Exactly 3 Colors!)
  let lastSecKey = null;
  let secColorIdx = 0;
  const sectorPastelColors = ['bg-[#E0F2FE]', 'bg-[#DCFCE7]', 'bg-[#FEF3C7]']; // Ice Blue, Mint Green, Warm Amber
  const consolidatedColorMap = new Map();
  consolidatedList.forEach(item => {
    const key = item.route || `${item.origin}_${item.destination}`;
    if (lastSecKey !== null && key !== lastSecKey) {
      secColorIdx = (secColorIdx + 1) % 3;
    }
    lastSecKey = key;
    consolidatedColorMap.set(item.id, sectorPastelColors[secColorIdx]);
  });

  // Pre-calculate alternating sector colors for detailed list (Exactly 3 Colors!)
  let lastDetSecKey = null;
  let detSecColorIdx = 0;
  const detailedColorMap = new Map();
  displayedFares.forEach(f => {
    const key = `${f.origin}_${f.destination}`;
    if (lastDetSecKey !== null && key !== lastDetSecKey) {
      detSecColorIdx = (detSecColorIdx + 1) % 3;
    }
    lastDetSecKey = key;
    detailedColorMap.set(f.id, sectorPastelColors[detSecColorIdx]);
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Send className="w-5 h-5 text-blue-600" />
            <span>Special Fares & WhatsApp Broadcast</span>
          </h1>
          <p className="text-xs text-slate-500">
            Review winning net fares, select sectors, and broadcast directly to WhatsApp or export to Excel (No margin added).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleLoadBestFares}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold rounded-lg border border-amber-300 shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            title="Load all winning lowest net fares from Comparison Desk"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Lowest Net Quotes</span>
          </button>

          <button
            onClick={handleSaveAndPublishAll}
            disabled={saving || fares.length === 0}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Save and lock all fares"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save & Lock'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={fares.length === 0}
            className={`px-3.5 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer ${
              fares.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed'
            }`}
            title="Export special fare sheet to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export to Excel</span>
          </button>

          <button
            onClick={loadPublishedFares}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg transition shadow-xs cursor-pointer"
            title="Refresh final sheet"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-medium ${
          status.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : status.type === 'error'
            ? 'bg-rose-50 text-rose-800 border border-rose-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {status.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      {/* Sector Selection Bar for Publishing (User Directive: Select which sectors to publish) */}
      {availableSectors.length > 0 && (
        <div className="bg-white rounded-xl border border-purple-200 shadow-xs p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <span>Publish Sectors Selector</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isAllSectorsSelected ? 'bg-purple-100 text-purple-800' : 'bg-purple-600 text-white'
                  }`}>
                    {isAllSectorsSelected ? 'All Sectors Active' : `${selectedSectorKeys.length} Sector(s) Selected`}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select which sectors to broadcast on WhatsApp, display in sheet, and export to Excel.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500 text-[11px]">
                Showing: <strong className="text-purple-900 font-bold">{displayedFares.length}</strong> / {activeFares.length} fares
              </span>
              {!isAllSectorsSelected && (
                <button
                  type="button"
                  onClick={handleSelectAllSectors}
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-md border border-purple-200 transition cursor-pointer"
                >
                  ✓ Reset / Show All Sectors
                </button>
              )}
            </div>
          </div>

          {/* Active Selection Sequence Indicator (Shows exact order sectors will appear in Excel) */}
          {!isAllSectorsSelected && selectedSectorKeys.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-purple-50 rounded-lg border border-purple-200">
              <span className="text-[11px] font-black text-purple-900 uppercase tracking-wide shrink-0 flex items-center space-x-1">
                <span>📋 Selected Order in Excel:</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedSectorKeys.map((k, i) => {
                  const secObj = availableSectors.find(s => s.key === k);
                  return (
                    <span 
                      key={k} 
                      className="inline-flex items-center space-x-1 bg-purple-800 text-white px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs"
                    >
                      <span className="text-amber-300 font-extrabold font-mono">#{i + 1}</span>
                      <span>{secObj ? secObj.label : k}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sector Multi-Select Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {/* All Sectors Pill */}
            <button
              type="button"
              onClick={handleSelectAllSectors}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
                isAllSectorsSelected
                  ? 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-900'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isAllSectorsSelected && <Check className="w-3.5 h-3.5 text-white" />}
              <span>All Sectors ({activeFares.length})</span>
            </button>

            {/* Individual Sector Multi-Select Pills */}
            {availableSectors.map(sec => {
              const isChecked = isSectorSelected(sec.key);
              const isActiveInFilter = !isAllSectorsSelected && isChecked;
              const selectionOrder = getSectorSelectionOrder(sec.key);

              return (
                <div
                  key={sec.key}
                  className={`inline-flex items-center rounded-lg border text-xs font-bold transition overflow-hidden shadow-2xs ${
                    isActiveInFilter
                      ? 'bg-purple-700 text-white border-purple-800 ring-2 ring-purple-500'
                      : isAllSectorsSelected
                      ? 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {/* Checkbox Icon button (Clicking toggles inclusion) */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleSector(sec.key, e)}
                    className={`px-2 py-1.5 transition flex items-center justify-center cursor-pointer ${
                      isActiveInFilter
                        ? 'hover:bg-purple-800 text-white'
                        : isAllSectorsSelected
                        ? 'hover:bg-purple-200 text-purple-700'
                        : 'hover:bg-slate-200 text-slate-400'
                    }`}
                    title={isChecked ? `Unselect ${sec.label}` : `Select ${sec.label}`}
                  >
                    {isActiveInFilter ? (
                      <CheckSquare className="w-3.5 h-3.5 text-white" />
                    ) : isAllSectorsSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-purple-700" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {/* Sector Label & Count button (Clicking isolates/toggles this sector) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isAllSectorsSelected) {
                        handleIsolateSector(sec.key);
                      } else {
                        handleToggleSector(sec.key);
                      }
                    }}
                    className={`px-2.5 py-1.5 flex items-center space-x-1.5 cursor-pointer ${
                      isActiveInFilter ? 'hover:bg-purple-800' : 'hover:bg-purple-100'
                    }`}
                    title={`Click to toggle ${sec.label} (${sec.count} fares)`}
                  >
                    {isActiveInFilter && selectionOrder && (
                      <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded font-mono font-black text-[10px]">
                        #{selectionOrder}
                      </span>
                    )}
                    <span>✈️ {sec.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      isActiveInFilter
                        ? 'bg-purple-950 text-purple-200'
                        : isAllSectorsSelected
                        ? 'bg-purple-200 text-purple-900'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {sec.count}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Final Sheet Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Final Special Fare Sheet
                  </h2>
                  <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    {tableViewMode === 'CONSOLIDATED' ? `${consolidatedList.length} Grouped Ranges` : `${displayedFares.length} Individual Rows`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {tableViewMode === 'CONSOLIDATED'
                    ? 'Dates with identical rates are combined into clean ranges (e.g. 21 SEP & 22 SEP, 23 SEP TO 02 OCT)'
                    : 'All individual dates displayed row-by-row'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Feature 03: Past Dates Auto-Hide Toggle */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300 text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setHidePastDates(false)}
                    className={`px-2.5 py-1 rounded-md font-bold transition flex items-center space-x-1 cursor-pointer ${
                      !hidePastDates
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Show all rates across all dates (Default)"
                  >
                    <span>All Dates ({fares.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHidePastDates(true)}
                    className={`px-2.5 py-1 rounded-md font-bold transition flex items-center space-x-1 cursor-pointer ${
                      hidePastDates
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Hide expired flight dates"
                  >
                    <span>Upcoming Only</span>
                    {pastDatesCount > 0 && (
                      <span className="ml-1 text-[10px] bg-blue-800 text-white px-1.5 py-0.2 rounded-full font-mono font-bold">
                        {pastDatesCount} past
                      </span>
                    )}
                  </button>
                </div>

                {/* View Switcher: Consolidated vs Detailed */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300 text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setTableViewMode('CONSOLIDATED')}
                    className={`px-2.5 py-1 rounded-md font-bold transition flex items-center space-x-1 cursor-pointer ${
                      tableViewMode === 'CONSOLIDATED'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Same rates on consecutive dates merged (e.g. 21 SEP & 22 SEP, 23 SEP TO 02 OCT)"
                  >
                    <span>📦 Grouped Ranges ({consolidatedList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableViewMode('DETAILED')}
                    className={`px-2.5 py-1 rounded-md font-bold transition flex items-center space-x-1 cursor-pointer ${
                      tableViewMode === 'DETAILED'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Show all individual date rows"
                  >
                    <span>📑 All Dates ({displayedFares.length})</span>
                  </button>
                </div>

                {/* Toggle Net Fare & Margin Columns (Internal Desk Editing) */}
                <button
                  type="button"
                  onClick={handleLoadBestFares}
                  disabled={loading}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs transition flex items-center space-x-1 cursor-pointer"
                  title="Reload All Winning Rates from Comparison Desk"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Reload Best Quotes</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={fares.length === 0}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition flex items-center space-x-1 cursor-pointer"
                  title="Export this clean sheet to Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export to Excel</span>
                </button>

                {fares.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    Clear Sheet
                  </button>
                )}
              </div>
            </div>

            {/* Row 1: Executive Midnight Navy Banner with IATA Logo on Left, Centered Gold Special Fares, & TravelX Logo on Right */}
            <div className="bg-[#0F172A] px-4 py-2.5 relative flex items-center justify-between border-b border-slate-800">
              {/* Left: IATA Approved Travel Agency Logo */}
              <div className="flex items-center justify-start shrink-0">
                <img 
                  src="/iata-transparent.png" 
                  alt="IATA Approved Travel Agency" 
                  className="h-6 sm:h-7.5 w-auto object-contain brightness-110" 
                />
              </div>

              {/* Center Title: Calibri-style Gold Bold Text */}
              <div className="flex-1 text-center px-2">
                <span className="text-sm sm:text-base md:text-lg font-black tracking-wider text-[#FBBF24] uppercase drop-shadow-sm">
                  ✨ EXCLUSIVE SPECIAL FARES ✨
                </span>
              </div>

              {/* Right: TravelX Logo in Framed White Card (Exact match to Excel Row 1 and user screenshot) */}
              <div className="bg-white rounded-md px-2.5 py-1 border border-slate-400 shadow-sm flex items-center justify-center shrink-0">
                <img 
                  src="/travelx-logo.png" 
                  alt="TravelX Logo" 
                  className="h-6 sm:h-7.5 w-auto object-contain" 
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[580px]">
              <table className="min-w-full text-xs">
                <thead className="bg-[#1E3A8A] text-white font-bold uppercase sticky top-0 z-10 shadow-xs border-b border-blue-900">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-14 border-r border-blue-800/60 font-bold">S.No</th>
                    <th className="px-3.5 py-2.5 text-left w-36 border-r border-blue-800/60 font-bold">Airlines</th>
                    <th className="px-3.5 py-2.5 text-left w-48 border-r border-blue-800/60 font-bold">Origin to Destination</th>
                    <th className="px-4 py-2.5 text-right w-36 border-r border-blue-800/60 font-bold">Special Fare (₹)</th>
                    <th className="px-3.5 py-2.5 text-left border-r border-blue-800/60 font-bold">
                      {tableViewMode === 'CONSOLIDATED' ? 'Dates Available' : 'Travel Date'}
                    </th>
                    <th className="px-3.5 py-2.5 text-left border-r border-blue-800/60 font-bold w-32">Vendor</th>
                    <th className="px-3 py-2.5 text-center w-12 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300/60">
                  {displayedFares.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-slate-400 bg-white">
                        <p className="font-semibold text-slate-600 mb-1">
                          {!isAllSectorsSelected
                            ? 'No fares match the selected sector filter.'
                            : fares.length > 0 && pastDatesCount === fares.length
                            ? 'All fares on sheet are past dates (hidden by Upcoming Only filter).'
                            : 'No fares on the final sheet yet.'}
                        </p>
                        {!isAllSectorsSelected ? (
                          <button
                            type="button"
                            onClick={handleSelectAllSectors}
                            className="mt-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                          >
                            Show All Sectors ({activeFares.length})
                          </button>
                        ) : fares.length > 0 && pastDatesCount === fares.length ? (
                          <button
                            type="button"
                            onClick={() => setHidePastDates(false)}
                            className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                          >
                            Show All {fares.length} Past Fares
                          </button>
                        ) : (
                          <>
                            <p className="text-xs mb-4">You can load all best quotes from the comparison engine or select them from Compare Fares.</p>
                            <button
                              onClick={handleLoadBestFares}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition inline-flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>Load Best Quotes from Compare Desk</span>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : tableViewMode === 'CONSOLIDATED' ? (
                    /* Consolidated Grouped Date Ranges View with 3 Pastel Sector Colors */
                    consolidatedList.map((streakItem, idx) => {
                      const net = Number(streakItem.net_fare) || 0;
                      const rowBg = consolidatedColorMap.get(streakItem.id) || 'bg-[#E0F2FE]';
                      return (
                        <tr key={streakItem.id || idx} className={`${rowBg} text-slate-900 font-bold hover:brightness-95 transition border-b border-slate-300/50`}>
                          <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-600 border-r border-slate-300/60">{idx + 1}</td>
                          
                          <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-slate-300/60">
                            <span className="font-extrabold text-slate-900 text-xs">
                              {streakItem.airline_name || streakItem.airline_code}
                            </span>
                          </td>

                          <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-slate-300/60">
                            <div className="font-extrabold text-slate-900 text-xs">
                              {streakItem.route}
                            </div>
                          </td>

                          <td className="px-4 py-2.5 text-right font-black text-slate-950 font-mono text-xs whitespace-nowrap border-r border-slate-300/60">
                            ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Date Range Column */}
                          <td className="px-3.5 py-2.5 font-bold text-slate-900 break-words border-r border-slate-300/60">
                            <div className="flex items-center space-x-2">
                              <span>{streakItem.date_label}</span>
                              {streakItem.dates_count > 1 && (
                                <span className="text-[10px] font-bold bg-white/70 text-slate-700 px-1.5 py-0.2 rounded shadow-2xs">
                                  {streakItem.dates_count} Dates
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Vendor Column */}
                          <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-slate-300/60">
                            <span className="font-extrabold text-slate-900 text-xs px-2 py-0.5 rounded bg-white/70 border border-slate-300/70 shadow-2xs">
                              🏢 {streakItem.vendor_name || 'Direct'}
                            </span>
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => handleRemoveConsolidatedStreak(streakItem)}
                              className="p-1 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                              title="Remove this date range streak"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    /* Detailed Day-by-Day View */
                    displayedFares.map((f, idx) => {
                      const net = Number(f.net_fare) || 0;
                      const rowBg = detailedColorMap.get(f.id) || 'bg-[#E0F2FE]';

                      return (
                        <tr key={f.id || idx} className={`${rowBg} text-slate-900 font-bold hover:brightness-95 transition border-b border-slate-300/50`}>
                          <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-600 border-r border-slate-300/60">{idx + 1}</td>

                          <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-slate-300/60">
                            <span className="font-extrabold text-slate-900 text-xs">
                              {f.airline_name || getAirlineName(f.airline_code, masterData?.airlines)}
                            </span>
                          </td>

                          <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-slate-300/60">
                            <div className="font-extrabold text-slate-900 text-xs">
                              {formatRouteName(f.origin, f.destination, 'TO')}
                            </div>
                          </td>

                          <td className="px-4 py-2.5 text-right font-black text-slate-950 font-mono text-xs whitespace-nowrap border-r border-slate-300/60">
                            ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap border-r border-slate-300/60">
                            {f.travel_date}
                          </td>

                          {/* Vendor Column */}
                          <td className="px-3.5 py-2.5 whitespace-nowrap border-r border-slate-300/60">
                            <span className="font-extrabold text-slate-900 text-xs px-2 py-0.5 rounded bg-white/70 border border-slate-300/70 shadow-2xs">
                              🏢 {f.vendor_name || 'Direct'}
                            </span>
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => handleRemoveRow(f.id)}
                              className="p-1 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                              title="Remove from sheet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Executive Corporate Footer Card (Matching Excel Footer) */}
            {displayedFares.length > 0 && (
              <div className="border-t border-slate-300">
                <div className="bg-[#1E3A8A] text-white text-center font-bold text-xs py-2 tracking-wide uppercase">
                  📞 24/7 RESERVATIONS & INSTANT TICKETING DESK
                </div>
                <div className="bg-[#E2E8F0] text-[#000000] text-center font-bold text-xs py-2 border-b border-slate-300">
                  Contact / WhatsApp: +91 8146526257 &bull; +91 7814508351 &bull; Landline: 01874-501800
                </div>
                <div className="bg-[#F1F5F9] text-slate-700 text-center text-[11px] py-2 px-4 space-y-0.5">
                  <p className="italic font-bold text-slate-600">Note: Prices are subject to change without prior notice. Tickets are strictly non-refundable and non-changeable.</p>
                  <p className="text-slate-800 font-bold">We provide OTB service; verification is the responsibility of the agent. Please save our contact numbers for daily rate updates.</p>
                </div>
              </div>
            )}

            {/* Bottom Save Bar */}
            {displayedFares.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Total Fare Value: <strong className="text-blue-700 font-black">₹{totalNet.toLocaleString('en-IN')}</strong> ({displayedFares.length} Special Fares)
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSaveAndPublishAll}
                    disabled={saving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Lock & Save Special Fares'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: WhatsApp Broadcast Desk (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-500 text-white rounded-lg">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">WhatsApp Broadcast Ready</h3>
                  <p className="text-[11px] text-slate-500">
                    {isAllSectorsSelected 
                      ? 'Broadcasting all active sectors' 
                      : `Broadcasting ${selectedSectorKeys.length} selected sector(s)`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopyToClipboard}
                disabled={!whatsappText}
                className={`px-4 py-2 rounded-lg font-bold text-xs transition flex items-center space-x-1.5 shadow-sm ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy to WhatsApp</span>
                  </>
                )}
              </button>
            </div>

            {/* Active Selected Sectors Indicator in WhatsApp Desk */}
            {!isAllSectorsSelected && (
              <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 truncate">
                  <span className="font-extrabold text-purple-900">Broadcasting:</span>
                  <span className="font-bold text-purple-800 truncate">
                    {selectedSectorKeys.map(k => availableSectors.find(s => s.key === k)?.label || k).join(', ')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllSectors}
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-extrabold underline shrink-0 cursor-pointer ml-2"
                >
                  All Sectors
                </button>
              </div>
            )}

            {/* Template Controls */}
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Title Header</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Footer & Promo Notes</label>
                <textarea
                  rows={2}
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800"
                ></textarea>
              </div>
            </div>

            {/* WhatsApp Format Toggle */}
            <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-600 px-1">Dates Format:</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setWhatsappMode('GROUPED')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    whatsappMode === 'GROUPED'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Dates with same rate merged e.g. 21 SEP & 22 SEP, 23 SEP TO 02 OCT"
                >
                  📦 Grouped Ranges (Like Image)
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsappMode('DETAILED')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    whatsappMode === 'DETAILED'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Single day-by-day dates"
                >
                  📑 Day-by-Day
                </button>
              </div>
            </div>

            {/* Live WhatsApp Message Preview (Styled like WhatsApp chat bubble!) */}
            <div className="bg-[#efeae2] p-4 rounded-xl border border-slate-300 relative shadow-inner">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100 whitespace-pre-wrap font-sans text-xs text-slate-900 leading-relaxed max-h-96 overflow-y-auto">
                {whatsappText || 'Add fares and margins above to generate live WhatsApp broadcast message.'}
              </div>
              <div className="mt-2 text-right">
                <span className="text-[10px] text-slate-500 font-mono">WhatsApp Broadcast Preview</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Ready for B2B WhatsApp groups</span>
              <button
                onClick={handleCopyToClipboard}
                className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center space-x-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>1-Click Copy</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
