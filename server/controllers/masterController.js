const db = require('../config/database');

// ======================== AIRLINES ========================

exports.getAllAirlines = (req, res) => {
  try {
    const airlines = db.prepare('SELECT * FROM airlines ORDER BY is_active DESC, name ASC').all();
    return res.json({ success: true, airlines });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.createAirline = (req, res) => {
  try {
    const { code, name, country = 'India', is_active = 1 } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Airline IATA code and name are required' });
    }
    const cleanCode = code.trim().toUpperCase();
    db.prepare('INSERT INTO airlines (code, name, country, is_active) VALUES (?, ?, ?, ?)').run(cleanCode, name.trim(), country, is_active);
    const created = db.prepare('SELECT * FROM airlines WHERE code = ?').get(cleanCode);
    return res.status(201).json({ success: true, airline: created });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateAirline = (req, res) => {
  try {
    const { code } = req.params;
    const { name, country, is_active } = req.body;
    db.prepare(`
      UPDATE airlines 
      SET name = COALESCE(?, name),
          country = COALESCE(?, country),
          is_active = COALESCE(?, is_active)
      WHERE code = ?
    `).run(name, country, is_active, code.toUpperCase());
    const updated = db.prepare('SELECT * FROM airlines WHERE code = ?').get(code.toUpperCase());
    return res.json({ success: true, airline: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ======================== VENDORS ========================

exports.getAllVendors = (req, res) => {
  try {
    const vendors = db.prepare(`
      SELECT 
        v.*,
        (SELECT COUNT(*) FROM fares WHERE vendor_id = v.id) as total_fares,
        (SELECT MAX(updated_at) FROM fares WHERE vendor_id = v.id) as last_fare_update
      FROM vendors v 
      ORDER BY v.is_active DESC, v.name ASC
    `).all();
    return res.json({ success: true, vendors });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.createVendor = (req, res) => {
  try {
    const { name, phone = '', email = '', notes = '', is_active = 1 } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Vendor name is required' });
    }
    const result = db.prepare('INSERT INTO vendors (name, phone, email, notes, is_active) VALUES (?, ?, ?, ?, ?)').run(
      name.trim(), phone.trim(), email.trim(), notes.trim(), is_active
    );
    const created = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, vendor: created });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateVendor = (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, notes, is_active } = req.body;
    db.prepare(`
      UPDATE vendors 
      SET name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          notes = COALESCE(?, notes),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(name, phone, email, notes, is_active, id);
    const updated = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
    return res.json({ success: true, vendor: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteVendor = (req, res) => {
  try {
    const { id } = req.params;
    // Check if vendor has fares
    const fareCount = db.prepare('SELECT COUNT(*) as count FROM fares WHERE vendor_id = ?').get(id).count;
    if (fareCount > 0) {
      // Soft-delete by setting inactive
      db.prepare('UPDATE vendors SET is_active = 0 WHERE id = ?').run(id);
      return res.json({ success: true, message: 'Vendor has active fares; marked as inactive instead of permanent deletion' });
    }
    db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ======================== ROUTES ========================

exports.getAllRoutes = (req, res) => {
  try {
    const routes = db.prepare(`
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM fares WHERE origin = r.origin AND destination = r.destination) as total_fares
      FROM routes r 
      ORDER BY r.is_favorite DESC, r.origin ASC, r.destination ASC
    `).all();
    return res.json({ success: true, routes });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.createRoute = (req, res) => {
  try {
    const { origin, destination, origin_city = '', dest_city = '', is_favorite = 0 } = req.body;
    if (!origin || !destination) {
      return res.status(400).json({ success: false, error: 'Origin and Destination IATA codes are required' });
    }
    const cleanOrig = origin.trim().toUpperCase();
    const cleanDest = destination.trim().toUpperCase();
    const result = db.prepare('INSERT INTO routes (origin, destination, origin_city, dest_city, is_favorite) VALUES (?, ?, ?, ?, ?)').run(
      cleanOrig, cleanDest, origin_city.trim(), dest_city.trim(), is_favorite ? 1 : 0
    );
    const created = db.prepare('SELECT * FROM routes WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, route: created });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateRoute = (req, res) => {
  try {
    const { id } = req.params;
    const { origin_city, dest_city, is_favorite } = req.body;
    db.prepare(`
      UPDATE routes 
      SET origin_city = COALESCE(?, origin_city),
          dest_city = COALESCE(?, dest_city),
          is_favorite = COALESCE(?, is_favorite)
      WHERE id = ?
    `).run(origin_city, dest_city, is_favorite, id);
    const updated = db.prepare('SELECT * FROM routes WHERE id = ?').get(id);
    return res.json({ success: true, route: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteRoute = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM routes WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Route deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
