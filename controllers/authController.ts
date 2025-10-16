import prisma from '../lib/database';
// import { syncUserToMongo } from '../lib/mongoSync';
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { sendWelcomeEmail, sendVerificationEmail } = require('../config/mailer');
const nodeCrypto = require('crypto');
const bcrypt = require('bcryptjs');

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
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Prepare user data
    const userData: any = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role: role || 'customer'
    };

    // Note: Provider-specific fields are now handled in the ServiceProvider model

    // Create new user
    console.log('Creating user with data:', userData);
    const user = await prisma.user.create({
      data: userData
    });
    console.log('User created:', user.id);

    // Create role-specific record
    if (role === 'customer') {
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
    } else if (role === 'service_provider') {
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

    // Generate token
    const token = generateToken(user.id);

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

    // Provider verification email if role is service provider
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
        const verificationLink = `${process.env.CLIENT_URL}/verify-provider?token=${verificationToken}&uid=${user.id}`;
        sendVerificationEmail(user, verificationLink).catch(() => {});
      } catch (_) {}
    }

    // Fire-and-forget welcome email (don't block response)
    try {
      sendWelcomeEmail(user).catch(() => {});
    } catch (_) {}

    // Sync to MongoDB backup (fire-and-forget)
    try {
      // syncUserToMongo(user).catch(() => {});
    } catch (_) {}

    res.status(201).json({
      message: 'User created successfully',
      token,
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
    const { email, password } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
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
    
    // Admin or other roles
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


