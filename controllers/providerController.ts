/**
 * Provider Controller
 * Handles online/offline status and location tracking
 */

import prisma from '../lib/database';

// Set provider online/offline status
exports.setOnlineStatus = async (req: any, res: any) => {
  try {
    const { isOnline } = req.body;
    const userId = req.user.id;

    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ message: 'isOnline must be a boolean value' });
    }

    // Get provider record
    const provider = await prisma.serviceProvider.findUnique({
      where: { userId }
    });

    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    // Update online status
    const updatedProvider = await prisma.serviceProvider.update({
      where: { id: provider.id },
      data: { isOnline }
    });

    // Emit socket event for CMS/admin
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.emit('provider-status-changed', {
          providerId: provider.id,
          userId,
          isOnline,
          timestamp: new Date()
        });
      }
    } catch (_) {}

    res.json({
      message: `Provider is now ${isOnline ? 'online' : 'offline'}`,
      isOnline: updatedProvider.isOnline
    });
  } catch (error) {
    console.error('Set online status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get provider online status
exports.getOnlineStatus = async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const provider = await prisma.serviceProvider.findUnique({
      where: { userId },
      select: {
        id: true,
        isOnline: true,
        userId: true
      }
    });

    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    res.json({
      isOnline: provider.isOnline,
      providerId: provider.id
    });
  } catch (error) {
    console.error('Get online status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update provider location (for tracking)
// Accepts coordinates as query params (lng, lat) or body
exports.updateProviderLocation = async (req: any, res: any) => {
  try {
    // Get coordinates from query params or body
    const lng = parseFloat(req.query.lng || req.body.lng || req.body.coordinates?.[0]);
    const lat = parseFloat(req.query.lat || req.body.lat || req.body.coordinates?.[1]);
    const address = req.query.address || req.body.address;

    // Validate coordinates
    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ 
        message: 'Coordinates required. Provide lng and lat as query params (?lng=28.0473&lat=-26.2041) or in body.' 
      });
    }

    const userId = req.user.id;

    // Validate coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({ 
        message: 'Invalid coordinates. Longitude must be -180 to 180, latitude must be -90 to 90' 
      });
    }

    // Update user location
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        location: {
          type: 'Point',
          coordinates: [lng, lat],
          address: address || null
        }
      }
    });

    // Update provider service area center if not set
    const provider = await prisma.serviceProvider.findUnique({
      where: { userId }
    });

    if (provider && !provider.serviceAreaCenter) {
      await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: {
          serviceAreaCenter: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        }
      });
    }

    res.json({
      message: 'Location updated successfully',
      location: {
        type: 'Point',
        coordinates: [lng, lat],
        address: address || null
      }
    });
  } catch (error) {
    console.error('Update provider location error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update customer location (for tracking) - can be used by any user
// Accepts coordinates as query params (lng, lat) or body
exports.updateCustomerLocation = async (req: any, res: any) => {
  try {
    // Get coordinates from query params or body
    const lng = parseFloat(req.query.lng || req.body.lng || req.body.coordinates?.[0]);
    const lat = parseFloat(req.query.lat || req.body.lat || req.body.coordinates?.[1]);
    const address = req.query.address || req.body.address;

    // Validate coordinates
    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ 
        message: 'Coordinates required. Provide lng and lat as query params (?lng=28.0473&lat=-26.2041) or in body.' 
      });
    }

    const userId = req.user.id;

    // Validate coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({ 
        message: 'Invalid coordinates. Longitude must be -180 to 180, latitude must be -90 to 90' 
      });
    }

    // Update user location
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        location: {
          type: 'Point',
          coordinates: [lng, lat],
          address: address || null
        }
      }
    });

    res.json({
      message: 'Location updated successfully',
      location: {
        type: 'Point',
        coordinates: [lng, lat],
        address: address || null
      }
    });
  } catch (error) {
    console.error('Update customer location error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all online providers (for CMS/admin)
exports.getAllOnlineProviders = async (req: any, res: any) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const onlineProviders = await prisma.serviceProvider.findMany({
      where: {
        isOnline: true,
        applicationStatus: 'active',
        isProfileComplete: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            location: true,
            profileImage: true
          }
        },
        services: {
          where: {
            adminApproved: true,
            status: 'active'
          },
          select: {
            id: true,
            title: true,
            price: true
          }
        }
      }
    });

    res.json({
      count: onlineProviders.length,
      providers: onlineProviders
    });
  } catch (error) {
    console.error('Get online providers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
