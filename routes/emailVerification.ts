const express = require('express');
const router = express.Router();
const emailVerificationController = require('../controllers/emailVerificationController');
const auth = require('../middleware/auth');

// Send verification email
router.post('/send-verification', emailVerificationController.sendVerificationEmail);

// Verify email with token (GET for direct link access)
router.get('/verify-email', emailVerificationController.verifyEmail);

// Verify email with token (POST for form submission)
router.post('/verify-email', emailVerificationController.verifyEmail);

// Check verification status (protected)
router.get('/verification-status', auth, emailVerificationController.checkVerificationStatus);

module.exports = router;
