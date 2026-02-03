"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../lib/database"));
const nodeCrypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendVerificationEmail, sendAdminOTPEmail, sendWelcomeEmail } = require('../config/mailer');
const { generateUserReferenceAsync } = require('../lib/idGenerator');
const { generateUserId, generateProviderId, generateApplicationId } = require('../lib/spanaIdGenerator');
const { transformUserResponse } = require('../lib/spanaIdHelper');
// Helper function to get proper base URL for verification links
function getBaseUrl(req) {
    // Priority 1: Use EXTERNAL_API_URL in production (never use localhost for verification links)
    if (process.env.NODE_ENV === 'production' || process.env.EXTERNAL_API_URL) {
        const externalUrl = process.env.EXTERNAL_API_URL;
        if (externalUrl && externalUrl.startsWith('http')) {
            try {
                return new URL(externalUrl).origin;
            }
            catch (e) {
                // Invalid URL, continue to next option
            }
        }
    }
    // Priority 2: Use CLIENT_URL if set
    if (process.env.CLIENT_URL && process.env.CLIENT_URL.startsWith('http') && process.env.CLIENT_URL !== '*') {
        return process.env.CLIENT_URL.replace(/\/$/, '');
    }
    // Priority 3: Try to get from request headers (only if not in production)
    if (req && req.headers && req.headers.host && process.env.NODE_ENV !== 'production') {
        const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
        const host = req.headers.host;
        // Don't use localhost in production
        if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
            return `${protocol}://${host}`;
        }
    }
    // Priority 4: Fallback to EXTERNAL_API_URL even if NODE_ENV is not production
    if (process.env.EXTERNAL_API_URL && process.env.EXTERNAL_API_URL.startsWith('http')) {
        try {
            return new URL(process.env.EXTERNAL_API_URL).origin;
        }
        catch (e) {
            // Invalid URL, continue to fallback
        }
    }
    // Last resort: localhost (only for local development)
    const port = process.env.PORT || '5003';
    return `http://localhost:${port}`;
}
// Resend admin verification email
exports.resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        // Find user by email
        const user = await database_1.default.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Check if it's an admin email
        if (!email.toLowerCase().endsWith('@spana.co.za')) {
            return res.status(400).json({ message: 'This endpoint is only for admin emails (@spana.co.za)' });
        }
        // Generate new verification token
        const verificationToken = nodeCrypto.randomBytes(32).toString('hex');
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                verificationToken,
                verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            }
        });
        // Ensure admin verification record exists
        try {
            await database_1.default.adminVerification.upsert({
                where: { adminEmail: email.toLowerCase() },
                update: {},
                create: {
                    adminEmail: email.toLowerCase(),
                    verified: false
                }
            });
        }
        catch (err) {
            console.error('Error creating admin verification record:', err);
        }
        // Send verification email - use backend URL for admin verification
        const baseUrl = getBaseUrl(req);
        const verificationLink = `${baseUrl}/admin/verify?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;
        try {
            console.log(`Sending admin verification email to ${user.email}`);
            console.log(`Verification link: ${verificationLink}`);
            await sendVerificationEmail(user, verificationLink);
            console.log(`Admin verification email sent successfully to ${user.email}`);
            res.json({
                message: 'Verification email sent successfully. Please check your inbox (and spam folder).',
                email: user.email,
                expiresIn: '24 hours'
            });
        }
        catch (emailError) {
            console.error('Error sending admin verification email:', emailError);
            res.status(500).json({
                message: 'Failed to send verification email. Please check SMTP configuration.',
                error: emailError.message
            });
        }
    }
    catch (error) {
        console.error('Resend verification email error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Verify admin email - Shows confetti page with OTP
exports.verifyAdmin = async (req, res) => {
    try {
        const { token, email, otp } = req.query;
        // Handle missing email parameter
        if (!email) {
            return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Missing Email</title>
          <style>body { font-family: Arial; text-align: center; padding: 50px; }</style>
        </head>
        <body>
          <h1>❌ Missing Email Parameter</h1>
          <p>Please provide an email address in the verification link.</p>
        </body>
        </html>
      `);
        }
        const user = await database_1.default.user.findFirst({
            where: {
                email: email.toLowerCase(),
                verificationToken: token,
                verificationExpires: { gt: new Date() }
            }
        });
        if (!user) {
            return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Token</title>
          <style>body { font-family: Arial; text-align: center; padding: 50px; }</style>
        </head>
        <body>
          <h1>❌ Invalid or Expired Token</h1>
          <p>The verification link is invalid or has expired.</p>
        </body>
        </html>
      `);
        }
        // Get the OTP from query or find the latest valid OTP
        let otpCode = otp;
        if (!otpCode) {
            const otpRecord = await database_1.default.adminOTP.findFirst({
                where: {
                    adminEmail: email.toLowerCase(),
                    used: false,
                    expiresAt: { gt: new Date() }
                },
                orderBy: { createdAt: 'desc' }
            });
            otpCode = otpRecord?.otp;
        }
        // Mark email as verified
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                verificationToken: null,
                verificationExpires: null
            }
        });
        await database_1.default.adminVerification.update({
            where: { adminEmail: user.email.toLowerCase() },
            data: {
                verified: true,
                verifiedAt: new Date(),
                verifiedBy: user.id
            }
        });
        // Show confetti page with OTP
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Welcome to SPANA Admin! 🎉</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
          }
          .container {
            background: white;
            padding: 60px 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
            z-index: 10;
            position: relative;
          }
          h1 {
            font-size: 48px;
            margin-bottom: 20px;
            color: #000000;
          }
          .welcome-text {
            font-size: 24px;
            color: #333;
            margin-bottom: 30px;
          }
          .otp-container {
            background: #f5f5f5;
            border: 2px dashed #000000;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
          }
          .otp-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .otp-code {
            font-size: 48px;
            font-weight: bold;
            color: #000000;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin: 10px 0;
            padding: 10px;
            background: white;
            border-radius: 8px;
          }
          .copy-btn {
            background: #000000;
            color: #ffffff;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.3s;
          }
          .copy-btn:hover {
            background: #333333;
            transform: translateY(-2px);
          }
          .copy-btn:active {
            transform: translateY(0);
          }
          .instructions {
            color: #666;
            font-size: 14px;
            margin-top: 30px;
            line-height: 1.6;
          }
          .confetti {
            position: fixed;
            width: 10px;
            height: 10px;
            background: #000000;
            position: absolute;
            animation: confetti-fall 3s linear infinite;
          }
          @keyframes confetti-fall {
            0% {
              transform: translateY(-100vh) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
          .success-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: bounce 1s ease infinite;
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">🎉</div>
          <h1>Welcome to SPANA!</h1>
          <p class="welcome-text">Your admin account has been verified!</p>
          
          <div class="otp-container">
            <div class="otp-label">Your Login OTP Code</div>
            <div class="otp-code" id="otpCode">${otpCode || 'N/A'}</div>
            <button class="copy-btn" onclick="copyOTP()">Copy OTP</button>
          </div>
          
          <div class="instructions">
            <p><strong>Next Steps:</strong></p>
            <p>1. Copy the OTP code above</p>
            <p>2. Use it to login via the admin login page</p>
            <p>3. OTP expires in 5 hours</p>
            <p style="margin-top: 20px; color: #999; font-size: 12px;">
              This OTP has also been sent to your email: ${user.email}
            </p>
          </div>
        </div>
        
        <script>
          // Confetti animation - black and white only
          const colors = ['#000000', '#333333', '#666666', '#999999', '#ffffff'];
          for (let i = 0; i < 50; i++) {
            setTimeout(() => {
              const confetti = document.createElement('div');
              confetti.className = 'confetti';
              confetti.style.left = Math.random() * 100 + '%';
              confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
              confetti.style.animationDelay = Math.random() * 3 + 's';
              confetti.style.width = (Math.random() * 10 + 5) + 'px';
              confetti.style.height = (Math.random() * 10 + 5) + 'px';
              document.body.appendChild(confetti);
              
              setTimeout(() => confetti.remove(), 3000);
            }, i * 50);
          }
          
          function copyOTP() {
            const otp = document.getElementById('otpCode').textContent;
            navigator.clipboard.writeText(otp).then(() => {
              const btn = event.target;
              btn.textContent = '✅ Copied!';
              setTimeout(() => {
                btn.textContent = 'Copy OTP';
              }, 2000);
            });
          }
        </script>
      </body>
      </html>
    `;
        res.send(html);
    }
    catch (error) {
        console.error('Verify admin error', error);
        res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>body { font-family: Arial; text-align: center; padding: 50px; }</style>
      </head>
      <body>
        <h1>❌ Error</h1>
        <p>An error occurred during verification.</p>
      </body>
      </html>
    `);
    }
};
// Get all documents pending verification
exports.getPendingDocuments = async (req, res) => {
    try {
        const documents = await database_1.default.document.findMany({
            where: { verified: false },
            include: {
                provider: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(documents);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Verify document
exports.verifyDocument = async (req, res) => {
    try {
        const { docId } = req.params;
        const { verified, notes } = req.body;
        const document = await database_1.default.document.update({
            where: { id: docId },
            data: { verified: verified === true }
        });
        // If verified, check if provider should be marked as identity verified
        if (verified) {
            const provider = await database_1.default.serviceProvider.findUnique({
                where: { id: document.providerId },
                include: { documents: true }
            });
            if (provider && provider.documents.some(doc => doc.verified)) {
                await database_1.default.serviceProvider.update({
                    where: { id: document.providerId },
                    data: { isIdentityVerified: true }
                });
            }
        }
        res.json({ message: 'Document verification updated', document });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get wallet transactions
exports.getWalletTransactions = async (req, res) => {
    try {
        const transactions = await database_1.default.walletTransaction.findMany({
            include: {
                wallet: true
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(transactions);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get wallet summary
exports.getWalletSummary = async (req, res) => {
    try {
        const wallet = await database_1.default.spanaWallet.findFirst({
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });
        if (!wallet) {
            return res.json({
                totalHeld: 0,
                totalReleased: 0,
                totalCommission: 0,
                transactions: []
            });
        }
        res.json(wallet);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get all bookings (admin view)
exports.getAllBookings = async (req, res) => {
    try {
        const bookings = await database_1.default.booking.findMany({
            include: {
                service: {
                    include: {
                        provider: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    }
                },
                customer: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                },
                payment: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(bookings);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get all users (admin view)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await database_1.default.user.findMany({
            include: {
                customer: true,
                serviceProvider: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get all services (admin view)
exports.getAllServices = async (req, res) => {
    try {
        const services = await database_1.default.service.findMany({
            include: {
                provider: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(services);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Admin CRUD Operations for Services
// Create service (admin can create without providerId, assign later)
exports.createService = async (req, res) => {
    try {
        const { title, description, price, mediaUrl, status, providerId } = req.body;
        // Required fields: title, description, price (providerId and duration are optional)
        if (!title || !description || !price) {
            return res.status(400).json({ message: 'Missing required fields: title, description, price' });
        }
        // If providerId is provided, verify it exists
        if (providerId) {
            const provider = await database_1.default.serviceProvider.findUnique({
                where: { id: providerId }
            });
            if (!provider) {
                return res.status(404).json({ message: 'Service provider not found' });
            }
        }
        const service = await database_1.default.service.create({
            data: {
                title,
                description,
                price: parseFloat(price),
                duration: null, // Optional - can be set later
                providerId: providerId || null, // Optional: can be null
                mediaUrl: mediaUrl || null,
                status: status || 'draft', // Default to 'draft' if no provider
                adminApproved: providerId ? false : true // Auto-approve if no provider (admin-created service)
            },
            include: {
                provider: providerId ? {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                } : undefined
            }
        });
        res.status(201).json({
            message: providerId
                ? 'Service created successfully and linked to provider'
                : 'Service created successfully (no provider assigned yet)',
            service
        });
    }
    catch (error) {
        console.error('Create service error', error);
        res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
// Assign service to provider (admin only)
exports.assignServiceToProvider = async (req, res) => {
    try {
        const { id } = req.params;
        const { providerId } = req.body;
        if (!providerId) {
            return res.status(400).json({ message: 'providerId is required' });
        }
        // Verify service exists
        const service = await database_1.default.service.findUnique({
            where: { id }
        });
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }
        // Verify provider exists
        const provider = await database_1.default.serviceProvider.findUnique({
            where: { id: providerId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
        if (!provider) {
            return res.status(404).json({ message: 'Service provider not found' });
        }
        // Update service with provider
        const updatedService = await database_1.default.service.update({
            where: { id },
            data: {
                providerId,
                adminApproved: false // Require re-approval after assignment
            },
            include: {
                provider: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
        res.json({
            message: 'Service assigned to provider successfully',
            service: updatedService
        });
    }
    catch (error) {
        console.error('Assign service to provider error', error);
        res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
// Unassign service from provider (admin only)
exports.unassignServiceFromProvider = async (req, res) => {
    try {
        const { id } = req.params;
        // Verify service exists
        const service = await database_1.default.service.findUnique({
            where: { id }
        });
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }
        if (!service.providerId) {
            return res.status(400).json({ message: 'Service is not assigned to any provider' });
        }
        // Remove provider assignment
        const updatedService = await database_1.default.service.update({
            where: { id },
            data: {
                providerId: null
            }
        });
        res.json({
            message: 'Service unassigned from provider successfully',
            service: updatedService
        });
    }
    catch (error) {
        console.error('Unassign service from provider error', error);
        res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
// Update service
exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price, duration, mediaUrl, status, providerId } = req.body;
        // If providerId is being updated, verify it exists
        if (providerId !== undefined) {
            if (providerId !== null) {
                const provider = await database_1.default.serviceProvider.findUnique({
                    where: { id: providerId }
                });
                if (!provider) {
                    return res.status(404).json({ message: 'Service provider not found' });
                }
            }
        }
        const service = await database_1.default.service.update({
            where: { id },
            data: {
                ...(title && { title }),
                ...(description && { description }),
                ...(price && { price: parseFloat(price) }),
                ...(duration && { duration: parseInt(duration) }),
                ...(mediaUrl !== undefined && { mediaUrl }),
                ...(status && { status })
            },
            include: {
                provider: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
        res.json({ message: 'Service updated successfully', service });
    }
    catch (error) {
        console.error('Update service error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Approve/Reject service (makes it available to clients)
exports.approveService = async (req, res) => {
    try {
        const { id } = req.params;
        const { approved, rejectionReason } = req.body;
        const service = await database_1.default.service.update({
            where: { id },
            data: {
                adminApproved: approved === true,
                approvedBy: approved ? req.user.id : null,
                approvedAt: approved ? new Date() : null,
                rejectionReason: !approved ? rejectionReason : null,
                status: approved ? 'active' : 'draft'
            },
            include: {
                provider: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
        res.json({
            message: approved ? 'Service approved and made available to clients' : 'Service rejected',
            service
        });
    }
    catch (error) {
        console.error('Approve service error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Delete service
exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.service.delete({
            where: { id }
        });
        res.json({ message: 'Service deleted successfully' });
    }
    catch (error) {
        console.error('Delete service error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Get service provider performance metrics
exports.getProviderPerformance = async (req, res) => {
    try {
        const { providerId } = req.params;
        const provider = await database_1.default.serviceProvider.findUnique({
            where: { id: providerId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                services: {
                    include: {
                        bookings: {
                            where: {
                                status: 'completed'
                            }
                        }
                    }
                }
            }
        });
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }
        const totalBookings = provider.services.reduce((sum, s) => sum + s.bookings.length, 0);
        const totalRevenue = provider.services.reduce((sum, s) => {
            return sum + s.bookings.reduce((bSum, b) => bSum + (b.providerPayoutAmount || 0), 0);
        }, 0);
        const slaBreaches = provider.services.reduce((sum, s) => {
            return sum + s.bookings.filter(b => b.slaBreached).length;
        }, 0);
        res.json({
            provider: {
                id: provider.id,
                name: `${provider.user.firstName} ${provider.user.lastName}`,
                email: provider.user.email,
                rating: provider.rating,
                totalReviews: provider.totalReviews
            },
            metrics: {
                totalBookings,
                totalRevenue,
                slaBreaches,
                slaComplianceRate: totalBookings > 0 ? ((totalBookings - slaBreaches) / totalBookings * 100).toFixed(2) : 100,
                averageRating: provider.rating
            }
        });
    }
    catch (error) {
        console.error('Get provider performance error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Get all complaints (admin oversees everything)
exports.getAllComplaints = async (req, res) => {
    try {
        const { status, severity, type, reportedByRole } = req.query;
        const complaints = await database_1.default.complaint.findMany({
            where: {
                ...(status && { status }),
                ...(severity && { severity }),
                ...(type && { type }),
                ...(reportedByRole && { reportedByRole })
            },
            include: {
                booking: {
                    include: {
                        service: true,
                        customer: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    }
                },
                service: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(complaints);
    }
    catch (error) {
        console.error('Get complaints error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Resolve complaint
exports.resolveComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution } = req.body;
        const complaint = await database_1.default.complaint.update({
            where: { id },
            data: {
                status: status || 'resolved',
                resolution,
                resolvedBy: req.user.id,
                resolvedAt: new Date()
            },
            include: {
                booking: true,
                service: true
            }
        });
        res.json({ message: 'Complaint resolved', complaint });
    }
    catch (error) {
        console.error('Resolve complaint error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Generate and send OTP for admin login
exports.requestOTP = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        // Check if it's an admin email
        if (!email.toLowerCase().endsWith('@spana.co.za')) {
            return res.status(400).json({ message: 'OTP is only available for admin emails (@spana.co.za)' });
        }
        // Find user
        const user = await database_1.default.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (!user || user.role !== 'admin') {
            return res.status(404).json({ message: 'Admin user not found' });
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours
        // Store OTP in database
        await database_1.default.adminOTP.create({
            data: {
                adminEmail: email.toLowerCase(),
                otp,
                expiresAt,
                ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgent: req.headers['user-agent']
            }
        });
        // Send OTP via email
        try {
            await sendAdminOTPEmail({
                to: email,
                name: user.firstName || user.email.split('@')[0],
                otp
            });
            res.json({
                message: 'OTP sent to your email. Please check your inbox.',
                expiresIn: '5 hours'
            });
        }
        catch (emailError) {
            console.error('Error sending OTP email:', emailError);
            res.status(500).json({
                message: 'Failed to send OTP email. Please check SMTP configuration.',
                error: emailError.message
            });
        }
    }
    catch (error) {
        console.error('Request OTP error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Verify OTP and return token
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }
        // Find valid OTP
        const otpRecord = await database_1.default.adminOTP.findFirst({
            where: {
                adminEmail: email.toLowerCase(),
                otp,
                used: false,
                expiresAt: { gt: new Date() }
            },
            orderBy: { createdAt: 'desc' }
        });
        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        // Mark OTP as used
        await database_1.default.adminOTP.update({
            where: { id: otpRecord.id },
            data: {
                used: true,
                usedAt: new Date()
            }
        });
        // Find user
        const user = await database_1.default.user.findUnique({
            where: { email: email.toLowerCase() },
            include: { customer: true, serviceProvider: true }
        });
        if (!user || user.role !== 'admin') {
            return res.status(404).json({ message: 'Admin user not found' });
        }
        // Generate token with 5-hour expiry for admins
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '5h' } // 5 hours for admin
        );
        // Log activity
        try {
            await database_1.default.activity.create({
                data: {
                    userId: user.id,
                    actionType: 'admin_login_otp',
                    details: { method: 'otp' }
                }
            });
        }
        catch (_) { }
        // Update last login
        try {
            await database_1.default.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() }
            });
        }
        catch (_) { }
        // Shape admin response (no walletBalance for admins)
        const userResponse = {
            _id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            role: user.role,
            isVerified: true,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            profileImage: user.profileImage,
            location: user.location,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            __v: 0
        };
        res.json({
            message: 'OTP verified successfully',
            token,
            user: userResponse,
            expiresIn: '5 hours'
        });
    }
    catch (error) {
        console.error('Verify OTP error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Admin creates service provider (CMS only) - Provider sets password on profile completion
exports.registerServiceProvider = async (req, res) => {
    try {
        const { firstName, lastName, email, phone } = req.body;
        // Validate required fields
        if (!firstName || !lastName || !email || !phone) {
            return res.status(400).json({
                message: 'Missing required fields: firstName, lastName, email, phone'
            });
        }
        // Check if user already exists
        const existingUser = await database_1.default.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }
        // Generate readable password for provider (12 characters: letters, numbers, special chars)
        // This password will be sent via email after profile completion
        // Password stays active until user chooses to change it
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let generatedPassword = '';
        for (let i = 0; i < 12; i++) {
            generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        console.log(`[Admin] Generated password for ${email}: ${generatedPassword.substring(0, 4)}...`);
        const hashedPassword = await bcrypt.hash(generatedPassword, 12);
        // Generate SPANA ID (format: SPN-abc123) - use as actual ID
        const spanaUserId = await generateUserId();
        const user = await database_1.default.user.create({
            data: {
                id: spanaUserId, // Use SPANA ID as the actual ID
                email: email.toLowerCase(),
                password: hashedPassword, // Password - will be sent via email after profile completion
                firstName,
                lastName,
                phone: phone || null,
                role: 'service_provider',
                isEmailVerified: false, // Will be true after credentials email sent post-profile completion
                isPhoneVerified: null, // Not a priority
            }
        });
        // Create service provider record with verification token
        // Token never expires if unused - 30-minute countdown starts on first use
        const verificationToken = nodeCrypto.randomBytes(32).toString('hex');
        console.log(`[Admin] Creating ServiceProvider with temporaryPassword: ${generatedPassword.substring(0, 4)}...`);
        const serviceProvider = await database_1.default.serviceProvider.create({
            data: {
                userId: user.id,
                skills: [],
                experienceYears: 0,
                isOnline: false,
                rating: 0,
                totalReviews: 0,
                isVerified: true, // Admin verified documents before creating account
                isIdentityVerified: true, // Admin verified documents before creating account
                availability: { days: [], hours: { start: '', end: '' } },
                serviceAreaRadius: 0,
                serviceAreaCenter: { type: 'Point', coordinates: [0, 0] },
                isProfileComplete: false,
                verificationToken,
                verificationExpires: null, // No expiration until first use
                verificationTokenFirstUsedAt: null, // Will be set when token is first accessed
                temporaryPassword: generatedPassword // Store password - will be sent via email after profile completion
            }
        });
        console.log(`[Admin] ServiceProvider created. temporaryPassword stored: ${serviceProvider.temporaryPassword ? 'YES' : 'NO'}`);
        // Build profile completion link - prioritize EXTERNAL_API_URL
        let baseUrl = process.env.EXTERNAL_API_URL;
        if (!baseUrl || baseUrl === '*' || !baseUrl.startsWith('http')) {
            if (process.env.CLIENT_URL && process.env.CLIENT_URL.startsWith('http') && process.env.CLIENT_URL !== '*') {
                baseUrl = process.env.CLIENT_URL;
            }
            else {
                // Fallback to production URL
                baseUrl = 'https://spana-server-5bhu.onrender.com';
            }
        }
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const profileCompletionLink = `${cleanBaseUrl}/complete-registration?token=${verificationToken}&uid=${user.id}`;
        // Send welcome email with profile completion link
        try {
            console.log(`[Admin] Attempting to send service provider welcome email to ${user.email}...`);
            const { sendWelcomeEmail } = require('../config/mailer');
            await sendWelcomeEmail(user, {
                token: verificationToken,
                uid: user.id
            });
            console.log(`[Admin] ✅ Service provider welcome email sent to ${user.email}`);
        }
        catch (emailError) {
            console.error('[Admin] ❌ Failed to send service provider welcome email:', emailError.message);
            // Don't fail provider creation if email fails
        }
        res.status(201).json({
            message: 'Service provider created successfully. Welcome email sent with profile completion link.',
            user: {
                id: user.id, // SPANA ID
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                isEmailVerified: false
            },
            profileCompletionLink,
            note: 'Provider must complete profile and set password via the link sent in email.'
        });
    }
    catch (error) {
        console.error('Register service provider error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
// Admin creates another admin (CMS only) - Auto-generates password
exports.registerAdmin = async (req, res) => {
    try {
        const { firstName, lastName, email, phone } = req.body;
        // Validate required fields
        if (!firstName || !lastName || !email || !phone) {
            return res.status(400).json({
                message: 'Missing required fields: firstName, lastName, email, phone'
            });
        }
        // Check if user already exists
        const existingUser = await database_1.default.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }
        // Validate email domain for admin
        const getAdminDomains = () => {
            const envDomains = process.env.ADMIN_EMAIL_DOMAINS;
            if (envDomains) {
                return envDomains.split(',').map(d => d.trim().toLowerCase());
            }
            return ['@spana.co.za', '@gmail.com'];
        };
        const emailLower = email.toLowerCase();
        const isAdminEmail = getAdminDomains().some(domain => emailLower.endsWith(domain));
        if (!isAdminEmail) {
            const allowedDomains = getAdminDomains().join(', ');
            return res.status(400).json({
                message: `Admin email must be from an admin domain (${allowedDomains})`
            });
        }
        // Generate secure random password (12 characters: letters, numbers, special chars)
        // ONLY admins get auto-generated passwords
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let autoGeneratedPassword = '';
        for (let i = 0; i < 12; i++) {
            autoGeneratedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const hashedPassword = await bcrypt.hash(autoGeneratedPassword, 12);
        // Generate SPANA ID (format: SPN-abc123) - use as actual ID
        const spanaAdminId = await generateUserId();
        // Create user with admin role
        const user = await database_1.default.user.create({
            data: {
                id: spanaAdminId, // Use SPANA ID as the actual ID
                email: email.toLowerCase(),
                password: hashedPassword,
                firstName,
                lastName,
                phone,
                role: 'admin',
                isEmailVerified: false
            }
        });
        // Create admin verification record
        try {
            await database_1.default.adminVerification.create({
                data: {
                    adminEmail: email.toLowerCase(),
                    verified: false
                }
            });
        }
        catch (err) {
            console.error('Error creating admin verification record:', err);
        }
        // Send admin credentials email with auto-generated password
        try {
            console.log(`[Admin] Attempting to send admin credentials email to ${user.email}...`);
            const { sendAdminCredentialsEmail } = require('../config/mailer');
            await sendAdminCredentialsEmail({
                to: user.email,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                password: autoGeneratedPassword
            });
            console.log(`[Admin] ✅ Admin credentials email sent to ${user.email}`);
        }
        catch (emailError) {
            console.error('[Admin] ❌ Failed to send admin credentials email:', emailError.message);
            // Don't fail admin creation if email fails
        }
        res.status(201).json({
            message: 'Admin created successfully. Credentials email sent with auto-generated password.',
            user: {
                id: user.id, // SPANA ID
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                isEmailVerified: false
            },
            password: autoGeneratedPassword, // Return for admin reference (also sent via email)
            note: 'Password sent via email. Admin should change password after first login.'
        });
    }
    catch (error) {
        console.error('Register admin error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
// Admin updates their own profile (password, etc.)
exports.updateAdminProfile = async (req, res) => {
    try {
        const adminId = req.user.id; // From auth middleware
        const { password, firstName, lastName, phone } = req.body;
        const updateData = {};
        if (firstName)
            updateData.firstName = firstName;
        if (lastName)
            updateData.lastName = lastName;
        if (phone)
            updateData.phone = phone;
        // Update password if provided
        if (password) {
            if (password.length < 8) {
                return res.status(400).json({
                    message: 'Password must be at least 8 characters long'
                });
            }
            updateData.password = await bcrypt.hash(password, 12);
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                message: 'No fields to update'
            });
        }
        const updatedUser = await database_1.default.user.update({
            where: { id: adminId },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isEmailVerified: true,
                profileImage: true,
                createdAt: true,
                updatedAt: true
            }
        });
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    }
    catch (error) {
        console.error('Update admin profile error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
// Verify application and create provider account
// POST /admin/applications/:applicationId/verify
exports.verifyApplicationAndCreateProvider = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const adminId = req.user.id; // Admin user ID from auth middleware
        // Find the application
        const application = await database_1.default.serviceProviderApplication.findUnique({
            where: { id: applicationId },
            include: {
                provider: true // Check if provider already exists
            }
        });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        // Check if already processed
        if (application.status === 'approved' && application.provider) {
            return res.status(400).json({
                message: 'Application already approved and provider account created'
            });
        }
        if (application.status === 'rejected') {
            return res.status(400).json({
                message: 'Application was rejected and cannot be verified'
            });
        }
        // Check if user already exists with this email
        const existingUser = await database_1.default.user.findUnique({
            where: { email: application.email.toLowerCase() }
        });
        if (existingUser) {
            return res.status(400).json({
                message: 'User already exists with this email. Cannot create duplicate account.'
            });
        }
        // Generate password for provider (12 characters: letters, numbers, special chars)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let generatedPassword = '';
        for (let i = 0; i < 12; i++) {
            generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        console.log(`[Admin] Generated password for ${application.email}: ${generatedPassword.substring(0, 4)}...`);
        const hashedPassword = await bcrypt.hash(generatedPassword, 12);
        // Generate SPANA ID (format: SPN-abc123)
        const spanaUserId = await generateUserId();
        // Create user account with SPANA ID
        const user = await database_1.default.user.create({
            data: {
                id: spanaUserId, // Use SPANA ID as the actual ID
                email: application.email.toLowerCase(),
                password: hashedPassword,
                firstName: application.firstName,
                lastName: application.lastName,
                phone: application.phone || null,
                role: 'service_provider',
                isEmailVerified: false, // Will be true after credentials email sent post-profile completion
                isPhoneVerified: null, // Not a priority
                profileImage: '',
                walletBalance: 0,
                status: 'active'
            }
        });
        // Create service provider record with verification token
        // Token never expires if unused - 30-minute countdown starts on first use
        const verificationToken = nodeCrypto.randomBytes(32).toString('hex');
        const serviceProvider = await database_1.default.serviceProvider.create({
            data: {
                userId: user.id,
                skills: application.skills || [],
                experienceYears: application.experienceYears || 0,
                isOnline: false,
                rating: 0,
                totalReviews: 0,
                isVerified: true, // Admin verified documents before creating account
                isIdentityVerified: true, // Admin verified documents before creating account
                availability: { days: [], hours: { start: '', end: '' } },
                serviceAreaRadius: 0,
                serviceAreaCenter: application.location || { type: 'Point', coordinates: [0, 0] },
                isProfileComplete: false,
                verificationToken,
                verificationExpires: null, // No expiration until first use
                verificationTokenFirstUsedAt: null, // Will be set when token is first accessed
                temporaryPassword: generatedPassword, // Store password - will be sent via email after profile completion
                applicationId: application.id // Link to application
            }
        });
        // Create Document records from application documents
        if (application.documents && Array.isArray(application.documents)) {
            for (const docItem of application.documents) {
                // Type assertion for JSON document object
                const doc = docItem;
                if (doc && doc.url) {
                    await database_1.default.document.create({
                        data: {
                            type: doc.type || 'document',
                            url: doc.url,
                            verified: false, // Will be verified by admin later
                            providerId: serviceProvider.id,
                            metadata: {
                                name: doc.name || 'Unknown',
                                size: doc.size || 0,
                                mimetype: doc.mimetype || 'application/octet-stream',
                                uploadedDuringApplication: true
                            }
                        }
                    });
                }
            }
        }
        // Update application status
        await database_1.default.serviceProviderApplication.update({
            where: { id: applicationId },
            data: {
                status: 'approved',
                reviewedBy: adminId,
                reviewedAt: new Date()
            }
        });
        // Build profile completion link
        let baseUrl = process.env.EXTERNAL_API_URL;
        if (!baseUrl || baseUrl === '*' || !baseUrl.startsWith('http')) {
            if (process.env.CLIENT_URL && process.env.CLIENT_URL.startsWith('http') && process.env.CLIENT_URL !== '*') {
                baseUrl = process.env.CLIENT_URL;
            }
            else {
                baseUrl = 'https://spana-server-5bhu.onrender.com';
            }
        }
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const profileCompletionLink = `${cleanBaseUrl}/complete-registration?token=${verificationToken}&uid=${user.id}`;
        // Send welcome email with profile completion link
        try {
            console.log(`[Admin] Sending service provider welcome email to ${user.email}...`);
            await sendWelcomeEmail(user, {
                token: verificationToken,
                uid: user.id
            });
            console.log(`[Admin] ✅ Service provider welcome email sent to ${user.email}`);
        }
        catch (emailError) {
            console.error('[Admin] ❌ Failed to send service provider welcome email:', emailError.message);
            // Don't fail provider creation if email fails
        }
        res.json({
            message: 'Application verified and provider account created successfully',
            user: {
                id: user.id, // SPANA ID
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                isEmailVerified: user.isEmailVerified
            },
            provider: {
                id: serviceProvider.id,
                isVerified: serviceProvider.isVerified,
                isIdentityVerified: serviceProvider.isIdentityVerified
            },
            application: {
                id: application.id,
                status: 'approved'
            }
        });
    }
    catch (error) {
        console.error('Verify application and create provider error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
// Get all service provider applications (for CMS)
exports.getAllApplications = async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (status) {
            where.status = status;
        }
        // Get applications with pagination
        const [applications, total] = await Promise.all([
            database_1.default.serviceProviderApplication.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    provider: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    }
                }
            }),
            database_1.default.serviceProviderApplication.count({ where })
        ]);
        res.json({
            applications,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Get all applications error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
// Get single application by ID (for CMS)
exports.getApplicationById = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const application = await database_1.default.serviceProviderApplication.findUnique({
            where: { id: applicationId },
            include: {
                provider: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                phone: true
                            }
                        }
                    }
                }
            }
        });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        res.json(application);
    }
    catch (error) {
        console.error('Get application by ID error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
// Reject application (for CMS)
exports.rejectApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { rejectionReason } = req.body;
        const adminId = req.user.id;
        if (!rejectionReason || rejectionReason.trim().length === 0) {
            return res.status(400).json({
                message: 'Rejection reason is required'
            });
        }
        const application = await database_1.default.serviceProviderApplication.findUnique({
            where: { id: applicationId }
        });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        if (application.status !== 'pending') {
            return res.status(400).json({
                message: `Application is already ${application.status}. Cannot reject.`
            });
        }
        // Update application status
        const updatedApplication = await database_1.default.serviceProviderApplication.update({
            where: { id: applicationId },
            data: {
                status: 'rejected',
                reviewedBy: adminId,
                reviewedAt: new Date(),
                rejectionReason: rejectionReason.trim()
            }
        });
        res.json({
            message: 'Application rejected successfully',
            application: updatedApplication
        });
    }
    catch (error) {
        console.error('Reject application error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
