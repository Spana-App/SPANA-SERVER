const Booking = require('../models/Booking');
const Activity = require('../models/Activity');

// Create a new booking
exports.createBooking = async (req: any, res: any) => {
  try {
    const { serviceId, date, time, location, notes, estimatedDurationMinutes } = req.body;

    const booking = new Booking({
      customer: req.user.id,
      service: serviceId,
      date,
      time,
      location,
      notes,
      estimatedDurationMinutes
    });

    await booking.save();
    try {
      await Activity.create({ userId: req.user.id, actionType: 'booking_create', contentId: booking._id, contentModel: 'Booking' });
    } catch (_) {}
    // Emit socket event to involved parties if socket.io is available
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(req.user.id).emit('booking-created', booking);
        // notify provider's room if service provider known
        const Service = require('../models/Service');
        const service = await Service.findById(serviceId);
        if (service && service.provider) io.to(service.provider.toString()).emit('booking-created', booking);
      }
    } catch (_) {}
    await booking.populate('service', 'title price provider');
    await booking.populate('customer', 'firstName lastName phone');
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Start booking (begin work)
exports.startBooking = async (req: any, res: any) => {
  try {
    let booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only provider of the service can start
    const Service = require('../models/Service');
    const service = await Service.findById(booking.service);
    if (!service || service.provider.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.status = 'in_progress';
    booking.startedAt = new Date();
    await booking.save();
    try {
      await Activity.create({ userId: req.user.id, actionType: 'booking_update', contentId: booking._id, contentModel: 'Booking', details: { status: 'in_progress' } });
    } catch (_) {}

    await booking.populate('service', 'title price provider');
    await booking.populate('customer', 'firstName lastName phone');
    // Emit socket event
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer._id.toString()).emit('booking-updated', booking);
        if (booking.service && booking.service.provider) io.to(booking.service.provider.toString()).emit('booking-updated', booking);
      }
    } catch (_) {}

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Complete booking (end work) and compute SLA
exports.completeBooking = async (req: any, res: any) => {
  try {
    let booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only provider of the service can complete
    const Service = require('../models/Service');
    const service = await Service.findById(booking.service);
    if (!service || service.provider.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.status = 'completed';
    booking.completedAt = new Date();
    // SLA breach if duration exceeds estimate
    if (booking.startedAt && booking.estimatedDurationMinutes > 0) {
      const actualMinutes = Math.ceil((booking.completedAt - booking.startedAt) / 60000);
      booking.slaBreached = actualMinutes > booking.estimatedDurationMinutes;
    }
    await booking.save();
    try {
      await Activity.create({ userId: req.user.id, actionType: 'booking_update', contentId: booking._id, contentModel: 'Booking', details: { status: 'completed', slaBreached: booking.slaBreached } });
    } catch (_) {}

    await booking.populate('service', 'title price provider');
    await booking.populate('customer', 'firstName lastName phone');
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer._id.toString()).emit('booking-updated', booking);
        if (booking.service && booking.service.provider) io.to(booking.service.provider.toString()).emit('booking-updated', booking);
      }
    } catch (_) {}
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Live location updates
exports.updateLocation = async (req: any, res: any) => {
  try {
    const { role } = req.user;
    const { coordinates } = req.body; // [lng, lat]
    let booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only the customer or the service provider for this booking can update
    if (role === 'customer') {
      if (booking.customer.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
      booking.customerLiveLocation = { type: 'Point', coordinates };
    } else if (role === 'service provider') {
      const Service = require('../models/Service');
      const service = await Service.findById(booking.service);
      if (!service || service.provider.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
      booking.providerLiveLocation = { type: 'Point', coordinates };
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await booking.save();
    res.json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all bookings for a user
exports.getUserBookings = async (req: any, res: any) => {
  try {
    let bookings;
    if (req.user.role === 'customer') {
      bookings = await Booking.find({ customer: req.user.id })
        .populate('service', 'title price provider')
        .populate('customer', 'firstName lastName phone');
    } else if (req.user.role === 'provider') {
      // First, get the services offered by the provider
      const Service = require('../models/Service');
      const services = await Service.find({ provider: req.user.id });
      const serviceIds = services.map((service: any) => service._id);
      bookings = await Booking.find({ service: { $in: serviceIds } })
        .populate('service', 'title price provider')
        .populate('customer', 'firstName lastName phone');
    } else {
      bookings = await Booking.find()
        .populate('service', 'title price provider')
        .populate('customer', 'firstName lastName phone');
    }

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get booking by ID
exports.getBookingById = async (req: any, res: any) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('service', 'title price provider')
      .populate('customer', 'firstName lastName phone');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if the user is involved in the booking or is an admin
    if (req.user.role === 'customer' && booking.customer._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'provider') {
      const Service = require('../models/Service');
      const service = await Service.findById(booking.service._id);
      if (service.provider.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update booking status
exports.updateBookingStatus = async (req: any, res: any) => {
  try {
    const { status } = req.body;
    let booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role === 'customer' && booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'provider') {
      const Service = require('../models/Service');
      const service = await Service.findById(booking.service);
      if (service.provider.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    booking.status = status;
    await booking.save();
    try {
      await Activity.create({ userId: req.user.id, actionType: 'booking_update', contentId: booking._id, contentModel: 'Booking', details: { status } });
    } catch (_) {}

    await booking.populate('service', 'title price provider');
    await booking.populate('customer', 'firstName lastName phone');

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Cancel booking
exports.cancelBooking = async (req: any, res: any) => {
  try {
    let booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role === 'customer' && booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'provider') {
      const Service = require('../models/Service');
      const service = await Service.findById(booking.service);
      if (service.provider.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    

    booking.status = 'cancelled';
    await booking.save();
    try {
      await Activity.create({ userId: req.user.id, actionType: 'booking_cancel', contentId: booking._id, contentModel: 'Booking' });
    } catch (_) {}

    await booking.populate('service', 'title price provider');
    await booking.populate('customer', 'firstName lastName phone');
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer._id.toString()).emit('booking-updated', booking);
        if (booking.service && booking.service.provider) io.to(booking.service.provider.toString()).emit('booking-updated', booking);
      }
    } catch (_) {}
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Rate a booking
exports.rateBooking = async (req: any, res: any) => {
  try {
    const { rating, review } = req.body;
    let booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.rating = rating;
    booking.review = review;
    await booking.save();

    // Update provider's overall rating (simplified)
    const Service = require('../models/Service');
    const service = await Service.findById(booking.service);
    const providerId = service.provider;

    const User = require('../models/User');
    const provider = await User.findById(providerId);

    // Recalculate average rating (this is a simplified version)
    const bookings = await Booking.find({ service: service._id, rating: { $exists: true } });
    const totalRatings = bookings.reduce((sum: number, b: any) => sum + b.rating, 0);
    provider.rating = totalRatings / bookings.length;
    provider.totalReviews = bookings.length;
    await provider.save();

    await booking.populate('service', 'title price provider');
    await booking.populate('customer', 'firstName lastName phone');

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export {};


