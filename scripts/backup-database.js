const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'server', 'data');
const dbPath = path.join(dataDir, 'travelx_fares.db');
const backupDir = path.join(dataDir, 'backups');

if (!fs.existsSync(dbPath)) {
  console.error('Database not found:', dbPath);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(backupDir, `travelx-manual-${stamp}.db`);

const db = new Database(dbPath, { readonly: true });
try {
  db.pragma('wal_checkpoint(FULL)');
} catch (_) {}
db.close();

fs.copyFileSync(dbPath, dest);
console.log('Backup saved:', dest);
