"use strict";
/**
 * Comprehensive Data Seeding Script
 *
 * Creates:
 * - Multiple customers
 * - Multiple service providers with 100% complete profiles
 * - Services for each provider
 * - Bookings (pending, confirmed, completed, canceled)
 * - Payments (completed, refunded)
 * - Ratings and reviews
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../lib/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};
function log(step, message, color = colors.reset) {
    console.log(`${color}${step}${colors.reset} ${message}`);
}
async function main() {
    try {
        log('🚀', 'Starting Comprehensive Data Seeding', colors.blue);
        console.log('');
        // ============================================
        // STEP 1: Create Customers
        // ============================================
        log('📋', 'STEP 1: Creating Customers', colors.blue);
        const customerData = [
            { firstName: 'Alice', lastName: 'Cooper', email: 'alice.cooper@example.com', phone: '+27221111111' },
            { firstName: 'Bob', lastName: 'Marley', email: 'bob.marley@example.com', phone: '+27221111112' },
            { firstName: 'Charlie', lastName: 'Brown', email: 'charlie.brown@example.com', phone: '+27221111113' },
            { firstName: 'Diana', lastName: 'Prince', email: 'diana.prince@example.com', phone: '+27221111114' },
            { firstName: 'Edward', lastName: 'Norton', email: 'edward.norton@example.com', phone: '+27221111115' },
            { firstName: 'Fiona', lastName: 'Apple', email: 'fiona.apple@example.com', phone: '+27221111116' },
            { firstName: 'George', lastName: 'Clooney', email: 'george.clooney@example.com', phone: '+27221111117' },
            { firstName: 'Helen', lastName: 'Mirren', email: 'helen.mirren@example.com', phone: '+27221111118' },
        ];
        const customers = [];
        const password = await bcryptjs_1.default.hash('Customer123!', 12);
        for (const data of customerData) {
            let user = await database_1.default.user.findUnique({ where: { email: data.email } });
            if (!user) {
                user = await database_1.default.user.create({
                    data: {
                        email: data.email,
                        password,
                        firstName: data.firstName,
                        lastName: data.lastName,
                        phone: data.phone,
                        role: 'customer',
                        isEmailVerified: true,
                        isPhoneVerified: true,
                        profileImage: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
                        location: {
                            type: 'Point',
                            coordinates: [28.0473 + (Math.random() - 0.5) * 0.2, -26.2041 + (Math.random() - 0.5) * 0.2],
                            address: `${Math.floor(Math.random() * 100)} ${data.firstName} Street, Johannesburg`
                        }
                    }
                });
            }
            let customer = await database_1.default.customer.findUnique({ where: { userId: user.id } });
            if (!customer) {
                customer = await database_1.default.customer.create({
                    data: { userId: user.id }
                });
            }
            customers.push({ user, customer });
            log('✅', `Customer created: ${data.firstName} ${data.lastName}`, colors.green);
        }
        console.log('');
        // ============================================
        // STEP 2: Create Service Providers with Complete Profiles
        // ============================================
        log('📋', 'STEP 2: Creating Service Providers with 100% Complete Profiles', colors.blue);
        const providerData = [
            { firstName: 'John', lastName: 'Doe', email: 'john.doe@provider.com', phone: '+27331111111', skills: ['Plumbing', 'Electrical'], experience: 8 },
            { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@provider.com', phone: '+27331111112', skills: ['Cleaning', 'Carpentry'], experience: 5 },
            { firstName: 'Mike', lastName: 'Johnson', email: 'mike.johnson@provider.com', phone: '+27331111113', skills: ['Painting', 'Gardening'], experience: 10 },
            { firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@provider.com', phone: '+27331111114', skills: ['Cleaning', 'Cooking'], experience: 4 },
            { firstName: 'David', lastName: 'Brown', email: 'david.brown@provider.com', phone: '+27331111115', skills: ['Plumbing', 'HVAC'], experience: 12 },
            { firstName: 'Emma', lastName: 'Wilson', email: 'emma.wilson@provider.com', phone: '+27331111116', skills: ['Electrical', 'Security'], experience: 7 },
            { firstName: 'James', lastName: 'Taylor', email: 'james.taylor@provider.com', phone: '+27331111117', skills: ['Carpentry', 'Furniture'], experience: 9 },
            { firstName: 'Lisa', lastName: 'Anderson', email: 'lisa.anderson@provider.com', phone: '+27331111118', skills: ['Gardening', 'Landscaping'], experience: 6 },
        ];
        const providers = [];
        const providerPassword = await bcryptjs_1.default.hash('Provider123!', 12);
        for (const data of providerData) {
            let user = await database_1.default.user.findUnique({ where: { email: data.email } });
            if (!user) {
                user = await database_1.default.user.create({
                    data: {
                        email: data.email,
                        password: providerPassword,
                        firstName: data.firstName,
                        lastName: data.lastName,
                        phone: data.phone,
                        role: 'service_provider',
                        isEmailVerified: true,
                        isPhoneVerified: true,
                        profileImage: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
                        location: {
                            type: 'Point',
                            coordinates: [28.0473 + (Math.random() - 0.5) * 0.2, -26.2041 + (Math.random() - 0.5) * 0.2],
                            address: `${Math.floor(Math.random() * 100)} ${data.firstName} Street, Johannesburg`
                        }
                    }
                });
            }
            let provider = await database_1.default.serviceProvider.findUnique({ where: { userId: user.id } });
            if (!provider) {
                provider = await database_1.default.serviceProvider.create({
                    data: {
                        userId: user.id,
                        skills: data.skills,
                        experienceYears: data.experience,
                        isOnline: Math.random() > 0.5,
                        rating: Math.random() * 2 + 3.5, // 3.5 to 5.5
                        totalReviews: Math.floor(Math.random() * 50) + 10,
                        isVerified: true,
                        isIdentityVerified: true,
                        isProfileComplete: true,
                        applicationStatus: 'active',
                        availability: {
                            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                            hours: { start: '08:00', end: '18:00' }
                        },
                        serviceAreaRadius: 25,
                        serviceAreaCenter: {
                            type: 'Point',
                            coordinates: user.location ? user.location.coordinates : [28.0473, -26.2041]
                        }
                    }
                });
            }
            else {
                // Update to make profile 100% complete
                provider = await database_1.default.serviceProvider.update({
                    where: { id: provider.id },
                    data: {
                        isProfileComplete: true,
                        isVerified: true,
                        isIdentityVerified: true,
                        applicationStatus: 'active',
                        availability: {
                            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                            hours: { start: '08:00', end: '18:00' }
                        },
                        serviceAreaRadius: 25,
                        serviceAreaCenter: {
                            type: 'Point',
                            coordinates: user.location ? user.location.coordinates : [28.0473, -26.2041]
                        }
                    }
                });
            }
            // Upload all required documents
            const documentTypes = ['id_number', 'id_picture', 'license', 'certification', 'profile_picture'];
            for (const docType of documentTypes) {
                const existing = await database_1.default.document.findFirst({
                    where: { providerId: provider.id, type: docType }
                });
                if (!existing) {
                    await database_1.default.document.create({
                        data: {
                            providerId: provider.id,
                            type: docType,
                            url: `https://example.com/uploads/${provider.id}/${docType}.jpg`,
                            verified: true,
                            verifiedBy: (await database_1.default.user.findFirst({ where: { role: 'admin' } }))?.id || user.id,
                            verifiedAt: new Date(),
                            metadata: docType === 'id_number' ? { idNumber: `${Math.floor(8000000000000 + Math.random() * 999999999999)}` } : null
                        }
                    });
                }
            }
            providers.push({ user, provider });
            log('✅', `Provider created: ${data.firstName} ${data.lastName} (100% complete)`, colors.green);
        }
        console.log('');
        // ============================================
        // STEP 3: Create Services
        // ============================================
        log('📋', 'STEP 3: Creating Services', colors.blue);
        const services = [];
        const serviceTemplates = {
            'Plumbing': ['Emergency Plumbing', 'Pipe Repair', 'Leak Detection', 'Drain Cleaning'],
            'Cleaning': ['House Cleaning', 'Office Cleaning', 'Deep Cleaning', 'Window Cleaning'],
            'Painting': ['Interior Painting', 'Exterior Painting', 'Wall Painting', 'Furniture Painting'],
            'Electrical': ['Electrical Repair', 'Wiring Installation', 'Light Installation', 'Panel Upgrade'],
            'Carpentry': ['Furniture Repair', 'Cabinet Installation', 'Custom Furniture', 'Door Repair'],
            'Gardening': ['Lawn Mowing', 'Garden Design', 'Tree Trimming', 'Landscaping']
        };
        for (const { provider, user } of providers) {
            // Use first skill as service type
            const serviceType = user.skills?.[0] || 'General';
            const serviceNames = serviceTemplates[serviceType] || ['General Service'];
            for (const serviceName of serviceNames.slice(0, 2)) { // 2 services per provider
                const service = await database_1.default.service.create({
                    data: {
                        providerId: provider.id,
                        title: serviceName,
                        description: `Professional ${serviceName.toLowerCase()} services by ${user.firstName}. Experienced and reliable.`,
                        price: Math.floor(Math.random() * 800) + 200, // 200-1000
                        duration: Math.floor(Math.random() * 180) + 60, // 60-240 minutes
                        // Use real stock-style images (dynamic) based on service name
                        // Unsplash Source returns a real photo every time, no placeholders.
                        mediaUrl: `https://source.unsplash.com/featured/?${encodeURIComponent(serviceName + ' service')}`,
                        status: 'active',
                        adminApproved: true,
                        approvedBy: (await database_1.default.user.findFirst({ where: { role: 'admin' } }))?.id,
                        approvedAt: new Date()
                    }
                });
                services.push(service);
                log('✅', `Service created: ${serviceName} by ${user.firstName}`, colors.green);
            }
        }
        console.log('');
        // ============================================
        // STEP 4: Create Bookings with Payment Flow
        // ============================================
        log('📋', 'STEP 4: Creating Bookings (Customer Pays First)', colors.blue);
        const bookingStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
        const bookings = [];
        for (let i = 0; i < 30; i++) {
            const customer = customers[Math.floor(Math.random() * customers.length)];
            const service = services[Math.floor(Math.random() * services.length)];
            const status = bookingStatuses[Math.floor(Math.random() * bookingStatuses.length)];
            const jobSize = ['small', 'medium', 'large'][Math.floor(Math.random() * 3)];
            const multiplier = jobSize === 'small' ? 1.0 : jobSize === 'medium' ? 1.2 : 1.5;
            const basePrice = service.price;
            const calculatedPrice = basePrice * multiplier;
            const bookingDate = new Date();
            bookingDate.setDate(bookingDate.getDate() + Math.floor(Math.random() * 30));
            const booking = await database_1.default.booking.create({
                data: {
                    customerId: customer.customer.id,
                    serviceId: service.id,
                    date: bookingDate,
                    time: `${Math.floor(Math.random() * 10) + 8}:00`,
                    location: customer.user.location,
                    status,
                    requestStatus: status === 'pending' ? 'pending' : status === 'cancelled' ? 'declined' : 'accepted',
                    jobSize,
                    basePrice,
                    jobSizeMultiplier: multiplier,
                    calculatedPrice,
                    estimatedDurationMinutes: service.duration,
                    paymentStatus: status === 'cancelled' ? 'refunded' : status === 'completed' ? 'released_to_provider' : 'paid_to_escrow',
                    escrowAmount: calculatedPrice,
                    commissionAmount: calculatedPrice * 0.15,
                    providerPayoutAmount: calculatedPrice * 0.85,
                    ...(status === 'completed' && {
                        startedAt: new Date(bookingDate.getTime() - service.duration * 60 * 1000),
                        completedAt: bookingDate,
                        actualDurationMinutes: service.duration + Math.floor(Math.random() * 30) - 15,
                        rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
                        review: ['Great service!', 'Very professional', 'Highly recommended', 'Excellent work'][Math.floor(Math.random() * 4)]
                    }),
                    ...(status === 'confirmed' && {
                        providerAcceptedAt: new Date(bookingDate.getTime() - 2 * 24 * 60 * 60 * 1000)
                    }),
                    ...(status === 'cancelled' && {
                        providerDeclinedAt: new Date(bookingDate.getTime() - 1 * 24 * 60 * 60 * 1000),
                        declineReason: ['Schedule conflict', 'Not available', 'Too far'][Math.floor(Math.random() * 3)]
                    })
                }
            });
            // Create payment (customer pays first)
            if (status !== 'pending') {
                const payment = await database_1.default.payment.create({
                    data: {
                        customerId: customer.customer.id,
                        bookingId: booking.id,
                        amount: calculatedPrice,
                        currency: 'ZAR',
                        paymentMethod: 'payfast',
                        status: status === 'cancelled' ? 'refunded' : 'completed',
                        transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`,
                        escrowStatus: status === 'cancelled' ? 'refunded' : status === 'completed' ? 'released' : 'held',
                        commissionRate: 0.15,
                        commissionAmount: calculatedPrice * 0.15,
                        providerPayout: calculatedPrice * 0.85
                    }
                });
                log('💳', `Payment created: ZAR ${calculatedPrice.toFixed(2)} for booking ${booking.id.substring(0, 8)} (${status})`, colors.cyan);
            }
            bookings.push(booking);
            log('📅', `Booking created: ${customer.user.firstName} → ${service.title} (${status})`, colors.green);
        }
        console.log('');
        // ============================================
        // STEP 5: Update Provider Ratings
        // ============================================
        log('📋', 'STEP 5: Updating Provider Ratings', colors.blue);
        for (const { provider, user } of providers) {
            const providerServices = services.filter(s => s.providerId === provider.id);
            const providerBookings = bookings.filter(b => providerServices.some(s => s.id === b.serviceId) && b.status === 'completed' && b.rating);
            if (providerBookings.length > 0) {
                const avgRating = providerBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / providerBookings.length;
                await database_1.default.serviceProvider.update({
                    where: { id: provider.id },
                    data: {
                        rating: avgRating,
                        totalReviews: providerBookings.length
                    }
                });
                log('⭐', `Provider ${user.firstName} updated: ${avgRating.toFixed(2)}/5 (${providerBookings.length} reviews)`, colors.yellow);
            }
        }
        console.log('');
        // ============================================
        // SUMMARY
        // ============================================
        log('📊', 'SEEDING SUMMARY', colors.blue);
        console.log('');
        const stats = {
            customers: await database_1.default.customer.count(),
            providers: await database_1.default.serviceProvider.count({ where: { isProfileComplete: true } }),
            services: await database_1.default.service.count({ where: { adminApproved: true } }),
            bookings: await database_1.default.booking.count(),
            completedBookings: await database_1.default.booking.count({ where: { status: 'completed' } }),
            canceledBookings: await database_1.default.booking.count({ where: { status: 'cancelled' } }),
            payments: await database_1.default.payment.count(),
            refundedPayments: await database_1.default.payment.count({ where: { status: 'refunded' } })
        };
        console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
        console.log(`${colors.green}✅ Customers:${colors.reset} ${stats.customers}`);
        console.log(`${colors.green}✅ Providers (100% complete):${colors.reset} ${stats.providers}`);
        console.log(`${colors.green}✅ Active Services:${colors.reset} ${stats.services}`);
        console.log(`${colors.green}✅ Total Bookings:${colors.reset} ${stats.bookings}`);
        console.log(`${colors.green}✅ Completed Bookings:${colors.reset} ${stats.completedBookings}`);
        console.log(`${colors.yellow}⚠️  Canceled Bookings:${colors.reset} ${stats.canceledBookings}`);
        console.log(`${colors.green}💰 Payments:${colors.reset} ${stats.payments}`);
        console.log(`${colors.yellow}💸 Refunded Payments:${colors.reset} ${stats.refundedPayments}`);
        console.log(colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
        console.log('');
        log('🎉', 'Comprehensive Data Seeding Completed Successfully!', colors.green);
    }
    catch (error) {
        console.error(colors.red + '❌ Error during seeding:' + colors.reset, error);
        throw error;
    }
}
main()
    .then(() => {
    console.log('');
    log('✅', 'Seeding finished', colors.green);
    process.exit(0);
})
    .catch((error) => {
    console.error(colors.red + '❌ Seeding failed:' + colors.reset, error);
    process.exit(1);
});
