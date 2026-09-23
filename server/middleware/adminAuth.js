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

function getStaffPin() {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'staff_pin'").get();
    if (row && String(row.value).trim()) {
      return String(row.value).trim();
    }
  } catch (_) {}
  if (process.env.STAFF_PIN && String(process.env.STAFF_PIN).trim()) {
    return String(process.env.STAFF_PIN).trim();
  }
  return '2233';
}

function issueToken(role = 'admin') {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${role}:${exp}`;
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function issueAdminToken() {
  return issueToken('admin');
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let role = 'admin';
  let exp = 0;
  if (payload.includes(':')) {
    const colonIdx = payload.indexOf(':');
    role = payload.slice(0, colonIdx);
    exp = Number(payload.slice(colonIdx + 1));
  } else {
    exp = Number(payload);
  }

  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return { role, exp };
}

function verifyAdminToken(token) {
  const auth = verifyToken(token);
  return Boolean(auth);
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const auth = verifyToken(token);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  req.auth = auth;

  // If role is staff, restrict access to Booking Desk & Agents only
  if (auth.role === 'staff') {
    const path = req.path;
    const isStaffAllowed =
      path.startsWith('/api/bookings') ||
      path.startsWith('/api/agents') ||
      path.startsWith('/api/auth/admin/session') ||
      path === '/api/health';

    if (!isStaffAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Staff access restricted to Booking Inquiries Desk only'
      });
    }
  }

  return next();
}

module.exports = {
  getAdminPin,
  getStaffPin,
  issueToken,
  issueAdminToken,
  verifyToken,
  verifyAdminToken,
  requireAdmin
};
