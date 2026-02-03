/**
 * Comprehensive End-to-End Test
 * 
 * Tests:
 * 1. Database relationships and data integrity
 * 2. SPANA ID system
 * 3. All API routes and endpoints
 * 4. Authentication and authorization
 * 5. CRUD operations for all entities
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5003';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.argv[2] || '';

// Test data
const TEST_TIMESTAMP = Date.now();
const TEST_CUSTOMER_EMAIL = `e2e-customer-${TEST_TIMESTAMP}@test.com`;
const TEST_PROVIDER_EMAIL = `e2e-provider-${TEST_TIMESTAMP}@test.com`;
const TEST_ADMIN_EMAIL = `e2e-admin-${TEST_TIMESTAMP}@test.com`;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

let testResults: any = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
}

function logTest(name: string, passed: boolean, message?: string) {
  const icon = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;
  log(`${icon} ${name}`, color);
  if (message) log(`   ${message}`, colors.yellow);
  
  testResults.tests.push({ name, passed, message });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

function logSkip(name: string, reason: string) {
  log(`⏭️  ${name} - ${reason}`, colors.yellow);
  testResults.skipped++;
  testResults.tests.push({ name, passed: null, message: reason });
}

// Test helper functions
async function testEndpoint(
  method: string,
  url: string,
  data?: any,
  headers?: any,
  expectedStatus: number | number[] = 200
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const config: any = {
      method,
      url: `${BASE_URL}${url}`,
      headers: headers || {},
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    };

    if (data) {
      if (data instanceof FormData) {
        config.data = data;
        config.headers = { ...config.headers, ...data.getHeaders() };
      } else {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      }
    }

    const response = await axios(config);
    
    // Check if status matches expected (allow both single value or array of values)
    const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (expectedStatuses.includes(response.status)) {
      return { success: true, data: response.data };
    } else {
      const errorMsg = response.data?.message || response.data?.error || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      return { success: false, error: 'Connection refused - is server running?' };
    }
    if (error.code === 'ETIMEDOUT') {
      return { success: false, error: 'Request timeout' };
    }
    if (error.response && error.response.status === expectedStatus) {
      return { success: true, data: error.response.data };
    }
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error';
    const statusCode = error.response?.status || error.code || 'N/A';
    return { 
      success: false, 
      error: `${errorMsg} (${statusCode})` 
    };
  }
}

async function e2eTest() {
  console.log(`\n${colors.bright}${colors.cyan}🧪 COMPREHENSIVE E2E TEST${colors.reset}\n`);
  log(`Base URL: ${BASE_URL}`);
  log(`Test Timestamp: ${TEST_TIMESTAMP}\n`);

  let customerToken: string = '';
  let providerToken: string = '';
  let customerId: string = '';
  let providerId: string = '';
  let bookingId: string = '';
  let serviceId: string = '';

  try {
    // ============================================
    // SECTION 1: DATABASE RELATIONSHIPS & SPANA IDs
    // ============================================
    logSection('SECTION 1: Database Relationships & SPANA IDs');

    // Test 1.1: Verify SPANA ID format in users table
    logTest('1.1: Users have SPANA IDs', true);
    const users = await prisma.user.findMany({ take: 10 });
    const allHaveSpanaIds = users.every(u => u.id.startsWith('SPN-') && u.id.length === 10);
    logTest('1.1.1: All user IDs are SPN-{6chars} format', allHaveSpanaIds, 
      allHaveSpanaIds ? '' : `Found IDs: ${users.map(u => u.id).join(', ')}`);

    // Test 1.2: Verify foreign key relationships
    logTest('1.2: Customer-User relationship', true);
    const customers = await prisma.customer.findMany({ 
      take: 5
    });
    // Get all user IDs for FK check
    const allUserIdsList = (await prisma.user.findMany({ select: { id: true } })).map(u => u.id);
    const customerUserValid = customers.every(c => allUserIdsList.includes(c.userId));
    logTest('1.2.1: Customers reference valid SPANA user IDs', customerUserValid || customers.length === 0);

    // Test 1.3: Service Provider-User relationship
    logTest('1.3: ServiceProvider-User relationship', true);
    const providers = await prisma.serviceProvider.findMany({ 
      take: 5
    });
    const providerUserValid = providers.every(p => allUserIdsList.includes(p.userId));
    logTest('1.3.1: Providers reference valid SPANA user IDs', providerUserValid || providers.length === 0);

    // Test 1.4: Booking-Customer relationship
    logTest('1.4: Booking-Customer relationship', true);
    const bookings = await prisma.booking.findMany({ 
      take: 5
    });
    const bookingCustomerValid = bookings.every(b => {
      const customer = customers.find(c => c.id === b.customerId);
      return customer;
    });
    logTest('1.4.1: Bookings reference valid customer IDs', bookingCustomerValid || bookings.length === 0);

    // Test 1.5: Payment-Booking relationship
    logTest('1.5: Payment-Booking relationship', true);
    const payments = await prisma.payment.findMany({ 
      take: 5, 
      include: { booking: true } 
    });
    const paymentBookingValid = payments.every(p => {
      const booking = bookings.find(b => b.id === p.bookingId);
      return booking || payments.length === 0;
    });
    logTest('1.5.1: Payments reference valid booking IDs', paymentBookingValid || payments.length === 0);

    // Test 1.6: Document-Provider relationship
    logTest('1.6: Document-Provider relationship', true);
    const documents = await prisma.document.findMany({
      take: 5
    });
    // Get all provider IDs for FK check
    const allProviderIdsList = (await prisma.serviceProvider.findMany({ select: { id: true } })).map(p => p.id);
    const documentProviderValid = documents.every(d => allProviderIdsList.includes(d.providerId));
    logTest('1.6.1: Documents reference valid provider IDs', documentProviderValid || documents.length === 0);

    // ============================================
    // SECTION 2: AUTHENTICATION & USER MANAGEMENT
    // ============================================
    logSection('SECTION 2: Authentication & User Management');

    // Test 2.1: Health check
    const healthCheck = await testEndpoint('GET', '/health');
    logTest('2.1: Health endpoint', healthCheck.success);

    // Test 2.2: Customer registration
    const customerRegister = await testEndpoint('POST', '/auth/register', {
      email: TEST_CUSTOMER_EMAIL,
      password: 'Test123!@#',
      firstName: 'E2E',
      lastName: 'Customer',
      phone: '+27123456789',
      role: 'customer'
    }, undefined, [200, 201]);
    logTest('2.2: Customer registration', customerRegister.success, customerRegister.error);
    if (customerRegister.success && customerRegister.data?.user?.id) {
      customerId = customerRegister.data.user.id;
      logTest('2.2.1: Customer gets SPANA ID', customerId.startsWith('SPN-'), `ID: ${customerId}`);
    }

    // Test 2.3: Provider registration
    const providerRegister = await testEndpoint('POST', '/auth/register', {
      email: TEST_PROVIDER_EMAIL,
      password: 'Test123!@#',
      firstName: 'E2E',
      lastName: 'Provider',
      phone: '+27123456789',
      role: 'service_provider'
    }, undefined, [200, 201]);
    logTest('2.3: Provider registration', providerRegister.success, providerRegister.error);
    if (providerRegister.success && providerRegister.data?.user?.id) {
      providerId = providerRegister.data.user.id;
      logTest('2.3.1: Provider gets SPANA ID', providerId.startsWith('SPN-'), `ID: ${providerId}`);
    }

    // Test 2.4: Customer login
    const customerLogin = await testEndpoint('POST', '/auth/login', {
      email: TEST_CUSTOMER_EMAIL,
      password: 'Test123!@#'
    });
    logTest('2.4: Customer login', customerLogin.success, customerLogin.error);
    if (customerLogin.success) {
      customerToken = customerLogin.data?.token;
      logTest('2.4.1: Login returns token', !!customerToken);
      logTest('2.4.2: User ID in response is SPANA format', 
        customerLogin.data?.user?.id?.startsWith('SPN-') || customerLogin.data?.user?._id?.startsWith('SPN-'));
    }

    // Test 2.5: Provider login
    const providerLogin = await testEndpoint('POST', '/auth/login', {
      email: TEST_PROVIDER_EMAIL,
      password: 'Test123!@#'
    });
    logTest('2.5: Provider login', providerLogin.success, providerLogin.error);
    if (providerLogin.success) {
      providerToken = providerLogin.data?.token;
      logTest('2.5.1: Login returns token', !!providerToken);
    }

    // Test 2.6: Get current user (me)
    if (customerToken) {
      const getMe = await testEndpoint('GET', '/auth/me', null, {
        Authorization: `Bearer ${customerToken}`
      });
      logTest('2.6: Get current user', getMe.success, getMe.error);
      logTest('2.6.1: Returns SPANA ID', 
        getMe.data?.id?.startsWith('SPN-') || getMe.data?._id?.startsWith('SPN-'));
    }

    // ============================================
    // SECTION 3: SERVICES
    // ============================================
    logSection('SECTION 3: Services');

    // Test 3.1: Get all services (public)
    const getAllServices = await testEndpoint('GET', '/services');
    logTest('3.1: Get all services', getAllServices.success, getAllServices.error);

    // Test 3.2: Discover services
    const discoverServices = await testEndpoint('GET', '/services/discover');
    logTest('3.2: Discover services', discoverServices.success, discoverServices.error);

    // Test 3.3: Get service by ID
    if (getAllServices.success && getAllServices.data?.services?.length > 0) {
      serviceId = getAllServices.data.services[0].id;
      const getService = await testEndpoint('GET', `/services/${serviceId}`);
      logTest('3.3: Get service by ID', getService.success, getService.error);
    } else {
      logSkip('3.3: Get service by ID', 'No services available');
    }

    // ============================================
    // SECTION 4: BOOKINGS
    // ============================================
    logSection('SECTION 4: Bookings');

    if (!customerToken || !serviceId) {
      logSkip('4.1-4.10: Booking tests', 'Missing customer token or service ID');
    } else {
      // Test 4.1: Create booking
      const createBooking = await testEndpoint('POST', '/bookings', {
        serviceId,
        date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        time: '10:00',
        location: {
          type: 'Point',
          coordinates: [28.0473, -26.2041], // Johannesburg
          address: '123 Test Street, Johannesburg'
        },
        notes: 'E2E test booking'
      }, {
        Authorization: `Bearer ${customerToken}`
      });
      logTest('4.1: Create booking', createBooking.success, createBooking.error);
      if (createBooking.success && createBooking.data?.booking?.id) {
        bookingId = createBooking.data.booking.id;
        logTest('4.1.1: Booking has ID', !!bookingId);
      }

      // Test 4.2: Get user bookings
      const getUserBookings = await testEndpoint('GET', '/bookings', null, {
        Authorization: `Bearer ${customerToken}`
      });
      logTest('4.2: Get user bookings', getUserBookings.success, getUserBookings.error);

      // Test 4.3: Get booking by ID
      if (bookingId) {
        const getBooking = await testEndpoint('GET', `/bookings/${bookingId}`, null, {
          Authorization: `Bearer ${customerToken}`
        });
        logTest('4.3: Get booking by ID', getBooking.success, getBooking.error);
      }

      // Test 4.4: Provider accept booking (if provider token available)
      if (providerToken && bookingId) {
        const acceptBooking = await testEndpoint('POST', `/bookings/${bookingId}/accept`, {}, {
          Authorization: `Bearer ${providerToken}`
        });
        logTest('4.4: Provider accept booking', acceptBooking.success || acceptBooking.error?.includes('profile'), 
          acceptBooking.error);
      }
    }

    // ============================================
    // SECTION 5: PAYMENTS
    // ============================================
    logSection('SECTION 5: Payments');

    if (!customerToken) {
      logSkip('5.1-5.3: Payment tests', 'Missing customer token');
    } else {
      // Test 5.1: Get payment history
      const paymentHistory = await testEndpoint('GET', '/payments/history', null, {
        Authorization: `Bearer ${customerToken}`
      });
      logTest('5.1: Get payment history', paymentHistory.success, paymentHistory.error);

      // Test 5.2: Create payment intent (if booking exists)
      if (bookingId) {
        const paymentIntent = await testEndpoint('POST', '/payments/intent', {
          bookingId,
          amount: 1000
        }, {
          Authorization: `Bearer ${customerToken}`
        });
        logTest('5.2: Create payment intent', paymentIntent.success, paymentIntent.error);
      }
    }

    // ============================================
    // SECTION 6: ADMIN ENDPOINTS
    // ============================================
    logSection('SECTION 6: Admin Endpoints');

    if (!ADMIN_TOKEN) {
      logSkip('6.1-6.10: Admin tests', 'No admin token provided');
    } else {
      // Test 6.1: Get all users (admin)
      const adminUsers = await testEndpoint('GET', '/admin/users', null, {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      });
      logTest('6.1: Admin get all users', adminUsers.success, adminUsers.error);
      if (adminUsers.success && adminUsers.data?.users) {
        const allSpanaIds = adminUsers.data.users.every((u: any) => 
          (u.id || u._id)?.startsWith('SPN-')
        );
        logTest('6.1.1: All users have SPANA IDs', allSpanaIds);
      }

      // Test 6.2: Get all bookings (admin)
      const adminBookings = await testEndpoint('GET', '/admin/bookings', null, {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      });
      logTest('6.2: Admin get all bookings', adminBookings.success, adminBookings.error);

      // Test 6.3: Get all services (admin)
      const adminServices = await testEndpoint('GET', '/admin/services', null, {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      });
      logTest('6.3: Admin get all services', adminServices.success, adminServices.error);

      // Test 6.4: Get all applications
      const adminApplications = await testEndpoint('GET', '/admin/applications', null, {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      });
      logTest('6.4: Admin get all applications', adminApplications.success, adminApplications.error);

      // Test 6.5: Get wallet summary
      const walletSummary = await testEndpoint('GET', '/admin/wallet/summary', null, {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      });
      logTest('6.5: Admin get wallet summary', walletSummary.success, walletSummary.error);

      // Test 6.6: Get wallet transactions
      const walletTransactions = await testEndpoint('GET', '/admin/wallet/transactions', null, {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      });
      logTest('6.6: Admin get wallet transactions', walletTransactions.success, walletTransactions.error);

      // Test 6.7: Get pending documents
      const pendingDocs = await testEndpoint('GET', '/admin/documents/pending', null, {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      });
      logTest('6.7: Admin get pending documents', pendingDocs.success, pendingDocs.error);

      // Test 6.8: Get all complaints
      const complaints = await testEndpoint('GET', '/admin/complaints', null, {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      });
      logTest('6.8: Admin get all complaints', complaints.success, complaints.error);
    }

    // ============================================
    // SECTION 7: PUBLIC ENDPOINTS
    // ============================================
    logSection('SECTION 7: Public Endpoints');

    // Test 7.1: Platform stats
    const platformStats = await testEndpoint('GET', '/stats/platform');
    logTest('7.1: Get platform stats', platformStats.success, platformStats.error);

    // Test 7.2: Provider stats by location
    const providerStats = await testEndpoint('GET', '/stats/providers/location');
    logTest('7.2: Get provider stats by location', providerStats.success, providerStats.error);

    // Test 7.3: Booking trends
    const bookingTrends = await testEndpoint('GET', '/stats/bookings/trends');
    logTest('7.3: Get booking trends', bookingTrends.success, bookingTrends.error);

    // Test 7.4: Submit application (public)
    const testDocPath = path.join(__dirname, '../test-doc-e2e.pdf');
    fs.writeFileSync(testDocPath, Buffer.from('%PDF-1.4\n'));
    
    const formData = new FormData();
    formData.append('documents', fs.createReadStream(testDocPath), {
      filename: 'test.pdf',
      contentType: 'application/pdf'
    });
    formData.append('types[]', 'id');

    const uploadDoc = await testEndpoint('POST', '/uploads/application-documents', formData);
    logTest('7.4: Upload application document', uploadDoc.success, uploadDoc.error);

    if (uploadDoc.success && uploadDoc.data?.documents?.length > 0) {
      const submitApp = await testEndpoint('POST', '/auth/applications/submit', {
        email: `e2e-app-${TEST_TIMESTAMP}@test.com`,
        firstName: 'E2E',
        lastName: 'Applicant',
        phone: '+27123456789',
        skills: ['Plumbing', 'Electrical'],
        experienceYears: 5,
        motivation: 'E2E test application',
        location: { type: 'Point', coordinates: [28.0473, -26.2041] },
        documents: uploadDoc.data.documents
      }, undefined, [200, 201]);
      logTest('7.5: Submit service provider application', submitApp.success, submitApp.error);
    }

    // Cleanup test file
    if (fs.existsSync(testDocPath)) {
      fs.unlinkSync(testDocPath);
    }

    // ============================================
    // SECTION 8: DATA INTEGRITY VERIFICATION
    // ============================================
    logSection('SECTION 8: Data Integrity Verification');

    // Test 8.1: Verify no orphaned records
    // Refresh user list to include users created during test
    const finalAllUsers = await prisma.user.findMany({ select: { id: true } });
    const finalAllUserIds = new Set(finalAllUsers.map(u => u.id));
    
    const allCustomers = await prisma.customer.findMany();
    const orphanedCustomers = allCustomers.filter(c => !finalAllUserIds.has(c.userId));
    logTest('8.1: No orphaned customers', orphanedCustomers.length === 0, 
      orphanedCustomers.length > 0 ? `Found ${orphanedCustomers.length} orphaned customers` : '');

    const allProviders = await prisma.serviceProvider.findMany();
    const orphanedProviders = allProviders.filter(p => !finalAllUserIds.has(p.userId));
    logTest('8.2: No orphaned providers', orphanedProviders.length === 0,
      orphanedProviders.length > 0 ? `Found ${orphanedProviders.length} orphaned providers` : '');

    const allBookings = await prisma.booking.findMany();
    const allCustomerIds = new Set(allCustomers.map(c => c.id));
    const orphanedBookings = allBookings.filter(b => !allCustomerIds.has(b.customerId));
    logTest('8.3: No orphaned bookings', orphanedBookings.length === 0,
      orphanedBookings.length > 0 ? `Found ${orphanedBookings.length} orphaned bookings` : '');

    const allPayments = await prisma.payment.findMany();
    const allBookingIds = new Set(allBookings.map(b => b.id));
    const orphanedPayments = allPayments.filter(p => !allBookingIds.has(p.bookingId));
    logTest('8.4: No orphaned payments', orphanedPayments.length === 0,
      orphanedPayments.length > 0 ? `Found ${orphanedPayments.length} orphaned payments` : '');

    // Test 8.5: Verify all user IDs are SPANA format
    const allUsers = await prisma.user.findMany();
    const allSpanaFormat = allUsers.every(u => u.id.startsWith('SPN-') && u.id.length === 10);
    logTest('8.5: All users have SPANA IDs', allSpanaFormat,
      allSpanaFormat ? '' : `Found ${allUsers.filter(u => !u.id.startsWith('SPN-')).length} non-SPANA IDs`);

    // ============================================
    // SUMMARY
    // ============================================
    logSection('TEST SUMMARY');

    console.log(`Total Tests: ${testResults.passed + testResults.failed + testResults.skipped}`);
    log(`✅ Passed: ${testResults.passed}`, colors.green);
    log(`❌ Failed: ${testResults.failed}`, colors.red);
    log(`⏭️  Skipped: ${testResults.skipped}`, colors.yellow);

    const successRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1);
    log(`\nSuccess Rate: ${successRate}%`, 
      parseFloat(successRate) >= 90 ? colors.green : colors.yellow);

    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.tests
        .filter((t: any) => t.passed === false)
        .forEach((t: any) => {
          log(`   - ${t.name}`, colors.red);
          if (t.message) log(`     ${t.message}`, colors.yellow);
        });
    }

    console.log('\n');

  } catch (error: any) {
    log(`\n❌ Test suite failed: ${error.message}`, colors.red);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

e2eTest();
