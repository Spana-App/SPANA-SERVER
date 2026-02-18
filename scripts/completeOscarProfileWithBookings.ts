/**
 * Completes Oscar's provider profile and creates test bookings
 * Run: npx ts-node scripts/completeOscarProfileWithBookings.ts
 */

import prisma from '../lib/database';

const OSCAR_EMAIL = 'okpoko15@gmail.com';

// Johannesburg coordinates (central location)
const JHB_COORDS = [28.0473, -26.2041];
const JHB_ADDRESS = 'Johannesburg, Gauteng, South Africa';

async function completeOscarProfileWithBookings() {
  try {
    console.log('🔧 Finding Oscar and completing profile with bookings...\n');

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: OSCAR_EMAIL },
          { email: { contains: 'oscar', mode: 'insensitive' } },
          { firstName: { contains: 'oscar', mode: 'insensitive' } },
        ],
        role: 'service_provider',
      },
      include: {
        serviceProvider: {
          include: {
            services: true,
            documents: true,
          },
        },
      },
    });

    if (!user) {
      console.error('❌ Oscar (service provider) not found.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`);

    // Update User fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        isPhoneVerified: true,
        phone: user.phone || '+27123456789',
        profileImage:
          user.profileImage ||
          'https://api.dicebear.com/7.x/avataaars/svg?seed=oscar',
        location: user.location || {
          type: 'Point',
          coordinates: JHB_COORDS,
          address: JHB_ADDRESS,
        },
        status: 'active',
      },
    });
    console.log('   ✅ Updated User fields');

    // Get or create ServiceProvider
    let provider = user.serviceProvider;
    let providerId: string;

    if (!provider) {
      const created = await prisma.serviceProvider.create({
        data: {
          userId: user.id,
          skills: ['Plumbing', 'Electrical', 'General Maintenance'],
          experienceYears: 8,
          isOnline: true,
          rating: 4.8,
          totalReviews: 25,
          isVerified: true,
          isIdentityVerified: true,
          isProfileComplete: true,
          applicationStatus: 'active',
          availability: {
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            hours: { start: '08:00', end: '18:00' },
          },
          serviceAreaRadius: 25,
          serviceAreaCenter: {
            type: 'Point',
            coordinates: JHB_COORDS,
            address: JHB_ADDRESS,
          },
        },
        include: {
          documents: true,
          services: true,
        },
      });
      providerId = created.id;
      provider = created;
      console.log('   ✅ Created ServiceProvider record');
    } else {
      const updated = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: {
          skills: provider.skills?.length
            ? provider.skills
            : ['Plumbing', 'Electrical', 'General Maintenance'],
          experienceYears: provider.experienceYears > 0 ? provider.experienceYears : 8,
          isOnline: true,
          rating: provider.rating > 0 ? provider.rating : 4.8,
          totalReviews: provider.totalReviews || 25,
          isVerified: true,
          isIdentityVerified: true,
          isProfileComplete: true,
          applicationStatus: 'active',
          availability: provider.availability || {
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            hours: { start: '08:00', end: '18:00' },
          },
          serviceAreaRadius: provider.serviceAreaRadius > 0 ? provider.serviceAreaRadius : 25,
          serviceAreaCenter:
            provider.serviceAreaCenter ||
            ({
              type: 'Point',
              coordinates: JHB_COORDS,
              address: JHB_ADDRESS,
            } as any),
        },
        include: {
          documents: true,
          services: true,
        },
      });
      providerId = updated.id;
      provider = updated;
      console.log('   ✅ Updated ServiceProvider (100% complete)');
    }

    // Ensure verified documents
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
    const verifiedBy = adminUser?.id || user.id;

    const docTypes = ['id_number', 'id_picture', 'profile_picture'] as const;
    for (const docType of docTypes) {
      const existing = await prisma.document.findFirst({
        where: { providerId, type: docType },
      });
      if (!existing) {
        await prisma.document.create({
          data: {
            providerId,
            type: docType,
            url: `https://example.com/uploads/${providerId}/${docType}.jpg`,
            verified: true,
            verifiedBy,
            verifiedAt: new Date(),
            metadata: docType === 'id_number' ? { idNumber: '8001015009087' } : null,
          },
        });
        console.log(`   ✅ Created verified ${docType} document`);
      } else if (!existing.verified) {
        await prisma.document.update({
          where: { id: existing.id },
          data: { verified: true, verifiedBy, verifiedAt: new Date() },
        });
        console.log(`   ✅ Verified ${docType} document`);
      }
    }

    // Create or update services
    const servicesToCreate = [
      {
        title: 'Plumbing Service',
        description: 'Professional plumbing repairs, installations, and maintenance',
        price: 400.0,
        duration: 60,
        category: 'plumbing-electrical',
      },
      {
        title: 'Electrical Repairs',
        description: 'Electrical installations, repairs, and safety inspections',
        price: 500.0,
        duration: 90,
        category: 'plumbing-electrical',
      },
      {
        title: 'General Maintenance',
        description: 'Home maintenance and repair services',
        price: 350.0,
        duration: 120,
        category: 'home-repairs',
      },
    ];

    const createdServices = [];
    for (const serviceData of servicesToCreate) {
      const existing = await prisma.service.findFirst({
        where: {
          providerId,
          title: serviceData.title,
        },
      });

      if (!existing) {
        const service = await prisma.service.create({
          data: {
            ...serviceData,
            providerId,
            status: 'active',
            adminApproved: true,
            approvedBy: adminUser?.id || user.id,
            approvedAt: new Date(),
          },
        });
        createdServices.push(service);
        console.log(`   ✅ Created service: ${serviceData.title}`);
      } else {
        // Update existing service to ensure it's active and approved
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            status: 'active',
            adminApproved: true,
            approvedBy: adminUser?.id || user.id,
            approvedAt: new Date(),
          },
        });
        createdServices.push(existing);
        console.log(`   ✅ Updated service: ${serviceData.title}`);
      }
    }

    if (createdServices.length === 0) {
      console.log('   ⚠️  No services available - fetching existing services...');
      const existingServices = await prisma.service.findMany({
        where: { providerId },
      });
      createdServices.push(...existingServices);
    }

    console.log(`\n📊 Profile Summary:`);
    console.log(`   - Skills: ${provider.skills.join(', ')}`);
    console.log(`   - Experience: ${provider.experienceYears} years`);
    console.log(`   - Rating: ${provider.rating}/5.0`);
    console.log(`   - Services: ${createdServices.length}`);
    console.log(`   - Profile Complete: ${provider.isProfileComplete}`);
    console.log(`   - Verified: ${provider.isVerified && provider.isIdentityVerified}`);
    console.log(`   - Application Status: ${provider.applicationStatus}`);

    // Check existing bookings
    const existingBookings = await prisma.booking.findMany({
      where: {
        service: {
          providerId,
        },
      },
      include: {
        service: true,
        customer: {
          include: {
            user: true,
          },
        },
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`\n📋 Existing Bookings: ${existingBookings.length}`);

    // Create test bookings if needed
    const targetBookings = 5;
    const bookingsToCreate = targetBookings - existingBookings.length;

    if (bookingsToCreate > 0 && createdServices.length > 0) {
      console.log(`\n🔨 Creating ${bookingsToCreate} test bookings...`);

      // Get or create a test customer
      let testCustomer = await prisma.customer.findFirst({
        where: {
          user: {
            email: 'xolinxiweni@gmail.com',
          },
        },
        include: {
          user: true,
        },
      });

      if (!testCustomer) {
        // Create test customer user
        const testCustomerUser = await prisma.user.create({
          data: {
            email: 'xolinxiweni@gmail.com',
            password: '$2b$10$dummyhash', // Dummy hash
            firstName: 'Xolin',
            lastName: 'Xiweni',
            phone: '+27123456780',
            role: 'customer',
            isEmailVerified: true,
            isPhoneVerified: true,
            status: 'active',
          },
        });

        const createdCustomer = await prisma.customer.create({
          data: {
            userId: testCustomerUser.id,
          },
        });

        // Fetch with user relation
        testCustomer = await prisma.customer.findUnique({
          where: { id: createdCustomer.id },
          include: {
            user: true,
          },
        });
        console.log('   ✅ Created test customer: xolinxiweni@gmail.com');
      }

      const service = createdServices[0]; // Use first service
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 7); // Start 7 days ago

      // Get the highest existing reference number to avoid conflicts
      const allBookings = await prisma.booking.findMany({
        where: {
          referenceNumber: {
            startsWith: 'SPANA-BK-',
          },
        },
        orderBy: {
          referenceNumber: 'desc',
        },
        take: 1,
      });

      let nextRefNumber = 1;
      if (allBookings.length > 0 && allBookings[0].referenceNumber) {
        const match = allBookings[0].referenceNumber.match(/SPANA-BK-(\d+)/);
        if (match) {
          nextRefNumber = parseInt(match[1], 10) + 1;
        }
      }

      // Booking scenarios: 2 successful, 2 unsuccessful, 1 cancelled
      const bookingScenarios = [
        // Successful 1: Completed with payment
        {
          status: 'completed',
          requestStatus: 'accepted',
          paymentStatus: 'paid_to_escrow',
          date: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000),
          notes: 'Test booking - Successful completion',
          paymentStatusValue: 'paid',
        },
        // Successful 2: Completed with payment
        {
          status: 'completed',
          requestStatus: 'accepted',
          paymentStatus: 'paid_to_escrow',
          date: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
          notes: 'Test booking - Another successful job',
          paymentStatusValue: 'paid',
        },
        // Unsuccessful 1: Declined by provider
        {
          status: 'cancelled',
          requestStatus: 'declined',
          paymentStatus: 'paid_to_escrow',
          date: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          notes: 'Test booking - Provider declined',
          paymentStatusValue: 'paid',
        },
        // Unsuccessful 2: Payment failed
        {
          status: 'cancelled',
          requestStatus: 'pending',
          paymentStatus: 'pending',
          date: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000),
          notes: 'Test booking - Payment failed',
          paymentStatusValue: 'failed',
        },
        // Cancelled: Customer cancelled
        {
          status: 'cancelled',
          requestStatus: 'pending',
          paymentStatus: 'paid_to_escrow',
          date: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000),
          notes: 'Test booking - Customer cancelled',
          paymentStatusValue: 'refunded',
        },
      ];

      for (let i = 0; i < Math.min(bookingsToCreate, bookingScenarios.length); i++) {
        const scenario = bookingScenarios[i];
        const bookingDate = scenario.date;

        // Generate unique reference number
        const refNumber = `SPANA-BK-${String(nextRefNumber + i).padStart(6, '0')}`;

        const booking = await prisma.booking.create({
          data: {
            referenceNumber: refNumber,
            customerId: testCustomer.id,
            serviceId: service.id,
            date: bookingDate,
            time: '10:00',
            location: {
              type: 'Point',
              coordinates: [28.0473 + (Math.random() - 0.5) * 0.1, -26.2041 + (Math.random() - 0.5) * 0.1],
              address: '123 Test Street, Johannesburg',
            },
            notes: scenario.notes,
            status: scenario.status,
            requestStatus: scenario.requestStatus,
            paymentStatus: scenario.paymentStatus,
            basePrice: service.price,
            calculatedPrice: service.price,
            estimatedDurationMinutes: service.duration || 60,
            jobSize: 'medium',
            jobSizeMultiplier: 1.0,
            locationMultiplier: 1.0,
            ...(scenario.status === 'completed' && scenario.requestStatus === 'accepted'
              ? {
                  providerAcceptedAt: new Date(bookingDate.getTime() + 60 * 60 * 1000),
                  startedAt: new Date(bookingDate.getTime() + 2 * 60 * 60 * 1000),
                  completedAt: new Date(bookingDate.getTime() + 4 * 60 * 60 * 1000),
                  actualDurationMinutes: 120,
                }
              : {}),
            ...(scenario.requestStatus === 'declined'
              ? {
                  providerDeclinedAt: new Date(bookingDate.getTime() + 30 * 60 * 1000),
                  declineReason: 'Not available at that time',
                }
              : {}),
          },
        });

        // Create payment record
        if (scenario.paymentStatusValue !== 'failed') {
          // Get highest payment reference number
          const existingPayments = await prisma.payment.findMany({
            where: {
              referenceNumber: {
                startsWith: 'SPANA-PY-',
              },
            },
            orderBy: {
              referenceNumber: 'desc',
            },
            take: 1,
          });

          let nextPaymentRef = 1;
          if (existingPayments.length > 0 && existingPayments[0].referenceNumber) {
            const match = existingPayments[0].referenceNumber.match(/SPANA-PY-(\d+)/);
            if (match) {
              nextPaymentRef = parseInt(match[1], 10) + 1;
            }
          }

          const paymentRefNumber = `SPANA-PY-${String(nextPaymentRef + i).padStart(6, '0')}`;
          await prisma.payment.create({
            data: {
              referenceNumber: paymentRefNumber,
              customerId: testCustomer.id,
              bookingId: booking.id,
              amount: service.price,
              currency: 'ZAR',
              paymentMethod: 'stripe',
              status: scenario.paymentStatusValue,
              escrowStatus:
                scenario.paymentStatusValue === 'paid'
                  ? 'held'
                  : scenario.paymentStatusValue === 'refunded'
                    ? 'refunded'
                    : null,
              commissionRate: 0.15,
              commissionAmount: service.price * 0.15,
              transactionId: `test_txn_${booking.id}`,
            },
          });
        }

        // Create workflow for booking
        try {
          const workflowClient = require('../lib/workflowClient');
          const defaultSteps = [
            { name: 'Booking Request Created', status: 'completed' },
            {
              name: 'Payment Required',
              status: scenario.paymentStatus === 'pending' ? 'pending' : 'completed',
            },
            {
              name: 'Payment Received',
              status: scenario.paymentStatus === 'paid_to_escrow' ? 'completed' : 'pending',
            },
            {
              name: 'Provider Assigned',
              status: scenario.requestStatus === 'accepted' ? 'completed' : 'pending',
            },
            {
              name: 'Service Started',
              status: scenario.status === 'completed' ? 'completed' : 'pending',
            },
            {
              name: 'Service Completed',
              status: scenario.status === 'completed' ? 'completed' : 'pending',
            },
          ];
          await workflowClient.createWorkflowForBooking(booking.id, defaultSteps).catch(() => {});
        } catch (err) {
          console.log(`   ⚠️  Could not create workflow for booking ${booking.id}`);
        }

        console.log(
          `   ✅ Created booking: ${refNumber} - ${scenario.status} (${scenario.requestStatus})`
        );
      }
    } else if (existingBookings.length >= targetBookings) {
      console.log(`\n✅ Already have ${existingBookings.length} bookings, no need to create more`);
    }

    // Final summary
    const finalBookings = await prisma.booking.findMany({
      where: {
        service: {
          providerId,
        },
      },
      include: {
        service: true,
        payment: true,
      },
    });

    console.log(`\n✅ Profile completion finished!`);
    console.log(`\n📊 Final Stats:`);
    console.log(`   - Services: ${createdServices.length}`);
    console.log(`   - Total Bookings: ${finalBookings.length}`);
    console.log(`   - Successful: ${finalBookings.filter((b) => b.status === 'completed').length}`);
    console.log(`   - Cancelled: ${finalBookings.filter((b) => b.status === 'cancelled').length}`);
    console.log(
      `   - Pending: ${finalBookings.filter((b) => b.status === 'pending' || b.requestStatus === 'pending').length}`
    );
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

completeOscarProfileWithBookings();
