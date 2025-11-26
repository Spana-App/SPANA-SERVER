"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const router = express.Router();
const privacyController = require('../controllers/privacyController');
const auth = require('../middleware/auth');
// POPIA Compliance routes
router.get('/export-data', auth, privacyController.exportUserData);
router.delete('/delete-account', auth, privacyController.deleteUserAccount);
router.put('/consent', auth, privacyController.updateConsent);
router.get('/status', auth, privacyController.getPrivacyStatus);
module.exports = router;
