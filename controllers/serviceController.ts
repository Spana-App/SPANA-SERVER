import prisma from '../lib/database';

// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    const where: any = {};

    // Add search filter if query exists
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } }
      ];
    }

    // Filter services based on user role
    if (req.user?.role === 'admin') {
      // Admins see all services
    } else if (req.user?.role === 'service_provider') {
      // Service providers see their own services (all statuses) + approved services from others
      const serviceProvider = await prisma.serviceProvider.findUnique({
        where: { userId: req.user.id },
        select: { id: true }
      });
      
      if (serviceProvider) {
        where.OR = [
          { providerId: serviceProvider.id }, // Their own services
          { 
            adminApproved: true,
            status: 'active'
          } // Approved services from others
        ];
      } else {
        // If no service provider record, only show approved services
        where.adminApproved = true;
        where.status = 'active';
      }
    } else {
      // Customers and others only see admin-approved active services
      where.adminApproved = true;
      where.status = 'active';
    }

    const services = await prisma.service.findMany({
      where,
      include: req.user?.role === 'customer' || !req.user ? {} : {
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

    // For customers: Remove provider details (Uber-style - no provider info until booking accepted)
    if (req.user?.role === 'customer' || !req.user) {
      const sanitizedServices = services.map((service: any) => {
        const { provider, ...serviceWithoutProvider } = service;
        return serviceWithoutProvider;
      });
      return res.json(sanitizedServices);
    }

    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Discover services: Recently booked services + Location-based suggestions
// GET /services/discover
// Optional query params: ?limit=5&suggestionsLimit=10
// Public endpoint (auth optional for location-based suggestions)
exports.discoverServices = async (req, res) => {
  console.log('🔍 Discover services endpoint called');
  try {
    const limit = parseInt(req.query.limit as string) || 3; // Default: 3 recently booked
    const suggestionLimit = Math.min(parseInt(req.query.suggestionsLimit as string) || 5, 20); // Default: 5 suggestions

    // 1. Get recently booked services (for marketing/rapport building)
    const recentBookings = await prisma.booking.findMany({
      where: {
        status: {
          in: ['confirmed', 'in_progress', 'completed'] // Only show active/completed bookings
        },
        service: {
          adminApproved: true,
          status: 'active'
        }
      },
      include: {
        service: {
          include: {
            provider: {
              include: {
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
        },
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Format recently booked services (for marketing display)
    const recentlyBooked = recentBookings.map(booking => {
      const service = booking.service as any;
      const { provider, ...serviceWithoutProvider } = service;
      
      return {
        bookingId: booking.id,
        service: {
          id: service.id,
          title: service.title,
          description: service.description,
          price: service.price,
          duration: service.duration,
          mediaUrl: service.mediaUrl
        },
        bookedAt: booking.createdAt,
        status: booking.status,
        location: booking.location,
        // Optional: Show customer info for marketing (first name only, anonymized)
        customerInfo: req.user?.role === 'admin' ? {
          firstName: booking.customer.user.firstName,
          location: booking.location
        } : undefined
      };
    });

    // 2. Location-based service suggestions (if user is authenticated and has location)
    let suggestedServices: any[] = [];
    
    if (req.user) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { location: true }
        });

        if (user?.location) {
          const userLoc = user.location as any;
          const userCoords = userLoc.coordinates || userLoc.coords || [0, 0];
          
          if (userCoords[0] !== 0 || userCoords[1] !== 0) {
            // Get services with providers that have service areas near the user
            const allServices = await prisma.service.findMany({
              where: {
                adminApproved: true,
                status: 'active',
                providerId: { not: null } // Only services with providers
              },
              include: {
                provider: {
                  include: {
                    user: {
                      select: {
                        location: true,
                        firstName: true,
                        lastName: true,
                        profileImage: true
                      }
                    }
                  }
                }
              },
              take: 50 // Get more to filter by location
            });

            // Filter services by proximity (simple distance calculation)
            // Services where provider's service area center is within reasonable distance
            const servicesWithDistance = allServices
              .filter((service: any) => {
                if (!service.provider?.serviceAreaCenter) return false;
                const providerCenter = service.provider.serviceAreaCenter as any;
                const providerCoords = providerCenter.coordinates || providerCenter.coords || [0, 0];
                
                if (providerCoords[0] === 0 && providerCoords[1] === 0) return false;
                
                // Simple distance calculation (Haversine formula)
                const lat1 = userCoords[1];
                const lon1 = userCoords[0];
                const lat2 = providerCoords[1];
                const lon2 = providerCoords[0];
                
                // Rough distance in km (Haversine formula)
                const R = 6371; // Earth's radius in km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = 
                  Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c;
                
                // Check if within service area radius (default 25km if not set)
                const serviceRadius = service.provider.serviceAreaRadius || 25;
                return distance <= serviceRadius;
              })
              .map((service: any) => {
                const providerCenter = service.provider.serviceAreaCenter as any;
                const providerCoords = providerCenter.coordinates || providerCenter.coords || [0, 0];
                const lat1 = userCoords[1];
                const lon1 = userCoords[0];
                const lat2 = providerCoords[1];
                const lon2 = providerCoords[0];
                
                // Calculate distance
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = 
                  Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c;
                
                return {
                  ...service,
                  distance: parseFloat(distance.toFixed(2))
                };
              })
              .sort((a: any, b: any) => a.distance - b.distance) // Sort by distance
              .slice(0, suggestionLimit); // Take top N

            // Format suggested services (remove provider info for customers)
            suggestedServices = servicesWithDistance.map((service: any) => {
              const { provider, ...serviceWithoutProvider } = service;
              const response: any = {
                id: service.id,
                title: service.title,
                description: service.description,
                price: service.price,
                duration: service.duration,
                mediaUrl: service.mediaUrl,
                distance: service.distance,
                suggested: true,
                suggestionType: 'location'
              };
              
              // Only include provider info for non-customers
              if (req.user?.role !== 'customer') {
                response.provider = provider ? {
                  rating: provider.rating,
                  user: provider.user
                } : null;
              }
              
              return response;
            });
          }
        }
      } catch (locationError) {
        console.warn('Error getting location-based suggestions:', locationError);
        // Continue without suggestions if location lookup fails
      }
    }

    // Fallback: If no location-based suggestions, show popular services (most booked)
    // This works for both authenticated and non-authenticated users
    if (suggestedServices.length === 0) {
      try {
        const popularServices = await prisma.service.findMany({
          where: {
            adminApproved: true,
            status: 'active',
            providerId: { not: null }
          },
          include: {
            provider: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    profileImage: true
                  }
                }
              }
            },
            bookings: {
              where: {
                status: { in: ['completed', 'in_progress'] }
              }
            }
          },
          take: suggestionLimit
        });

        // Sort by booking count and format
        const servicesWithBookingCount = popularServices
          .map((service: any) => ({
            ...service,
            bookingCount: service.bookings.length
          }))
          .sort((a: any, b: any) => b.bookingCount - a.bookingCount)
          .slice(0, suggestionLimit);

        suggestedServices = servicesWithBookingCount.map((service: any) => {
          const { provider, bookings, ...serviceWithoutProvider } = service;
          const response: any = {
            id: service.id,
            title: service.title,
            description: service.description,
            price: service.price,
            duration: service.duration,
            mediaUrl: service.mediaUrl,
            bookingCount: service.bookingCount,
            suggested: true,
            suggestionType: 'popular' // Indicates this is a popular service, not location-based
          };
          
          // Only include provider info for non-customers
          if (req.user?.role !== 'customer') {
            response.provider = provider ? {
              rating: provider.rating,
              user: provider.user
            } : null;
          }
          
          return response;
        });
      } catch (popularError) {
        console.warn('Error getting popular services:', popularError);
        // Continue with empty suggestions if popular services lookup fails
      }
    }

    // Return combined response
    res.json({
      recentlyBooked: recentlyBooked,
      suggested: suggestedServices,
      meta: {
        recentlyBookedCount: recentlyBooked.length,
        suggestedCount: suggestedServices.length,
        hasUserLocation: req.user ? (suggestedServices.length > 0 && suggestedServices[0].distance !== undefined) : false,
        suggestionType: suggestedServices.length > 0 ? (suggestedServices[0].suggestionType || 'location') : null
      }
    });
  } catch (error) {
    console.error('Discover services error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export {};

// Get service by ID
exports.getServiceById = async (req, res) => {
  // Debug: Check if "discover" is being matched as an ID
  if (req.params.id === 'discover') {
    console.error('❌ ERROR: /discover route is being matched by /:id! Route order issue!');
    return res.status(404).json({ 
      message: 'Route conflict: /discover is being matched by /:id. Check route order in routes/services.ts' 
    });
  }
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: req.user?.role === 'customer' || !req.user ? {} : {
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

    // For customers: Remove provider details (Uber-style - no provider info until booking accepted)
    if (req.user?.role === 'customer' || !req.user) {
      const { provider, ...serviceWithoutProvider } = service as any;
      return res.json(serviceWithoutProvider);
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
    const { title, description, price, mediaUrl, status } = req.body;

    // Validate required fields
    if (!title || !description || !price) {
      return res.status(400).json({ message: 'Missing required fields: title, description, price' });
    }

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
        price: parseFloat(price),
        duration: null, // Optional - can be set later
        providerId: serviceProvider.id,
        mediaUrl: mediaUrl || null,
        status: status || 'draft'
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
    const { title, description, price, duration, mediaUrl, status } = req.body;

    // First, get the existing service to check authorization
    const existingService = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: {
        provider: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!existingService) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the provider (via provider.userId) or an admin
    if (existingService.provider.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this service' });
    }

    // Update the service
    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
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
      include: {
        provider: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!existingService) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if the user is the provider (via provider.userId) or an admin
    if (existingService.provider.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this service' });
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
