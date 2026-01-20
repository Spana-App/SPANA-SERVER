const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

// Complete registration page (GET - renders HTML form)
router.get('/complete-registration', registrationController.completeRegistration);

// Submit profile completion (POST - handles form submission)
router.post('/complete-registration', registrationController.submitProfile);

module.exports = router;
export {};
