const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'travelx_fares.db');
const db = new Database(dbPath, { timeout: 10000 });

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
    insertSetting.run('admin_whatsapp_phone', '919888888888');
    insertSetting.run('admin_pin', process.env.ADMIN_PIN || '7788');
    insertSetting.run('staff_pin', process.env.STAFF_PIN || '2233');
    insertSetting.run('agency_contact_phone', '+91 98888 88888');
    insertSetting.run('agency_email', 'desk@travelx.co.in');
    insertSetting.run('callmebot_api_key', '');
    insertSetting.run('whatsapp_alerts_enabled', '0');
    insertSetting.run('auto_expiry_enabled', '1');
  } catch (e) {}

  wipeFaresOnce();
  collapseDuplicateFares();
  seedMasterData();
  ensureAppSettingsDefaults();
}

function wipeFaresOnce() {
  const flag = 'fares_wiped_v1';
  try {
    const existing = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(flag);
    if (existing) return;
    db.exec(`
      DELETE FROM published_specials;
      DELETE FROM fare_history;
      DELETE FROM fares;
      INSERT OR REPLACE INTO app_settings (key, value, updated_at)
      VALUES ('${flag}', '1', datetime('now', 'localtime'));
    `);
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}
    console.log('Cleared all saved fares for a clean start');
  } catch (e) {
    console.warn('Fare wipe note:', e.message);
  }
}

function collapseDuplicateFares() {
  try {
    db.exec(`
      UPDATE fares SET cabin = 'ECONOMY' WHERE cabin IS NULL OR TRIM(cabin) = '';
      UPDATE fares SET is_published = 1 WHERE travel_date >= date('now', 'localtime') AND (is_published IS NULL OR is_published = 0);
      DELETE FROM fares
      WHERE id NOT IN (
        SELECT MAX(id) FROM fares
        GROUP BY vendor_id, airline_code, origin, destination, travel_date, cabin
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fares_identity
      ON fares (vendor_id, airline_code, origin, destination, travel_date, cabin);
    `);
  } catch (e) {
    console.warn('Duplicate fare cleanup note:', e.message);
  }
}

function ensureAppSettingsDefaults() {
  try {
    const upsert = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO NOTHING
    `);
    upsert.run('admin_pin', process.env.ADMIN_PIN || '7788');
    upsert.run('agency_contact_phone', '+91 98888 88888');
    upsert.run('agency_email', 'desk@travelx.co.in');
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
      ['KQ', 'Kenya Airways', 'Kenya']
    ];
    for (const [code, name, country] of initialAirlines) {
      insertAirline.run(code, name, country);
    }
  }

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
    'Mayank'
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
      ['DEL', 'LHR', 'Delhi', 'London Heathrow', 1],
      ['DEL', 'BKK', 'Delhi', 'Bangkok', 1],
      ['BOM', 'DXB', 'Mumbai', 'Dubai', 1],
      ['BOM', 'JED', 'Mumbai', 'Jeddah', 1]
    ];
    for (const r of initialRoutes) {
      insertRoute.run(r[0], r[1], r[2], r[3], r[4]);
    }
  }

  // Seed initial margin slab rules if empty
  const marginCount = db.prepare('SELECT COUNT(*) as count FROM margin_rules').get().count;
  if (marginCount === 0) {
    const insertMargin = db.prepare(`
      INSERT INTO margin_rules (rule_name, rule_type, min_fare, max_fare, margin_amount, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const initialSlabs = [
      ['Slab 1: ₹0 - ₹10,000', 'SLAB', 0, 10000, 300, 10],
      ['Slab 2: ₹10,001 - ₹20,000', 'SLAB', 10001, 20000, 500, 9],
      ['Slab 3: ₹20,001 - ₹30,000', 'SLAB', 20001, 30000, 700, 8],
      ['Slab 4: ₹30,001+', 'SLAB', 30001, 99999999, 1000, 7]
    ];
    for (const s of initialSlabs) {
      insertMargin.run(s[0], s[1], s[2], s[3], s[4], s[5]);
    }
  }

  // Seed standard airline & sector margin rules if not already added
  const presetRules = [
    ['IndiGo (6E) Default Margin', 'FIXED', 0, 99999999, 300, '6E', null, null, 20],
    ['SpiceJet (SG) Default Margin', 'FIXED', 0, 99999999, 400, 'SG', null, null, 20],
    ['Air India (AI) Default Margin', 'FIXED', 0, 99999999, 500, 'AI', null, null, 20],
    ['Air India Express (IX) Default Margin', 'FIXED', 0, 99999999, 500, 'IX', null, null, 20],
    ['Air Arabia (G9) Default Margin', 'FIXED', 0, 99999999, 500, 'G9', null, null, 20],
    ['ATQ → DXB Sector Margin', 'FIXED', 0, 99999999, 600, null, 'ATQ', 'DXB', 25],
    ['ATQ → SHJ Sector Margin', 'FIXED', 0, 99999999, 500, null, 'ATQ', 'SHJ', 25]
  ];
  const checkRule = db.prepare('SELECT id FROM margin_rules WHERE rule_name = ?');
  const insertPreset = db.prepare(`
    INSERT INTO margin_rules (rule_name, rule_type, min_fare, max_fare, margin_amount, airline_code, origin, destination, priority, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  for (const p of presetRules) {
    if (!checkRule.get(p[0])) {
      insertPreset.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]);
    }
  }

  // Seed vendor pricing rules if table is empty
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

    // 2. Gulf Sector Slabs for Monga, Ghai, Kandhari, MMT, Air IQ, Bittu (ADD Karna Hai)
    const gulfVendorNames = ['Monga', 'Ghai', 'Kandhari', 'MMT', 'Air IQ', 'Bittu'];
    const gulfSectors = [
      ['ATQ', 'DXB'],
      ['ATQ', 'SHJ'],
      ['IXC', 'AUH']
    ];
    const slabs = [
      { min: 0, max: 10000, add: 100, label: '0-10000: Add 100' },
      { min: 10001, max: 15000, add: 200, label: '10001-15000: Add 200' },
      { min: 15001, max: 22000, add: 300, label: '15001-22000: Add 300' },
      { min: 22001, max: 99999999, add: 500, label: '22001+: Add 500' }
    ];

    const findVendorByName = db.prepare("SELECT id FROM vendors WHERE name = ? COLLATE NOCASE");
    for (const vName of gulfVendorNames) {
      const vRec = findVendorByName.get(vName);
      const vId = vRec ? vRec.id : null;
      for (const sec of gulfSectors) {
        for (const slab of slabs) {
          insertVRule.run(
            vId,
            vName,
            null, // all airlines on this sector
            sec[0],
            sec[1],
            slab.min,
            slab.max,
            'ADD',
            slab.add,
            20,
            `${vName} ${sec[0]}➔${sec[1]} (${slab.label})`
          );
        }
      }
    }
  } else {
    // Ensure any Gulf vendor missing rules gets seeded even if table is not empty
    const gulfVendorNames = ['Monga', 'Ghai', 'Kandhari', 'MMT', 'Air IQ', 'Bittu'];
    const gulfSectors = [
      ['ATQ', 'DXB'],
      ['ATQ', 'SHJ'],
      ['IXC', 'AUH']
    ];
    const slabs = [
      { min: 0, max: 10000, add: 100, label: '0-10000: Add 100' },
      { min: 10001, max: 15000, add: 200, label: '10001-15000: Add 200' },
      { min: 15001, max: 22000, add: 300, label: '15001-22000: Add 300' },
      { min: 22001, max: 99999999, add: 500, label: '22001+: Add 500' }
    ];
    const insertVRuleFallback = db.prepare(`
      INSERT INTO vendor_pricing_rules (
        vendor_id, vendor_name, airline_code, origin, destination, 
        min_fare, max_fare, adjustment_type, adjustment_amount, priority, is_active, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const countVendorRules = db.prepare("SELECT COUNT(*) as count FROM vendor_pricing_rules WHERE vendor_name = ? COLLATE NOCASE");
    const findVendorByName = db.prepare("SELECT id FROM vendors WHERE name = ? COLLATE NOCASE");

    for (const vName of gulfVendorNames) {
      const existing = countVendorRules.get(vName);
      if (existing.count === 0) {
        const vRec = findVendorByName.get(vName);
        const vId = vRec ? vRec.id : null;
        for (const sec of gulfSectors) {
          for (const slab of slabs) {
            insertVRuleFallback.run(
              vId,
              vName,
              null,
              sec[0],
              sec[1],
              slab.min,
              slab.max,
              'ADD',
              slab.add,
              20,
              `${vName} ${sec[0]}➔${sec[1]} (${slab.label})`
            );
          }
        }
      }
    }
  }
}

initSchema();
maybeDailyAutoBackup();

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

setImmediate(() => {
  try {
    const { seedRealisticFares } = require('./seedFares');
    seedRealisticFares();
  } catch (e) {
    console.warn('Seed fares check skipped:', e.message);
  }
});

