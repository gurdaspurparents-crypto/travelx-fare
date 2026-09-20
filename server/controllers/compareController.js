const db = require('../config/database');
const { getFareComparisons } = require('../services/comparisonEngine');

/**
 * Controller: Get comparison view
 */
exports.getComparisonView = (req, res) => {
  try {
    const { origin, destination, travel_date, airline_code, vendor_id, is_published } = req.query;
    const comparisons = getFareComparisons({
      origin,
      destination,
      travelDate: travel_date,
      airlineCode: airline_code,
      vendorId: vendor_id,
      isPublished: is_published
    });
    return res.json({ success: true, count: comparisons.length, comparisons });
  } catch (err) {
    console.error('Error fetching comparisons:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Get all best (lowest) net fares from comparison groups
 * Used on the Final Sheet to load sorted winning fares with 1 click
 */
exports.getBestFares = (req, res) => {
  try {
    const { origin, destination, travel_date, airline_code } = req.query;
    const comparisons = getFareComparisons({
      origin,
      destination,
      travelDate: travel_date,
      airlineCode: airline_code
    });

    const bestFares = [];
    for (const group of comparisons) {
      const winner = group.fares.find(f => f.is_best_net) || group.fares[0];
      if (winner) {
        bestFares.push({
          ...winner,
          groupKey: group.groupKey,
          competitor_count: group.fares.length
        });
      }
    }

    return res.json({ success: true, count: bestFares.length, bestFares });
  } catch (err) {
    console.error('Error fetching best fares:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Get Dashboard Statistics & KPIs
 */
exports.getDashboardStats = (req, res) => {
  try {
    // 1. Total fares entered today
    const faresToday = db.prepare(`
      SELECT COUNT(*) as count FROM fares 
      WHERE date(created_at) = date('now', 'localtime')
    `).get().count;

    // 2. Total active airlines
    const totalAirlines = db.prepare(`
      SELECT COUNT(DISTINCT airline_code) as count FROM fares
    `).get().count;

    // 3. Total active routes
    const totalRoutes = db.prepare(`
      SELECT COUNT(DISTINCT (origin || '-' || destination)) as count FROM fares
    `).get().count;

    // 4. Total active vendors with fares
    const totalVendors = db.prepare(`
      SELECT COUNT(DISTINCT vendor_id) as count FROM fares
    `).get().count;

    // 5. Total published fares
    const publishedCount = db.prepare(`
      SELECT COUNT(*) as count FROM fares WHERE is_published = 1
    `).get().count;

    // 6. Total active fares in system
    const totalFares = db.prepare(`
      SELECT COUNT(*) as count FROM fares
    `).get().count;

    // 7. Today's price drops vs price increases from history
    const priceTrendsToday = db.prepare(`
      SELECT 
        SUM(CASE WHEN fare_diff < 0 THEN 1 ELSE 0 END) as price_drops,
        SUM(CASE WHEN fare_diff > 0 THEN 1 ELSE 0 END) as price_hikes
      FROM fare_history
      WHERE date(recorded_at) = date('now', 'localtime')
    `).get();

    // 8. Recently updated fares (last 10)
    const recentFares = db.prepare(`
      SELECT 
        f.*,
        v.name AS vendor_name,
        a.name AS airline_name
      FROM fares f
      JOIN vendors v ON f.vendor_id = v.id
      JOIN airlines a ON f.airline_code = a.code
      ORDER BY f.updated_at DESC
      LIMIT 150
    `).all();

    // 9. Best fares sample for favorite routes
    const favoriteRoutes = db.prepare(`
      SELECT origin, destination FROM routes WHERE is_favorite = 1 LIMIT 5
    `).all();

    return res.json({
      success: true,
      stats: {
        fares_today: faresToday,
        total_airlines: totalAirlines,
        total_routes: totalRoutes,
        total_vendors: totalVendors,
        published_fares: publishedCount,
        total_fares: totalFares,
        price_drops_today: priceTrendsToday.price_drops || 0,
        price_hikes_today: priceTrendsToday.price_hikes || 0
      },
      recentFares,
      favoriteRoutes
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
