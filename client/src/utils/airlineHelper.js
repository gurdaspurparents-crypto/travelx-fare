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
  // Amritsar (ATQ) ➔ Dubai (DXB)
  'IX 191': { dep: '00:15', arr: '02:55', origin: 'ATQ', dest: 'DXB', duration: '4h 10m', aircraft: 'Boeing 737-800' },
  'IX191': { dep: '00:15', arr: '02:55', origin: 'ATQ', dest: 'DXB', duration: '4h 10m', aircraft: 'Boeing 737-800' },
  'SG 59': { dep: '19:30', arr: '21:50', origin: 'ATQ', dest: 'DXB', duration: '3h 50m', aircraft: 'Boeing 737 MAX 8' },
  'SG59': { dep: '19:30', arr: '21:50', origin: 'ATQ', dest: 'DXB', duration: '3h 50m', aircraft: 'Boeing 737 MAX 8' },
  'SG 5155': { dep: '19:30', arr: '21:50', origin: 'ATQ', dest: 'DXB', duration: '3h 50m', aircraft: 'Boeing 737 MAX 8' },
  'SG5155': { dep: '19:30', arr: '21:50', origin: 'ATQ', dest: 'DXB', duration: '3h 50m', aircraft: 'Boeing 737 MAX 8' },
  'SG 55': { dep: '19:30', arr: '21:50', origin: 'ATQ', dest: 'DXB', duration: '3h 50m', aircraft: 'Boeing 737 MAX 8' },
  'SG55': { dep: '19:30', arr: '21:50', origin: 'ATQ', dest: 'DXB', duration: '3h 50m', aircraft: 'Boeing 737 MAX 8' },

  // Dubai (DXB) ➔ Amritsar (ATQ) Return
  'IX 192': { dep: '03:55', arr: '08:45', origin: 'DXB', dest: 'ATQ', duration: '3h 20m', aircraft: 'Boeing 737-800' },
  'IX192': { dep: '03:55', arr: '08:45', origin: 'DXB', dest: 'ATQ', duration: '3h 20m', aircraft: 'Boeing 737-800' },
  'SG 60': { dep: '12:25', arr: '17:15', origin: 'DXB', dest: 'ATQ', duration: '3h 20m', aircraft: 'Boeing 737 MAX 8' },
  'SG60': { dep: '12:25', arr: '17:15', origin: 'DXB', dest: 'ATQ', duration: '3h 20m', aircraft: 'Boeing 737 MAX 8' },
  'SG 5156': { dep: '12:25', arr: '17:15', origin: 'DXB', dest: 'ATQ', duration: '3h 20m', aircraft: 'Boeing 737 MAX 8' },
  'SG5156': { dep: '12:25', arr: '17:15', origin: 'DXB', dest: 'ATQ', duration: '3h 20m', aircraft: 'Boeing 737 MAX 8' },

  // Amritsar (ATQ) ➔ Sharjah (SHJ)
  'IX 137': { dep: '13:15', arr: '16:05', origin: 'ATQ', dest: 'SHJ', duration: '4h 20m', aircraft: 'Boeing 737-800' },
  'IX137': { dep: '13:15', arr: '16:05', origin: 'ATQ', dest: 'SHJ', duration: '4h 20m', aircraft: 'Boeing 737-800' },
  '6E 1427': { dep: '12:15', arr: '14:40', origin: 'ATQ', dest: 'SHJ', duration: '3h 55m', aircraft: 'Airbus A320neo' },
  '6E1427': { dep: '12:15', arr: '14:40', origin: 'ATQ', dest: 'SHJ', duration: '3h 55m', aircraft: 'Airbus A320neo' },

  // Sharjah (SHJ) ➔ Amritsar (ATQ) Return
  'IX 138': { dep: '17:05', arr: '21:55', origin: 'SHJ', dest: 'ATQ', duration: '3h 20m', aircraft: 'Boeing 737-800' },
  'IX138': { dep: '17:05', arr: '21:55', origin: 'SHJ', dest: 'ATQ', duration: '3h 20m', aircraft: 'Boeing 737-800' },
  '6E 1428': { dep: '15:40', arr: '20:30', origin: 'SHJ', dest: 'ATQ', duration: '3h 20m', aircraft: 'Airbus A320neo' },
  '6E1428': { dep: '15:40', arr: '20:30', origin: 'SHJ', dest: 'ATQ', duration: '3h 20m', aircraft: 'Airbus A320neo' },

  // Chandigarh (IXC) ➔ Abu Dhabi (AUH)
  '6E 1418': { dep: '15:10', arr: '17:30', origin: 'IXC', dest: 'AUH', duration: '3h 50m', aircraft: 'Airbus A320neo' },
  '6E1418': { dep: '15:10', arr: '17:30', origin: 'IXC', dest: 'AUH', duration: '3h 50m', aircraft: 'Airbus A320neo' },
  '6E 1411': { dep: '15:10', arr: '17:30', origin: 'IXC', dest: 'AUH', duration: '3h 50m', aircraft: 'Airbus A320neo' },
  '6E1411': { dep: '15:10', arr: '17:30', origin: 'IXC', dest: 'AUH', duration: '3h 50m', aircraft: 'Airbus A320neo' },
  '6E 1419': { dep: '18:30', arr: '23:25', origin: 'AUH', dest: 'IXC', duration: '3h 25m', aircraft: 'Airbus A320neo' },
  '6E1419': { dep: '18:30', arr: '23:25', origin: 'AUH', dest: 'IXC', duration: '3h 25m', aircraft: 'Airbus A320neo' },

  // Delhi (DEL) ➔ Dubai (DXB)
  'AI 4309': { dep: '10:15', arr: '12:35', origin: 'DEL', dest: 'DXB', duration: '3h 50m', aircraft: 'Boeing 787-8 Dreamliner' },
  'AI4309': { dep: '10:15', arr: '12:35', origin: 'DEL', dest: 'DXB', duration: '3h 50m', aircraft: 'Boeing 787-8 Dreamliner' },
  'AI 995': { dep: '20:20', arr: '22:45', origin: 'DEL', dest: 'DXB', duration: '3h 55m', aircraft: 'Boeing 787-8 Dreamliner' },
  'AI995': { dep: '20:20', arr: '22:45', origin: 'DEL', dest: 'DXB', duration: '3h 55m', aircraft: 'Boeing 787-8 Dreamliner' },

  // Delhi (DEL) ➔ Sharjah (SHJ)
  'G9 464': { dep: '04:40', arr: '07:05', origin: 'DEL', dest: 'SHJ', duration: '3h 55m', aircraft: 'Airbus A320' },
  'G9464': { dep: '04:40', arr: '07:05', origin: 'DEL', dest: 'SHJ', duration: '3h 55m', aircraft: 'Airbus A320' },
  'G9 466': { dep: '21:55', arr: '00:20', origin: 'DEL', dest: 'SHJ', duration: '3h 55m', aircraft: 'Airbus A320' },
  'G9466': { dep: '21:55', arr: '00:20', origin: 'DEL', dest: 'SHJ', duration: '3h 55m', aircraft: 'Airbus A320' },

  // Amritsar (ATQ) ➔ Melbourne (MEL)
  'TR 751/58': { dep: '20:00', arr: '17:05', origin: 'ATQ', dest: 'MEL', duration: '16h 35m', aircraft: 'Boeing 787-8 / A320' },
  'TR 751': { dep: '20:00', arr: '04:20', origin: 'ATQ', dest: 'SIN', duration: '5h 50m', aircraft: 'Boeing 787-8 Dreamliner' }
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

  // Sensible fallback by sector if flight timing is entirely missing
  const sKey = `${String(origin || '').trim().toUpperCase()}-${String(destination || '').trim().toUpperCase()}`;
  if (sKey === 'ATQ-DXB') return { dep: '00:15', arr: '02:55', duration: '4h 10m' };
  if (sKey === 'ATQ-SHJ') return { dep: '12:15', arr: '14:40', duration: '3h 55m' };
  if (sKey === 'IXC-AUH') return { dep: '15:10', arr: '17:30', duration: '3h 50m' };
  if (sKey === 'DEL-DXB') return { dep: '10:15', arr: '12:35', duration: '3h 50m' };
  if (sKey === 'DEL-SHJ') return { dep: '04:40', arr: '07:05', duration: '3h 55m' };
  if (sKey === 'ATQ-MEL') return { dep: '20:00', arr: '17:05', duration: '16h 35m' };

  return null;
}
