"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const providerReady = require('../middleware/providerReady');
// Create a new booking (request)
router.post('/', auth, bookingController.createBooking);
// Accept booking request (provider)
router.post('/:id/accept', auth, providerReady, bookingController.acceptBookingRequest);
// Decline booking request (provider)
router.post('/:id/decline', auth, providerReady, bookingController.declineBookingRequest);
// Get all bookings for a user
router.get('/', auth, bookingController.getUserBookings);
// Get booking by ID
router.get('/:id', auth, bookingController.getBookingById);
// Update booking status
router.put('/:id/status', auth, bookingController.updateBookingStatus);
// Cancel booking
router.put('/:id/cancel', auth, bookingController.cancelBooking);
// Rate a booking (customer rates provider)
router.post('/:id/rate', auth, bookingController.rateBooking);
// Rate customer (provider rates customer)
router.post('/:id/rate-customer', auth, providerReady, bookingController.rateCustomer);
// Start booking (provider; profile must be complete)
router.post('/:id/start', auth, providerReady, bookingController.startBooking);
// Complete booking (provider; profile must be complete)
router.post('/:id/complete', auth, providerReady, bookingController.completeBooking);
// Update live location (customer or provider)
router.post('/:id/location', auth, bookingController.updateLocation);
module.exports = router;
