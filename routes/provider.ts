const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

// Set online/offline status (provider)
router.put('/online-status', auth, providerController.setOnlineStatus);

// Get online status (provider)
router.get('/online-status', auth, providerController.getOnlineStatus);

// Update provider location (for service providers)
// Usage: PUT /provider/location?lng=28.0473&lat=-26.2041&address=Sandton
// Or: PUT /provider/location with body { lng: 28.0473, lat: -26.2041, address: "Sandton" }
router.put('/location', auth, providerController.updateProviderLocation);

// Update customer location (for customers)
// Usage: PUT /provider/customer/location?lng=28.0473&lat=-26.2041&address=Sandton
// Or: PUT /provider/customer/location with body { lng: 28.0473, lat: -26.2041, address: "Sandton" }
router.put('/customer/location', auth, providerController.updateCustomerLocation);

// Get all online providers (admin only)
router.get('/online', auth, authorize('admin'), providerController.getAllOnlineProviders);

module.exports = router;
export {};
