const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

const CITY_CODES = [
  ['amritsar', 'ATQ'],
  ['sharjah', 'SHJ'],
  ['dubai', 'DXB'],
  ['doha', 'DOH'],
  ['kuwait', 'KWI'],
  ['delhi', 'DEL'],
  ['mumbai', 'BOM'],
  ['singapore', 'SIN'],
  ['atq', 'ATQ'],
  ['shj', 'SHJ'],
  ['dxb', 'DXB']
];

const AIRLINE_CODES = [
  ['air india express', 'IX'],
  ['indigo', '6E'],
  ['spicejet', 'SG'],
  ['spice jet', 'SG'],
  ['air arabia', 'G9'],
  ['flydubai', 'FZ'],
  ['fly dubai', 'FZ'],
  ['air india', 'AI']
];

function isoDate(year, monthIndex, day) {
  if (monthIndex == null || day < 1 || day > 31) return null;
  const dt = new Date(year, monthIndex, day);
  if (dt.getMonth() !== monthIndex || dt.getDate() !== day) return null;
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function monthIndex(token) {
  if (!token) return null;
  return MONTHS[String(token).toLowerCase().slice(0, 3)] ?? null;
}

function expandRange(startDay, startMonth, endDay, endMonth, year) {
  const start = new Date(year, startMonth, startDay);
  let end = new Date(year, endMonth, endDay);
  if (end < start) end = new Date(year + 1, endMonth, endDay);
  const out = [];
  for (let d = new Date(start); d <= end && out.length < 62; d.setDate(d.getDate() + 1)) {
    out.push(isoDate(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return out.filter(Boolean);
}

function pickFare(line) {
  const matches = [...line.matchAll(/\b(\d{4,6})\b/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const n = Number(matches[i][1]);
    if (n >= 1000 && n <= 500000 && !(n >= 2020 && n <= 2035)) return n;
  }
  return null;
}

function pushRecord(records, seen, base, travelDate, fare) {
  if (!travelDate || !fare) return;
  const key = `${base.airline_code}|${base.origin}|${base.destination}|${travelDate}|${fare}`;
  if (seen.has(key)) return;
  seen.add(key);
  records.push({
    airline_code: base.airline_code,
    origin: base.origin,
    destination: base.destination,
    travel_date: travelDate,
    net_fare: fare,
    flight_number: '',
    cabin: 'ECONOMY',
    baggage: base.baggage || '30kg',
    is_refundable: base.is_refundable || 'NON_REFUNDABLE',
    remarks: 'Flyer scan'
  });
}

export function parseFlyerText(raw, defaults = {}) {
  const year = new Date().getFullYear();
  const base = {
    airline_code: defaults.defaultAirline || 'AI',
    origin: defaults.defaultOrigin || 'ATQ',
    destination: defaults.defaultDestination || 'DXB',
    baggage: defaults.defaultBaggage || '30kg',
    is_refundable: defaults.defaultRefundable || 'NON_REFUNDABLE'
  };
  const records = [];
  const seen = new Set();
  const lines = String(raw || '').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/[|₹]/g, ' ')
      .replace(/\((?:all dates|timings?)\)/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line) continue;
    const lower = line.toLowerCase();

    for (const [name, code] of AIRLINE_CODES) {
      if (lower.includes(name)) {
        base.airline_code = code;
        break;
      }
    }

    const cities = [];
    for (const [name, code] of CITY_CODES) {
      if (new RegExp(`\\b${name}\\b`, 'i').test(lower) && !cities.includes(code)) cities.push(code);
    }
    const fare = pickFare(line);
    if (cities.length >= 2 && !fare) {
      base.origin = cities[0];
      base.destination = cities[1];
      continue;
    }

    if (!fare) continue;

    const range = line.match(/(\d{1,2})\s+([a-z]{3,9})\s+(?:to|till|-)\s+(\d{1,2})\s+([a-z]{3,9})/i);
    if (range) {
      const m1 = monthIndex(range[2]);
      const m2 = monthIndex(range[4]);
      for (const date of expandRange(Number(range[1]), m1, Number(range[3]), m2, year)) {
        pushRecord(records, seen, base, date, fare);
      }
      continue;
    }

    const chunks = line.split(/\s*(?:&|,|\+)\s*/);
    let matched = false;
    for (const chunk of chunks) {
      const one = chunk.match(/(\d{1,2})\s+([a-z]{3,9})/i);
      if (!one) continue;
      const date = isoDate(year, monthIndex(one[2]), Number(one[1]));
      if (!date) continue;
      matched = true;
      pushRecord(records, seen, base, date, fare);
    }
    if (!matched) {
      const one = line.match(/(\d{1,2})\s+([a-z]{3,9})/i);
      if (one) pushRecord(records, seen, base, isoDate(year, monthIndex(one[2]), Number(one[1])), fare);
    }
  }

  return { success: records.length > 0, records, count: records.length };
}
