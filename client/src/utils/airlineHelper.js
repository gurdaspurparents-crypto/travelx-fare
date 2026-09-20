/**
 * Airline Code to Full Name Mapping and Helper
 */
export const AIRLINE_NAMES = {
  AI: 'Air India',
  '6E': 'IndiGo',
  IX: 'Air India Express',
  SG: 'SpiceJet',
  UK: 'Vistara',
  G9: 'Air Arabia',
  FZ: 'Flydubai',
  EK: 'Emirates',
  WY: 'Oman Air',
  QR: 'Qatar Airways',
  SV: 'Saudia',
  KU: 'Kuwait Airways',
  GF: 'Gulf Air',
  EY: 'Etihad Airways',
  QP: 'Akasa Air'
};

/**
 * Returns the full friendly Airline Name for any code or master list
 */
export function getAirlineName(codeOrName, airlinesList = []) {
  if (!codeOrName) return '';
  const trimmed = String(codeOrName).trim();
  
  // 1. Check if it's in master airlines list
  if (Array.isArray(airlinesList)) {
    const found = airlinesList.find(
      a => a.code?.toUpperCase() === trimmed.toUpperCase() || 
           a.name?.toLowerCase() === trimmed.toLowerCase()
    );
    if (found && found.name) return found.name;
  }

  // 2. Check in standard mapping
  const upper = trimmed.toUpperCase();
  if (AIRLINE_NAMES[upper]) {
    return AIRLINE_NAMES[upper];
  }

  // 3. Check case-insensitive key
  const matchKey = Object.keys(AIRLINE_NAMES).find(k => k.toLowerCase() === trimmed.toLowerCase());
  if (matchKey) return AIRLINE_NAMES[matchKey];

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
