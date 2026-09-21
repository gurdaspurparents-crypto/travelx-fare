const db = require('../config/database');
const { calculateMargin } = require('../services/marginCalculator');

function safeInvalidateFaresCache() {
  try {
    const publicCtrl = require('./publicAgentController');
    if (publicCtrl && typeof publicCtrl.invalidateFaresCache === 'function') {
      publicCtrl.invalidateFaresCache();
    }
  } catch (_) {}
}

/**
 * Get all margin rules
 */
exports.getAllRules = (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM margin_rules ORDER BY priority DESC, min_fare ASC').all();
    return res.json({ success: true, rules });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Create a new margin rule
 */
exports.createRule = (req, res) => {
  try {
    const {
      rule_name,
      rule_type = 'SLAB',
      min_fare = 0,
      max_fare = 99999999,
      margin_amount = 0,
      margin_percent = 0,
      airline_code = null,
      origin = null,
      destination = null,
      priority = 10,
      is_active = 1
    } = req.body;

    if (!rule_name) {
      return res.status(400).json({ success: false, error: 'Rule name is required' });
    }

    const result = db.prepare(`
      INSERT INTO margin_rules (
        rule_name, rule_type, min_fare, max_fare, margin_amount, 
        margin_percent, airline_code, origin, destination, priority, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rule_name,
      rule_type,
      Number(min_fare),
      Number(max_fare),
      Number(margin_amount),
      Number(margin_percent),
      airline_code ? airline_code.toUpperCase() : null,
      origin ? origin.toUpperCase() : null,
      destination ? destination.toUpperCase() : null,
      Number(priority),
      Number(is_active)
    );

    const newRule = db.prepare('SELECT * FROM margin_rules WHERE id = ?').get(result.lastInsertRowid);
    safeInvalidateFaresCache();
    return res.status(201).json({ success: true, rule: newRule });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Update an existing margin rule
 */
exports.updateRule = (req, res) => {
  try {
    const { id } = req.params;
    const {
      rule_name,
      rule_type,
      min_fare,
      max_fare,
      margin_amount,
      margin_percent,
      airline_code,
      origin,
      destination,
      priority,
      is_active
    } = req.body;

    const existing = db.prepare('SELECT * FROM margin_rules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Margin rule not found' });
    }

    db.prepare(`
      UPDATE margin_rules 
      SET rule_name = COALESCE(?, rule_name),
          rule_type = COALESCE(?, rule_type),
          min_fare = COALESCE(?, min_fare),
          max_fare = COALESCE(?, max_fare),
          margin_amount = COALESCE(?, margin_amount),
          margin_percent = COALESCE(?, margin_percent),
          airline_code = ?,
          origin = ?,
          destination = ?,
          priority = COALESCE(?, priority),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      rule_name,
      rule_type,
      min_fare !== undefined ? Number(min_fare) : existing.min_fare,
      max_fare !== undefined ? Number(max_fare) : existing.max_fare,
      margin_amount !== undefined ? Number(margin_amount) : existing.margin_amount,
      margin_percent !== undefined ? Number(margin_percent) : existing.margin_percent,
      airline_code ? airline_code.toUpperCase() : null,
      origin ? origin.toUpperCase() : null,
      destination ? destination.toUpperCase() : null,
      priority !== undefined ? Number(priority) : existing.priority,
      is_active !== undefined ? Number(is_active) : existing.is_active,
      id
    );

    safeInvalidateFaresCache();
    const updated = db.prepare('SELECT * FROM margin_rules WHERE id = ?').get(id);
    return res.json({ success: true, rule: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Delete a margin rule
 */
exports.deleteRule = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM margin_rules WHERE id = ?').run(id);
    safeInvalidateFaresCache();
    return res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Preview margin calculation for testing
 */
exports.previewMargin = (req, res) => {
  try {
    const { net_fare, airline_code, origin, destination, custom_margin } = req.body;
    const calc = calculateMargin(net_fare, airline_code, origin, destination, custom_margin);
    return res.json({ success: true, ...calc });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
