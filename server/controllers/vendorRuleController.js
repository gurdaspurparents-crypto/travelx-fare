const db = require('../config/database');
const { evaluateVendorAdjustment } = require('../services/vendorPricingEngine');

/**
 * Controller: Get all vendor pricing rules
 */
exports.getAllVendorRules = (req, res) => {
  try {
    const rules = db.prepare(`
      SELECT r.*, v.name as linked_vendor_name
      FROM vendor_pricing_rules r
      LEFT JOIN vendors v ON r.vendor_id = v.id
      ORDER BY r.vendor_name ASC, r.priority DESC, r.min_fare ASC
    `).all();

    return res.json({ success: true, rules });
  } catch (err) {
    console.error('Error fetching vendor pricing rules:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Create a new vendor pricing rule
 */
exports.createVendorRule = (req, res) => {
  try {
    const {
      vendor_id = null,
      vendor_name = null,
      airline_code = null,
      origin = null,
      destination = null,
      min_fare = 0,
      max_fare = 99999999,
      adjustment_type = 'LESS', // 'LESS' or 'ADD'
      adjustment_amount = 0,
      priority = 10,
      is_active = 1,
      description = ''
    } = req.body;

    if (!adjustment_amount || Number(adjustment_amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Adjustment amount must be greater than 0' });
    }

    let vName = vendor_name;
    if (!vName && vendor_id) {
      const v = db.prepare('SELECT name FROM vendors WHERE id = ?').get(vendor_id);
      if (v) vName = v.name;
    }

    const desc = description || `${vName || 'Vendor'} ${origin || '*' }➔${destination || '*'}: ${adjustment_type} ₹${adjustment_amount}`;

    const stmt = db.prepare(`
      INSERT INTO vendor_pricing_rules (
        vendor_id, vendor_name, airline_code, origin, destination,
        min_fare, max_fare, adjustment_type, adjustment_amount,
        priority, is_active, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);

    const info = stmt.run(
      vendor_id || null,
      vName || null,
      airline_code ? airline_code.toUpperCase() : null,
      origin ? origin.toUpperCase() : null,
      destination ? destination.toUpperCase() : null,
      Number(min_fare) || 0,
      Number(max_fare) || 99999999,
      adjustment_type === 'ADD' ? 'ADD' : 'LESS',
      Number(adjustment_amount),
      Number(priority) || 10,
      is_active ? 1 : 0,
      desc
    );

    const created = db.prepare('SELECT * FROM vendor_pricing_rules WHERE id = ?').get(info.lastInsertRowid);
    return res.status(201).json({ success: true, rule: created });
  } catch (err) {
    console.error('Error creating vendor rule:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Update an existing vendor rule
 */
exports.updateVendorRule = (req, res) => {
  try {
    const { id } = req.params;
    const {
      is_active,
      adjustment_amount,
      adjustment_type,
      priority,
      description
    } = req.body;

    const existing = db.prepare('SELECT * FROM vendor_pricing_rules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    db.prepare(`
      UPDATE vendor_pricing_rules
      SET is_active = COALESCE(?, is_active),
          adjustment_amount = COALESCE(?, adjustment_amount),
          adjustment_type = COALESCE(?, adjustment_type),
          priority = COALESCE(?, priority),
          description = COALESCE(?, description)
      WHERE id = ?
    `).run(
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      adjustment_amount !== undefined ? Number(adjustment_amount) : null,
      adjustment_type !== undefined ? adjustment_type : null,
      priority !== undefined ? Number(priority) : null,
      description !== undefined ? description : null,
      id
    );

    const updated = db.prepare('SELECT * FROM vendor_pricing_rules WHERE id = ?').get(id);
    return res.json({ success: true, rule: updated });
  } catch (err) {
    console.error('Error updating vendor rule:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Delete a vendor rule
 */
exports.deleteVendorRule = (req, res) => {
  try {
    const { id } = req.params;
    const info = db.prepare('DELETE FROM vendor_pricing_rules WHERE id = ?').run(id);
    return res.json({ success: true, deleted: info.changes > 0 });
  } catch (err) {
    console.error('Error deleting vendor rule:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: Batch Apply Vendor Pricing Rules to Existing Fares in Database
 */
exports.applyVendorRulesToExistingFares = (req, res) => {
  try {
    const { vendor_id = null, vendor_name = null } = req.body || {};

    let faresQuery = `
      SELECT f.*, v.name as vendor_name
      FROM fares f
      JOIN vendors v ON f.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    if (vendor_id) {
      faresQuery += ' AND f.vendor_id = ?';
      params.push(vendor_id);
    } else if (vendor_name) {
      faresQuery += ' AND v.name = ? COLLATE NOCASE';
      params.push(vendor_name);
    }

    const allFares = db.prepare(faresQuery).all(...params);

    const updateFareStmt = db.prepare(`
      UPDATE fares
      SET net_fare = ?,
          publish_fare = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    const insertHistoryStmt = db.prepare(`
      INSERT INTO fare_history (
        fare_id, vendor_id, airline_code, origin, destination,
        travel_date, flight_number, old_fare, new_fare, fare_diff, recorded_at, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)
    `);

    let updatedCount = 0;
    const details = [];

    const tx = db.transaction(() => {
      for (const fare of allFares) {
        const evalResult = evaluateVendorAdjustment({
          vendor_id: fare.vendor_id,
          vendor_name: fare.vendor_name,
          airline_code: fare.airline_code,
          origin: fare.origin,
          destination: fare.destination,
          net_fare: fare.net_fare
        });

        if (evalResult.adjustmentType !== 'NONE' && evalResult.adjustedFare !== fare.net_fare) {
          const diff = evalResult.adjustedFare - fare.net_fare;
          // Record history
          insertHistoryStmt.run(
            fare.id,
            fare.vendor_id,
            fare.airline_code,
            fare.origin,
            fare.destination,
            fare.travel_date,
            fare.flight_number || null,
            fare.net_fare,
            evalResult.adjustedFare,
            diff,
            `Vendor Rule: ${evalResult.ruleApplied}`
          );

          // Update fare
          updateFareStmt.run(
            evalResult.adjustedFare,
            evalResult.adjustedFare, // Keep publish_fare in sync
            fare.id
          );

          updatedCount++;
          if (details.length < 50) {
            details.push({
              id: fare.id,
              vendor: fare.vendor_name,
              route: `${fare.origin}➔${fare.destination}`,
              airline: fare.airline_code,
              old_fare: fare.net_fare,
              new_fare: evalResult.adjustedFare,
              diff,
              rule: evalResult.ruleApplied
            });
          }
        }
      }
    });

    tx();

    return res.json({
      success: true,
      updated_count: updatedCount,
      total_checked: allFares.length,
      sample_details: details,
      message: `Successfully applied vendor pricing rules to ${updatedCount} fares.`
    });
  } catch (err) {
    console.error('Error applying vendor rules to existing fares:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
