import prisma from '../lib/database';
// import { syncBookingToMongo } from '../lib/mongoSync';

// Create a new booking
exports.createBooking = async (req: any, res: any) => {
  try {
    const { serviceId, date, time, location, notes, estimatedDurationMinutes } = req.body;

    const booking = await prisma.booking.create({
      data: {
        customerId: req.user.id,
        serviceId,
        date: new Date(date),
        time,
        location,
        notes,
        estimatedDurationMinutes
      },
      include: {
        service: {
          select: {
            id: true,
            title: true,
            price: true,
            providerId: true
          }
        },
        customer: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true
              }
            }
          }
        }
      }
    });

    try {
      await prisma.activity.create({ 
        data: { 
          userId: req.user.id, 
          actionType: 'booking_create', 
          contentId: booking.id, 
          contentModel: 'Booking' 
        } 
      });
    } catch (_) {}

    // Sync to MongoDB backup
    try {
      // syncBookingToMongo(booking).catch(() => {});
    } catch (_) {}

    // Emit socket event to involved parties if socket.io is available
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(req.user.id).emit('booking-created', booking);
        // notify provider's room if service provider known
        if (booking.service && booking.service.providerId) {
          io.to(booking.service.providerId).emit('booking-created', booking);
        }
      }
    } catch (_) {}

    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Start booking (begin work)
exports.startBooking = async (req: any, res: any) => {
  try {
    let booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only provider of the service can start
    // Service is already included in the booking query
    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId }
    });
    if (!service || service.providerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'in_progress',
        startedAt: new Date()
      },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });
    try {
      await prisma.activity.create({ 
        data: { 
          userId: req.user.id, 
          actionType: 'booking_update', 
          contentId: booking.id, 
          contentModel: 'Booking', 
          details: { status: 'in_progress' } 
        } 
      });
    } catch (_) {}

    // Emit socket event
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer.id).emit('booking-updated', booking);
        if (booking.service && booking.service.providerId) io.to(booking.service.providerId).emit('booking-updated', booking);
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
    let booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only provider of the service can complete
    // Service is already included in the booking query
    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId }
    });
    if (!service || service.providerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        slaBreached: booking.startedAt && booking.estimatedDurationMinutes > 0 ? 
          Math.ceil((new Date().getTime() - booking.startedAt.getTime()) / 60000) > booking.estimatedDurationMinutes : 
          false
      },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });
    try {
      await prisma.activity.create({ 
        data: { 
          userId: req.user.id, 
          actionType: 'booking_update', 
          contentId: booking.id, 
          contentModel: 'Booking', 
          details: { status: 'completed', slaBreached: booking.slaBreached } 
        } 
      });
    } catch (_) {}

    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer.id).emit('booking-updated', booking);
        if (booking.service && booking.service.providerId) io.to(booking.service.providerId).emit('booking-updated', booking);
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
    let booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only the customer or the service provider for this booking can update
    if (role === 'customer') {
      if (booking.customer.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
      booking.customerLiveLocation = { type: 'Point', coordinates };
    } else if (role === 'service provider') {
      // Service is already included in the booking query
      const service = await prisma.service.findUnique({
      where: { id: booking.serviceId }
    });
      if (!service || service.providerId !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
      booking.providerLiveLocation = { type: 'Point', coordinates };
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Booking is already updated via Prisma, no need to save
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
      bookings = await prisma.booking.findMany({ 
        where: { customerId: req.user.id },
        include: {
          service: true,
          customer: {
            include: {
              user: true
            }
          }
        }
      });
    } else if (req.user.role === 'service_provider') {
      // First, get the services offered by the provider
      const services = await prisma.service.findMany({ 
        where: { providerId: req.user.id },
        select: { id: true }
      });
      const serviceIds = services.map(service => service.id);

      bookings = await prisma.booking.findMany({ 
        where: { serviceId: { in: serviceIds } },
        include: {
          service: true,
          customer: {
            include: {
              user: true
            }
          }
        }
      });
    } else {
      // Admin can see all bookings
      bookings = await prisma.booking.findMany({
        include: {
          service: true,
          customer: {
            include: {
              user: true
            }
          }
        }
      });
    }

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get booking by ID
exports.getBookingById = async (req: any, res: any) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if the user is involved in the booking or is an admin
    if (req.user.role === 'customer' && booking.customer.id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'provider') {
      // Service is already included in the booking query
      const service = await prisma.service.findUnique({
        where: { id: booking.serviceId }
      });
      if (service?.providerId !== req.user.id) {
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
    let booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role === 'customer' && booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'provider') {
      // Service is already included in the booking query
      const service = await prisma.service.findUnique({
      where: { id: booking.serviceId }
    });
      if (service?.providerId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });
    try {
      await prisma.activity.create({ 
        data: { 
          userId: req.user.id, 
          actionType: 'booking_update', 
          contentId: booking.id, 
          contentModel: 'Booking', 
          details: { status } 
        } 
      });
    } catch (_) {}


    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Cancel booking
exports.cancelBooking = async (req: any, res: any) => {
  try {
    let booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role === 'customer' && booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'provider') {
      // Service is already included in the booking query
      const service = await prisma.service.findUnique({
      where: { id: booking.serviceId }
    });
      if (service?.providerId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled' },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });
    try {
      await prisma.activity.create({ 
        data: { 
          userId: req.user.id, 
          actionType: 'booking_cancel', 
          contentId: booking.id, 
          contentModel: 'Booking' 
        } 
      });
    } catch (_) {}

    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer.id).emit('booking-updated', booking);
        if (booking.service && booking.service.providerId) io.to(booking.service.providerId).emit('booking-updated', booking);
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
    let booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { rating, review },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });

    // Update provider's overall rating (simplified)
    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId }
    });
    
    // Get the provider user
    const serviceProvider = await prisma.serviceProvider.findUnique({
      where: { userId: service?.providerId || '' },
      include: {
        user: true
      }
    });
    const provider = serviceProvider?.user;

    // Recalculate average rating (this is a simplified version)
    const bookings = await prisma.booking.findMany({ 
      where: { 
        serviceId: service.id, 
        rating: { not: null } 
      } 
    });
    const totalRatings = bookings.reduce((sum: number, b: any) => sum + (b.rating || 0), 0);
    const averageRating = bookings.length > 0 ? totalRatings / bookings.length : 0;
    
    if (provider) {
      await prisma.serviceProvider.update({
        where: { userId: provider.id },
        data: {
          rating: averageRating,
          totalReviews: bookings.length
        }
      });
    }


    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export {};


