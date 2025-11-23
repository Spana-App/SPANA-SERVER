const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

// Public stats endpoints (for website)
router.get('/platform', statsController.getPlatformStats);
router.get('/providers/location', statsController.getProviderStatsByLocation);
router.get('/services/categories', statsController.getServiceCategoryStats);
router.get('/bookings/trends', statsController.getBookingTrends);
router.get('/providers/top', statsController.getTopProviders);
router.get('/revenue', statsController.getRevenueStats);

module.exports = router;
export {};

