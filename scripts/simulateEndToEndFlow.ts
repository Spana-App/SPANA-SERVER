/**
 * Comprehensive End-to-End Flow Simulation
 * 
 * This script simulates:
 * 1. Admin operations (OTP login, approve documents, verify providers, activate workers)
 * 2. Service provider flow (apply, register, upload docs, receive job offers, accept/decline)
 * 3. Customer flow (book, pay, rate, report)
 * 4. Payment tracking and provider payouts
 * 5. Complaint handling
 */

import prisma from '../lib/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BASE_URL = process.env.EXTERNAL_API_URL || 'http://localhost:5003';

// Helper function to generate random data
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(step: string, message: string, color: string = colors.reset) {
  console.log(`${color}${step}${colors.reset} ${message}`);
}

// Simulate third-party document verification (Datanamix)
async function verifyDocumentWithThirdParty(documentId: string, documentType: string) {
  log('🔍', `Verifying document ${documentId} with Datanamix...`, colors.cyan);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate verification result (90% success rate)
  const verified = Math.random() > 0.1;
  
  if (verified) {
    log('✅', `Document ${documentId} verified by Datanamix`, colors.green);
    return {
      status: 'verified',
      verificationData: {
        provider: 'datanamix',
        confidence: randomInt(85, 99),
        verifiedAt: new Date().toISOString()
      }
    };
  } else {
    log('❌', `Document ${documentId} failed Datanamix verification`, colors.red);
    return {
      status: 'failed',
      verificationData: {
        provider: 'datanamix',
        reason: 'Document quality insufficient or mismatch detected',
        verifiedAt: new Date().toISOString()
      }
    };
  }
}

async function main() {
  try {
    log('🚀', 'Starting End-to-End Flow Simulation', colors.bright);
    console.log('');

    // ============================================
    // STEP 1: Create Admin User
    // ============================================
    log('📋', 'STEP 1: Creating Admin User', colors.blue);
    const adminPassword = 'Admin123!';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);
    
    let admin = await prisma.user.findUnique({
      where: { email: 'admin@spana.co.za' }
    });

    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'admin@spana.co.za',
          password: hashedAdminPassword,
          firstName: 'Admin',
          lastName: 'User',
          phone: '+27123456789',
          role: 'admin',
          isEmailVerified: true
        }
      });
      log('✅', `Admin created: ${admin.email}`, colors.green);
    } else {
      log('ℹ️', `Admin already exists: ${admin.email}`, colors.yellow);
    }

    // Create admin verification record
    await prisma.adminVerification.upsert({
      where: { adminEmail: admin.email },
      update: {},
      create: {
        adminEmail: admin.email,
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: admin.id
      }
    });

    // ============================================
    // STEP 2: Admin OTP Login Flow
    // ============================================
    log('📋', 'STEP 2: Admin OTP Login Flow', colors.blue);
    
    // Generate OTP directly (simulating the request)
    const { sendAdminOTPEmail } = require('../config/mailer');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours
    
    // Store OTP in database
    await prisma.adminOTP.create({
      data: {
        adminEmail: admin.email,
        otp,
        expiresAt
      }
    });
    
    log('📧', 'OTP generated and stored', colors.cyan);
    log('🔑', `OTP: ${otp}`, colors.yellow);
    
    // Send OTP email (if SMTP is configured)
    try {
      await sendAdminOTPEmail({
        to: admin.email,
        name: admin.firstName || admin.email.split('@')[0],
        otp
      });
      log('✅', 'OTP sent to admin email', colors.green);
    } catch (err) {
      log('⚠️', 'OTP email not sent (SMTP may not be configured)', colors.yellow);
    }
    
    // Mark OTP as used and generate token
    await prisma.adminOTP.updateMany({
      where: {
        adminEmail: admin.email,
        otp,
        used: false
      },
      data: {
        used: true,
        usedAt: new Date()
      }
    });
    
    // Generate admin token (5 hour expiry)
    const adminToken = jwt.sign(
      { id: admin.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '5h' }
    );
    
    log('✅', 'Admin logged in with OTP', colors.green);
    console.log('');

    // ============================================
    // STEP 3: Service Provider Applications
    // ============================================
    log('📋', 'STEP 3: Service Provider Applications', colors.blue);
    
    const providerApplications = [];
    const providerData = [
      { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phone: '+27111111111', skills: ['Plumbing', 'Electrical'], experience: 5 },
      { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', phone: '+27111111112', skills: ['Cleaning', 'Carpentry'], experience: 3 },
      { firstName: 'Mike', lastName: 'Johnson', email: 'mike.johnson@example.com', phone: '+27111111113', skills: ['Painting', 'Gardening'], experience: 7 },
      { firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@example.com', phone: '+27111111114', skills: ['Cleaning', 'Cooking'], experience: 2 },
      { firstName: 'David', lastName: 'Brown', email: 'david.brown@example.com', phone: '+27111111115', skills: ['Plumbing', 'HVAC'], experience: 10 },
    ];

    for (const data of providerData) {
      const application = await prisma.serviceProviderApplication.create({
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          skills: data.skills,
          experienceYears: data.experience,
          status: 'pending',
          motivation: `I want to join Spana because I have ${data.experience} years of experience in ${data.skills.join(' and ')}.`,
          location: {
            type: 'Point',
            coordinates: [28.0473 + (Math.random() - 0.5) * 0.1, -26.2041 + (Math.random() - 0.5) * 0.1],
            address: `${randomInt(1, 100)} Main Street, Johannesburg`
          }
        }
      });
      providerApplications.push(application);
      log('✅', `Provider application created: ${data.firstName} ${data.lastName}`, colors.green);
    }
    console.log('');

    // ============================================
    // STEP 4: Admin Approves Applications & Sends Invitations
    // ============================================
    log('📋', 'STEP 4: Admin Approves Applications', colors.blue);
    
    const approvedApplications = [];
    for (let i = 0; i < 4; i++) { // Approve 4 out of 5
      const app = providerApplications[i];
      const invitationToken = require('crypto').randomBytes(32).toString('hex');
      
      const updated = await prisma.serviceProviderApplication.update({
        where: { id: app.id },
        data: {
          status: 'approved',
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          invitationToken,
          invitationExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          invitationSentAt: new Date()
        }
      });
      
      approvedApplications.push(updated);
      log('✅', `Application approved: ${app.firstName} ${app.lastName}`, colors.green);
      log('📧', `Invitation token generated: ${invitationToken.substring(0, 16)}...`, colors.cyan);
    }
    
    // Reject one application
    await prisma.serviceProviderApplication.update({
      where: { id: providerApplications[4].id },
      data: {
        status: 'rejected',
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        rejectionReason: 'Insufficient experience for the requested services'
      }
    });
    log('❌', `Application rejected: ${providerApplications[4].firstName} ${providerApplications[4].lastName}`, colors.red);
    console.log('');

    // ============================================
    // STEP 5: Service Providers Register
    // ============================================
    log('📋', 'STEP 5: Service Providers Register', colors.blue);
    
    const registeredProviders = [];
    for (const app of approvedApplications) {
      const password = 'Provider123!';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const user = await prisma.user.create({
        data: {
          email: app.email,
          password: hashedPassword,
          firstName: app.firstName,
          lastName: app.lastName,
          phone: app.phone,
          role: 'service_provider',
          isEmailVerified: true
        }
      });
      
      // Create service provider
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: user.id,
          skills: app.skills,
          experienceYears: app.experienceYears,
          applicationStatus: 'approved',
          applicationId: app.id,
          isProfileComplete: false
        }
      });
      
      registeredProviders.push({ user, provider, app });
      log('✅', `Provider registered: ${app.firstName} ${app.lastName}`, colors.green);
    }
    console.log('');

    // ============================================
    // STEP 6: Providers Upload Documents
    // ============================================
    log('📋', 'STEP 6: Providers Upload Documents', colors.blue);
    
    const documentTypes = ['id_number', 'id_picture', 'license', 'certification', 'profile_picture'];
    
    for (const { provider, user } of registeredProviders) {
      // Upload multiple documents
      for (const docType of documentTypes) {
        const document = await prisma.document.create({
          data: {
            providerId: provider.id,
            type: docType,
            url: `https://example.com/uploads/${provider.id}/${docType}_${Date.now()}.jpg`,
            verified: false,
            metadata: docType === 'id_number' ? { idNumber: `${randomInt(8000000000000, 8999999999999)}` } : null
          }
        });
        
        // Create verification record
        await prisma.documentVerification.create({
          data: {
            documentId: document.id,
            provider: 'datanamix',
            status: 'pending'
          }
        });
        
        log('📄', `Document uploaded: ${docType} for ${user.firstName}`, colors.cyan);
      }
    }
    console.log('');

    // ============================================
    // STEP 7: Admin Verifies Documents (with Third-Party)
    // ============================================
    log('📋', 'STEP 7: Admin Verifies Documents with Third-Party', colors.blue);
    
    const allDocuments = await prisma.document.findMany({
      where: { verified: false },
      include: { provider: { include: { user: true } } }
    });
    
    let verificationCount = 0;
    for (const doc of allDocuments) {
      // Simulate third-party verification
      const verificationResult = await verifyDocumentWithThirdParty(doc.id, doc.type);
      
      // Update verification record
      await prisma.documentVerification.update({
        where: { documentId: doc.id },
        data: {
          status: verificationResult.status === 'verified' ? 'verified' : 'failed',
          verificationData: verificationResult.verificationData
        }
      });
      
      if (verificationResult.status === 'verified') {
        // Admin approves the document
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            verified: true,
            verifiedBy: admin.id,
            verifiedAt: new Date()
          }
        });
        
        await prisma.documentVerification.update({
          where: { documentId: doc.id },
          data: {
            adminVerified: true,
            adminVerifiedBy: admin.id,
            adminVerifiedAt: new Date()
          }
        });
        
        verificationCount++;
        log('✅', `Document verified: ${doc.type} for ${doc.provider.user.firstName}`, colors.green);
      } else {
        log('❌', `Document verification failed: ${doc.type} for ${doc.provider.user.firstName}`, colors.red);
      }
    }
    
    log('📊', `Verified ${verificationCount} out of ${allDocuments.length} documents`, colors.cyan);
    console.log('');

    // ============================================
    // STEP 8: Admin Activates Service Providers
    // ============================================
    log('📋', 'STEP 8: Admin Activates Service Providers', colors.blue);
    
    for (const { provider, user } of registeredProviders) {
      // Check if all documents are verified
      const documents = await prisma.document.findMany({
        where: { providerId: provider.id }
      });
      
      const allVerified = documents.length > 0 && documents.every(doc => doc.verified);
      
      if (allVerified) {
        await prisma.serviceProvider.update({
          where: { id: provider.id },
          data: {
            applicationStatus: 'active',
            isVerified: true,
            isIdentityVerified: true,
            isProfileComplete: true
          }
        });
        
        log('✅', `Provider activated: ${user.firstName} ${user.lastName}`, colors.green);
      }
    }
    console.log('');

    // ============================================
    // STEP 9: Providers Create Services
    // ============================================
    log('📋', 'STEP 9: Providers Create Services', colors.blue);
    
    const services = [];
    const serviceCategories = ['Plumbing', 'Cleaning', 'Electrical', 'Painting', 'Gardening', 'Carpentry'];
    
    for (const { provider, user } of registeredProviders) {
      const serviceType = randomChoice(['Plumbing', 'Cleaning', 'Electrical', 'Painting', 'Carpentry', 'Gardening']);
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          title: `${serviceType} Service`,
          description: `Professional ${serviceType.toLowerCase()} services by ${user.firstName}`,
          price: randomInt(200, 1000),
          duration: randomInt(60, 240),
          status: 'pending_approval',
          adminApproved: false
        }
      });
      
      services.push(service);
      log('✅', `Service created: ${service.title} by ${user.firstName}`, colors.green);
    }
    console.log('');

    // ============================================
    // STEP 10: Admin Approves Services
    // ============================================
    log('📋', 'STEP 10: Admin Approves Services', colors.blue);
    
    for (const service of services) {
      await prisma.service.update({
        where: { id: service.id },
        data: {
          adminApproved: true,
          approvedBy: admin.id,
          approvedAt: new Date(),
          status: 'active'
        }
      });
      
      log('✅', `Service approved: ${service.title}`, colors.green);
    }
    console.log('');

    // ============================================
    // STEP 11: Create Customers
    // ============================================
    log('📋', 'STEP 11: Creating Customers', colors.blue);
    
    const customers = [];
    const customerData = [
      { firstName: 'Alice', lastName: 'Cooper', email: 'alice@example.com', phone: '+27222222221' },
      { firstName: 'Bob', lastName: 'Marley', email: 'bob@example.com', phone: '+27222222222' },
      { firstName: 'Charlie', lastName: 'Brown', email: 'charlie@example.com', phone: '+27222222223' },
    ];
    
    for (const data of customerData) {
      const password = 'Customer123!';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: 'customer',
          isEmailVerified: true
        }
      });
      
      const customer = await prisma.customer.create({
        data: {
          userId: user.id
        }
      });
      
      customers.push({ user, customer });
      log('✅', `Customer created: ${data.firstName} ${data.lastName}`, colors.green);
    }
    console.log('');

    // ============================================
    // STEP 12: Customers Book Services (Uber-style)
    // ============================================
    log('📋', 'STEP 12: Customers Book Services', colors.blue);
    
    const bookings = [];
    for (let i = 0; i < 10; i++) {
      const customer = randomChoice(customers);
      const service = randomChoice(services);
      
      const booking = await prisma.booking.create({
        data: {
          customerId: customer.customer.id,
          serviceId: service.id,
          date: new Date(Date.now() + randomInt(1, 30) * 24 * 60 * 60 * 1000),
          time: `${randomInt(8, 18)}:00`,
          location: {
            type: 'Point',
            coordinates: [28.0473 + (Math.random() - 0.5) * 0.1, -26.2041 + (Math.random() - 0.5) * 0.1],
            address: `${randomInt(1, 100)} Customer Street, Johannesburg`
          },
          status: 'pending',
          requestStatus: 'pending',
          jobSize: randomChoice(['small', 'medium', 'large']),
          basePrice: service.price,
          jobSizeMultiplier: randomChoice([1.0, 1.2, 1.5]),
          calculatedPrice: service.price * randomChoice([1.0, 1.2, 1.5]),
          estimatedDurationMinutes: service.duration
        }
      });
      
      bookings.push(booking);
      log('📅', `Booking created: ${customer.user.firstName} → ${service.title}`, colors.cyan);
    }
    console.log('');

    // ============================================
    // STEP 13: Providers Accept/Decline Jobs
    // ============================================
    log('📋', 'STEP 13: Providers Accept/Decline Jobs', colors.blue);
    
    const activeBookings = [];
    for (const booking of bookings) {
      const service = await prisma.service.findUnique({
        where: { id: booking.serviceId },
        include: { provider: true }
      });
      
      if (!service) continue;
      
      // 70% acceptance rate
      const accepted = Math.random() > 0.3;
      
      if (accepted) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            requestStatus: 'accepted',
            providerAcceptedAt: new Date(),
            status: 'confirmed'
          }
        });
        
        activeBookings.push(booking);
        log('✅', `Booking accepted: ${service.title}`, colors.green);
      } else {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            requestStatus: 'declined',
            providerDeclinedAt: new Date(),
            declineReason: randomChoice(['Not available', 'Too far', 'Schedule conflict'])
          }
        });
        
        log('❌', `Booking declined: ${service.title}`, colors.red);
      }
    }
    
    log('📊', `${activeBookings.length} bookings accepted out of ${bookings.length}`, colors.cyan);
    console.log('');

    // ============================================
    // STEP 14: Customers Pay for Services
    // ============================================
    log('📋', 'STEP 14: Customers Pay for Services', colors.blue);
    
    const payments = [];
    for (const booking of activeBookings) {
      const payment = await prisma.payment.create({
        data: {
          customerId: booking.customerId,
          bookingId: booking.id,
          amount: booking.calculatedPrice || booking.basePrice || 0,
          currency: 'ZAR',
          paymentMethod: 'payfast',
          status: 'completed',
          transactionId: `TXN${Date.now()}${randomInt(1000, 9999)}`,
          escrowStatus: 'held',
          commissionRate: 0.15,
          commissionAmount: (booking.calculatedPrice || booking.basePrice || 0) * 0.15,
          providerPayout: (booking.calculatedPrice || booking.basePrice || 0) * 0.85
        }
      });
      
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'paid_to_escrow',
          escrowAmount: payment.amount,
          commissionAmount: payment.commissionAmount,
          providerPayoutAmount: payment.providerPayout
        }
      });
      
      payments.push(payment);
      log('💳', `Payment received: ZAR ${payment.amount.toFixed(2)} for booking ${booking.id.substring(0, 8)}`, colors.green);
    }
    console.log('');

    // ============================================
    // STEP 15: Jobs Completed & Ratings
    // ============================================
    log('📋', 'STEP 15: Jobs Completed & Ratings', colors.blue);
    
    for (const booking of activeBookings) {
      // Mark as completed
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          startedAt: new Date(Date.now() - booking.estimatedDurationMinutes * 60 * 1000),
          actualDurationMinutes: booking.estimatedDurationMinutes + randomInt(-30, 30)
        }
      });
      
      // Customer rates provider (80% give 4-5 stars, 20% give 1-3 stars)
      const rating = Math.random() > 0.2 ? randomInt(4, 5) : randomInt(1, 3);
      const review = rating >= 4 
        ? randomChoice(['Great service!', 'Very professional', 'Highly recommended', 'Excellent work'])
        : randomChoice(['Could be better', 'Not satisfied', 'Needs improvement']);
      
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          rating,
          review
        }
      });
      
      // Update provider rating
      const service = await prisma.service.findUnique({
        where: { id: booking.serviceId },
        include: { provider: true }
      });
      
      if (service) {
        const provider = service.provider;
        const allBookings = await prisma.booking.findMany({
          where: {
            serviceId: { in: (await prisma.service.findMany({ where: { providerId: provider.id } })).map(s => s.id) },
            rating: { not: null }
          }
        });
        
        const avgRating = allBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / allBookings.length;
        
        await prisma.serviceProvider.update({
          where: { id: provider.id },
          data: {
            rating: avgRating,
            totalReviews: allBookings.length
          }
        });
      }
      
      log('⭐', `Booking completed with rating: ${rating}/5`, colors.yellow);
    }
    console.log('');

    // ============================================
    // STEP 16: Customers Report Issues
    // ============================================
    log('📋', 'STEP 16: Customers Report Issues', colors.blue);
    
    // 2 customers report issues
    const reportedBookings = activeBookings.slice(0, 2);
    
    for (const booking of reportedBookings) {
      const complaint = await prisma.complaint.create({
        data: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          reportedBy: booking.customerId,
          reportedByRole: 'customer',
          type: randomChoice(['service_quality', 'behavior', 'sla_breach']),
          severity: randomChoice(['medium', 'high']),
          title: 'Issue with service delivery',
          description: 'The service provider did not meet expectations. Details: ' + randomChoice([
            'Arrived late',
            'Poor quality work',
            'Unprofessional behavior',
            'Did not complete all tasks'
          ]),
          status: 'open'
        }
      });
      
      log('⚠️', `Complaint filed: ${complaint.title}`, colors.yellow);
    }
    console.log('');

    // ============================================
    // STEP 17: Admin Resolves Complaints
    // ============================================
    log('📋', 'STEP 17: Admin Resolves Complaints', colors.blue);
    
    const complaints = await prisma.complaint.findMany({
      where: { status: 'open' }
    });
    
    for (const complaint of complaints) {
      await prisma.complaint.update({
        where: { id: complaint.id },
        data: {
          status: 'resolved',
          resolution: 'Investigated and resolved. Provider has been notified and will improve service quality.',
          resolvedBy: admin.id,
          resolvedAt: new Date()
        }
      });
      
      log('✅', `Complaint resolved: ${complaint.title}`, colors.green);
    }
    console.log('');

    // ============================================
    // STEP 18: Release Payments to Providers
    // ============================================
    log('📋', 'STEP 18: Release Payments to Providers', colors.blue);
    
    for (const booking of activeBookings) {
      const payment = await prisma.payment.findUnique({
        where: { bookingId: booking.id }
      });
      
      if (payment && booking.status === 'completed') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            escrowStatus: 'released',
            status: 'completed'
          }
        });
        
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: 'released_to_provider'
          }
        });
        
        log('💰', `Payment released: ZAR ${payment.providerPayout?.toFixed(2)} to provider`, colors.green);
      }
    }
    console.log('');

    // ============================================
    // STEP 19: Create Provider Payouts
    // ============================================
    log('📋', 'STEP 19: Create Provider Payouts', colors.blue);
    
    for (const { provider } of registeredProviders) {
      const completedBookings = await prisma.booking.findMany({
        where: {
          serviceId: { in: (await prisma.service.findMany({ where: { providerId: provider.id } })).map(s => s.id) },
          paymentStatus: 'released_to_provider'
        },
        include: { payment: true }
      });
      
      if (completedBookings.length > 0) {
        const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.providerPayoutAmount || 0), 0);
        const commission = completedBookings.reduce((sum, b) => sum + (b.commissionAmount || 0), 0);
        const netAmount = totalEarnings;
        
        const periodStart = new Date();
        periodStart.setDate(1); // Start of month
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(0); // End of month
        
        const payout = await prisma.providerPayout.create({
          data: {
            providerId: provider.id,
            periodStart,
            periodEnd,
            totalEarnings,
            commission,
            netAmount,
            status: 'pending',
            bookingIds: completedBookings.map(b => b.id)
          }
        });
        
        log('💵', `Payout created: ZAR ${netAmount.toFixed(2)} for provider`, colors.green);
      }
    }
    console.log('');

    // ============================================
    // SUMMARY
    // ============================================
    log('📊', 'SIMULATION SUMMARY', colors.bright);
    console.log('');
    
    const stats = {
      admins: await prisma.user.count({ where: { role: 'admin' } }),
      providers: await prisma.serviceProvider.count(),
      customers: await prisma.customer.count(),
      services: await prisma.service.count({ where: { adminApproved: true } }),
      bookings: await prisma.booking.count(),
      completedBookings: await prisma.booking.count({ where: { status: 'completed' } }),
      payments: await prisma.payment.count({ where: { status: 'completed' } }),
      complaints: await prisma.complaint.count(),
      resolvedComplaints: await prisma.complaint.count({ where: { status: 'resolved' } }),
      payouts: await prisma.providerPayout.count()
    };
    
    console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
    console.log(`${colors.green}✅ Admins:${colors.reset} ${stats.admins}`);
    console.log(`${colors.green}✅ Service Providers:${colors.reset} ${stats.providers}`);
    console.log(`${colors.green}✅ Customers:${colors.reset} ${stats.customers}`);
    console.log(`${colors.green}✅ Active Services:${colors.reset} ${stats.services}`);
    console.log(`${colors.green}✅ Total Bookings:${colors.reset} ${stats.bookings}`);
    console.log(`${colors.green}✅ Completed Bookings:${colors.reset} ${stats.completedBookings}`);
    console.log(`${colors.green}✅ Payments:${colors.reset} ${stats.payments}`);
    console.log(`${colors.yellow}⚠️  Complaints:${colors.reset} ${stats.complaints} (${stats.resolvedComplaints} resolved)`);
    console.log(`${colors.green}💰 Provider Payouts:${colors.reset} ${stats.payouts}`);
    console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
    console.log('');
    
    log('🎉', 'End-to-End Flow Simulation Completed Successfully!', colors.green);
    
  } catch (error) {
    console.error(colors.red + '❌ Error during simulation:' + colors.reset, error);
    throw error;
  }
}

// Run simulation
main()
  .then(() => {
    console.log('');
    log('✅', 'Simulation finished', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    console.error(colors.red + '❌ Simulation failed:' + colors.reset, error);
    process.exit(1);
  });

