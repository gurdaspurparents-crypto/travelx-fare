import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, Plane, Building2, Calendar, Search, Filter, 
  ArrowUpDown, Download, Copy, Check, RefreshCw, X, ArrowRight,
  SlidersHorizontal, ChevronDown, CheckCircle2, DollarSign,
  Layers, MapPin, Clock, Tag, Sparkles, AlertCircle, ShieldCheck,
  Share2, ExternalLink
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { api } from '../utils/api';
import { getAirlineName, getFlightTiming } from '../utils/airlineHelper';
import { formatRouteName, getCityName } from '../utils/airportHelper';
import { formatStreakLabel, formatDayMonth } from '../utils/dateGroupingHelper';

export default function FinalRatesDesk({ masterData = {}, setActiveTab }) {
  const { vendors = [], airlines = [], routes = [] } = masterData;

  const [fares, setFares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  // View Mode: 'CONSOLIDATED' (Grouped Dates like "21, 22 Sep [2 Dates]") vs 'DETAILED' (Day by Day)
  const [viewMode, setViewMode] = useState('CONSOLIDATED');

  // Global Realtime Search
  const [searchQuery, setSearchQuery] = useState('');

  // Primary Filter Dimension: 'route' | 'airline' | 'vendor' | 'month'
  const [activeDimension, setActiveDimension] = useState('route');

  // Selected Filters
  const [selectedAirline, setSelectedAirline] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedVendor, setSelectedVendor] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedBaggage, setSelectedBaggage] = useState('ALL');

  // Excel Column Sorting: { col: 'travel_date', direction: 'asc' | 'desc' }
  const [sortConfig, setSortConfig] = useState({ col: 'travel_date', direction: 'asc' });

  // Column Header Filter Dropdown: 'airline' | 'route' | 'vendor' | 'baggage' | null
  const [activeHeaderFilter, setActiveHeaderFilter] = useState(null);
  const headerFilterRef = useRef(null);

  // Density mode: 'compact' (Excel rows) vs 'normal'
  const [density, setDensity] = useState('compact');

  // Font Size Zoom Level: default 12px (saved in localStorage)
  const [fontSizeLevel, setFontSizeLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('travelx_final_rates_font_size');
      return saved ? Math.min(18, Math.max(9, Number(saved))) : 12;
    } catch (e) {
      return 12;
    }
  });

  // Copy feedback state
  const [copiedId, setCopiedId] = useState(null);
  const [broadcastCopied, setBroadcastCopied] = useState(false);

  // WhatsApp Share Modal state
  const [shareModalFare, setShareModalFare] = useState(null);
  const [quoteStyle, setQuoteStyle] = useState('PROFESSIONAL');
  const [customQuoteText, setCustomQuoteText] = useState('');
  const [modalCopied, setModalCopied] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (headerFilterRef.current && !headerFilterRef.current.contains(event.target)) {
        setActiveHeaderFilter(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleIncreaseFont = () => {
    setFontSizeLevel(prev => {
      const next = Math.min(prev + 1, 20);
      try { localStorage.setItem('travelx_final_rates_font_size', next); } catch (e) {}
      return next;
    });
  };

  const handleDecreaseFont = () => {
    setFontSizeLevel(prev => {
      const next = Math.max(prev - 1, 9);
      try { localStorage.setItem('travelx_final_rates_font_size', next); } catch (e) {}
      return next;
    });
  };

  const handleResetFont = () => {
    setFontSizeLevel(12);
    try { localStorage.setItem('travelx_final_rates_font_size', 12); } catch (e) {}
  };

  // Load all fares
  const loadFares = async () => {
    try {
      setLoading(true);
      setStatus(null);
      const res = await api.getAllFares({ limit: 5000 });
      if (res.success) {
        setFares(res.fares || []);
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to load fares' });
      }
    } catch (err) {
      console.error('Error fetching final rates:', err);
      setStatus({ type: 'error', text: 'Error connecting to server' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFares();
  }, []);

  // Helper: Calculate Final Selling Rate
  const getFinalRate = (f) => {
    const pub = Number(f.publish_fare);
    if (pub && pub > 0) return pub;
    const net = Number(f.net_fare) || 0;
    const margin = Number(f.margin_amount) || 0;
    return net + margin;
  };

  // Helper: Format Date with Day
  const formatDateWithDay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()} (${days[d.getDay()]})`;
    } catch (e) {
      return dateStr;
    }
  };

  // Helper: Format Month key (YYYY-MM to "Sep 2026")
  const formatMonthName = (monthKey) => {
    if (!monthKey) return '';
    try {
      const [y, m] = monthKey.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(m, 10) - 1;
      return `${months[mIdx] || m} ${y}`;
    } catch (e) {
      return monthKey;
    }
  };

  // -------------------------------------------------------------
  // Dynamic Tab Counts for Filter Strip (Based on all loaded fares)
  // -------------------------------------------------------------
  const filterOptions = useMemo(() => {
    const airlineMap = new Map();
    const routeMap = new Map();
    const vendorMap = new Map();
    const monthMap = new Map();
    const baggageMap = new Map();

    fares.forEach(f => {
      // Airline
      const aCode = (f.airline_code || 'OTHER').toUpperCase();
      const aName = getAirlineName(aCode, airlines) || aCode;
      if (!airlineMap.has(aCode)) {
        airlineMap.set(aCode, { code: aCode, name: aName, count: 0 });
      }
      airlineMap.get(aCode).count++;

      // Route
      const rKey = `${(f.origin || '').toUpperCase()}-${(f.destination || '').toUpperCase()}`;
      if (!routeMap.has(rKey)) {
        const routeLabel = formatRouteName(f.origin, f.destination, 'ARROW', routes);
        routeMap.set(rKey, { key: rKey, origin: f.origin, destination: f.destination, label: routeLabel, count: 0 });
      }
      routeMap.get(rKey).count++;

      // Vendor
      const vKey = String(f.vendor_id || f.vendor_name || 'Unknown');
      const vName = f.vendor_name || vKey;
      if (!vendorMap.has(vKey)) {
        vendorMap.set(vKey, { key: vKey, name: vName, count: 0 });
      }
      vendorMap.get(vKey).count++;

      // Month
      if (f.travel_date) {
        const mKey = f.travel_date.slice(0, 7); // YYYY-MM
        if (!monthMap.has(mKey)) {
          monthMap.set(mKey, { key: mKey, label: formatMonthName(mKey), count: 0 });
        }
        monthMap.get(mKey).count++;
      }

      // Baggage
      const bKey = (f.baggage || '30kg').trim();
      if (!baggageMap.has(bKey)) {
        baggageMap.set(bKey, { key: bKey, count: 0 });
      }
      baggageMap.get(bKey).count++;
    });

    return {
      airlines: Array.from(airlineMap.values()).sort((a, b) => b.count - a.count),
      routes: Array.from(routeMap.values()).sort((a, b) => b.count - a.count),
      vendors: Array.from(vendorMap.values()).sort((a, b) => b.count - a.count),
      months: Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key)),
      baggage: Array.from(baggageMap.values()).sort((a, b) => b.count - a.count)
    };
  }, [fares, airlines, routes]);

  // -------------------------------------------------------------
  // Filtered and Sorted Fares
  // -------------------------------------------------------------
  const filteredFares = useMemo(() => {
    let list = fares.filter(f => {
      // Dimension filters
      if (selectedAirline !== 'ALL' && (f.airline_code || '').toUpperCase() !== selectedAirline.toUpperCase()) {
        return false;
      }
      if (selectedRoute !== 'ALL') {
        const rKey = `${(f.origin || '').toUpperCase()}-${(f.destination || '').toUpperCase()}`;
        if (rKey !== selectedRoute.toUpperCase()) return false;
      }
      if (selectedVendor !== 'ALL') {
        const vKey = String(f.vendor_id || f.vendor_name);
        if (vKey !== selectedVendor && f.vendor_name !== selectedVendor) return false;
      }
      if (selectedMonth !== 'ALL' && f.travel_date) {
        if (!f.travel_date.startsWith(selectedMonth)) return false;
      }
      if (selectedBaggage !== 'ALL') {
        if ((f.baggage || '').toLowerCase() !== selectedBaggage.toLowerCase()) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullAirline = (getAirlineName(f.airline_code, airlines) || '').toLowerCase();
        const originCity = (getCityName(f.origin, routes) || '').toLowerCase();
        const destCity = (getCityName(f.destination, routes) || '').toLowerCase();
        const fltNo = String(f.flight_number || '').toLowerCase();
        const routeCode = `${f.origin}-${f.destination}`.toLowerCase();
        const vName = (f.vendor_name || '').toLowerCase();
        const tDate = String(f.travel_date || '').toLowerCase();
        const bag = (f.baggage || '').toLowerCase();

        const match = fullAirline.includes(q) ||
          f.airline_code?.toLowerCase().includes(q) ||
          originCity.includes(q) ||
          destCity.includes(q) ||
          fltNo.includes(q) ||
          routeCode.includes(q) ||
          vName.includes(q) ||
          tDate.includes(q) ||
          bag.includes(q);

        if (!match) return false;
      }

      return true;
    });

    // Multi-tier Intelligent Column Sorting
    list.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;

      // 1. Sort by Final Rate
      if (sortConfig.col === 'final_rate') {
        const rateA = getFinalRate(a);
        const rateB = getFinalRate(b);
        if (rateA !== rateB) {
          return (rateA - rateB) * dir;
        }
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp;
        return String(a.flight_number || '').localeCompare(String(b.flight_number || ''));
      }

      // 2. Sort by Net Base
      if (sortConfig.col === 'net_fare') {
        const netA = Number(a.net_fare) || 0;
        const netB = Number(b.net_fare) || 0;
        if (netA !== netB) {
          return (netA - netB) * dir;
        }
        return String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
      }

      // 3. Sort by Travel Date (Default: Earliest date, and on the SAME date, LOWEST FARE FIRST!)
      if (sortConfig.col === 'travel_date') {
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) {
          return dComp * dir;
        }
        // Crucial secondary sort: Lowest price on this date ALWAYS comes first
        const rateA = getFinalRate(a);
        const rateB = getFinalRate(b);
        if (rateA !== rateB) {
          return rateA - rateB;
        }
        const aCodeComp = String(a.airline_code || '').localeCompare(String(b.airline_code || ''));
        if (aCodeComp !== 0) return aCodeComp;
        return String(a.flight_number || '').localeCompare(String(b.flight_number || ''));
      }

      // 4. Sort by Flight Number
      if (sortConfig.col === 'flight_number') {
        const fnA = String(a.flight_number || '').trim();
        const fnB = String(b.flight_number || '').trim();
        const numA = parseInt(fnA.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(fnB.replace(/\D/g, ''), 10) || 0;
        const numComp = numA !== numB ? (numA - numB) : fnA.localeCompare(fnB);
        if (numComp !== 0) {
          return numComp * dir;
        }
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp;
        return getFinalRate(a) - getFinalRate(b);
      }

      // 5. Sort by Airline
      if (sortConfig.col === 'airline') {
        const aNameA = getAirlineName(a.airline_code, airlines) || a.airline_code || '';
        const aNameB = getAirlineName(b.airline_code, airlines) || b.airline_code || '';
        const aComp = aNameA.localeCompare(aNameB);
        if (aComp !== 0) {
          return aComp * dir;
        }
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp;
        return getFinalRate(a) - getFinalRate(b);
      }

      // 6. Sort by Vendor
      if (sortConfig.col === 'vendor') {
        const vA = String(a.vendor_name || '').trim();
        const vB = String(b.vendor_name || '').trim();
        const vComp = vA.localeCompare(vB);
        if (vComp !== 0) {
          return vComp * dir;
        }
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp;
        return getFinalRate(a) - getFinalRate(b);
      }

      // 7. Sort by Route / Sector
      if (sortConfig.col === 'route') {
        const rA = `${a.origin}-${a.destination}`;
        const rB = `${b.origin}-${b.destination}`;
        const rComp = rA.localeCompare(rB);
        if (rComp !== 0) {
          return rComp * dir;
        }
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp;
        return getFinalRate(a) - getFinalRate(b);
      }

      // Fallback
      const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
      if (dComp !== 0) return dComp * dir;
      return getFinalRate(a) - getFinalRate(b);
    });

    return list;
  }, [fares, selectedAirline, selectedRoute, selectedVendor, selectedMonth, selectedBaggage, searchQuery, sortConfig, airlines, routes]);

  // Handle Column Header Sort Click
  const handleSort = (col) => {
    setSortConfig(prev => {
      if (prev.col === col) {
        return { col, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { col, direction: 'asc' };
    });
  };

  // Helper to render sort arrow in column headers
  const renderSortIndicator = (col) => {
    if (sortConfig.col !== col) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 ml-1 inline" />;
    }
    return sortConfig.direction === 'asc' ? (
      <span className="text-[11px] text-amber-400 font-black ml-1 inline">▲</span>
    ) : (
      <span className="text-[11px] text-amber-400 font-black ml-1 inline">▼</span>
    );
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedAirline('ALL');
    setSelectedRoute('ALL');
    setSelectedVendor('ALL');
    setSelectedMonth('ALL');
    setSelectedBaggage('ALL');
    setSearchQuery('');
    setActiveHeaderFilter(null);
  };

  const hasActiveFilters = 
    selectedAirline !== 'ALL' || 
    selectedRoute !== 'ALL' || 
    selectedVendor !== 'ALL' || 
    selectedMonth !== 'ALL' || 
    selectedBaggage !== 'ALL' ||
    searchQuery.trim() !== '';

  // Calculate quick stats on filtered results
  const summaryStats = useMemo(() => {
    if (filteredFares.length === 0) {
      return { total: 0, minFare: 0, maxFare: 0, avgFare: 0, uniqueRoutes: 0, uniqueAirlines: 0 };
    }
    const finalRates = filteredFares.map(f => getFinalRate(f));
    const minFare = Math.min(...finalRates);
    const maxFare = Math.max(...finalRates);
    const sum = finalRates.reduce((acc, curr) => acc + curr, 0);
    const avgFare = Math.round(sum / finalRates.length);

    const rSet = new Set(filteredFares.map(f => `${f.origin}-${f.destination}`));
    const aSet = new Set(filteredFares.map(f => f.airline_code));

    return {
      total: filteredFares.length,
      minFare,
      maxFare,
      avgFare,
      uniqueRoutes: rSet.size,
      uniqueAirlines: aSet.size
    };
  }, [filteredFares]);

  // -------------------------------------------------------------
  // Consolidated Grouped Date Ranges ("jase yeh date hui hai waise hi")
  // Groups identical sector, airline, flight no, vendor, final rate into clean date streaks
  // e.g. "21, 22 Sep (2 Dates)", "24, 26, 29 Sep (3 Dates)", "01 Oct to 04 Oct (4 Dates)"
  // -------------------------------------------------------------
  const consolidatedFares = useMemo(() => {
    if (!filteredFares || filteredFares.length === 0) return [];

    // Group by Sector (origin-destination)
    const sectorMap = new Map();
    filteredFares.forEach(f => {
      const sKey = `${(f.origin || '').toUpperCase()}-${(f.destination || '').toUpperCase()}`;
      if (!sectorMap.has(sKey)) sectorMap.set(sKey, []);
      sectorMap.get(sKey).push(f);
    });

    const result = [];

    for (const [sKey, sectorItems] of sectorMap.entries()) {
      // Group by Airline
      const airlineMap = new Map();
      sectorItems.forEach(f => {
        const aKey = (f.airline_code || 'OTHER').toUpperCase();
        if (!airlineMap.has(aKey)) airlineMap.set(aKey, []);
        airlineMap.get(aKey).push(f);
      });

      for (const [aKey, airItems] of airlineMap.entries()) {
        // Group by Flight Number
        const flightMap = new Map();
        airItems.forEach(f => {
          let fltKey = String(f.flight_number || '').trim();

          // Auto-normalize flight number if truncated
          if ((!fltKey || fltKey === 'IX' || fltKey === 'IX 1') && f.origin === 'ATQ' && f.destination === 'SHJ' && f.airline_code === 'IX') {
            fltKey = 'IX 137';
          } else if ((!fltKey || fltKey === '6E' || fltKey === '6E 1') && f.origin === 'ATQ' && f.destination === 'SHJ' && f.airline_code === '6E') {
            fltKey = '6E 1427';
          } else if ((!fltKey || fltKey === 'IX' || fltKey === 'IX 1') && f.origin === 'ATQ' && f.destination === 'DXB' && f.airline_code === 'IX') {
            fltKey = 'IX 191';
          } else if ((!fltKey || fltKey === 'SG') && f.origin === 'ATQ' && f.destination === 'DXB' && f.airline_code === 'SG') {
            fltKey = 'SG 5155';
          }

          if (!flightMap.has(fltKey)) flightMap.set(fltKey, []);
          flightMap.get(fltKey).push({ ...f, flight_number: fltKey || f.flight_number });
        });

        for (const [fltKey, fltItems] of flightMap.entries()) {
          // Step 1: For each travel date, pick ONLY the lowest/best rate ("jo sab se kam rate hai", like Special Fare & Broadcast)
          // and collect all vendors who offer that lowest rate
          const dateMinFareMap = new Map(); // dStr -> { minFare, vendorMap: Map(vKey -> item) }

          fltItems.forEach(item => {
            const dStr = String(item.travel_date || '').slice(0, 10);
            const fare = getFinalRate(item);
            const vKey = String(item.vendor_id || item.vendor_name || '');

            if (!dateMinFareMap.has(dStr)) {
              dateMinFareMap.set(dStr, { minFare: fare, vendorMap: new Map([[vKey, item]]) });
            } else {
              const current = dateMinFareMap.get(dStr);
              if (fare < current.minFare) {
                // Found cheaper selling rate: replace with cheaper winner
                dateMinFareMap.set(dStr, { minFare: fare, vendorMap: new Map([[vKey, item]]) });
              } else if (fare === current.minFare) {
                // Same lowest rate across vendors: keep all vendors offering this rate
                const vMap = current.vendorMap;
                if (!vMap.has(vKey) || (item.updated_at || '') > (vMap.get(vKey).updated_at || '')) {
                  vMap.set(vKey, item);
                }
              }
              // If fare > current.minFare, omit higher rate so there are never overlapping duplicate dates!
            }
          });

          // Step 2: Group consecutive dates sharing the same lowest rate in the same month into streaks
          const bucketMap = new Map();
          const sortedDates = Array.from(dateMinFareMap.keys()).sort();

          sortedDates.forEach(dStr => {
            const { minFare, vendorMap } = dateMinFareMap.get(dStr);
            const monthKey = dStr.slice(0, 7);
            const bKey = `${monthKey}_${minFare}`;
            if (!bucketMap.has(bKey)) bucketMap.set(bKey, []);
            bucketMap.get(bKey).push({
              travel_date: dStr,
              minFare,
              vendors: Array.from(vendorMap.values())
            });
          });

          // Step 3: For each bucket, sort chronologically and format streak
          for (const dateEntries of bucketMap.values()) {
            dateEntries.sort((x, y) => x.travel_date.localeCompare(y.travel_date));

            const repDateStreak = dateEntries.map(e => e.vendors[0]);
            const allBucketItems = dateEntries.flatMap(e => e.vendors);
            const first = repDateStreak[0];
            const last = repDateStreak[repDateStreak.length - 1];
            const dateLabel = formatStreakLabel(repDateStreak);
            const finalRate = getFinalRate(first);
            const timingInfo = getFlightTiming(first.flight_number, first.origin, first.destination);
            const depTime = first.departure_time || timingInfo?.dep || '';
            const arrTime = first.arrival_time || timingInfo?.arr || '';

            // Unique vendor names sorted alphabetically (e.g. "Ghai, Kandhari" or "Bittu, Kandhari, Monga")
            const uniqueVendors = Array.from(
              new Set(allBucketItems.map(x => (x.vendor_name || '').trim()).filter(Boolean))
            ).sort((a, b) => a.localeCompare(b));
            const vendorDisplayName = uniqueVendors.join(', ') || first.vendor_name || 'Vendor';

            // Unique vendor IDs
            const uniqueVendorIds = Array.from(
              new Set(allBucketItems.map(x => String(x.vendor_id || '')).filter(Boolean))
            );

            result.push({
              id: `consolidated-${first.id}-${dateEntries.length}-${dateLabel}`,
              origin: first.origin,
              destination: first.destination,
              airline_code: first.airline_code,
              flight_number: first.flight_number,
              vendor_id: uniqueVendorIds.join(','),
              vendor_name: vendorDisplayName,
              vendor_list: uniqueVendors,
              departure_time: depTime,
              arrival_time: arrTime,
              net_fare: Number(first.net_fare) || 0,
              margin_amount: Number(first.margin_amount) || 0,
              publish_fare: Number(first.publish_fare) || 0,
              final_rate: finalRate,
              baggage: first.baggage || '30kg',
              is_refundable: first.is_refundable,
              travel_date: first.travel_date, // Earliest date for sorting
              end_date: last.travel_date,
              date_label: dateLabel,
              dates_count: dateEntries.length,
              streak_items: repDateStreak,
              raw_fares: allBucketItems
            });
          }
        }
      }
    }

    // Sort consolidated fares according to sortConfig
    result.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;

      if (sortConfig.col === 'final_rate') {
        if (a.final_rate !== b.final_rate) {
          return (a.final_rate - b.final_rate) * dir;
        }
        return String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
      }

      if (sortConfig.col === 'travel_date') {
        const sA = `${a.origin}-${a.destination}`;
        const sB = `${b.origin}-${b.destination}`;
        if (sA !== sB) return sA.localeCompare(sB);
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp * dir;
        if (a.final_rate !== b.final_rate) return a.final_rate - b.final_rate; // Lowest first!
        return String(a.flight_number || '').localeCompare(String(b.flight_number || ''));
      }

      if (sortConfig.col === 'flight_number') {
        const numA = parseInt(String(a.flight_number || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.flight_number || '').replace(/\D/g, ''), 10) || 0;
        const comp = numA !== numB ? (numA - numB) : String(a.flight_number || '').localeCompare(String(b.flight_number || ''));
        if (comp !== 0) return comp * dir;
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp;
        return a.final_rate - b.final_rate;
      }

      if (sortConfig.col === 'airline') {
        const comp = String(a.airline_code || '').localeCompare(String(b.airline_code || ''));
        if (comp !== 0) return comp * dir;
        const sA = `${a.origin}-${a.destination}`;
        const sB = `${b.origin}-${b.destination}`;
        if (sA !== sB) return sA.localeCompare(sB);
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp;
        return a.final_rate - b.final_rate;
      }

      if (sortConfig.col === 'vendor') {
        const comp = String(a.vendor_name || '').localeCompare(String(b.vendor_name || ''));
        if (comp !== 0) return comp * dir;
        const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
        if (dComp !== 0) return dComp;
        return a.final_rate - b.final_rate;
      }

      // Default: Sector, then travel_date ASC, then lowest rate ASC
      const sA = `${a.origin}-${a.destination}`;
      const sB = `${b.origin}-${b.destination}`;
      if (sA !== sB) return sA.localeCompare(sB);
      const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
      if (dComp !== 0) return dComp * dir;
      return a.final_rate - b.final_rate;
    });

    return result;
  }, [filteredFares, sortConfig]);

  // Current active display list based on view mode
  const displayedList = viewMode === 'CONSOLIDATED' ? consolidatedFares : filteredFares;

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // Helper: Generate structured Professional WhatsApp Quote Text
  // Exactly matching user's finalized format:
  // ✈️ *TRAVELX SPECIAL AIR FARE*
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // *Travel Dates:* 20 Sep   *Air India Express (IX 191)*
  //
  // *Amritsar to Dubai*
  // Timing :- 00:15 ➔ 02:55 (Non-Stop)
  //
  // *Special Fare:* *₹22,600/-* All-Inclusive
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ❌ *Fare Rule:* 100% Non-Refundable & Non-Changeable
  // 📲 *For Bookings:* Contact TravelX Desk
  // -------------------------------------------------------------
  const generateQuoteText = (f, style = 'PROFESSIONAL') => {
    if (!f) return '';
    const finalFare = f.final_rate !== undefined ? f.final_rate : getFinalRate(f);
    const originCity = getCityName(f.origin, routes) || f.origin;
    const destCity = getCityName(f.destination, routes) || f.destination;
    const dateFormatted = f.date_label || formatDayMonth(f.travel_date);
    const airlineName = getAirlineName(f.airline_code, airlines) || f.airline_code;
    const timingInfo = getFlightTiming(f.flight_number, f.origin, f.destination);
    const depTime = f.departure_time || timingInfo?.dep || '';
    const arrTime = f.arrival_time || timingInfo?.arr || '';
    const baggage = f.baggage ? (String(f.baggage).toLowerCase().includes('kg') ? f.baggage : `${f.baggage} Kg`) : '30 Kg';
    const fltNo = f.flight_number ? ` (${f.flight_number})` : '';

    const timeLine = (depTime && arrTime) 
      ? `Timing :- ${depTime} ➔ ${arrTime} (Non-Stop)\n` 
      : `Timing :- Direct Non-Stop Flight\n`;

    if (style === 'COMPACT') {
      const timeStr = (depTime && arrTime) ? `\nTiming :- ${depTime} ➔ ${arrTime} (Non-Stop)` : '';
      return `✈️ *TRAVELX SPECIAL AIR FARE*
━━━━━━━━━━━━━━━━━━━━━━━━━━
*Travel Dates:* ${dateFormatted}   *${airlineName}${fltNo}*
*${originCity} to ${destCity}*${timeStr}

*Special Fare:* *₹${finalFare.toLocaleString('en-IN')}/-*
━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *Fare Rule:* 100% Non-Refundable & Non-Changeable
📲 *For Bookings:* Contact TravelX Desk`;
    }

    if (style === 'DETAILED') {
      return `✈️ *TRAVELX SPECIAL AIR FARE*
━━━━━━━━━━━━━━━━━━━━━━━━━━
*Travel Dates:* ${dateFormatted}   *${airlineName}${fltNo}*

*${originCity} to ${destCity}*
${timeLine}Baggage: ${baggage} Check-in + 7 Kg Cabin

*Special Fare:* *₹${finalFare.toLocaleString('en-IN')}/-*
━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *Fare Rule:* 100% Non-Refundable & Non-Changeable
📲 *For Bookings:* Contact TravelX Desk`;
    }

    // Default: 'PROFESSIONAL' (Exact match to User's approved format)
    return `✈️ *TRAVELX SPECIAL AIR FARE*
━━━━━━━━━━━━━━━━━━━━━━━━━━
*Travel Dates:* ${dateFormatted}   *${airlineName}${fltNo}*

*${originCity} to ${destCity}*
${timeLine}
*Special Fare:* *₹${finalFare.toLocaleString('en-IN')}/-*
━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *Fare Rule:* 100% Non-Refundable & Non-Changeable
📲 *For Bookings:* Contact TravelX Desk`;
  };

  // -------------------------------------------------------------
  // Open Share Modal with initial text
  // -------------------------------------------------------------
  const handleOpenShareModal = (f) => {
    setShareModalFare(f);
    setCustomQuoteText(generateQuoteText(f, quoteStyle));
  };

  const handleSwitchQuoteStyle = (newStyle) => {
    setQuoteStyle(newStyle);
    if (shareModalFare) {
      setCustomQuoteText(generateQuoteText(shareModalFare, newStyle));
    }
  };

  // -------------------------------------------------------------
  // WhatsApp Single Quote Copy (Direct Row Button)
  // -------------------------------------------------------------
  const handleCopySingleQuote = (f) => {
    const quote = generateQuoteText(f, 'PROFESSIONAL');
    navigator.clipboard.writeText(quote);
    setCopiedId(f.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // -------------------------------------------------------------
  // WhatsApp Broadcast Copy (For All Currently Filtered Flights)
  // -------------------------------------------------------------
  const handleCopyBroadcast = () => {
    if (displayedList.length === 0) return;

    let filterTitle = 'ALL SPECIAL FARES';
    if (selectedAirline !== 'ALL') {
      filterTitle = `${getAirlineName(selectedAirline, airlines).toUpperCase()} SPECIAL FARES`;
    } else if (selectedRoute !== 'ALL') {
      filterTitle = `${selectedRoute.replace('-', ' ➔ ')} SPECIAL FARES`;
    }

    let text = `✈️ *TRAVELX SPECIAL AIR FARES*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⚡ *Updated:* ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | ${filterTitle}\n\n`;

    // Group by Sector
    const grouped = {};
    displayedList.forEach(f => {
      const originCity = getCityName(f.origin, routes) || f.origin;
      const destCity = getCityName(f.destination, routes) || f.destination;
      const key = `${originCity} to ${destCity}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(f);
    });

    Object.entries(grouped).forEach(([sector, sectorFares]) => {
      text += `*${sector}*\n`;
      sectorFares.forEach(f => {
        const finalFare = f.final_rate !== undefined ? f.final_rate : getFinalRate(f);
        const aName = getAirlineName(f.airline_code, airlines) || f.airline_code;
        const flt = f.flight_number ? ` (${f.flight_number})` : '';
        const dStr = f.date_label || formatDayMonth(f.travel_date);
        const countBadge = f.dates_count > 1 ? ` [${f.dates_count} Dates]` : '';
        const timingInfo = getFlightTiming(f.flight_number, f.origin, f.destination);
        const depTime = f.departure_time || timingInfo?.dep || '';
        const arrTime = f.arrival_time || timingInfo?.arr || '';
        const timePart = depTime && arrTime ? ` | ${depTime} ➔ ${arrTime}` : '';
        text += `• *${dStr}*${countBadge} | *${aName}${flt}*${timePart} ➔ *₹${finalFare.toLocaleString('en-IN')}/-*\n`;
      });
      text += `\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `❌ *Fare Rule:* 100% Non-Refundable & Non-Changeable\n`;
    text += `📲 *For Bookings:* Contact TravelX Desk`;

    navigator.clipboard.writeText(text);
    setBroadcastCopied(true);
    setTimeout(() => setBroadcastCopied(false), 2500);
  };

  // -------------------------------------------------------------
  // Export Filtered Table to Excel (.xlsx) using ExcelJS
  // -------------------------------------------------------------
  const handleExportExcel = async () => {
    if (displayedList.length === 0) {
      alert('No fares to export matching the current filters.');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'TravelX Special Fare Manager';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Final Rates', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
      });

      // Row 1: Banner
      ws.mergeCells('A1:K1');
      const bannerCell = ws.getCell('A1');
      let bannerTitle = 'TRAVELX FINAL SELLING RATES';
      if (selectedAirline !== 'ALL') bannerTitle += ` - ${getAirlineName(selectedAirline, airlines).toUpperCase()}`;
      if (selectedRoute !== 'ALL') bannerTitle += ` - ${selectedRoute.replace('-', ' ➔ ')}`;
      bannerCell.value = bannerTitle;
      bannerCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      bannerCell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 32;

      // Row 2: Headers
      const headers = [
        { header: '#', key: 'sno', width: 6 },
        { header: 'Sector', key: 'sector', width: 14 },
        { header: 'City Names', key: 'cities', width: 28 },
        { header: 'Airline', key: 'airline', width: 22 },
        { header: 'Flight No', key: 'flight_number', width: 12 },
        { header: viewMode === 'CONSOLIDATED' ? 'Dates Available' : 'Travel Date', key: 'travel_date', width: 22 },
        { header: 'Day / Count', key: 'day', width: 12 },
        { header: 'Timings', key: 'timing', width: 16 },
        { header: 'Final Rate (₹)', key: 'final_rate', width: 16 },
        { header: 'Vendor', key: 'vendor', width: 18 },
        { header: 'Refundable', key: 'refundable', width: 14 }
      ];

      ws.columns = headers;

      const headerRow = ws.getRow(2);
      headerRow.height = 26;
      for (let c = 1; c <= 11; c++) {
        const cell = headerRow.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF059669' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      }

      // Add Data Rows
      displayedList.forEach((f, idx) => {
        const finalRate = f.final_rate !== undefined ? f.final_rate : getFinalRate(f);
        let dayName = '';
        if (f.travel_date && viewMode !== 'CONSOLIDATED') {
          try {
            const d = new Date(f.travel_date + 'T00:00:00');
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            dayName = days[d.getDay()] || '';
          } catch (e) {}
        } else if (f.dates_count) {
          dayName = `${f.dates_count} Dates`;
        }

        const routeCode = `${f.origin} → ${f.destination}`;
        const cityLabel = formatRouteName(f.origin, f.destination, 'TO', routes);
        const timingStr = (f.departure_time || f.arrival_time) 
          ? `${f.departure_time || '--'} - ${f.arrival_time || '--'}`
          : '--';

        const row = ws.addRow({
          sno: idx + 1,
          sector: routeCode,
          cities: cityLabel,
          airline: getAirlineName(f.airline_code, airlines) || f.airline_code,
          flight_number: f.flight_number || '--',
          travel_date: f.date_label || f.travel_date,
          day: dayName,
          timing: timingStr,
          final_rate: finalRate,
          vendor: f.vendor_name || '--',
          refundable: f.is_refundable === 'REFUNDABLE' ? 'Refundable' : 'Non-Ref'
        });

        row.height = 22;
        const isEven = idx % 2 === 0;

        for (let c = 1; c <= 11; c++) {
          const cell = row.getCell(c);
          cell.font = { name: 'Calibri', size: 11 };
          cell.alignment = { vertical: 'middle', horizontal: c === 9 ? 'right' : (c === 1 || c === 5 || c === 7 || c === 11 ? 'center' : 'left') };
          
          if (c === 9) {
            cell.numFmt = '₹#,##0';
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } }; // Bold Green
          }

          if (isEven) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }

          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const todayStr = new Date().toISOString().slice(0, 10);
      const filename = `TravelX_Final_Selling_Rates_${todayStr}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating Excel file:', err);
      alert('Failed to generate Excel file: ' + err.message);
    }
  };

  return (
    <div className="space-y-1.5">
      {/* ------------------------------------------------------------- */}
      {/* Unified Compact Toolbar + Excel Table Container               */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Compact Action & Dropdown Filter Bar */}
        <div className="px-3 py-1.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800">
          {/* Left: Desk Title, Live Count & Multi-Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Title & Live Count */}
            <div className="flex items-center space-x-1.5 mr-1">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="text-xs sm:text-sm font-bold tracking-tight text-white whitespace-nowrap">
                Final Rates
              </span>
              <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded">
                {displayedList.length} {viewMode === 'CONSOLIDATED' ? 'Groups' : 'Rows'}
              </span>
            </div>

            {/* View Mode Toggle: Grouped Dates vs Day-by-Day */}
            <div className="flex items-center bg-slate-800 rounded-md p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('CONSOLIDATED')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'CONSOLIDATED'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Group consecutive and same-rate dates together (like Publish Desk)"
              >
                <span>📅</span>
                <span>Grouped Dates</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('DETAILED')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'DETAILED'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="View every date individually on a separate row"
              >
                <span>📋</span>
                <span>Day-by-Day</span>
              </button>
            </div>

            {/* Sector Dropdown */}
            <div className="relative">
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="pl-2 pr-6 py-1 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold rounded-md border border-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none shadow-2xs max-w-[210px] truncate"
                title="Filter by Sector / Route"
              >
                <option value="ALL">All Sectors ({fares.length})</option>
                {filterOptions.routes.map(r => (
                  <option key={r.key} value={r.key}>
                    {r.origin} ➔ {r.destination} ({getCityName(r.origin, routes)} to {getCityName(r.destination, routes)}) ({r.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            {/* Airline Dropdown */}
            <div className="relative">
              <select
                value={selectedAirline}
                onChange={(e) => setSelectedAirline(e.target.value)}
                className="pl-2 pr-6 py-1 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold rounded-md border border-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none shadow-2xs max-w-[170px] truncate"
                title="Filter by Airline"
              >
                <option value="ALL">All Airlines ({fares.length})</option>
                {filterOptions.airlines.map(a => (
                  <option key={a.code} value={a.code}>
                    {a.name} ({a.code}) ({a.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            {/* Vendor Dropdown */}
            <div className="relative">
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="pl-2 pr-6 py-1 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold rounded-md border border-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none shadow-2xs max-w-[150px] truncate"
                title="Filter by Vendor"
              >
                <option value="ALL">All Vendors ({fares.length})</option>
                {filterOptions.vendors.map(v => (
                  <option key={v.key} value={v.key}>
                    {v.name} ({v.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            {/* Travel Month Dropdown */}
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-2 pr-6 py-1 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold rounded-md border border-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none shadow-2xs max-w-[140px] truncate"
                title="Filter by Travel Month"
              >
                <option value="ALL">All Months ({fares.length})</option>
                {filterOptions.months.map(m => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            {/* Quick Sort Dropdown */}
            <div className="relative">
              <select
                value={`${sortConfig.col}-${sortConfig.direction}`}
                onChange={(e) => {
                  const [col, direction] = e.target.value.split('-');
                  setSortConfig({ col, direction });
                }}
                className="pl-2 pr-6 py-1 bg-slate-800 hover:bg-slate-750 text-amber-300 text-xs font-bold rounded-md border border-slate-700 focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer appearance-none shadow-2xs max-w-[170px] truncate"
                title="Sort Order: Click to change sort criteria"
              >
                <option value="travel_date-asc">📅 Date ➔ Lowest Rate</option>
                <option value="final_rate-asc">💰 Rate: Low to High (₹ ↑)</option>
                <option value="final_rate-desc">💰 Rate: High to Low (₹ ↓)</option>
                <option value="travel_date-desc">📅 Date: Latest First</option>
                <option value="flight_number-asc">🛫 Flight No</option>
                <option value="airline-asc">✈️ Airline (A-Z)</option>
                <option value="vendor-asc">🏢 Vendor (A-Z)</option>
              </select>
              <ChevronDown className="w-3 h-3 text-amber-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>

            {/* Quick Text Search */}
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-24 sm:w-36 pl-6 pr-5 py-1 bg-slate-800 hover:bg-slate-750 focus:bg-slate-900 text-white placeholder:text-slate-400 border border-slate-700 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white rounded-md text-xs font-bold border border-rose-800 transition cursor-pointer flex items-center space-x-1"
                title="Reset all filters"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right: Quick Action Buttons (WhatsApp, Excel, Font, Density, Refresh) */}
          <div className="flex items-center gap-1.5">
            {/* Copy WhatsApp Broadcast */}
            <button
              type="button"
              onClick={handleCopyBroadcast}
              disabled={displayedList.length === 0}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-md text-xs font-bold transition cursor-pointer disabled:opacity-50"
              title="Copy WhatsApp rate broadcast for currently filtered flights"
            >
              {broadcastCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{broadcastCopied ? 'Copied!' : 'WhatsApp'}</span>
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={displayedList.length === 0}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 active:scale-95 text-emerald-300 hover:text-white rounded-md text-xs font-bold border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Download Excel spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Excel</span>
            </button>

            {/* Font Size Adjuster */}
            <div className="flex items-center bg-slate-800 rounded-md p-0.5 border border-slate-700 text-slate-300">
              <button
                type="button"
                onClick={handleDecreaseFont}
                className="px-1.5 py-0.5 hover:text-white text-xs font-bold rounded cursor-pointer hover:bg-slate-700"
                title="Decrease font size"
              >
                A-
              </button>
              <span className="px-1 text-[10px] font-mono font-semibold text-slate-400 select-none">
                {fontSizeLevel}px
              </span>
              <button
                type="button"
                onClick={handleIncreaseFont}
                className="px-1.5 py-0.5 hover:text-white text-xs font-bold rounded cursor-pointer hover:bg-slate-700"
                title="Increase font size"
              >
                A+
              </button>
            </div>

            {/* Density Toggle */}
            <button
              type="button"
              onClick={() => setDensity(d => d === 'compact' ? 'normal' : 'compact')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold rounded-md border border-slate-700 transition cursor-pointer"
              title="Toggle Row Density"
            >
              {density === 'compact' ? 'Compact' : 'Normal'}
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadFares}
              disabled={loading}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer disabled:opacity-50"
              title="Reload rates from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Popular Sectors Micro-Strip */}
        {filterOptions.routes.length > 0 && (
          <div className="px-3 py-0.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-1 text-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">
              ⭐ Sectors:
            </span>
            {filterOptions.routes.slice(0, 8).map((r) => {
              const isSelected = selectedRoute === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setSelectedRoute(isSelected ? 'ALL' : r.key)}
                  className={`px-2 py-0.2 rounded text-[11px] font-bold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                  title={`${r.origin} to ${r.destination} (${r.count} flights)`}
                >
                  {r.origin} ➔ {r.destination} <span className={`text-[10px] ml-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>({r.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Excel Spreadsheet Table */}
        <div className="overflow-x-auto max-h-[calc(100vh-140px)] min-h-[500px] scrollbar-thin" style={{ fontSize: `${fontSizeLevel}px` }}>
          <table className="w-full text-left border-collapse">
            {/* Sticky Table Header with Excel-like Column Sort & Dropdown Filter */}
            <thead className="bg-slate-900 text-white sticky top-0 z-20 select-none shadow-md">
              <tr>
                {/* S.No */}
                <th className="py-2 px-1 font-semibold text-center border-b border-slate-700 w-9 text-slate-400">
                  #
                </th>

                {/* Sector / Route */}
                <th className={`py-2 px-2 font-semibold border-b border-slate-700 min-w-[125px] ${sortConfig.col === 'route' ? 'bg-slate-850 text-amber-300' : ''}`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSort('route')}
                      className="inline-flex items-center space-x-1 text-slate-200 hover:text-white cursor-pointer font-bold"
                      title="Click to sort by Sector"
                    >
                      <span>Sector / Route</span>
                      {renderSortIndicator('route')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveHeaderFilter(activeHeaderFilter === 'route' ? null : 'route')}
                      className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${selectedRoute !== 'ALL' ? 'text-amber-400' : 'text-slate-400'}`}
                      title="Excel AutoFilter Route"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </th>

                {/* Airline */}
                <th className={`py-2 px-2 font-semibold border-b border-slate-700 min-w-[130px] ${sortConfig.col === 'airline' ? 'bg-slate-850 text-amber-300' : ''}`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSort('airline')}
                      className="inline-flex items-center space-x-1 text-slate-200 hover:text-white cursor-pointer font-bold"
                      title="Click to sort by Airline"
                    >
                      <span>Airline</span>
                      {renderSortIndicator('airline')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveHeaderFilter(activeHeaderFilter === 'airline' ? null : 'airline')}
                      className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${selectedAirline !== 'ALL' ? 'text-amber-400' : 'text-slate-400'}`}
                      title="Excel AutoFilter Airline"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </th>

                {/* Flight No */}
                <th className={`py-2 px-1.5 font-semibold border-b border-slate-700 min-w-[80px] ${sortConfig.col === 'flight_number' ? 'bg-slate-850 text-amber-300' : ''}`}>
                  <button
                    type="button"
                    onClick={() => handleSort('flight_number')}
                    className="inline-flex items-center space-x-1 text-slate-200 hover:text-white cursor-pointer font-bold"
                    title="Click to sort by Flight Number"
                  >
                    <span>Flight No</span>
                    {renderSortIndicator('flight_number')}
                  </button>
                </th>

                {/* Travel Date / Dates Available */}
                <th className={`py-2 px-2 font-semibold border-b border-slate-700 min-w-[140px] ${sortConfig.col === 'travel_date' ? 'bg-slate-850 text-amber-300' : ''}`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSort('travel_date')}
                      className="inline-flex items-center space-x-1 text-slate-200 hover:text-white cursor-pointer font-bold"
                      title="Click to sort by Travel Date (Lowest Rate First on each date)"
                    >
                      <span>{viewMode === 'CONSOLIDATED' ? 'Dates Available' : 'Travel Date'}</span>
                      {renderSortIndicator('travel_date')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveHeaderFilter(activeHeaderFilter === 'month' ? null : 'month')}
                      className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${selectedMonth !== 'ALL' ? 'text-amber-400' : 'text-slate-400'}`}
                      title="Excel AutoFilter Month"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </th>

                {/* Timings */}
                <th className="py-2 px-2 font-semibold border-b border-slate-700 min-w-[105px] text-slate-300">
                  Timings
                </th>

                {/* FINAL SELLING RATE (₹) - PROMINENT EXCEL HIGHLIGHT */}
                <th className={`py-2 px-2.5 font-black border-b border-emerald-500 bg-emerald-950/80 text-emerald-300 text-right min-w-[110px] shadow-xs ${sortConfig.col === 'final_rate' ? 'ring-2 ring-emerald-400 bg-emerald-900' : ''}`}>
                  <button
                    type="button"
                    onClick={() => handleSort('final_rate')}
                    className="inline-flex items-center space-x-1 text-emerald-300 hover:text-white cursor-pointer font-black tracking-wide"
                    title="Click to sort by Final Selling Rate (Lowest / Highest)"
                  >
                    <span>FINAL RATE (₹)</span>
                    {renderSortIndicator('final_rate')}
                  </button>
                </th>

                {/* Vendor */}
                <th className={`py-2 px-2 font-semibold border-b border-slate-700 min-w-[120px] ${sortConfig.col === 'vendor' ? 'bg-slate-850 text-amber-300' : ''}`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSort('vendor')}
                      className="inline-flex items-center space-x-1 text-slate-200 hover:text-white cursor-pointer font-bold"
                      title="Click to sort by Vendor"
                    >
                      <span>Vendor</span>
                      {renderSortIndicator('vendor')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveHeaderFilter(activeHeaderFilter === 'vendor' ? null : 'vendor')}
                      className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${selectedVendor !== 'ALL' ? 'text-amber-400' : 'text-slate-400'}`}
                      title="Excel AutoFilter Vendor"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </th>

                {/* Fare Policy */}
                <th className="py-2 px-2 font-semibold border-b border-slate-700 text-center min-w-[105px] text-slate-300">
                  Fare Policy
                </th>

                {/* Action: Copy */}
                <th className="py-2 px-2 font-semibold border-b border-slate-700 text-center min-w-[85px] text-slate-300 sticky right-0 bg-slate-900 shadow-[-4px_0_6px_rgba(0,0,0,0.15)] z-20">
                  Copy
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="font-semibold">Loading Final Rates...</p>
                  </td>
                </tr>
              ) : displayedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-500">
                    <div className="max-w-md mx-auto">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="text-base font-bold text-slate-700">No flights found matching current filters</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try clicking "All" in the top tabs or click Reset Filters below.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedList.map((f, idx) => {
                  const finalRate = f.final_rate !== undefined ? f.final_rate : getFinalRate(f);
                  const netRate = Number(f.net_fare) || 0;
                  const margin = Number(f.margin_amount) || 0;
                  const routeLabel = formatRouteName(f.origin, f.destination, 'ARROW', routes);
                  const airlineName = getAirlineName(f.airline_code, airlines) || f.airline_code;
                  const dateStr = formatDateWithDay(f.travel_date);
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={f.id || `${f.vendor_id}-${f.airline_code}-${f.origin}-${f.destination}-${f.travel_date}-${idx}`}
                      className={`group hover:bg-amber-50/60 transition-colors border-b border-slate-100 ${
                        isEven ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* S.No */}
                      <td className={`px-1.5 text-center text-slate-400 font-mono text-xs ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        {idx + 1}
                      </td>

                      {/* Route / Sector */}
                      <td className={`px-2 ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        <div className="flex items-center space-x-1">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-xs">
                            {f.origin} ➔ {f.destination}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[130px]" title={routeLabel}>
                          {getCityName(f.origin, routes)} to {getCityName(f.destination, routes)}
                        </div>
                      </td>

                      {/* Airline */}
                      <td className={`px-2 ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        <div className="flex items-center space-x-1.5">
                          <span className="px-1.5 py-0.2 rounded font-mono font-black text-[10px] bg-slate-800 text-white">
                            {f.airline_code}
                          </span>
                          <span className="font-bold text-slate-800 truncate max-w-[110px] text-xs" title={airlineName}>
                            {airlineName}
                          </span>
                        </div>
                      </td>

                      {/* Flight No */}
                      <td className={`px-1.5 font-mono font-semibold text-slate-700 text-xs ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        {f.flight_number || <span className="text-slate-300 font-normal">--</span>}
                      </td>

                      {/* Travel Date / Dates Available */}
                      <td className={`px-2 ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        {viewMode === 'CONSOLIDATED' ? (
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-slate-900 whitespace-nowrap text-xs">
                              {f.date_label || formatDateWithDay(f.travel_date)}
                            </span>
                            {f.dates_count > 1 && (
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-1 py-0.2 rounded shadow-2xs whitespace-nowrap">
                                {f.dates_count} Dates
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="font-semibold text-slate-900 whitespace-nowrap text-xs">
                            {dateStr}
                          </div>
                        )}
                      </td>

                      {/* Timings (DEP ➔ ARR) */}
                      <td className={`px-2 text-xs font-mono tabular-nums whitespace-nowrap ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        {(() => {
                          const timingInfo = getFlightTiming(f.flight_number, f.origin, f.destination);
                          const dep = f.departure_time || timingInfo?.dep;
                          const arr = f.arrival_time || timingInfo?.arr;
                          if (dep || arr) {
                            return (
                              <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                                <span className="font-bold text-slate-900">{dep || '--'}</span>
                                <span className="text-slate-400 font-normal text-[10px]">➔</span>
                                <span className="font-bold text-slate-900">{arr || '--'}</span>
                              </div>
                            );
                          }
                          return <span className="text-slate-300 font-normal">--</span>;
                        })()}
                      </td>

                      {/* FINAL RATE (₹) - PROMINENT LARGE EMERALD SELLING PRICE */}
                      <td className={`px-2.5 text-right border-l border-r border-emerald-200/60 bg-emerald-50/40 tabular-nums ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        <div className="inline-flex items-center gap-1 font-mono font-black text-emerald-700 text-sm sm:text-base">
                          <span>₹{finalRate.toLocaleString('en-IN')}</span>
                        </div>
                        {margin > 0 && (
                          <div className="text-[9px] font-mono text-slate-400">
                            (Net ₹{netRate.toLocaleString('en-IN')} + ₹{margin})
                          </div>
                        )}
                      </td>

                      {/* Vendor (Grouped when multiple vendors share rate) */}
                      <td className={`px-2 ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        <div 
                          className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded border text-xs font-semibold ${
                            (f.vendor_list && f.vendor_list.length > 1) || (f.vendor_name && f.vendor_name.includes(','))
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          title={f.vendor_name || 'Vendor'}
                        >
                          <Building2 className={`w-3 h-3 shrink-0 ${
                            (f.vendor_list && f.vendor_list.length > 1) || (f.vendor_name && f.vendor_name.includes(','))
                              ? 'text-purple-600'
                              : 'text-slate-400'
                          }`} />
                          <span className="truncate max-w-[140px]">{f.vendor_name || 'Vendor'}</span>
                        </div>
                      </td>

                      {/* Fare Policy (Refundable / Non-Refundable Non-Changeable) */}
                      <td className={`px-2 text-center ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        {f.is_refundable === 'REFUNDABLE' ? (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
                            Refundable
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap" title="Non-Refundable & Non-Changeable Flight">
                            <span className="text-rose-600 font-bold">❌</span> Non-Ref & Non-Chg
                          </span>
                        )}
                      </td>

                      {/* Action: Copy WhatsApp Quote - Sticky Right */}
                      <td className={`px-2 text-center sticky right-0 z-10 transition-colors shadow-[-4px_0_6px_rgba(0,0,0,0.05)] ${isEven ? 'bg-white' : 'bg-slate-50'} group-hover:bg-amber-50 ${density === 'compact' ? 'py-1' : 'py-2'}`}>
                        <button
                          type="button"
                          onClick={() => handleCopySingleQuote(f)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer active:scale-95 shadow-2xs ${
                            copiedId === f.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                          title="Copy WhatsApp Quote"
                        >
                          {copiedId === f.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Excel Status Bar at Bottom of Spreadsheet */}
        <div className="bg-slate-900 text-slate-300 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono border-t border-slate-800">
          <div className="flex items-center space-x-4">
            <span>READY</span>
            <span className="text-slate-600">|</span>
            <span>ROWS: <strong className="text-white">{displayedList.length}</strong> {viewMode === 'CONSOLIDATED' ? 'Groups' : 'Rows'} ({filteredFares.length} flights)</span>
            <span className="text-slate-600">|</span>
            <span>FILTER: <strong className="text-emerald-400">{hasActiveFilters ? 'ACTIVE' : 'ALL'}</strong></span>
          </div>

          <div className="flex items-center space-x-4 text-slate-400">
            {summaryStats.total > 0 && (
              <>
                <span>MIN: <strong className="text-white">₹{summaryStats.minFare.toLocaleString('en-IN')}</strong></span>
                <span className="text-slate-600">|</span>
                <span>AVERAGE: <strong className="text-white">₹{summaryStats.avgFare.toLocaleString('en-IN')}</strong></span>
                <span className="text-slate-600">|</span>
                <span>MAX: <strong className="text-white">₹{summaryStats.maxFare.toLocaleString('en-IN')}</strong></span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Column Header Dropdown Menu Popover (Excel AutoFilter Style) */}
      {/* ------------------------------------------------------------- */}
      {activeHeaderFilter && (
        <div
          ref={headerFilterRef}
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/20 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveHeaderFilter(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-80 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Popover Header */}
            <div className="bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-emerald-400" />
                Filter by {activeHeaderFilter.toUpperCase()}
              </span>
              <button
                onClick={() => setActiveHeaderFilter(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick List with Counts */}
            <div className="max-h-72 overflow-y-auto p-2 divide-y divide-slate-100 text-xs">
              {/* Reset to ALL option */}
              <button
                type="button"
                onClick={() => {
                  if (activeHeaderFilter === 'airline') setSelectedAirline('ALL');
                  if (activeHeaderFilter === 'route') setSelectedRoute('ALL');
                  if (activeHeaderFilter === 'vendor') setSelectedVendor('ALL');
                  if (activeHeaderFilter === 'month') setSelectedMonth('ALL');
                  if (activeHeaderFilter === 'baggage') setSelectedBaggage('ALL');
                  setActiveHeaderFilter(null);
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 font-bold text-slate-800 flex items-center justify-between transition cursor-pointer"
              >
                <span>(Show All)</span>
                <span className="text-slate-400 font-mono text-[11px]">{fares.length}</span>
              </button>

              {/* Items */}
              {activeHeaderFilter === 'airline' &&
                filterOptions.airlines.map((a) => (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => {
                      setSelectedAirline(a.code);
                      setActiveHeaderFilter(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 flex items-center justify-between transition cursor-pointer ${
                      selectedAirline === a.code ? 'bg-blue-100 font-bold text-blue-900' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{a.name} ({a.code})</span>
                    <span className="text-slate-400 font-mono text-[11px] ml-2">{a.count}</span>
                  </button>
                ))}

              {activeHeaderFilter === 'route' &&
                filterOptions.routes.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      setSelectedRoute(r.key);
                      setActiveHeaderFilter(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 flex items-center justify-between transition cursor-pointer ${
                      selectedRoute === r.key ? 'bg-blue-100 font-bold text-blue-900' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate font-mono">{r.origin} ➔ {r.destination}</span>
                    <span className="text-slate-400 font-mono text-[11px] ml-2">{r.count}</span>
                  </button>
                ))}

              {activeHeaderFilter === 'vendor' &&
                filterOptions.vendors.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => {
                      setSelectedVendor(v.key);
                      setActiveHeaderFilter(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 flex items-center justify-between transition cursor-pointer ${
                      selectedVendor === v.key ? 'bg-blue-100 font-bold text-blue-900' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{v.name}</span>
                    <span className="text-slate-400 font-mono text-[11px] ml-2">{v.count}</span>
                  </button>
                ))}

              {activeHeaderFilter === 'month' &&
                filterOptions.months.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setSelectedMonth(m.key);
                      setActiveHeaderFilter(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 flex items-center justify-between transition cursor-pointer ${
                      selectedMonth === m.key ? 'bg-blue-100 font-bold text-blue-900' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{m.label}</span>
                    <span className="text-slate-400 font-mono text-[11px] ml-2">{m.count}</span>
                  </button>
                ))}

            </div>
          </div>
        </div>
      )}
      {/* ------------------------------------------------------------- */}
      {/* WhatsApp Share & Copy Modal Dialog                             */}
      {/* ------------------------------------------------------------- */}
      {shareModalFare && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShareModalFare(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-emerald-700 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Share Flight Quote</h3>
                  <p className="text-[11px] text-emerald-100">Copy text or send directly to WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareModalFare(null)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3.5">
              {/* Template Style Selector Tabs */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleSwitchQuoteStyle('PROFESSIONAL')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer text-center ${
                    quoteStyle === 'PROFESSIONAL'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  🌟 Standard Card
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchQuoteStyle('COMPACT')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer text-center ${
                    quoteStyle === 'COMPACT'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  ⚡ Quick Compact
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchQuoteStyle('DETAILED')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer text-center ${
                    quoteStyle === 'DETAILED'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  📋 Detailed Terms
                </button>
              </div>

              {/* Formatted Textarea Preview & Live Editor */}
              <div>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <span>Message Preview</span>
                    <span className="text-[10px] font-normal text-slate-400">(Editable before sending)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomQuoteText(generateQuoteText(shareModalFare, quoteStyle))}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                  >
                    Reset Text
                  </button>
                </div>
                <textarea
                  rows={12}
                  value={customQuoteText}
                  onChange={(e) => setCustomQuoteText(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-900 text-emerald-300 p-3.5 rounded-xl border border-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none select-all resize-none shadow-inner leading-relaxed"
                />
              </div>

              {/* Action Buttons: Copy Text vs Open in WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Copy to Clipboard */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(customQuoteText);
                    setModalCopied(true);
                    setTimeout(() => setModalCopied(false), 2500);
                  }}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer shadow-xs active:scale-95 ${
                    modalCopied
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                  }`}
                >
                  {modalCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-600" />
                      <span>Copy Text for WhatsApp</span>
                    </>
                  )}
                </button>

                {/* Direct Open in WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(customQuoteText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition shadow-md cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
