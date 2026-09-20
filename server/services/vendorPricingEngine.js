const db = require('../config/database');

/**
 * Normalizes airport code aliases so MXP/MIL and FCO/ROM match rules seamlessly
 */
function getAirportAliases(code) {
  if (!code) return [];
  const upper = String(code).trim().toUpperCase();
  if (upper === 'MXP' || upper === 'MIL') return ['MXP', 'MIL'];
  if (upper === 'FCO' || upper === 'ROM') return ['FCO', 'ROM'];
  return [upper];
}

/**
 * Evaluates vendor pricing rules for a single fare
 * @param {Object} params
 * @param {number|string} params.vendor_id
 * @param {string} [params.vendor_name]
 * @param {string} [params.airline_code]
 * @param {string} params.origin
 * @param {string} params.destination
 * @param {number} params.net_fare
 * @returns {Object} { originalFare, adjustedFare, adjustmentType, adjustmentAmount, ruleApplied }
 */
function evaluateVendorAdjustment({ vendor_id, vendor_name = null, airline_code = null, origin, destination, net_fare }) {
  const fare = Number(net_fare) || 0;
  if (fare <= 0) {
    return {
      originalFare: fare,
      adjustedFare: fare,
      adjustmentType: 'NONE',
      adjustmentAmount: 0,
      ruleApplied: null
    };
  }

  // Resolve vendor name if not provided
  let vName = vendor_name;
  if (!vName && vendor_id) {
    const v = db.prepare('SELECT name FROM vendors WHERE id = ?').get(vendor_id);
    if (v) vName = v.name;
  }

  const origList = getAirportAliases(origin);
  const destList = getAirportAliases(destination);
  const airlineUpper = airline_code ? String(airline_code).trim().toUpperCase() : null;

  // Query active rules that could match this vendor
  let query = `
    SELECT * FROM vendor_pricing_rules
    WHERE is_active = 1
      AND (
        (vendor_id IS NOT NULL AND vendor_id = ?)
        OR (? IS NOT NULL AND vendor_name = ? COLLATE NOCASE)
      )
      AND (min_fare <= ? AND max_fare >= ?)
  `;
  const params = [vendor_id, vName, vName, fare, fare];

  const candidateRules = db.prepare(query).all(...params);

  // Filter candidates by airline and sector matching aliases
  let matchedRule = null;
  let highestPriority = -1;

  for (const r of candidateRules) {
    // Check airline
    if (r.airline_code && airlineUpper && r.airline_code.toUpperCase() !== airlineUpper) {
      continue;
    }

    // Check origin
    if (r.origin) {
      const rOrigAliases = getAirportAliases(r.origin);
      const matchesOrig = origList.some(o => rOrigAliases.includes(o));
      if (!matchesOrig) continue;
    }

    // Check destination
    if (r.destination) {
      const rDestAliases = getAirportAliases(r.destination);
      const matchesDest = destList.some(d => rDestAliases.includes(d));
      if (!matchesDest) continue;
    }

    // Rule matches! Check priority
    const priority = Number(r.priority) || 10;
    if (priority > highestPriority) {
      highestPriority = priority;
      matchedRule = r;
    }
  }

  if (!matchedRule) {
    return {
      originalFare: fare,
      adjustedFare: fare,
      adjustmentType: 'NONE',
      adjustmentAmount: 0,
      ruleApplied: null
    };
  }

  const adjAmount = Number(matchedRule.adjustment_amount) || 0;
  let adjustedFare = fare;

  if (matchedRule.adjustment_type === 'LESS') {
    adjustedFare = Math.max(0, fare - adjAmount);
  } else if (matchedRule.adjustment_type === 'ADD') {
    adjustedFare = fare + adjAmount;
  }

  return {
    originalFare: fare,
    adjustedFare,
    adjustmentType: matchedRule.adjustment_type,
    adjustmentAmount: adjAmount,
    ruleApplied: matchedRule.description || `Rule #${matchedRule.id}: ${matchedRule.adjustment_type} ₹${adjAmount}`
  };
}

module.exports = {
  evaluateVendorAdjustment,
  getAirportAliases
};
