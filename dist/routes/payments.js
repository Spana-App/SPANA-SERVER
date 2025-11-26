"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');
// Create payment intent
router.post('/intent', auth, paymentController.createPaymentIntent);
// Confirm payment
router.post('/confirm', auth, paymentController.confirmPayment);
// Get payment history for user
router.get('/history', auth, paymentController.getPaymentHistory);
// Refund payment
router.post('/refund', auth, paymentController.refundPayment);
// PayFast webhook (no auth required - PayFast signs the request)
router.post('/payfast-webhook', express.urlencoded({ extended: true }), paymentController.payfastWebhook);
router.get('/payfast-webhook', paymentController.payfastWebhook);
// Release funds (admin only)
router.post('/:bookingId/release', auth, authorize('admin'), paymentController.releaseFunds);
// Optional webhook endpoint (no auth) — only attach if handler exists
if (paymentController && typeof paymentController.webhookHandler === 'function') {
    router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.webhookHandler);
}
module.exports = router;
