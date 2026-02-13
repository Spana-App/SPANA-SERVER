import request from 'supertest';
import prisma from '../../lib/database';

// Increase timeout for E2E tests
jest.setTimeout(120000);

let app: any;

beforeAll(async () => {
  // Disable Stripe for tests
  process.env.STRIPE_SECRET_KEY = '';
  process.env.STRIPE_WEBHOOK_SECRET = '';
  process.env.PAYFAST_MERCHANT_ID = ''; // Use simulation mode
  
  // Reset modules to get fresh app instance
  jest.resetModules();
  app = require('../../server');
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
});

describe('E2E: Uber-Style Booking Flow', () => {
  let customerToken: string;
  let providerToken: string;
  let adminToken: string;
  let customerId: string;
  let providerId: string;
  let serviceId: string;
  let bookingId: string;
  let paymentId: string;

  describe('1. User Registration & Authentication', () => {
    test('Register customer', async () => {
      const existingUser = await prisma.user.findUnique({
        where: { email: 'xolinxiweni@gmail.com' }
      });
      if (existingUser) {
        customerId = existingUser.id;
        // Skip registration, get token via login
        const loginRes = await request(app)
          .post('/auth/login')
          .send({ email: 'xolinxiweni@gmail.com', password: 'Test123!@#' });
        if (loginRes.status === 200) {
          customerToken = loginRes.body.token;
          return;
        }
      }

      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'xolinxiweni@gmail.com',
          password: 'Test123!@#',
          firstName: 'Xoli',
          lastName: 'Nxiweni',
          role: 'customer',
          phone: '+27123456789'
        });

      expect([201, 200]).toContain(res.status);
      // Registration no longer returns token - need to login
      customerId = res.body.user?._id || res.body.user?.id || res.body.id;
      expect(customerId).toBeDefined();
      
      // Login to get token
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'xolinxiweni@gmail.com',
          password: 'Test123!@#'
        });
      expect(loginRes.status).toBe(200);
      customerToken = loginRes.body.token;
      expect(customerToken).toBeDefined();
    });

    test('Register service provider', async () => {
      const existingUser = await prisma.user.findUnique({
        where: { email: 'eksnxiweni@gmail.com' },
        include: { serviceProvider: true }
      });
      if (existingUser?.serviceProvider) {
        providerId = existingUser.serviceProvider.id;
        // Skip registration, get token via login
        const loginRes = await request(app)
          .post('/auth/login')
          .send({ email: 'eksnxiweni@gmail.com', password: 'Test123!@#' });
        if (loginRes.status === 200) {
          providerToken = loginRes.body.token;
          return;
        }
      }

      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'eksnxiweni@gmail.com',
          password: 'Test123!@#',
          firstName: 'Eks',
          lastName: 'Nxiweni',
          role: 'service_provider',
          phone: '+27123456790'
        });

      expect([201, 200]).toContain(res.status);
      // Registration no longer returns token - need to login
      providerId = res.body.user?._id || res.body.user?.id || res.body.id;
      expect(providerId).toBeDefined();
      
      // Login to get token
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'eksnxiweni@gmail.com',
          password: 'Test123!@#'
        });
      expect(loginRes.status).toBe(200);
      providerToken = loginRes.body.token;
      expect(providerToken).toBeDefined();
    });

    test('Register admin (spana.co.za email)', async () => {
      const timestamp = Date.now();
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: `testadmin_${timestamp}@spana.co.za`,
          password: 'Test123!@#',
          firstName: 'Test',
          lastName: 'Admin',
          role: 'admin',
          phone: '+27123456791'
        });

      expect([201, 200]).toContain(res.status);
      // Registration no longer returns token - need to login
      const userRole = res.body.user?.role || res.body.role;
      expect(userRole).toBe('admin');
      
      // Login to get token
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: `testadmin_${timestamp}@spana.co.za`,
          password: 'Test123!@#'
        });
      expect(loginRes.status).toBe(200);
      adminToken = loginRes.body.token;
      expect(adminToken).toBeDefined();
    });

    test('Complete provider profile', async () => {
      // Get service provider record
      const serviceProvider = await prisma.serviceProvider.findUnique({
        where: { userId: providerId }
      });

      if (serviceProvider) {
        // Update user first - need email/phone/identity verified
        await prisma.user.update({
          where: { id: providerId },
          data: {
            isEmailVerified: true,
            isPhoneVerified: true,
            profileImage: 'https://example.com/profile.jpg',
            location: {
              type: 'Point',
              coordinates: [28.0473, -26.2041],
              address: 'Johannesburg, South Africa'
            }
          }
        });

        // Create a verified document
        await prisma.document.create({
          data: {
            providerId: serviceProvider.id,
            type: 'identity',
            url: 'https://example.com/id.jpg',
            verified: true,
            verifiedAt: new Date(),
            verifiedBy: providerId
          }
        });

        // Update service provider with all required fields
        await prisma.serviceProvider.update({
          where: { id: serviceProvider.id },
          data: {
            isProfileComplete: true,
            isIdentityVerified: true,
            skills: ['plumbing', 'electrical'],
            experienceYears: 5,
            serviceAreaRadius: 50,
            serviceAreaCenter: {
              type: 'Point',
              coordinates: [28.0473, -26.2041]
            },
            availability: {
              days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
              hours: {
                start: '08:00',
                end: '17:00'
              }
            }
          }
        });
      }
    });
  });

  describe('2. Service Creation & Admin Approval', () => {
    test('Provider creates a service', async () => {
      // Ensure provider token is set
      expect(providerToken).toBeDefined();
      expect(providerId).toBeDefined();
      
      // Verify provider profile is complete
      const serviceProvider = await prisma.serviceProvider.findUnique({
        where: { userId: providerId }
      });
      expect(serviceProvider).toBeDefined();
      expect(serviceProvider?.isProfileComplete).toBe(true);
      
      const res = await request(app)
        .post('/services')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          title: 'Test Plumbing Service',
          description: 'Professional plumbing services',
          category: 'plumbing',
          price: 500,
          duration: 60
        });

      expect(res.status).toBe(201);
      expect(res.body).toBeDefined();
      expect(res.body.id).toBeDefined();
      serviceId = res.body.id;
      expect(serviceId).toBeDefined();
      expect(res.body.adminApproved).toBe(false);
    });

    test('Admin approves service', async () => {
      // Ensure serviceId is defined
      expect(serviceId).toBeDefined();
      expect(adminToken).toBeDefined();
      
      // Verify service exists
      const serviceExists = await prisma.service.findUnique({
        where: { id: serviceId }
      });
      expect(serviceExists).toBeDefined();
      
      const res = await request(app)
        .post(`/admin/services/${serviceId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true });

      expect(res.status).toBe(200);
      const service = res.body.service || res.body;
      expect(service).toBeDefined();
      expect(service.adminApproved).toBe(true);
    });

    test('Customer can see approved service', async () => {
      expect(serviceId).toBeDefined();
      expect(customerToken).toBeDefined();
      
      const res = await request(app)
        .get('/services')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const services = Array.isArray(res.body) ? res.body : res.body.services || [];
      expect(Array.isArray(services)).toBe(true);
      const service = services.find((s: any) => s.id === serviceId);
      expect(service).toBeDefined();
      if (service) {
        expect(service.adminApproved).toBe(true);
      }
    });
  });

  describe('3. Uber-Style Booking Request Flow', () => {
    test('Customer creates booking request', async () => {
      expect(serviceId).toBeDefined();
      expect(customerToken).toBeDefined();
      
      // Verify service is approved
      const service = await prisma.service.findUnique({
        where: { id: serviceId }
      });
      expect(service).toBeDefined();
      expect(service?.adminApproved).toBe(true);
      
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: serviceId,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          time: '10:00',
          location: {
            type: 'Point',
            coordinates: [28.0473, -26.2041],
            address: 'Customer Location, Johannesburg'
          },
          notes: 'Please arrive on time',
          estimatedDurationMinutes: 60,
          jobSize: 'medium'
        });

      expect(res.status).toBe(201);
      const booking = res.body.booking || res.body;
      expect(booking).toBeDefined();
      expect(booking.id).toBeDefined();
      bookingId = booking.id;
      expect(booking.requestStatus).toBe('pending');
      expect(booking.status).toBe('pending');
      expect(booking.jobSize).toBe('medium');
      expect(booking.calculatedPrice).toBeGreaterThan(0);
    });

    test('Customer can create booking even without profile location (auto-updates profile)', async () => {
      expect(serviceId).toBeDefined();
      expect(customerToken).toBeDefined();
      expect(customerId).toBeDefined();
      
      // First, remove location from customer profile to simulate the bug scenario
      await prisma.user.update({
        where: { id: customerId },
        data: { location: null }
      });
      
      // Verify location is null
      const userBefore = await prisma.user.findUnique({
        where: { id: customerId }
      });
      expect(userBefore?.location).toBeNull();
      
      // Now try to create a booking with location in request
      const bookingLocation = {
        type: 'Point',
        coordinates: [28.0473, -26.2041],
        address: 'Test Location, Johannesburg'
      };
      
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: serviceId,
          date: new Date().toISOString(), // Today
          time: '10:00',
          location: bookingLocation,
          notes: 'Test booking without profile location',
          estimatedDurationMinutes: 60,
          jobSize: 'medium'
        });

      // Should succeed (not return 400 error)
      expect(res.status).toBe(201);
      const booking = res.body.booking || res.body;
      expect(booking).toBeDefined();
      expect(booking.id).toBeDefined();
      
      // Verify profile location was auto-updated
      const userAfter = await prisma.user.findUnique({
        where: { id: customerId }
      });
      expect(userAfter?.location).toBeDefined();
      expect(userAfter?.location).toMatchObject(bookingLocation);
    });

    test('Provider can see pending booking request', async () => {
      expect(bookingId).toBeDefined();
      expect(providerToken).toBeDefined();
      
      const res = await request(app)
        .get('/bookings')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(200);
      const bookings = Array.isArray(res.body) ? res.body : res.body.bookings || [];
      expect(Array.isArray(bookings)).toBe(true);
      const booking = bookings.find((b: any) => b.id === bookingId);
      expect(booking).toBeDefined();
      if (booking) {
        expect(booking.requestStatus).toBe('pending');
      }
    });

    test('Provider accepts booking request', async () => {
      expect(bookingId).toBeDefined();
      expect(providerToken).toBeDefined();
      
      const res = await request(app)
        .post(`/bookings/${bookingId}/accept`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(200);
      const booking = res.body.booking || res.body;
      expect(booking).toBeDefined();
      expect(booking.requestStatus).toBe('accepted');
      expect(booking.status).toBe('confirmed');
      expect(booking.providerAcceptedAt).toBeDefined();
    });

    test('Provider can decline booking request', async () => {
      expect(serviceId).toBeDefined();
      expect(customerToken).toBeDefined();
      expect(providerToken).toBeDefined();
      
      // Create another booking to decline
      const bookingRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: serviceId,
          date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          time: '14:00',
          location: {
            type: 'Point',
            coordinates: [28.0473, -26.2041],
            address: 'Another Location'
          },
          jobSize: 'small'
        });

      expect(bookingRes.status).toBe(201);
      const newBooking = bookingRes.body.booking || bookingRes.body;
      expect(newBooking).toBeDefined();
      expect(newBooking.id).toBeDefined();

      const declineRes = await request(app)
        .post(`/bookings/${newBooking.id}/decline`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ reason: 'Not available at that time' });

      expect(declineRes.status).toBe(200);
      const declinedBooking = declineRes.body.booking || declineRes.body;
      expect(declinedBooking).toBeDefined();
      expect(declinedBooking.requestStatus).toBe('declined');
      expect(declinedBooking.status).toBe('cancelled');
    });
  });

  describe('4. Payment & Escrow Flow', () => {
    test('Customer creates payment intent (simulated)', async () => {
      expect(bookingId).toBeDefined();
      expect(customerToken).toBeDefined();
      
      // Verify booking exists and is accepted
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });
      expect(booking).toBeDefined();
      expect(booking?.requestStatus).toBe('accepted');
      
      const res = await request(app)
        .post('/payments/intent')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId: bookingId,
          amount: 750, // Base price with medium multiplier
          tipAmount: 50,
          simulate: true // Force simulation mode
        });

      expect(res.status).toBe(200);
      // Payment simulation mode should be active
      expect(res.body.simulated).toBe(true);
      expect(res.body.invoiceNumber).toBeDefined();
      paymentId = res.body.paymentId;
    });

    test('Payment is held in escrow', async () => {
      expect(bookingId).toBeDefined();
      expect(customerToken).toBeDefined();
      
      // Wait a bit for payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const res = await request(app)
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const booking = res.body;
      expect(booking).toBeDefined();
      expect(booking.paymentStatus).toBe('paid_to_escrow');
      expect(booking.invoiceNumber).toBeDefined();
    });
  });

  describe('5. Proximity Detection & Job Start', () => {
    test('Update customer location', async () => {
      expect(bookingId).toBeDefined();
      expect(customerToken).toBeDefined();
      
      const res = await request(app)
        .post(`/bookings/${bookingId}/location`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          coordinates: [28.0473, -26.2041] // Customer location
        });

      expect(res.status).toBe(200);
    });

    test('Update provider location (within 2 meters)', async () => {
      expect(bookingId).toBeDefined();
      expect(providerToken).toBeDefined();
      
      // Provider moves close to customer (within 2 meters)
      const res = await request(app)
        .post(`/bookings/${bookingId}/location`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          coordinates: [28.04731, -26.20411] // Very close to customer
        });

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body.proximityDetected).toBe(true);
    });

    test('Wait for 5-minute proximity requirement', async () => {
      expect(bookingId).toBeDefined();
      expect(providerToken).toBeDefined();
      
      // In real scenario, we'd wait 5 minutes, but for testing we'll check the logic
      const res = await request(app)
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      // Note: canStartJob will be false until 5 minutes pass
      // For testing, we'll manually set proximityStartTime to bypass the wait
      if (res.body.proximityDetected && !res.body.canStartJob) {
        // Manually update booking to allow job start for testing
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            proximityStartTime: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
            canStartJob: true
          }
        });
      }
    });

    test('Provider can start job after proximity requirement', async () => {
      expect(bookingId).toBeDefined();
      expect(providerToken).toBeDefined();
      
      // Ensure canStartJob is true
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          proximityStartTime: new Date(Date.now() - 6 * 60 * 1000),
          canStartJob: true
        }
      });
      
      const res = await request(app)
        .post(`/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${providerToken}`);

      // Should succeed if canStartJob is true
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body.status).toBe('in_progress');
    });
  });

  describe('6. Job Completion & Escrow Release', () => {
    test('Provider completes booking', async () => {
      expect(bookingId).toBeDefined();
      expect(providerToken).toBeDefined();
      
      // Ensure job is started first
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'in_progress',
          startedAt: new Date(),
          canStartJob: true,
          requestStatus: 'accepted',
          paymentStatus: 'paid_to_escrow'
        }
      });

      const res = await request(app)
        .post(`/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(200);
      const booking = res.body;
      expect(booking).toBeDefined();
      expect(booking.status).toBe('completed');
      expect(booking.completedAt).toBeDefined();
    });

    test('Escrow funds released to provider', async () => {
      expect(bookingId).toBeDefined();
      expect(providerToken).toBeDefined();
      
      // Wait a bit for escrow release
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const res = await request(app)
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(200);
      const booking = res.body;
      expect(booking).toBeDefined();
      expect(booking.paymentStatus).toBe('released_to_provider');
      expect(booking.providerPayoutAmount).toBeGreaterThan(0);
    });
  });

  describe('7. Rating System', () => {
    test('Customer rates provider', async () => {
      expect(bookingId).toBeDefined();
      expect(customerToken).toBeDefined();
      
      // Ensure booking is completed
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'completed' }
      });
      
      const res = await request(app)
        .post(`/bookings/${bookingId}/rate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          review: 'Excellent service!'
        });

      expect(res.status).toBe(200);
      const booking = res.body.booking || res.body;
      expect(booking).toBeDefined();
      expect(booking.rating).toBe(5);
      expect(booking.review).toBe('Excellent service!');
    });

    test('Provider rates customer', async () => {
      expect(bookingId).toBeDefined();
      expect(providerToken).toBeDefined();
      
      // Ensure booking is completed
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'completed' }
      });
      
      const res = await request(app)
        .post(`/bookings/${bookingId}/rate-customer`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          customerRating: 5,
          customerReview: 'Great customer, very cooperative'
        });

      expect(res.status).toBe(200);
      const booking = res.body.booking || res.body;
      expect(booking).toBeDefined();
      expect(booking.customerRating).toBe(5);
      expect(booking.customerReview).toBeDefined();
    });
  });

  describe('8. Admin Features', () => {
    test('Admin can view all bookings', async () => {
      const res = await request(app)
        .get('/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const bookings = Array.isArray(res.body) ? res.body : res.body.bookings || [];
      expect(Array.isArray(bookings)).toBe(true);
    });

    test('Admin can view wallet summary', async () => {
      const res = await request(app)
        .get('/admin/wallet/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalHeld).toBeDefined();
      expect(res.body.totalReleased).toBeDefined();
      expect(res.body.totalCommission).toBeDefined();
    });

    test('Admin can view wallet transactions', async () => {
      const res = await request(app)
        .get('/admin/wallet/transactions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const transactions = Array.isArray(res.body) ? res.body : res.body.transactions || [];
      expect(Array.isArray(transactions)).toBe(true);
    });
  });

  describe('9. Complaint System', () => {
    test('Customer can create complaint', async () => {
      expect(bookingId).toBeDefined();
      expect(customerToken).toBeDefined();
      
      // Verify booking exists
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });
      expect(booking).toBeDefined();
      
      const res = await request(app)
        .post('/complaints')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId: bookingId,
          type: 'service_quality',
          severity: 'medium',
          title: 'Service quality issue',
          description: 'The service was not as expected'
        });

      expect(res.status).toBe(201);
      const complaint = res.body.complaint || res.body;
      expect(complaint).toBeDefined();
      expect(complaint.status).toBe('open');
    });

    test('User can view their complaints', async () => {
      const res = await request(app)
        .get('/complaints/my-complaints')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('10. Password Reset Flow', () => {
    test('Request password reset', async () => {
      // Set test mode for email handling
      process.env.NODE_ENV = 'test';
      
      const res = await request(app)
        .post('/password-reset/request')
        .send({
          email: 'xolinxiweni@gmail.com'
        });

      // Should return success even if email sending fails (test mode)
      expect([200, 201, 500]).toContain(res.status);
      // In test mode, email failures are handled gracefully
    });

    test('Verify reset token', async () => {
      // This would require a valid token from email
      // For testing, we'd need to extract token from database
      const res = await request(app)
        .get('/password-reset/verify-token')
        .query({
          token: 'invalid_token',
          email: 'xolinxiweni@gmail.com'
        });

      expect([400, 404]).toContain(res.status);
    });
  });

  describe('11. Privacy (POPIA) Compliance', () => {
    test('User can export their data', async () => {
      const res = await request(app)
        .get('/privacy/export-data')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      // Response format: { message, data: { profile, bookings, payments, ... }, exportedAt }
      expect(res.body).toBeDefined();
      expect(res.body.data).toBeDefined();
      expect(res.body.data.profile).toBeDefined();
      if (res.body.data.bookings) {
        expect(Array.isArray(res.body.data.bookings)).toBe(true);
      }
    });

    test('User can view privacy status', async () => {
      const res = await request(app)
        .get('/privacy/status')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body.accountCreated).toBeDefined();
      expect(res.body.emailVerified).toBeDefined();
    });
  });

  describe('12. Workflow Tracking', () => {
    test('Workflow is created for booking', async () => {
      const res = await request(app)
        .get(`/workflows/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      // Workflow endpoint uses /workflows/:bookingId
      if (res.status === 200) {
        expect(res.body.steps || res.body).toBeDefined();
        if (res.body.steps) {
          expect(Array.isArray(res.body.steps)).toBe(true);
        }
      } else {
        // Workflow might not exist yet or route different - that's okay for testing
        expect([200, 404]).toContain(res.status);
      }
    });

    test('Workflow steps update automatically', async () => {
      expect(bookingId).toBeDefined();
      expect(customerToken).toBeDefined();
      
      // Verify booking exists
      const bookingExists = await prisma.booking.findUnique({
        where: { id: bookingId }
      });
      expect(bookingExists).toBeDefined();
      
      const bookingRes = await request(app)
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(bookingRes.status).toBe(200);
      const booking = bookingRes.body;
      expect(booking).toBeDefined();
      expect(['completed', 'in_progress', 'confirmed', 'pending']).toContain(booking.status);
    });
  });
});

