const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

// Complete registration page (GET - renders HTML form)
router.get('/complete-registration', registrationController.completeRegistration);

// CSP-friendly external script for complete registration page
router.get('/complete-registration.js', registrationController.completeRegistrationScript);

// Backward compatibility: /verify-provider should redirect to /complete-registration
// This allows old email links (…/verify-provider?token=...&uid=...) to keep working.
router.get('/verify-provider', (req: any, res: any) => {
  const token = req.query.token;
  const uid = req.query.uid;

  if (!token || !uid) {
    return res.status(400).send('Missing token or uid in verification link.');
  }

  const params = new URLSearchParams({
    token: String(token),
    uid: String(uid)
  }).toString();

  return res.redirect(302, `/complete-registration?${params}`);
});

// Submit profile completion (POST - handles form submission)
router.post('/complete-registration', registrationController.submitProfile);

module.exports = router;
export {};
