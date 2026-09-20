/**
 * Comprehensive Airport / City Mapping and Route Formatter
 * Maps 3-letter IATA airport codes to full city names (e.g., DEL -> Delhi, MXP -> Milan, ROM -> Rome)
 */

export const AIRPORT_CITIES = {
  // --- INDIA ---
  DEL: 'Delhi',
  BOM: 'Mumbai',
  ATQ: 'Amritsar',
  IXC: 'Chandigarh',
  BLR: 'Bengaluru',
  HYD: 'Hyderabad',
  MAA: 'Chennai',
  CCU: 'Kolkata',
  COK: 'Kochi',
  AMD: 'Ahmedabad',
  GOI: 'Goa',
  GOX: 'Goa (Mopa)',
  JAI: 'Jaipur',
  LKO: 'Lucknow',
  TRV: 'Trivandrum',
  CCJ: 'Calicut',
  CNN: 'Kannur',
  IXE: 'Mangalore',
  VGA: 'Vijayawada',
  VTZ: 'Visakhapatnam',
  PAT: 'Patna',
  GAU: 'Guwahati',
  SXR: 'Srinagar',
  IXJ: 'Jammu',
  IXZ: 'Port Blair',
  PNQ: 'Pune',
  NAG: 'Nagpur',
  IDR: 'Indore',
  BBI: 'Bhubaneswar',
  BDQ: 'Vadodara',
  STV: 'Surat',
  UDR: 'Udaipur',
  IXB: 'Bagdogra',
  VNS: 'Varanasi',
  RPR: 'Raipur',
  DED: 'Dehradun',
  BHO: 'Bhopal',
  TIR: 'Tirupati',
  TRZ: 'Trichy',
  CJB: 'Coimbatore',
  IXM: 'Madurai',
  IXR: 'Ranchi',
  IMF: 'Imphal',
  DMU: 'Dimapur',
  AJL: 'Aizawl',
  SHL: 'Shillong',
  IXA: 'Agartala',
  IXS: 'Silchar',
  DIB: 'Dibrugarh',
  TEZ: 'Tezpur',
  JRH: 'Jorhat',
  IXU: 'Aurangabad',
  KLH: 'Kolhapur',
  NDC: 'Nanded',
  SAG: 'Shirdi',
  HBX: 'Hubli',
  IXG: 'Belgaum',
  MYQ: 'Mysore',
  IXY: 'Kandla',
  BHU: 'Bhavnagar',
  PBD: 'Porbandar',
  RAJ: 'Rajkot',
  HSR: 'Hissar',
  KUU: 'Kullu',
  DHM: 'Dharamshala',
  SLV: 'Shimla',
  BKB: 'Bikaner',
  JDH: 'Jodhpur',
  JSA: 'Jaisalmer',
  KNU: 'Kanpur',
  AGR: 'Agra',
  GWL: 'Gwalior',
  JLR: 'Jabalpur',
  HJR: 'Khajuraho',

  // --- EUROPE & UK ---
  MXP: 'Millan',
  MIL: 'Millan',
  LIN: 'Millan',
  BGY: 'Millan',
  ROM: 'Rome',
  FCO: 'Rome',
  CIA: 'Rome',
  LON: 'London',
  LHR: 'London',
  LGW: 'London',
  STN: 'London',
  LTN: 'London',
  LCY: 'London',
  BHX: 'Birmingham',
  MAN: 'Manchester',
  EDI: 'Edinburgh',
  GLA: 'Glasgow',
  NCL: 'Newcastle',
  BFS: 'Belfast',
  DUB: 'Dublin',
  PAR: 'Paris',
  CDG: 'Paris',
  ORY: 'Paris',
  FRA: 'Frankfurt',
  MUC: 'Munich',
  BER: 'Berlin',
  HAM: 'Hamburg',
  DUS: 'Dusseldorf',
  AMS: 'Amsterdam',
  BRU: 'Brussels',
  ZRH: 'Zurich',
  GVA: 'Geneva',
  VIE: 'Vienna',
  MAD: 'Madrid',
  BCN: 'Barcelona',
  LIS: 'Lisbon',
  OPO: 'Porto',
  ATH: 'Athens',
  WAW: 'Warsaw',
  PRG: 'Prague',
  BUD: 'Budapest',
  CPH: 'Copenhagen',
  ARN: 'Stockholm',
  OSL: 'Oslo',
  HEL: 'Helsinki',
  IST: 'Istanbul',
  SAW: 'Istanbul',
  AYT: 'Antalya',
  VCE: 'Venice',
  FLR: 'Florence',
  NAP: 'Naples',
  BLQ: 'Bologna',

  // --- MIDDLE EAST & GULF ---
  DXB: 'Dubai',
  SHJ: 'Sharjah',
  AUH: 'Abu Dhabi',
  DWC: 'Dubai',
  DOH: 'Doha',
  KWI: 'Kuwait',
  BAH: 'Bahrain',
  MCT: 'Muscat',
  SLL: 'Salalah',
  JED: 'Jeddah',
  RUH: 'Riyadh',
  DMM: 'Dammam',
  MED: 'Medina',
  AMM: 'Amman',
  BEY: 'Beirut',
  BGW: 'Baghdad',
  EBL: 'Erbil',
  CAI: 'Cairo',
  HBE: 'Alexandria',
  HRG: 'Hurghada',
  SSH: 'Sharm El Sheikh',

  // --- NORTH AMERICA (USA & CANADA) ---
  YYZ: 'Toronto',
  YVR: 'Vancouver',
  YUL: 'Montreal',
  YYC: 'Calgary',
  YEG: 'Edmonton',
  YOW: 'Ottawa',
  YWG: 'Winnipeg',
  JFK: 'New York',
  EWR: 'New York',
  LGA: 'New York',
  NYC: 'New York',
  ORD: 'Chicago',
  SFO: 'San Francisco',
  LAX: 'Los Angeles',
  SEA: 'Seattle',
  DFW: 'Dallas',
  IAH: 'Houston',
  ATL: 'Atlanta',
  IAD: 'Washington',
  DCA: 'Washington',
  WAS: 'Washington',
  BOS: 'Boston',
  MIA: 'Miami',
  MCO: 'Orlando',
  LAS: 'Las Vegas',
  PHX: 'Phoenix',
  DEN: 'Denver',
  DTW: 'Detroit',
  MSP: 'Minneapolis',
  PHL: 'Philadelphia',

  // --- ASIA / PACIFIC & CENTRAL ASIA ---
  SIN: 'Singapore',
  KUL: 'Kuala Lumpur',
  BKK: 'Bangkok',
  DMK: 'Bangkok',
  HKT: 'Phuket',
  CNX: 'Chiang Mai',
  DPS: 'Bali',
  CGK: 'Jakarta',
  MNL: 'Manila',
  CEB: 'Cebu',
  SGN: 'Ho Chi Minh',
  HAN: 'Hanoi',
  DAD: 'Da Nang',
  PNH: 'Phnom Penh',
  REP: 'Siem Reap',
  RGN: 'Yangon',
  HKG: 'Hong Kong',
  MFM: 'Macau',
  TPE: 'Taipei',
  KHH: 'Kaohsiung',
  NRT: 'Tokyo',
  HND: 'Tokyo',
  KIX: 'Osaka',
  NGO: 'Nagoya',
  FUK: 'Fukuoka',
  ICN: 'Seoul',
  GMP: 'Seoul',
  PEK: 'Beijing',
  PKX: 'Beijing',
  BJS: 'Beijing',
  PVG: 'Shanghai',
  SHA: 'Shanghai',
  CAN: 'Guangzhou',
  SZX: 'Shenzhen',
  CTU: 'Chengdu',
  KTM: 'Kathmandu',
  CMB: 'Colombo',
  MLE: 'Male',
  DAC: 'Dhaka',
  CGP: 'Chittagong',
  PBH: 'Paro',
  ISB: 'Islamabad',
  LHE: 'Lahore',
  KHI: 'Karachi',
  TAS: 'Tashkent',
  ALA: 'Almaty',
  NQZ: 'Astana',
  FRU: 'Bishkek',
  DYU: 'Dushanbe',
  ASB: 'Ashgabat',
  BAK: 'Baku',
  TBS: 'Tbilisi',
  EVN: 'Yerevan',

  // --- AUSTRALIA & NEW ZEALAND ---
  SYD: 'Sydney',
  MEL: 'Melbourne',
  BNE: 'Brisbane',
  PER: 'Perth',
  ADL: 'Adelaide',
  AKL: 'Auckland',
  CHC: 'Christchurch',
  WLG: 'Wellington',

  // --- AFRICA ---
  NBO: 'Nairobi',
  MBA: 'Mombasa',
  ADD: 'Addis Ababa',
  JNB: 'Johannesburg',
  CPT: 'Cape Town',
  MRU: 'Mauritius',
  SEZ: 'Seychelles',
  DAR: 'Dar es Salaam',
  EBB: 'Entebbe',
  LOS: 'Lagos',
  ACC: 'Accra',
  CMN: 'Casablanca',
  TUN: 'Tunis',
  ALG: 'Algiers'
};

/**
 * Returns clean city name for an airport code.
 * Falls back to master routes list, then AIRPORT_CITIES dictionary, then code itself.
 */
export function getCityName(code, routesList = []) {
  if (!code) return '';
  const clean = String(code).trim().toUpperCase();

  // 1. Check master routes list
  if (Array.isArray(routesList) && routesList.length > 0) {
    const fromOrigin = routesList.find(r => r.origin === clean && r.origin_city);
    if (fromOrigin) return fromOrigin.origin_city;
    const fromDest = routesList.find(r => r.destination === clean && r.dest_city);
    if (fromDest) return fromDest.dest_city;
  }

  // 2. Check dictionary
  if (AIRPORT_CITIES[clean]) {
    return AIRPORT_CITIES[clean];
  }

  // 3. Fallback to code
  return clean;
}

/**
 * Formats route with full city names.
 * Format 'TO' (default): "Delhi to Milan"
 * Format 'ARROW': "Delhi → Milan"
 * Format 'FULL': "Delhi (DEL) to Milan (MXP)"
 * Format 'CODE': "DEL → MXP"
 */
export function formatRouteName(origin, destination, format = 'TO', routesList = []) {
  if (!origin || !destination) return '';
  const origClean = String(origin).trim().toUpperCase();
  const destClean = String(destination).trim().toUpperCase();

  const origCity = getCityName(origClean, routesList);
  const destCity = getCityName(destClean, routesList);

  switch (format) {
    case 'TO':
      return `${origCity} to ${destCity}`;
    case 'ARROW':
      return `${origCity} → ${destCity}`;
    case 'FULL':
      return `${origCity} (${origClean}) to ${destCity} (${destClean})`;
    case 'CODE':
    default:
      return `${origClean} → ${destClean}`;
  }
}

/**
 * Normalizes airport aliases to canonical 3-letter code
 * MIL/LIN/BGY -> MXP, FCO/CIA -> ROM
 */
export function getCanonicalAirportCode(code) {
  if (!code) return '';
  const upper = String(code).trim().toUpperCase();
  if (upper === 'MIL' || upper === 'LIN' || upper === 'BGY') return 'MXP';
  if (upper === 'FCO' || upper === 'CIA') return 'ROM';
  return upper;
}

const INDIAN_AIRPORTS_SET = new Set([
  'DEL', 'ATQ', 'IXC', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU', 'AMD', 'COK',
  'GOI', 'GOX', 'JAI', 'LKO', 'TRV', 'CCJ', 'CNN', 'IXE', 'PAT', 'GAU',
  'SXR', 'IXJ', 'PNQ', 'NAG', 'IDR', 'BBI', 'AIP', 'NDC'
]);

/**
 * Compare two routes so UP (Outbound from India) and DOWN (Return / Inbound to India)
 * are always kept immediately next to each other!
 * Example: ATQ -> DXB followed immediately by DXB -> ATQ
 *          DEL -> MXP followed immediately by MXP -> DEL
 */
export function compareRoutesUpDown(rawOrigA, rawDestA, rawOrigB, rawDestB) {
  const origA = getCanonicalAirportCode(rawOrigA);
  const destA = getCanonicalAirportCode(rawDestA);
  const origB = getCanonicalAirportCode(rawOrigB);
  const destB = getCanonicalAirportCode(rawDestB);

  // Exact same route
  if (origA === origB && destA === destB) return 0;

  const cityOrigA = getCityName(origA);
  const cityDestA = getCityName(destA);
  const cityOrigB = getCityName(origB);
  const cityDestB = getCityName(destB);

  const aIsOutbound = INDIAN_AIRPORTS_SET.has(origA) && !INDIAN_AIRPORTS_SET.has(destA);
  const aIsInbound = !INDIAN_AIRPORTS_SET.has(origA) && INDIAN_AIRPORTS_SET.has(destA);

  const bIsOutbound = INDIAN_AIRPORTS_SET.has(origB) && !INDIAN_AIRPORTS_SET.has(destB);
  const bIsInbound = !INDIAN_AIRPORTS_SET.has(origB) && INDIAN_AIRPORTS_SET.has(destB);

  let pairA_Base, pairA_Foreign;
  if (aIsOutbound) {
    pairA_Base = cityOrigA;
    pairA_Foreign = cityDestA;
  } else if (aIsInbound) {
    pairA_Base = cityDestA;
    pairA_Foreign = cityOrigA;
  } else {
    const sorted = [cityOrigA, cityDestA].sort();
    pairA_Base = sorted[0];
    pairA_Foreign = sorted[1];
  }

  let pairB_Base, pairB_Foreign;
  if (bIsOutbound) {
    pairB_Base = cityOrigB;
    pairB_Foreign = cityDestB;
  } else if (bIsInbound) {
    pairB_Base = cityDestB;
    pairB_Foreign = cityOrigB;
  } else {
    const sorted = [cityOrigB, cityDestB].sort();
    pairB_Base = sorted[0];
    pairB_Foreign = sorted[1];
  }

  // 1. Sort by Base City (e.g. Amritsar, Chandigarh, Delhi...)
  const baseCmp = pairA_Base.localeCompare(pairB_Base);
  if (baseCmp !== 0) return baseCmp;

  // 2. Sort by Foreign City (e.g. Dubai, Milan, Rome...)
  const foreignCmp = pairA_Foreign.localeCompare(pairB_Foreign);
  if (foreignCmp !== 0) return foreignCmp;

  // 3. WITHIN same pair: Outbound (UP) before Inbound (DOWN)
  if (aIsOutbound && bIsInbound) return -1;
  if (aIsInbound && bIsOutbound) return 1;

  // 4. Tie-break by origin code then dest code
  const oCmp = origA.localeCompare(origB);
  if (oCmp !== 0) return oCmp;
  return destA.localeCompare(destB);
}

/**
 * Sorts any list of sectors or sector objects so UP and DOWN are placed side-by-side
 */
export function sortSectorsUpAndDown(sectors = []) {
  return sectors.slice().sort((a, b) => {
    return compareRoutesUpDown(a.origin, a.destination, b.origin, b.destination);
  });
}
