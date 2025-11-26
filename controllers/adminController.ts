import prisma from '../lib/database';
const nodeCrypto = require('crypto');
const { sendVerificationEmail, sendAdminOTPEmail } = require('../config/mailer');

// Helper function to get proper base URL for verification links
function getBaseUrl(req?: any): string {
  // Try to get from request headers first (most reliable)
  if (req && req.headers && req.headers.host) {
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    return `${protocol}://${req.headers.host}`;
  }
  
  // Check environment variables
  let baseUrl = process.env.CLIENT_URL || process.env.EXTERNAL_API_URL;
  
  // Handle '*' (CORS wildcard) or invalid URLs
  if (!baseUrl || baseUrl === '*' || !baseUrl.startsWith('http')) {
    // Try EXTERNAL_API_URL
    if (process.env.EXTERNAL_API_URL && process.env.EXTERNAL_API_URL.startsWith('http')) {
      try {
        return new URL(process.env.EXTERNAL_API_URL).origin;
      } catch (e) {
        // Invalid URL, continue to fallback
      }
    }
    
    // Fallback to localhost with PORT
    const port = process.env.PORT || '5003';
    return `http://localhost:${port}`;
  }
  
  return baseUrl.replace(/\/$/, ''); // Remove trailing slash
}

// Resend admin verification email
exports.resendVerificationEmail = async (req: any, res: any) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
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
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

    // Ensure admin verification record exists
    try {
      await prisma.adminVerification.upsert({
        where: { adminEmail: email.toLowerCase() },
        update: {},
        create: {
          adminEmail: email.toLowerCase(),
          verified: false
        }
      });
    } catch (err) {
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
    } catch (emailError) {
      console.error('Error sending admin verification email:', emailError);
      res.status(500).json({ 
        message: 'Failed to send verification email. Please check SMTP configuration.',
        error: emailError.message
      });
    }
  } catch (error) {
    console.error('Resend verification email error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify admin email - Shows confetti page with OTP
exports.verifyAdmin = async (req: any, res: any) => {
  try {
    const { token, email, otp } = req.query;

    const user = await prisma.user.findFirst({
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
      const otpRecord = await prisma.adminOTP.findFirst({
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
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationExpires: null
      }
    });

    await prisma.adminVerification.update({
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
  } catch (error) {
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
exports.getPendingDocuments = async (req: any, res: any) => {
  try {
    const documents = await prisma.document.findMany({
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
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify document
exports.verifyDocument = async (req: any, res: any) => {
  try {
    const { docId } = req.params;
    const { verified, notes } = req.body;

    const document = await prisma.document.update({
      where: { id: docId },
      data: { verified: verified === true }
    });

    // If verified, check if provider should be marked as identity verified
    if (verified) {
      const provider = await prisma.serviceProvider.findUnique({
        where: { id: document.providerId },
        include: { documents: true }
      });

      if (provider && provider.documents.some(doc => doc.verified)) {
        await prisma.serviceProvider.update({
          where: { id: document.providerId },
          data: { isIdentityVerified: true }
        });
      }
    }

    res.json({ message: 'Document verification updated', document });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get wallet transactions
exports.getWalletTransactions = async (req: any, res: any) => {
  try {
    const transactions = await prisma.walletTransaction.findMany({
      include: {
        wallet: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get wallet summary
exports.getWalletSummary = async (req: any, res: any) => {
  try {
    const wallet = await prisma.spanaWallet.findFirst({
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
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all bookings (admin view)
exports.getAllBookings = async (req: any, res: any) => {
  try {
    const bookings = await prisma.booking.findMany({
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
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users (admin view)
exports.getAllUsers = async (req: any, res: any) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        customer: true,
        serviceProvider: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all services (admin view)
exports.getAllServices = async (req: any, res: any) => {
  try {
    const services = await prisma.service.findMany({
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
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin CRUD Operations for Services

// Create service (admin creates service and links to provider)
exports.createService = async (req: any, res: any) => {
  try {
    const { title, description, category, price, duration, providerId, mediaUrl } = req.body;

    if (!title || !description || !category || !price || !duration || !providerId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const service = await prisma.service.create({
      data: {
        title,
        description,
        category,
        price: parseFloat(price),
        duration: parseInt(duration),
        providerId,
        mediaUrl: mediaUrl || null,
        status: 'pending_approval',
        adminApproved: false
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

    res.status(201).json({ message: 'Service created successfully', service });
  } catch (error) {
    console.error('Create service error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update service
exports.updateService = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { title, description, category, price, duration, mediaUrl, status } = req.body;

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(category && { category }),
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
  } catch (error) {
    console.error('Update service error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve/Reject service (makes it available to clients)
exports.approveService = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { approved, rejectionReason } = req.body;

    const service = await prisma.service.update({
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
  } catch (error) {
    console.error('Approve service error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete service
exports.deleteService = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    await prisma.service.delete({
      where: { id }
    });

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get service provider performance metrics
exports.getProviderPerformance = async (req: any, res: any) => {
  try {
    const { providerId } = req.params;

    const provider = await prisma.serviceProvider.findUnique({
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
  } catch (error) {
    console.error('Get provider performance error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all complaints
exports.getAllComplaints = async (req: any, res: any) => {
  try {
    const { status, severity } = req.query;

    const complaints = await prisma.complaint.findMany({
      where: {
        ...(status && { status }),
        ...(severity && { severity })
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
  } catch (error) {
    console.error('Get complaints error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Resolve complaint
exports.resolveComplaint = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    const complaint = await prisma.complaint.update({
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
  } catch (error) {
    console.error('Resolve complaint error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate and send OTP for admin login
exports.requestOTP = async (req: any, res: any) => {
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
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || user.role !== 'admin') {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours

    // Store OTP in database
    await prisma.adminOTP.create({
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
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      res.status(500).json({
        message: 'Failed to send OTP email. Please check SMTP configuration.',
        error: emailError.message
      });
    }
  } catch (error) {
    console.error('Request OTP error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify OTP and return token
exports.verifyOTP = async (req: any, res: any) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Find valid OTP
    const otpRecord = await prisma.adminOTP.findFirst({
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
    await prisma.adminOTP.update({
      where: { id: otpRecord.id },
      data: {
        used: true,
        usedAt: new Date()
      }
    });

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { customer: true, serviceProvider: true }
    });

    if (!user || user.role !== 'admin') {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    // Generate token with 5-hour expiry for admins
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '5h' } // 5 hours for admin
    );

    // Log activity
    try {
      await prisma.activity.create({
        data: {
          userId: user.id,
          actionType: 'admin_login_otp',
          details: { method: 'otp' }
        }
      });
    } catch (_) {}

    // Update last login
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
    } catch (_) {}

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
  } catch (error) {
    console.error('Verify OTP error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {};

