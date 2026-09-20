/**
 * Comprehensive Airport / City Mapping and Route Formatter (Server CommonJS)
 * Maps 3-letter IATA airport codes to full city names (e.g., DEL -> Delhi, MXP -> Milan, ROM -> Rome)
 */

const AIRPORT_CITIES = {
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

function getCityName(code, routesList = []) {
  if (!code) return '';
  const clean = String(code).trim().toUpperCase();

  if (Array.isArray(routesList) && routesList.length > 0) {
    const fromOrigin = routesList.find(r => r.origin === clean && r.origin_city);
    if (fromOrigin) return fromOrigin.origin_city;
    const fromDest = routesList.find(r => r.destination === clean && r.dest_city);
    if (fromDest) return fromDest.dest_city;
  }

  if (AIRPORT_CITIES[clean]) {
    return AIRPORT_CITIES[clean];
  }

  return clean;
}

function formatRouteName(origin, destination, format = 'TO', routesList = []) {
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

module.exports = {
  AIRPORT_CITIES,
  getCityName,
  formatRouteName
};
