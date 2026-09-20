/**
 * Smart WhatsApp and Text Message Parser for Airline Special Fares
 */

// Common month mapping
const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

// Known popular IATA airline codes
const KNOWN_AIRLINES = [
  'AI', '6E', 'IX', 'SG', 'UK', 'QP', 'S5', 'IC', '9I',
  'EK', 'FZ', 'G9', 'EY', 'QR', 'WY', 'OV', 'SV', 'XY', 'F3', 'KU', 'J9', 'GF', 'MS', 'W5',
  'UL', 'BG', 'BS', 'RA', 'H9', 'KB', 'RQ',
  'SQ', 'MH', 'OD', 'AK', 'TG', 'SL', 'VJ', 'VN', 'CX', 'GA', 'NH', 'JL', 'KE',
  'KC', 'HY',
  'BA', 'VS', 'LH', 'AF', 'KL', 'LX', 'TK', 'AZ', 'LO', 'AY', 'OS', 'SK',
  'AC', 'UA', 'AA', 'DL', 'QF',
  'ET', 'KQ'
];

// Known airport codes for quick detection
const KNOWN_AIRPORTS = ['ATQ', 'DXB', 'SHJ', 'AIP', 'NDC', 'IXC', 'HDO', 'KQH', 'JAI', 'GOI', 'DOH', 'KWI', 'SIN', 'KUL', 'DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'LHR', 'BKK', 'JED', 'MED', 'RUH', 'DMM', 'MCT', 'AUH', 'CMB', 'KTM', 'DAC'];

// City name to airport code mapping
const CITY_TO_IATA = {
  adampur: 'AIP',
  aip: 'AIP',
  nanded: 'NDC',
  ndc: 'NDC',
  chandigarh: 'IXC',
  ixc: 'IXC',
  hindon: 'HDO',
  hdo: 'HDO',
  kishangarh: 'KQH',
  kqh: 'KQH',
  jaipur: 'JAI',
  jai: 'JAI',
  goa: 'GOI',
  amritsar: 'ATQ',
  dubai: 'DXB',
  sharjah: 'SHJ',
  delhi: 'DEL',
  mumbai: 'BOM',
  bangalore: 'BLR',
  chennai: 'MAA',
  hyderabad: 'HYD',
  kolkata: 'CCU',
  doha: 'DOH',
  kuwait: 'KWI',
  singapore: 'SIN',
  kuala: 'KUL',
  bangkok: 'BKK',
  london: 'LHR',
  jeddah: 'JED',
  medina: 'MED',
  riyadh: 'RUH',
  dammam: 'DMM',
  muscat: 'MCT',
  abudhabi: 'AUH',
  colombo: 'CMB',
  kathmandu: 'KTM',
  dhaka: 'DAC',
  milan: 'MXP',
  millan: 'MXP',
  malpensa: 'MXP',
  mil: 'MXP',
  rome: 'ROM',
  fco: 'ROM',
  toronto: 'YYZ'
};

// Airline names to code mapping
const AIRLINE_NAME_MAP = [
  { name: 'air india express', code: 'IX' },
  { name: 'air india exp', code: 'IX' },
  { name: 'airindia express', code: 'IX' },
  { name: 'airindia exp', code: 'IX' },
  { name: 'arindia biprozs', code: 'IX' },
  { name: 'alina express', code: 'IX' },
  { name: 'air india', code: 'AI' },
  { name: 'airindia', code: 'AI' },
  { name: 'indigo', code: '6E' },
  { name: 'spicejet', code: 'SG' },
  { name: 'spicojot', code: 'SG' },
  { name: 'spico jet', code: 'SG' },
  { name: 'spice jet', code: 'SG' },
  { name: 'spice', code: 'SG' },
  { name: 'air arabia', code: 'G9' },
  { name: 'flydubai', code: 'FZ' },
  { name: 'fly dubai', code: 'FZ' },
  { name: 'emirates', code: 'EK' },
  { name: 'etihad', code: 'EY' },
  { name: 'qatar airways', code: 'QR' },
  { name: 'qatar', code: 'QR' },
  { name: 'oman air', code: 'WY' },
  { name: 'salamair', code: 'OV' },
  { name: 'saudia', code: 'SV' },
  { name: 'saudi arabian', code: 'SV' },
  { name: 'flynas', code: 'XY' },
  { name: 'flyadeal', code: 'F3' },
  { name: 'kuwait airways', code: 'KU' },
  { name: 'jazeera', code: 'J9' },
  { name: 'gulf air', code: 'GF' },
  { name: 'srilankan', code: 'UL' },
  { name: 'biman', code: 'BG' },
  { name: 'us-bangla', code: 'BS' },
  { name: 'nepal airlines', code: 'RA' },
  { name: 'himalaya', code: 'H9' },
  { name: 'singapore airlines', code: 'SQ' },
  { name: 'malaysia airlines', code: 'MH' },
  { name: 'batik air', code: 'OD' },
  { name: 'airasia', code: 'AK' },
  { name: 'thai airways', code: 'TG' },
  { name: 'thai lion', code: 'SL' },
  { name: 'vietjet', code: 'VJ' },
  { name: 'vietnam airlines', code: 'VN' },
  { name: 'cathay pacific', code: 'CX' },
  { name: 'british airways', code: 'BA' },
  { name: 'virgin atlantic', code: 'VS' },
  { name: 'lufthansa', code: 'LH' },
  { name: 'air france', code: 'AF' },
  { name: 'klm', code: 'KL' },
  { name: 'turkish airlines', code: 'TK' },
  { name: 'vistara', code: 'UK' },
  { name: 'akasa', code: 'QP' },
  { name: 'star air', code: 'S5' },
  { name: 'fly91', code: 'IC' }
];

/**
 * Standardize date string into YYYY-MM-DD format
 * Supports:
 * - "15 Sep", "15-Sep", "15SEP", "15 September"
 * - "15/09", "15-09", "15/09/2026", "15-09-2026"
 * - "2026-09-15"
 */
function parseDateString(rawDate, defaultYear = new Date().getFullYear()) {
  if (!rawDate) return null;
  const clean = rawDate.trim().replace(/\s+/g, ' ');

  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const yr = Number(clean.slice(0, 4));
    if (yr < defaultYear) {
      return `${defaultYear}${clean.slice(4)}`;
    }
    return clean;
  }

  // Format: 15-09-2026 or 15/09/26 or 15-09-26
  let match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    if (Number(year) < defaultYear) year = String(defaultYear);
    return `${year}-${month}-${day}`;
  }

  // Format: 15/09 or 15-09 (without year)
  match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    return `${defaultYear}-${month}-${day}`;
  }

  // Format: 15 Sep 2026, 15-Sep-2026, 15SEP26, 15 SEP 26
  match = clean.match(/^(\d{1,2})[\s\-]?([a-zA-Z]{3,9})[\s\-]?(\d{2,4})?$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monStr = match[2].toLowerCase().substring(0, 3);
    const month = MONTH_MAP[monStr];
    let year = match[3];
    if (year && year.length === 2) {
      year = `20${year}`;
    } else if (!year) {
      year = defaultYear;
    }
    if (Number(year) < defaultYear) year = String(defaultYear);
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Parses raw text copied from WhatsApp or agent desks
 * @param {string} text 
 * @param {object} defaults - fallback airline, origin, destination, vendorId
 * @returns {{ records: Array, detectedHeader: object, rawCount: number }}
 */
function parseWhatsAppFareText(text, defaults = {}) {
  if (!text || typeof text !== 'string') {
    return { records: [], detectedHeader: {}, rawCount: 0 };
  }

  const fallbackAirline = defaults.airline || defaults.defaultAirline || '';
  const fallbackOrigin = defaults.origin || defaults.defaultOrigin || '';
  const fallbackDestination = defaults.destination || defaults.defaultDestination || '';
  const fallbackBaggage = defaults.baggage || defaults.defaultBaggage || '30kg';
  const fallbackRefundable = defaults.is_refundable || defaults.defaultRefundable || 'NON_REFUNDABLE';

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const detectedHeader = {
    airline: '',
    origin: '',
    destination: '',
    baggage: fallbackBaggage,
    is_refundable: fallbackRefundable,
    flight_number: defaults.flight_number || ''
  };

  const records = [];
  const currentYear = new Date().getFullYear();

  // Dynamic context for multi-section flyers (e.g., AMRITSAR DUBAI then AMRITSAR SHARJAH)
  let activeAirline = fallbackAirline;
  let activeOrigin = fallbackOrigin;
  let activeDestination = fallbackDestination;
  let activeBaggage = fallbackBaggage;
  let activeRefundable = fallbackRefundable;
  let activeFlightNo = defaults.flight_number || '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();
    const lowerLine = line.toLowerCase();

    // 1. Check if line has global baggage info
    const bagMatch = line.match(/(\d{1,2}\s*(?:\+\s*\d{1,2}\s*)?(?:KG|KGS))/i);
    if (bagMatch) {
      activeBaggage = bagMatch[1].replace(/\s+/g, '').toUpperCase();
      if (!detectedHeader.baggage) detectedHeader.baggage = activeBaggage;
    }

    // 2. Check if line has refundability
    if (upperLine.includes('NON-REFUNDABLE') || upperLine.includes('NON REFUNDABLE') || upperLine.includes('NON REF') || upperLine.includes('NON-REF')) {
      activeRefundable = 'NON_REFUNDABLE';
      if (!detectedHeader.is_refundable) detectedHeader.is_refundable = 'NON_REFUNDABLE';
    } else if (upperLine.includes('REFUNDABLE') && !upperLine.includes('NON')) {
      activeRefundable = 'REFUNDABLE';
      if (!detectedHeader.is_refundable) detectedHeader.is_refundable = 'REFUNDABLE';
    }

    // 3. Detect Section Header (Airline and/or Sector names)
    let foundAirline = null;
    let foundOrig = null;
    let foundDest = null;

    // 3A. Combined Airline Code + Route Header e.g. "SG ATQ → DXB", "IX ATQ > SHJ", "6E ATQ -> DXB", "AI ATQ - DXB"
    const directHeaderMatch = upperLine.match(/\b([A-Z0-9]{2})\s+([A-Z]{3})\s*(?:[-–—/]|TO|->|-->|–>|—>|>|→|➔|➜|\s+)\s*([A-Z]{3})\b/);
    if (directHeaderMatch && KNOWN_AIRLINES.includes(directHeaderMatch[1])) {
      foundAirline = directHeaderMatch[1];
      foundOrig = directHeaderMatch[2];
      foundDest = directHeaderMatch[3];
    } else {
      // 3B. Airline Word Name + Route Header e.g. "Spicejet ATQ → DXB", "Air India Express ATQ to DXB"
      const wordHeaderMatch = upperLine.match(/\b([A-Z\s]{3,25})\s+([A-Z]{3})\s*(?:[-–—/]|TO|->|-->|–>|—>|>|→|➔|➜|\s+)\s*([A-Z]{3})\b/);
      if (wordHeaderMatch) {
        const potentialAirName = wordHeaderMatch[1].trim().toLowerCase();
        for (const a of AIRLINE_NAME_MAP) {
          if (potentialAirName === a.name || potentialAirName.includes(a.name)) {
            foundAirline = a.code;
            foundOrig = wordHeaderMatch[2];
            foundDest = wordHeaderMatch[3];
            break;
          }
        }
      }
    }

    if (!foundAirline) {
      for (const a of AIRLINE_NAME_MAP) {
        if (lowerLine.includes(a.name)) {
          foundAirline = a.code;
          break;
        }
      }
    }
    if (!foundAirline) {
      for (const code of KNOWN_AIRLINES) {
        if (new RegExp(`\\b${code}\\b`, 'i').test(line)) {
          foundAirline = code;
          break;
        }
      }
    }

    if (!foundOrig || !foundDest) {
      // Check IATA pair like ATQ-DXB, ATQ TO DXB, ATQ DXB, ATQ → DXB, ATQ > SHJ, ATQ -> DXB
      const iataRouteMatch = upperLine.match(/\b([A-Z]{3})\s*(?:[-–—/]|TO|->|-->|–>|—>|>|→|➔|➜|\s+)\s*([A-Z]{3})\b/);
      if (iataRouteMatch && (KNOWN_AIRPORTS.includes(iataRouteMatch[1]) || KNOWN_AIRPORTS.includes(iataRouteMatch[2]))) {
        foundOrig = iataRouteMatch[1];
        foundDest = iataRouteMatch[2];
      } else {
        // Check full city names
        const matchedCities = [];
        for (const [cityName, iata] of Object.entries(CITY_TO_IATA)) {
          const idx = lowerLine.indexOf(cityName);
          if (idx !== -1) {
            matchedCities.push({ name: cityName, iata, idx });
          }
        }
        matchedCities.sort((a, b) => a.idx - b.idx);
        if (matchedCities.length >= 2) {
          foundOrig = matchedCities[0].iata;
          foundDest = matchedCities[1].iata;
        }
      }
    }

    // Check Flight Number (e.g. AI 929, 6E 1451, IX 191, or standalone 191/137)
    const flightMatch = upperLine.match(/\b([A-Z0-9]{2})\s*[-]?\s*(\d{3,4})\b/);
    if (flightMatch && KNOWN_AIRLINES.includes(flightMatch[1])) {
      activeFlightNo = `${flightMatch[1]} ${flightMatch[2]}`;
      if (['191', '192', '137', '138'].includes(flightMatch[2]) && flightMatch[1] === 'AI') {
        activeAirline = 'IX';
        activeFlightNo = `IX ${flightMatch[2]}`;
      }
    } else {
      const standaloneFltMatch = upperLine.match(/\b(?:FLIGHT|FLT|NO\.?|#)?\s*(191|192|137|138)\b/i);
      if (standaloneFltMatch) {
        activeFlightNo = `IX ${standaloneFltMatch[1]}`;
        if (!foundAirline && !activeAirline) {
          activeAirline = 'IX';
        }
      }
    }

    // If this line is a section header (contains airline and/or route, and no date/fare)
    const hasNumbersOnlyDateOrFare = /\b\d{4,5}\b/.test(line);
    if ((foundAirline || (foundOrig && foundDest)) && !hasNumbersOnlyDateOrFare) {
      if (foundAirline) {
        activeAirline = foundAirline;
        if (!detectedHeader.airline) detectedHeader.airline = foundAirline;
      }
      if (foundOrig && foundDest) {
        activeOrigin = foundOrig;
        activeDestination = foundDest;
        if (!detectedHeader.origin) detectedHeader.origin = foundOrig;
        if (!detectedHeader.destination) detectedHeader.destination = foundDest;
      }
      continue;
    }

    // Skip table column headers e.g. "DATES FARE TIMINGS"
    if (lowerLine.includes('dates') && (lowerLine.includes('fare') || lowerLine.includes('timings') || lowerLine.includes('sector'))) {
      continue;
    }

    // Skip purely promotional lines
    if (lowerLine.includes('special fare') || lowerLine.includes('limited seat') || lowerLine.includes('best rate') || lowerLine.includes('otb free')) {
      continue;
    }

    // 3.5 Check Structured CSV / Tab / Comma List Line (e.g., "2026-10-25, ATQ, SHJ, 6E, 17000")
    const delimiterParts = line.split(/[,\t|]+/).map(p => p.trim()).filter(Boolean);
    if (delimiterParts.length >= 2) {
      let d = null;
      let fare = null;
      let orig = null;
      let dest = null;
      let airline = null;
      let flightNo = '';

      for (const part of delimiterParts) {
        const cleanP = part.replace(/^['"]|['"]$/g, '').trim();
        const parsedD = parseDateString(cleanP, currentYear);
        if (parsedD && !d) {
          d = parsedD;
          continue;
        }

        const numVal = parseFloat(cleanP.replace(/[^0-9.]/g, ''));
        if (!isNaN(numVal) && numVal >= 1000 && !fare && (!d || !d.startsWith(String(Math.floor(numVal))))) {
          fare = numVal;
          continue;
        }

        const upperP = cleanP.toUpperCase();
        if (KNOWN_AIRLINES.includes(upperP) && !airline) {
          airline = upperP;
          continue;
        }

        if (KNOWN_AIRPORTS.includes(upperP)) {
          if (!orig) orig = upperP;
          else if (!dest) dest = upperP;
          continue;
        }

        if (/^[A-Z0-9]{2}\s*\d{3,4}$/i.test(upperP)) {
          flightNo = upperP;
          continue;
        }
      }

      if (d && fare) {
        records.push({
          airline_code: airline || activeAirline || defaults.airline || 'AI',
          origin: orig || activeOrigin || defaults.origin || 'ATQ',
          destination: dest || activeDestination || defaults.destination || 'DXB',
          travel_date: d,
          flight_number: flightNo || activeFlightNo,
          net_fare: fare,
          currency: 'INR',
          cabin: 'ECONOMY',
          baggage: activeBaggage,
          is_refundable: activeRefundable,
          remarks: 'Structured CSV parsed',
          original_text: line
        });
        continue;
      }
    }

    // 4. Parse Date + Fare Rows
    // Remove bracketed timings, clean currency suffixes like "/-" or "/=" and OCR noise prefixes like -X19,500
    const lineWithoutTiming = line
      .replace(/\(\s*\d{1,2}[\.:]\d{2}\s*(?:AM|PM)?\s*[-–]\s*\d{1,2}[\.:]\d{2}\s*(?:AM|PM)?\s*\)/gi, ' ')
      .replace(/\/\s*[-=]/g, ' ')
      .replace(/\/\s*$/g, ' ')
      .replace(/(^|[^a-zA-Z0-9])(?:INR|RS\.?|₹|[Xx¥$€])\s*(?=\d)/gi, '$1 ');

    // Extract Fare amount: looking for 4-5 digit number >= 1000
    // Make sure we do not match the year (e.g. 2025/2026) in a date!
    const fareMatches = [...lineWithoutTiming.matchAll(/(?:(?:INR|RS\.?|₹|[Xx¥$€])\s*)?\b([1-9]\d{0,2}[,.]?\d{3})\b/gi)];
    if (!fareMatches || fareMatches.length === 0) continue;

    let fareMatch = null;
    let fareAmount = null;

    // Pick from the end of the line backwards
    for (let m = fareMatches.length - 1; m >= 0; m--) {
      const match = fareMatches[m];
      const matchIdx = match.index;
      const charBefore = lineWithoutTiming[matchIdx - 1] || ' ';
      const charAfter = lineWithoutTiming[matchIdx + match[0].length] || ' ';

      // Don't treat as date separator if followed by end of word, currency, or whitespace
      if ((charBefore === '-' && /[0-9]/.test(lineWithoutTiming[matchIdx - 2] || '')) ||
          (charBefore === '/' && /[0-9]/.test(lineWithoutTiming[matchIdx - 2] || '')) ||
          (charAfter === '-' && /[0-9]/.test(lineWithoutTiming[matchIdx + match[0].length + 1] || '')) ||
          (charAfter === '/' && /[0-9]/.test(lineWithoutTiming[matchIdx + match[0].length + 1] || ''))) {
        continue;
      }

      const rawNum = match[1].replace(/[,.]/g, '');
      const parsedNum = parseFloat(rawNum);
      if (!isNaN(parsedNum) && parsedNum >= 1000) {
        fareMatch = match;
        fareAmount = parsedNum;
        break;
      }
    }

    if (!fareMatch || !fareAmount) continue;

    // Everything before the fare is our dates definition
    const farePos = lineWithoutTiming.indexOf(fareMatch[0]);
    const textBeforeFare = lineWithoutTiming.slice(0, farePos).trim();

    // CASE A: Date Range with "TO" e.g. "23 SEP TO 02 OCT (ALL DATES)" or "15 SEP TO 30 SEP"
    const rangeRegex = /(\d{1,2}[\s\-\/](?:[a-zA-Z]{3,9}|\d{1,2}))\s*(?:TO|THRU|TILL|UNTIL|[-–—]|->|-->|–>|—>|>|→|➔|➜)\s*(\d{1,2}[\s\-\/](?:[a-zA-Z]{3,9}|\d{1,2})(?:[\s\-\/]\d{2,4})?)/i;
    const rangeMatch = textBeforeFare.match(rangeRegex);

    if (rangeMatch) {
      const sDate = parseDateString(rangeMatch[1], currentYear);
      const eDate = parseDateString(rangeMatch[2], currentYear);
      if (sDate && eDate) {
        const sObj = new Date(sDate);
        const eObj = new Date(eDate);
        if (!isNaN(sObj.getTime()) && !isNaN(eObj.getTime()) && sObj <= eObj) {
          let curr = new Date(sObj);
          while (curr <= eObj) {
            records.push({
              airline_code: activeAirline || fallbackAirline || 'AI',
              origin: activeOrigin || fallbackOrigin || 'ATQ',
              destination: activeDestination || fallbackDestination || 'DXB',
              travel_date: curr.toISOString().slice(0, 10),
              flight_number: activeFlightNo,
              net_fare: fareAmount,
              currency: 'INR',
              cabin: 'ECONOMY',
              baggage: activeBaggage,
              is_refundable: activeRefundable,
              remarks: `Flyer Range: ${rangeMatch[0]}`,
              original_text: line
            });
            curr.setDate(curr.getDate() + 1);
          }
          continue;
        }
      }
    }

    // CASE B: Multiple dates on one line separated by "&" or ","
    // e.g. "15 SEP & 16 SEP & 17 SEP & 18 SEP" or "19 SEP & 20 SEP" or "14 SEP"
    const dateChunks = textBeforeFare.split(/\s*&\s*|\s*,\s*|\s*\+\s*/);
    let matchedInChunk = false;

    for (const chunk of dateChunks) {
      const cleanChunk = chunk.replace(/[\(\)]/g, '').trim();
      const pDate = parseDateString(cleanChunk, currentYear);
      if (pDate) {
        matchedInChunk = true;
        records.push({
          airline_code: activeAirline || fallbackAirline || 'AI',
          origin: activeOrigin || fallbackOrigin || 'ATQ',
          destination: activeDestination || fallbackDestination || 'DXB',
          travel_date: pDate,
          flight_number: activeFlightNo,
          net_fare: fareAmount,
          currency: 'INR',
          cabin: 'ECONOMY',
          baggage: activeBaggage,
          is_refundable: activeRefundable,
          remarks: 'Flyer Date',
          original_text: line
        });
      }
    }

    if (matchedInChunk) continue;

    // CASE C: Fallback single date regex
    const fallbackMatch = textBeforeFare.match(/(\d{1,2}[\s\-\/](?:[a-zA-Z]{3,9}|\d{1,2})(?:[\s\-\/]\d{2,4})?)/);
    if (fallbackMatch) {
      const pDate = parseDateString(fallbackMatch[1], currentYear);
      if (pDate) {
        records.push({
          airline_code: activeAirline || fallbackAirline || 'AI',
          origin: activeOrigin || fallbackOrigin || 'ATQ',
          destination: activeDestination || fallbackDestination || 'DXB',
          travel_date: pDate,
          flight_number: activeFlightNo,
          net_fare: fareAmount,
          currency: 'INR',
          cabin: 'ECONOMY',
          baggage: activeBaggage,
          is_refundable: activeRefundable,
          remarks: 'Parsed date',
          original_text: line
        });
      }
    }
  }

  // Update detectedHeader defaults if empty
  if (!detectedHeader.airline) detectedHeader.airline = activeAirline || fallbackAirline || 'AI';
  if (!detectedHeader.origin) detectedHeader.origin = activeOrigin || fallbackOrigin || 'ATQ';
  if (!detectedHeader.destination) detectedHeader.destination = activeDestination || fallbackDestination || 'DXB';

  return {
    detectedHeader,
    records,
    rawCount: records.length
  };
}

module.exports = {
  parseWhatsAppFareText,
  parseDateString
};
