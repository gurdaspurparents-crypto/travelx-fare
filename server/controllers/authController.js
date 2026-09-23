const { getAdminPin, issueAdminToken, requireAdmin } = require('../middleware/adminAuth');

exports.login = (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  if (!pin) {
    return res.status(400).json({ success: false, error: 'PIN is required' });
  }
  if (pin !== getAdminPin()) {
    return res.status(401).json({ success: false, error: 'Incorrect Security PIN' });
  }
  return res.json({
    success: true,
    token: issueAdminToken()
  });
};

exports.session = (req, res) => {
  return res.json({ success: true, authenticated: true });
};

exports.requireAdmin = requireAdmin;
