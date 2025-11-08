import prisma from '../lib/database';
const nodeCrypto = require('crypto');
const { sendVerificationEmail } = require('../config/mailer');

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

// Verify admin email
exports.verifyAdmin = async (req: any, res: any) => {
  try {
    const { token, email } = req.query;

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        verificationToken: token,
        verificationExpires: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

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

    res.json({ message: 'Admin verified successfully' });
  } catch (error) {
    console.error('Verify admin error', error);
    res.status(500).json({ message: 'Server error' });
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

export {};

