/**
 * Date Range & Streak Grouping Utility for Travel Agency Special Fares (Server-Side)
 * Groups consecutive dates having identical publish fares into clean ranges:
 * - 1 Date:  "16 SEP"
 * - 2 Dates: "21 SEP & 22 SEP"
 * - 3+ Dates: "23 SEP TO 02 OCT (ALL DATES)"
 */

const { formatRouteName } = require('./airportHelper');

const AIRLINE_NAMES = {
  // India Domestic & Regional
  AI: 'Air India',
  '6E': 'IndiGo',
  IX: 'Air India Express',
  SG: 'SpiceJet',
  UK: 'Vistara',
  QP: 'Akasa Air',
  G8: 'Go First',
  I5: 'AIX Connect',
  '9I': 'Alliance Air',
  S5: 'Star Air',
  IC: 'Fly91',

  // Middle East & Gulf
  EK: 'Emirates',
  FZ: 'Flydubai',
  G9: 'Air Arabia',
  '3L': 'Air Arabia Abu Dhabi',
  EY: 'Etihad Airways',
  QR: 'Qatar Airways',
  SV: 'Saudia',
  WY: 'Oman Air',
  GF: 'Gulf Air',
  KU: 'Kuwait Airways',
  J9: 'Jazeera Airways',
  XY: 'Flynas',
  F3: 'Flyadeal',
  OV: 'SalamAir',
  RJ: 'Royal Jordanian',
  ME: 'Middle East Airlines',

  // Europe & Transatlantic
  KL: 'KLM',
  AF: 'Air France',
  LH: 'Lufthansa',
  BA: 'British Airways',
  VS: 'Virgin Atlantic',
  LX: 'Swiss',
  OS: 'Austrian Airlines',
  SN: 'Brussels Airlines',
  IB: 'Iberia',
  AZ: 'ITA Airways',
  AY: 'Finnair',
  SK: 'SAS',
  LO: 'LOT Polish Airlines',
  TP: 'TAP Air Portugal',
  EI: 'Aer Lingus',
  TK: 'Turkish Airlines',
  PC: 'Pegasus Airlines',

  // North America & Canada
  AC: 'Air Canada',
  WS: 'WestJet',
  UA: 'United Airlines',
  AA: 'American Airlines',
  DL: 'Delta Air Lines',

  // Southeast Asia & Far East
  SQ: 'Singapore Airlines',
  TR: 'Scoot',
  MH: 'Malaysia Airlines',
  AK: 'AirAsia',
  D7: 'AirAsia X',
  OD: 'Batik Air',
  TG: 'Thai Airways',
  FD: 'Thai AirAsia',
  XJ: 'Thai AirAsia X',
  SL: 'Thai Lion Air',
  VZ: 'Thai Vietjet Air',
  VJ: 'VietJet Air',
  VN: 'Vietnam Airlines',
  CX: 'Cathay Pacific',
  JL: 'Japan Airlines',
  NH: 'ANA',
  KE: 'Korean Air',
  OZ: 'Asiana Airlines',
  CI: 'China Airlines',
  BR: 'EVA Air',
  PR: 'Philippine Airlines',
  GA: 'Garuda Indonesia',

  // South Asia
  UL: 'SriLankan Airlines',
  RA: 'Nepal Airlines',
  BG: 'Biman Bangladesh',
  BS: 'US-Bangla Airlines',
  KB: 'Drukair',
  B3: 'Bhutan Airlines',
  H9: 'Himalaya Airlines',
  RQ: 'Kam Air',

  // Central Asia & CIS
  HY: 'Uzbekistan Airways',
  KC: 'Air Astana',
  T5: 'Turkmenistan Airlines',
  W5: 'Mahan Air',

  // Africa & Oceania
  ET: 'Ethiopian Airlines',
  MS: 'EgyptAir',
  KQ: 'Kenya Airways',
  QF: 'Qantas',
  NZ: 'Air New Zealand'
};

function getAirlineName(codeOrName) {
  if (!codeOrName) return '';
  const trimmed = String(codeOrName).trim();
  const upper = trimmed.toUpperCase();

  // 1. Check in standard mapping by exact code
  if (AIRLINE_NAMES[upper]) return AIRLINE_NAMES[upper];

  // 2. Check if it's already one of our full names (case-insensitive)
  const existingName = Object.values(AIRLINE_NAMES).find(
    name => name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existingName) return existingName;

  // 3. Check case-insensitive key
  const matchKey = Object.keys(AIRLINE_NAMES).find(k => k.toLowerCase() === trimmed.toLowerCase());
  if (matchKey) return AIRLINE_NAMES[matchKey];

  // 4. If codeOrName is already a descriptive full name (more than 3 chars and not a 2/3 letter code)
  if (trimmed.length > 3 && !/^[A-Z0-9]{2,3}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
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

  // Check if all items belong to same month and year
  const firstDate = parseDateParts(streak[0].travel_date);
  const sameMonthYear = streak.every(item => {
    const d = parseDateParts(item.travel_date);
    return d.getMonth() === firstDate.getMonth() && d.getFullYear() === firstDate.getFullYear();
  });

  // Check if the entire streak is 100% unbroken consecutive days
  let isAllConsecutive = true;
  for (let i = 1; i < streak.length; i++) {
    if (!isConsecutiveDay(streak[i - 1].travel_date, streak[i].travel_date)) {
      isAllConsecutive = false;
      break;
    }
  }

  // Case 1: All dates in the same month
  if (sameMonthYear) {
    const month = MONTH_NAMES[firstDate.getMonth()];
    // 4+ consecutive days in same month -> range (e.g. "22 Sep to 30 Sep")
    if (isAllConsecutive && streak.length >= 4) {
      return `${formatDayMonth(streak[0].travel_date)} to ${formatDayMonth(streak[streak.length - 1].travel_date)}`;
    }

    // Break into consecutive runs
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

  // Case 2: Across months and 100% unbroken consecutive -> range (e.g. "01 Oct to 31 Dec")
  if (isAllConsecutive) {
    return `${formatDayMonth(streak[0].travel_date)} to ${formatDayMonth(streak[streak.length - 1].travel_date)}`;
  }

  // Case 3: Across months and non-consecutive -> group by month and format
  const monthMap = new Map();
  for (const item of streak) {
    const d = parseDateParts(item.travel_date);
    const mKey = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap.has(mKey)) {
      monthMap.set(mKey, []);
    }
    monthMap.get(mKey).push(item);
  }

  const parts = [];
  for (const mStreak of monthMap.values()) {
    parts.push(formatStreakLabel(mStreak));
  }
  return parts.join(', ');
}

/**
 * Groups a list of fares by Route -> Airline -> Same Fare & Month Buckets with clean comma & range formatting
 */
function groupFaresByDateRanges(faresList = []) {
  if (!faresList || faresList.length === 0) return [];

  // 1. Group by Route Key: format as "Delhi to Milan"
  const routeMap = new Map();
  for (const f of faresList) {
    const routeKey = formatRouteName(f.origin, f.destination, 'TO');
    if (!routeMap.has(routeKey)) {
      routeMap.set(routeKey, []);
    }
    routeMap.get(routeKey).push(f);
  }

  const consolidatedList = [];

  for (const [routeKey, routeFares] of routeMap.entries()) {
    // 2. Group by Airline (Standardized Name)
    const airlineMap = new Map();
    for (const f of routeFares) {
      const airCode = f.airline_code || '';
      const airKey = getAirlineName(airCode) || getAirlineName(f.airline_name) || f.airline_name || airCode || 'Airline';
      if (!airlineMap.has(airKey)) {
        airlineMap.set(airKey, []);
      }
      airlineMap.get(airKey).push({
        ...f,
        airline_name: airKey
      });
    }

    for (const [airName, airFares] of airlineMap.entries()) {
      // Step A: For each travel date, pick lowest fare and collect ALL tied vendors
      const dateMap = new Map();
      for (const f of airFares) {
        const dStr = String(f.travel_date).split('T')[0];
        const net = Number(f.net_fare) || 0;
        const margin = Number(f.margin_amount) || Number(f.calculated_margin) || 0;
        let fare = Number(f.publish_fare);
        if (!fare || fare <= net) {
          fare = Number(f.calculated_publish_fare) || (net + margin);
        }
        if (fare <= 0) continue;

        const vName = (f.vendor_name || f['Vendor / Source'] || f.vendor_id || '').trim();

        if (!dateMap.has(dStr)) {
          dateMap.set(dStr, { 
            minFare: fare, 
            winningFares: [{ ...f, publish_fare: fare, vendor_name: vName }] 
          });
        } else {
          const cur = dateMap.get(dStr);
          if (fare < cur.minFare - 0.01) {
            // Strictly cheaper selling rate found: replace with cheaper winner!
            dateMap.set(dStr, { 
              minFare: fare, 
              winningFares: [{ ...f, publish_fare: fare, vendor_name: vName }] 
            });
          } else if (Math.abs(fare - cur.minFare) < 0.01) {
            // Same lowest rate: collect tied vendor offering the exact same lowest rate
            const exists = cur.winningFares.some(w => 
              (w.vendor_name || w['Vendor / Source'] || w.vendor_id || '').trim() === vName
            );
            if (!exists) {
              cur.winningFares.push({ ...f, publish_fare: fare, vendor_name: vName });
            } else {
              // Update with newer entry if same vendor
              const existingIdx = cur.winningFares.findIndex(w => 
                (w.vendor_name || w['Vendor / Source'] || w.vendor_id || '').trim() === vName
              );
              if (existingIdx !== -1) {
                const fTime = f.updated_at || f.created_at || '';
                const exTime = cur.winningFares[existingIdx].updated_at || cur.winningFares[existingIdx].created_at || '';
                if (fTime > exTime) {
                  cur.winningFares[existingIdx] = { ...f, publish_fare: fare, vendor_name: vName };
                }
              }
            }
          }
          // If fare > cur.minFare: IGNORE more expensive quote!
        }
      }

      // Step B: Build unique date items with combined vendor names
      const uniqueDates = [];
      for (const [dStr, { minFare, winningFares }] of dateMap.entries()) {
        const first = winningFares[0];
        const vNames = Array.from(new Set(
          winningFares.map(w => (w.vendor_name || w['Vendor / Source'] || w.vendor_id || '').trim()).filter(Boolean)
        )).sort();
        const vendorLabel = vNames.join(', ') || first.vendor_name || '';

        uniqueDates.push({
          ...first,
          travel_date: dStr,
          publish_fare: minFare,
          vendor_name: vendorLabel,
          all_vendors: vNames,
          winning_fares: winningFares,
          fare_ids: winningFares.map(w => w.id || w.fare_id).filter(Boolean)
        });
      }

      uniqueDates.sort((a, b) => a.travel_date.localeCompare(b.travel_date));

      // Step C: Group into buckets by (Month + publish_fare + cabin + baggage)
      // Dates sharing the same publish fare within the same month group into clean ranges, regardless of vendor
      const bucketMap = new Map();
      for (const item of uniqueDates) {
        const mKey = item.travel_date.slice(0, 7);
        const cabin = item.cabin || 'ECONOMY';
        const baggage = item.baggage || '30kg';
        const bKey = `${mKey}_${item.publish_fare}_${cabin}_${baggage}`;
        if (!bucketMap.has(bKey)) {
          bucketMap.set(bKey, []);
        }
        bucketMap.get(bKey).push(item);
      }

      const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => 
        String(a[0].travel_date).localeCompare(String(b[0].travel_date))
      );

      for (const bucket of sortedBuckets) {
        bucket.sort((x, y) => String(x.travel_date).localeCompare(String(y.travel_date)));
        consolidatedList.push(createConsolidatedItem(routeKey, bucket));
      }
    }
  }

  return consolidatedList;
}

function createConsolidatedItem(routeKey, streak) {
  const first = streak[0];
  const last = streak[streak.length - 1];
  const dateLabel = formatStreakLabel(streak);

  const vendorList = Array.from(
    new Set(streak.flatMap(s => s.all_vendors || [(s.vendor_name || s['Vendor / Source'] || '').trim()]).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const vendorName = vendorList.join(', ') || first.vendor_name || first['Vendor / Source'] || '';

  const netValues = streak.map(s => Number(s.net_fare) || 0).filter(n => n > 0);
  const net = netValues.length > 0 ? Math.min(...netValues) : (Number(first.net_fare) || 0);
  let margin = Number(first.margin_amount) || Number(first.calculated_margin) || 0;
  let pub = Number(first.publish_fare);
  if (!pub || pub <= net) {
    pub = Number(first.calculated_publish_fare) || (net + margin);
  }
  if (margin === 0 && pub > net) {
    margin = pub - net;
  }

  const allFareIds = Array.from(new Set(streak.flatMap(s => s.fare_ids || [s.id]).filter(Boolean)));
  const airCode = first.airline_code || '';
  const airName = getAirlineName(airCode) || getAirlineName(first.airline_name) || first.airline_name || airCode || 'Airline';

  return {
    id: `streak-${first.id}-${last.id}-${streak.length}`,
    route: routeKey,
    origin: first.origin,
    destination: first.destination,
    airline_code: first.airline_code,
    airline_name: airName,
    vendor_name: vendorName,
    vendor_list: vendorList,
    date_label: dateLabel,
    start_date: first.travel_date,
    end_date: last.travel_date,
    dates_count: streak.length,
    net_fare: net,
    margin_amount: margin,
    publish_fare: pub,
    baggage: first.baggage || '30kg',
    is_refundable: first.is_refundable,
    cabin: first.cabin || 'ECONOMY',
    fare_ids: allFareIds,
    streak_items: streak
  };
}

/**
 * Format WhatsApp broadcast with grouped date ranges
 */
function formatWhatsAppBroadcast(faresList, options = {}) {
  const {
    title = '✈️ TRAVELX SPECIAL FARE',
    footer = '🔥 BEST FARE GUARANTEE\n⚡ LIMITED SEATS AVAILABLE\n📞 Contact Travelx Desk for Instant Issuance',
    groupByRanges = true
  } = options;

  if (!faresList || faresList.length === 0) return '';

  if (!groupByRanges) {
    let text = `${title}\n\n`;
    for (const f of faresList) {
      const d = formatDayMonth(f.travel_date);
      const routeText = formatRouteName(f.origin, f.destination, 'TO');
      const airLabel = getAirlineName(f.airline_code) || getAirlineName(f.airline_name) || f.airline_name || f.airline_code || 'Airline';
      text += `🗓️ *${d}* | ${routeText}\n`;
      text += `✈️ ${airLabel} – *₹${Number(f.publish_fare).toLocaleString('en-IN')}* | ${f.baggage || '30kg'}\n\n`;
    }
    text += `${footer}\n`;
    return text;
  }

  const consolidated = groupFaresByDateRanges(faresList);
  if (consolidated.length === 0) return '';

  // Group by Route
  const routeMap = new Map();
  for (const item of consolidated) {
    if (!routeMap.has(item.route)) {
      routeMap.set(item.route, new Map());
    }
    const airMap = routeMap.get(item.route);
    const airCode = item.airline_code || '';
    const airName = getAirlineName(airCode) || getAirlineName(item.airline_name) || item.airline_name || airCode || 'Airline';
    if (!airMap.has(airName)) {
      airMap.set(airName, []);
    }
    airMap.get(airName).push(item);
  }

  let text = `${title}\n\n`;

  for (const [routeKey, airMap] of routeMap.entries()) {
    text += `📍 *${routeKey}*\n\n`;

    for (const [airName, items] of airMap.entries()) {
      const fullAirName = getAirlineName(items[0]?.airline_code) || getAirlineName(airName) || airName;
      const baggage = items[0]?.baggage ? ` (${items[0].baggage})` : '';
      text += `✈️ *${fullAirName}*${baggage}\n`;

      for (const item of items) {
        text += `• *${item.date_label}* – *₹${Number(item.publish_fare).toLocaleString('en-IN')}*\n`;
      }
      text += `\n`;
    }
    text += `───────────────\n\n`;
  }

  text += `${footer}\n`;
  return text;
}

module.exports = {
  parseDateParts,
  isConsecutiveDay,
  formatDayMonth,
  formatStreakLabel,
  groupFaresByDateRanges,
  formatWhatsAppBroadcast
};
