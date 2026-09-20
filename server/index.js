const express = require('express');
const cors = require('cors');
const path = require('path');

// Ensure DB is initialized
require('./config/database');

const fareController = require('./controllers/fareController');
const compareController = require('./controllers/compareController');
const marginController = require('./controllers/marginController');
const masterController = require('./controllers/masterController');
const exportController = require('./controllers/exportController');
const vendorRuleController = require('./controllers/vendorRuleController');
const publicAgentController = require('./controllers/publicAgentController');
const bookingController = require('./controllers/bookingController');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Travelx Special Fare Manager',
    time: new Date().toISOString()
  });
});

// Public Sanitized B2B Agent Portal APIs (Zero Vendor, Zero Net Fare, Zero Margin)
app.get('/api/public/fares', publicAgentController.getPublicFares);
app.get('/api/public/config', publicAgentController.getPublicConfig);
app.get('/api/public/agent/lookup', bookingController.lookupAgent);
app.post('/api/public/agent/register', bookingController.registerOrUpdateAgent);
app.post('/api/public/bookings/create', bookingController.createBookingRequest);
app.get('/api/public/bookings/track/:ref', bookingController.trackBooking);
app.post('/api/public/bookings/:ref/passports', bookingController.uploadPassportsMiddleware, bookingController.uploadPassports);
app.get('/api/public/bookings/:ref/ticket-download', bookingController.downloadTicket);

// Admin Booking Requests & B2B Agent Directory APIs
app.get('/api/bookings', bookingController.getBookingRequests);
app.patch('/api/bookings/:id/status', bookingController.updateBookingStatus);
app.patch('/api/bookings/:id/review', bookingController.reviewBookingRequest);
app.post('/api/bookings/:id/ticket', bookingController.uploadTicketMiddleware, bookingController.uploadTicket);
app.get('/api/bookings/:id/passport-download/:filename', bookingController.downloadPassport);
app.get('/api/agents', bookingController.getAgentsDirectory);
app.post('/api/agents', bookingController.createAgentFromAdmin);
app.put('/api/agents/:id', bookingController.updateAgentFromAdmin);

// WhatsApp Business & Automation Settings APIs
app.get('/api/settings/whatsapp', bookingController.getWhatsAppSettings);
app.post('/api/settings/whatsapp', bookingController.saveWhatsAppSettings);
app.post('/api/settings/whatsapp/test', bookingController.testWhatsAppAlert);

// Dashboard APIs
app.get('/api/dashboard/stats', compareController.getDashboardStats);

// Fare Management APIs
app.get('/api/fares', fareController.getAllFares);
app.post('/api/fares/single', fareController.createSingleFare);
app.post('/api/fares/quick-grid', fareController.saveQuickGridFares);
app.post('/api/fares/date-range', fareController.saveDateRangeFares);
app.post('/api/fares/parse-whatsapp', fareController.parseWhatsAppText);
app.post('/api/fares/parse-image-ai', fareController.parseImageWithAI);
app.post('/api/fares/bulk-save', fareController.saveBulkParsedFares);
app.post('/api/fares/batch-update-margins', fareController.batchUpdateMargins);
app.put('/api/fares/:id', fareController.updateFare);
app.delete('/api/fares/:id', fareController.deleteFare);
app.post('/api/fares/clear-all', fareController.clearAllFares);
app.post('/api/fares/clear-vendor/:vendor_id', fareController.clearVendorFares);
app.post('/api/fares/batch-delete', fareController.batchDeleteFares);
app.get('/api/fares/vendor-stats/:vendor_id', fareController.getVendorFareStats);
app.get('/api/fares/history', fareController.getFareHistory);

// Fare Comparison Desk
app.get('/api/compare', compareController.getComparisonView);
app.get('/api/compare/best-fares', compareController.getBestFares);

// Margin Engine APIs
app.get('/api/margins/rules', marginController.getAllRules);
app.post('/api/margins/rules', marginController.createRule);
app.put('/api/margins/rules/:id', marginController.updateRule);
app.delete('/api/margins/rules/:id', marginController.deleteRule);
app.post('/api/margins/preview', marginController.previewMargin);

// Vendor Pricing & Discount Rules APIs
app.get('/api/vendor-rules', vendorRuleController.getAllVendorRules);
app.post('/api/vendor-rules', vendorRuleController.createVendorRule);
app.put('/api/vendor-rules/:id', vendorRuleController.updateVendorRule);
app.delete('/api/vendor-rules/:id', vendorRuleController.deleteVendorRule);
app.post('/api/vendor-rules/apply-existing', vendorRuleController.applyVendorRulesToExistingFares);

// Master Data APIs
app.get('/api/masters/airlines', masterController.getAllAirlines);
app.post('/api/masters/airlines', masterController.createAirline);
app.put('/api/masters/airlines/:code', masterController.updateAirline);

app.get('/api/masters/vendors', masterController.getAllVendors);
app.post('/api/masters/vendors', masterController.createVendor);
app.put('/api/masters/vendors/:id', masterController.updateVendor);
app.delete('/api/masters/vendors/:id', masterController.deleteVendor);

app.get('/api/masters/routes', masterController.getAllRoutes);
app.post('/api/masters/routes', masterController.createRoute);
app.put('/api/masters/routes/:id', masterController.updateRoute);
app.delete('/api/masters/routes/:id', masterController.deleteRoute);

// Publishing, WhatsApp & Excel APIs
app.post('/api/export/toggle-publish', exportController.togglePublishFares);
app.post('/api/export/whatsapp-message', exportController.generateWhatsAppMessage);
app.get('/api/export/excel', exportController.exportToExcel);

// Serve static frontend in production if built
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const fs = require('fs');
  const indexHtml = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  res.send('Travelx API is running. Frontend dev server is running on port 5173.');
});

app.listen(PORT, () => {
  console.log(`✈️ Travelx Special Fare Manager Backend running on http://localhost:${PORT}`);
});
