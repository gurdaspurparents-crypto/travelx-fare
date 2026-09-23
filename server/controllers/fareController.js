const db = require('../config/database');
const { calculateMargin } = require('../services/marginCalculator');
const { evaluateVendorAdjustment } = require('../services/vendorPricingEngine');
const { parseWhatsAppFareText, parseDateString, normalizeAirlineCode } = require('../services/whatsappParser');
const { parseImageWithOpenAI, parseImageWithGemini } = require('../services/aiVisionService');

function safeInvalidateFaresCache() {
  try {
    const publicCtrl = require('./publicAgentController');
    if (publicCtrl && typeof publicCtrl.invalidateFaresCache === 'function') {
      publicCtrl.invalidateFaresCache();
    }
  } catch (_) {}
}

const STMT_GET_EXISTING_FARE = db.prepare(`
  SELECT * FROM fares 
  WHERE vendor_id = ? 
    AND airline_code = ? 
    AND origin = ? 
    AND destination = ? 
    AND travel_date = ? 
    AND cabin = ?
    AND (flight_number = ? OR (flight_number IS NULL AND ? = ''))
  LIMIT 1
`);

const STMT_AFFIRM_DUPLICATE = db.prepare(`
  UPDATE fares 
  SET updated_at = datetime('now', 'localtime'),
      baggage = COALESCE(?, baggage),
      is_refundable = COALESCE(?, is_refundable),
      remarks = COALESCE(?, remarks)
  WHERE id = ?
`);

const STMT_INSERT_FARE_HISTORY = db.prepare(`
  INSERT INTO fare_history (fare_id, vendor_id, airline_code, origin, destination, travel_date, flight_number, old_fare, new_fare, fare_diff, recorded_at, reason)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)
`);

const STMT_UPDATE_FARE_PRICE = db.prepare(`
  UPDATE fares 
  SET net_fare = ?,
      margin_amount = ?,
      publish_fare = ?,
      baggage = ?,
      is_refundable = ?,
      remarks = ?,
      updated_at = datetime('now', 'localtime')
  WHERE id = ?
`);

const STMT_INSERT_FARE = db.prepare(`
  INSERT INTO fares (
    vendor_id, airline_code, origin, destination, travel_date, 
    flight_number, departure_time, arrival_time, net_fare, currency, 
    cabin, baggage, is_refundable, remarks, margin_amount, publish_fare, is_published, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now', 'localtime'), datetime('now', 'localtime'))
`);

/**
 * Helper to save or update a single fare with duplicate handling and history tracking
 * @param {object} options.bulkMode — skip per-row cache invalidation (bulk import)
 */
function saveOrUpdateFareRecord(data, options = {}) {
  const bulkMode = options.bulkMode === true;

  const {
    vendor_id,
    airline_code,
    origin,
    destination,
    travel_date,
    flight_number = '',
    departure_time = '',
    arrival_time = '',
    net_fare,
    currency = 'INR',
    cabin = 'ECONOMY',
    baggage = '30kg',
    is_refundable = 'NON_REFUNDABLE',
    remarks = '',
    custom_margin = null
  } = data;

  // Normalize airline to canonical 2-letter IATA code
  const effectiveAirline = normalizeAirlineCode(airline_code, flight_number, 'AI');

  const numFare = Number(net_fare);
  if (!vendor_id || !effectiveAirline || !origin || !destination || !travel_date || !numFare || numFare <= 0) {
    throw new Error('Mandatory fields missing: Vendor, Airline, Origin, Destination, Travel Date, Net Fare are required.');
  }

  // Normalize travel_date to ISO YYYY-MM-DD format (enforcing defaultYear >= 2026)
  const currentYear = new Date().getFullYear();
  const cleanTravelDate = parseDateString(travel_date, currentYear) || String(travel_date).trim();

  // Auto-apply vendor pricing rules (e.g. Bipasha discount or Gulf sector slab markup)
  const vendorAdj = evaluateVendorAdjustment({
    vendor_id,
    airline_code: effectiveAirline,
    origin,
    destination,
    net_fare: numFare
  });
  const effectiveFare = vendorAdj.adjustedFare;
  const effectiveRemarks = vendorAdj.adjustmentType !== 'NONE'
    ? (remarks ? `${remarks} (${vendorAdj.ruleApplied})` : vendorAdj.ruleApplied)
    : remarks;

  // Calculate margin and publish fare
  const marginCalc = calculateMargin(effectiveFare, effectiveAirline, origin, destination, custom_margin);

  // Check for existing matching active fare for this vendor
  const existing = STMT_GET_EXISTING_FARE.get(
    vendor_id,
    effectiveAirline,
    origin.toUpperCase(),
    destination.toUpperCase(),
    cleanTravelDate,
    cabin,
    flight_number,
    flight_number
  );

  if (existing) {
    // Duplicate Detection:
    // Case 1: Exact same fare
    if (Math.abs(existing.net_fare - effectiveFare) < 0.01) {
      STMT_AFFIRM_DUPLICATE.run(
        baggage,
        is_refundable,
        effectiveRemarks || existing.remarks,
        existing.id
      );

      return {
        id: existing.id,
        status: 'DUPLICATE_AFFIRMED',
        message: 'Existing fare verified and timestamp updated',
        net_fare: effectiveFare,
        publish_fare: existing.publish_fare
      };
    }

    // Case 2: Price changed! Record in history and update fare
    const fareDiff = effectiveFare - existing.net_fare;
    STMT_INSERT_FARE_HISTORY.run(
      existing.id,
      vendor_id,
      effectiveAirline,
      origin.toUpperCase(),
      destination.toUpperCase(),
      cleanTravelDate,
      flight_number,
      existing.net_fare,
      effectiveFare,
      fareDiff,
      `Intraday fare change: ${fareDiff > 0 ? '+' : ''}${fareDiff}`
    );

    STMT_UPDATE_FARE_PRICE.run(
      effectiveFare,
      marginCalc.marginAmount,
      marginCalc.publishFare,
      baggage,
      is_refundable,
      effectiveRemarks,
      existing.id
    );

    if (!bulkMode) safeInvalidateFaresCache();

    return {
      id: existing.id,
      status: 'UPDATED_WITH_HISTORY',
      message: `Fare updated from ₹${existing.net_fare} to ₹${effectiveFare} (Diff: ${fareDiff > 0 ? '+' : ''}₹${fareDiff})`,
      old_fare: existing.net_fare,
      new_fare: effectiveFare,
      fare_diff: fareDiff,
      publish_fare: marginCalc.publishFare
    };
  }

  // Case 3: Brand new fare record
  const result = STMT_INSERT_FARE.run(
    vendor_id,
    effectiveAirline,
    origin.toUpperCase(),
    destination.toUpperCase(),
    cleanTravelDate,
    flight_number,
    departure_time,
    arrival_time,
    effectiveFare,
    currency,
    cabin,
    baggage,
    is_refundable,
    effectiveRemarks,
    marginCalc.marginAmount,
    marginCalc.publishFare
  );

  if (!bulkMode) safeInvalidateFaresCache();

  return {
    id: result.lastInsertRowid,
    status: 'CREATED',
    message: 'New fare created successfully',
    net_fare: effectiveFare,
    margin_amount: marginCalc.marginAmount,
    publish_fare: marginCalc.publishFare
  };
}

/**
 * Controller: Add single fare
 */
exports.createSingleFare = (req, res) => {
  try {
    const result = saveOrUpdateFareRecord(req.body);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('Error creating fare:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Quick Grid Batch Entry
 * User specifies Vendor, Airline, Route once, then sends multiple rows of [Date, Fare, Flight]
 */
exports.saveQuickGridFares = (req, res) => {
  const {
    vendor_id,
    airline_code,
    origin,
    destination,
    cabin = 'ECONOMY',
    baggage = '30kg',
    is_refundable = 'NON_REFUNDABLE',
    flight_number = '',
    remarks = '',
    entries = [], // array of { travel_date, net_fare, flight_number? }
    replace_missing_dates = false
  } = req.body;

  const effectiveAirline = normalizeAirlineCode(airline_code, flight_number, 'AI');

  if (!vendor_id || !effectiveAirline || !origin || !destination) {
    return res.status(400).json({
      success: false,
      error: 'Vendor, Airline, Origin, and Destination are required for Quick Grid'
    });
  }

  if (!entries || entries.length === 0) {
    return res.status(400).json({ success: false, error: 'No date/fare entries provided' });
  }

  const currentYear = new Date().getFullYear();
  const results = [];
  const errors = [];
  const deletedDates = [];

  const saveTx = db.transaction(() => {
    // If replace_missing_dates is requested, prune any existing dates for this sector not present in new entries
    if (replace_missing_dates) {
      const validDates = entries
        .filter(e => e.travel_date && Number(e.net_fare) > 0)
        .map(e => parseDateString(e.travel_date, currentYear) || String(e.travel_date).trim());

      if (validDates.length > 0) {
        const incomingDateSet = new Set(validDates);

        // Fetch ALL existing fares for this vendor in this sector and cabin (no date boundary restriction)
        const existingFares = db.prepare(`
          SELECT id, travel_date, net_fare, airline_code, origin, destination, flight_number 
          FROM fares
          WHERE vendor_id = ?
            AND UPPER(airline_code) = UPPER(?)
            AND UPPER(origin) = UPPER(?)
            AND UPPER(destination) = UPPER(?)
            AND UPPER(COALESCE(cabin, 'ECONOMY')) = UPPER(?)
        `).all(vendor_id, effectiveAirline, origin, destination, cabin || 'ECONOMY');

        const deleteStmt = db.prepare('DELETE FROM fares WHERE id = ?');
        const historyStmt = db.prepare(`
          INSERT INTO fare_history (fare_id, vendor_id, airline_code, origin, destination, travel_date, flight_number, old_fare, new_fare, fare_diff, recorded_at, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now', 'localtime'), 'Sold out / removed from vendor rate sheet')
        `);

        for (const ef of existingFares) {
          if (!incomingDateSet.has(ef.travel_date)) {
            try {
              historyStmt.run(ef.id, vendor_id, ef.airline_code, ef.origin, ef.destination, ef.travel_date, ef.flight_number || '', ef.net_fare, -ef.net_fare);
            } catch (hErr) {
              console.warn('Could not record delete history:', hErr.message);
            }
            deleteStmt.run(ef.id);
            deletedDates.push(ef.travel_date);
          }
        }
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.travel_date || !entry.net_fare) continue;

      try {
        const itemResult = saveOrUpdateFareRecord({
          vendor_id,
          airline_code,
          origin,
          destination,
          travel_date: entry.travel_date,
          flight_number: entry.flight_number || flight_number,
          departure_time: entry.departure_time || '',
          arrival_time: entry.arrival_time || '',
          net_fare: entry.net_fare,
          cabin,
          baggage: entry.baggage || baggage,
          is_refundable: entry.is_refundable || is_refundable,
          remarks: entry.remarks || remarks
        });
        results.push({ row: i + 1, date: entry.travel_date, fare: entry.net_fare, ...itemResult });
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }
  });

  try {
    saveTx();
    const isSuccess = results.length > 0;
    return res.json({
      success: isSuccess,
      total_processed: results.length,
      saved_count: results.length,
      deleted_count: deletedDates.length,
      deleted_dates: deletedDates,
      results,
      errors: errors.length > 0 ? errors : undefined,
      error: !isSuccess && errors.length > 0 ? errors[0].error : undefined
    });
  } catch (txErr) {
    console.error('Quick Grid transaction failed:', txErr);
    return res.status(500).json({ success: false, error: 'Transaction failed: ' + txErr.message });
  }
};

/**
 * Controller: Save Date Range Fares (e.g. 15-Sep to 30-Sep at same fare)
 */
exports.saveDateRangeFares = (req, res) => {
  const {
    vendor_id,
    airline_code,
    origin,
    destination,
    start_date,
    end_date,
    net_fare,
    flight_number = '',
    departure_time = '',
    arrival_time = '',
    cabin = 'ECONOMY',
    baggage = '30kg',
    is_refundable = 'NON_REFUNDABLE',
    remarks = ''
  } = req.body;

  if (!vendor_id || !airline_code || !origin || !destination || !start_date || !end_date || !net_fare) {
    return res.status(400).json({
      success: false,
      error: 'Vendor, Airline, Origin, Destination, Start Date, End Date, and Net Fare are required'
    });
  }

  const startDateObj = new Date(start_date);
  const endDateObj = new Date(end_date);

  if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
    return res.status(400).json({ success: false, error: 'Invalid start or end date' });
  }

  if (startDateObj > endDateObj) {
    return res.status(400).json({ success: false, error: 'Start date cannot be after end date' });
  }

  const dates = [];
  let curr = new Date(startDateObj);
  while (curr <= endDateObj) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }

  if (dates.length > 180) {
    return res.status(400).json({ success: false, error: 'Date range cannot exceed 180 days' });
  }

  const results = [];
  const errors = [];

  const rangeTx = db.transaction(() => {
    for (let i = 0; i < dates.length; i++) {
      const dt = dates[i];
      try {
        const itemResult = saveOrUpdateFareRecord({
          vendor_id,
          airline_code,
          origin,
          destination,
          travel_date: dt,
          flight_number,
          departure_time,
          arrival_time,
          net_fare: Number(net_fare),
          cabin,
          baggage,
          is_refundable,
          remarks: remarks || `Date range entry (${start_date} to ${end_date})`
        });
        results.push({ date: dt, ...itemResult });
      } catch (err) {
        errors.push({ date: dt, error: err.message });
      }
    }
  });

  try {
    rangeTx();
    const isSuccess = results.length > 0;
    return res.json({
      success: isSuccess,
      total_days: dates.length,
      saved_count: results.length,
      start_date,
      end_date,
      net_fare: Number(net_fare),
      results,
      errors: errors.length > 0 ? errors : undefined,
      error: !isSuccess && errors.length > 0 ? errors[0].error : undefined
    });
  } catch (err) {
    console.error('Date range transaction failed:', err);
    return res.status(500).json({ success: false, error: 'Transaction failed: ' + err.message });
  }
};


/**
 * Controller: Parse WhatsApp Bulk Text (Preview only)
 */
exports.parseWhatsAppText = (req, res) => {
  try {
    const { text, defaults = {} } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text content is required' });
    }
    const parsed = parseWhatsAppFareText(text, defaults);
    return res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('Parse error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Parse Rate Card Image using AI Vision (ChatGPT / Gemini)
 */
exports.parseImageWithAI = async (req, res) => {
  try {
    const { imageBase64, provider = 'openai', apiKey, defaults = {} } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'Image base64 data is required' });
    }

    let result;
    if (provider === 'gemini') {
      result = await parseImageWithGemini(imageBase64, apiKey || process.env.GEMINI_API_KEY, defaults);
    } else {
      // Default: OpenAI (ChatGPT)
      result = await parseImageWithOpenAI(imageBase64, apiKey || process.env.OPENAI_API_KEY, defaults);
    }

    return res.json(result);
  } catch (err) {
    console.error('AI Vision Parse Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

function preprocessBulkFares(fares) {
  const currentYear = new Date().getFullYear();
  for (const f of fares) {
    f.airline_code = normalizeAirlineCode(f.airline_code, f.flight_number, 'AI');
    const parsedD = parseDateString(f.travel_date, currentYear);
    if (parsedD) {
      f.travel_date = parsedD;
    }
  }
  return fares;
}

function runVendorInventorySync(vendor_id, fares, replace_mode = 'sector') {
  const deletedRecords = [];
  const deleteStmt = db.prepare('DELETE FROM fares WHERE id = ?');
  const historyStmt = db.prepare(`
    INSERT INTO fare_history (fare_id, vendor_id, airline_code, origin, destination, travel_date, flight_number, old_fare, new_fare, fare_diff, recorded_at, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now', 'localtime'), 'Sold out / removed from vendor rate sheet')
  `);

  if (replace_mode === 'entire_vendor') {
    const incomingKeySet = new Set();
    for (const f of fares) {
      if (!f.travel_date || !f.airline_code || !f.origin || !f.destination) continue;
      const key = `${f.airline_code.trim().toUpperCase()}_${f.origin.trim().toUpperCase()}_${f.destination.trim().toUpperCase()}_${(f.cabin || 'ECONOMY').trim().toUpperCase()}_${f.travel_date}`;
      incomingKeySet.add(key);
    }

    const allVendorFares = db.prepare(`
      SELECT id, travel_date, net_fare, airline_code, origin, destination, cabin, flight_number
      FROM fares
      WHERE vendor_id = ?
    `).all(vendor_id);

    for (const ef of allVendorFares) {
      const efKey = `${(ef.airline_code || '').trim().toUpperCase()}_${(ef.origin || '').trim().toUpperCase()}_${(ef.destination || '').trim().toUpperCase()}_${(ef.cabin || 'ECONOMY').trim().toUpperCase()}_${ef.travel_date}`;
      if (!incomingKeySet.has(efKey)) {
        try {
          historyStmt.run(ef.id, vendor_id, ef.airline_code, ef.origin, ef.destination, ef.travel_date, ef.flight_number || '', ef.net_fare, -ef.net_fare);
        } catch (hErr) {
          console.warn('Could not record delete history:', hErr.message);
        }
        deleteStmt.run(ef.id);
        deletedRecords.push(ef);
      }
    }
  } else {
    const sectorMap = new Map();
    for (const f of fares) {
      if (!f.travel_date || !f.airline_code || !f.origin || !f.destination) continue;
      const airline = f.airline_code.trim().toUpperCase();
      const origin = f.origin.trim().toUpperCase();
      const dest = f.destination.trim().toUpperCase();
      const cabin = (f.cabin || 'ECONOMY').trim().toUpperCase();
      const key = `${airline}_${origin}_${dest}_${cabin}`;

      if (!sectorMap.has(key)) {
        sectorMap.set(key, { airline_code: airline, origin, destination: dest, cabin, dates: new Set() });
      }
      sectorMap.get(key).dates.add(f.travel_date);
    }

    const existingStmt = db.prepare(`
      SELECT id, travel_date, net_fare, airline_code, origin, destination, cabin, flight_number 
      FROM fares
      WHERE vendor_id = ?
        AND UPPER(airline_code) = ?
        AND UPPER(origin) = ?
        AND UPPER(destination) = ?
        AND UPPER(COALESCE(cabin, 'ECONOMY')) = ?
    `);

    for (const sector of sectorMap.values()) {
      const existingFares = existingStmt.all(
        vendor_id,
        sector.airline_code,
        sector.origin,
        sector.destination,
        sector.cabin
      );

      for (const ef of existingFares) {
        if (!sector.dates.has(ef.travel_date)) {
          try {
            historyStmt.run(ef.id, vendor_id, ef.airline_code, ef.origin, ef.destination, ef.travel_date, ef.flight_number || '', ef.net_fare, -ef.net_fare);
          } catch (hErr) {
            console.warn('Could not record delete history:', hErr.message);
          }
          deleteStmt.run(ef.id);
          deletedRecords.push(ef);
        }
      }
    }
  }

  return deletedRecords;
}

/**
 * Sync vendor inventory after chunked bulk import (removes dates not in new sheet).
 */
exports.syncVendorInventory = (req, res) => {
  try {
    const { vendor_id, fares = [], replace_mode = 'sector' } = req.body;
    if (!vendor_id) {
      return res.status(400).json({ success: false, error: 'vendor_id required' });
    }
    if (!fares || fares.length === 0) {
      return res.status(400).json({ success: false, error: 'No fare keys provided for inventory sync' });
    }
    preprocessBulkFares(fares);
    const deletedRecords = runVendorInventorySync(vendor_id, fares, replace_mode);
    safeInvalidateFaresCache();
    return res.json({
      success: true,
      deleted_count: deletedRecords.length,
      deleted_dates: deletedRecords.slice(0, 100).map(d => `${d.origin}-${d.destination} (${d.airline_code}): ${d.travel_date}`)
    });
  } catch (err) {
    console.error('Inventory sync failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Save Bulk Parsed Fares after user review with Sector Inventory Sync
 */
exports.saveBulkParsedFares = (req, res) => {
  const {
    vendor_id,
    fares = [],
    replace_missing_dates = true,
    replace_mode = 'sector',
    skip_inventory_sync = false,
    summary_only = false
  } = req.body;
  if (!vendor_id) {
    return res.status(400).json({ success: false, error: 'Vendor must be selected to save fares' });
  }
  if (!fares || fares.length === 0) {
    return res.status(400).json({ success: false, error: 'No fare records to save' });
  }

  preprocessBulkFares(fares);

  const results = [];
  const errors = [];
  let deletedRecords = [];

  const bulkTx = db.transaction(() => {
    if (replace_missing_dates && !skip_inventory_sync) {
      deletedRecords = runVendorInventorySync(vendor_id, fares, replace_mode);
    }

    // 2. Insert or update incoming fares
    for (let i = 0; i < fares.length; i++) {
      const f = fares[i];
      try {
        const itemResult = saveOrUpdateFareRecord({
          vendor_id,
          airline_code: f.airline_code,
          origin: f.origin,
          destination: f.destination,
          travel_date: f.travel_date,
          flight_number: f.flight_number || '',
          departure_time: f.departure_time || '',
          arrival_time: f.arrival_time || '',
          net_fare: f.net_fare,
          cabin: f.cabin || 'ECONOMY',
          baggage: f.baggage || '30kg',
          is_refundable: f.is_refundable || 'NON_REFUNDABLE',
          remarks: f.remarks || 'Bulk WhatsApp/Flyer import'
        }, { bulkMode: true });
        results.push(itemResult);
      } catch (err) {
        errors.push({ row: i + 1, date: f.travel_date, error: err.message });
      }
    }
  });

  try {
    bulkTx();

    const createdCount = results.filter(r => r.status === 'CREATED').length;
    const updatedCount = results.filter(r => r.status === 'UPDATED_WITH_HISTORY' || r.status === 'DUPLICATE_AFFIRMED').length;
    const droppedCount = results.filter(r => r.fare_diff && r.fare_diff < 0).length;
    const hikedCount = results.filter(r => r.fare_diff && r.fare_diff > 0).length;

    const isSuccess = results.length > 0;
    const omitDetails = summary_only || fares.length > 40;
    safeInvalidateFaresCache();
    return res.json({
      success: isSuccess,
      saved_count: results.length,
      created_count: createdCount,
      updated_count: updatedCount,
      dropped_count: droppedCount,
      hiked_count: hikedCount,
      deleted_count: deletedRecords.length,
      deleted_dates: deletedRecords.slice(0, 80).map(d => `${d.origin}-${d.destination} (${d.airline_code}): ${d.travel_date}`),
      results: omitDetails ? undefined : results,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      error: !isSuccess && errors.length > 0 ? `Failed to save: ${errors[0].error || 'Validation error'}` : undefined
    });
  } catch (err) {
    console.error('Bulk save transaction failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Get all fares with advanced filtering, sorting, and price diff tracking
 */
exports.getAllFares = (req, res) => {
  try {
    const {
      origin,
      destination,
      travel_date,
      date_from,
      date_to,
      airline_code,
      vendor_id,
      min_fare,
      max_fare,
      is_published,
      updated_today,
      update_filter = 'all', // 'all', 'today', 'dropped', 'increased', 'new'
      sort_by = 'route_date', // 'route_date', 'date_asc', 'date_desc', 'fare_asc', 'fare_desc', 'updated_desc', 'vendor_asc', 'airline_asc'
      search,
      limit = 5000,
      offset = 0
    } = req.query;

    let query = `
      SELECT 
        f.*,
        v.name AS vendor_name,
        v.phone AS vendor_phone,
        a.name AS airline_name,
        h.old_fare AS last_old_fare,
        h.new_fare AS last_new_fare,
        h.fare_diff AS last_fare_diff,
        h.recorded_at AS last_history_time
      FROM fares f
      JOIN vendors v ON f.vendor_id = v.id
      JOIN airlines a ON f.airline_code = a.code
      LEFT JOIN (
        SELECT fare_id, old_fare, new_fare, fare_diff, recorded_at
        FROM fare_history
        WHERE id IN (SELECT MAX(id) FROM fare_history GROUP BY fare_id)
      ) h ON f.id = h.fare_id
      WHERE 1=1
    `;
    const params = [];

    if (origin) {
      query += ` AND f.origin = ?`;
      params.push(origin.toUpperCase());
    }
    if (destination) {
      query += ` AND f.destination = ?`;
      params.push(destination.toUpperCase());
    }
    if (travel_date) {
      query += ` AND f.travel_date = ?`;
      params.push(travel_date);
    }
    if (date_from) {
      query += ` AND f.travel_date >= ?`;
      params.push(date_from);
    }
    if (date_to) {
      query += ` AND f.travel_date <= ?`;
      params.push(date_to);
    }
    if (airline_code) {
      query += ` AND f.airline_code = ?`;
      params.push(airline_code.toUpperCase());
    }
    if (vendor_id) {
      query += ` AND f.vendor_id = ?`;
      params.push(Number(vendor_id));
    }
    if (min_fare) {
      query += ` AND f.net_fare >= ?`;
      params.push(Number(min_fare));
    }
    if (max_fare) {
      query += ` AND f.net_fare <= ?`;
      params.push(Number(max_fare));
    }
    if (is_published !== undefined && is_published !== '') {
      query += ` AND f.is_published = ?`;
      params.push(Number(is_published));
    }

    // Status filter
    if (update_filter === 'today' || updated_today === 'true' || updated_today === '1') {
      query += ` AND date(f.updated_at) = date('now', 'localtime')`;
    } else if (update_filter === 'dropped') {
      query += ` AND h.fare_diff < 0`;
    } else if (update_filter === 'increased') {
      query += ` AND h.fare_diff > 0`;
    } else if (update_filter === 'new') {
      query += ` AND date(f.created_at) = date('now', 'localtime') AND (h.fare_diff IS NULL OR h.fare_diff = 0)`;
    }

    if (search) {
      query += ` AND (
        f.origin LIKE ? OR 
        f.destination LIKE ? OR 
        f.airline_code LIKE ? OR 
        a.name LIKE ? OR 
        v.name LIKE ? OR 
        f.flight_number LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    // Sorting Order
    let orderClause = 'ORDER BY f.origin ASC, f.destination ASC, a.name ASC, f.travel_date ASC';
    if (sort_by === 'date_asc') {
      orderClause = 'ORDER BY f.travel_date ASC, f.net_fare ASC';
    } else if (sort_by === 'date_desc') {
      orderClause = 'ORDER BY f.travel_date DESC, f.net_fare ASC';
    } else if (sort_by === 'fare_asc') {
      orderClause = 'ORDER BY f.net_fare ASC, f.travel_date ASC';
    } else if (sort_by === 'fare_desc') {
      orderClause = 'ORDER BY f.net_fare DESC, f.travel_date ASC';
    } else if (sort_by === 'updated_desc') {
      orderClause = 'ORDER BY f.updated_at DESC';
    } else if (sort_by === 'vendor_asc') {
      orderClause = 'ORDER BY v.name ASC, f.origin ASC, f.travel_date ASC';
    } else if (sort_by === 'airline_asc') {
      orderClause = 'ORDER BY a.name ASC, f.origin ASC, f.travel_date ASC';
    }

    query += ` ${orderClause} LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const fares = db.prepare(query).all(...params);

    // Lightweight live stats for KPI cards
    const summaryStats = db.prepare(`
      SELECT 
        COUNT(*) as total_active,
        SUM(CASE WHEN date(updated_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as updated_today,
        SUM(CASE WHEN date(created_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as created_today
      FROM fares
    `).get() || {};

    const diffStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN fare_diff < 0 AND date(recorded_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as dropped_today,
        SUM(CASE WHEN fare_diff > 0 AND date(recorded_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as increased_today
      FROM fare_history
    `).get() || {};

    return res.json({ 
      success: true, 
      count: fares.length, 
      stats: {
        total: summaryStats.total_active || 0,
        updated_today: summaryStats.updated_today || 0,
        created_today: summaryStats.created_today || 0,
        dropped_today: diffStats.dropped_today || 0,
        increased_today: diffStats.increased_today || 0
      },
      fares 
    });
  } catch (err) {
    console.error('Error fetching fares:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Update single fare
 */
exports.updateFare = (req, res) => {
  try {
    const { id } = req.params;
    const {
      net_fare,
      custom_margin,
      baggage,
      cabin,
      is_refundable,
      flight_number,
      remarks,
      is_published
    } = req.body;

    const current = db.prepare('SELECT * FROM fares WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Fare record not found' });
    }

    const numFare = net_fare !== undefined ? Number(net_fare) : current.net_fare;
    const marginCalc = calculateMargin(numFare, current.airline_code, current.origin, current.destination, custom_margin);

    // If price changed, record history
    if (Math.abs(numFare - current.net_fare) >= 0.01) {
      const diff = numFare - current.net_fare;
      db.prepare(`
        INSERT INTO fare_history (fare_id, vendor_id, airline_code, origin, destination, travel_date, flight_number, old_fare, new_fare, fare_diff, recorded_at, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), 'Manual fare edit')
      `).run(current.id, current.vendor_id, current.airline_code, current.origin, current.destination, current.travel_date, current.flight_number, current.net_fare, numFare, diff);
    }

    db.prepare(`
      UPDATE fares 
      SET net_fare = ?,
          margin_amount = ?,
          publish_fare = ?,
          baggage = COALESCE(?, baggage),
          cabin = COALESCE(?, cabin),
          is_refundable = COALESCE(?, is_refundable),
          flight_number = COALESCE(?, flight_number),
          remarks = COALESCE(?, remarks),
          is_published = COALESCE(?, is_published),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      numFare,
      marginCalc.marginAmount,
      marginCalc.publishFare,
      baggage,
      cabin,
      is_refundable,
      flight_number,
      remarks,
      is_published,
      id
    );

    safeInvalidateFaresCache();

    const updated = db.prepare('SELECT * FROM fares WHERE id = ?').get(id);
    return res.json({ success: true, fare: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Delete fare
 */
exports.deleteFare = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM fares WHERE id = ?').run(id);
    safeInvalidateFaresCache();
    return res.json({ success: true, message: 'Fare deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Get Fare History
 */
exports.getFareHistory = (req, res) => {
  try {
    const { origin, destination, travel_date, airline_code, vendor_id, limit = 100 } = req.query;
    let query = `
      SELECT 
        h.*,
        v.name AS vendor_name,
        a.name AS airline_name
      FROM fare_history h
      JOIN vendors v ON h.vendor_id = v.id
      JOIN airlines a ON h.airline_code = a.code
      WHERE 1=1
    `;
    const params = [];

    if (origin) {
      query += ` AND h.origin = ?`;
      params.push(origin.toUpperCase());
    }
    if (destination) {
      query += ` AND h.destination = ?`;
      params.push(destination.toUpperCase());
    }
    if (travel_date) {
      query += ` AND h.travel_date = ?`;
      params.push(travel_date);
    }
    if (airline_code) {
      query += ` AND h.airline_code = ?`;
      params.push(airline_code.toUpperCase());
    }
    if (vendor_id) {
      query += ` AND h.vendor_id = ?`;
      params.push(Number(vendor_id));
    }

    query += ` ORDER BY h.recorded_at DESC LIMIT ?`;
    params.push(Number(limit));

    const history = db.prepare(query).all(...params);
    return res.json({ success: true, count: history.length, history });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Clear All Fares & History (Reset)
 */
exports.clearAllFares = (req, res) => {
  try {
    db.prepare('DELETE FROM fares').run();
    db.prepare('DELETE FROM fare_history').run();
    try {
      db.prepare('DELETE FROM published_specials').run();
    } catch (_) {}
    try {
      db.exec('VACUUM');
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (_) {}
    safeInvalidateFaresCache();
    return res.json({ success: true, message: 'All fares and history records successfully cleared.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Clear Fares For a Specific Vendor (All, Sector-specific, or Only Today's Updated)
 */
exports.clearVendorFares = (req, res) => {
  try {
    const { vendor_id } = req.params;
    const { only_today, origin, destination, airline_code } = req.body || {};
    const isOnlyToday = only_today === true || only_today === 'true' || req.query.only_today === 'true';

    if (!vendor_id) {
      return res.status(400).json({ success: false, error: 'Vendor ID is required.' });
    }

    let whereClause = 'WHERE vendor_id = ?';
    const params = [Number(vendor_id)];

    if (origin) {
      whereClause += ' AND origin = ?';
      params.push(String(origin).toUpperCase());
    }
    if (destination) {
      whereClause += ' AND destination = ?';
      params.push(String(destination).toUpperCase());
    }
    if (airline_code) {
      whereClause += ' AND airline_code = ?';
      params.push(String(airline_code).toUpperCase());
    }
    if (isOnlyToday) {
      whereClause += " AND date(updated_at) = date('now', 'localtime')";
    }

    db.prepare(`
      DELETE FROM fare_history 
      WHERE fare_id IN (
        SELECT id FROM fares ${whereClause}
      )
    `).run(...params);

    const info = db.prepare(`DELETE FROM fares ${whereClause}`).run(...params);
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (_) {}
    safeInvalidateFaresCache();

    return res.json({
      success: true,
      message: `Successfully cleared ${info.changes} fares for this vendor.`,
      deleted_count: info.changes,
      mode: isOnlyToday ? 'today' : 'all',
      origin: origin || null,
      destination: destination || null
    });
  } catch (err) {
    console.error('Error clearing vendor fares:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Batch Delete Selected Fares by IDs
 */
exports.batchDeleteFares = (req, res) => {
  try {
    const { ids = [] } = req.body;
    if (!ids || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No fare IDs provided.' });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM fare_history WHERE fare_id IN (${placeholders})`).run(...ids);
    const info = db.prepare(`DELETE FROM fares WHERE id IN (${placeholders})`).run(...ids);
    safeInvalidateFaresCache();

    return res.json({
      success: true,
      deleted_count: info.changes,
      message: `Successfully deleted ${info.changes} selected fares.`
    });
  } catch (err) {
    console.error('Batch delete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Get fare counts for a specific vendor (total, updated today, and breakdown by sector)
 */
exports.getVendorFareStats = (req, res) => {
  try {
    const { vendor_id } = req.params;
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN date(updated_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as updated_today
      FROM fares
      WHERE vendor_id = ?
    `).get(vendor_id) || { total: 0, updated_today: 0 };

    const sectors = db.prepare(`
      SELECT 
        origin,
        destination,
        COUNT(*) as total,
        SUM(CASE WHEN date(updated_at) = date('now', 'localtime') THEN 1 ELSE 0 END) as updated_today
      FROM fares
      WHERE vendor_id = ?
      GROUP BY origin, destination
      ORDER BY total DESC
    `).all(vendor_id);

    return res.json({
      success: true,
      total: stats.total || 0,
      updated_today: stats.updated_today || 0,
      sectors: sectors || []
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Batch Update Final Margins & Publish Fares
 * Used on Final Sheet before publishing
 */
exports.batchUpdateMargins = (req, res) => {
  try {
    const { updates = [], mark_published = 1, batch_title = 'Special Fare Release' } = req.body;
    if (!updates || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fare updates provided.' });
    }

    const updateStmt = db.prepare(`
      UPDATE fares 
      SET margin_amount = ?,
          publish_fare = ?,
          is_published = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    const insertPublished = db.prepare(`
      INSERT INTO published_specials (fare_id, batch_id, custom_title, published_at)
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `);

    const batchId = `BATCH-${Date.now()}`;

    const tx = db.transaction(() => {
      for (const item of updates) {
        const net = Number(item.net_fare) || Number(item.publish_fare) || 0;
        const margin = 0;
        const publish = net;
        updateStmt.run(margin, publish, mark_published ? 1 : 0, item.id);
        if (mark_published) {
          insertPublished.run(item.id, batchId, batch_title);
        }
      }
    });

    tx();
    safeInvalidateFaresCache();
    return res.json({
      success: true,
      updated_count: updates.length,
      batch_id: batchId,
      message: `Successfully applied margins and saved ${updates.length} fares to Final Sheet.`
    });
  } catch (err) {
    console.error('Error in batchUpdateMargins:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

