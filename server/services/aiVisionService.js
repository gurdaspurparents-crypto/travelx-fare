/**
 * AI Vision Extraction Service using OpenAI ChatGPT (GPT-4o-mini Vision) & Google Gemini Vision
 */

const { parseDateString, normalizeAirlineCode } = require('./whatsappParser');

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
function standardizeAIRecords(rawRecords = [], defaults = {}) {
  const currentYear = new Date().getFullYear();
  const cleaned = [];

  for (const item of rawRecords) {
    let origin = (item.origin || defaults.origin || defaults.defaultOrigin || 'ATQ').toUpperCase().trim();
    let destination = (item.destination || defaults.destination || defaults.defaultDestination || 'DXB').toUpperCase().trim();
    
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

    // Clean travel date into YYYY-MM-DD
    const dateStr = parseDateString(item.travel_date, currentYear);
    const fare = parseFloat(String(item.net_fare).replace(/[^0-9.]/g, ''));

    if (dateStr && !isNaN(fare) && fare > 500) {
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

Return ONLY a valid JSON object matching this schema:
{
  "records": [
    {
      "origin": "AIP",
      "destination": "NDC",
      "airline_code": "S5",
      "flight_number": "S5 235/186",
      "travel_date": "2026-09-15",
      "net_fare": 9700,
      "baggage": "15kg",
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

  const parsed = JSON.parse(rawContent);
  const records = standardizeAIRecords(parsed.records || [], defaults);

  return {
    success: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    records,
    count: records.length,
    rawText: JSON.stringify(parsed, null, 2)
  };
}

/**
 * Dynamically find the best active Gemini model for the user's API Key
 */
function getGeminiCandidateModels() {
  // Fixed fast models only. Listing every account model made scans try 5–10 APIs in a row.
  return ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
}

/**
 * Parse Image using Google Gemini Vision (Auto-discovers active model e.g. gemini-3.6-flash)
 */
async function parseImageWithGemini(imageBase64, apiKey, defaults = {}) {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is required. Please enter your Gemini API Key in the settings.');
  }

  const pureBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const mimeType = imageBase64.includes('data:') 
    ? imageBase64.slice(5, imageBase64.indexOf(';'))
    : 'image/jpeg';

  const models = getGeminiCandidateModels();

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`🚀 Scanning flyer with Gemini model: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

      const response = await fetch(url, {
        method: 'POST',
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
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 8192
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let errJson;
        try { errJson = JSON.parse(errText); } catch (_) {}
        const msg = errJson?.error?.message || `Gemini API Error (${response.status}): ${errText}`;
        lastError = new Error(msg);
        console.warn(`❌ Model ${model} failed (${response.status}): ${msg}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        console.warn(`⚠️ No candidate text returned for ${model}, trying next...`);
        continue;
      }

      const parsed = JSON.parse(rawText);
      const records = standardizeAIRecords(parsed.records || [], defaults);

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
      lastError = err;
      console.warn(`❌ Exception with model ${model}:`, err.message);
      continue;
    }
  }

  throw lastError || new Error('Failed to query Gemini models.');
}

module.exports = {
  parseImageWithOpenAI,
  parseImageWithGemini
};
