import prisma from '../lib/database';
import { getBestAvailableProvider, getLocationMultiplier } from '../lib/providerMatching';
import { generateBookingReferenceAsync } from '../lib/idGenerator';
import { validateLocation, locationsAreEqual, getLocationFromRequest } from '../lib/locationUtils';
// import { syncBookingToMongo } from '../lib/mongoSync';

// Create a new booking REQUEST (Uber-style) - Automatic provider matching
// 
// Expected Payload Format:
// {
//   "serviceId": "service_id",                    // Required (or use serviceTitle + requiredSkills)
//   "date": "2025-11-15T10:00:00Z",              // Required - ISO format, must be today
//   "time": "10:00",                              // Required - time string
//   "location": {                                 // Required - device location
//     "type": "Point",
//     "coordinates": [28.0473, -26.2041],        // [longitude, latitude]
//     "address": "123 Main St, Johannesburg"
//   },
//   "notes": "Please arrive on time",             // Optional
//   "estimatedDurationMinutes": 60,               // Optional - defaults to service duration
//   "jobSize": "medium",                          // Optional - "small", "medium", "large", "custom" (default: "medium")
//   "customPrice": null                           // Optional - required if jobSize is "custom"
// }
//
// Alternative Payload (Automatic Provider Matching):
// {
//   "serviceTitle": "Plumbing Service",           // Required (or use serviceId)
//   "requiredSkills": ["plumbing", "repair"],     // Required if using serviceTitle
//   ... (same other fields)
// }
exports.createBooking = async (req: any, res: any) => {
  try {
    const { serviceTitle, serviceId, date, time, location, notes, estimatedDurationMinutes, jobSize, customPrice, requiredSkills } = req.body;

    // Get customer profile
    let customer = await prisma.customer.findUnique({
      where: { userId: req.user.id },
      include: { user: true }
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer profile not found' });
    }

    // Validate and normalize location from request (device location)
    // ALWAYS require device location in request - dynamic location is mandatory
    if (!location) {
      return res.status(400).json({ 
        message: 'Location with coordinates is required in the request. Please enable location services on your device and provide current location.' 
      });
    }

    // Validate the device location from request
    const validation = validateLocation(location);
    if (!validation.valid || !validation.normalized) {
      return res.status(400).json({ 
        message: validation.error || 'Location with valid coordinates is required. Please enable location services on your device and ensure GPS is working correctly.' 
      });
    }

    const bookingLocation = validation.normalized;
    
    // Auto-update customer's profile location with device location from request
    // This keeps the profile synchronized with the most recent device location
    const profileLoc = customer.user.location;
    if (!profileLoc || !locationsAreEqual(bookingLocation, profileLoc, 50)) {
      // Update profile with current device location (always keep profile current)
      await prisma.user.update({
        where: { id: req.user.id },
        data: { location: bookingLocation }
      });
      
      // Refresh customer data
      const updatedCustomer = await prisma.customer.findUnique({
        where: { userId: req.user.id },
        include: { user: true }
      });
      if (updatedCustomer) {
        customer = updatedCustomer;
      }
    }

    let service: any;
    let providerMatch: any = null;

    // If serviceId provided, use existing service
    if (serviceId) {
      service = await prisma.service.findUnique({
        where: { id: serviceId },
        include: { provider: { include: { user: true } } }
      });

      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }

      // Check if service is admin-approved
      if (!service.adminApproved || service.status !== 'active') {
        return res.status(400).json({ message: 'Service is not available for booking' });
      }

      // Check if assigned provider is online and available
      if (service.provider) {
        const isBusy = await prisma.booking.findFirst({
          where: {
            service: { providerId: service.provider.id },
            status: { in: ['confirmed', 'in_progress', 'pending_payment'] }
          }
        });

        if (service.provider.isOnline && !isBusy) {
          // Provider is available - use assigned provider
          providerMatch = {
            provider: service.provider,
            service: service,
            distance: 0,
            locationMultiplier: getLocationMultiplier(bookingLocation.address, bookingLocation.coordinates),
            adjustedPrice: service.price
          };
        } else {
          // Provider not available - try to find alternative, otherwise queue
          try {
            providerMatch = await getBestAvailableProvider(
              service.title,
              service.provider.skills || [],
              bookingLocation,
              service.price
            );
          } catch (error) {
            console.error('Error finding alternative provider:', error);
            // If matching fails, queue the request
            providerMatch = null;
          }
        }
      } else {
        // Service has no provider assigned - find one automatically
        try {
          providerMatch = await getBestAvailableProvider(
            service.title,
            [],
            bookingLocation,
            service.price
          );
        } catch (error) {
          console.error('Error finding provider for service:', error);
          providerMatch = null;
        }
      }
    } else if (serviceTitle) {
      // Automatic provider matching based on service title
      const skills = requiredSkills || [];
      providerMatch = await getBestAvailableProvider(
        serviceTitle,
        skills,
        bookingLocation,
        1000 // Default base price, will be adjusted
      );

      if (!providerMatch) {
        // No providers available - add to queue
        return res.status(202).json({
          message: 'No providers available at this time. Your request has been queued.',
          queued: true,
          estimatedWaitTime: '5-15 minutes',
          nextStep: 'wait_for_provider'
        });
      }

      // Find or create service for the matched provider
      service = providerMatch.service;
    } else {
      return res.status(400).json({ 
        message: 'Either serviceId or serviceTitle with requiredSkills must be provided' 
      });
    }

    // If no provider match found, queue the request
    if (!providerMatch) {
      return res.status(202).json({
        message: 'No providers available at this time. Your request has been queued.',
        queued: true,
        estimatedWaitTime: '5-15 minutes',
        nextStep: 'wait_for_provider'
      });
    }

    // Job size calculation
    const jobSizeMultipliers: any = {
      small: 1.0,
      medium: 1.5,
      large: 2.0,
      custom: 1.0
    };

    // Use location-adjusted price from provider matching
    const basePrice = providerMatch.adjustedPrice || service.price;
    const selectedJobSize = jobSize || 'medium';
    const multiplier = jobSizeMultipliers[selectedJobSize] || 1.0;
    const calculatedPrice = selectedJobSize === 'custom' && customPrice 
      ? parseFloat(customPrice) 
      : basePrice * multiplier;

    // Validate date - must be same day (immediate service like Uber)
    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const bookingDateOnly = new Date(bookingDate);
    bookingDateOnly.setHours(0, 0, 0, 0); // Start of booking date
    
    // Check if booking date is today
    if (bookingDateOnly.getTime() !== today.getTime()) {
      return res.status(400).json({ 
        message: 'Bookings must be for today only. All services are immediate attention like Uber - no future bookings allowed.',
        receivedDate: bookingDate.toISOString(),
        today: today.toISOString()
      });
    }

    // Check if booking time is in the past (for today's bookings)
    const bookingDateTime = new Date(date);
    const now = new Date();
    if (bookingDateTime < now) {
      return res.status(400).json({ 
        message: 'Booking time cannot be in the past. Please select a current or future time for today.',
        receivedTime: bookingDateTime.toISOString(),
        currentTime: now.toISOString()
      });
    }

    // Create booking request - Customer must pay first before provider allocation
    // Status: pending_payment (waiting for payment)
    // Date is set to current time for immediate service
    const referenceNumber = await generateBookingReferenceAsync();
    const booking = await prisma.booking.create({
      data: {
        referenceNumber, // SPANA-BK-000001
        customerId: customer.id,
        serviceId: service.id,
        date: bookingDateTime, // Use validated date/time
        time,
        location: bookingLocation, // Use validated device location
        notes,
        estimatedDurationMinutes: estimatedDurationMinutes || service.duration,
        jobSize: selectedJobSize,
        basePrice: basePrice,
        jobSizeMultiplier: multiplier,
        calculatedPrice: calculatedPrice,
        status: 'pending_payment', // NEW: Waiting for payment
        requestStatus: 'pending', // Will be sent to providers after payment
        paymentStatus: 'pending', // Payment required
        locationMultiplier: providerMatch.locationMultiplier, // Store location multiplier
        providerDistance: providerMatch.distance // Store distance to provider
      },
      include: {
        service: {
          include: {
            provider: {
              include: { user: true }
            }
          }
        },
        customer: {
          include: { user: true }
        }
      }
    });

    // Create workflow for booking
    try {
      const workflowClient = require('../lib/workflowClient');
      const defaultSteps = [
        { name: 'Booking Request Created', status: 'completed' },
        { name: 'Provider Assigned', status: 'pending' },
        { name: 'Payment Received', status: 'pending' },
        { name: 'Provider En Route', status: 'pending' },
        { name: 'Service In Progress', status: 'pending' },
        { name: 'Service Completed', status: 'pending' }
      ];
      await workflowClient.createWorkflowForBooking(booking.id, defaultSteps).catch(() => {});
    } catch (_) {}

    // Notify matched provider via socket
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io && providerMatch && providerMatch.provider && providerMatch.provider.user) {
        io.to(providerMatch.provider.user.id).emit('new-booking-request', {
          bookingId: booking.id,
          service: service.title,
          customer: `${req.user.firstName} ${req.user.lastName}`,
          date: booking.date,
          time: booking.time,
          location: booking.location,
          distance: providerMatch.distance,
          adjustedPrice: calculatedPrice
        });
      }
    } catch (_) {}

      await prisma.activity.create({ 
        data: { 
          userId: req.user.id, 
        actionType: 'booking_request_created', 
          contentId: booking.id, 
          contentModel: 'Booking' 
        } 
      });

    // For customers: Remove provider details until booking is accepted (Uber-style)
    let responseBooking = booking;
    if (req.user.role === 'customer' && (booking.service as any).provider) {
      const { provider, ...serviceWithoutProvider } = (booking.service as any);
      responseBooking = {
        ...booking,
        service: serviceWithoutProvider
      } as any;
    }

    res.status(201).json({
      message: 'Booking created. Provider matched and notified. Payment required before service starts.',
      booking: responseBooking,
      providerMatched: true,
      providerDistance: providerMatch.distance,
      locationMultiplier: providerMatch.locationMultiplier,
      paymentRequired: true,
      amount: calculatedPrice,
      nextStep: 'payment'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Accept booking request
exports.acceptBookingRequest = async (req: any, res: any) => {
  try {
    const { id: bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
        customer: { include: { user: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify provider owns the service
    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId },
      include: {
        provider: true
      }
    });

    if (!service || service.provider.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if payment has been made (customer pays first)
    if (booking.paymentStatus !== 'paid_to_escrow') {
      return res.status(400).json({ 
        message: 'Payment must be completed before provider can accept booking',
        paymentRequired: true
      });
    }

    if (booking.requestStatus !== 'pending') {
      return res.status(400).json({ message: 'Booking request already processed' });
    }

    // Generate provider chat token when provider accepts
    const { generateChatToken } = require('../lib/chatTokens');
    const providerChatToken = generateChatToken(bookingId, req.user.id, 'service_provider');

    // Update booking to accepted and generate provider chat token
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        requestStatus: 'accepted',
        providerAcceptedAt: new Date(),
        status: 'confirmed', // Payment already received, ready to start
        providerChatToken // Generate token when provider accepts
      },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
        customer: { include: { user: true } }
      }
    });

    // Update workflow: Provider Assigned
    try {
      const workflowController = require('../controllers/serviceWorkflowController');
      await workflowController.updateWorkflowStepByName(bookingId, 'Provider Assigned', 'completed', 'Provider accepted the booking request');
    } catch (_) {}

    // Create chatroom (socket room) - automatically available via booking room
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        // Notify customer with provider chat token (customer will get token after payment)
        io.to(booking.customer.user.id).emit('booking-accepted', {
          bookingId: booking.id,
          message: 'Provider has accepted your booking request',
          providerChatToken: updatedBooking.providerChatToken // Provider token generated
        });
        
        // Notify provider with their chat token
        io.to(req.user.id).emit('booking-accepted-provider', {
          bookingId: booking.id,
          message: 'You have accepted the booking request',
          chatToken: updatedBooking.providerChatToken, // Provider gets token when accepting
          waitingForPayment: !updatedBooking.customerChatToken // Waiting for customer payment
        });
        
        // Activate chat if both tokens exist (payment already done)
        if (updatedBooking.customerChatToken && updatedBooking.providerChatToken) {
          await prisma.booking.update({
            where: { id: bookingId },
            data: { chatActive: true }
          });
          
          io.to(`booking:${bookingId}`).emit('chatroom-ready', { 
            bookingId,
            chatActive: true 
          });
        }
      }
    } catch (_) {}

    await prisma.activity.create({
      data: {
        userId: req.user.id,
        actionType: 'booking_accepted',
        contentId: bookingId,
        contentModel: 'Booking'
      }
    });

    res.json({
      message: 'Booking request accepted. Customer can now proceed with payment.',
      booking: updatedBooking
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Decline booking request
exports.declineBookingRequest = async (req: any, res: any) => {
  try {
    const { id: bookingId } = req.params;
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
        customer: { include: { user: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId },
      include: {
        provider: true
      }
    });

    if (!service || service.provider.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (booking.requestStatus !== 'pending') {
      return res.status(400).json({ message: 'Booking request already processed' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        requestStatus: 'declined',
        providerDeclinedAt: new Date(),
        declineReason: reason,
        status: 'cancelled'
      }
    });

    // Notify customer
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer.user.id).emit('booking-declined', {
          bookingId: booking.id,
          reason: reason || 'Provider declined the booking request'
        });
      }
    } catch (_) {}

    await prisma.activity.create({
      data: {
        userId: req.user.id,
        actionType: 'booking_declined',
        contentId: bookingId,
        contentModel: 'Booking',
        details: { reason }
      }
    });

    res.json({
      message: 'Booking request declined',
      booking: updatedBooking
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Start booking (begin work) - Requires proximity check
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
    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId },
      include: { provider: true }
    });
    if (!service || service.provider.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if booking is accepted
    if (booking.requestStatus !== 'accepted') {
      return res.status(400).json({ message: 'Booking must be accepted first' });
    }

    // Check if payment is made
    if (booking.paymentStatus !== 'paid_to_escrow') {
      return res.status(400).json({ message: 'Payment must be completed before starting job' });
    }

    // Check proximity requirement (must be within 2 meters and 5 minutes passed)
    if (!booking.canStartJob) {
      return res.status(400).json({ 
        message: 'Cannot start job yet. Provider and customer must be within 2 meters for at least 5 minutes.',
        proximityDetected: booking.proximityDetected,
        canStartJob: booking.canStartJob
      });
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

    // Update workflow: Service In Progress
    try {
      const workflowController = require('../controllers/serviceWorkflowController');
      await workflowController.updateWorkflowStepByName(booking.id, 'Provider En Route', 'completed', 'Provider arrived and job started');
      await workflowController.updateWorkflowStepByName(booking.id, 'Service In Progress', 'in_progress', 'Service work has begun');
    } catch (_) {}

    // Emit socket event
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer.userId).emit('booking-updated', booking);
        if (service && service.provider) {
          const providerUser = await prisma.serviceProvider.findUnique({
            where: { id: service.providerId },
            select: { userId: true }
          });
          if (providerUser) {
            io.to(providerUser.userId).emit('booking-updated', booking);
          }
        }
      }
    } catch (_) {}

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Complete booking (end work) and compute SLA - Release escrow funds
exports.completeBooking = async (req: any, res: any) => {
  try {
    let booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
        customer: {
          include: {
            user: true
          }
        },
        payment: true
      }
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only provider of the service can complete
    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId },
      include: { provider: true }
    });
    if (!service || service.provider.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Calculate actual duration and SLA
    if (!booking.startedAt) {
      return res.status(400).json({ message: 'Booking must be started before completion' });
    }

    const completedAt = new Date();
    const actualDurationMinutes = Math.ceil((completedAt.getTime() - booking.startedAt.getTime()) / 60000);
    const slaBreached = booking.estimatedDurationMinutes > 0 && actualDurationMinutes > booking.estimatedDurationMinutes;
    
    // Calculate SLA penalty (10% of calculated price per hour over SLA)
    let slaPenaltyAmount = 0;
    if (slaBreached && booking.calculatedPrice) {
      const hoursOver = (actualDurationMinutes - booking.estimatedDurationMinutes) / 60;
      const penaltyRate = 0.10; // 10% per hour
      slaPenaltyAmount = booking.calculatedPrice * penaltyRate * hoursOver;
    }

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'completed',
        completedAt: completedAt,
        actualDurationMinutes: actualDurationMinutes,
        slaBreached: slaBreached,
        slaPenaltyAmount: slaPenaltyAmount,
        chatActive: false, // Terminate chat when job is done
        chatTerminatedAt: new Date() // Mark chat as terminated
      },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
        customer: {
          include: {
            user: true
          }
        },
        payment: true
      }
    });

    // Update workflow: Service Completed
    try {
      const workflowController = require('../controllers/serviceWorkflowController');
      await workflowController.updateWorkflowStepByName(booking.id, 'Service In Progress', 'completed', 'Service work completed');
      await workflowController.updateWorkflowStepByName(booking.id, 'Service Completed', 'completed', `Service completed${slaBreached ? ' (SLA breached)' : ''}`);
    } catch (_) {}

    // Release escrow funds to provider
    // Fetch payment separately to ensure we have the latest escrow status
    const payment = await prisma.payment.findFirst({
      where: { bookingId: booking.id }
    });
    if (payment && payment.escrowStatus === 'held') {
      await releaseEscrowFunds(payment.id, booking.id);
    }
    try {
      await prisma.activity.create({ 
        data: { 
          userId: req.user.id, 
          actionType: 'booking_update', 
          contentId: booking.id, 
          contentModel: 'Booking', 
          details: { status: 'completed', slaBreached: booking.slaBreached, slaPenaltyAmount } 
        } 
      });
    } catch (_) {}

    // Refresh booking to get latest payment status after escrow release
    const finalBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
        customer: {
          include: {
            user: true
          }
        },
        payment: true
      }
    });

    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer.userId).emit('booking-updated', finalBooking || booking);
        if (service && service.provider) {
          const providerUser = await prisma.serviceProvider.findUnique({
            where: { id: service.providerId },
            select: { userId: true }
          });
          if (providerUser) {
            io.to(providerUser.userId).emit('booking-updated', finalBooking || booking);
          }
        }
      }
    } catch (_) {}
    res.json(finalBooking || booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Live location updates with proximity detection
// Always uses device location dynamically
exports.updateLocation = async (req: any, res: any) => {
  try {
    const { role } = req.user;
    const { coordinates } = req.body; // [lng, lat] - device location
    
    // Validate coordinates from device
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ 
        message: 'Valid coordinates are required. Please ensure location services are enabled on your device.' 
      });
    }
    
    // Normalize coordinates to ensure [lng, lat] format
    const { normalizeCoordinates } = require('../lib/locationUtils');
    let [lng, lat] = normalizeCoordinates(coordinates);
    
    // Validate coordinate ranges
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({ 
        message: 'Invalid coordinates. Longitude must be -180 to 180, Latitude must be -90 to 90.' 
      });
    }
    
    // Check for invalid default coordinates (0,0)
    if (lng === 0 && lat === 0) {
      return res.status(400).json({ 
        message: 'Invalid coordinates detected. Please ensure GPS is working correctly on your device.' 
      });
    }
    
    // Use normalized coordinates (always [lng, lat] format)
    const normalizedCoords = [lng, lat];
    
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

    const updateData: any = {};

    // Only the customer or the service provider for this booking can update
    // Always use device location (most current)
    if (role === 'customer') {
      if (booking.customer.userId !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
      updateData.customerLiveLocation = { type: 'Point', coordinates: normalizedCoords };
    } else if (role === 'service_provider') {
      const service = await prisma.service.findUnique({
        where: { id: booking.serviceId },
        include: { provider: true }
      });
      if (!service || service.provider.userId !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
      updateData.providerLiveLocation = { type: 'Point', coordinates: normalizedCoords };
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update booking with new location first
    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: updateData,
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    });

    // Now check proximity with the updated locations
    const providerLoc = updatedBooking.providerLiveLocation as any;
    const customerLoc = updatedBooking.customerLiveLocation as any;
    let finalDistance = updatedBooking.distanceApart;
    let finalProximityDetected = updatedBooking.proximityDetected;
    let finalCanStartJob = updatedBooking.canStartJob;

    if (providerLoc && customerLoc && providerLoc.coordinates && customerLoc.coordinates) {
      const [providerLng, providerLat] = providerLoc.coordinates;
      const [customerLng, customerLat] = customerLoc.coordinates;
      
      const distance = calculateDistance(providerLat, providerLng, customerLat, customerLng);
      finalDistance = distance;
      
      // Update distance and proximity status
      const proximityUpdate: any = { distanceApart: distance };

      // If within 2 meters (arm's length)
      if (distance <= 2) {
        if (!updatedBooking.proximityDetected) {
          proximityUpdate.proximityDetected = true;
          proximityUpdate.proximityDetectedAt = new Date();
          proximityUpdate.proximityStartTime = new Date();
          finalProximityDetected = true;
        } else if (updatedBooking.proximityStartTime) {
          // Check if 5 minutes have passed since first proximity detection
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          if (new Date(updatedBooking.proximityStartTime) <= fiveMinutesAgo) {
            proximityUpdate.canStartJob = true;
            finalCanStartJob = true;
          }
        }
      } else {
        // If they move apart, reset proximity
        if (updatedBooking.proximityDetected && distance > 5) {
          proximityUpdate.proximityDetected = false;
          proximityUpdate.proximityDetectedAt = null;
          proximityUpdate.proximityStartTime = null;
          proximityUpdate.canStartJob = false;
          finalProximityDetected = false;
          finalCanStartJob = false;
        }
      }

      // Update booking with proximity data if needed
      if (Object.keys(proximityUpdate).length > 1) {
        const finalUpdated = await prisma.booking.update({
          where: { id: booking.id },
          data: proximityUpdate
        });
        finalProximityDetected = finalUpdated.proximityDetected || false;
        finalCanStartJob = finalUpdated.canStartJob || false;
      }
    }

    // Get service for socket emission (with provider)
    const serviceForEmit = await prisma.service.findUnique({
      where: { id: booking.serviceId },
      include: { provider: true }
    });

    // Update workflow when proximity detected
    if (finalProximityDetected && !booking.proximityDetected) {
      try {
        const workflowController = require('../controllers/serviceWorkflowController');
        await workflowController.updateWorkflowStepByName(booking.id, 'Provider En Route', 'in_progress', 'Provider is in close proximity');
      } catch (_) {}
    }

    // Emit socket event for proximity updates
    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer.userId).emit('location-updated', {
          bookingId: booking.id,
          distance: finalDistance,
          proximityDetected: finalProximityDetected,
          canStartJob: finalCanStartJob
        });
        if (serviceForEmit && serviceForEmit.provider) {
          io.to(serviceForEmit.provider.userId).emit('location-updated', {
            bookingId: booking.id,
            distance: finalDistance,
            proximityDetected: finalProximityDetected,
            canStartJob: finalCanStartJob
          });
        }
      }
    } catch (_) {}

    res.json({ 
      message: 'Location updated',
      distance: finalDistance,
      proximityDetected: finalProximityDetected,
      canStartJob: finalCanStartJob
    });
  } catch (error) {
    console.error('Update location error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all bookings for a user
exports.getUserBookings = async (req: any, res: any) => {
  try {
    let bookings;
    if (req.user.role === 'customer') {
      // Get customer record for the user
      const customer = await prisma.customer.findUnique({
        where: { userId: req.user.id }
      });
      if (!customer) {
        return res.json([]);
      }
      bookings = await prisma.booking.findMany({ 
        where: { customerId: customer.id },
        include: {
          service: {
            include: {
              provider: {
                include: { user: true }
              }
            }
          },
          customer: {
            include: {
              user: true
            }
          },
          payment: true
        }
      });
      
      // For customers: Only show provider details if booking is accepted (Uber-style)
      bookings = bookings.map((booking: any) => {
        if (booking.requestStatus !== 'accepted' && booking.service?.provider) {
          const { provider, ...serviceWithoutProvider } = booking.service;
          booking.service = serviceWithoutProvider;
        }
        return booking;
      });
    } else if (req.user.role === 'service_provider') {
      // First, get the ServiceProvider record for this user
      const serviceProvider = await prisma.serviceProvider.findUnique({
        where: { userId: req.user.id }
      });
      if (!serviceProvider) {
        return res.json([]);
      }
      // Get the services offered by the provider
      const services = await prisma.service.findMany({ 
        where: { providerId: serviceProvider.id },
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
        service: {
          include: {
            provider: {
              include: { user: true }
            }
          }
        },
        customer: {
          include: {
            user: true
          }
        },
        payment: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if the user is involved in the booking or is an admin
    if (req.user.role === 'admin') {
      // Admins can see all bookings with full details
    } else if (req.user.role === 'customer') {
      if (booking.customer.userId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to view this booking' });
      }
      // For customers: Only show provider details if booking is accepted (Uber-style)
      if (booking.requestStatus !== 'accepted' && (booking.service as any).provider) {
        const { provider, ...serviceWithoutProvider } = booking.service as any;
        (booking as any).service = serviceWithoutProvider;
      }
    } else if (req.user.role === 'service_provider') {
      // Service provider can only see bookings for their services
      if (!(booking.service as any).provider || (booking.service as any).provider.userId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to view this booking' });
      }
    } else {
      return res.status(403).json({ message: 'Not authorized' });
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
    if (req.user.role === 'customer' && booking.customer.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'service_provider') {
      // Service is already included in the booking query
      const service = await prisma.service.findUnique({
        where: { id: booking.serviceId },
        include: { provider: true }
      });
      if (!service || service.provider.userId !== req.user.id) {
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
    const { reason } = req.body;
    let booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        },
        payment: true
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role === 'customer' && booking.customer.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'service_provider') {
      // Service is already included in the booking query
      const service = await prisma.service.findUnique({
        where: { id: booking.serviceId },
        include: { provider: true }
      });
      if (!service || service.provider.userId !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed booking' });
    }

    // Process refund if payment was made
    let refundInfo = null;
    if (booking.payment && booking.payment.status === 'completed' && booking.payment.escrowStatus === 'held') {
      // Update payment to refunded
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: 'refunded',
          escrowStatus: 'refunded'
        }
      });

      refundInfo = {
        status: 'processing',
        amount: booking.payment.amount,
        refundMethod: 'original_payment_method',
        estimatedTime: '3-5 business days'
      };
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { 
        status: 'cancelled',
        paymentStatus: refundInfo ? 'refunded' : booking.paymentStatus,
        declineReason: reason // Using declineReason field from schema
      },
      include: {
        service: true,
        customer: {
          include: {
            user: true
          }
        },
        payment: true
      }
    });
    
    booking = updatedBooking;
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

    // Get service for socket emission (with provider)
    const serviceForEmit = await prisma.service.findUnique({
      where: { id: booking.serviceId },
      include: { provider: true }
    });

    try {
      const app = require('../server');
      const io = app.get && app.get('io');
      if (io) {
        io.to(booking.customer.userId).emit('booking-updated', booking);
        if (serviceForEmit && serviceForEmit.provider) {
          io.to(serviceForEmit.provider.userId).emit('booking-updated', booking);
        }
      }
    } catch (_) {}

    res.json({
      message: 'Booking cancelled. Refund processing.',
      booking: updatedBooking,
      refund: refundInfo
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Rate a booking (customer rates provider)
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

    if (booking.customer.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed bookings' });
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

    // Update provider's overall rating
    const service = await prisma.service.findUnique({
      where: { id: booking.serviceId },
      include: { provider: true }
    });
    
    if (service && service.provider) {
      const serviceProvider = service.provider;

      if (serviceProvider) {
        // Recalculate average rating from all bookings for this provider's services
        const providerServices = await prisma.service.findMany({
          where: { providerId: serviceProvider.id },
          select: { id: true }
        });
        const serviceIds = providerServices.map(s => s.id);

    const bookings = await prisma.booking.findMany({ 
      where: { 
            serviceId: { in: serviceIds },
            rating: { not: null },
            status: 'completed'
      } 
    });
    const totalRatings = bookings.reduce((sum: number, b: any) => sum + (b.rating || 0), 0);
    const averageRating = bookings.length > 0 ? totalRatings / bookings.length : 0;
    
      await prisma.serviceProvider.update({
          where: { id: serviceProvider.id },
        data: {
          rating: averageRating,
          totalReviews: bookings.length
        }
      });
      }
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Provider rates customer
exports.rateCustomer = async (req: any, res: any) => {
  try {
    const { id: bookingId } = req.params;
    const { customerRating, customerReview } = req.body;

    if (!customerRating || customerRating < 1 || customerRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
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

    // Verify provider owns the service
    if (booking.service.provider.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate customers for completed bookings' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { customerRating, customerReview },
      include: {
        service: {
          include: {
            provider: { include: { user: true } }
          }
        },
        customer: {
          include: {
            user: true
          }
        }
      }
    });

    // Update customer's average rating received
    const customer = await prisma.customer.findUnique({
      where: { id: booking.customerId }
    });

    if (customer) {
      const customerBookings = await prisma.booking.findMany({
        where: {
          customerId: customer.id,
          customerRating: { not: null },
          status: 'completed'
        }
      });

      const totalRatings = customerBookings.reduce((sum: number, b: any) => sum + (b.customerRating || 0), 0);
      const averageRating = customerBookings.length > 0 ? totalRatings / customerBookings.length : 0;

      // Update customer's rating received average
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          ratingReceivedAvg: averageRating
        }
      });
    }

    await prisma.activity.create({
      data: {
        userId: req.user.id,
        actionType: 'customer_rated',
        contentId: bookingId,
        contentModel: 'Booking',
        details: { customerRating }
      }
    });

    res.json({
      message: 'Customer rated successfully',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Rate customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to release escrow funds
async function releaseEscrowFunds(paymentId: string, bookingId: string) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { service: true } } }
    });

    if (!payment || payment.escrowStatus !== 'held') return;

    // Get SLA penalty from booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { slaPenaltyAmount: true }
    });
    const slaPenaltyAmount = booking?.slaPenaltyAmount || 0;

    // Calculate payout (tip goes 100% to provider, commission only on base amount, SLA penalty deducted)
    const commissionRate = payment.commissionRate || 0.15;
    const tipAmount = payment.tipAmount || 0;
    const baseAmount = payment.amount - tipAmount;
    const commissionAmount = baseAmount * commissionRate; // Commission only on service, not tip
    
    // Deduct both commission AND SLA penalty from provider payout
    // Ensure provider payout never goes negative (minimum R0)
    const providerPayout = Math.max(0, payment.amount - commissionAmount - slaPenaltyAmount);

    // Update payment (include SLA penalty for tracking)
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        escrowStatus: 'released',
        commissionAmount,
        providerPayout,
        status: 'completed'
        // Note: SLA penalty stored in booking.slaPenaltyAmount, not payment
      }
    });

    // Update booking (include SLA penalty in payout amount)
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'released_to_provider',
        commissionAmount,
        providerPayoutAmount: providerPayout
        // slaPenaltyAmount already stored in booking
      }
    });

    // Update provider wallet
    const service = await prisma.service.findUnique({
      where: { id: payment.booking.serviceId },
      include: { provider: { include: { user: true } } }
    });

    if (service && service.provider) {
      await prisma.user.update({
        where: { id: service.provider.userId },
        data: {
          walletBalance: { increment: providerPayout }
        }
      });
    }

    // Update Spana wallet
    let wallet = await prisma.spanaWallet.findFirst();
    if (!wallet) {
      wallet = await prisma.spanaWallet.create({
        data: {
          totalHeld: 0,
          totalReleased: 0,
          totalCommission: 0
        }
      });
    }

    await prisma.spanaWallet.update({
      where: { id: wallet.id },
      data: {
        totalHeld: { decrement: payment.amount },
        totalReleased: { increment: providerPayout },
        totalCommission: { increment: commissionAmount }
        // Note: SLA penalty stays in escrow (customer compensation), not added to platform revenue
      }
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'release',
        amount: providerPayout,
        bookingId,
        paymentId,
        description: `Released to provider after service completion${slaPenaltyAmount > 0 ? ` (SLA penalty: R${slaPenaltyAmount.toFixed(2)} deducted)` : ''}`
      }
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'commission',
        amount: commissionAmount,
        bookingId,
        paymentId,
        description: `Commission earned`
      }
    });

    // Create transaction record for SLA penalty (if applicable)
    if (slaPenaltyAmount > 0) {
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'sla_penalty',
          amount: slaPenaltyAmount,
          bookingId,
          paymentId,
          description: `SLA penalty deducted from provider (held for customer compensation)`
        }
      });
    }
  } catch (error) {
    console.error('Error releasing escrow funds:', error);
  }
}

export {};


