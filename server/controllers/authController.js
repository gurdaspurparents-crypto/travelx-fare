const { getAdminPin, getStaffPin, issueToken, requireAdmin } = require('../middleware/adminAuth');

exports.login = (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  if (!pin) {
    return res.status(400).json({ success: false, error: 'PIN is required' });
  }

  const adminPin = getAdminPin();
  const staffPin = getStaffPin();

  if (pin === adminPin) {
    return res.json({
      success: true,
      role: 'admin',
      token: issueToken('admin')
    });
  }

  if (pin === staffPin) {
    return res.json({
      success: true,
      role: 'staff',
      token: issueToken('staff')
    });
  }

  return res.status(401).json({ success: false, error: 'Incorrect Security PIN' });
};

exports.session = (req, res) => {
  const role = req.auth?.role || 'admin';
  return res.json({ success: true, authenticated: true, role });
};

exports.requireAdmin = requireAdmin;
