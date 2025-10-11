const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// Create payment intent
router.post('/intent', auth, paymentController.createPaymentIntent);

// Confirm payment
router.post('/confirm', auth, paymentController.confirmPayment);

// Get payment history for user
router.get('/history', auth, paymentController.getPaymentHistory);

// Refund payment
router.post('/refund', auth, paymentController.refundPayment);

// Optional webhook endpoint (no auth) — only attach if handler exists
if (paymentController && typeof paymentController.webhookHandler === 'function') {
	router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.webhookHandler);
}

module.exports = router;
export {};