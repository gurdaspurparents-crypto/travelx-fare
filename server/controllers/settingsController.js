const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/database');
const { invalidateFaresCache } = require('./publicAgentController');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'travelx_fares.db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.db')) {
      return cb(new Error('Only .db SQLite backup files are allowed'));
    }
    return cb(null, true);
  }
});

exports.uploadBackupMiddleware = upload.single('backup');

exports.downloadDatabaseBackup = (req, res) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, error: 'Database file not found' });
    }
    try {
      db.pragma('wal_checkpoint(FULL)');
    } catch (_) {}
    const stamp = new Date().toISOString().slice(0, 10);
    return res.download(dbPath, `travelx-backup-${stamp}.db`);
  } catch (err) {
    console.error('Backup download error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create backup download' });
  }
};

exports.restoreDatabaseBackup = (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length < 1024) {
      return res.status(400).json({ success: false, error: 'Upload a valid .db backup file' });
    }

    const backupDir = path.join(dataDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const preRestore = path.join(
      backupDir,
      `pre-restore-${Date.now()}.db`
    );

    try {
      if (fs.existsSync(dbPath)) {
        try {
          db.pragma('wal_checkpoint(FULL)');
        } catch (_) {}
        fs.copyFileSync(dbPath, preRestore);
      }
    } catch (copyErr) {
      console.warn('Could not snapshot current DB before restore:', copyErr.message);
    }

    fs.writeFileSync(dbPath, req.file.buffer);
    try {
      fs.unlinkSync(`${dbPath}-wal`);
    } catch (_) {}
    try {
      fs.unlinkSync(`${dbPath}-shm`);
    } catch (_) {}

    invalidateFaresCache();

    return res.json({
      success: true,
      message: 'Database restored. Please restart the TravelX server once to reload all data cleanly.',
      pre_restore_backup: path.basename(preRestore)
    });
  } catch (err) {
    console.error('Restore error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to restore database' });
  }
};
