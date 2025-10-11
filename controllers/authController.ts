const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { sendWelcomeEmail, sendVerificationEmail } = require('../config/mailer');
const nodeCrypto = require('crypto');

// Generate JWT Token
const generateToken = (id: any) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Register user
exports.register = async (req: any, res: any) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: role || 'customer'
    });

    // Ensure provider-only fields are initialized for service providers
    if (user.role === 'service provider') {
      if (!Array.isArray(user.skills)) user.skills = [];
      if (typeof user.experienceYears !== 'number') user.experienceYears = 0;
      if (typeof user.isOnline !== 'boolean') user.isOnline = false;
      if (!Array.isArray(user.documents)) user.documents = [];
      if (!user.availability) user.availability = { days: [], hours: { start: '', end: '' } };
      if (!user.serviceArea) user.serviceArea = { radiusInKm: 0, baseLocation: { type: 'Point', coordinates: [0, 0] } };
    }

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Remove password and shape response by role
    const userObj = { ...user.toObject() };
    delete (userObj as any).password;
    let userResponse: any;
    if (userObj.role === 'customer') {
      const { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, paymentMethods, customerDetails, createdAt, updatedAt, __v } = userObj;
      userResponse = { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, paymentMethods, customerDetails, createdAt, updatedAt, __v };
    } else {
      const { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, profileImage, skills, experienceYears, isOnline, documents, rating, totalReviews, availability, serviceArea, location, walletBalance, status, paymentMethods, createdAt, updatedAt, __v } = userObj;
      userResponse = { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, profileImage, skills, experienceYears, isOnline, documents, rating, totalReviews, availability, serviceArea, location, walletBalance, status, paymentMethods, createdAt, updatedAt, __v };
    }

    // Provider verification email if role is provider
    if (user.role === 'provider') {
      try {
        const verificationToken = nodeCrypto.randomBytes(32).toString('hex');
        user.verification = {
          token: verificationToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        await user.save();
        const verificationLink = `${process.env.CLIENT_URL}/verify-provider?token=${verificationToken}&uid=${user._id}`;
        sendVerificationEmail(user, verificationLink).catch(() => {});
      } catch (_) {}
    }

    // Fire-and-forget welcome email (don't block response)
    try {
      sendWelcomeEmail(user).catch(() => {});
    } catch (_) {}

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
exports.login = async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Log activity and update lastLoginAt
    try {
      const Activity = require('../models/Activity');
      await Activity.create({ userId: user._id, actionType: 'login' });
    } catch (_) {}
    try {
      user.lastLoginAt = new Date();
      await user.save();
    } catch (_) {}

    // Remove password and shape response by role
    const userObj = { ...user.toObject() };
    delete (userObj as any).password;
    let userResponse: any;
    if (userObj.role === 'customer') {
      const { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, paymentMethods, customerDetails, createdAt, updatedAt, __v } = userObj;
      userResponse = { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, paymentMethods, customerDetails, createdAt, updatedAt, __v };
    } else {
      const { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, profileImage, skills, experienceYears, isOnline, documents, rating, totalReviews, availability, serviceArea, location, walletBalance, status, paymentMethods, createdAt, updatedAt, __v } = userObj;
      userResponse = { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, profileImage, skills, experienceYears, isOnline, documents, rating, totalReviews, availability, serviceArea, location, walletBalance, status, paymentMethods, createdAt, updatedAt, __v };
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
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const userObj = { ...user.toObject() };
    delete (userObj as any).password;
    if (userObj.role === 'customer') {
      const { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, paymentMethods, customerDetails, createdAt, updatedAt, __v } = userObj;
      return res.json({ _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, profileImage, location, walletBalance, status, paymentMethods, customerDetails, createdAt, updatedAt, __v });
    }
    const { _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, profileImage, skills, experienceYears, isOnline, documents, rating, totalReviews, availability, serviceArea, location, walletBalance, status, paymentMethods, createdAt, updatedAt, __v } = userObj;
    return res.json({ _id, email, firstName, lastName, phone, role, isVerified, isEmailVerified, isPhoneVerified, isIdentityVerified, profileImage, skills, experienceYears, isOnline, documents, rating, totalReviews, availability, serviceArea, location, walletBalance, status, paymentMethods, createdAt, updatedAt, __v });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {};


