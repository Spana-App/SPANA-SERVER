"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/passwordResetController');
const { body } = require('express-validator');
// Validation rules
const requestResetValidation = [
    body('email').isEmail().normalizeEmail()
];
const resetPasswordValidation = [
    body('token').not().isEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('newPassword').isLength({ min: 6 })
];
// Routes
router.post('/request', requestResetValidation, passwordResetController.requestPasswordReset);
router.post('/reset', resetPasswordValidation, passwordResetController.resetPassword);
router.get('/verify-token', passwordResetController.verifyResetToken);
module.exports = router;
