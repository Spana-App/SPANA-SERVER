"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../lib/database"));
// Get overall platform statistics
exports.getPlatformStats = async (req, res) => {
    try {
        // Execute queries with error handling for each
        let totalUsers = 0;
        let totalProviders = 0;
        let totalCustomers = 0;
        let totalServices = 0;
        let totalBookings = 0;
        let completedBookings = 0;
        let activeProviders = 0;
        let totalRevenue = 0;
        try {
            totalUsers = await database_1.default.user.count();
        }
        catch (err) {
            console.warn('Error counting users:', err.message);
        }
        try {
            totalProviders = await database_1.default.serviceProvider.count();
        }
        catch (err) {
            console.warn('Error counting providers:', err.message);
        }
        try {
            totalCustomers = await database_1.default.customer.count();
        }
        catch (err) {
            console.warn('Error counting customers:', err.message);
        }
        try {
            totalServices = await database_1.default.service.count({ where: { adminApproved: true } });
        }
        catch (err) {
            console.warn('Error counting services:', err.message);
        }
        try {
            totalBookings = await database_1.default.booking.count();
        }
        catch (err) {
            console.warn('Error counting bookings:', err.message);
        }
        try {
            completedBookings = await database_1.default.booking.count({ where: { status: 'completed' } });
        }
        catch (err) {
            console.warn('Error counting completed bookings:', err.message);
        }
        try {
            activeProviders = await database_1.default.serviceProvider.count({
                where: { applicationStatus: 'active', isVerified: true }
            });
        }
        catch (err) {
            console.warn('Error counting active providers:', err.message);
        }
        try {
            const revenueResult = await database_1.default.payment.aggregate({
                where: { status: 'completed' },
                _sum: { amount: true }
            });
            totalRevenue = revenueResult._sum?.amount || 0;
        }
        catch (err) {
            console.warn('Error calculating revenue:', err.message);
            // Fallback: calculate from bookings if payment table has issues
            try {
                const bookings = await database_1.default.booking.findMany({
                    where: { status: 'completed' },
                    select: { calculatedPrice: true, basePrice: true }
                });
                totalRevenue = bookings.reduce((sum, b) => sum + (b.calculatedPrice || b.basePrice || 0), 0);
            }
            catch (fallbackErr) {
                console.warn('Error in revenue fallback calculation:', fallbackErr.message);
            }
        }
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
                completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(2) : '0.00'
            },
            revenue: {
                total: totalRevenue
            }
        });
    }
    catch (error) {
        console.error('Get platform stats error', error);
        res.status(500).json({
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
// Get service provider statistics by location
exports.getProviderStatsByLocation = async (req, res) => {
    try {
        const providers = await database_1.default.serviceProvider.findMany({
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
        const locationStats = {};
        providers.forEach(provider => {
            try {
                if (provider.user && provider.user.location) {
                    const loc = provider.user.location;
                    if (loc && loc.address && typeof loc.address === 'string') {
                        const city = loc.address.split(',')[loc.address.split(',').length - 1].trim() || 'Unknown';
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
                        locationStats[city].totalServices += (provider.services?.length || 0);
                        locationStats[city].completedBookings += (provider.services || []).reduce((sum, s) => sum + (s.bookings?.length || 0), 0);
                    }
                }
            }
            catch (err) {
                // Skip providers with invalid location data
                console.warn('Skipping provider with invalid location data:', provider.id);
            }
        });
        // Calculate average ratings
        Object.keys(locationStats).forEach(city => {
            try {
                const cityProviders = providers.filter(p => {
                    try {
                        if (!p.user || !p.user.location)
                            return false;
                        const loc = p.user.location;
                        if (!loc || !loc.address || typeof loc.address !== 'string')
                            return false;
                        const providerCity = loc.address.split(',')[loc.address.split(',').length - 1].trim();
                        return providerCity === city;
                    }
                    catch {
                        return false;
                    }
                });
                if (cityProviders.length > 0) {
                    const ratings = cityProviders.map(p => p.rating || 0).filter(r => r > 0);
                    if (ratings.length > 0) {
                        const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
                        locationStats[city].averageRating = parseFloat(avgRating.toFixed(2));
                    }
                }
            }
            catch (err) {
                console.warn('Error calculating average rating for city:', city, err);
            }
        });
        res.json({
            locations: Object.values(locationStats),
            total: Object.keys(locationStats).length
        });
    }
    catch (error) {
        console.error('Get provider stats by location error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Get service statistics (category removed)
exports.getServiceStats = async (req, res) => {
    try {
        const services = await database_1.default.service.findMany({
            where: { adminApproved: true },
            include: {
                bookings: {
                    where: { status: 'completed' }
                }
            }
        });
        const totalServices = services.length;
        const totalBookings = services.reduce((sum, s) => sum + s.bookings.length, 0);
        const totalRevenue = services.reduce((sum, s) => {
            return sum + s.bookings.reduce((bSum, b) => bSum + (b.calculatedPrice || b.basePrice || 0), 0);
        }, 0);
        const averagePrice = services.length > 0
            ? (services.reduce((sum, s) => sum + s.price, 0) / services.length).toFixed(2)
            : 0;
        res.json({
            totalServices,
            totalBookings,
            totalRevenue,
            averagePrice
        });
    }
    catch (error) {
        console.error('Get service stats error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Get booking trends (last 30 days)
exports.getBookingTrends = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const bookings = await database_1.default.booking.findMany({
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
        const dailyStats = {};
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
            trends: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
            period: '30 days'
        });
    }
    catch (error) {
        console.error('Get booking trends error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Get top performing providers
exports.getTopProviders = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '10');
        const providers = await database_1.default.serviceProvider.findMany({
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
    }
    catch (error) {
        console.error('Get top providers error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Get revenue statistics
exports.getRevenueStats = async (req, res) => {
    try {
        const payments = await database_1.default.payment.findMany({
            where: { status: 'completed' },
            include: {
                booking: {
                    include: {
                        service: {
                            select: {
                                id: true,
                                title: true,
                                price: true
                            }
                        }
                    }
                }
            }
        });
        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalCommission = payments.reduce((sum, p) => sum + (p.commissionAmount || 0), 0);
        const totalPayouts = payments.reduce((sum, p) => sum + (p.providerPayout || 0), 0);
        // Revenue by service (category removed)
        const revenueByService = {};
        payments.forEach(payment => {
            if (payment.booking?.service) {
                const serviceId = payment.booking.service.id;
                const serviceTitle = payment.booking.service.title;
                if (!revenueByService[serviceId]) {
                    revenueByService[serviceId] = {
                        serviceId,
                        serviceTitle,
                        revenue: 0
                    };
                }
                revenueByService[serviceId].revenue += payment.amount;
            }
        });
        res.json({
            total: {
                revenue: totalRevenue,
                commission: totalCommission,
                payouts: totalPayouts
            },
            byService: Object.values(revenueByService),
            commissionRate: totalRevenue > 0 ? ((totalCommission / totalRevenue) * 100).toFixed(2) : 0
        });
    }
    catch (error) {
        console.error('Get revenue stats error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
