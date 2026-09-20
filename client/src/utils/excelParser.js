import * as XLSX from 'xlsx';
import { api } from './api';

/**
 * Common City / Airport Name to 3-Letter IATA Code Mapping
 */
export const AIRPORT_MAP = {
  // India
  amritsar: 'ATQ',
  atq: 'ATQ',
  delhi: 'DEL',
  'new delhi': 'DEL',
  del: 'DEL',
  mumbai: 'BOM',
  bombay: 'BOM',
  bom: 'BOM',
  bangalore: 'BLR',
  bengaluru: 'BLR',
  blr: 'BLR',
  hyderabad: 'HYD',
  hyd: 'HYD',
  chennai: 'MAA',
  madras: 'MAA',
  maa: 'MAA',
  kolkata: 'CCU',
  calcutta: 'CCU',
  ccu: 'CCU',
  kochi: 'COK',
  cochin: 'COK',
  cok: 'COK',
  ahmedabad: 'AMD',
  amd: 'AMD',
  goa: 'GOI',
  goi: 'GOI',
  jaipur: 'JAI',
  jai: 'JAI',
  lucknow: 'LKO',
  lko: 'LKO',
  chandigarh: 'IXC',
  ixc: 'IXC',
  trivandrum: 'TRV',
  trv: 'TRV',

  // Middle East / Gulf
  dubai: 'DXB',
  dxb: 'DXB',
  sharjah: 'SHJ',
  shj: 'SHJ',
  'abu dhabi': 'AUH',
  abudhabi: 'AUH',
  auh: 'AUH',
  dwc: 'DWC',
  doha: 'DOH',
  doh: 'DOH',
  jeddah: 'JED',
  jed: 'JED',
  riyadh: 'RUH',
  ruh: 'RUH',
  dammam: 'DMM',
  dmm: 'DMM',
  medina: 'MED',
  madinah: 'MED',
  med: 'MED',
  muscat: 'MCT',
  mct: 'MCT',
  kuwait: 'KWI',
  kwi: 'KWI',
  bahrain: 'BAH',
  bah: 'BAH',

  // International
  colombo: 'CMB',
  cmb: 'CMB',
  bangkok: 'BKK',
  bkk: 'BKK',
  phuket: 'HKT',
  hkt: 'HKT',
  singapore: 'SIN',
  sin: 'SIN',
  'kuala lumpur': 'KUL',
  kul: 'KUL',
  london: 'LHR',
  heathrow: 'LHR',
  lhr: 'LHR',
  gatwick: 'LGW',
  lgw: 'LGW',
  toronto: 'YYZ',
  yyz: 'YYZ',
  milan: 'MXP',
  millan: 'MXP',
  malpensa: 'MXP',
  mxp: 'MXP',
  mil: 'MXP',
  rome: 'ROM',
  fco: 'ROM',
  rom: 'ROM',

  // Regional Indian Airports
  adampur: 'AIP',
  aip: 'AIP',
  nanded: 'NDC',
  ndc: 'NDC',
  hindon: 'HDO',
  hdo: 'HDO',
  kishangarh: 'KQH',
  kqh: 'KQH'
};

/**
 * Common Airline Name to 2-Letter IATA Code Mapping
 */
export const AIRLINE_MAP = {
  s5: 'S5',
  'star air': 'S5',
  starair: 'S5',
  star: 'S5',
  ic: 'IC',
  fly91: 'IC',
  '9i': '9I',
  'alliance air': '9I',
  ai: 'AI',
  'air india': 'AI',
  airindia: 'AI',
  '6e': '6E',
  indigo: '6E',
  ix: 'IX',
  'air india express': 'IX',
  'airindia express': 'IX',
  express: 'IX',
  sg: 'SG',
  spicejet: 'SG',
  'spice jet': 'SG',
  spice: 'SG',
  uk: 'UK',
  vistara: 'UK',
  g9: 'G9',
  'air arabia': 'G9',
  airarabia: 'G9',
  fz: 'FZ',
  flydubai: 'FZ',
  'fly dubai': 'FZ',
  ek: 'EK',
  emirates: 'EK',
  wy: 'WY',
  'oman air': 'WY',
  omanair: 'WY',
  qr: 'QR',
  'qatar airways': 'QR',
  qatar: 'QR',
  sv: 'SV',
  saudia: 'SV',
  'saudi airlines': 'SV',
  ku: 'KU',
  'kuwait airways': 'KU',
  gf: 'GF',
  'gulf air': 'GF',
  ey: 'EY',
  etihad: 'EY',
  qp: 'QP',
  akasa: 'QP',
  'akasa air': 'QP'
};

/**
 * Normalizes airport / city code to 3-letter uppercase IATA
 */
export function normalizeAirport(str) {
  if (!str) return '';
  const clean = String(str).trim().toLowerCase();
  if (AIRPORT_MAP[clean]) {
    return AIRPORT_MAP[clean];
  }
  const codeMatch = clean.match(/^[a-z]{3}$/i);
  if (codeMatch) {
    return codeMatch[0].toUpperCase();
  }
  return '';
}

/**
 * Parses Sector string (e.g. "ATQ-DXB", "ATQ/DXB", "ATQ to DXB", "Amritsar - Dubai")
 */
export function parseSector(str) {
  if (!str) return { origin: '', destination: '' };
  const s = String(str).trim();

  const parts = s.split(/[\-\/\_\>\➔\➜\→]|->|–>|—>|\s+to\s+|\s+TO\s+|\s+\-\s+/i).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const origin = normalizeAirport(parts[0]);
    const destination = normalizeAirport(parts[1]);
    if (origin && destination) {
      return { origin, destination };
    }
  }

  return { origin: '', destination: '' };
}

/**
 * Normalizes airline name/code, with fallback to flight number prefix
 */
export function normalizeAirline(airStr, fltStr) {
  if (airStr) {
    const cleanAir = String(airStr).trim().toLowerCase();
    if (AIRLINE_MAP[cleanAir]) {
      return AIRLINE_MAP[cleanAir];
    }
    const match2Letter = cleanAir.match(/^[a-z0-9]{2}$/i);
    if (match2Letter && AIRLINE_MAP[cleanAir]) {
      return AIRLINE_MAP[cleanAir];
    }
    if (match2Letter) {
      return match2Letter[0].toUpperCase();
    }
    for (const [name, code] of Object.entries(AIRLINE_MAP)) {
      if (cleanAir.startsWith(name)) {
        return code;
      }
    }
  }

  // Fallback: extract from flight number / flight column (e.g. "Spicejet", "AI 929", "6E-1451", "G9 464", "191", "137")
  if (fltStr) {
    const cleanFlt = String(fltStr).trim().toLowerCase();
    if (AIRLINE_MAP[cleanFlt]) {
      return AIRLINE_MAP[cleanFlt];
    }

    // Specific flight numbers for Air India Express (191, 192, 137, 138)
    const numOnly = cleanFlt.replace(/[^0-9]/g, '');
    if (['191', '192', '137', '138'].includes(numOnly) || /^(ix|aix)[\s\-_]?(191|192|137|138)$/i.test(cleanFlt)) {
      return 'IX';
    }

    const match2Letter = cleanFlt.match(/^[a-z0-9]{2}$/i);
    if (match2Letter && AIRLINE_MAP[cleanFlt]) {
      return AIRLINE_MAP[cleanFlt];
    }
    if (match2Letter) {
      return match2Letter[0].toUpperCase();
    }
    for (const [name, code] of Object.entries(AIRLINE_MAP)) {
      if (cleanFlt.startsWith(name)) {
        return code;
      }
    }
    const fltMatch = String(fltStr).trim().match(/^([a-zA-Z]{1,2}|[a-zA-Z][0-9]|[0-9][a-zA-Z])[\s\-_]?\d+/);
    if (fltMatch) {
      const code = fltMatch[1].toUpperCase();
      return AIRLINE_MAP[code.toLowerCase()] || code;
    }
  }

  return '';
}

/**
 * Normalizes any date input (JS Date, Excel Serial, string) into YYYY-MM-DD
 */
export function normalizeExcelDate(val) {
  if (!val) return '';

  // 1. If it's already a JS Date object - use local date parts to prevent timezone shift
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. If it's an Excel numeric serial date (e.g. 45550)
  if (typeof val === 'number' || (!isNaN(val) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (num > 30000 && num < 60000) {
      // Excel epoch starts at 1899-12-30 (25569 days between 1900-01-01 and 1970-01-01)
      const date = new Date((num - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  const str = String(val).trim();

  // 3. Match YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD (e.g. 2026/09/12)
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 4. Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 5. Match DD-MMM-YYYY or DD MMM (e.g. 15-Sep-2026, 15 Sep 2026, 15 Sep)
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const mmmMatch = str.match(/^(\d{1,2})[\s\-\/\.]([a-zA-Z]{3,9})(?:[\s\-\/\.](\d{2,4}))?$/);
  if (mmmMatch) {
    const day = mmmMatch[1].padStart(2, '0');
    const monKey = mmmMatch[2].slice(0, 3).toLowerCase();
    const month = months[monKey];
    let year = mmmMatch[3];
    if (!year) year = new Date().getFullYear();
    else if (year.length === 2) year = `20${year}`;
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // 6. Try standard Date.parse with local parts
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

/**
 * Normalizes fare / rate numbers by stripping currency symbols, commas, etc.
 */
export function normalizeExcelFare(val) {
  if (typeof val === 'number') return val > 0 ? val : 0;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d\.]/g, '');
  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0 ? Math.round(num) : 0;
}

/**
 * Detects if an Excel worksheet is formatted as vertical text / block lists
 * such as Kandhari rate lists (e.g. "SG ATQ → DXB" header followed by "17 SEP - ₹19,500/-")
 */
export function detectBlockOrTextFormat(rows2D) {
  if (!rows2D || rows2D.length === 0) return false;

  const routeRegex = /(?:→|➔|➜|->|–>|—>|>|to|-)\s*[A-Z]{3}|[A-Z]{3}\s*(?:→|➔|➜|->|–>|—>|>|to|-)\s*[A-Z]{3}/i;
  const dateFareRegex = /\b\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b.*?(?:₹|rs|inr|\b)?\s*[\d,]+/i;

  let hasRouteHeader = false;
  let hasDateFareLine = false;

  for (let r = 0; r < Math.min(rows2D.length, 40); r++) {
    const rowStr = (rows2D[r] || []).join(' ');
    if (routeRegex.test(rowStr)) hasRouteHeader = true;
    if (dateFareRegex.test(rowStr)) hasDateFareLine = true;
    if (hasRouteHeader && hasDateFareLine) return true;
  }

  const firstRowStr = (rows2D[0] || []).join(' ');
  if (routeRegex.test(firstRowStr)) return true;

  return false;
}

/**
 * Pure client-side regex parser for Kandhari rate lists
 * Parses lines like "SG ATQ → DXB" and "17 SEP - ₹19,500/-"
 */
export function parseKandhariTextLocally(rawText, defaultOptions = {}) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const records = [];

  let currentAirline = defaultOptions.defaultAirline || 'AI';
  let currentOrigin = defaultOptions.defaultOrigin || 'ATQ';
  let currentDestination = defaultOptions.defaultDestination || 'DXB';
  let currentFlightNo = '';

  const MONTHS = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  const AIRLINE_CODES = {
    spicejet: 'SG', 'spice jet': 'SG', spice: 'SG', sg: 'SG',
    'air india express': 'IX', 'airindia express': 'IX', 'airindia exp': 'IX', ix: 'IX', express: 'IX',
    'air india': 'AI', airindia: 'AI', ai: 'AI',
    indigo: '6E', '6e': '6E',
    vistara: 'UK', uk: 'UK',
    flydubai: 'FZ', 'fly dubai': 'FZ', fz: 'FZ',
    'air arabia': 'G9', g9: 'G9',
    emirates: 'EK', ek: 'EK',
    etihad: 'EY', ey: 'EY',
    qatar: 'QR', qr: 'QR',
    akasa: 'QP', qp: 'QP'
  };

  for (const line of lines) {
    // 1. Check if line is a route header: e.g. "SG ATQ → DXB", "IX ATQ -> DXB", "Spicejet ATQ to DXB"
    const routeMatch = line.match(/(?:([A-Za-z0-9]{2}|[A-Za-z\s]{3,20})\s+)?([A-Za-z]{3})\s*(?:➔|➜|->|-->|–>|—>|>|→|to|-)\s*([A-Za-z]{3})(?:\s*([A-Za-z0-9\/-]+))?/i);
    if (routeMatch) {
      const maybeAir = (routeMatch[1] || '').trim().toLowerCase();
      const orig = routeMatch[2].toUpperCase();
      const dest = routeMatch[3].toUpperCase();

      if (AIRLINE_CODES[maybeAir]) {
        currentAirline = AIRLINE_CODES[maybeAir];
      } else if (maybeAir.length === 2) {
        currentAirline = maybeAir.toUpperCase();
      }

      currentOrigin = orig;
      currentDestination = dest;
      if (routeMatch[4]) currentFlightNo = routeMatch[4];
      continue;
    }

    // 2. Check if line is a date + fare line: e.g. "17 SEP - ₹19,500/-", "18 SEP : 17900", "17 SEP -X19,500/-"
    const cleanLine = line.replace(/(^|[^a-zA-Z0-9])(?:INR|RS\.?|₹|[Xx¥$€])\s*(?=\d)/gi, '$1 ');
    const dateFareMatch = cleanLine.match(/(\d{1,2})[\s\-\/]([A-Za-z]{3,9})(?:[\s\-\/](\d{2,4}))?.*?([₹\$\€]|rs\.?|inr|\b)?\s*([\d,]+(?:\.\d{2})?)/i);
    if (dateFareMatch) {
      const day = dateFareMatch[1].padStart(2, '0');
      const monStr = dateFareMatch[2].toLowerCase().slice(0, 3);
      const mon = MONTHS[monStr];
      let yr = dateFareMatch[3];
      if (!yr) yr = new Date().getFullYear();
      else if (yr.length === 2) yr = `20${yr}`;

      const rawFare = dateFareMatch[5].replace(/[,.]/g, '');
      const numFare = Math.round(parseFloat(rawFare));

      if (mon && numFare > 0) {
        records.push({
          travel_date: `${yr}-${mon}-${day}`,
          airline_code: currentAirline,
          origin: currentOrigin,
          destination: currentDestination,
          flight_number: currentFlightNo,
          net_fare: numFare,
          cabin: 'ECONOMY',
          baggage: '30kg',
          is_refundable: 'NON_REFUNDABLE',
          original_text: line
        });
      }
    }
  }

  return records;
}

/**
 * Extracts fare records from a Kandhari / vertical route blocks Excel worksheet
 */
export async function parseBlockOrTextExcel(rows2D, file, defaultOptions = {}) {
  const textLines = [];
  const headerRow = rows2D[0] || [];

  // Detect side-by-side route columns (e.g. Col A has SG ATQ->DXB, Col D has IX ATQ->DXB)
  const routeColIndices = [];
  headerRow.forEach((val, idx) => {
    const s = String(val).trim();
    if (/(?:→|➔|➜|->|-->|–>|—>|>|to|-)\s*[A-Z]{3}/i.test(s) || /[A-Z]{3}\s*(?:→|➔|➜|->|-->|–>|—>|>|to|-)/i.test(s)) {
      routeColIndices.push(idx);
    }
  });

  if (routeColIndices.length > 1) {
    for (let i = 0; i < routeColIndices.length; i++) {
      const startCol = routeColIndices[i];
      const endCol = i + 1 < routeColIndices.length ? routeColIndices[i + 1] : headerRow.length;
      rows2D.forEach(r => {
        const slice = r.slice(startCol, endCol).filter(c => String(c).trim());
        if (slice.length > 0) textLines.push(slice.join(' - '));
      });
      textLines.push('');
    }
  } else {
    rows2D.forEach(r => {
      const nonEmpties = r.map(c => String(c).trim()).filter(Boolean);
      if (nonEmpties.length > 0) {
        textLines.push(nonEmpties.join(' - '));
      } else {
        textLines.push('');
      }
    });
  }

  const rawText = textLines.join('\n');
  let records = [];

  // Try API first (server-side smart NLP parser)
  try {
    const apiRes = await api.parseWhatsApp(rawText, defaultOptions);
    if (apiRes && apiRes.success && Array.isArray(apiRes.records) && apiRes.records.length > 0) {
      records = apiRes.records;
    }
  } catch (apiErr) {
    console.warn('Backend parseWhatsApp unavailable, using local parser fallback:', apiErr);
  }

  // Fallback to local parser
  if (records.length === 0) {
    records = parseKandhariTextLocally(rawText, defaultOptions);
  }

  const extractedRows = records.map((rec, idx) => ({
    id: idx + 1,
    travel_date: rec.travel_date,
    net_fare: rec.net_fare,
    airline_code: rec.airline_code || defaultOptions.defaultAirline || 'AI',
    flight_number: rec.flight_number || '',
    departure_time: rec.departure_time || '',
    seats_available: rec.seats_available || '',
    seats_sold: '',
    supplier_name: defaultOptions.supplierName || 'Kandhari',
    sourceFile: file?.name || 'kandhari_excel.xlsx',
    origin: rec.origin || defaultOptions.defaultOrigin || 'ATQ',
    destination: rec.destination || defaultOptions.defaultDestination || 'DXB',
    cabin: rec.cabin || 'ECONOMY',
    baggage: rec.baggage || '30kg',
    is_refundable: rec.is_refundable || 'NON_REFUNDABLE'
  }));

  extractedRows.sort((a, b) => new Date(a.travel_date) - new Date(b.travel_date));

  const groups = buildGroupsFromRows(extractedRows);
  const distinctRoutes = Array.from(new Set(extractedRows.map(r => `${r.origin}-${r.destination}`)));
  const distinctAirlines = Array.from(new Set(extractedRows.map(r => r.airline_code)));

  return {
    success: true,
    fileName: file?.name || 'kandhari_excel.xlsx',
    formatDetected: 'KANDHARI_RATE_LIST',
    validCount: extractedRows.length,
    distinctRoutes,
    distinctAirlines,
    groups,
    rows: extractedRows
  };
}

/**
 * Reads an Excel (.xlsx, .xls) or CSV file and extracts fare records
 * Supporting multi-route, multi-airline, date, and net fare columns
 */
export async function parseExcelFile(file, defaultOptions = {}) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          return resolve({ success: false, error: 'No worksheets found in this Excel file.' });
        }

        // Pick first sheet or one matching fares/rates/series/calendar/report/kandhari
        let targetSheetName = workbook.SheetNames[0];
        const matchSheet = workbook.SheetNames.find(s => /fare|rate|ticket|special|series|calendar|report|kandhari/i.test(s));
        if (matchSheet) targetSheetName = matchSheet;

        const worksheet = workbook.Sheets[targetSheetName];

        // Check if the sheet is in Kandhari / Vertical Route Blocks / Text List format
        const rows2D = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
        if (detectBlockOrTextFormat(rows2D)) {
          const blockResult = await parseBlockOrTextExcel(rows2D, file, defaultOptions);
          if (blockResult.success && blockResult.validCount > 0) {
            return resolve(blockResult);
          }
        }

        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

        if (!rawJson || rawJson.length === 0) {
          if (rows2D && rows2D.length > 0) {
            const blockResult = await parseBlockOrTextExcel(rows2D, file, defaultOptions);
            if (blockResult.success && blockResult.validCount > 0) {
              return resolve(blockResult);
            }
          }
          return resolve({ success: false, error: 'Excel sheet appears to be empty.' });
        }

        const headers = Object.keys(rawJson[0]);

        // 1. Detect Date Column
        const dateKey = headers.find(h => /^(date|travel_?date|tarikh|dt)$/i.test(h)) ||
                        headers.find(h => /date|travel|day|tarikh|dt/i.test(h)) ||
                        headers[0];

        // 2. Detect Fare Column
        const fareKey = headers.find(h => /^(fare|rate|net_?fare|net_?rate|price)$/i.test(h)) ||
                        headers.find(h => /fare|rate|net|price|amt|amount|inr|rs|₹/i.test(h)) ||
                        headers[1] || headers[headers.length - 1];

        // 3. Detect Sector / Route Column (single column e.g. "Sector", "Route", "City Pair")
        const sectorKey = headers.find(h => /^(sector|route|routing|pair|city\s*pair)$/i.test(h)) ||
                          headers.find(h => /sector|route|routing|pair|city\s*pair/i.test(h));

        // 4. Detect Separate From & To Columns
        const fromKey = headers.find(h => /^(from|origin|orig|dep|departure|source)$/i.test(h));
        const toKey = headers.find(h => /^(to|destination|dest|arr|arrival)$/i.test(h));

        // 5. Detect Airline & Flight Columns
        let airlineKey = headers.find(h => /^(airline|air|carrier|a\/l|air_code)$/i.test(h)) ||
                         headers.find(h => /airline|air|carrier|a\/l|air_code/i.test(h));
        let flightKey = headers.find(h => /^(flight\s*number|flight\s*no|flt_no|flight_num)$/i.test(h)) ||
                        headers.find(h => /^(flight|flt)$/i.test(h)) ||
                        headers.find(h => /flight|flt/i.test(h));

        // If no explicit airlineKey was detected, check if flightKey actually contains airline names
        // (standard in Monga, MMT, Air IQ rate sheets where column is titled "Flight" with values "Spicejet", "IndiGo", etc.)
        if (!airlineKey && flightKey) {
          const sampleVals = rawJson.slice(0, 10).map(r => String(r[flightKey] || '').trim().toLowerCase());
          const hasAirlineNames = sampleVals.some(v => AIRLINE_MAP[v] || (v.length === 2 && /^[a-z0-9]{2}$/i.test(v)));
          if (hasAirlineNames) {
            airlineKey = flightKey;
            flightKey = null;
          }
        }

        // 6. Detect Departure Time, Available Seats, Seat Sold, Supplier Name (Bittu / Series Report format)
        const depTimeKey = headers.find(h => /dep.*time|departure.*time|timing|dep_time/i.test(h));
        const availKey = headers.find(h => /avail.*s|available|avail|open|seats_avail/i.test(h));
        const soldKey = headers.find(h => /sold|seat.*sold|seats_sold|booked/i.test(h));
        const supplierKey = headers.find(h => /supplier|vendor|provider|agency|source|party/i.test(h));

        // 7. Detect Baggage & Refundable Columns
        const baggageKey = headers.find(h => /bag|baggage|weight|allowance/i.test(h));
        const refundableKey = headers.find(h => /refund|refundable|status/i.test(h));

        const extractedRows = [];
        let skippedCount = 0;

        rawJson.forEach((row, idx) => {
          const rawDate = row[dateKey];
          const rawFare = row[fareKey];

          const date = normalizeExcelDate(rawDate);
          const fare = normalizeExcelFare(rawFare);

          if (date && fare > 0) {
            let rowOrigin = '';
            let rowDestination = '';

            // Check separate From/To first
            if (fromKey && row[fromKey]) rowOrigin = normalizeAirport(row[fromKey]);
            if (toKey && row[toKey]) rowDestination = normalizeAirport(row[toKey]);

            // If not found, check unified Sector/Route column
            if ((!rowOrigin || !rowDestination) && sectorKey && row[sectorKey]) {
              const parsed = parseSector(row[sectorKey]);
              if (parsed.origin) rowOrigin = parsed.origin;
              if (parsed.destination) rowDestination = parsed.destination;
            }

            // Fallbacks from options if provided
            if (!rowOrigin && defaultOptions.defaultOrigin) rowOrigin = defaultOptions.defaultOrigin;
            if (!rowDestination && defaultOptions.defaultDestination) rowDestination = defaultOptions.defaultDestination;

            // Airline detection
            const rawAir = airlineKey ? row[airlineKey] : '';
            const rawFlight = flightKey ? row[flightKey] : '';
            let rowAirline = normalizeAirline(rawAir, rawFlight);

            // Clean flight number: if rawFlight is purely an airline name (e.g. "Spicejet"), don't store it as flight number
            let cleanFlightNo = rawFlight ? String(rawFlight).trim() : '';
            if (cleanFlightNo && (AIRLINE_MAP[cleanFlightNo.toLowerCase()] || (rowAirline && cleanFlightNo.toUpperCase() === rowAirline.toUpperCase()))) {
              cleanFlightNo = '';
            }

            // Direct check for Air India Express flight numbers (191, 192, 137, 138)
            const fltNumClean = cleanFlightNo.replace(/[^0-9]/g, '');
            if (['191', '192', '137', '138'].includes(fltNumClean) || /^(IX|AIX)[\s\-_]?(191|192|137|138)$/i.test(cleanFlightNo)) {
              rowAirline = 'IX';
            }

            if (!rowAirline && defaultOptions.defaultAirline) {
              rowAirline = defaultOptions.defaultAirline;
            }

            extractedRows.push({
              id: idx + 1,
              travel_date: date,
              net_fare: fare,
              airline_code: rowAirline || 'AI',
              flight_number: cleanFlightNo,
              departure_time: depTimeKey && row[depTimeKey] ? String(row[depTimeKey]).trim() : '',
              seats_available: availKey && row[availKey] !== undefined ? row[availKey] : '',
              seats_sold: soldKey && row[soldKey] !== undefined ? row[soldKey] : '',
              supplier_name: supplierKey && row[supplierKey] ? String(row[supplierKey]).trim() : '',
              sourceFile: file.name,
              origin: rowOrigin || 'ATQ',
              destination: rowDestination || 'DXB',
              cabin: 'ECONOMY',
              baggage: baggageKey && row[baggageKey] ? String(row[baggageKey]).trim() : '30kg',
              is_refundable: refundableKey && row[refundableKey]
                ? (String(row[refundableKey]).toLowerCase().includes('non') ? 'NON_REFUNDABLE' : 'REFUNDABLE')
                : 'NON_REFUNDABLE'
            });
          } else {
            skippedCount++;
          }
        });

        // Fallback: If standard tabular extraction yielded 0 rows, check if it is a block / text list sheet
        if (extractedRows.length === 0 && rows2D && rows2D.length > 0) {
          const fallbackResult = await parseBlockOrTextExcel(rows2D, file, defaultOptions);
          if (fallbackResult.success && fallbackResult.validCount > 0) {
            return resolve(fallbackResult);
          }
        }

        // Sort chronologically by date
        extractedRows.sort((a, b) => new Date(a.travel_date) - new Date(b.travel_date));

        const groups = buildGroupsFromRows(extractedRows);
        const distinctRoutes = Array.from(new Set(extractedRows.map(r => `${r.origin}-${r.destination}`)));
        const distinctAirlines = Array.from(new Set(extractedRows.map(r => r.airline_code)));
        const detectedSupplier = supplierKey && extractedRows.find(r => r.supplier_name)?.supplier_name;

        resolve({
          success: true,
          fileName: file.name,
          sheetName: targetSheetName,
          totalRowsRead: rawJson.length,
          validCount: extractedRows.length,
          skippedCount,
          detectedSupplier: detectedSupplier || null,
          detectedDateColumn: dateKey,
          detectedFareColumn: fareKey,
          detectedSectorColumn: sectorKey || (fromKey && toKey ? `${fromKey} + ${toKey}` : null),
          detectedAirlineColumn: airlineKey,
          distinctRoutes,
          distinctAirlines,
          groups,
          rows: extractedRows
        });
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        resolve({ success: false, error: `Excel parsing error: ${err.message}` });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, error: 'Could not read file from disk.' });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Groups rows by Sector + Airline to calculate counts, min/max fare, min/max date
 */
export function buildGroupsFromRows(rows) {
  const groupMap = {};
  (rows || []).forEach(r => {
    const key = `${r.origin}-${r.destination}_${r.airline_code}`;
    if (!groupMap[key]) {
      groupMap[key] = {
        key,
        route: `${r.origin}-${r.destination}`,
        origin: r.origin,
        destination: r.destination,
        airline_code: r.airline_code,
        count: 0,
        fares: [],
        dates: [],
        minFare: Infinity,
        maxFare: -Infinity,
        minDate: null,
        maxDate: null,
        flight_numbers: new Set()
      };
    }
    const g = groupMap[key];
    g.count++;
    g.fares.push(r.net_fare);
    g.dates.push(r.travel_date);
    if (r.net_fare < g.minFare) g.minFare = r.net_fare;
    if (r.net_fare > g.maxFare) g.maxFare = r.net_fare;
    if (r.flight_number) g.flight_numbers.add(r.flight_number);
  });

  return Object.values(groupMap).map(g => {
    g.dates.sort();
    return {
      ...g,
      minDate: g.dates[0],
      maxDate: g.dates[g.dates.length - 1],
      flight_numbers: Array.from(g.flight_numbers)
    };
  });
}

/**
 * Reads multiple Excel (.xlsx, .xls) or CSV files and merges all fare records
 */
export async function parseMultipleExcelFiles(files, defaultOptions = {}) {
  const fileArray = Array.from(files || []);
  if (fileArray.length === 0) {
    return { success: false, error: 'No files selected.' };
  }

  const fileResults = [];
  let allRows = [];
  const errors = [];
  const suppliers = new Set();

  for (const file of fileArray) {
    try {
      const res = await parseExcelFile(file, defaultOptions);
      if (res.success) {
        if (res.detectedSupplier) suppliers.add(res.detectedSupplier);
        const tagged = res.rows.map(r => ({ ...r, sourceFile: file.name }));
        allRows = allRows.concat(tagged);
        fileResults.push({
          fileName: file.name,
          validCount: res.validCount,
          detectedSupplier: res.detectedSupplier
        });
      } else {
        errors.push(`${file.name}: ${res.error}`);
      }
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  if (allRows.length === 0) {
    return {
      success: false,
      error: errors.length > 0 ? errors.join(' | ') : 'No valid fares found in selected Excel files.',
      fileResults
    };
  }

  // Sort chronologically by travel date
  allRows.sort((a, b) => new Date(a.travel_date) - new Date(b.travel_date));
  const groups = buildGroupsFromRows(allRows);
  const distinctRoutes = Array.from(new Set(allRows.map(r => `${r.origin}-${r.destination}`)));
  const distinctAirlines = Array.from(new Set(allRows.map(r => r.airline_code)));

  return {
    success: true,
    fileResults,
    fileCount: fileResults.length,
    fileName: fileResults.map(f => f.fileName).join(', '),
    validCount: allRows.length,
    detectedSupplier: Array.from(suppliers).join(', ') || null,
    distinctRoutes,
    distinctAirlines,
    groups,
    rows: allRows,
    errors: errors.length > 0 ? errors : null
  };
}

/**
 * Generates an Excel template matching Kandhari's exact vertical rate list format (Single column / route blocks)
 * Exactly matching media_1789274707422.png
 */
export function downloadKandhariTemplate() {
  const kandhariRows = [
    ['SG ATQ → DXB'],
    ['17 SEP - ₹19,500/-'],
    ['18 SEP - ₹19,500/-'],
    ['19 SEP - ₹19,500/-'],
    ['20 SEP - ₹19,500/-'],
    ['21 SEP - ₹19,500/-'],
    ['22 SEP - ₹17,900/-'],
    ['23 SEP - ₹17,900/-'],
    ['24 SEP - ₹17,900/-'],
    ['25 SEP - ₹17,900/-'],
    ['26 SEP - ₹17,900/-'],
    ['27 SEP - ₹17,900/-'],
    ['28 SEP - ₹17,900/-'],
    ['29 SEP - ₹17,900/-'],
    ['30 SEP - ₹17,900/-'],
    [''],
    ['IX ATQ → DXB'],
    ['17 SEP - ₹23,000/-'],
    ['18 SEP - ₹21,800/-'],
    ['19 SEP - ₹21,800/-'],
    ['20 SEP - ₹21,800/-'],
    ['21 SEP - ₹23,000/-'],
    ['22 SEP - ₹18,800/-'],
    ['23 SEP - ₹18,800/-'],
    ['24 SEP - ₹18,800/-'],
    ['25 SEP - ₹18,800/-'],
    ['26 SEP - ₹18,800/-'],
    ['27 SEP - ₹18,800/-'],
    ['28 SEP - ₹18,800/-'],
    ['29 SEP - ₹18,800/-'],
    ['30 SEP - ₹18,800/-']
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(kandhariRows);
  worksheet['!cols'] = [{ wch: 32 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kandhari_Rates');
  XLSX.writeFile(workbook, 'kandhari_rates_template.xlsx');
}

/**
 * Generates the 4-Column Excel Template (.xlsx) for Monga, MMT, Air IQ and other standard suppliers
 * Headers: Flight | Sector | Date | Fare
 * Exactly matching user format: media_1789276359354.png
 */
export function downloadMongaTemplate(vendorName = 'Monga') {
  const sampleData = [
    {
      'Flight': 'Spicejet',
      'Sector': 'ATQ-DXB',
      'Date': '16-09-2026',
      'Fare': 18000
    },
    {
      'Flight': 'Spicejet',
      'Sector': 'DXB-ATQ',
      'Date': '17-09-2026',
      'Fare': 18500
    },
    {
      'Flight': 'Air India Express',
      'Sector': 'ATQ-SHJ',
      'Date': '18-09-2026',
      'Fare': 22500
    },
    {
      'Flight': 'Air India Express',
      'Sector': 'SHJ-ATQ',
      'Date': '19-09-2026',
      'Fare': 21000
    },
    {
      'Flight': 'IndiGo',
      'Sector': 'DEL-DXB',
      'Date': '20-09-2026',
      'Fare': 16500
    },
    {
      'Flight': 'IndiGo',
      'Sector': 'DXB-DEL',
      'Date': '21-09-2026',
      'Fare': 17000
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, {
    header: ['Flight', 'Sector', 'Date', 'Fare']
  });
  worksheet['!cols'] = [
    { wch: 22 }, // Flight
    { wch: 16 }, // Sector
    { wch: 16 }, // Date
    { wch: 14 }  // Fare
  ];

  const workbook = XLSX.utils.book_new();
  const safeName = vendorName ? String(vendorName).trim() : 'Monga';
  XLSX.utils.book_append_sheet(workbook, worksheet, `${safeName}_Fares`);
  XLSX.writeFile(workbook, `${safeName.toLowerCase().replace(/\s+/g, '_')}_rates_template.xlsx`);
}

export function downloadStandard4ColTemplate(vendorName) {
  return downloadMongaTemplate(vendorName);
}

/**
 * Generates the Series Calendar Report Excel Template (.xlsx) matching Bittu / B2B Supplier tabular format
 * Headers: Date | Sector | Flight number | Departure Time | Available s | Seat Sold | Fare | Supplier name
 */
export function downloadBittuTemplate(vendorName) {
  return downloadStandardSeriesTemplate(vendorName);
}

export function downloadExcelTemplate(vendorName, format = 'auto') {
  const vLower = (vendorName || '').toLowerCase();
  if (format === 'kandhari' || (format === 'auto' && vLower.includes('kandhari'))) {
    return downloadKandhariTemplate();
  }
  if (format === 'bittu' || (format === 'auto' && vLower.includes('bittu'))) {
    return downloadBittuTemplate(vendorName);
  }
  if (format === 'monga' || format === '4col' || (format === 'auto' && (vLower.includes('monga') || vLower.includes('mmt') || vLower.includes('air iq') || vLower.includes('airiq')))) {
    return downloadMongaTemplate(vendorName || 'Monga');
  }
  return downloadMongaTemplate(vendorName || 'Standard');
}

export function downloadStandardSeriesTemplate(vendorName) {
  const supplier = vendorName
    ? (vendorName.toUpperCase().includes('BITTU') ? 'BITTU-HAPPY OVERSEAS PVT. LTD.' : `${vendorName.toUpperCase()}-HAPPY OVERSEAS PVT. LTD.`)
    : 'BITTU-HAPPY OVERSEAS PVT. LTD.';

  const sampleData = [
    {
      'Date': '2026/09/12',
      'Sector': 'ATQ-DXB',
      'Flight number': '191',
      'Departure Time': '00:15',
      'Available s': 0,
      'Seat Sold': 6,
      'Fare': 18500,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'DXB-ATQ',
      'Flight number': '192',
      'Departure Time': '04:30',
      'Available s': 0,
      'Seat Sold': 8,
      'Fare': 19200,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'ATQ-SHJ',
      'Flight number': '137',
      'Departure Time': '06:15',
      'Available s': 0,
      'Seat Sold': 8,
      'Fare': 18800,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'SHJ-ATQ',
      'Flight number': '138',
      'Departure Time': '10:30',
      'Available s': 0,
      'Seat Sold': 7,
      'Fare': 19500,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'DEL-LHR',
      'Flight number': '303',
      'Departure Time': '02:05',
      'Available s': 0,
      'Seat Sold': 12,
      'Fare': 58000,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'LHR-DEL',
      'Flight number': '304',
      'Departure Time': '11:30',
      'Available s': 0,
      'Seat Sold': 10,
      'Fare': 59500,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'DEL-FCO',
      'Flight number': '769',
      'Departure Time': '03:00',
      'Available s': 0,
      'Seat Sold': 4,
      'Fare': 35000,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'FCO-DEL',
      'Flight number': '770',
      'Departure Time': '14:00',
      'Available s': 0,
      'Seat Sold': 5,
      'Fare': 36000,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'DEL-MEL',
      'Flight number': '308',
      'Departure Time': '03:00',
      'Available s': 0,
      'Seat Sold': 5,
      'Fare': 35900,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'MEL-DEL',
      'Flight number': '309',
      'Departure Time': '16:30',
      'Available s': 0,
      'Seat Sold': 6,
      'Fare': 37200,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'DEL-SHJ',
      'Flight number': '135',
      'Departure Time': '03:15',
      'Available s': 0,
      'Seat Sold': 10,
      'Fare': 19300,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'SHJ-DEL',
      'Flight number': '136',
      'Departure Time': '07:15',
      'Available s': 0,
      'Seat Sold': 8,
      'Fare': 18800,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'JAI-SHJ',
      'Flight number': '436',
      'Departure Time': '04:50',
      'Available s': 0,
      'Seat Sold': 10,
      'Fare': 18900,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'SHJ-JAI',
      'Flight number': '437',
      'Departure Time': '09:40',
      'Available s': 0,
      'Seat Sold': 9,
      'Fare': 18500,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'DEL-YYZ',
      'Flight number': '72/45',
      'Departure Time': '08:00',
      'Available s': 0,
      'Seat Sold': 10,
      'Fare': 71900,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'YYZ-DEL',
      'Flight number': '73/46',
      'Departure Time': '18:00',
      'Available s': 0,
      'Seat Sold': 10,
      'Fare': 73500,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'DEL-MXP',
      'Flight number': '137',
      'Departure Time': '02:40',
      'Available s': 0,
      'Seat Sold': 8,
      'Fare': 34000,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/12',
      'Sector': 'MXP-DEL',
      'Flight number': '138',
      'Departure Time': '15:20',
      'Available s': 0,
      'Seat Sold': 7,
      'Fare': 34500,
      'Supplier name': supplier
    },
    // Multi-date samples (13 Sep, 14 Sep, 15 Sep)
    {
      'Date': '2026/09/13',
      'Sector': 'ATQ-DXB',
      'Flight number': '191',
      'Departure Time': '00:15',
      'Available s': 0,
      'Seat Sold': 7,
      'Fare': 18700,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/13',
      'Sector': 'DXB-ATQ',
      'Flight number': '192',
      'Departure Time': '04:30',
      'Available s': 0,
      'Seat Sold': 6,
      'Fare': 19400,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/14',
      'Sector': 'ATQ-DXB',
      'Flight number': '191',
      'Departure Time': '00:15',
      'Available s': 0,
      'Seat Sold': 9,
      'Fare': 18900,
      'Supplier name': supplier
    },
    {
      'Date': '2026/09/15',
      'Sector': 'ATQ-DXB',
      'Flight number': '191',
      'Departure Time': '00:15',
      'Available s': 0,
      'Seat Sold': 5,
      'Fare': 18500,
      'Supplier name': supplier
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Sector
    { wch: 16 }, // Flight number
    { wch: 16 }, // Departure Time
    { wch: 14 }, // Available s
    { wch: 12 }, // Seat Sold
    { wch: 12 }, // Fare
    { wch: 36 }  // Supplier name
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'series_calendar_report');

  const fileName = vendorName && vendorName.toLowerCase().includes('bittu')
    ? 'series_calendar_report_bittu.xlsx'
    : 'series_calendar_report_template.xlsx';

  XLSX.writeFile(workbook, fileName);
}
