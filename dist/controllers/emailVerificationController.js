"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../lib/database"));
const { sendEmailVerification } = require('../config/mailer');
const crypto = require('crypto');
// Generate email verification token
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};
// Send verification email
exports.sendVerificationEmail = async (req, res) => {
    try {
        // Get email from body or from authenticated user
        const email = req.body.email || req.user?.email;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        // Find user by email
        const user = await database_1.default.user.findUnique({
            where: { email },
            include: {
                customer: true,
                serviceProvider: true
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }
        // Generate verification token
        const verificationToken = generateVerificationToken();
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        // Update user with verification token
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                verificationToken,
                verificationExpires
            }
        });
        // Send verification email - use backend port for verification
        const baseUrl = process.env.EXTERNAL_API_URL || 'https://spana-server-5bhu.onrender.com';
        const verificationLink = `${baseUrl}/email-verification/verify-email?token=${verificationToken}`;
        try {
            await sendEmailVerification({
                to: user.email,
                name: user.firstName,
                link: verificationLink
            });
            res.json({
                message: 'Verification email sent successfully',
                expiresIn: '24 hours'
            });
        }
        catch (emailError) {
            console.error('Email sending failed:', emailError);
            res.status(500).json({ message: 'Failed to send verification email' });
        }
    }
    catch (error) {
        console.error('Send verification email error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Verify email with token
exports.verifyEmail = async (req, res) => {
    try {
        // Handle both GET (query param) and POST (body) requests
        const token = req.query.token || req.body.token;
        if (!token) {
            return res.status(400).json({
                message: 'Verification token is required',
                code: 'MISSING_TOKEN'
            });
        }
        // Find user by verification token
        const user = await database_1.default.user.findFirst({
            where: {
                verificationToken: token,
                verificationExpires: {
                    gt: new Date() // Token not expired
                }
            },
            include: {
                customer: true,
                serviceProvider: true
            }
        });
        if (!user) {
            // Return HTML page for invalid token
            return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verification Failed - Spana</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f9f9f9; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; font-size: 24px; margin-bottom: 20px; }
            .message { color: #666; font-size: 16px; margin-bottom: 30px; }
            .button { background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">❌ Verification Failed</div>
            <div class="message">Invalid or expired verification token. Please request a new verification email.</div>
            <a href="${process.env.EXTERNAL_API_URL || 'https://spana-server-5bhu.onrender.com'}" class="button">Go to Spana</a>
          </div>
        </body>
        </html>
      `);
        }
        // Update user as verified
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                verificationToken: null,
                verificationExpires: null
            }
        });
        // Create activity log
        try {
            await database_1.default.activity.create({
                data: {
                    userId: user.id,
                    actionType: 'email_verified',
                    contentId: user.id,
                    contentModel: 'User',
                    details: { email: user.email }
                }
            });
        }
        catch (_) { }
        // Shape response by role
        let userResponse;
        if (user.role === 'customer' && user.customer) {
            const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
            const { favouriteProviders, totalBookings, ratingGivenAvg } = user.customer;
            userResponse = {
                _id: id, email, firstName, lastName, phone, role, isVerified: false, isEmailVerified, isPhoneVerified,
                profileImage, location, walletBalance, status,
                customerDetails: { favouriteProviders, totalBookings, ratingGivenAvg },
                createdAt, updatedAt, __v: 0
            };
        }
        else if (user.role === 'service_provider' && user.serviceProvider) {
            const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
            const { skills, experienceYears, isOnline, rating, totalReviews, isVerified, isIdentityVerified, availability, serviceAreaRadius, serviceAreaCenter, isProfileComplete } = user.serviceProvider;
            userResponse = {
                _id: id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified,
                profileImage, skills, experienceYears, isOnline, rating, totalReviews, isProfileComplete,
                availability, serviceArea: { radiusInKm: serviceAreaRadius, baseLocation: serviceAreaCenter },
                location, walletBalance, status, createdAt, updatedAt, __v: 0
            };
        }
        else {
            userResponse = {
                _id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
                phone: user.phone, role: user.role, isVerified: false, isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified, profileImage: user.profileImage, location: user.location,
                walletBalance: user.walletBalance, status: user.status, createdAt: user.createdAt,
                updatedAt: user.updatedAt, __v: 0
            };
        }
        // Return HTML success page for GET requests, JSON for POST
        if (req.method === 'GET') {
            return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verified - Spana</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f9f9f9; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .success { color: #27ae60; font-size: 24px; margin-bottom: 20px; }
            .message { color: #666; font-size: 16px; margin-bottom: 30px; }
            .button { background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅ Email Verified Successfully!</div>
            <div class="message">Welcome to the Spana family, ${user.firstName}! 🎉<br>Your email has been verified and you can now access all features.</div>
            <a href="${process.env.EXTERNAL_API_URL || 'https://spana-server-5bhu.onrender.com'}" class="button">Continue to Spana</a>
          </div>
        </body>
        </html>
      `);
        }
        else {
            // JSON response for POST requests
            res.json({
                message: 'Email verified successfully! Welcome to the Spana family! 🎉',
                user: userResponse,
                verified: true
            });
        }
    }
    catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Check verification status
exports.checkVerificationStatus = async (req, res) => {
    try {
        const user = await database_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                isEmailVerified: true,
                verificationToken: true,
                verificationExpires: true
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            isEmailVerified: user.isEmailVerified,
            hasPendingVerification: !!user.verificationToken,
            tokenExpires: user.verificationExpires
        });
    }
    catch (error) {
        console.error('Check verification status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
