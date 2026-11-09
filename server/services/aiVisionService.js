/**
 * AI Vision Extraction Service using OpenAI ChatGPT (GPT-4o-mini Vision) & Google Gemini Vision
 */

const { parseDateString, normalizeAirlineCode, parseWhatsAppFareText } = require('./whatsappParser');

let db = null;
function getDb() {
  if (!db) {
    try {
      db = require('../config/database');
    } catch (_) {}
  }
  return db;
}

const AIRLINE_CODE_MAP = {
  'air india express': 'IX',
  'air india exp': 'IX',
  'airindia express': 'IX',
  'airindia exp': 'IX',
  'ix': 'IX',
  'air india': 'AI',
  'airindia': 'AI',
  'ai': 'AI',
  'indigo': '6E',
  '6e': '6E',
  'spicejet': 'SG',
  'spice jet': 'SG',
  'spice': 'SG',
  'sg': 'SG',
  'vistara': 'UK',
  'uk': 'UK',
  'akasa air': 'QP',
  'akasa': 'QP',
  'qp': 'QP',
  'air arabia': 'G9',
  'g9': 'G9',
  'flydubai': 'FZ',
  'fly dubai': 'FZ',
  'fz': 'FZ',
  'emirates': 'EK',
  'ek': 'EK',
  'etihad airways': 'EY',
  'etihad': 'EY',
  'ey': 'EY',
  'qatar airways': 'QR',
  'qatar': 'QR',
  'qr': 'QR',
  'oman air': 'WY',
  'wy': 'WY',
  'salamair': 'OV',
  'saudia': 'SV',
  'saudi arabian airlines': 'SV',
  'flynas': 'XY',
  'flyadeal': 'F3',
  'kuwait airways': 'KU',
  'jazeera airways': 'J9',
  'jazeera': 'J9',
  'gulf air': 'GF',
  'egyptair': 'MS',
  'mahan air': 'W5',
  'srilankan airlines': 'UL',
  'srilankan': 'UL',
  'biman bangladesh': 'BG',
  'biman': 'BG',
  'us-bangla airlines': 'BS',
  'us-bangla': 'BS',
  'nepal airlines': 'RA',
  'himalaya airlines': 'H9',
  'drukair': 'KB',
  'kam air': 'RQ',
  'singapore airlines': 'SQ',
  'malaysia airlines': 'MH',
  'batik air malaysia': 'OD',
  'batik air': 'OD',
  'thai airasia x': 'XJ',
  'airasia x': 'XJ',
  'thai airasia': 'FD',
  'airasia': 'AK',
  'xj': 'XJ',
  'fd': 'FD',
  'd7': 'D7',
  'qz': 'QZ',
  'thai airways': 'TG',
  'thai lion air': 'SL',
  'thai lion': 'SL',
  'vietjet air': 'VJ',
  'vietjet': 'VJ',
  'vietnam airlines': 'VN',
  'cathay pacific': 'CX',
  'garuda indonesia': 'GA',
  'all nippon airways': 'NH',
  'ana': 'NH',
  'japan airlines': 'JL',
  'korean air': 'KE',
  'air astana': 'KC',
  'uzbekistan airways': 'HY',
  'british airways': 'BA',
  'virgin atlantic': 'VS',
  'lufthansa': 'LH',
  'air france': 'AF',
  'klm': 'KL',
  'swiss international air lines': 'LX',
  'swiss': 'LX',
  'turkish airlines': 'TK',
  'ita airways': 'AZ',
  'lot polish airlines': 'LO',
  'finnair': 'AY',
  'austrian airlines': 'OS',
  'sas': 'SK',
  'air canada': 'AC',
  'united airlines': 'UA',
  'american airlines': 'AA',
  'delta air lines': 'DL',
  'qantas': 'QF',
  'ethiopian airlines': 'ET',
  'kenya airways': 'KQ',
  's5': 'S5',
  'star air': 'S5',
  'starair': 'S5',
  'star': 'S5',
  'fly91': 'IC',
  'ic': 'IC',
  'alliance air': '9I',
  '9i': '9I'
};

const CITY_IATA_MAP = {
  'don mueang': 'DMK',
  'dmk': 'DMK',
  'bangkok': 'BKK',
  'bkk': 'BKK',
  'adampur': 'AIP',
  'jalandhar': 'AIP',
  'aip': 'AIP',
  'nanded': 'NDC',
  'ndc': 'NDC',
  'chandigarh': 'IXC',
  'ixc': 'IXC',
  'hindon': 'HDO',
  'hdo': 'HDO',
  'kishangarh': 'KQH',
  'kqh': 'KQH',
  'jaipur': 'JAI',
  'jai': 'JAI',
  'goa': 'GOI',
  'goi': 'GOI',
  'mopa': 'GOX',
  'gox': 'GOX',
  'amritsar': 'ATQ',
  'atq': 'ATQ',
  'dubai': 'DXB',
  'dxb': 'DXB',
  'sharjah': 'SHJ',
  'shj': 'SHJ',
  'abu dhabi': 'AUH',
  'abudhabi': 'AUH',
  'auh': 'AUH',
  'delhi': 'DEL',
  'new delhi': 'DEL',
  'del': 'DEL',
  'mumbai': 'BOM',
  'bom': 'BOM',
  'bangalore': 'BLR',
  'bengaluru': 'BLR',
  'blr': 'BLR',
  'hyderabad': 'HYD',
  'hyd': 'HYD',
  'chennai': 'MAA',
  'maa': 'MAA',
  'kolkata': 'CCU',
  'ccu': 'CCU',
  'ahmedabad': 'AMD',
  'amd': 'AMD',
  'lucknow': 'LKO',
  'lko': 'LKO',
  'kochi': 'COK',
  'cochin': 'COK',
  'cok': 'COK',
  'kozhikode': 'CCJ',
  'calicut': 'CCJ',
  'ccj': 'CCJ',
  'thiruvananthapuram': 'TRV',
  'trivandrum': 'TRV',
  'trv': 'TRV',
  'pune': 'PNQ',
  'pnq': 'PNQ',
  'doha': 'DOH',
  'doh': 'DOH',
  'kuwait': 'KWI',
  'kuwait city': 'KWI',
  'kwi': 'KWI',
  'muscat': 'MCT',
  'mct': 'MCT',
  'bahrain': 'BAH',
  'bah': 'BAH',
  'dammam': 'DMM',
  'dmm': 'DMM',
  'jeddah': 'JED',
  'jed': 'JED',
  'riyadh': 'RUH',
  'ruh': 'RUH',
  'milan': 'MXP',
  'millan': 'MXP',
  'malpensa': 'MXP',
  'mxp': 'MXP',
  'rome': 'ROM',
  'fiumicino': 'ROM',
  'rom': 'ROM',
  'fco': 'ROM',
  'toronto': 'YYZ',
  'yyz': 'YYZ',
  'kuala lumpur': 'KUL',
  'kul': 'KUL',
  'singapore': 'SIN',
  'sin': 'SIN',
  'colombo': 'CMB',
  'cmb': 'CMB',
  'kathmandu': 'KTM',
  'ktm': 'KTM',
  'dhaka': 'DAC',
  'dac': 'DAC',
  'london': 'LHR',
  'lhr': 'LHR',
  'gatwick': 'LGW',
  'lgw': 'LGW'
};

const KNOWN_AIRPORTS = [
  'ATQ', 'DXB', 'SHJ', 'DEL', 'BOM', 'KWI', 'AUH', 'DOH', 'MCT', 'BAH', 'DMM',
  'JED', 'MED', 'RUH', 'IXC', 'AIP', 'NDC', 'HDO', 'KQH', 'JAI', 'GOI', 'GOX',
  'BLR', 'MAA', 'HYD', 'CCU', 'AMD', 'LKO', 'COK', 'CCJ', 'TRV', 'PNQ',
  'SIN', 'KUL', 'BKK', 'DMK', 'CMB', 'KTM', 'DAC', 'LHR', 'YYZ', 'MXP', 'ROM'
];

function extractCleanAirportCode(inputStr, defaultCode = 'ATQ') {
  if (!inputStr) return defaultCode;
  const raw = String(inputStr).trim();
  const lower = raw.toLowerCase();

  // 1. Direct match in CITY_IATA_MAP
  if (CITY_IATA_MAP[lower]) return CITY_IATA_MAP[lower];

  // 2. Bracketed 3-letter IATA code: e.g. "New Delhi (DEL)", "Kuwait City (KWI)"
  const bracketMatch = raw.match(/\(([A-Za-z]{3})\)/);
  if (bracketMatch) {
    const code = bracketMatch[1].toUpperCase();
    if (KNOWN_AIRPORTS.includes(code) || CITY_IATA_MAP[code.toLowerCase()]) return code;
  }

  // 3. Standalone 3-letter uppercase code in text
  const words = raw.toUpperCase().match(/\b([A-Z]{3})\b/g);
  if (words) {
    for (const w of words) {
      if (KNOWN_AIRPORTS.includes(w) || CITY_IATA_MAP[w.toLowerCase()]) return w;
    }
  }

  // 4. Substring check in CITY_IATA_MAP
  for (const [cityName, iata] of Object.entries(CITY_IATA_MAP)) {
    if (cityName.length >= 3 && lower.includes(cityName)) {
      return iata;
    }
  }

  return raw.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || defaultCode;
}

/**
 * Standardize flight records returned by AI model
 */
function expandTravelDates(raw, year) {
  const text = String(raw || '')
    .replace(/\(all dates\)/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];

  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const range = text.match(/(\d{1,2})\s+([a-z]{3,9})\s+(?:to|till|thru|until|–|—|-)\s+(\d{1,2})\s*([a-z]{3,9})?/i);
  if (range && Number(range[1]) <= 31 && Number(range[3]) <= 31) {
    const m1 = months[range[2].toLowerCase().slice(0, 3)];
    const m2 = months[(range[4] || range[2]).toLowerCase().slice(0, 3)];
    if (m1 !== undefined && m2 !== undefined) {
      const start = new Date(year, m1, Number(range[1]));
      let end = new Date(year, m2, Number(range[3]));
      if (end < start) end = new Date(year + 1, m2, Number(range[3]));
      const out = [];
      for (let d = new Date(start); d <= end && out.length < 45; d.setDate(d.getDate() + 1)) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        out.push(`${d.getFullYear()}-${mm}-${dd}`);
      }
      if (out.length) return out;
    }
  }

  const parts = text.split(/\s*(?:&|,|and)\s*/i);
  const dates = [];
  for (const part of parts) {
    const parsed = parseDateString(part, year);
    if (parsed) dates.push(parsed);
  }
  return dates;
}

function parseModelPayload(rawText) {
  let text = String(rawText || '').trim();
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = text.indexOf('{');
  const arrStart = text.indexOf('[');
  if (start === -1 || (arrStart !== -1 && arrStart < start)) {
    const a0 = text.indexOf('[');
    const a1 = text.lastIndexOf(']');
    if (a0 !== -1 && a1 > a0) text = text.slice(a0, a1 + 1);
  } else {
    const end = text.lastIndexOf('}');
    if (end > start) text = text.slice(start, end + 1);
  }
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return { records: parsed, flyerText: '' };
  const records = parsed.records || parsed.fares || parsed.rows || parsed.data || [];
  const flyerText = String(parsed.flyer_text || parsed.transcript || parsed.text || parsed.raw_text || '').trim();
  return { records: Array.isArray(records) ? records : [], flyerText };
}

function pickNumericFare(item) {
  const candidates = [item.net_fare, item.fare, item.rate, item.price, item.amount, item.fare_amount];
  for (const c of candidates) {
    if (c && typeof c === 'object') {
      const nested = parseFloat(String(c.amount || c.value || c.net || '').replace(/[^0-9.]/g, ''));
      if (!isNaN(nested) && nested > 500) return nested;
    }
    const n = parseFloat(String(c ?? '').replace(/[^0-9.]/g, ''));
    if (!isNaN(n) && n > 500) return n;
  }
  return NaN;
}

function dateSourceFromItem(item) {
  const direct = item.travel_date || item.date || item.dates || item.date_label || item.date_text || item.date_range || item.travel_dates || item.period || '';
  if (Array.isArray(direct)) return direct.join(', ');
  if (direct && typeof direct === 'object') return String(direct.text || direct.label || direct.value || '');
  return String(direct || '');
}

function standardizeAIRecords(rawRecords = [], defaults = {}) {
  const currentYear = new Date().getFullYear();
  const cleaned = [];

  for (const item of rawRecords) {
    let routeOrigin = '';
    let routeDest = '';
    const routeBlob = String(item.route || item.sector || '');
    const routePair = routeBlob.toUpperCase().match(/\b([A-Z]{3})\b[\s\-\/→>]+(?:TO[\s]+)?\b([A-Z]{3})\b/);
    if (routePair) {
      routeOrigin = routePair[1];
      routeDest = routePair[2];
    }
    let origin = extractCleanAirportCode(item.origin || routeOrigin || defaults.origin || defaults.defaultOrigin || 'ATQ', 'ATQ');
    let destination = extractCleanAirportCode(item.destination || routeDest || defaults.destination || defaults.defaultDestination || 'DXB', 'DXB');
    
    // Clean airline code using normalizeAirlineCode (never slices raw string into invalid code like "IN")
    const rawAirline = item.airline_code || item.airline || '';
    const cleanAirline = normalizeAirlineCode(rawAirline, item.flight_number, defaults.airline || defaults.defaultAirline || 'AI');

    // Unify airport aliases to canonical codes
    if (origin === 'MIL') origin = 'MXP';
    if (destination === 'MIL') destination = 'MXP';
    if (origin === 'FCO') origin = 'ROM';
    if (destination === 'FCO') destination = 'ROM';

    const dateSource = dateSourceFromItem(item);
    const fare = pickNumericFare(item);
    const dates = expandTravelDates(dateSource, currentYear);

    if (dates.length && !isNaN(fare) && fare > 500) {
      for (const dateStr of dates) {
        cleaned.push({
          origin: origin.slice(0, 3),
          destination: destination.slice(0, 3),
          airline_code: cleanAirline,
          flight_number: item.flight_number || '',
          travel_date: dateStr,
          net_fare: fare,
          currency: 'INR',
          cabin: item.cabin || 'ECONOMY',
          baggage: item.baggage || defaults.baggage || defaults.defaultBaggage || '30kg',
          is_refundable: item.is_refundable || defaults.is_refundable || defaults.defaultRefundable || 'NON_REFUNDABLE',
          remarks: item.remarks || 'AI Vision Extracted'
        });
      }
    }
  }

  // Sort Route-wise, then Airline-wise, then Date-wise ascending
  cleaned.sort((a, b) => {
    const routeA = `${a.origin}-${a.destination}`;
    const routeB = `${b.origin}-${b.destination}`;
    if (routeA !== routeB) {
      return routeA.localeCompare(routeB);
    }
    const airA = a.airline_code || '';
    const airB = b.airline_code || '';
    if (airA !== airB) {
      return airA.localeCompare(airB);
    }
    return (a.travel_date || '').localeCompare(b.travel_date || '');
  });
  return cleaned;
}

function asVisionRecord(row) {
  return {
    origin: String(row.origin || 'ATQ').toUpperCase().slice(0, 3),
    destination: String(row.destination || 'DXB').toUpperCase().slice(0, 3),
    airline_code: normalizeAirlineCode(row.airline_code, row.flight_number, row.airline_code || 'AI'),
    flight_number: row.flight_number || '',
    travel_date: row.travel_date,
    net_fare: Number(row.net_fare),
    currency: 'INR',
    cabin: row.cabin || 'ECONOMY',
    baggage: row.baggage || '30kg',
    is_refundable: row.is_refundable || 'NON_REFUNDABLE',
    remarks: row.remarks || 'AI Vision Extracted'
  };
}

function unionVisionRecords(lists) {
  const map = new Map();
  for (const row of lists.flat()) {
    if (!row || !row.travel_date || !(Number(row.net_fare) > 500)) continue;
    const norm = asVisionRecord(row);
    const key = `${norm.airline_code}|${norm.origin}|${norm.destination}|${norm.travel_date}`;
    if (!map.has(key)) map.set(key, norm);
  }
  return Array.from(map.values()).sort((a, b) => {
    const routeA = `${a.origin}-${a.destination}`;
    const routeB = `${b.origin}-${b.destination}`;
    if (routeA !== routeB) return routeA.localeCompare(routeB);
    if (a.airline_code !== b.airline_code) return a.airline_code.localeCompare(b.airline_code);
    return a.travel_date.localeCompare(b.travel_date);
  });
}

function buildRecordsFromModelText(rawText, defaults = {}) {
  let flyerText = '';
  let rawRecords = [];
  let detectedBaggage = defaults.baggage || defaults.defaultBaggage || '30kg';
  let detectedRefundable = defaults.is_refundable || defaults.defaultRefundable || 'NON_REFUNDABLE';

  try {
    const parsed = parseModelPayload(rawText);
    if (Array.isArray(parsed)) {
      rawRecords = parsed;
    } else if (parsed && typeof parsed === 'object') {
      flyerText = parsed.flyerText || parsed.flyer_text || '';
      rawRecords = Array.isArray(parsed.records) ? parsed.records : (Array.isArray(parsed.fares) ? parsed.fares : []);
      if (parsed.baggage) detectedBaggage = parsed.baggage;
      if (parsed.is_refundable) detectedRefundable = parsed.is_refundable;
    }
  } catch (_) {
    flyerText = String(rawText || '');
  }

  const effectiveDefaults = {
    ...defaults,
    baggage: detectedBaggage,
    is_refundable: detectedRefundable
  };

  const fromJson = standardizeAIRecords(rawRecords, effectiveDefaults);
  const textForParser = flyerText || (!fromJson.length ? String(rawText || '') : '');
  let fromText = [];
  if (textForParser && /\d/.test(textForParser) && /[a-z]/i.test(textForParser)) {
    try {
      fromText = parseWhatsAppFareText(textForParser, effectiveDefaults).records || [];
    } catch (_) {}
  }
  return unionVisionRecords([fromJson, fromText]);
}

const VISION_SYSTEM_PROMPT = `You are an expert AI flight data extractor for travel agents.
Extract ALL flight fares from this airline rate card flyer or online booking portal screenshot into clean, structured JSON.

CRITICAL INSTRUCTIONS:

1. ONLINE BOOKING PORTAL & CALENDAR POPUP SCREENSHOTS (e.g. GhaiTravels | TravelX, Akbar, TBO, Jazeera Airways, MakeMyTrip, Cleartrip):
   Many vendor rate screenshots are web portal searches with an interactive 2-month calendar picker:
   * SECTOR / ROUTE EXTRACTION:
     - Look at the top search bar:
       * "DEPARTURE FROM": e.g. "New Delhi (DEL)", "Amritsar (ATQ)", "Chandigarh (IXC)", etc. -> extract 3-letter IATA code: Origin is "DEL".
       * "GOING TO": e.g. "Kuwait City (KWI)", "Dubai (DXB)", "Sharjah (SHJ)", "Doha (DOH)", "Abu Dhabi (AUH)", etc. -> extract 3-letter IATA code: Destination is "KWI".
     - Convert city names to standard 3-letter IATA codes (e.g. New Delhi = DEL, Kuwait City = KWI, Amritsar = ATQ, Dubai = DXB, Sharjah = SHJ, Abu Dhabi = AUH).
     - Every date/fare extracted from this screenshot inherits this Origin and Destination (e.g. DEL -> KWI).
   * CALENDAR MONTH & YEAR HEADERS:
     - Often 2 months are shown side-by-side (e.g. "November 2026" on the left, "December 2026" on the right).
     - Days in the left grid belong to the left month (e.g. "November 2026" -> Year: 2026, Month: 11).
     - Days in the right grid belong to the right month (e.g. "December 2026" -> Year: 2026, Month: 12).
   * CALENDAR DAY CELLS WITH FARES:
     - Inside calendar day cells (under columns SU, MO, TU, WE, TH, FR, SA):
       * The top number is the Day of month (e.g. "18", "25").
       * Below the day number, look for printed fares (e.g. "₹17,600", "17600", "₹18,500", "14800").
       * Extract every calendar day that has a fare amount printed:
         - Day 18 in November 2026 with "₹17,600" -> travel_date: "2026-11-18", net_fare: 17600
         - Day 25 in November 2026 with "₹17,600" -> travel_date: "2026-11-25", net_fare: 17600
   * AIRLINE DETECTION IN PORTAL SCREENSHOTS:
     - Look for the airline logo, name, or flight cards displayed on the screen (e.g. below the calendar):
       * "Jazeera Airways" or "Jazeera" or Jazeera logo -> airline_code: "J9".
       * "Air India Express" -> airline_code: "IX".
       * "IndiGo" -> airline_code: "6E".
       * "SpiceJet" -> airline_code: "SG".
       * "Kuwait Airways" -> airline_code: "KU".
       * "Air Arabia" -> airline_code: "G9".
       * "Flydubai" -> airline_code: "FZ".
       * "Akasa Air" -> airline_code: "QP".
       * "Etihad Airways" -> airline_code: "EY".
       * "Emirates" -> airline_code: "EK".
       * "Qatar Airways" -> airline_code: "QR".
       * "Oman Air" -> airline_code: "WY".
       * "Gulf Air" -> airline_code: "GF".
       * "SalamAir" -> airline_code: "OV".
       * "Flynas" -> airline_code: "XY".
       * "Flyadeal" -> airline_code: "F3".
       * "Saudia" -> airline_code: "SV".
     - In GhaiTravels / TravelX screenshots, look at the flight card below the calendar (e.g. "Wednesday 18 November", "Lowest fare", "Jazeera Airways") -> Airline is "J9".
     - If a specific flight number is shown (e.g. "J9 406"), include it in flight_number.
   * FLIGHT RESULT CARDS BELOW CALENDAR:
     - If the portal shows detailed flight cards below the calendar for the selected date (e.g. "Wednesday 18 November", "Jazeera Airways", fare: 17600):
       - Extract that date, airline, flight number, and fare!

   * GHAI TRAVELS B2B "SPECIAL FARES" CARD SCREENSHOTS (e.g. b2b.ghaitravels.in/app/special-fares/ATQ-DXB):
     - ROUTE / SECTOR:
       * Look at the top search bar: "FROM Amritsar (ATQ) ➔ TO Dubai (DXB)" or URL "/special-fares/ATQ-DXB" -> Origin is "ATQ", Destination is "DXB".
     - INDIVIDUAL FLIGHT CARDS:
       * Each horizontal white card on the page is an individual flight option.
       * DATE: Look at the green rounded pill at the top of the card (e.g. "TUE 10 NOV", "WED 11 NOV", "THU 12 NOV", "SAT 14 NOV", "SUN 15 NOV"):
         - "TUE 10 NOV" -> travel_date: "2026-11-10"
         - "WED 11 NOV" -> travel_date: "2026-11-11"
         - "THU 12 NOV" -> travel_date: "2026-11-12"
         - "SAT 14 NOV" -> travel_date: "2026-11-14"
         - "SUN 15 NOV" -> travel_date: "2026-11-15"
       * AIRLINE & FLIGHT NUMBER:
         - Look at the airline logo and text on the left of each card:
           * "Spicejet" with "5155 | A320" -> airline_code: "SG", flight_number: "SG 5155".
           * "Air India Express" with "113 | ." -> airline_code: "IX", flight_number: "IX 113".
           * "Air India Express" with "107 | ." -> airline_code: "IX", flight_number: "IX 107".
       * TIMINGS:
         - Departure time (e.g. "19:35", "05:25", "05:50") -> departure_time.
         - Arrival time (e.g. "22:20", "08:35", "08:55") -> arrival_time.
       * FARE:
         - The big bold price on the right (e.g. "₹16,000", "₹19,800", "₹21,200", "₹21,999") -> net_fare: 16000, 19800, 21200, 21999.
       * BAGGAGE & REFUNDABLE:
         - "1 Pc, 7 Kg" cabin + "30 Pc, 1 Kg" or "30 Kg" check-in -> baggage: "30+7 KG".
         - "NON-REFUNDABLE" tag -> is_refundable: "NON_REFUNDABLE".
       * Extract EVERY single card visible on the screenshot!

2. MULTI-SECTOR & MULTI-AIRLINE DETECTION (DO NOT STOP AFTER ONE SECTOR):
   - A single flyer often contains MULTIPLE SECTORS (e.g. BOTH "ATQ - DXB" AND "ATQ - SHJ", "IXC - DXB", etc.) or MULTIPLE AIRLINES (e.g. BOTH "Air India Express (IX)" AND "IndiGo (6E)", "SpiceJet (SG)").
   - You MUST extract flight records for ALL sectors and ALL airlines found on the image! Do NOT restrict yourself to only one sector or one airline.
   - Scan every single row, column, table, and flight card from left-to-right and top-to-bottom.

3. GRID OF FLIGHT RATE CARDS / BOXES (30 to 100+ CARDS):
   - If the flyer consists of a grid of rectangular cards/boxes (e.g. multiple rows and columns of cards):
     * Read the Route on each card (e.g. some cards are "ATQ - SHJ", while other cards are "ATQ - DXB").
     * Read the Travel Date (e.g. "08/10/2026", "15 OCT", "22-10-2026").
     * Read the Net Fare (e.g. "16200", "Fare: 17500/-").
     * Read the Airline (e.g. "Air India Express" -> "IX", "IndiGo" -> "6E", "SpiceJet" -> "SG").
   - You MUST scan EVERY card row-by-row and column-by-column.
   - Do NOT stop after 30 cards or after one sector! Extract ALL cards.

4. SECTOR & ROUTE EXTRACTION:
   - The flyer may contain ANY SECTOR (domestic or international).
   - Look for route indicators such as "AIP - NDC", "ATQ → DXB", "ATQ - SHJ", "IXC -> DXB", "DEL - BOM", "DEL - KWI", etc.
   - CRITICAL: NEVER force, assume, or default the route to "ATQ - DXB" if the flyer or portal shows a different route (such as DEL - KWI, AIP - NDC, IXC - DXB, etc.). ALWAYS extract the EXACT 3-letter origin and destination airport codes!

5. AIRLINE & FLIGHT NUMBER EXTRACTION:
   - Look for airline indicators such as:
     * "J9" or "Jazeera Airways" -> "J9"
     * "XJ" or "XJ 230" -> "XJ" (Thai AirAsia X)
     * "FD" -> "FD" (Thai AirAsia)
     * "S5" or "S5235/186" -> "S5" (Star Air)
     * "IX" or "IX 191" -> "IX" (Air India Express)
     * "SG" -> "SG" (SpiceJet)
     * "6E" -> "6E" (IndiGo)
     * "AI" -> "AI" (Air India)
     * "UK" -> "UK" (Vistara)
     * "QP" -> "QP" (Akasa Air)
     * "IC" -> "IC" (Fly91)
     * "G9" -> "G9" (Air Arabia)
     * "FZ" -> "FZ" (Flydubai)
     * "KU" -> "KU" (Kuwait Airways)
     * "TG" -> "TG" (Thai Airways)
     * "SL" -> "SL" (Thai Lion Air)
   - CRITICAL: ALWAYS return ONLY the 2-letter uppercase IATA code for airline_code. NEVER output full airline names like "IndiGo", "SpiceJet", or "Jazeera Airways" in the airline_code field!
   - NEVER overwrite or default J9, XJ, FD, S5, SG, IX, 6E to AI.

6. CALENDAR VIEW / MONTHLY GRID FLYERS:
   - If the flyer is structured as a monthly calendar (e.g. header says "Sep 2026", "October 2026", "November 2026", etc.):
     * Read the Month & Year header.
     * Identify each active day cell with a fare.
     * Output a distinct record for EVERY active day box in the calendar with a fare!

7. MULTI-DATE STREAKS & RANGES (FOR TEXT FLYERS):
   - For lines with multiple dates (e.g., "15 SEP & 16 SEP & 17 SEP & 18 SEP 20800"), generate a SEPARATE record for EVERY date with that net fare.
   - For date ranges (e.g., "23 SEP TO 02 OCT (ALL DATES) 17800"), generate a SEPARATE record for EVERY individual calendar day with that net fare.

8. IATA CODES CONVERSION:
   - Convert city names to 3-letter IATA airport codes:
     * Delhi / New Delhi = DEL
     * Kuwait / Kuwait City = KWI
     * Amritsar = ATQ
     * Dubai = DXB
     * Sharjah = SHJ
     * Abu Dhabi = AUH
     * Doha = DOH
     * Muscat = MCT
     * Bahrain = BAH
     * Dammam = DMM
     * Jeddah = JED
     * Riyadh = RUH
     * Chandigarh = IXC
     * Adampur / Jalandhar = AIP
     * Nanded = NDC
     * Mumbai = BOM
     * Bangalore / Bengaluru = BLR
     * Chennai = MAA
     * Hyderabad = HYD
     * Kolkata = CCU
     * Hindon = HDO
     * Kishangarh = KQH

9. CLEAN NET FARE:
   - Extract clean numeric Net Fare (e.g. 17600 from "₹17,600", 9700 from "Rs 9700.00", 20800 from "₹20,800"). Ignore timing brackets like "(08.25 AM - 02.55 AM)" or seat labels like "AS - 1".

10. Detect Baggage (e.g., "15kg", "30kg", "30 + 07 KG") and Refundability ("NON_REFUNDABLE" or "REFUNDABLE").

Return ONLY a clean valid JSON object matching this schema:
{
  "baggage": "30kg",
  "is_refundable": "NON_REFUNDABLE",
  "records": [
    {
      "origin": "DEL",
      "destination": "KWI",
      "airline_code": "J9",
      "flight_number": "",
      "travel_date": "2026-11-18",
      "net_fare": 17600
    },
    {
      "origin": "DEL",
      "destination": "KWI",
      "airline_code": "J9",
      "flight_number": "",
      "travel_date": "2026-11-25",
      "net_fare": 17600
    }
  ]
}
For date ranges or streaks, you can put the printed text in "date_text" (e.g. "01 OCT TO 05 OCT" or "20 SEP & 21 SEP") or individual dates in "travel_date".
Do NOT output duplicate text or explanation. Return JSON only.
`;

/**
 * Parse Image using OpenAI ChatGPT (GPT-4o-mini Vision)
 */
async function parseImageWithOpenAI(imageBase64, apiKey, defaults = {}) {
  if (!apiKey) {
    throw new Error('OpenAI API Key is required. Please enter your ChatGPT API Key in the settings.');
  }

  const cleanBase64 = imageBase64.includes(',') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: VISION_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all flight rate records from this flyer image. Expand all date streaks and ranges. Return valid JSON only.'
            },
            {
              type: 'image_url',
              image_url: {
                url: cleanBase64,
                detail: 'high'
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 8192,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let errJson;
    try { errJson = JSON.parse(errText); } catch (_) {}
    throw new Error(errJson?.error?.message || `OpenAI API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('No content received from ChatGPT.');
  }

  const records = buildRecordsFromModelText(rawContent, defaults);
  if (!records.length) {
    throw new Error('Image padh li gayi lekin date/fare match nahi hua. Flyer clear karke dubara scan karein.');
  }

  return {
    success: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    records,
    count: records.length,
    rawText: rawContent
  };
}

// Database persistent helpers for working Gemini models across server restarts
function getPersistedWorkingModel() {
  try {
    const database = getDb();
    if (!database) return null;
    const row = database.prepare("SELECT value FROM app_settings WHERE key = 'last_working_gemini_model'").get();
    if (row && row.value && typeof row.value === 'string' && row.value.trim()) {
      return row.value.trim();
    }
  } catch (_) {}
  return null;
}

function setPersistedWorkingModel(model) {
  if (!model) return;
  try {
    const database = getDb();
    if (!database) return;
    const clean = String(model).replace(/#plain$/, '').trim();
    database.prepare(`
      INSERT INTO app_settings (key, value, updated_at) 
      VALUES ('last_working_gemini_model', ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(clean);
  } catch (_) {}
}

// In-memory cache for discovered Gemini models and last working model
let cachedGeminiModels = null;
let cachedGeminiModelsKey = '';
let cachedGeminiModelsTime = 0;
let lastWorkingGeminiModel = null;

/**
 * Dynamically find the best active Gemini model for the user's API Key
 */
async function getGeminiCandidateModels(apiKey) {
  const fallbackModels = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ];

  if (!apiKey) return fallbackModels;

  const trimmedKey = apiKey.trim();
  // Return cached models if available (cache valid for 1 hour to prevent redundant API calls per flyer)
  if (cachedGeminiModels && cachedGeminiModelsKey === trimmedKey && (Date.now() - cachedGeminiModelsTime < 3600000)) {
    return cachedGeminiModels;
  }

  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 3500);
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${trimmedKey}`, {
      signal: abort.signal
    });
    clearTimeout(timer);

    if (listRes.ok) {
      const data = await listRes.json();
      if (Array.isArray(data.models)) {
        const available = data.models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(m => 
            !m.includes('embedding') && 
            !m.includes('aqa') && 
            !m.includes('imagen') && 
            !m.includes('bison') &&
            !m.includes('tts') &&
            !m.includes('audio') &&
            !m.includes('speech') &&
            !m.includes('realtime') &&
            !m.includes('live') &&
            !m.includes('1.5') // 1.5 family completely shut down by Google in 2025
          );

        // Rank vision-capable models: high-speed Flash models first
        const score = (name) => {
          if (name === 'gemini-3.8-flash') return 300;
          if (name === 'gemini-3.6-flash') return 290;
          if (name === 'gemini-3.5-flash') return 280;
          if (name.includes('3.8-flash')) return 270;
          if (name.includes('3.6-flash')) return 260;
          if (name.includes('3.5-flash')) return 250;
          if (name === 'gemini-2.5-flash') return 240;
          if (name.includes('2.5-flash')) return 230;
          if (name === 'gemini-3.1-flash-lite' || name.includes('3.1-flash-lite')) return 220;
          if (name.includes('flash-lite')) return 210;
          if (name === 'gemini-2.0-flash') return 200;
          if (name.includes('2.0-flash')) return 190;
          if (name.includes('flash') && !name.includes('preview') && !name.includes('exp')) return 180;
          if (name.includes('flash')) return 170;
          if (name.includes('pro')) return 80;
          return 50;
        };

        const ranked = available.sort((a, b) => score(b) - score(a));

        if (ranked.length > 0) {
          console.log(`📡 Dynamically discovered ${ranked.length} Gemini models for user key:`, ranked.slice(0, 5).join(', '));
          cachedGeminiModels = ranked;
          cachedGeminiModelsKey = trimmedKey;
          cachedGeminiModelsTime = Date.now();
          return ranked;
        }
      }
    }
  } catch (e) {
    console.warn('Could not auto-fetch Gemini models list:', e.message);
  }

  // Cache fallback models so next flyers do not block on network retry
  cachedGeminiModels = fallbackModels;
  cachedGeminiModelsKey = trimmedKey;
  cachedGeminiModelsTime = Date.now();
  return fallbackModels;
}

function isGeminiCapacityError(status, message) {
  return status === 429 || status === 503 || /high demand|try again later|unavailable|overloaded|resource exhausted|currently experiencing|quota/i.test(String(message || ''));
}

function extractCandidateText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const visible = parts.filter((p) => p && p.text && p.thought !== true).map((p) => p.text);
  if (visible.length) return visible.join('\n');
  return parts.map((p) => p && p.text).filter(Boolean).join('\n');
}

function queueSuggestedModel(models, current, message) {
  const match = String(message || '').match(/models\/(gemini-[a-z0-9.\-]+)/i);
  if (!match) return;
  const next = match[1];
  if (models.includes(next)) return;
  const at = models.indexOf(current);
  models.splice(at + 1, 0, next);
}

/**
 * Parse Image using Google Gemini Vision (Auto-discovers active models and falls back seamlessly)
 */
async function parseImageWithGemini(imageBase64, apiKey, defaults = {}, preferredModel = null) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is required. Please enter your Gemini API Key in the settings.');
  }

  const pureBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const mimeType = imageBase64.includes('data:') 
    ? imageBase64.slice(5, imageBase64.indexOf(';'))
    : 'image/jpeg';

  const dbModel = getPersistedWorkingModel();
  const topPriority = preferredModel || lastWorkingGeminiModel || dbModel;

  // Ultra-fast prioritized models: start with topPriority or fast flash models directly without blocking on GET /models
  const defaultModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite'
  ];

  let models;
  if (topPriority) {
    const cleanPriority = String(topPriority).replace(/#plain$/, '');
    models = [cleanPriority, ...defaultModels.filter(m => m !== cleanPriority)];
  } else if (cachedGeminiModels && cachedGeminiModels.length > 0) {
    models = [...cachedGeminiModels];
  } else {
    models = [...defaultModels];
  }

  let lastError = null;
  const startedAt = Date.now();

  for (const model of models) {
    if (Date.now() - startedAt > 30000) break;
    const plain = String(model).endsWith('#plain');
    const modelId = plain ? String(model).slice(0, -6) : model;
    const abort = new AbortController();
    // Fast failover: Healthy Flash models respond in 1-2.5s.
    // Abort hung or rate-limited models after 6s instead of 12s so user never waits.
    const abortTimer = setTimeout(() => abort.abort(), 6000);
    try {
      console.log(`🚀 Scanning flyer with Gemini model: ${modelId}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey.trim()}`;

      const genConfig = {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 4096
      };

      // Turn off / minimize thinking tokens to ensure sub-2-second OCR response
      if (!plain) {
        if (modelId.includes('2.5')) {
          genConfig.thinkingConfig = { thinkingBudget: 0 };
        } else if (modelId.includes('3.') || modelId.includes('thinking')) {
          genConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' };
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        signal: abort.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: VISION_SYSTEM_PROMPT },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: pureBase64
                  }
                }
              ]
            }
          ],
          generationConfig: genConfig
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let errJson;
        try { errJson = JSON.parse(errText); } catch (_) {}
        const msg = errJson?.error?.message || `Gemini API Error (${response.status}): ${errText}`;
        lastError = new Error(msg);
        queueSuggestedModel(models, model, msg);
        const queuePlain = /thinking/i.test(msg) && !plain && !models.includes(`${modelId}#plain`);
        if (queuePlain) {
          models.splice(models.indexOf(model) + 1, 0, `${modelId}#plain`);
        }
        console.warn(`❌ Model ${modelId} returned (${response.status}): ${msg}`);
        console.log(`🔄 Switching to next Gemini candidate model...`);
        continue;
      }

      const data = await response.json();
      const rawText = extractCandidateText(data);
      if (!rawText) {
        const block = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'empty';
        lastError = new Error(`Gemini ne koi fare text nahi bheja (${block}).`);
        console.warn(`⚠️ No candidate text returned for ${model}: ${block}`);
        continue;
      }

      const records = buildRecordsFromModelText(rawText, defaults);
      if (!records.length) {
        lastError = new Error('Gemini ne image padhi lekin date/fare match nahi hua.');
        console.warn(`⚠️ No records parsed from ${model} output, trying next model...`);
        continue;
      }

      console.log(`✅ Successfully extracted ${records.length} records using Gemini model: ${model}`);
      lastWorkingGeminiModel = model; // In-memory cache
      setPersistedWorkingModel(model); // SQLite persistent storage across server restarts

      return {
        success: true,
        provider: 'gemini',
        model,
        records,
        count: records.length,
        rawText
      };
    } catch (err) {
      const timedOut = err && (err.name === 'AbortError' || String(err.message || '').includes('aborted'));
      lastError = timedOut
        ? new Error('Gemini response timeout: Is flyer mein cards/dates zyada hain aur response aane mein time laga. Kripya dobara scan button dabayein.')
        : err;
      console.warn(`❌ Exception with model ${model}:`, err.message);
      continue;
    } finally {
      clearTimeout(abortTimer);
    }
  }

  throw lastError || new Error('Failed to query Gemini models.');
}

module.exports = {
  parseImageWithOpenAI,
  parseImageWithGemini,
  buildRecordsFromModelText,
  expandTravelDates
};
