const User = require('../models/User');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile (role-based field whitelist)
exports.updateUser = async (req, res) => {
  try {
    const body = req.body || {};
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user is updating their own profile or is an admin
    if (user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Always-allowed common fields
    if (typeof body.firstName === 'string') user.firstName = body.firstName;
    if (typeof body.lastName === 'string') user.lastName = body.lastName;
    if (typeof body.phone === 'string') user.phone = body.phone;
    if (body.location) user.location = body.location;
    if (typeof body.profileImage === 'string') user.profileImage = body.profileImage;

    // Role-based fields
    if (user.role === 'customer') {
      if (body.customerDetails) {
        user.customerDetails = {
          favouriteProviders: body.customerDetails.favouriteProviders || user.customerDetails?.favouriteProviders,
          totalBookings: typeof body.customerDetails.totalBookings === 'number' ? body.customerDetails.totalBookings : (user.customerDetails?.totalBookings || 0),
          ratingGivenAvg: typeof body.customerDetails.ratingGivenAvg === 'number' ? body.customerDetails.ratingGivenAvg : (user.customerDetails?.ratingGivenAvg || 0)
        };
      }
      // Explicitly ignore provider-only fields
    } else if (user.role === 'service provider') {
      if (Array.isArray(body.skills)) user.skills = body.skills;
      if (typeof body.experienceYears === 'number') user.experienceYears = body.experienceYears;
      if (typeof body.isOnline === 'boolean') user.isOnline = body.isOnline;
      if (body.availability) user.availability = body.availability;
      if (body.serviceArea) user.serviceArea = body.serviceArea;
      // documents are managed via upload endpoints
    }

    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all providers
exports.getAllProviders = async (req, res) => {
  try {
    const providers = await User.find({ role: 'provider', isVerified: true }).select('-password');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get providers by service category
exports.getProvidersByService = async (req, res) => {
  try {
    const { serviceCategory } = req.params;
    const providers = await User.find({
      role: 'provider',
      isVerified: true,
      skills: { $in: [serviceCategory] }
    }).select('-password');

    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: verify provider account
exports.verifyProvider = async (req, res) => {
  try {
    const { userId, token } = req.body;
    const user = await User.findById(userId);
    if (!user || user.role !== 'provider') {
      return res.status(404).json({ message: 'Provider not found' });
    }
    if (!user.verification || user.verification.token !== token || (user.verification.expiresAt && user.verification.expiresAt < new Date())) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }
    user.isVerified = true;
    user.verification = undefined;
    await user.save();
    res.json({ message: 'Provider verified', user: { _id: user._id, isVerified: user.isVerified } });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export {};