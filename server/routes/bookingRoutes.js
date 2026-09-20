const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Public Agent Endpoints (No auth needed)
router.get('/public/agent/lookup', bookingController.lookupAgent);
router.post('/public/agent/register', bookingController.registerOrUpdateAgent);
router.post('/public/bookings/create', bookingController.createBookingRequest);

// Admin Booking & Agent Management Endpoints
router.get('/bookings', bookingController.getBookingRequests);
router.patch('/bookings/:id/status', bookingController.updateBookingStatus);
router.get('/agents', bookingController.getAgentsDirectory);

module.exports = router;
