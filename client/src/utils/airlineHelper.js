/**
 * Airline Code to Full Name Mapping and Helper
 */
export const AIRLINE_NAMES = {
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

/**
 * Returns the full friendly Airline Name for any code or master list
 */
export function getAirlineName(codeOrName, airlinesList = []) {
  if (!codeOrName) return '';
  const trimmed = String(codeOrName).trim();
  const upper = trimmed.toUpperCase();

  // 1. Check in standard mapping by exact code
  if (AIRLINE_NAMES[upper]) {
    return AIRLINE_NAMES[upper];
  }

  // 2. Check if it's already one of our full names (case-insensitive)
  const existingName = Object.values(AIRLINE_NAMES).find(
    name => name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existingName) return existingName;

  // 3. Check in master airlines list (from DB)
  if (Array.isArray(airlinesList)) {
    const found = airlinesList.find(
      a => a.code?.toUpperCase() === upper || 
           a.name?.toLowerCase() === trimmed.toLowerCase()
    );
    if (found && found.name) return found.name;
  }

  // 4. If codeOrName is already a descriptive full name (more than 3 chars and not a 2/3 letter code)
  if (trimmed.length > 3 && !/^[A-Z0-9]{2,3}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Known Standard Flight Timings / Schedules for quick lookup
 */
export const KNOWN_FLIGHT_TIMINGS = {
  // SpiceJet Amritsar to Dubai
  'SG 5155': { dep: '08:40', arr: '11:25', origin: 'ATQ', dest: 'DXB', duration: '4h 15m' },
  'SG5155': { dep: '08:40', arr: '11:25', origin: 'ATQ', dest: 'DXB', duration: '4h 15m' },
  'SG-5155': { dep: '08:40', arr: '11:25', origin: 'ATQ', dest: 'DXB', duration: '4h 15m' },

  // Air India Express Amritsar to Dubai
  'IX 191': { dep: '00:15', arr: '02:55', origin: 'ATQ', dest: 'DXB', duration: '4h 10m' },
  'IX191': { dep: '00:15', arr: '02:55', origin: 'ATQ', dest: 'DXB', duration: '4h 10m' },
  'IX-191': { dep: '00:15', arr: '02:55', origin: 'ATQ', dest: 'DXB', duration: '4h 10m' },

  // Air India Express Amritsar to Sharjah
  'IX 137': { dep: '13:15', arr: '16:05', origin: 'ATQ', dest: 'SHJ', duration: '4h 20m' },
  'IX137': { dep: '13:15', arr: '16:05', origin: 'ATQ', dest: 'SHJ', duration: '4h 20m' },
  'IX-137': { dep: '13:15', arr: '16:05', origin: 'ATQ', dest: 'SHJ', duration: '4h 20m' },

  // IndiGo Amritsar to Sharjah
  '6E 1427': { dep: '12:15', arr: '14:40', origin: 'ATQ', dest: 'SHJ', duration: '3h 55m' },
  '6E1427': { dep: '12:15', arr: '14:40', origin: 'ATQ', dest: 'SHJ', duration: '3h 55m' },
  '6E-1427': { dep: '12:15', arr: '14:40', origin: 'ATQ', dest: 'SHJ', duration: '3h 55m' },
};

/**
 * Returns departure and arrival timing object { dep, arr } if known
 */
export function getFlightTiming(flightNumber, origin = '', destination = '') {
  if (!flightNumber) return null;
  const clean = String(flightNumber).trim().toUpperCase();
  if (KNOWN_FLIGHT_TIMINGS[clean]) return KNOWN_FLIGHT_TIMINGS[clean];

  const alphanumeric = clean.replace(/[^A-Z0-9]/g, '');
  for (const [key, val] of Object.entries(KNOWN_FLIGHT_TIMINGS)) {
    if (key.replace(/[^A-Z0-9]/g, '') === alphanumeric) {
      return val;
    }
  }
  return null;
}
