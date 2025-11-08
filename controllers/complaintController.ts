import prisma from '../lib/database';

// Create complaint
exports.createComplaint = async (req: any, res: any) => {
  try {
    const { bookingId, serviceId, type, severity, title, description, attachments } = req.body;

    if (!bookingId || !type || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify user is involved in the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { include: { user: true } },
        service: { include: { provider: { include: { user: true } } } }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isCustomer = booking.customer.userId === req.user.id;
    const isProvider = booking.service.provider.userId === req.user.id;

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ message: 'Not authorized to create complaint for this booking' });
    }

    const complaint = await prisma.complaint.create({
      data: {
        bookingId,
        serviceId: serviceId || booking.serviceId,
        reportedBy: req.user.id,
        reportedByRole: isCustomer ? 'customer' : 'service_provider',
        type,
        severity: severity || 'medium',
        title,
        description,
        attachments: attachments || null,
        status: 'open'
      },
      include: {
        booking: {
          include: {
            service: true,
            customer: { include: { user: true } }
          }
        }
      }
    });

    // Notify admin via activity log
    try {
      await prisma.activity.create({
        data: {
          userId: req.user.id,
          actionType: 'complaint_created',
          contentId: complaint.id,
          contentModel: 'Complaint',
          details: { bookingId, type, severity }
        }
      });
    } catch (_) {}

    res.status(201).json({
      message: 'Complaint created successfully',
      complaint
    });
  } catch (error) {
    console.error('Create complaint error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user's complaints
exports.getMyComplaints = async (req: any, res: any) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: {
        reportedBy: req.user.id
      },
      include: {
        booking: {
          include: {
            service: true,
            customer: { include: { user: true } }
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

// Get complaint by ID
exports.getComplaintById = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            service: {
              include: {
                provider: { include: { user: true } }
              }
            },
            customer: { include: { user: true } }
          }
        },
        service: true
      }
    });

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Check authorization (user must be involved in booking or admin)
    if (req.user.role !== 'admin') {
      if (complaint.reportedBy !== req.user.id) {
        // Check if user is involved in the booking
        const isCustomer = complaint.booking.customer.userId === req.user.id;
        const isProvider = complaint.booking.service.provider.userId === req.user.id;
        
        if (!isCustomer && !isProvider) {
          return res.status(403).json({ message: 'Not authorized' });
        }
      }
    }

    res.json(complaint);
  } catch (error) {
    console.error('Get complaint error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {};


