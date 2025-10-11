const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const auth = require('../middleware/auth');
const providerReady = require('../middleware/providerReady');

// Get all services
router.get('/', serviceController.getAllServices);

// Get service by ID
router.get('/:id', serviceController.getServiceById);

// Create a new service (provider only, profile must be complete)
router.post('/', auth, providerReady, serviceController.createService);

// Update a service (provider only, profile must be complete)
router.put('/:id', auth, providerReady, serviceController.updateService);

// Delete a service (provider only, profile must be complete)
router.delete('/:id', auth, providerReady, serviceController.deleteService);

// Get services by category
router.get('/category/:category', serviceController.getServicesByCategory);

module.exports = router;
export {};