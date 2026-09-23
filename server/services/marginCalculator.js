const db = require('../config/database');

let cachedMarginRules = null;
let cachedMarginRulesAt = 0;

function loadActiveMarginRules() {
  const now = Date.now();
  if (!cachedMarginRules || now - cachedMarginRulesAt > 20000) {
    cachedMarginRules = db.prepare(`
      SELECT * FROM margin_rules
      WHERE is_active = 1
      ORDER BY priority DESC, id ASC
    `).all();
    cachedMarginRulesAt = now;
  }
  return cachedMarginRules;
}

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
 * Calculates margin and publish fare based on active margin rules in DB
 * @param {number} netFare
 * @param {string} airlineCode
 * @param {string} origin
 * @param {string} destination
 * @param {number|null} customMargin - optional manual override
 * @returns {{ marginAmount: number, publishFare: number, ruleApplied: string }}
 */
function calculateMargin(netFare, airlineCode = null, origin = null, destination = null, customMargin = null) {
  const fare = Number(netFare) || 0;
  if (fare <= 0) {
    return { marginAmount: 0, publishFare: 0, ruleApplied: 'Zero Fare' };
  }

  // 1. If user provided an explicit non-zero custom margin
  if (customMargin !== null && customMargin !== undefined && !isNaN(customMargin) && Number(customMargin) !== 0) {
    const margin = Number(customMargin);
    return {
      marginAmount: margin,
      publishFare: fare + margin,
      ruleApplied: 'Custom Override'
    };
  }

  try {
    const origList = getAirportAliases(origin);
    const destList = getAirportAliases(destination);
    const airlineUpper = airlineCode ? String(airlineCode).trim().toUpperCase() : null;

    const candidateRules = loadActiveMarginRules().filter((r) => r.min_fare <= fare && r.max_fare >= fare);

    for (const r of candidateRules) {
      // Check airline filter
      if (r.airline_code && airlineUpper && r.airline_code.toUpperCase() !== airlineUpper) {
        continue;
      }

      // Check origin filter
      if (r.origin) {
        const rOrigAliases = getAirportAliases(r.origin);
        const matchesOrig = origList.some(o => rOrigAliases.includes(o));
        if (!matchesOrig) continue;
      }

      // Check destination filter
      if (r.destination) {
        const rDestAliases = getAirportAliases(r.destination);
        const matchesDest = destList.some(d => rDestAliases.includes(d));
        if (!matchesDest) continue;
      }

      // Rule matched!
      let margin = 0;
      if (r.rule_type === 'PERCENT' && r.margin_percent) {
        margin = Math.round(fare * (Number(r.margin_percent) / 100));
      } else {
        margin = Number(r.margin_amount) || 0;
      }

      return {
        marginAmount: margin,
        publishFare: fare + margin,
        ruleApplied: r.rule_name || `Rule #${r.id} (+₹${margin})`
      };
    }
  } catch (err) {
    console.warn('Error calculating margin from DB rules:', err.message);
  }

  // Default fallback: No Margin (Direct Net Fare)
  return {
    marginAmount: 0,
    publishFare: fare,
    ruleApplied: 'No Margin (Direct Net Fare)'
  };
}

module.exports = {
  calculateMargin
};
