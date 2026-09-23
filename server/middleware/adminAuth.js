const crypto = require('crypto');
const db = require('../config/database');

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ||
  process.env.ADMIN_SECRET ||
  'travelx-change-this-secret-in-production';

function getAdminPin() {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'admin_pin'").get();
    if (row && String(row.value).trim()) {
      return String(row.value).trim();
    }
  } catch (_) {}
  if (process.env.ADMIN_PIN && String(process.env.ADMIN_PIN).trim()) {
    return String(process.env.ADMIN_PIN).trim();
  }
  return '7788';
}

function issueAdminToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = String(exp);
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return true;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }
  return next();
}

module.exports = {
  getAdminPin,
  issueAdminToken,
  verifyAdminToken,
  requireAdmin
};
