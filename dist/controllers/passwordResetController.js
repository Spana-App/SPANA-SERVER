"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../lib/database"));
const { sendPasswordResetEmail } = require('../config/mailer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
// Generate password reset token
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};
// Request password reset
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        const user = await database_1.default.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        // Don't reveal if user exists (security best practice)
        if (!user) {
            return res.json({
                message: 'If an account exists with this email, a password reset link has been sent.'
            });
        }
        // Generate reset token
        const resetToken = generateResetToken();
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        // Update user with reset token
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: resetToken,
                resetPasswordExpires: resetExpires
            }
        });
        // Send reset email
        try {
            const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
            await sendPasswordResetEmail({
                to: user.email,
                name: user.firstName,
                link: resetLink
            });
            res.json({
                message: 'If an account exists with this email, a password reset link has been sent.',
                expiresIn: '1 hour'
            });
        }
        catch (emailError) {
            console.error('Email sending failed (non-critical in test mode):', emailError.message);
            // In test/dev mode, still return success even if email fails
            if (process.env.NODE_ENV === 'test' || !process.env.SMTP_HOST) {
                res.json({
                    message: 'If an account exists with this email, a password reset link has been sent.',
                    expiresIn: '1 hour',
                    testMode: true,
                    token: resetToken // Include token in test mode for testing
                });
            }
            else {
                res.status(500).json({ message: 'Failed to send password reset email' });
            }
        }
    }
    catch (error) {
        console.error('Request password reset error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Reset password with token
exports.resetPassword = async (req, res) => {
    try {
        const { token, email, newPassword } = req.body;
        if (!token || !email || !newPassword) {
            return res.status(400).json({ message: 'Token, email, and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        // Find user with valid reset token
        const user = await database_1.default.user.findFirst({
            where: {
                email: email.toLowerCase(),
                resetPasswordToken: token,
                resetPasswordExpires: {
                    gt: new Date() // Token not expired
                }
            }
        });
        if (!user) {
            return res.status(400).json({
                message: 'Invalid or expired reset token',
                code: 'INVALID_TOKEN'
            });
        }
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        // Update password and clear reset token
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });
        // Log activity
        try {
            await database_1.default.activity.create({
                data: {
                    userId: user.id,
                    actionType: 'password_reset',
                    contentId: user.id,
                    contentModel: 'User'
                }
            });
        }
        catch (_) { }
        res.json({
            message: 'Password reset successfully. You can now login with your new password.'
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Verify reset token (for frontend validation)
exports.verifyResetToken = async (req, res) => {
    try {
        const { token, email } = req.query;
        if (!token || !email) {
            return res.status(400).json({ message: 'Token and email are required' });
        }
        const user = await database_1.default.user.findFirst({
            where: {
                email: email.toLowerCase(),
                resetPasswordToken: token,
                resetPasswordExpires: {
                    gt: new Date()
                }
            }
        });
        if (!user) {
            return res.status(400).json({
                valid: false,
                message: 'Invalid or expired reset token'
            });
        }
        res.json({
            valid: true,
            message: 'Reset token is valid'
        });
    }
    catch (error) {
        console.error('Verify reset token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
