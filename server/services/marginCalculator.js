const db = require('../config/database');

/**
 * Calculates margin and publish fare based on active margin rules
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

  // If user provided an explicit non-zero custom margin
  if (customMargin !== null && customMargin !== undefined && !isNaN(customMargin) && Number(customMargin) !== 0) {
    const margin = Number(customMargin);
    return {
      marginAmount: margin,
      publishFare: fare + margin,
      ruleApplied: 'Custom Override'
    };
  }

  // No Margin added at any step: Direct Net Fare
  return {
    marginAmount: 0,
    publishFare: fare,
    ruleApplied: 'No Margin (Direct Net Fare)'
  };
}

module.exports = {
  calculateMargin
};
