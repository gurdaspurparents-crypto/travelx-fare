import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  GitCompare, Trophy, AlertTriangle, Check, Filter, 
  Send, RefreshCw, Plane, FileSpreadsheet, ChevronDown, ChevronRight, CheckSquare, Square, X, Layers,
  Calendar, Zap, TrendingUp, Sparkles
} from 'lucide-react';
import { api } from '../utils/api';
import { getAirlineName } from '../utils/airlineHelper';
import { formatRouteName, getCityName, compareRoutesUpDown } from '../utils/airportHelper';
import { exportComparisonDeskToExcel } from '../utils/excelExportHelper';

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = String(dateStr).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const d = new Date(Number(year), monthIdx, Number(day));
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${day}-${monthNames[monthIdx]}-${year} (${dayNames[d.getDay()]})`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

export default function ComparisonDesk({ masterData, initialRoute, setActiveTab }) {
  const { airlines = [], vendors = [], routes = [] } = masterData;

  const [filters, setFilters] = useState({
    origin: initialRoute?.origin || '',
    destination: initialRoute?.destination || '',
    travel_date: '',
    airline_code: '',
    vendor_id: ''
  });

  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFareIds, setSelectedFareIds] = useState(new Set());
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState(null);

  // Feature 03: Past Dates Auto-Hide (Default: false to show all active rates)
  const [hidePastDates, setHidePastDates] = useState(false);

  // Feature 05: Vendor Arbitrage & Profit Opportunity Filter (Default: false)
  const [arbitrageOnlyFilter, setArbitrageOnlyFilter] = useState(false);

  // Selected sectors for multiple sector filtering & export (Set of sectorKey strings, e.g. 'ATQ-DXB')
  // Empty Set indicates ALL sectors are selected (default)
  const [selectedSectorKeys, setSelectedSectorKeys] = useState(new Set());
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const sectorDropdownRef = useRef(null);

  const [activeAirlineFilter, setActiveAirlineFilter] = useState('ALL');
  const [groupByMode, setGroupByMode] = useState('AIRLINE'); // 'AIRLINE' or 'DATE'
  const [expandedGroupKeys, setExpandedGroupKeys] = useState(new Set());

  // Click outside to close sector dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(e.target)) {
        setIsSectorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadComparisons = async () => {
    try {
      setLoading(true);
      const res = await api.getComparisons(filters);
      if (res.success) {
        setComparisons(res.comparisons);
      }
    } catch (err) {
      console.error('Error loading comparisons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComparisons();
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      origin: '',
      destination: '',
      travel_date: '',
      airline_code: '',
      vendor_id: ''
    });
    setSelectedSectorKeys(new Set());
    setActiveAirlineFilter('ALL');
  };

  const toggleSelectFare = (fareId) => {
    setSelectedFareIds(prev => {
      const next = new Set(prev);
      if (next.has(fareId)) {
        next.delete(fareId);
      } else {
        next.add(fareId);
      }
      return next;
    });
  };

  const toggleExpandGroup = (key) => {
    setExpandedGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllWinners = () => {
    const winners = new Set();
    for (const group of comparisons) {
      const best = group.fares.find(f => f.is_best_net) || group.fares[0];
      if (best) winners.add(best.id);
    }
    setSelectedFareIds(winners);
    setStatus({ type: 'info', text: `Selected all ${winners.size} lowest/winning fares across all dates!` });
  };

  const handleSelectSectorWinners = (sectorItems) => {
    const next = new Set(selectedFareIds);
    for (const group of sectorItems) {
      const best = group.fares.find(f => f.is_best_net) || group.fares[0];
      if (best) next.add(best.id);
    }
    setSelectedFareIds(next);
    setStatus({ type: 'info', text: `Selected lowest quotes for this sector!` });
  };

  const handleSelectAirlineWinners = (airlineItems) => {
    const next = new Set(selectedFareIds);
    for (const group of airlineItems) {
      const best = group.fares.find(f => f.is_best_net) || group.fares[0];
      if (best) next.add(best.id);
    }
    setSelectedFareIds(next);
    setStatus({ type: 'info', text: `Selected lowest quotes for this airline!` });
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Count past/expired dates across all loaded comparisons
  const pastDatesCount = useMemo(() => {
    return comparisons.filter(g => g.travel_date < todayStr).length;
  }, [comparisons, todayStr]);

  // Count dates with high vendor price differences (≥ ₹800 gap)
  const highArbitrageCount = useMemo(() => {
    return comparisons.filter(g => {
      if (!g.fares || g.fares.length < 2) return false;
      const sorted = [...g.fares].sort((a, b) => Number(a.net_fare) - Number(b.net_fare));
      return (Number(sorted[1].net_fare) - Number(sorted[0].net_fare)) >= 800;
    }).length;
  }, [comparisons]);

  // Available airlines across all comparisons for top quick filter pills
  const availableAirlines = useMemo(() => {
    const map = new Map();
    for (const group of comparisons) {
      if (hidePastDates && group.travel_date < todayStr) continue;
      const code = group.airline_code;
      const name = group.airline_name || getAirlineName(code, airlines);
      if (!map.has(code)) {
        map.set(code, { code, name, count: 0 });
      }
      map.get(code).count += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [comparisons, airlines, hidePastDates, todayStr]);

  // Group comparisons Sector-wise, and inside each sector group Airline-wise
  const sectorGroups = useMemo(() => {
    const sectorMap = new Map();

    for (const group of comparisons) {
      if (activeAirlineFilter !== 'ALL' && group.airline_code !== activeAirlineFilter) {
        continue;
      }

      // Feature 03: Past Dates Auto-Hide (Default: true)
      if (hidePastDates && group.travel_date < todayStr) {
        continue;
      }

      // Feature 05: High Arbitrage Opportunity Filter (Default: false)
      if (arbitrageOnlyFilter) {
        if (!group.fares || group.fares.length < 2) continue;
        const sorted = [...group.fares].sort((a, b) => Number(a.net_fare) - Number(b.net_fare));
        if ((Number(sorted[1].net_fare) - Number(sorted[0].net_fare)) < 800) continue;
      }

      const sectorKey = `${group.origin}-${group.destination}`;
      if (!sectorMap.has(sectorKey)) {
        const routeMatch = routes.find(r => r.origin === group.origin && r.destination === group.destination);
        sectorMap.set(sectorKey, {
          sectorKey,
          origin: group.origin,
          destination: group.destination,
          label: `${group.origin} → ${group.destination}`,
          cityName: formatRouteName(group.origin, group.destination, 'TO', routes),
          airlinesMap: new Map(),
          allDateItems: []
        });
      }

      const sec = sectorMap.get(sectorKey);
      sec.allDateItems.push(group);

      const airCode = group.airline_code;
      const airName = group.airline_name || getAirlineName(airCode, airlines);

      if (!sec.airlinesMap.has(airCode)) {
        sec.airlinesMap.set(airCode, {
          airlineCode: airCode,
          airlineName: airName,
          items: []
        });
      }
      sec.airlinesMap.get(airCode).items.push(group);
    }

    return Array.from(sectorMap.values()).map(sec => {
      // Sort allDateItems by travel_date ASC
      sec.allDateItems.sort((a, b) => a.travel_date.localeCompare(b.travel_date));

      // Convert airlinesMap to sorted list
      const airlinesList = Array.from(sec.airlinesMap.values()).map(air => {
        // Sort dates chronologically ASC
        air.items.sort((a, b) => a.travel_date.localeCompare(b.travel_date));

        let lowestFare = null;
        for (const it of air.items) {
          const best = it.fares.find(f => f.is_best_net) || it.fares[0];
          if (best && (!lowestFare || Number(best.net_fare) < Number(lowestFare.net_fare))) {
            lowestFare = best;
          }
        }
        air.lowestFare = lowestFare;
        return air;
      });

      // Sort airlines alphabetically
      airlinesList.sort((a, b) => a.airlineName.localeCompare(b.airlineName));

      // Overall lowest for this sector & max market savings
      let sectorLowestFare = null;
      let maxSectorSavings = 0;
      for (const it of sec.allDateItems) {
        const best = it.fares.find(f => f.is_best_net) || it.fares[0];
        if (best && (!sectorLowestFare || Number(best.net_fare) < Number(sectorLowestFare.net_fare))) {
          sectorLowestFare = { ...best, airline_name: it.airline_name || getAirlineName(it.airline_code, airlines) };
        }
        if (it.fares && it.fares.length > 1) {
          const sorted = [...it.fares].sort((a, b) => Number(a.net_fare) - Number(b.net_fare));
          const gap = Number(sorted[1].net_fare) - Number(sorted[0].net_fare);
          if (gap > maxSectorSavings) maxSectorSavings = gap;
        }
      }

      return {
        ...sec,
        items: sec.allDateItems,
        airlines: airlinesList,
        totalCount: sec.allDateItems.length,
        sectorLowestFare,
        maxSectorSavings
      };
    }).sort((a, b) => compareRoutesUpDown(a.origin, a.destination, b.origin, b.destination));
  }, [comparisons, routes, airlines, activeAirlineFilter, hidePastDates, arbitrageOnlyFilter, todayStr]);

  // Helper: whether all sectors are selected
  const isAllSectorsSelected = selectedSectorKeys.size === 0 || (sectorGroups.length > 0 && selectedSectorKeys.size === sectorGroups.length);

  // Helper: check if a specific sector is selected
  const isSectorSelected = (sectorKey) => {
    if (selectedSectorKeys.size === 0) return true; // in ALL mode, every sector is active
    return selectedSectorKeys.has(sectorKey);
  };

  // Action: Select All Sectors
  const handleSelectAllSectors = () => {
    setSelectedSectorKeys(new Set());
  };

  // Action: Toggle sector selection (Multiple Selection for download/view)
  const handleToggleSector = (sectorKey, e) => {
    if (e) e.stopPropagation();
    setSelectedSectorKeys(prev => {
      const allKeys = sectorGroups.map(s => s.sectorKey);
      let nextSet;
      if (prev.size === 0) {
        // Was in ALL mode: uncheck this specific sectorKey, keep the rest
        nextSet = new Set(allKeys);
        nextSet.delete(sectorKey);
      } else {
        nextSet = new Set(prev);
        if (nextSet.has(sectorKey)) {
          nextSet.delete(sectorKey);
        } else {
          nextSet.add(sectorKey);
        }
      }

      // If all are selected or none remain, normalize to empty Set (ALL)
      if (nextSet.size === 0 || nextSet.size === allKeys.length) {
        return new Set();
      }
      return nextSet;
    });
  };

  // Action: Isolate to single sector
  const handleIsolateSector = (sectorKey) => {
    setSelectedSectorKeys(prev => {
      if (prev.size === 1 && prev.has(sectorKey)) {
        // If clicking the only selected sector again, toggle back to ALL
        return new Set();
      }
      return new Set([sectorKey]);
    });
  };

  // Filtered sectors based on multiple selected sector keys
  const displayedSectors = useMemo(() => {
    if (selectedSectorKeys.size === 0) return sectorGroups;
    return sectorGroups.filter(s => selectedSectorKeys.has(s.sectorKey));
  }, [sectorGroups, selectedSectorKeys]);

  const totalFaresCount = useMemo(() => {
    return sectorGroups.reduce((acc, s) => acc + s.totalCount, 0);
  }, [sectorGroups]);

  const handlePublishSelected = async () => {
    if (selectedFareIds.size === 0) {
      setStatus({ type: 'error', text: 'Please select at least one fare using the checkboxes to send to the final sheet.' });
      return;
    }

    try {
      setPublishing(true);
      const res = await api.togglePublish(Array.from(selectedFareIds), 1, 'Special Fare Broadcast');
      if (res.success) {
        setStatus({
          type: 'success',
          text: `🎉 ${res.updated_count} fares sent to Special Fares Sheet!`
        });
        loadComparisons();
        setTimeout(() => {
          setActiveTab('publish');
        }, 400);
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to send selected fares to special fares sheet.' });
    } finally {
      setPublishing(false);
    }
  };

  const handleQuickPublishSingle = async (fareId) => {
    try {
      const res = await api.togglePublish([fareId], 1, 'Special Fare Broadcast');
      if (res.success) {
        loadComparisons();
        setStatus({ type: 'success', text: 'Fare sent to Special Fares Sheet!' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Export currently displayed (selected) sectors to Excel (.xlsx)
  const handleExportExcel = () => {
    if (displayedSectors.length === 0) {
      setStatus({ type: 'error', text: 'No fares in selected sector(s) to export.' });
      return;
    }
    exportComparisonDeskToExcel(displayedSectors);
    const sectorLabels = displayedSectors.map(s => s.label).join(', ');
    setStatus({ 
      type: 'success', 
      text: `📥 Exported ${displayedSectors.length} sector(s) (${sectorLabels}) to Excel (.xlsx)!` 
    });
  };

  // 1-Click Export a single specific sector directly from its header
  const handleExportSingleSector = (sector) => {
    exportComparisonDeskToExcel([sector]);
    setStatus({ 
      type: 'success', 
      text: `📥 Exported sector ${sector.label} (${sector.items.length} fares) to Excel (.xlsx)!` 
    });
  };

  const renderRow = (group, rowIdx, showAirline = false) => {
    const isExpanded = expandedGroupKeys.has(group.groupKey);
    const hasMultipleQuotes = group.fares.length > 1;
    const winnerFare = group.fares.find(f => f.is_best_net) || group.fares[0];
    const isWinnerSelected = winnerFare && selectedFareIds.has(winnerFare.id);
    const airlineFullName = group.airline_name || getAirlineName(group.airline_code, airlines);

    const sortedQuotes = [...group.fares].sort((a, b) => Number(a.net_fare) - Number(b.net_fare));
    const runnerUp = sortedQuotes.length > 1 ? sortedQuotes[1] : null;
    const colSpan = showAirline ? 9 : 8;

    return (
      <React.Fragment key={group.groupKey || rowIdx}>
        <tr
          className={`transition ${
            isWinnerSelected 
              ? 'bg-blue-50/80 font-medium' 
              : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
          } hover:bg-amber-50/40`}
        >
          {/* Checkbox */}
          <td className="py-2 px-2 text-center">
            <input
              type="checkbox"
              checked={isWinnerSelected}
              onChange={() => winnerFare && toggleSelectFare(winnerFare.id)}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
          </td>

          {/* Travel Date */}
          <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
            <span>{formatDateDisplay(group.travel_date)}</span>
          </td>

          {/* Airline Column (only if showAirline is true) */}
          {showAirline && (
            <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">
              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                {airlineFullName}
              </span>
            </td>
          )}

          {/* Lowest Net Fare */}
          <td className="py-2 px-3 text-right font-black text-slate-950 text-sm whitespace-nowrap bg-emerald-50/40">
            ₹{Number(group.best_net_fare).toLocaleString('en-IN')}
          </td>

          {/* Best Vendor & Arbitrage Badge */}
          <td className="py-2 px-3 whitespace-nowrap">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-slate-900">{group.best_vendor_name}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  #1
                </span>
              </div>
              {runnerUp && (runnerUp.net_fare - group.best_net_fare) >= 1500 ? (
                <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                  <span>💰 Save ₹{(runnerUp.net_fare - group.best_net_fare).toLocaleString('en-IN')} vs {runnerUp.vendor_name}</span>
                </div>
              ) : runnerUp && (runnerUp.net_fare - group.best_net_fare) >= 800 ? (
                <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                  <span>🔥 Save ₹{(runnerUp.net_fare - group.best_net_fare).toLocaleString('en-IN')} vs {runnerUp.vendor_name}</span>
                </div>
              ) : null}
            </div>
          </td>

          {/* All Vendor Quotes & Comparison */}
          <td className="py-2 px-3 text-center whitespace-nowrap">
            {hasMultipleQuotes ? (
              <button
                onClick={() => toggleExpandGroup(group.groupKey)}
                className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition inline-flex items-center space-x-1 cursor-pointer"
                title="Click to see all competing vendor rates"
              >
                <span>{group.fares.length} Quotes</span>
                {runnerUp && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    (Next: +₹{runnerUp.price_difference_from_lowest || (runnerUp.net_fare - group.best_net_fare)})
                  </span>
                )}
                {isExpanded ? <ChevronDown className="w-3 h-3 text-purple-700" /> : <ChevronRight className="w-3 h-3 text-purple-700" />}
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                1 Quote (Only {group.best_vendor_name})
              </span>
            )}
          </td>

          {/* Baggage */}
          <td className="py-2 px-2 text-center whitespace-nowrap">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              (winnerFare?.baggage || '').includes('30') ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-900'
            }`}>
              {winnerFare?.baggage || '30kg'}
            </span>
          </td>

          {/* Refundable */}
          <td className="py-2 px-2 text-center whitespace-nowrap text-[10px]">
            {winnerFare?.is_refundable === 'REFUNDABLE' ? (
              <span className="text-emerald-700 font-bold">Ref</span>
            ) : (
              <span className="text-slate-400">Non-Ref</span>
            )}
          </td>

          {/* Action */}
          <td className="py-2 px-3 text-center whitespace-nowrap">
            {winnerFare?.is_published ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                <Check className="w-3 h-3" />
                <span>Added</span>
              </span>
            ) : (
              <button
                onClick={() => winnerFare && handleQuickPublishSingle(winnerFare.id)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-[11px] font-bold rounded border border-slate-300 transition cursor-pointer"
              >
                Send
              </button>
            )}
          </td>
        </tr>

        {/* Inline Expandable Drawer */}
        {isExpanded && (
          <tr className="bg-purple-50/40 border-y-2 border-purple-200">
            <td colSpan={colSpan} className="p-3">
              <div className="bg-white rounded-lg border border-purple-200 p-2.5 shadow-xs">
                <div className="flex items-center justify-between mb-2 text-xs font-bold text-purple-950">
                  <span>
                    Vendor Breakdown for {formatDateDisplay(group.travel_date)} • {airlineFullName} ({group.fares.length} quotes)
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Select quotes to include in final broadcast
                  </span>
                </div>

                <table className="min-w-full text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="py-1 px-2 text-center w-8">Select</th>
                      <th className="py-1 px-2 text-center w-12">Rank</th>
                      <th className="py-1 px-3 text-left">Vendor Name</th>
                      <th className="py-1 px-3 text-right">Net Fare</th>
                      <th className="py-1 px-3 text-right">Price Gap</th>
                      <th className="py-1 px-2 text-center">Baggage</th>
                      <th className="py-1 px-2 text-center">Refundable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedQuotes.map((q, qIdx) => {
                      const isQSelected = selectedFareIds.has(q.id);
                      const isTopWinner = q.is_best_net || qIdx === 0;

                      return (
                        <tr key={q.id} className={isTopWinner ? 'bg-emerald-50/60 font-semibold' : 'hover:bg-slate-50'}>
                          <td className="py-1.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={isQSelected}
                              onChange={() => toggleSelectFare(q.id)}
                              className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono">
                            {isTopWinner ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">#1</span>
                            ) : (
                              `#${qIdx + 1}`
                            )}
                          </td>
                          <td className="py-1.5 px-3 font-bold text-slate-900">
                            {q.vendor_name}
                            {isTopWinner && <span className="ml-1 text-[10px] text-emerald-700 font-bold">(Lowest)</span>}
                          </td>
                          <td className="py-1.5 px-3 text-right font-black text-slate-900">
                            ₹{Number(q.net_fare).toLocaleString('en-IN')}
                          </td>
                          <td className="py-1.5 px-3 text-right font-medium">
                            {isTopWinner ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ★ BEST RATE {runnerUp ? `(SAVE ₹${(runnerUp.net_fare - group.best_net_fare).toLocaleString('en-IN')})` : ''}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                +₹{Number(q.net_fare - group.best_net_fare).toLocaleString('en-IN')} ({Math.round(((q.net_fare - group.best_net_fare) / q.net_fare) * 100)}% higher)
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center text-[10px]">{q.baggage || '30kg'}</td>
                          <td className="py-1.5 px-2 text-center text-[10px]">
                            {q.is_refundable === 'REFUNDABLE' ? 'Ref' : 'Non-Ref'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-extrabold text-slate-900">
                Excel Rate Comparison Desk
              </h1>
              <span className="text-[11px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                Sector-wise & Date-wise
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              High-density spreadsheet view: Compares all vendor rates and highlights lowest net fares.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setGroupByMode('AIRLINE')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center space-x-1 ${
                groupByMode === 'AIRLINE'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Group by Airline first (e.g. Air India Express full dates, then SpiceJet full dates)"
            >
              <span>✈️ Airline-Wise</span>
            </button>
            <button
              onClick={() => setGroupByMode('DATE')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center space-x-1 ${
                groupByMode === 'DATE'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Combined view by travel date"
            >
              <span>📅 Date-Wise</span>
            </button>
          </div>

          {/* Feature 03: Past Dates Auto-Hide Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setHidePastDates(false)}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center space-x-1 cursor-pointer ${
                !hidePastDates
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show all rates across all dates (Default)"
            >
              <span>All Dates ({comparisons.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setHidePastDates(true)}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center space-x-1 cursor-pointer ${
                hidePastDates
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Hide dates before today"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Upcoming Only</span>
              {pastDatesCount > 0 && (
                <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  hidePastDates ? 'bg-purple-900 text-purple-200' : 'bg-slate-200 text-slate-700'
                }`}>
                  {pastDatesCount} past
                </span>
              )}
            </button>
          </div>

          <button
            onClick={loadComparisons}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSelectAllWinners}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span>Select All Lowest (#1)</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={displayedSectors.length === 0}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title={`Export ${displayedSectors.length} selected sector(s) to Excel (.xlsx)`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>
              {isAllSectorsSelected 
                ? 'Export to Excel (All Sectors)' 
                : displayedSectors.length === 1 
                ? `Export to Excel (${displayedSectors[0].label})` 
                : `Export to Excel (${displayedSectors.length} Sectors)`}
            </span>
          </button>

          <button
            onClick={handlePublishSelected}
            disabled={publishing || selectedFareIds.size === 0}
            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg shadow-xs transition flex items-center space-x-1.5 ${
              selectedFareIds.size > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send to Final Sheet ({selectedFareIds.size})</span>
          </button>
        </div>
      </div>

      {status && (
        <div className={`p-3 rounded-lg flex items-center space-x-2 text-xs font-semibold ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {status.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{status.text}</span>
        </div>
      )}

      {/* Compact Filters & Sector Multi-Select Pills */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          {/* Sector Multi-Select Dropdown */}
          <div className="relative" ref={sectorDropdownRef}>
            <label className="block text-[10px] font-bold text-purple-700 uppercase mb-0.5 flex items-center justify-between">
              <span>Sector Filter</span>
              {!isAllSectorsSelected && (
                <span className="text-[9px] bg-purple-100 text-purple-800 px-1 rounded font-black">
                  {selectedSectorKeys.size} Sel
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setIsSectorDropdownOpen(prev => !prev)}
              className={`w-full text-left rounded px-2 py-1 text-xs font-bold flex items-center justify-between border transition cursor-pointer ${
                !isAllSectorsSelected
                  ? 'bg-purple-50 text-purple-900 border-purple-300 ring-1 ring-purple-400'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="truncate">
                {isAllSectorsSelected
                  ? `All Sectors (${sectorGroups.length})`
                  : selectedSectorKeys.size === 1
                  ? sectorGroups.find(s => selectedSectorKeys.has(s.sectorKey))?.label || '1 Sector'
                  : `${selectedSectorKeys.size} Sectors Selected`}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isSectorDropdownOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {/* Dropdown Popover */}
            {isSectorDropdownOpen && (
              <div className="absolute z-50 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-2.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-800 text-[11px]">Select Sectors to Download</span>
                  <button
                    type="button"
                    onClick={() => setIsSectorDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={handleSelectAllSectors}
                    className="text-purple-700 hover:text-purple-900 font-bold"
                  >
                    ✓ Select All ({sectorGroups.length})
                  </button>
                  <span className="text-slate-400">
                    {displayedSectors.length} active
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {sectorGroups.map(sec => {
                    const isChecked = isSectorSelected(sec.sectorKey);
                    return (
                      <div
                        key={sec.sectorKey}
                        onClick={(e) => handleToggleSector(sec.sectorKey, e)}
                        className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer transition ${
                          isChecked && !isAllSectorsSelected
                            ? 'bg-purple-50 text-purple-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!isAllSectorsSelected ? isChecked : true}
                          onChange={(e) => handleToggleSector(sec.sectorKey, e)}
                          className="w-3.5 h-3.5 rounded text-purple-600 border-slate-300 cursor-pointer"
                        />
                        <span className="flex-1 font-semibold">📍 {sec.label}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-bold">
                          {sec.items.length}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    {displayedSectors.length} sector(s) will export
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSectorDropdownOpen(false)}
                    className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-[10px] font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">From</label>
            <input
              type="text"
              name="origin"
              value={filters.origin}
              onChange={handleFilterChange}
              placeholder="e.g. ATQ"
              maxLength={3}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold uppercase text-slate-900 text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">To</label>
            <input
              type="text"
              name="destination"
              value={filters.destination}
              onChange={handleFilterChange}
              placeholder="e.g. DXB"
              maxLength={3}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold uppercase text-slate-900 text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Date</label>
            <input
              type="date"
              name="travel_date"
              value={filters.travel_date}
              onChange={handleFilterChange}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Airline</label>
            <select
              name="airline_code"
              value={filters.airline_code}
              onChange={handleFilterChange}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 font-semibold text-xs"
            >
              <option value="">All Airlines</option>
              {airlines.map(a => (
                <option key={a.code} value={a.code}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Vendor</label>
            <select
              name="vendor_id"
              value={filters.vendor_id}
              onChange={handleFilterChange}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs"
            >
              <option value="">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sector Quick Filter Pills with Multi-Select Support */}
        {sectorGroups.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <div className="flex items-center space-x-1 mr-1 text-slate-500">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                Sectors (Select Multiple for Download):
              </span>
            </div>

            {/* All Sectors Button */}
            <button
              type="button"
              onClick={handleSelectAllSectors}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition flex items-center space-x-1 cursor-pointer ${
                isAllSectorsSelected
                  ? 'bg-purple-700 text-white shadow-xs ring-1 ring-purple-900'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isAllSectorsSelected && <Check className="w-3 h-3 text-white" />}
              <span>All Sectors ({totalFaresCount})</span>
            </button>

            {/* Individual Sector Multi-Select Pills */}
            {sectorGroups.map(sec => {
              const isChecked = isSectorSelected(sec.sectorKey);
              const isActiveInFilter = !isAllSectorsSelected && isChecked;

              return (
                <div
                  key={sec.sectorKey}
                  className={`inline-flex items-center rounded-md border text-xs font-bold transition overflow-hidden shadow-2xs ${
                    isActiveInFilter
                      ? 'bg-purple-700 text-white border-purple-800'
                      : isAllSectorsSelected
                      ? 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {/* Checkbox Icon (Clicking toggles selection) */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleSector(sec.sectorKey, e)}
                    className={`px-1.5 py-1 transition flex items-center justify-center cursor-pointer ${
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

                  {/* Sector Label & Count (Clicking isolates or toggles) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isAllSectorsSelected) {
                        handleIsolateSector(sec.sectorKey);
                      } else {
                        handleToggleSector(sec.sectorKey);
                      }
                    }}
                    className={`px-2 py-1 flex items-center space-x-1.5 cursor-pointer ${
                      isActiveInFilter ? 'hover:bg-purple-800' : 'hover:bg-purple-100'
                    }`}
                    title={`Click to filter ${sec.label} (${sec.items.length} fares)`}
                  >
                    <span>✈️ {sec.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      isActiveInFilter
                        ? 'bg-purple-950 text-purple-200'
                        : isAllSectorsSelected
                        ? 'bg-purple-200 text-purple-900'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {sec.items.length}
                    </span>
                  </button>
                </div>
              );
            })}

            {/* Selection info & Quick Export if multiple sectors selected */}
            {!isAllSectorsSelected && (
              <div className="flex items-center space-x-1.5 ml-2">
                <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                  {selectedSectorKeys.size} Sector{selectedSectorKeys.size > 1 ? 's' : ''} Selected
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllSectors}
                  className="text-[10px] text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                >
                  Show All
                </button>
              </div>
            )}
          </div>
        )}

        {/* Airline Quick Filter Pills */}
        {availableAirlines.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Airlines:</span>
            <button
              onClick={() => setActiveAirlineFilter('ALL')}
              className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition ${
                activeAirlineFilter === 'ALL'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All Airlines ({comparisons.length})
            </button>
            {availableAirlines.map(air => (
              <button
                key={air.code}
                onClick={() => setActiveAirlineFilter(air.code)}
                className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition flex items-center space-x-1 ${
                  activeAirlineFilter === air.code
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>✈️ {air.name}</span>
                <span className={`text-[10px] px-1 rounded ${activeAirlineFilter === air.code ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {air.count}
                </span>
              </button>
            ))}
            {(filters.origin || filters.destination || filters.travel_date || filters.airline_code || filters.vendor_id || !isAllSectorsSelected || activeAirlineFilter !== 'ALL' || arbitrageOnlyFilter) && (
              <button
                onClick={handleClearFilters}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold ml-auto"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Feature 05: High Arbitrage Opportunity Filter */}
        {highArbitrageCount > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 flex items-center space-x-1">
              <span>🔥 Market Arbitrage:</span>
            </span>
            <button
              type="button"
              onClick={() => setArbitrageOnlyFilter(prev => !prev)}
              className={`px-2.5 py-1 text-xs font-black rounded-md transition flex items-center space-x-1.5 cursor-pointer ${
                arbitrageOnlyFilter
                  ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-600'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              <span>🔥 Big Savings Only (Gap ≥ ₹800)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-black ${
                arbitrageOnlyFilter ? 'bg-slate-900 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
                {highArbitrageCount} Dates
              </span>
            </button>
            {arbitrageOnlyFilter && (
              <span className="text-xs text-amber-700 font-semibold">
                (Filtered to dates with massive vendor price differences)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Excel-Like Sector-wise & Date-wise Spreadsheet */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
          <span className="text-xs font-semibold">Analyzing & Sorting Vendor Fares...</span>
        </div>
      ) : displayedSectors.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <p className="font-semibold text-slate-600 mb-1">No matching fare comparisons found.</p>
          <p className="text-xs">Add rates in "Vendor Heads Desk" or "Fast Entry" to compare vendors.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedSectors.map((sector) => {
            // Find overall lowest net fare for this sector
            let sectorLowestFare = null;
            for (const item of sector.items) {
              const best = item.fares.find(f => f.is_best_net) || item.fares[0];
              if (best && (!sectorLowestFare || Number(best.net_fare) < Number(sectorLowestFare.net_fare))) {
                sectorLowestFare = { ...best, airline_name: item.airline_name || getAirlineName(item.airline_code, airlines) };
              }
            }

            return (
              <div
                key={sector.sectorKey}
                className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden"
              >
                {/* Sector Header Strip (Excel Sheet Banner) */}
                <div className="px-3.5 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <span className="p-1 bg-purple-600/40 text-purple-300 rounded">
                      <Plane className="w-4 h-4 transform -rotate-45" />
                    </span>
                    <span className="font-black tracking-wide text-base text-white">
                      📍 {sector.label}
                    </span>
                    {sector.cityName && (
                      <span className="text-xs text-slate-300 hidden sm:inline">
                        ({sector.cityName})
                      </span>
                    )}
                    <span className="text-[11px] bg-purple-950 text-purple-200 border border-purple-700 px-2 py-0.5 rounded-full font-bold">
                      {sector.airlines.length} Airlines
                    </span>
                    <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-semibold">
                      {sector.items.length} Dates Total
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    {sector.maxSectorSavings > 0 && (
                      <span className="text-[11px] bg-amber-950/90 text-amber-300 border border-amber-600/80 px-2.5 py-0.5 rounded-md font-bold flex items-center space-x-1 shadow-xs">
                        <span>🔥 Max Arbitrage Gap: ₹{sector.maxSectorSavings.toLocaleString('en-IN')}</span>
                      </span>
                    )}
                    {sectorLowestFare && (
                      <span className="text-[11px] bg-emerald-950/90 text-emerald-300 border border-emerald-700 px-2.5 py-0.5 rounded-md font-semibold flex items-center space-x-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Lowest in Sector: <strong className="text-amber-300 font-extrabold">₹{Number(sectorLowestFare.net_fare).toLocaleString('en-IN')}</strong> ({sectorLowestFare.vendor_name} • {sectorLowestFare.airline_name})</span>
                      </span>
                    )}
                    <button
                      onClick={() => handleSelectSectorWinners(sector.items)}
                      className="text-xs text-purple-300 hover:text-white font-bold underline cursor-pointer"
                    >
                      Select Sector Lowest
                    </button>
                    <button
                      onClick={() => handleExportSingleSector(sector)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      title={`Download ${sector.label} fares as Excel (.xlsx)`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                      <span>Export Sector</span>
                    </button>
                  </div>
                </div>

                {/* Content: Grouped by Airline or Grouped by Date */}
                {groupByMode === 'AIRLINE' ? (
                  <div className="divide-y divide-slate-200 bg-slate-50/50">
                    {sector.airlines.map((airlineGroup) => (
                      <div key={airlineGroup.airlineCode} className="p-3 bg-white space-y-2">
                        {/* Airline Header Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-slate-100 via-indigo-50/60 to-purple-50/60 rounded-lg border border-slate-200">
                          <div className="flex items-center space-x-2.5">
                            <span className="p-1 rounded bg-blue-600 text-white shadow-xs">
                              <Plane className="w-3.5 h-3.5 transform -rotate-45" />
                            </span>
                            <span className="font-extrabold text-slate-900 text-sm tracking-wide">
                              ✈️ {airlineGroup.airlineName}
                            </span>
                            <span className="text-[11px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                              {airlineGroup.items.length} Dates
                            </span>
                            {airlineGroup.lowestFare && (
                              <span className="text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                                <Trophy className="w-3 h-3 text-amber-600" />
                                <span>Lowest: ₹{Number(airlineGroup.lowestFare.net_fare).toLocaleString('en-IN')} ({airlineGroup.lowestFare.vendor_name})</span>
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleSelectAirlineWinners(airlineGroup.items)}
                            className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-400 text-xs font-bold rounded-md transition shadow-2xs flex items-center space-x-1 cursor-pointer"
                          >
                            <Trophy className="w-3 h-3 text-amber-500" />
                            <span>Select All {airlineGroup.airlineName} Lowest</span>
                          </button>
                        </div>

                        {/* Airline Dates Table (Chronological: 13-Sep, 14-Sep, 15-Sep...) */}
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="min-w-full text-xs divide-y divide-slate-200 border-collapse">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] tracking-wider border-b border-slate-300">
                              <tr>
                                <th className="py-2 px-2.5 text-center w-10">Select</th>
                                <th className="py-2 px-3 text-left w-36">Travel Date</th>
                                <th className="py-2 px-3 text-right font-black w-28 bg-emerald-50/60 text-emerald-950">Lowest Net</th>
                                <th className="py-2 px-3 text-left w-36">Best Vendor</th>
                                <th className="py-2 px-3 text-center w-48">Vendor Quotes</th>
                                <th className="py-2 px-2 text-center w-16">Baggage</th>
                                <th className="py-2 px-2 text-center w-16">Refund</th>
                                <th className="py-2 px-3 text-center w-24">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {airlineGroup.items.map((group, rowIdx) => renderRow(group, rowIdx, false))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Date-wise Combined Table */
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs divide-y divide-slate-200 border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] tracking-wider border-b border-slate-300 sticky top-0">
                        <tr>
                          <th className="py-2 px-2.5 text-center w-10">Select</th>
                          <th className="py-2 px-3 text-left w-36">Travel Date</th>
                          <th className="py-2 px-3 text-left w-36">Airline</th>
                          <th className="py-2 px-3 text-right font-black w-28 bg-emerald-50/60 text-emerald-950">Lowest Net</th>
                          <th className="py-2 px-3 text-left w-36">Best Vendor</th>
                          <th className="py-2 px-3 text-center w-48">Vendor Quotes</th>
                          <th className="py-2 px-2 text-center w-16">Baggage</th>
                          <th className="py-2 px-2 text-center w-16">Refund</th>
                          <th className="py-2 px-3 text-center w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {sector.items.map((group, rowIdx) => renderRow(group, rowIdx, true))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
