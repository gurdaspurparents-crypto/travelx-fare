const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Smart detection of data directory (handles Render persistent disk, environment variables, typos, and permissions)
function resolveDataDir() {
  const candidates = [];

  // 1. If process.env.DATA_DIR is specified
  if (process.env.DATA_DIR) {
    let envDir = process.env.DATA_DIR.trim();
    // Fix common typo where user typed /var/dat instead of /var/data
    if (envDir === '/var/dat' || envDir === '/var/dat/') {
      candidates.push('/var/data');
    }
    candidates.push(envDir);
  }

  // 2. Check standard Render persistent disk mount path
  if (fs.existsSync('/var/data')) {
    candidates.push('/var/data');
  }

  // 3. Check default app local data directory
  candidates.push(path.join(__dirname, '..', 'data'));

  // 4. Temporary directory fallback if everything else fails
  candidates.push(path.join(require('os').tmpdir(), 'travelx_data'));

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      // Verify we have read & write permissions in this directory
      fs.accessSync(candidate, fs.constants.R_OK | fs.constants.W_OK);
      console.log(`Using writable data directory: ${candidate}`);
      return candidate;
    } catch (err) {
      console.warn(`Candidate data directory "${candidate}" not usable (${err.message}). Trying next...`);
    }
  }

  // Ultimate fallback
  const fallback = path.join(__dirname, '..', 'data');
  try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
  return fallback;
}

const dataDir = resolveDataDir();
const localFallbackDb = path.join(__dirname, '..', 'data', 'travelx_fares.db');
const dbPath = path.join(dataDir, 'travelx_fares.db');

if (dataDir !== path.join(__dirname, '..', 'data') && !fs.existsSync(dbPath) && fs.existsSync(localFallbackDb)) {
  try {
    fs.copyFileSync(localFallbackDb, dbPath);
    console.log(`Copied initial seed database to persistent storage at: ${dbPath}`);
  } catch (copyErr) {
    console.warn('Could not copy initial database:', copyErr.message);
  }
}

console.log('SQLite database:', dbPath);
const db = new Database(dbPath, { timeout: 10000 });
db.dbPath = dbPath;
db.dataDir = dataDir;

// Enable WAL mode & busy timeout for high concurrency and zero locks
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 10000');
db.pragma('foreign_keys = ON');

// Initialize database schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS airlines (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT DEFAULT 'India',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      phone TEXT,
      email TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      origin_city TEXT,
      dest_city TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(origin, destination)
    );

    CREATE TABLE IF NOT EXISTS margin_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      rule_type TEXT DEFAULT 'SLAB', -- 'SLAB', 'FIXED', 'PERCENT'
      min_fare REAL DEFAULT 0,
      max_fare REAL DEFAULT 99999999,
      margin_amount REAL DEFAULT 0,
      margin_percent REAL DEFAULT 0,
      airline_code TEXT,
      origin TEXT,
      destination TEXT,
      priority INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS vendor_pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER,
      vendor_name TEXT,
      airline_code TEXT,
      origin TEXT,
      destination TEXT,
      min_fare REAL DEFAULT 0,
      max_fare REAL DEFAULT 99999999,
      adjustment_type TEXT DEFAULT 'LESS', -- 'LESS' or 'ADD'
      adjustment_amount REAL NOT NULL,
      priority INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS fares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      airline_code TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      travel_date TEXT NOT NULL, -- YYYY-MM-DD
      flight_number TEXT,
      departure_time TEXT,
      arrival_time TEXT,
      net_fare REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      cabin TEXT DEFAULT 'ECONOMY',
      baggage TEXT DEFAULT '30kg',
      is_refundable TEXT DEFAULT 'NON_REFUNDABLE',
      remarks TEXT,
      margin_amount REAL DEFAULT 0,
      publish_fare REAL DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
      FOREIGN KEY (airline_code) REFERENCES airlines (code) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_fares_lookup 
      ON fares (origin, destination, travel_date, airline_code);
    CREATE INDEX IF NOT EXISTS idx_fares_vendor 
      ON fares (vendor_id);
    CREATE INDEX IF NOT EXISTS idx_fares_date 
      ON fares (travel_date);

    CREATE TABLE IF NOT EXISTS fare_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fare_id INTEGER,
      vendor_id INTEGER NOT NULL,
      airline_code TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      travel_date TEXT NOT NULL,
      flight_number TEXT,
      old_fare REAL NOT NULL,
      new_fare REAL NOT NULL,
      fare_diff REAL NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now', 'localtime')),
      reason TEXT DEFAULT 'Price update',
      FOREIGN KEY (vendor_id) REFERENCES vendors (id)
    );

    CREATE INDEX IF NOT EXISTS idx_history_route 
      ON fare_history (origin, destination, travel_date);

    CREATE TABLE IF NOT EXISTS published_specials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fare_id INTEGER NOT NULL,
      batch_id TEXT NOT NULL,
      custom_title TEXT,
      notes TEXT,
      published_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (fare_id) REFERENCES fares (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS b2b_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT NOT NULL UNIQUE,
      agency_name TEXT NOT NULL,
      agent_name TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      is_verified INTEGER DEFAULT 1,
      total_bookings INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      last_active_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_agents_mobile ON b2b_agents (mobile);

    CREATE TABLE IF NOT EXISTS booking_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_ref TEXT NOT NULL UNIQUE,
      agent_id INTEGER,
      agent_name TEXT,
      agency_name TEXT NOT NULL,
      agent_mobile TEXT NOT NULL,
      agent_email TEXT,
      agent_address TEXT,
      agent_city TEXT,
      agent_state TEXT,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      route_label TEXT,
      airline_code TEXT,
      airline_name TEXT,
      flight_number TEXT,
      travel_date TEXT NOT NULL,
      departure_time TEXT,
      arrival_time TEXT,
      duration TEXT,
      quoted_rate REAL NOT NULL,
      pax_count INTEGER DEFAULT 1,
      total_amount REAL NOT NULL,
      baggage TEXT,
      remarks TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (agent_id) REFERENCES b2b_agents (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_status ON booking_requests (status);
    CREATE INDEX IF NOT EXISTS idx_bookings_date ON booking_requests (created_at);
    CREATE INDEX IF NOT EXISTS idx_bookings_mobile ON booking_requests (agent_mobile);
  `);

  // Safe migrations: check columns first before ALTER TABLE to prevent error crashes
  function ensureColumn(table, column, type) {
    try {
      const existing = db.pragma(`table_info(${table})`);
      if (!existing.some(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
      }
    } catch (e) {
      console.warn(`Column migration note for ${table}.${column}:`, e.message);
    }
  }

  ensureColumn('b2b_agents', 'email', 'TEXT');
  ensureColumn('b2b_agents', 'address', 'TEXT');
  ensureColumn('b2b_agents', 'state', 'TEXT');
  ensureColumn('b2b_agents', 'pincode', 'TEXT');
  ensureColumn('b2b_agents', 'pin', 'TEXT');
  ensureColumn('b2b_agents', 'password_hash', 'TEXT');
  ensureColumn('b2b_agents', 'logo_data', 'TEXT');
  ensureColumn('b2b_agents', 'status', "TEXT DEFAULT 'ACTIVE'");
  ensureColumn('booking_requests', 'agent_email', 'TEXT');
  ensureColumn('booking_requests', 'agent_address', 'TEXT');
  ensureColumn('booking_requests', 'agent_state', 'TEXT');
  ensureColumn('booking_requests', 'vendor_id', 'INTEGER');
  ensureColumn('booking_requests', 'vendor_name', 'TEXT');
  ensureColumn('booking_requests', 'vendor_phone', 'TEXT');
  ensureColumn('booking_requests', 'net_fare', 'REAL');
  ensureColumn('booking_requests', 'pnr_code', 'TEXT');
  ensureColumn('booking_requests', 'ticket_file_path', 'TEXT');
  ensureColumn('booking_requests', 'passport_files', 'TEXT');
  ensureColumn('booking_requests', 'revised_fare', 'REAL');
  ensureColumn('booking_requests', 'admin_notes', 'TEXT');
  ensureColumn('booking_requests', 'pax_adults', 'INTEGER DEFAULT 1');
  ensureColumn('booking_requests', 'pax_children', 'INTEGER DEFAULT 0');
  ensureColumn('booking_requests', 'pax_infants', 'INTEGER DEFAULT 0');
  ensureColumn('booking_requests', 'infant_fare', 'REAL');

  // Safe migration: sanitize any legacy DD-MM-YYYY dates in fares to ISO YYYY-MM-DD
  try {
    const badFares = db.prepare("SELECT id, travel_date FROM fares WHERE travel_date NOT LIKE '____-__-__'").all();
    if (badFares && badFares.length > 0) {
      const updateStmt = db.prepare("UPDATE fares SET travel_date = ? WHERE id = ?");
      for (const bf of badFares) {
        const m = String(bf.travel_date || '').trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          const day = m[1].padStart(2, '0');
          const month = m[2].padStart(2, '0');
          let year = m[3];
          if (year.length === 2) year = `20${year}`;
          const currentYear = new Date().getFullYear();
          if (Number(year) < currentYear) year = String(currentYear);
          const iso = `${year}-${month}-${day}`;
          updateStmt.run(iso, bf.id);
        }
      }
    }
  } catch (e) {
    console.warn('Date sanitization migration note:', e.message);
  }

  // Default app settings
  try {
    const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)');
    insertSetting.run('admin_whatsapp_phone', '918146526257');
    insertSetting.run('staff_whatsapp_phone', '917814508351');
    insertSetting.run('admin_pin', process.env.ADMIN_PIN || '8286#');
    insertSetting.run('staff_pin', process.env.STAFF_PIN || '2018#');
    insertSetting.run('agency_contact_phone', '+91 81465 26257');
    insertSetting.run('agency_email', 'desk@travelx.co.in');
    insertSetting.run('callmebot_api_key', '');
    insertSetting.run('staff_callmebot_api_key', '');
    insertSetting.run('whatsapp_alerts_enabled', '1');
    insertSetting.run('auto_expiry_enabled', '1');
    insertSetting.run('maintenance_mode', '0');

    // Ensure PIN credentials and alert phone numbers match requested production credentials
    const upsertSetting = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    upsertSetting.run('admin_pin', process.env.ADMIN_PIN || '8286#');
    upsertSetting.run('staff_pin', process.env.STAFF_PIN || '2018#');
    upsertSetting.run('admin_whatsapp_phone', '918146526257');
    upsertSetting.run('staff_whatsapp_phone', '917814508351');
    upsertSetting.run('whatsapp_alerts_enabled', '1');

    // Update any dummy/placeholder phone numbers in app_settings to Navkiran's official number
    db.prepare(`
      UPDATE app_settings 
      SET value = '918146526257' 
      WHERE key = 'admin_whatsapp_phone' AND (value LIKE '%98888%' OR value LIKE '%98883%' OR value = '')
    `).run();
    db.prepare(`
      UPDATE app_settings 
      SET value = '+91 81465 26257' 
      WHERE key = 'agency_contact_phone' AND (value LIKE '%98888%' OR value LIKE '%98883%' OR value = '')
    `).run();
  } catch (e) {}

  // Retain all existing fares safely across all restarts/updates
  collapseDuplicateFares();
  seedMasterData();
  ensureAppSettingsDefaults();
}

function collapseDuplicateFares() {
  try {
    db.exec(`
      UPDATE fares SET cabin = 'ECONOMY' WHERE cabin IS NULL OR TRIM(cabin) = '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fares_identity
      ON fares (vendor_id, airline_code, origin, destination, travel_date, cabin);
    `);
  } catch (e) {
    console.warn('Duplicate fare index note:', e.message);
  }
}

function ensureAppSettingsDefaults() {
  try {
    const upsert = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO NOTHING
    `);
    upsert.run('admin_pin', process.env.ADMIN_PIN || '8286#');
    upsert.run('staff_pin', process.env.STAFF_PIN || '2018#');
    upsert.run('agency_contact_phone', '+91 81465 26257');
    upsert.run('admin_whatsapp_phone', '918146526257');
    upsert.run('staff_whatsapp_phone', '917814508351');
    upsert.run('agency_email', 'desk@travelx.co.in');
    upsert.run('whatsapp_alerts_enabled', '1');
  } catch (e) {}
}

function seedMasterData() {
  // Seed initial airlines if empty
  const airlineCount = db.prepare('SELECT COUNT(*) as count FROM airlines').get().count;
  if (airlineCount < 30) {
    const insertAirline = db.prepare('INSERT OR IGNORE INTO airlines (code, name, country) VALUES (?, ?, ?)');
    const initialAirlines = [
      ['AI', 'Air India', 'India'],
      ['6E', 'IndiGo', 'India'],
      ['IX', 'Air India Express', 'India'],
      ['SG', 'SpiceJet', 'India'],
      ['UK', 'Vistara', 'India'],
      ['QP', 'Akasa Air', 'India'],
      ['S5', 'Star Air', 'India'],
      ['IC', 'Fly91', 'India'],
      ['9I', 'Alliance Air', 'India'],
      ['EK', 'Emirates', 'UAE'],
      ['FZ', 'flydubai', 'UAE'],
      ['G9', 'Air Arabia', 'UAE'],
      ['EY', 'Etihad Airways', 'UAE'],
      ['QR', 'Qatar Airways', 'Qatar'],
      ['WY', 'Oman Air', 'Oman'],
      ['OV', 'SalamAir', 'Oman'],
      ['SV', 'Saudia', 'Saudi Arabia'],
      ['XY', 'Flynas', 'Saudi Arabia'],
      ['F3', 'Flyadeal', 'Saudi Arabia'],
      ['KU', 'Kuwait Airways', 'Kuwait'],
      ['J9', 'Jazeera Airways', 'Kuwait'],
      ['GF', 'Gulf Air', 'Bahrain'],
      ['MS', 'EgyptAir', 'Egypt'],
      ['W5', 'Mahan Air', 'Iran'],
      ['UL', 'SriLankan Airlines', 'Sri Lanka'],
      ['BG', 'Biman Bangladesh', 'Bangladesh'],
      ['BS', 'US-Bangla Airlines', 'Bangladesh'],
      ['RA', 'Nepal Airlines', 'Nepal'],
      ['H9', 'Himalaya Airlines', 'Nepal'],
      ['KB', 'Drukair', 'Bhutan'],
      ['RQ', 'Kam Air', 'Afghanistan'],
      ['SQ', 'Singapore Airlines', 'Singapore'],
      ['MH', 'Malaysia Airlines', 'Malaysia'],
      ['OD', 'Batik Air Malaysia', 'Malaysia'],
      ['AK', 'AirAsia', 'Malaysia'],
      ['TG', 'Thai Airways', 'Thailand'],
      ['SL', 'Thai Lion Air', 'Thailand'],
      ['VJ', 'VietJet Air', 'Vietnam'],
      ['VN', 'Vietnam Airlines', 'Vietnam'],
      ['CX', 'Cathay Pacific', 'Hong Kong'],
      ['GA', 'Garuda Indonesia', 'Indonesia'],
      ['NH', 'All Nippon Airways (ANA)', 'Japan'],
      ['JL', 'Japan Airlines', 'Japan'],
      ['KE', 'Korean Air', 'South Korea'],
      ['KC', 'Air Astana', 'Kazakhstan'],
      ['HY', 'Uzbekistan Airways', 'Uzbekistan'],
      ['BA', 'British Airways', 'United Kingdom'],
      ['VS', 'Virgin Atlantic', 'United Kingdom'],
      ['LH', 'Lufthansa', 'Germany'],
      ['AF', 'Air France', 'France'],
      ['KL', 'KLM Royal Dutch Airlines', 'Netherlands'],
      ['LX', 'Swiss International Air Lines', 'Switzerland'],
      ['TK', 'Turkish Airlines', 'Turkey'],
      ['AZ', 'ITA Airways', 'Italy'],
      ['LO', 'LOT Polish Airlines', 'Poland'],
      ['AY', 'Finnair', 'Finland'],
      ['OS', 'Austrian Airlines', 'Austria'],
      ['SK', 'Scandinavian Airlines (SAS)', 'Sweden'],
      ['AC', 'Air Canada', 'Canada'],
      ['UA', 'United Airlines', 'USA'],
      ['AA', 'American Airlines', 'USA'],
      ['DL', 'Delta Air Lines', 'USA'],
      ['QF', 'Qantas', 'Australia'],
      ['ET', 'Ethiopian Airlines', 'Ethiopia'],
      ['KQ', 'Kenya Airways', 'Kenya'],
      ['XJ', 'Thai AirAsia X', 'Thailand'],
      ['FD', 'Thai AirAsia', 'Thailand']
    ];
    for (const [code, name, country] of initialAirlines) {
      insertAirline.run(code, name, country);
    }
  }

  // Ensure XJ and FD exist and country is correctly Thailand
  try {
    const upsertAirline = db.prepare(`
      INSERT INTO airlines (code, name, country) VALUES (?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET country = excluded.country WHERE airlines.country = 'India' OR airlines.country IS NULL
    `);
    upsertAirline.run('XJ', 'Thai AirAsia X', 'Thailand');
    upsertAirline.run('FD', 'Thai AirAsia', 'Thailand');
  } catch (_) {}

  // Seed initial vendors if missing
  const initialVendors = [
    'MMT',
    'Monga',
    'Kandhari',
    'Ghai',
    'Air IQ',
    'Bittu',
    'Akbar',
    'MTC',
    'Speed',
    'Bipasha',
    'Mayank',
    'Shree Balaji'
  ];
  const findVendorCaseInsensitive = db.prepare('SELECT id FROM vendors WHERE name = ? COLLATE NOCASE');
  const insertVendor = db.prepare('INSERT INTO vendors (name, phone, email, notes, is_active) VALUES (?, ?, ?, ?, 1)');
  for (const vName of initialVendors) {
    if (!findVendorCaseInsensitive.get(vName)) {
      insertVendor.run(vName, '', '', '');
    }
  }

  // Deduplicate and normalize Air IQ if multiple case variants exist
  try {
    const airIqRows = db.prepare("SELECT id, name FROM vendors WHERE name = 'Air IQ' OR name = 'AIr IQ'").all();
    if (airIqRows.length > 1) {
      const canonical = airIqRows[0];
      const dup = airIqRows[1];
      db.prepare("UPDATE fares SET vendor_id = ? WHERE vendor_id = ?").run(canonical.id, dup.id);
      db.prepare("UPDATE vendor_pricing_rules SET vendor_id = ? WHERE vendor_id = ?").run(canonical.id, dup.id);
      db.prepare("DELETE FROM vendors WHERE id = ?").run(dup.id);
      db.prepare("UPDATE vendors SET name = 'Air IQ' WHERE id = ?").run(canonical.id);
    }
  } catch (_) {}

  // Update vendor_id in vendor_pricing_rules if it was null
  try {
    db.exec(`
      UPDATE vendor_pricing_rules 
      SET vendor_id = (SELECT id FROM vendors WHERE vendors.name = vendor_pricing_rules.vendor_name COLLATE NOCASE)
      WHERE vendor_id IS NULL;
    `);
  } catch (_) {}


  // Seed initial routes if empty
  const routeCount = db.prepare('SELECT COUNT(*) as count FROM routes').get().count;
  if (routeCount === 0) {
    const insertRoute = db.prepare('INSERT INTO routes (origin, destination, origin_city, dest_city, is_favorite) VALUES (?, ?, ?, ?, ?)');
    const initialRoutes = [
      ['ATQ', 'DXB', 'Amritsar', 'Dubai', 1],
      ['ATQ', 'SHJ', 'Amritsar', 'Sharjah', 1],
      ['ATQ', 'DOH', 'Amritsar', 'Doha', 1],
      ['ATQ', 'KWI', 'Amritsar', 'Kuwait', 1],
      ['ATQ', 'SIN', 'Amritsar', 'Singapore', 1],
      ['ATQ', 'KUL', 'Amritsar', 'Kuala Lumpur', 1],
      ['ATQ', 'BOM', 'Amritsar', 'Mumbai', 0],
      ['ATQ', 'DEL', 'Amritsar', 'Delhi', 0],
      ['DEL', 'DXB', 'Delhi', 'Dubai', 1],
      ['DEL', 'SHJ', 'Delhi', 'Sharjah', 1],
      ['DEL', 'AUH', 'Delhi', 'Abu Dhabi', 1],
      ['IXC', 'AUH', 'Chandigarh', 'Abu Dhabi', 1],
      ['DEL', 'LHR', 'Delhi', 'London Heathrow', 1],
      ['DEL', 'BKK', 'Delhi', 'Bangkok', 1],
      ['BOM', 'DXB', 'Mumbai', 'Dubai', 1],
      ['BOM', 'JED', 'Mumbai', 'Jeddah', 1]
    ];
    for (const r of initialRoutes) {
      insertRoute.run(r[0], r[1], r[2], r[3], r[4]);
    }
  }

  // Seed standard Gulf Sector Margin Slab Rules (All Vendors, All Airlines)
  // Slabs: 0-15000: ₹200 | 15001-20000: ₹300 | 20001-30000+: ₹500
  const gulfMarginSectors = [
    { origin: 'ATQ', destination: 'DXB' },
    { origin: 'ATQ', destination: 'SHJ' },
    { origin: 'IXC', destination: 'AUH' },
    { origin: 'DEL', destination: 'DXB' },
    { origin: 'DEL', destination: 'SHJ' },
    { origin: 'DEL', destination: 'AUH' }
  ];

  const gulfSlabs = [
    { min: 0, max: 15000, margin: 200, label: '₹0 - ₹15,000' },
    { min: 15001, max: 20000, margin: 300, label: '₹15,001 - ₹20,000' },
    { min: 20001, max: 99999999, margin: 500, label: '₹20,001 - ₹30,000+' }
  ];

  // Clean up any legacy preset margin rules that should not exist
  try {
    const legacyRuleNames = [
      'IndiGo (6E) Default Margin',
      'SpiceJet (SG) Default Margin',
      'Air India (AI) Default Margin',
      'Air India Express (IX) Default Margin',
      'Air Arabia (G9) Default Margin',
      'ATQ → DXB Sector Margin',
      'ATQ → SHJ Sector Margin',
      'Slab 1: ₹0 - ₹10,000',
      'Slab 2: ₹10,001 - ₹20,000',
      'Slab 3: ₹20,001 - ₹30,000',
      'Slab 4: ₹30,001+'
    ];
    const deleteLegacy = db.prepare('DELETE FROM margin_rules WHERE rule_name = ?');
    for (const name of legacyRuleNames) {
      deleteLegacy.run(name);
    }
  } catch (_) {}

  // Clean up obsolete Gulf markup rules from vendor_pricing_rules so they don't double-charge
  try {
    db.prepare(`
      DELETE FROM vendor_pricing_rules 
      WHERE origin IN ('ATQ', 'IXC', 'DEL') 
        AND destination IN ('DXB', 'SHJ', 'AUH')
        AND adjustment_type = 'ADD'
    `).run();
  } catch (_) {}

  const checkMarginRule = db.prepare('SELECT id FROM margin_rules WHERE origin = ? AND destination = ? AND min_fare = ?');
  const insertMarginRule = db.prepare(`
    INSERT INTO margin_rules (
      rule_name, rule_type, min_fare, max_fare, margin_amount, 
      margin_percent, airline_code, origin, destination, priority, is_active
    ) VALUES (?, 'SLAB', ?, ?, ?, 0, NULL, ?, ?, 10, 1)
  `);

  for (const sec of gulfMarginSectors) {
    for (const slab of gulfSlabs) {
      const exists = checkMarginRule.get(sec.origin, sec.destination, slab.min);
      if (!exists) {
        insertMarginRule.run(
          `${sec.origin} → ${sec.destination} (${slab.label})`,
          slab.min,
          slab.max,
          slab.margin,
          sec.origin,
          sec.destination
        );
      }
    }
  }

  // Clean up obsolete Gulf markup rules from vendor_pricing_rules so they don't double-charge
  try {
    db.prepare(`
      DELETE FROM vendor_pricing_rules 
      WHERE origin IN ('ATQ', 'IXC', 'DEL') 
        AND destination IN ('DXB', 'SHJ', 'AUH')
        AND adjustment_type = 'ADD'
    `).run();
  } catch (_) {}

  // Seed vendor pricing rules if table is empty (Bipasha Europe discounts only)
  const vRuleCount = db.prepare('SELECT COUNT(*) as count FROM vendor_pricing_rules').get().count;
  if (vRuleCount === 0) {
    const insertVRule = db.prepare(`
      INSERT INTO vendor_pricing_rules (
        vendor_id, vendor_name, airline_code, origin, destination, 
        min_fare, max_fare, adjustment_type, adjustment_amount, priority, is_active, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    // 1. Bipasha Rules (Less Karna Hai)
    const bipasha = db.prepare("SELECT id FROM vendors WHERE name LIKE '%Bipasha%'").get();
    const bipashaId = bipasha ? bipasha.id : 17;
    const bipashaRules = [
      // Air India
      ['AI', 'DEL', 'MXP', 2500, 'Air India Del TO Millan: Less 2500'],
      ['AI', 'MXP', 'DEL', 2500, 'Air India Millan to Del: Less 2500'],
      ['AI', 'DEL', 'MIL', 2500, 'Air India Del TO Millan: Less 2500'],
      ['AI', 'MIL', 'DEL', 2500, 'Air India Millan to Del: Less 2500'],
      ['AI', 'DEL', 'FCO', 3000, 'Air India Del to Rome: Less 3000'],
      ['AI', 'FCO', 'DEL', 2500, 'Air India Rome to Del: Less 2500'],
      ['AI', 'DEL', 'ROM', 3000, 'Air India Del to Rome: Less 3000'],
      ['AI', 'ROM', 'DEL', 2500, 'Air India Rome to Del: Less 2500'],
      // ITA Airline
      ['AZ', 'DEL', 'MXP', 3500, 'ITA Airline Del TO Millan: Less 3500'],
      ['AZ', 'MXP', 'DEL', 3000, 'ITA Airline Millan to Del: Less 3000'],
      ['AZ', 'DEL', 'MIL', 3500, 'ITA Airline Del TO Millan: Less 3500'],
      ['AZ', 'MIL', 'DEL', 3000, 'ITA Airline Millan to Del: Less 3000'],
      ['AZ', 'DEL', 'FCO', 3500, 'ITA Airline Del to Rome: Less 3500'],
      ['AZ', 'FCO', 'DEL', 3000, 'ITA Airline Rome to Del: Less 3000'],
      ['AZ', 'DEL', 'ROM', 3500, 'ITA Airline Del to Rome: Less 3500'],
      ['AZ', 'ROM', 'DEL', 3000, 'ITA Airline Rome to Del: Less 3000'],
      ['AZ', 'DEL', 'YYZ', 3000, 'ITA Airline Del to YYZ: Less 3000'],
      ['AZ', 'YYZ', 'DEL', 3000, 'ITA Airline YYZ to Del: Less 3000']
    ];

    for (const br of bipashaRules) {
      insertVRule.run(bipashaId, 'Bipasha', br[0], br[1], br[2], 0, 99999999, 'LESS', br[3], 30, br[4]);
    }
  }
}

initSchema();
seedFaresIfEmpty();
maybeDailyAutoBackup();

function seedFaresIfEmpty() {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM fares').get()?.c || 0;
    if (count > 0) return;

    const seedFile = path.join(__dirname, 'seed_fares.json');
    if (!fs.existsSync(seedFile)) return;

    const raw = fs.readFileSync(seedFile, 'utf8');
    const fares = JSON.parse(raw);
    if (!Array.isArray(fares) || fares.length === 0) return;

    console.log(`[Database] Auto-seeding ${fares.length} master special fares...`);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO fares (
        id, vendor_id, airline_code, origin, destination, travel_date,
        flight_number, departure_time, arrival_time, net_fare, currency,
        cabin, baggage, is_refundable, remarks, margin_amount, publish_fare, is_published,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    const tx = db.transaction(() => {
      for (const f of fares) {
        insert.run(
          f.id,
          f.vendor_id || 1,
          f.airline_code,
          f.origin,
          f.destination,
          f.travel_date,
          f.flight_number || '',
          f.departure_time || '',
          f.arrival_time || '',
          f.net_fare,
          f.currency || 'INR',
          f.cabin || 'ECONOMY',
          f.baggage || '30kg',
          f.is_refundable || 'NON_REFUNDABLE',
          f.remarks || '',
          f.margin_amount !== undefined ? f.margin_amount : 0,
          f.publish_fare || f.net_fare,
          f.is_published !== undefined ? f.is_published : 1,
          f.created_at || new Date().toISOString(),
          f.updated_at || new Date().toISOString()
        );
      }
    });

    tx();
    console.log(`[Database] Successfully seeded ${fares.length} special fares into database!`);
  } catch (err) {
    console.warn('[Database] Seed fares failed:', err.message);
  }
}

function maybeDailyAutoBackup() {
  try {
    const backupDir = path.join(dataDir, 'backups');
    if (!fs.existsSync(dbPath)) return;
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const dest = path.join(backupDir, `travelx-auto-${stamp}.db`);
    if (!fs.existsSync(dest)) {
      try {
        db.pragma('wal_checkpoint(FULL)');
      } catch (_) {}
      fs.copyFileSync(dbPath, dest);
    }
  } catch (e) {
    console.warn('Auto backup skipped:', e.message);
  }
}

module.exports = db;

