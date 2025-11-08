import prisma from '../lib/database';

// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();

    const where: any = {};

    // Add search filter if query exists
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } }
      ];
    }

    // Add category filter if specified
    if (category) {
      where.category = category;
    }

    // Only show admin-approved services to non-admin users
    if (req.user?.role !== 'admin') {
      where.adminApproved = true;
      where.status = 'active';
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        provider: {
          select: {
            rating: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true
              }
            }
          }
        }
      }
    });

    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {};

// Get service by ID
exports.getServiceById = async (req, res) => {
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: {
        provider: {
          select: {
            rating: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true
              }
            }
          }
        }
      }
    });

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new service
exports.createService = async (req, res) => {
  try {
    const { title, description, category, price, duration, mediaUrl, status } = req.body;

    // Get the service provider ID from the user
    const serviceProvider = await prisma.serviceProvider.findUnique({
      where: { userId: req.user.id }
    });

    if (!serviceProvider) {
      return res.status(404).json({ message: 'Service provider profile not found' });
    }

    const service = await prisma.service.create({
      data: {
        title,
        description,
        category,
        price: parseFloat(price),
        duration: parseInt(duration),
        providerId: serviceProvider.id,
        mediaUrl,
        status: status || 'active'
      },
      include: {
        provider: {
          select: {
            rating: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true
              }
            }
          }
        }
      }
    });

    res.status(201).json(service);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a service
exports.updateService = async (req, res) => {
  try {
    const { title, description, category, price, duration, mediaUrl, status } = req.body;

    // First, get the existing service to check authorization
    const existingService = await prisma.service.findUnique({
      where: { id: req.params.id },
      select: {
        providerId: true
      }
    });

    if (!existingService) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the provider or an admin
    if (existingService.providerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update the service
    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(category && { category }),
        ...(price && { price: parseFloat(price) }),
        ...(duration && { duration: parseInt(duration) }),
        ...(mediaUrl !== undefined && { mediaUrl }),
        ...(status && { status })
      },
      include: {
        provider: {
          select: {
            rating: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true
              }
            }
          }
        }
      }
    });

    res.json(service);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  try {
    // First, get the existing service to check authorization
    const existingService = await prisma.service.findUnique({
      where: { id: req.params.id },
      select: {
        providerId: true
      }
    });

    if (!existingService) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the provider or an admin
    if (existingService.providerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete the service
    await prisma.service.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Service removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get services by category
exports.getServicesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    // Only show admin-approved services to non-admin users
    const where: any = { category };
    if (req.user?.role !== 'admin') {
      where.adminApproved = true;
      where.status = 'active';
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        provider: {
          select: {
            rating: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true
              }
            }
          }
        }
      }
    });

    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};