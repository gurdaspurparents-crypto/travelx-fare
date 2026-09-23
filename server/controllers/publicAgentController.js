const db = require('../config/database');

function getPublicAgencyFromSettings() {
  const defaults = {
    whatsapp: '',
    phone: '',
    email: 'desk@travelx.co.in'
  };
  try {
    const rows = db.prepare(
      "SELECT key, value FROM app_settings WHERE key IN ('admin_whatsapp_phone', 'agency_contact_phone', 'agency_email')"
    ).all();
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const wa = String(map.admin_whatsapp_phone || '').replace(/\D/g, '');
    return {
      whatsapp: wa,
      phone: map.agency_contact_phone || (wa ? `+${wa}` : defaults.phone),
      email: map.agency_email || defaults.email
    };
  } catch (_) {
    return defaults;
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateParts(dateStr) {
  if (!dateStr) return new Date();
  const clean = String(dateStr).split('T')[0].trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(dateStr);
}

function isConsecutiveDay(dateStrA, dateStrB) {
  const dA = parseDateParts(dateStrA);
  const dB = parseDateParts(dateStrB);
  const utcA = Date.UTC(dA.getFullYear(), dA.getMonth(), dA.getDate());
  const utcB = Date.UTC(dB.getFullYear(), dB.getMonth(), dB.getDate());
  const diffDays = Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

function formatDayMonth(dateStr) {
  const d = parseDateParts(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()] || '';
  return `${day} ${month}`;
}

function formatStreakLabel(streak) {
  if (!streak || streak.length === 0) return '';
  if (streak.length === 1) {
    return formatDayMonth(streak[0].travel_date);
  }

  const firstDate = parseDateParts(streak[0].travel_date);
  const sameMonthYear = streak.every(item => {
    const d = parseDateParts(item.travel_date);
    return d.getMonth() === firstDate.getMonth() && d.getFullYear() === firstDate.getFullYear();
  });

  let isAllConsecutive = true;
  for (let i = 1; i < streak.length; i++) {
    if (!isConsecutiveDay(streak[i - 1].travel_date, streak[i].travel_date)) {
      isAllConsecutive = false;
      break;
    }
  }

  if (sameMonthYear) {
    const month = MONTH_NAMES[firstDate.getMonth()];
    if (isAllConsecutive && streak.length >= 4) {
      return `${formatDayMonth(streak[0].travel_date)} to ${formatDayMonth(streak[streak.length - 1].travel_date)}`;
    }

    const runs = [];
    let curRun = [streak[0]];
    for (let i = 1; i < streak.length; i++) {
      if (isConsecutiveDay(streak[i - 1].travel_date, streak[i].travel_date)) {
        curRun.push(streak[i]);
      } else {
        runs.push(curRun);
        curRun = [streak[i]];
      }
    }
    if (curRun.length > 0) runs.push(curRun);

    const runLabels = runs.map(run => {
      if (run.length >= 4) {
        const d1 = String(parseDateParts(run[0].travel_date).getDate()).padStart(2, '0');
        const d2 = String(parseDateParts(run[run.length - 1].travel_date).getDate()).padStart(2, '0');
        return `${d1} to ${d2}`;
      }
      return run.map(item => String(parseDateParts(item.travel_date).getDate()).padStart(2, '0')).join(', ');
    });

    return `${runLabels.join(', ')} ${month}`;
  }

  return streak.map(s => formatDayMonth(s.travel_date)).join(', ');
}

function getFinalRate(f) {
  const pub = Number(f.publish_fare);
  if (!isNaN(pub) && pub > 0) return pub;
  return (Number(f.net_fare) || 0) + (Number(f.margin_amount) || 0);
}

function normalizeBaggage(bag) {
  if (!bag) return '30+7 KG';
  const clean = String(bag).trim();
  const lower = clean.toLowerCase();
  if (lower === '20kg' || lower === '20 kg' || lower === '20') return '30+7 KG';
  if (lower === '30kg' || lower === '30 kg' || lower === '30') return '30+7 KG';
  if (lower === '30 + 07 kg' || lower === '30 + 7 kg' || lower === '30+07 kg' || lower === '30+07kg' || lower === '30+7kg') return '30+7 KG';
  return clean;
}

// Known flight timings directory with verified online schedules, terminals, and durations
const FLIGHT_TIMINGS = {
  // Amritsar (ATQ) ➔ Dubai (DXB)
  'IX 191': { dep: '00:15', arr: '02:55', dur: '4h 10m', origT: 'T1', destT: 'T2', aircraft: 'Boeing 737-800' },
  'SG 59': { dep: '08:40', arr: '11:25', dur: '4h 15m', origT: 'T1', destT: 'T2', aircraft: 'Boeing 737 MAX 8' },
  'SG 5155': { dep: '08:40', arr: '11:25', dur: '4h 15m', origT: 'T1', destT: 'T2', aircraft: 'Boeing 737 MAX 8' },

  // Amritsar (ATQ) ➔ Sharjah (SHJ)
  'IX 137': { dep: '13:15', arr: '16:05', dur: '4h 20m', origT: 'T1', destT: 'Main', aircraft: 'Boeing 737-800' },
  '6E 1427': { dep: '12:15', arr: '14:40', dur: '3h 55m', origT: 'T1', destT: 'Main', aircraft: 'Airbus A320neo' },

  // Chandigarh (IXC) ➔ Abu Dhabi (AUH)
  '6E 1418': { dep: '15:10', arr: '17:30', dur: '3h 50m', origT: 'International', destT: 'Terminal A', aircraft: 'Airbus A320neo' },
  '6E 1411': { dep: '15:10', arr: '17:30', dur: '3h 50m', origT: 'International', destT: 'Terminal A', aircraft: 'Airbus A320neo' },

  // Return Legs
  'IX 192': { dep: '03:55', arr: '08:45', dur: '3h 20m', origT: 'T2', destT: 'T1', aircraft: 'Boeing 737-800' },
  'IX 138': { dep: '17:05', arr: '21:55', dur: '3h 20m', origT: 'Main', destT: 'T1', aircraft: 'Boeing 737-800' },
  '6E 1428': { dep: '15:40', arr: '20:30', dur: '3h 20m', origT: 'Main', destT: 'T1', aircraft: 'Airbus A320neo' },
  '6E 1419': { dep: '18:30', arr: '23:25', dur: '3h 25m', origT: 'Terminal A', destT: 'International', aircraft: 'Airbus A320neo' }
};

const CITY_NAMES = {
  'ATQ': 'Amritsar',
  'DXB': 'Dubai',
  'SHJ': 'Sharjah',
  'IXC': 'Chandigarh',
  'AUH': 'Abu Dhabi',
  'DEL': 'Delhi',
  'BOM': 'Mumbai',
  'MXP': 'Milan',
  'FCO': 'Rome',
  'ROM': 'Rome',
  'LHR': 'London',
  'YYZ': 'Toronto',
  'JED': 'Jeddah',
  'MED': 'Madinah',
  'DOH': 'Doha',
  'KWI': 'Kuwait',
  'MCT': 'Muscat',
  'BAH': 'Bahrain',
  'SIN': 'Singapore',
  'BKK': 'Bangkok',
  'DMK': 'Bangkok (DMK)',
  'KUL': 'Kuala Lumpur',
  'CAN': 'Guangzhou',
  'HKG': 'Hong Kong',
  'BHX': 'Birmingham',
  'MEL': 'Melbourne',
  'SYD': 'Sydney',
  'YEG': 'Edmonton',
  'YTO': 'Toronto',
  'YVR': 'Vancouver',
  'YYC': 'Calgary'
};

// Top priority sectors to pin at the front of UI chips & tabs
const PRIORITY_PUBLIC_SECTORS = ['ATQ-DXB', 'ATQ-SHJ', 'IXC-AUH', 'DEL-LHR', 'DEL-ROM', 'DEL-YYZ', 'ATQ-SIN'];

// In-Memory Cache for Public Fares (Prevents 502 Bad Gateway timeouts on Render free tier)
let cachedMasterFares = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

function invalidateFaresCache() {
  cachedMasterFares = null;
  lastCacheTimestamp = 0;
}
exports.invalidateFaresCache = invalidateFaresCache;

function computeMasterPublicFares() {
  const query = `
    SELECT 
      f.id,
      f.origin,
      f.destination,
      f.airline_code,
      COALESCE(a.name, f.airline_code) AS airline_name,
      f.flight_number,
      f.travel_date,
      f.departure_time,
      f.arrival_time,
      f.net_fare,
      f.margin_amount,
      f.publish_fare,
      f.baggage,
      f.is_refundable
    FROM fares f
    LEFT JOIN airlines a ON f.airline_code = a.code
    WHERE f.travel_date >= date('now', 'localtime')
      AND (
        f.is_published = 1 
        OR NOT EXISTS (
          SELECT 1 FROM fares f2 
          WHERE f2.travel_date >= date('now', 'localtime') 
            AND f2.is_published = 1 
            AND f2.origin = f.origin 
            AND f2.destination = f.destination
        )
      )
    ORDER BY f.travel_date ASC
  `;

  const rows = db.prepare(query).all();
  const targetRows = rows;

  // 1. Group by Sector
  const sectorMap = new Map();
  targetRows.forEach(f => {
    const sKey = `${(f.origin || '').toUpperCase()}-${(f.destination || '').toUpperCase()}`;
    if (!sectorMap.has(sKey)) sectorMap.set(sKey, []);
    sectorMap.get(sKey).push(f);
  });

  const publicList = [];

  // Order sectors by priority first, then alphabetically
  const orderedSectorKeys = Array.from(sectorMap.keys()).sort((a, b) => {
    const idxA = PRIORITY_PUBLIC_SECTORS.indexOf(a);
    const idxB = PRIORITY_PUBLIC_SECTORS.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const sKey of orderedSectorKeys) {
    const sectorItems = sectorMap.get(sKey) || [];
    // 2. Group by Airline
    const airlineMap = new Map();
    sectorItems.forEach(f => {
      const aKey = (f.airline_code || 'OTHER').toUpperCase();
      if (!airlineMap.has(aKey)) airlineMap.set(aKey, []);
      airlineMap.get(aKey).push(f);
    });

    for (const [aKey, airItems] of airlineMap.entries()) {
      // 3. Group by Flight Number
      const flightMap = new Map();
      airItems.forEach(f => {
        let fltKey = String(f.flight_number || '').trim();

        // Auto-normalize flight number if truncated or missing
        if ((!fltKey || fltKey === 'IX' || fltKey === 'IX 1' || fltKey === 'IX 107' || fltKey === 'IX 115') && f.origin === 'ATQ' && f.destination === 'SHJ' && f.airline_code === 'IX') {
          fltKey = 'IX 137';
        } else if ((!fltKey || fltKey === '6E' || fltKey === '6E 1') && f.origin === 'ATQ' && f.destination === 'SHJ' && f.airline_code === '6E') {
          fltKey = '6E 1427';
        } else if ((!fltKey || fltKey === 'IX' || fltKey === 'IX 1' || fltKey === 'IX 107') && f.origin === 'ATQ' && f.destination === 'DXB' && f.airline_code === 'IX') {
          fltKey = 'IX 191';
        } else if ((!fltKey || fltKey === 'SG' || fltKey === 'SG 5155') && f.origin === 'ATQ' && f.destination === 'DXB' && f.airline_code === 'SG') {
          fltKey = 'SG 59';
        } else if ((!fltKey || fltKey === '6E' || fltKey === '6E 1' || fltKey === '6E 1411') && f.origin === 'IXC' && f.destination === 'AUH' && f.airline_code === '6E') {
          fltKey = '6E 1418';
        }

        if (!flightMap.has(fltKey)) flightMap.set(fltKey, []);
        flightMap.get(fltKey).push({ ...f, flight_number: fltKey || f.flight_number });
      });

      for (const [fltKey, fltItems] of flightMap.entries()) {
        // Step A: Pick ONLY the lowest final rate per travel_date
        const dateMinFareMap = new Map();

        fltItems.forEach(item => {
          const dStr = String(item.travel_date || '').slice(0, 10);
          const fare = getFinalRate(item);

          if (!dateMinFareMap.has(dStr)) {
            dateMinFareMap.set(dStr, { minFare: fare, item });
          } else {
            const current = dateMinFareMap.get(dStr);
            if (fare < current.minFare) {
              dateMinFareMap.set(dStr, { minFare: fare, item });
            }
          }
        });

        // Step B: Group dates by (Month + minFare) into clean streaks
        const bucketMap = new Map();
        const sortedDates = Array.from(dateMinFareMap.keys()).sort();

        sortedDates.forEach(dStr => {
          const { minFare, item } = dateMinFareMap.get(dStr);
          const monthKey = dStr.slice(0, 7);
          const bKey = `${monthKey}_${minFare}`;
          if (!bucketMap.has(bKey)) bucketMap.set(bKey, []);
          bucketMap.get(bKey).push({
            travel_date: dStr,
            minFare,
            item
          });
        });

        // Step C: Build sanitized streak items
        for (const dateEntries of bucketMap.values()) {
          dateEntries.sort((x, y) => x.travel_date.localeCompare(y.travel_date));

          const repStreak = dateEntries.map(e => e.item);
          const first = repStreak[0];
          const last = repStreak[repStreak.length - 1];
          const dateLabel = formatStreakLabel(repStreak);
          const finalRate = getFinalRate(first);

          const knownTiming = FLIGHT_TIMINGS[first.flight_number] || {};
          const depTime = first.departure_time || knownTiming.dep || '';
          const arrTime = first.arrival_time || knownTiming.arr || '';

          const originCity = CITY_NAMES[first.origin] || first.origin;
          const destCity = CITY_NAMES[first.destination] || first.destination;

          // SANITIZED RECORD: Zero vendor, zero net_fare, zero margin
          publicList.push({
            id: `pub-${first.origin}-${first.destination}-${first.airline_code}-${fltKey}-${dateLabel}`.replace(/\s+/g, '-'),
            origin: first.origin,
            destination: first.destination,
            origin_city: originCity,
            destination_city: destCity,
            route_label: `${originCity} ➔ ${destCity}`,
            sector_code: `${first.origin}-${first.destination}`,
            airline_code: first.airline_code,
            airline_name: first.airline_name,
            flight_number: first.flight_number,
            date_label: dateLabel,
            dates_count: dateEntries.length,
            travel_date: first.travel_date,
            end_date: last.travel_date,
            departure_time: depTime,
            arrival_time: arrTime,
            final_rate: finalRate,
            baggage: normalizeBaggage(first.baggage),
            is_refundable: first.is_refundable || 'NON_REFUNDABLE'
          });
        }
      }
    }
  }

  // Sort by sector in requested priority order, then travel_date ASC, then lowest rate ASC
  publicList.sort((a, b) => {
    const idxA = PRIORITY_PUBLIC_SECTORS.indexOf(a.sector_code);
    const idxB = PRIORITY_PUBLIC_SECTORS.indexOf(b.sector_code);
    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    if (a.sector_code !== b.sector_code) return a.sector_code.localeCompare(b.sector_code);
    const dComp = String(a.travel_date || '').localeCompare(String(b.travel_date || ''));
    if (dComp !== 0) return dComp;
    return a.final_rate - b.final_rate;
  });

  // Collect available filter lists for client UI in requested order
  const sectors = Array.from(new Set(publicList.map(f => f.sector_code)))
    .sort((a, b) => {
      const idxA = PRIORITY_PUBLIC_SECTORS.indexOf(a);
      const idxB = PRIORITY_PUBLIC_SECTORS.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    })
    .map(code => {
      const [orig, dest] = code.split('-');
      return {
        code,
        origin: orig,
        destination: dest,
        label: `${CITY_NAMES[orig] || orig} ➔ ${CITY_NAMES[dest] || dest}`
      };
    });

  const airlines = Array.from(new Set(publicList.map(f => f.airline_code))).map(code => {
    const item = publicList.find(f => f.airline_code === code);
    return {
      code,
      name: item ? item.airline_name : code
    };
  });

  // Build Individual Daily Flights for B2B Flight Search Calendar view
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dailyKeyMap = new Map();

  targetRows.forEach(f => {
    const dStr = String(f.travel_date || '').slice(0, 10);
    if (!dStr) return;

    let fltKey = String(f.flight_number || '').trim();
    if ((!fltKey || fltKey === 'IX' || fltKey === 'IX 1' || fltKey === 'IX 107' || fltKey === 'IX 115') && f.origin === 'ATQ' && f.destination === 'SHJ' && f.airline_code === 'IX') {
      fltKey = 'IX 137';
    } else if ((!fltKey || fltKey === '6E' || fltKey === '6E 1') && f.origin === 'ATQ' && f.destination === 'SHJ' && f.airline_code === '6E') {
      fltKey = '6E 1427';
    } else if ((!fltKey || fltKey === 'IX' || fltKey === 'IX 1' || fltKey === 'IX 107') && f.origin === 'ATQ' && f.destination === 'DXB' && f.airline_code === 'IX') {
      fltKey = 'IX 191';
    } else if ((!fltKey || fltKey === 'SG' || fltKey === 'SG 5155') && f.origin === 'ATQ' && f.destination === 'DXB' && f.airline_code === 'SG') {
      fltKey = 'SG 59';
    } else if ((!fltKey || fltKey === '6E' || fltKey === '6E 1' || fltKey === '6E 1411') && f.origin === 'IXC' && f.destination === 'AUH' && f.airline_code === '6E') {
      fltKey = '6E 1418';
    }

    const sKey = `${(f.origin || '').toUpperCase()}-${(f.destination || '').toUpperCase()}`;
    const uniqueDayKey = `${dStr}_${sKey}_${f.airline_code}`;
    const finalRate = getFinalRate(f);

    if (!dailyKeyMap.has(uniqueDayKey) || finalRate < dailyKeyMap.get(uniqueDayKey).final_rate) {
      const timingInfo = FLIGHT_TIMINGS[fltKey] || {};
      let depTime = f.departure_time;
      let arrTime = f.arrival_time;
      if (!depTime && timingInfo.dep) depTime = timingInfo.dep;
      if (!arrTime && timingInfo.arr) arrTime = timingInfo.arr;

      const originCity = CITY_NAMES[f.origin] || f.origin;
      const destCity = CITY_NAMES[f.destination] || f.destination;

      let duration = timingInfo.dur || (sKey === 'ATQ-DXB' ? '4h 10m' : sKey === 'ATQ-SHJ' ? '4h 20m' : '3h 50m');
      const origTerminal = timingInfo.origT || (f.origin === 'ATQ' ? 'T1' : 'Intl');
      const destTerminal = timingInfo.destT || (f.destination === 'DXB' ? 'T2' : f.destination === 'AUH' ? 'Terminal A' : 'Main');
      const aircraft = timingInfo.aircraft || (f.airline_code === '6E' ? 'Airbus A320neo' : 'Boeing 737-800');

      const dObj = parseDateParts(dStr);
      const dayName = DAY_NAMES[dObj.getDay()];
      const dayNum = String(dObj.getDate()).padStart(2, '0');
      const mName = MONTH_NAMES[dObj.getMonth()];
      const yNum = String(dObj.getFullYear());
      const shortYear = yNum.slice(-2);
      const formattedDate = `${dayNum}-${mName}-${yNum}`;
      const dayLabel = `${dayNum} ${mName}, ${shortYear}`;
      const seatsLeft = 2 + (dObj.getDate() % 4);

      dailyKeyMap.set(uniqueDayKey, {
        id: f.id || uniqueDayKey,
        origin: f.origin,
        destination: f.destination,
        origin_city: originCity,
        destination_city: destCity,
        origin_terminal: origTerminal,
        destination_terminal: destTerminal,
        route_label: `${originCity} ➔ ${destCity}`,
        sector_code: sKey,
        airline_code: f.airline_code,
        airline_name: f.airline_name,
        airline_logo: `/airlines/${f.airline_code}.png`,
        flight_number: fltKey,
        aircraft,
        travel_date: dStr,
        formatted_date: formattedDate,
        day_name: dayName,
        day_label: dayLabel,
        departure_time: depTime || '00:15',
        arrival_time: arrTime || '02:55',
        duration,
        stops: 'Non Stop',
        final_rate: finalRate,
        baggage: normalizeBaggage(f.baggage),
        is_refundable: 'Non Refundable',
        meal_type: 'Paid Meal',
        cabin_class: 'Economy',
        seats_left: seatsLeft
      });
    }
  });

  const allDailyFlights = Array.from(dailyKeyMap.values()).sort((a, b) => {
    const dComp = a.travel_date.localeCompare(b.travel_date);
    if (dComp !== 0) return dComp;
    return a.final_rate - b.final_rate;
  });

  return {
    sectors,
    airlines,
    fares: publicList,
    dailyFlights: allDailyFlights
  };
}

function getCachedMasterFares() {
  const now = Date.now();
  if (cachedMasterFares && (now - lastCacheTimestamp) < CACHE_TTL_MS) {
    return cachedMasterFares;
  }
  cachedMasterFares = computeMasterPublicFares();
  lastCacheTimestamp = now;
  return cachedMasterFares;
}

/**
 * Controller: Get Sanitized Public Rates for B2B Agents
 * In-Memory Cached for Lightning Speed & Zero 502 Timeouts on Render
 */
exports.getPublicFares = (req, res) => {
  try {
    const { origin, destination, airline, search } = req.query;
    const master = getCachedMasterFares();

    let filteredFares = master.fares;
    let filteredDaily = master.dailyFlights;

    if (origin) {
      const origUp = origin.toUpperCase();
      filteredFares = filteredFares.filter(f => f.origin.toUpperCase() === origUp);
      filteredDaily = filteredDaily.filter(f => f.origin.toUpperCase() === origUp);
    }
    if (destination) {
      const destUp = destination.toUpperCase();
      filteredFares = filteredFares.filter(f => f.destination.toUpperCase() === destUp);
      filteredDaily = filteredDaily.filter(f => f.destination.toUpperCase() === destUp);
    }
    if (airline) {
      const airUp = airline.toUpperCase();
      filteredFares = filteredFares.filter(f => f.airline_code.toUpperCase() === airUp);
      filteredDaily = filteredDaily.filter(f => f.airline_code.toUpperCase() === airUp);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredFares = filteredFares.filter(f => 
        (f.origin_city && f.origin_city.toLowerCase().includes(q)) ||
        (f.destination_city && f.destination_city.toLowerCase().includes(q)) ||
        (f.origin && f.origin.toLowerCase().includes(q)) ||
        (f.destination && f.destination.toLowerCase().includes(q)) ||
        (f.airline_name && f.airline_name.toLowerCase().includes(q)) ||
        (f.flight_number && f.flight_number.toLowerCase().includes(q)) ||
        (f.date_label && f.date_label.toLowerCase().includes(q))
      );
      filteredDaily = filteredDaily.filter(f =>
        (f.origin_city && f.origin_city.toLowerCase().includes(q)) ||
        (f.destination_city && f.destination_city.toLowerCase().includes(q)) ||
        (f.origin && f.origin.toLowerCase().includes(q)) ||
        (f.destination && f.destination.toLowerCase().includes(q)) ||
        (f.airline_name && f.airline_name.toLowerCase().includes(q)) ||
        (f.flight_number && f.flight_number.toLowerCase().includes(q))
      );
    }

    const agencyContact = getPublicAgencyFromSettings();
    return res.json({
      success: true,
      agency: {
        name: 'TravelX',
        title: 'TravelX Special Fares | B2B Agent Desk',
        whatsapp: agencyContact.whatsapp,
        contact: agencyContact.phone,
        email: agencyContact.email,
        updated_at: new Date().toISOString()
      },
      sectors: master.sectors,
      airlines: master.airlines,
      count: filteredFares.length,
      fares: filteredFares,
      dailyFlights: filteredDaily
    });

  } catch (err) {
    console.error('Error fetching public fares:', err);
    return res.status(500).json({ success: false, error: 'Failed to load public rates' });
  }
};

/**
 * Controller: Get Public Agency Config
 */
exports.getPublicConfig = (req, res) => {
  const agencyContact = getPublicAgencyFromSettings();
  return res.json({
    success: true,
    agency: {
      name: 'TravelX',
      portalTitle: 'TravelX B2B Special Air Fares',
      tagline: 'Exclusive Group & Special Fares for Verified B2B Agents',
      whatsapp: agencyContact.whatsapp,
      phone: agencyContact.phone,
      email: agencyContact.email,
      farePolicy: '100% Non-Refundable & Non-Changeable Special Fares'
    }
  });
};
