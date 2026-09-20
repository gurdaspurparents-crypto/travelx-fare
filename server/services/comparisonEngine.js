const db = require('../config/database');
const { calculateMargin } = require('./marginCalculator');

/**
 * Group fares by Route (Origin-Destination), Travel Date, Airline (and optionally Flight/Cabin)
 * and evaluate best net fare, condition warnings, and margin.
 * 
 * @param {object} filterOptions - { origin, destination, travelDate, airlineCode, vendorId, dateRange }
 * @returns {Array<ComparisonGroup>}
 */
function getFareComparisons(filterOptions = {}) {
  let query = `
    SELECT 
      f.id,
      f.vendor_id,
      v.name AS vendor_name,
      v.phone AS vendor_phone,
      f.airline_code,
      a.name AS airline_name,
      f.origin,
      f.destination,
      f.travel_date,
      f.flight_number,
      f.departure_time,
      f.arrival_time,
      f.net_fare,
      f.currency,
      f.cabin,
      f.baggage,
      f.is_refundable,
      f.remarks,
      f.margin_amount,
      f.publish_fare,
      f.is_published,
      f.created_at,
      f.updated_at
    FROM fares f
    JOIN vendors v ON f.vendor_id = v.id
    JOIN airlines a ON f.airline_code = a.code
    WHERE 1=1
  `;

  const params = [];

  if (filterOptions.origin) {
    query += ` AND f.origin = ?`;
    params.push(filterOptions.origin.toUpperCase());
  }
  if (filterOptions.destination) {
    query += ` AND f.destination = ?`;
    params.push(filterOptions.destination.toUpperCase());
  }
  if (filterOptions.travelDate) {
    query += ` AND f.travel_date = ?`;
    params.push(filterOptions.travelDate);
  }
  if (filterOptions.airlineCode) {
    query += ` AND f.airline_code = ?`;
    params.push(filterOptions.airlineCode.toUpperCase());
  }
  if (filterOptions.vendorId) {
    query += ` AND f.vendor_id = ?`;
    params.push(Number(filterOptions.vendorId));
  }
  if (filterOptions.isPublished !== undefined && filterOptions.isPublished !== '') {
    query += ` AND f.is_published = ?`;
    params.push(Number(filterOptions.isPublished));
  }

  query += ` ORDER BY f.travel_date ASC, f.origin ASC, f.destination ASC, f.airline_code ASC, f.net_fare ASC`;

  const rows = db.prepare(query).all(...params);

  // Group by Unique Comparison Key: origin_destination_travel_date_airline_cabin
  const groups = new Map();

  for (const row of rows) {
    // Standardize baggage allowance numeric weight for comparison (e.g. 30kg -> 30)
    let baggageKg = 30;
    const bagMatch = (row.baggage || '').match(/(\d{1,2})/);
    if (bagMatch) baggageKg = parseInt(bagMatch[1], 10);
    row.baggage_kg = baggageKg;

    // Recalculate or verify margin
    const marginCalc = calculateMargin(row.net_fare, row.airline_code, row.origin, row.destination);
    row.calculated_margin = marginCalc.marginAmount;
    row.calculated_publish_fare = marginCalc.publishFare;
    row.margin_rule = marginCalc.ruleApplied;

    const groupKey = `${row.origin}-${row.destination}_${row.travel_date}_${row.airline_code}_${row.cabin}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        origin: row.origin,
        destination: row.destination,
        route: `${row.origin}-${row.destination}`,
        travel_date: row.travel_date,
        airline_code: row.airline_code,
        airline_name: row.airline_name,
        cabin: row.cabin,
        fares: []
      });
    }
    groups.get(groupKey).fares.push(row);
  }

  // Analyze each group
  const comparisonResults = [];

  for (const group of groups.values()) {
    // Sort fares by net_fare ascending
    group.fares.sort((a, b) => a.net_fare - b.net_fare);

    const lowestFareCandidate = group.fares[0];
    let bestFare = lowestFareCandidate;
    let warnings = [];

    // If multiple vendor fares exist, run smart condition checks
    if (group.fares.length > 1) {
      const secondLowest = group.fares[1];

      // Check baggage difference
      // E.g., if lowest has 20kg but second has 30kg and price difference is small (<= 500)
      if (lowestFareCandidate.baggage_kg < secondLowest.baggage_kg) {
        const diff = secondLowest.net_fare - lowestFareCandidate.net_fare;
        warnings.push({
          type: 'BAGGAGE_DISPARITY',
          severity: 'warning',
          message: `⚠️ ${lowestFareCandidate.vendor_name} is ₹${diff.toLocaleString('en-IN')} cheaper but has lower baggage (${lowestFareCandidate.baggage} vs ${secondLowest.baggage} on ${secondLowest.vendor_name}).`,
          recommendedVendor: diff <= 500 ? secondLowest.vendor_name : lowestFareCandidate.vendor_name
        });
      }

      // Check refundability difference
      // E.g. lowest is NON_REFUNDABLE, but another option is REFUNDABLE
      if (lowestFareCandidate.is_refundable === 'NON_REFUNDABLE') {
        const refundableOption = group.fares.find(f => f.is_refundable === 'REFUNDABLE');
        if (refundableOption) {
          const diff = refundableOption.net_fare - lowestFareCandidate.net_fare;
          warnings.push({
            type: 'REFUNDABILITY_DIFFERENCE',
            severity: 'info',
            message: `ℹ️ ${lowestFareCandidate.vendor_name} is Non-Refundable. Refundable available from ${refundableOption.vendor_name} for +₹${diff.toLocaleString('en-IN')}.`,
            refundableVendor: refundableOption.vendor_name
          });
        }
      }

      // Check Flight timing or flight number mismatch
      const flightNumbers = new Set(group.fares.map(f => f.flight_number).filter(Boolean));
      if (flightNumbers.size > 1) {
        warnings.push({
          type: 'FLIGHT_NUMBER_VARIATION',
          severity: 'info',
          message: `Multiple flights available (${Array.from(flightNumbers).join(', ')}). Check timings before confirming.`
        });
      }
    }

    // Attach analysis tags
    group.fares.forEach((f, idx) => {
      f.is_best_net = (f.id === lowestFareCandidate.id);
      f.price_difference_from_lowest = f.net_fare - lowestFareCandidate.net_fare;
      f.rank = idx + 1;
    });

    group.best_net_fare = lowestFareCandidate.net_fare;
    group.best_vendor_name = lowestFareCandidate.vendor_name;
    group.best_fare_id = bestFare.id;
    group.recommended_publish_fare = bestFare.calculated_publish_fare;
    group.recommended_margin = bestFare.calculated_margin;
    group.warnings = warnings;
    group.vendor_count = group.fares.length;

    comparisonResults.push(group);
  }

  return comparisonResults;
}

module.exports = {
  getFareComparisons
};
