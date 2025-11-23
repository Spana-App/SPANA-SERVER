import prisma from '../lib/database';

// Get overall platform statistics
exports.getPlatformStats = async (req: any, res: any) => {
  try {
    const [
      totalUsers,
      totalProviders,
      totalCustomers,
      totalServices,
      totalBookings,
      completedBookings,
      activeProviders,
      totalRevenue
    ] = await Promise.all([
      prisma.user.count(),
      prisma.serviceProvider.count(),
      prisma.customer.count(),
      prisma.service.count({ where: { adminApproved: true } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'completed' } }),
      prisma.serviceProvider.count({ where: { applicationStatus: 'active', isVerified: true } }),
      prisma.payment.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true }
      })
    ]);

    res.json({
      users: {
        total: totalUsers,
        providers: totalProviders,
        customers: totalCustomers,
        activeProviders
      },
      services: {
        total: totalServices
      },
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(2) : 0
      },
      revenue: {
        total: totalRevenue._sum.amount || 0
      }
    });
  } catch (error) {
    console.error('Get platform stats error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get service provider statistics by location
exports.getProviderStatsByLocation = async (req: any, res: any) => {
  try {
    const providers = await prisma.serviceProvider.findMany({
      where: {
        applicationStatus: 'active',
        isVerified: true
      },
      include: {
        user: {
          select: {
            location: true
          }
        },
        services: {
          include: {
            bookings: {
              where: { status: 'completed' }
            }
          }
        }
      }
    });

    // Group by location (simplified - using coordinates)
    const locationStats: any = {};
    
    providers.forEach(provider => {
      if (provider.user.location) {
        const loc = provider.user.location as any;
        const city = loc.address ? loc.address.split(',')[loc.address.split(',').length - 1].trim() : 'Unknown';
        
        if (!locationStats[city]) {
          locationStats[city] = {
            city,
            providerCount: 0,
            totalServices: 0,
            completedBookings: 0,
            averageRating: 0
          };
        }
        
        locationStats[city].providerCount++;
        locationStats[city].totalServices += provider.services.length;
        locationStats[city].completedBookings += provider.services.reduce((sum, s) => sum + s.bookings.length, 0);
      }
    });

    // Calculate average ratings
    Object.keys(locationStats).forEach(city => {
      const cityProviders = providers.filter(p => {
        const loc = p.user.location as any;
        const providerCity = loc.address ? loc.address.split(',')[loc.address.split(',').length - 1].trim() : 'Unknown';
        return providerCity === city;
      });
      
      if (cityProviders.length > 0) {
        const avgRating = cityProviders.reduce((sum, p) => sum + p.rating, 0) / cityProviders.length;
        locationStats[city].averageRating = avgRating.toFixed(2);
      }
    });

    res.json({
      locations: Object.values(locationStats),
      total: Object.keys(locationStats).length
    });
  } catch (error) {
    console.error('Get provider stats by location error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get service category statistics
exports.getServiceCategoryStats = async (req: any, res: any) => {
  try {
    const services = await prisma.service.findMany({
      where: { adminApproved: true },
      include: {
        bookings: {
          where: { status: 'completed' }
        }
      }
    });

    const categoryStats: any = {};
    
    services.forEach(service => {
      if (!categoryStats[service.category]) {
        categoryStats[service.category] = {
          category: service.category,
          serviceCount: 0,
          totalBookings: 0,
          totalRevenue: 0,
          averagePrice: 0
        };
      }
      
      categoryStats[service.category].serviceCount++;
      categoryStats[service.category].totalBookings += service.bookings.length;
      
      const categoryRevenue = service.bookings.reduce((sum, b) => sum + (b.calculatedPrice || b.basePrice || 0), 0);
      categoryStats[service.category].totalRevenue += categoryRevenue;
    });

    // Calculate average prices
    Object.keys(categoryStats).forEach(category => {
      const categoryServices = services.filter(s => s.category === category);
      if (categoryServices.length > 0) {
        const avgPrice = categoryServices.reduce((sum, s) => sum + s.price, 0) / categoryServices.length;
        categoryStats[category].averagePrice = avgPrice.toFixed(2);
      }
    });

    res.json({
      categories: Object.values(categoryStats),
      total: Object.keys(categoryStats).length
    });
  } catch (error) {
    console.error('Get service category stats error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get booking trends (last 30 days)
exports.getBookingTrends = async (req: any, res: any) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        createdAt: true,
        status: true,
        calculatedPrice: true,
        basePrice: true
      }
    });

    // Group by date
    const dailyStats: any = {};
    
    bookings.forEach(booking => {
      const date = booking.createdAt.toISOString().split('T')[0];
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          total: 0,
          completed: 0,
          revenue: 0
        };
      }
      
      dailyStats[date].total++;
      if (booking.status === 'completed') {
        dailyStats[date].completed++;
        dailyStats[date].revenue += (booking.calculatedPrice || booking.basePrice || 0);
      }
    });

    res.json({
      trends: Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date)),
      period: '30 days'
    });
  } catch (error) {
    console.error('Get booking trends error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get top performing providers
exports.getTopProviders = async (req: any, res: any) => {
  try {
    const limit = parseInt(req.query.limit || '10');
    
    const providers = await prisma.serviceProvider.findMany({
      where: {
        applicationStatus: 'active',
        isVerified: true
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            location: true
          }
        },
        services: {
          include: {
            bookings: {
              where: { status: 'completed' },
              include: {
                payment: true
              }
            }
          }
        }
      },
      orderBy: { rating: 'desc' },
      take: limit
    });

    const topProviders = providers.map(provider => {
      const totalBookings = provider.services.reduce((sum, s) => sum + s.bookings.length, 0);
      const totalRevenue = provider.services.reduce((sum, s) => {
        return sum + s.bookings.reduce((bSum, b) => bSum + (b.providerPayoutAmount || 0), 0);
      }, 0);

      return {
        id: provider.id,
        name: `${provider.user.firstName} ${provider.user.lastName}`,
        email: provider.user.email,
        rating: provider.rating,
        totalReviews: provider.totalReviews,
        totalBookings,
        totalRevenue,
        location: provider.user.location
      };
    });

    res.json({
      providers: topProviders,
      limit
    });
  } catch (error) {
    console.error('Get top providers error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get revenue statistics
exports.getRevenueStats = async (req: any, res: any) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: 'completed' },
      include: {
        booking: {
          include: {
            service: {
              select: {
                category: true
              }
            }
          }
        }
      }
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalCommission = payments.reduce((sum, p) => sum + (p.commissionAmount || 0), 0);
    const totalPayouts = payments.reduce((sum, p) => sum + (p.providerPayout || 0), 0);

    // Revenue by category
    const revenueByCategory: any = {};
    payments.forEach(payment => {
      const category = payment.booking.service.category;
      if (!revenueByCategory[category]) {
        revenueByCategory[category] = 0;
      }
      revenueByCategory[category] += payment.amount;
    });

    res.json({
      total: {
        revenue: totalRevenue,
        commission: totalCommission,
        payouts: totalPayouts
      },
      byCategory: revenueByCategory,
      commissionRate: totalRevenue > 0 ? ((totalCommission / totalRevenue) * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error('Get revenue stats error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {};

