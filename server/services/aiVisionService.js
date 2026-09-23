/**
 * AI Vision Extraction Service using OpenAI ChatGPT (GPT-4o-mini Vision) & Google Gemini Vision
 */

const { parseDateString, normalizeAirlineCode, parseWhatsAppFareText } = require('./whatsappParser');

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
  'airasia': 'AK',
  'thai airways': 'TG',
  'thai lion air': 'SL',
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
  'adampur': 'AIP',
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
  'dubai': 'DXB',
  'sharjah': 'SHJ',
  'delhi': 'DEL',
  'mumbai': 'BOM',
  'bangalore': 'BLR',
  'hyderabad': 'HYD',
  'chennai': 'MAA',
  'kolkata': 'CCU',
  'doha': 'DOH',
  'kuwait': 'KWI',
  'milan': 'MXP',
  'millan': 'MXP',
  'malpensa': 'MXP',
  'rome': 'ROM',
  'fiumicino': 'ROM',
  'toronto': 'YYZ',
  'kuala lumpur': 'KUL',
  'singapore': 'SIN'
};

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
    let origin = (item.origin || routeOrigin || defaults.origin || defaults.defaultOrigin || 'ATQ').toUpperCase().trim();
    let destination = (item.destination || routeDest || defaults.destination || defaults.defaultDestination || 'DXB').toUpperCase().trim();
    
    // Clean airline code using normalizeAirlineCode (never slices raw string into invalid code like "IN")
    const rawAirline = item.airline_code || item.airline || defaults.airline || defaults.defaultAirline || 'AI';
    const cleanAirline = normalizeAirlineCode(rawAirline, item.flight_number, defaults.airline || defaults.defaultAirline || 'AI');

    // Map full names if returned
    if (CITY_IATA_MAP[origin.toLowerCase()]) origin = CITY_IATA_MAP[origin.toLowerCase()];
    if (CITY_IATA_MAP[destination.toLowerCase()]) destination = CITY_IATA_MAP[destination.toLowerCase()];

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
  try {
    const parsed = parseModelPayload(rawText);
    flyerText = parsed.flyerText || '';
    rawRecords = parsed.records || [];
  } catch (_) {
    flyerText = String(rawText || '');
  }

  const fromJson = standardizeAIRecords(rawRecords, defaults);
  const textForParser = flyerText || (!fromJson.length ? String(rawText || '') : '');
  let fromText = [];
  if (textForParser && /\d/.test(textForParser) && /[a-z]/i.test(textForParser)) {
    try {
      fromText = parseWhatsAppFareText(textForParser, defaults).records || [];
    } catch (_) {}
  }
  return unionVisionRecords([fromJson, fromText]);
}

const VISION_SYSTEM_PROMPT = `You are an expert AI flight data extractor for travel agents.
Extract ALL flight fares from this airline rate card flyer image into clean, structured JSON.

CRITICAL INSTRUCTIONS:
1. MULTI-SECTOR & MULTI-AIRLINE DETECTION (DO NOT STOP AFTER ONE SECTOR):
   - A single flyer often contains MULTIPLE SECTORS (e.g. BOTH "ATQ - DXB" AND "ATQ - SHJ", "IXC - DXB", etc.) or MULTIPLE AIRLINES (e.g. BOTH "Air India Express (IX)" AND "IndiGo (6E)", "SpiceJet (SG)").
   - You MUST extract flight records for ALL sectors and ALL airlines found on the image! Do NOT restrict yourself to only one sector or one airline.
   - Scan every single row, column, table, and flight card from left-to-right and top-to-bottom.

2. GRID OF FLIGHT RATE CARDS / BOXES (30 to 100+ CARDS):
   - If the flyer consists of a grid of rectangular cards/boxes (e.g. multiple rows and columns of cards):
     * Read the Route on each card (e.g. some cards are "ATQ - SHJ", while other cards are "ATQ - DXB").
     * Read the Travel Date (e.g. "08/10/2026", "15 OCT", "22-10-2026").
     * Read the Net Fare (e.g. "16200", "Fare: 17500/-").
     * Read the Airline (e.g. "Air India Express" -> "IX", "IndiGo" -> "6E", "SpiceJet" -> "SG").
   - You MUST scan EVERY card row-by-row and column-by-column.
   - Do NOT stop after 30 cards or after one sector! Extract ALL cards (even if there are 60, 70, or 80+ cards on the sheet). Every card with a date and fare MUST be included in the "records" array.

3. SECTOR & ROUTE EXTRACTION:
   - The flyer may contain ANY SECTOR (domestic or international).
   - Look for route indicators such as "AIP - NDC", "ATQ → DXB", "ATQ - SHJ", "IXC -> DXB", "DEL - BOM", etc.
   - For "AIP - NDC", Origin is "AIP" (Adampur) and Destination is "NDC" (Nanded).
   - For "IXC - DXB", Origin is "IXC" (Chandigarh) and Destination is "DXB" (Dubai).
   - For "SG ATQ → DXB", Airline is "SG" (SpiceJet), Origin is "ATQ", Destination is "DXB".
   - CRITICAL: NEVER force, assume, or default the route to "ATQ - DXB" if the flyer shows a different route (such as AIP - NDC, IXC - DXB, etc.). ALWAYS extract the EXACT 3-letter origin and destination airport codes written on the flyer or calendar cell!

4. AIRLINE & FLIGHT NUMBER EXTRACTION:
   - Look for airline indicators such as:
     * "S5" or "S5235/186" -> Airline is "S5" (Star Air), flight_number is "S5 235/186".
     * "IX" or "IX 191" -> Airline is "IX" (Air India Express).
     * "SG" -> SpiceJet (SG).
     * "6E" -> IndiGo (6E).
     * "AI" -> Air India (AI).
     * "UK" -> Vistara (UK).
     * "QP" -> Akasa Air (QP).
     * "IC" -> Fly91 (IC).
     * "G9" -> Air Arabia (G9).
     * "FZ" -> Flydubai (FZ).
   - CRITICAL: ALWAYS return ONLY the 2-letter uppercase IATA code for airline_code (e.g. "6E", "IX", "SG", "AI", "UK", "QP", "G9", "FZ", "S5", "IC", "EK", "EY", "QR", "WY"). NEVER output full airline names like "IndiGo", "SpiceJet", or "IndiGo (6E)" in the airline_code field!
   - NEVER overwrite or default S5, SG, IX, 6E to AI.

3. CALENDAR VIEW / MONTHLY GRID FLYERS:
   - If the flyer is structured as a monthly calendar (e.g. header says "Sep 2026", "October 2026", etc.):
     * Read the Month & Year header (e.g. "Sep 2026" means Year: 2026, Month: 09).
     * Identify each active day cell (highlighted in red, blue, green, or bold text).
     * Each active day box contains:
       - The Day number of the month (e.g. 15, 18, 21, 22, 26, 27, 30) -> travel_date: "2026-09-15", "2026-09-18", etc.
       - Route line (e.g. "AIP - NDC") -> origin: "AIP", destination: "NDC".
       - Airline & Flight Number (e.g. "S5 S5235/186") -> airline_code: "S5", flight_number: "S5 235/186".
       - Departure time (e.g. "13:20", "13:50", "12:30").
       - Available seats (e.g. "AS - 1", "AS - 2").
       - Fare amount (e.g. "Rs 9700.00" or "9700") -> net_fare: 9700.
     * Output a distinct record for EVERY active highlighted day box in the calendar!

4. MULTI-DATE STREAKS & RANGES (FOR TEXT FLYERS):
   - For lines with multiple dates (e.g., "15 SEP & 16 SEP & 17 SEP & 18 SEP 20800"), generate a SEPARATE record for EVERY date with that net fare.
   - For date ranges (e.g., "23 SEP TO 02 OCT (ALL DATES) 17800"), generate a SEPARATE record for EVERY individual calendar day from start date to end date with that net fare.

5. IATA CODES CONVERSION:
   - Convert city names to 3-letter IATA airport codes:
     * Adampur / Jalandhar = AIP
     * Nanded = NDC
     * Amritsar = ATQ
     * Dubai = DXB
     * Sharjah = SHJ
     * Chandigarh = IXC
     * Delhi = DEL
     * Mumbai = BOM
     * Hindon = HDO
     * Kishangarh = KQH

6. CLEAN NET FARE:
   - Extract clean numeric Net Fare (e.g. 9700 from "Rs 9700.00", 20800 from "₹20,800"). Ignore timing brackets like "(08.25 AM - 02.55 AM)" or seat labels like "AS - 1".
7. Detect Baggage (e.g., "15kg", "30kg", "30 + 07 KG") and Refundability ("NON_REFUNDABLE" or "REFUNDABLE").

Return ONLY a valid JSON object matching this schema.
Copy each table line into flyer_text exactly as printed (keep "20 SEP & 21 SEP" and "01 OCT TO 05 OCT" — do not expand them).
Also put one records[] item per printed row, with date_text copied exactly and net_fare as a number.
{
  "flyer_text": "AIR INDIA EXPRESS\\nAMRITSAR DUBAI\\n20 SEP & 21 SEP 17000\\n01 OCT TO 05 OCT (ALL DATES) 18000",
  "records": [
    {
      "origin": "ATQ",
      "destination": "DXB",
      "airline_code": "IX",
      "flight_number": "",
      "date_text": "20 SEP & 21 SEP",
      "net_fare": 17000,
      "baggage": "30kg",
      "is_refundable": "NON_REFUNDABLE"
    },
    {
      "origin": "ATQ",
      "destination": "DXB",
      "airline_code": "IX",
      "flight_number": "IX 191",
      "travel_date": "2026-09-16",
      "net_fare": 20800,
      "baggage": "30kg",
      "is_refundable": "NON_REFUNDABLE"
    }
  ]
}
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

/**
 * Dynamically find the best active Gemini model for the user's API Key
 */
async function getGeminiCandidateModels(apiKey) {
  const fallbackModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-8b',
    'gemini-3.6-flash',
    'gemini-2.5-pro',
    'gemini-1.5-pro'
  ];

  if (!apiKey) return fallbackModels;

  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 6000);
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`, {
      signal: abort.signal
    });
    clearTimeout(timer);

    if (listRes.ok) {
      const data = await listRes.json();
      if (Array.isArray(data.models)) {
        const available = data.models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(m => !m.includes('embedding') && !m.includes('aqa') && !m.includes('imagen') && !m.includes('bison'));

        // Rank models: flash first, then lite, then others
        const score = (name) => {
          if (name === 'gemini-2.5-flash') return 120;
          if (name === 'gemini-2.0-flash') return 110;
          if (name === 'gemini-1.5-flash') return 100;
          if (name.includes('flash') && !name.includes('lite') && !name.includes('8b')) return 95;
          if (name.includes('flash-lite')) return 90;
          if (name.includes('flash-8b')) return 85;
          if (name.includes('pro')) return 60;
          return 50;
        };

        const ranked = available.sort((a, b) => score(b) - score(a));

        if (ranked.length > 0) {
          console.log(`📡 Dynamically discovered ${ranked.length} Gemini models for user key:`, ranked.slice(0, 6).join(', '));
          return ranked;
        }
      }
    }
  } catch (e) {
    console.warn('Could not auto-fetch Gemini models list:', e.message);
  }

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
async function parseImageWithGemini(imageBase64, apiKey, defaults = {}) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is required. Please enter your Gemini API Key in the settings.');
  }

  const pureBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const mimeType = imageBase64.includes('data:') 
    ? imageBase64.slice(5, imageBase64.indexOf(';'))
    : 'image/jpeg';

  const models = await getGeminiCandidateModels(apiKey);

  let lastError = null;
  const startedAt = Date.now();

  for (const model of models) {
    if (Date.now() - startedAt > 58000) break;
    const plain = String(model).endsWith('#plain');
    const modelId = plain ? String(model).slice(0, -6) : model;
    const abort = new AbortController();
    const abortTimer = setTimeout(() => abort.abort(), 18000);
    try {
      console.log(`🚀 Scanning flyer with Gemini model: ${modelId}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey.trim()}`;

      const genConfig = {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 8192
      };

      if (!plain && (modelId.includes('thinking') || modelId.includes('3.6'))) {
        genConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' };
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
                  inline_data: {
                    mime_type: mimeType,
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
        const retired = response.status === 404 || /no longer available|not found|is not supported/i.test(msg);
        if (queuePlain || retired || isGeminiCapacityError(response.status, msg)) {
          console.log(`🔄 Switching to next Gemini candidate model...`);
          continue;
        }
        break;
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
        ? new Error('Gemini response time se bahar chala gaya. Agle model par switch kar rahe hain...')
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
