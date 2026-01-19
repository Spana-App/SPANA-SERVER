/**
 * Map Routes
 * Google Maps API integration endpoints
 */

const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');
const auth = require('../middleware/auth');

// Geocode address to coordinates
router.get('/geocode', mapController.geocodeAddress);

// Reverse geocode coordinates to address
router.get('/reverse-geocode', mapController.reverseGeocode);

// Calculate route between two points
router.get('/route', mapController.calculateRoute);

// Get map embed URL for booking (authenticated)
router.get('/booking/:bookingId/embed', auth, mapController.getMapEmbedUrl);

// Get directions for booking (authenticated)
router.get('/booking/:bookingId/directions', auth, mapController.getBookingDirections);

module.exports = router;
export {};
