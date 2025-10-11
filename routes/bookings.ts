const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const providerReady = require('../middleware/providerReady');

// Create a new booking
router.post('/', auth, bookingController.createBooking);

// Get all bookings for a user
router.get('/', auth, bookingController.getUserBookings);

// Get booking by ID
router.get('/:id', auth, bookingController.getBookingById);

// Update booking status
router.put('/:id/status', auth, bookingController.updateBookingStatus);

// Cancel booking
router.put('/:id/cancel', auth, bookingController.cancelBooking);

// Rate a booking
router.post('/:id/rate', auth, bookingController.rateBooking);

// Start booking (provider; profile must be complete)
router.post('/:id/start', auth, providerReady, bookingController.startBooking);

// Complete booking (provider; profile must be complete)
router.post('/:id/complete', auth, providerReady, bookingController.completeBooking);

// Update live location (customer or provider)
router.post('/:id/location', auth, bookingController.updateLocation);

module.exports = router;
export {};