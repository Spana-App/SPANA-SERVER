const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const auth = require('../middleware/auth');
const providerReady = require('../middleware/providerReady');
const optionalAuth = require('../middleware/optionalAuth');

// IMPORTANT: Route order matters! Specific routes must come before parameterized routes
// Get all services
router.get('/', serviceController.getAllServices);

// Discover services: Recently booked + Location-based suggestions (optional auth)
// MUST come before /:id to avoid matching "discover" as an ID
router.get('/discover', optionalAuth, serviceController.discoverServices);

// Get service by ID (must come LAST - after all specific routes)
router.get('/:id', serviceController.getServiceById);

// Create a new service (provider only, profile must be complete)
router.post('/', auth, providerReady, serviceController.createService);

// Update a service (provider only, profile must be complete)
router.put('/:id', auth, providerReady, serviceController.updateService);

// Delete a service (provider only, profile must be complete)
router.delete('/:id', auth, providerReady, serviceController.deleteService);

module.exports = router;
export {};