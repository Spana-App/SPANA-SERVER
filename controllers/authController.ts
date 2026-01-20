import prisma from '../lib/database';
import { generateUserReferenceAsync } from '../lib/idGenerator';
// import { syncUserToMongo } from '../lib/mongoSync';
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { sendWelcomeEmail, sendVerificationEmail } = require('../config/mailer');
const nodeCrypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Helper functions for admin auto-registration
const isSpanaAdminEmail = (email: string): boolean => {
  return email.toLowerCase().endsWith('@spana.co.za');
};

const extractFirstNameFromEmail = (email: string): string => {
  const localPart = email.split('@')[0];
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
};

// Generate JWT Token
const generateToken = (id: any) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Register user
exports.register = async (req: any, res: any) => {
  try {
    console.log('Registration attempt:', { email: req.body.email, role: req.body.role });
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, phone, role } = req.body;
    console.log('Extracted data:', { email, firstName, lastName, phone, role });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Auto-detect admin role for Spana domain
    let finalRole = role || 'customer';
    let finalFirstName = firstName;
    
    if (isSpanaAdminEmail(email)) {
      finalRole = 'admin';
      if (!firstName) {
        finalFirstName = extractFirstNameFromEmail(email);
      }
      // Create admin verification record
      try {
        await prisma.adminVerification.create({
          data: {
            adminEmail: email.toLowerCase(),
            verified: false // Requires email verification
          }
        });
      } catch (err) {
        console.error('Error creating admin verification:', err);
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Prepare user data
    const userData: any = {
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: finalFirstName,
      lastName: lastName || '',
      phone,
      role: finalRole,
      isEmailVerified: finalRole === 'admin' ? false : false // Admins need verification
    };

    // Note: Provider-specific fields are now handled in the ServiceProvider model

    // Create new user
    console.log('Creating user with data:', userData);
    const referenceNumber = await generateUserReferenceAsync();
    const user = await prisma.user.create({
      data: {
        ...userData,
        referenceNumber // SPN-USR-000001
      }
    });
    console.log('User created:', user.id, 'Reference:', referenceNumber);

    // Create role-specific record
    if (finalRole === 'customer') {
      console.log('Creating customer record for user:', user.id);
      await prisma.customer.create({
        data: {
          userId: user.id,
          favouriteProviders: [],
          totalBookings: 0,
          ratingGivenAvg: 0
        }
      });
      console.log('Customer record created');
    } else if (finalRole === 'service_provider') {
      console.log('Creating service provider record for user:', user.id);
      await prisma.serviceProvider.create({
        data: {
          userId: user.id,
          skills: [],
          experienceYears: 0,
          isOnline: false,
          rating: 0,
          totalReviews: 0,
          isVerified: false,
          isIdentityVerified: false,
          availability: { days: [], hours: { start: '', end: '' } },
          serviceAreaRadius: 0,
          serviceAreaCenter: { type: 'Point', coordinates: [0, 0] },
          isProfileComplete: false
        }
      });
      console.log('Service provider record created');
    }

    // Fetch user with role-specific data for response
    const userWithRole = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        customer: true,
        serviceProvider: true
      }
    });

    // Shape response by role
    let userResponse: any;
    if (user.role === 'customer' && userWithRole?.customer) {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
      const { favouriteProviders, totalBookings, ratingGivenAvg } = userWithRole.customer;
      userResponse = { 
        _id: id, email, firstName, lastName, phone, role, isVerified: false, isEmailVerified, isPhoneVerified, 
        profileImage, location, walletBalance, status, 
        customerDetails: { favouriteProviders, totalBookings, ratingGivenAvg }, 
        createdAt, updatedAt, __v: 0 
      };
    } else if (user.role === 'service_provider' && userWithRole?.serviceProvider) {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
      const { skills, experienceYears, isOnline, rating, totalReviews, isVerified, isIdentityVerified, availability, serviceAreaRadius, serviceAreaCenter, isProfileComplete } = userWithRole.serviceProvider;
      userResponse = { 
        _id: id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, 
        profileImage, skills, experienceYears, isOnline, rating, totalReviews, isProfileComplete, 
        availability, serviceArea: { radiusInKm: serviceAreaRadius, baseLocation: serviceAreaCenter }, 
        location, walletBalance, status, createdAt, updatedAt, __v: 0 
      };
    } else {
      // Fallback for admin or other roles
      userResponse = {
        _id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, 
        phone: user.phone, role: user.role, isVerified: false, isEmailVerified: user.isEmailVerified, 
        isPhoneVerified: user.isPhoneVerified, profileImage: user.profileImage, location: user.location, 
        walletBalance: user.walletBalance, status: user.status, createdAt: user.createdAt, 
        updatedAt: user.updatedAt, __v: 0
      };
    }

    // Only send emails if explicitly requested via query parameter
    // This prevents automatic email sending during registration
    const sendEmails = req.query.sendEmails === 'true' || req.body.sendEmails === true;
    
    if (sendEmails) {
      // Send verification email (for providers and admins) - only if requested
      if (user.role === 'service_provider') {
        try {
          const verificationToken = nodeCrypto.randomBytes(32).toString('hex');
          await prisma.serviceProvider.update({
            where: { userId: user.id },
            data: {
              verificationToken,
              verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          });

          // Build verification link using Render backend URL (preferred) with safe fallbacks
          let baseUrl = process.env.CLIENT_URL || process.env.EXTERNAL_API_URL;

          // If CLIENT_URL/EXTERNAL_API_URL are not set or invalid, fall back to Render URL
          if (!baseUrl || baseUrl === '*' || !baseUrl.startsWith('http')) {
            baseUrl = 'https://spana-server-5bhu.onrender.com';
          }

          const cleanBaseUrl = baseUrl.replace(/\/$/, '');
          const verificationLink = `${cleanBaseUrl}/verify-provider?token=${verificationToken}&uid=${user.id}`;

          sendVerificationEmail(user, verificationLink).catch(() => {});
        } catch (_) {}
      } else if (user.role === 'admin' && isSpanaAdminEmail(user.email)) {
        // Send admin verification email - only if requested
        try {
          const verificationToken = nodeCrypto.randomBytes(32).toString('hex');
          await prisma.user.update({
            where: { id: user.id },
            data: {
              verificationToken,
              verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          });
          let baseUrl = process.env.CLIENT_URL || process.env.EXTERNAL_API_URL;
          if (!baseUrl || baseUrl === '*' || !baseUrl.startsWith('http')) {
            if (process.env.EXTERNAL_API_URL && process.env.EXTERNAL_API_URL.startsWith('http')) {
              try {
                baseUrl = new URL(process.env.EXTERNAL_API_URL).origin;
              } catch (e) {}
            }
            if (!baseUrl || baseUrl === '*' || !baseUrl.startsWith('http')) {
              const port = process.env.PORT || '5003';
              baseUrl = `http://localhost:${port}`;
            }
          }
          const cleanBaseUrl = baseUrl.replace(/\/$/, '');
          const verificationLink = `${cleanBaseUrl}/admin/verify?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;
          sendVerificationEmail(user, verificationLink).catch((err) => {
            console.error('Error sending admin verification email on registration:', err);
          });
        } catch (_) {}
      }

      // Send welcome email - only if requested
      // For providers, include verification token and uid so the "Complete Profile" button works
      try {
        if (user.role === 'service_provider') {
          const provider = await prisma.serviceProvider.findUnique({
            where: { userId: user.id }
          });
          if (provider?.verificationToken) {
            // Pass token and uid to welcome email for provider
            sendWelcomeEmail(user, { token: provider.verificationToken, uid: user.id }).catch(() => {});
          } else {
            sendWelcomeEmail(user).catch(() => {});
          }
        } else {
          sendWelcomeEmail(user).catch(() => {});
        }
      } catch (_) {}
    }

    // Sync to MongoDB backup (fire-and-forget)
    try {
      // syncUserToMongo(user).catch(() => {});
    } catch (_) {}

    res.status(201).json({
      message: 'User created successfully. Please login to get your access token.',
      user: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

// Login user
exports.login = async (req: any, res: any) => {
  try {
    const { email } = req.body;

    // Admin login only requires email (password-less for @spana.co.za)
    if (!isSpanaAdminEmail(email)) {
      // Regular user login requires password
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ message: 'Password is required' });
      }

      let user = await prisma.user.findUnique({ 
        where: { email: email.toLowerCase() },
        include: { customer: true, serviceProvider: true }
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Generate token for non-admin users (7 days expiry)
      const token = generateToken(user.id);

      // Log activity and update lastLoginAt
      try {
        await prisma.activity.create({ 
          data: { 
            userId: user.id, 
            actionType: 'login' 
          } 
        });
      } catch (_) {}
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });
      } catch (_) {}

      // Build user response based on role
      let userResponse: any;
      if (user.role === 'customer' && user.customer) {
        const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
        userResponse = {
          _id: id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, 
          profileImage, location, walletBalance, status, createdAt, updatedAt, __v: 0
        };
      } else if (user.role === 'service_provider' && user.serviceProvider) {
        const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
        userResponse = {
          _id: id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, 
          profileImage, location, walletBalance, status, createdAt, updatedAt, __v: 0
        };
      } else {
        userResponse = {
          _id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, 
          phone: user.phone, role: user.role, isEmailVerified: user.isEmailVerified, 
          isPhoneVerified: user.isPhoneVerified, profileImage: user.profileImage, location: user.location, 
          walletBalance: user.walletBalance, status: user.status, createdAt: user.createdAt, 
          updatedAt: user.updatedAt, __v: 0
        };
      }

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: userResponse
      });
    }

    // Admin login flow (email-only for @spana.co.za)
    let user = await prisma.user.findUnique({ 
      where: { email: email.toLowerCase() },
      include: { customer: true, serviceProvider: true }
    });

    // Auto-register admin silently if doesn't exist
    if (!user && isSpanaAdminEmail(email)) {
      const firstName = extractFirstNameFromEmail(email);
      const tempPassword = nodeCrypto.randomBytes(32).toString('hex'); // Random password, not used
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword, // Random password, admin uses OTP only
          firstName,
          lastName: '',
          phone: '',
          role: 'admin',
          isEmailVerified: false
        },
        include: { customer: true, serviceProvider: true }
      });

      // Create admin verification record
      try {
        await prisma.adminVerification.create({
          data: {
            adminEmail: email.toLowerCase(),
            verified: false
          }
        });
      } catch (err) {
        console.error('Error creating admin verification record:', err);
      }
    }

    // Auto-correct role for existing users with @spana.co.za email
    if (user && isSpanaAdminEmail(email) && user.role !== 'admin') {
      console.log(`Auto-correcting role for ${email} from ${user.role} to admin`);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin' },
        include: { customer: true, serviceProvider: true }
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
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    // For admin users, automatically generate and send OTP
    if (user.role === 'admin' && isSpanaAdminEmail(user.email)) {
      const { sendAdminOTPEmail } = require('../config/mailer');
      
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

      // Generate verification token for confetti page
      const verificationToken = nodeCrypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken,
          verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      // Get base URL for verification link
      let baseUrl = process.env.EXTERNAL_API_URL || process.env.CLIENT_URL;
      if (req && req.headers && req.headers.host) {
        const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
        baseUrl = `${protocol}://${req.headers.host}`;
      } else if (!baseUrl || baseUrl === '*' || !baseUrl.startsWith('http')) {
        if (process.env.EXTERNAL_API_URL && process.env.EXTERNAL_API_URL.startsWith('http')) {
          try {
            baseUrl = new URL(process.env.EXTERNAL_API_URL).origin;
          } catch (e) {}
        }
        if (!baseUrl || baseUrl === '*' || !baseUrl.startsWith('http')) {
          const port = process.env.PORT || '5003';
          baseUrl = `http://localhost:${port}`;
        }
      }
      const cleanBaseUrl = baseUrl.replace(/\/$/, '');
      const verificationLink = `${cleanBaseUrl}/admin/verify?token=${verificationToken}&email=${encodeURIComponent(user.email)}&otp=${otp}`;

      // Send verification email with OTP (fire-and-forget so login is fast)
      try {
        console.log(`📧 Queueing admin OTP email to ${email}...`);
        sendAdminOTPEmail({
          to: email,
          name: user.firstName || user.email.split('@')[0],
          otp,
          verificationLink
        })
          .then(() => {
            console.log(`✅ Admin OTP email sent successfully to ${email}`);
          })
          .catch((emailError: any) => {
            console.error('❌ Error sending admin OTP email (non-blocking):', {
              message: emailError?.message,
              code: emailError?.code
            });
          });
      } catch (_) {
        // Never block login on email errors
      }

      return res.status(200).json({
        message: 'OTP sent to your email. Please check your inbox or click the verification link.',
        requiresOTP: true,
        email: user.email,
        // Expose OTP in response so frontend can use it when SMTP is unavailable on Render
        otp,
        verificationLink: verificationLink, // Include in response for testing / fallback
        nextStep: 'verify_otp',
        expiresIn: '5 hours'
      });
    }

    // Generate token for non-admin users (7 days expiry)
    const token = generateToken(user.id);

    // Log activity and update lastLoginAt
    try {
      await prisma.activity.create({ 
        data: { 
          userId: user.id, 
          actionType: 'login' 
        } 
      });
    } catch (_) {}
    try {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      // Sync updated user to MongoDB
      // syncUserToMongo(updatedUser).catch(() => {});
    } catch (_) {}

    // Fetch user with role-specific data for response
    const userWithRole = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        customer: true,
        serviceProvider: true
      }
    });

    // Shape response by role
    let userResponse: any;
    if (user.role === 'customer' && userWithRole?.customer) {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
      const { favouriteProviders, totalBookings, ratingGivenAvg } = userWithRole.customer;
      userResponse = { 
        _id: id, email, firstName, lastName, phone, role, isVerified: false, isEmailVerified, isPhoneVerified, 
        profileImage, location, walletBalance, status, 
        customerDetails: { favouriteProviders, totalBookings, ratingGivenAvg }, 
        createdAt, updatedAt, __v: 0 
      };
    } else if (user.role === 'service_provider' && userWithRole?.serviceProvider) {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
      const { skills, experienceYears, isOnline, rating, totalReviews, isVerified, isIdentityVerified, availability, serviceAreaRadius, serviceAreaCenter, isProfileComplete } = userWithRole.serviceProvider;
      userResponse = { 
        _id: id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, 
        profileImage, skills, experienceYears, isOnline, rating, totalReviews, isProfileComplete, 
        availability, serviceArea: { radiusInKm: serviceAreaRadius, baseLocation: serviceAreaCenter }, 
        location, walletBalance, status, createdAt, updatedAt, __v: 0 
      };
    } else {
      // Fallback for admin or other roles
      userResponse = {
        _id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, 
        phone: user.phone, role: user.role, isVerified: false, isEmailVerified: user.isEmailVerified, 
        isPhoneVerified: user.isPhoneVerified, profileImage: user.profileImage, location: user.location, 
        walletBalance: user.walletBalance, status: user.status, createdAt: user.createdAt, 
        updatedAt: user.updatedAt, __v: 0
      };
    }

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Update current user profile
exports.updateProfile = async (req: any, res: any) => {
  try {
    const body = req.body || {};
    
    // Get current user with role-specific data
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        customer: true,
        serviceProvider: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prepare update data (email is read-only, so we don't allow it to be changed)
    const updateData: any = {};
    
    // Always-allowed common fields
    if (typeof body.firstName === 'string') updateData.firstName = body.firstName.trim();
    if (typeof body.lastName === 'string') updateData.lastName = body.lastName.trim();
    if (typeof body.phone === 'string') updateData.phone = body.phone.trim();
    if (body.location !== undefined) updateData.location = body.location;
    if (typeof body.profileImage === 'string') updateData.profileImage = body.profileImage;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      include: {
        customer: true,
        serviceProvider: true
      }
    });

    // Update role-specific data
    if (user.role === 'customer' && body.customerDetails) {
      await prisma.customer.update({
        where: { userId: user.id },
        data: {
          favouriteProviders: body.customerDetails.favouriteProviders !== undefined 
            ? body.customerDetails.favouriteProviders 
            : user.customer?.favouriteProviders || [],
          totalBookings: typeof body.customerDetails.totalBookings === 'number' 
            ? body.customerDetails.totalBookings 
            : (user.customer?.totalBookings || 0),
          ratingGivenAvg: typeof body.customerDetails.ratingGivenAvg === 'number' 
            ? body.customerDetails.ratingGivenAvg 
            : (user.customer?.ratingGivenAvg || 0)
        }
      });
    } else if (user.role === 'service_provider' && body.providerDetails) {
      const providerUpdateData: any = {};
      if (Array.isArray(body.providerDetails.skills)) providerUpdateData.skills = body.providerDetails.skills;
      if (typeof body.providerDetails.experienceYears === 'number') providerUpdateData.experienceYears = body.providerDetails.experienceYears;
      if (typeof body.providerDetails.isOnline === 'boolean') providerUpdateData.isOnline = body.providerDetails.isOnline;
      if (body.providerDetails.availability) providerUpdateData.availability = body.providerDetails.availability;
      if (body.providerDetails.serviceArea) {
        providerUpdateData.serviceAreaRadius = body.providerDetails.serviceArea.radiusInKm !== undefined 
          ? body.providerDetails.serviceArea.radiusInKm 
          : user.serviceProvider?.serviceAreaRadius;
        providerUpdateData.serviceAreaCenter = body.providerDetails.serviceArea.baseLocation !== undefined 
          ? body.providerDetails.serviceArea.baseLocation 
          : user.serviceProvider?.serviceAreaCenter;
      }
      if (typeof body.providerDetails.isProfileComplete === 'boolean') providerUpdateData.isProfileComplete = body.providerDetails.isProfileComplete;
      
      // Also support direct fields for backward compatibility
      if (Array.isArray(body.skills)) providerUpdateData.skills = body.skills;
      if (typeof body.experienceYears === 'number') providerUpdateData.experienceYears = body.experienceYears;
      if (typeof body.isOnline === 'boolean') providerUpdateData.isOnline = body.isOnline;
      if (body.availability) providerUpdateData.availability = body.availability;
      if (body.serviceArea) {
        providerUpdateData.serviceAreaRadius = body.serviceArea.radiusInKm !== undefined 
          ? body.serviceArea.radiusInKm 
          : user.serviceProvider?.serviceAreaRadius;
        providerUpdateData.serviceAreaCenter = body.serviceArea.baseLocation !== undefined 
          ? body.serviceArea.baseLocation 
          : user.serviceProvider?.serviceAreaCenter;
      }
      
      if (Object.keys(providerUpdateData).length > 0) {
        await prisma.serviceProvider.update({
          where: { userId: user.id },
          data: providerUpdateData
        });
      }
    }

    // Fetch updated user with all role-specific data
    const userWithRole = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        customer: true,
        serviceProvider: true
      }
    });

    // Shape response by role (same format as getMe)
    let userResponse: any;
    if (userWithRole?.role === 'customer' && userWithRole.customer) {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = userWithRole;
      const { favouriteProviders, totalBookings, ratingGivenAvg } = userWithRole.customer;
      userResponse = { 
        _id: id, email, firstName, lastName, phone, role, isVerified: false, isEmailVerified, isPhoneVerified, 
        profileImage, location, walletBalance, status, 
        customerDetails: { favouriteProviders, totalBookings, ratingGivenAvg }, 
        createdAt, updatedAt, __v: 0 
      };
    } else if (userWithRole?.role === 'service_provider' && userWithRole.serviceProvider) {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = userWithRole;
      const { skills, experienceYears, isOnline, rating, totalReviews, isVerified, isIdentityVerified, availability, serviceAreaRadius, serviceAreaCenter, isProfileComplete } = userWithRole.serviceProvider;
      userResponse = { 
        _id: id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, 
        profileImage, skills, experienceYears, isOnline, rating, totalReviews, isProfileComplete, 
        availability, serviceArea: { radiusInKm: serviceAreaRadius, baseLocation: serviceAreaCenter }, 
        location, walletBalance, status, createdAt, updatedAt, __v: 0 
      };
    } else if (userWithRole?.role === 'admin') {
      // Admin users - no walletBalance
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, status, createdAt, updatedAt } = userWithRole;
      userResponse = {
        _id: id, email, firstName, lastName, phone, role, isVerified: false, isEmailVerified, isPhoneVerified, 
        profileImage, location, status, createdAt, updatedAt, __v: 0
      };
    } else {
      // Fallback for other roles
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = userWithRole || {};
      userResponse = {
        _id: id, email, firstName, lastName, phone, role, isVerified: false, isEmailVerified, isPhoneVerified, 
        profileImage, location, walletBalance, status, createdAt, updatedAt, __v: 0
      };
    }

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Upload profile image
exports.uploadProfileImage = async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile image if exists
    if (user.profileImage && user.profileImage.startsWith('/uploads/')) {
      const oldFilePath = user.profileImage.replace('/uploads/', 'uploads/');
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
        } catch (err) {
          console.error('Error deleting old profile image:', err);
        }
      }
    }

    const profileImageUrl = `/uploads/${req.file.filename}`;
    
    // Update user with Prisma
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImage: profileImageUrl },
      include: {
        customer: true,
        serviceProvider: true
      }
    });

    // Shape response by role (same format as getMe)
    let userResponse: any;
    if (updatedUser.role === 'customer' && updatedUser.customer) {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = updatedUser;
      const { favouriteProviders, totalBookings, ratingGivenAvg } = updatedUser.customer;
      userResponse = { 
        _id: id, email, firstName, lastName, phone, role, isVerified: false, isEmailVerified, isPhoneVerified, 
        profileImage, location, walletBalance, status, 
        customerDetails: { favouriteProviders, totalBookings, ratingGivenAvg }, 
        createdAt, updatedAt, __v: 0 
      };
    } else if (updatedUser.role === 'service_provider' && updatedUser.serviceProvider) {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = updatedUser;
      const { skills, experienceYears, isOnline, rating, totalReviews, isVerified, isIdentityVerified, availability, serviceAreaRadius, serviceAreaCenter, isProfileComplete } = updatedUser.serviceProvider;
      userResponse = { 
        _id: id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, 
        profileImage, skills, experienceYears, isOnline, rating, totalReviews, isProfileComplete, 
        availability, serviceArea: { radiusInKm: serviceAreaRadius, baseLocation: serviceAreaCenter }, 
        location, walletBalance, status, createdAt, updatedAt, __v: 0 
      };
    } else if (updatedUser.role === 'admin') {
      // Admin users - no walletBalance
      userResponse = {
        _id: updatedUser.id, email: updatedUser.email, firstName: updatedUser.firstName, lastName: updatedUser.lastName, 
        phone: updatedUser.phone, role: updatedUser.role, isVerified: false, isEmailVerified: updatedUser.isEmailVerified, 
        isPhoneVerified: updatedUser.isPhoneVerified, profileImage: updatedUser.profileImage, location: updatedUser.location, 
        status: updatedUser.status, createdAt: updatedUser.createdAt, 
        updatedAt: updatedUser.updatedAt, __v: 0
      };
    } else {
      // Fallback for other roles
      userResponse = {
        _id: updatedUser.id, email: updatedUser.email, firstName: updatedUser.firstName, lastName: updatedUser.lastName, 
        phone: updatedUser.phone, role: updatedUser.role, isVerified: false, isEmailVerified: updatedUser.isEmailVerified, 
        isPhoneVerified: updatedUser.isPhoneVerified, profileImage: updatedUser.profileImage, location: updatedUser.location, 
        walletBalance: updatedUser.walletBalance, status: updatedUser.status, createdAt: updatedUser.createdAt, 
        updatedAt: updatedUser.updatedAt, __v: 0
      };
    }

    res.json({
      message: 'Profile image uploaded successfully',
      url: updatedUser.profileImage,
      user: userResponse
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current user
exports.getMe = async (req: any, res: any) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id },
      include: {
        customer: true,
        serviceProvider: true
      }
    });
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (user.role === 'customer') {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt, customer } = user;
      return res.json({ 
        _id: id, 
        email, 
        firstName, 
        lastName, 
        phone, 
        role, 
        isEmailVerified, 
        isPhoneVerified, 
        profileImage, 
        location, 
        walletBalance, 
        status, 
        customerDetails: { 
          favouriteProviders: customer?.favouriteProviders || [], 
          totalBookings: customer?.totalBookings || 0, 
          ratingGivenAvg: customer?.ratingGivenAvg || 0 
        }, 
        createdAt, 
        updatedAt, 
        __v: 0 
      });
    }
    
    if (user.role === 'service_provider') {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt, serviceProvider } = user;
      return res.json({ 
        _id: id, 
        email, 
        firstName, 
        lastName, 
        phone, 
        role, 
        isEmailVerified, 
        isPhoneVerified, 
        isIdentityVerified: serviceProvider?.isIdentityVerified || false,
        profileImage, 
        skills: serviceProvider?.skills || [],
        experienceYears: serviceProvider?.experienceYears || 0,
        isOnline: serviceProvider?.isOnline || false,
        rating: serviceProvider?.rating || 0,
        totalReviews: serviceProvider?.totalReviews || 0,
        availability: serviceProvider?.availability || { days: [], hours: { start: '', end: '' } },
        serviceArea: { 
          radiusInKm: serviceProvider?.serviceAreaRadius || 0, 
          baseLocation: serviceProvider?.serviceAreaCenter || { type: 'Point', coordinates: [0, 0] }
        }, 
        location, 
        walletBalance, 
        status, 
        createdAt, 
        updatedAt, 
        __v: 0 
      });
    }
    
    // Admin users - no walletBalance
    if (user.role === 'admin') {
      const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, status, createdAt, updatedAt } = user;
      return res.json({ 
        _id: id, 
        email, 
        firstName, 
        lastName, 
        phone, 
        role, 
        isEmailVerified, 
        isPhoneVerified, 
        profileImage, 
        location, 
        status, 
        createdAt, 
        updatedAt, 
        __v: 0 
      });
    }
    
    // Default response for other roles
    const { id, email, firstName, lastName, phone, role, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, createdAt, updatedAt } = user;
    return res.json({ 
      _id: id, 
      email, 
      firstName, 
      lastName, 
      phone, 
      role, 
      isEmailVerified, 
      isPhoneVerified, 
      profileImage, 
      location, 
      walletBalance, 
      status, 
      createdAt, 
      updatedAt, 
      __v: 0 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {};


