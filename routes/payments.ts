const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

// Create payment intent
router.post('/intent', auth, paymentController.createPaymentIntent);

// Create Stripe Checkout session (redirect flow)
router.post('/checkout', auth, paymentController.createCheckoutSession);

// Confirm payment
router.post('/confirm', auth, paymentController.confirmPayment);

// Get payment history for user
router.get('/history', auth, paymentController.getPaymentHistory);

// Refund payment
router.post('/refund', auth, paymentController.refundPayment);

// PayFast webhook - kept for backwards compatibility; handler returns 200 immediately (Stripe only)
router.post('/payfast-webhook', express.urlencoded({ extended: true }), paymentController.payfastWebhook);
router.get('/payfast-webhook', paymentController.payfastWebhook);

// Release funds (admin only)
router.post('/:bookingId/release', auth, authorize('admin'), paymentController.releaseFunds);

// Stripe webhook is mounted in server.ts (before express.json) so it receives raw body

module.exports = router;
export {};