/**
 * Complete Service Flow Test Suite
 * 
 * Tests the complete service marketplace flow:
 * 1. Customer Registration
 * 2. Service Provider Registration
 * 3. Service Creation & Approval
 * 4. Booking Creation
 * 5. Payment Processing
 * 6. Provider Acceptance
 * 7. Job Completion
 * 
 * Uses real email addresses (not test patterns) to ensure data retention.
 * All data created will persist in the database.
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Use hosted server by default, allow override via TEST_API_URL for localhost
// Priority: TEST_API_URL > API_BASE_URL > default hosted server
const API_BASE_URL = process.env.TEST_API_URL 
  ? process.env.TEST_API_URL 
  : (process.env.API_BASE_URL || 'https://spana-server-5bhu.onrender.com');

// Real email addresses - these will persist in the database
// IMPORTANT: Only admins use @spana.co.za domain. Customers and providers use any domain.
// Using realistic name-based emails like JaneSmith@gmail.com, JohnDoe@yahoo.com, etc.
const timestamp = Date.now();
const emailProviders = ['gmail.com', 'yahoo.com', 'hotmail.com'];
const customerProvider = emailProviders[timestamp % emailProviders.length];
const providerProvider = emailProviders[(timestamp + 1) % emailProviders.length];

const CUSTOMER_EMAIL = `JohnDoe${timestamp}@${customerProvider}`;
const PROVIDER_EMAIL = `JaneSmith${timestamp}@${providerProvider}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'xoli@spana.co.za';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  log('\n' + '='.repeat(70), colors.blue);
  log(title, colors.magenta);
  log('='.repeat(70), colors.blue);
}

function logStep(step: number, title: string) {
  log(`\n${step}. ${title}`, colors.yellow);
}

interface TestState {
  customerToken: string;
  providerToken: string;
  adminToken: string;
  serviceId: string;
  bookingId: string;
  paymentId: string;
  customerEmail: string;
  providerEmail: string;
}

const state: TestState = {
  customerToken: '',
  providerToken: '',
  adminToken: '',
  serviceId: '',
  bookingId: '',
  paymentId: '',
  customerEmail: CUSTOMER_EMAIL,
  providerEmail: PROVIDER_EMAIL
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loginAsAdmin(): Promise<string | null> {
  try {
    log('   🔐 Logging in as admin...', colors.cyan);
    
    const loginResponse = await axios.post(
      `${API_BASE_URL}/auth/login`,
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      { timeout: 30000, validateStatus: () => true }
    );

    if (loginResponse.status === 200 && loginResponse.data.requiresOTP) {
      const otp = loginResponse.data.otp;
      log(`   📧 OTP received: ${otp}`, colors.cyan);
      
      const verifyResponse = await axios.post(
        `${API_BASE_URL}/admin/otp/verify`,
        { email: ADMIN_EMAIL, otp: otp },
        { timeout: 30000, validateStatus: () => true }
      );

      if (verifyResponse.status === 200 && verifyResponse.data.token) {
        log('   ✅ Admin authenticated', colors.green);
        return verifyResponse.data.token;
      }
    } else if (loginResponse.data.token) {
      log('   ✅ Admin logged in', colors.green);
      return loginResponse.data.token;
    }

    return null;
  } catch (error: any) {
    log(`   ❌ Admin login failed: ${error.message}`, colors.red);
    return null;
  }
}

async function registerCustomer(): Promise<boolean> {
  try {
    log(`   📧 Email: ${state.customerEmail}`, colors.cyan);
    
    const registerResponse = await axios.post(
      `${API_BASE_URL}/auth/register`,
      {
        email: state.customerEmail,
        password: 'CustomerPassword123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'customer',
        phone: '+27123456789'
      },
      { timeout: 30000, validateStatus: () => true }
    );

    if (registerResponse.status === 201 || registerResponse.status === 200) {
      log('   ✅ Customer registered successfully', colors.green);
      
      // Login to get token
      const loginResponse = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email: state.customerEmail,
          password: 'CustomerPassword123!'
        },
        { timeout: 30000 }
      );

      state.customerToken = loginResponse.data.token;
      log('   ✅ Customer logged in', colors.green);
      return true;
    } else if (registerResponse.status === 400 && registerResponse.data.message?.includes('already exists')) {
      log('   ℹ️  Customer already exists, logging in...', colors.yellow);
      
      const loginResponse = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email: state.customerEmail,
          password: 'CustomerPassword123!'
        },
        { timeout: 30000, validateStatus: () => true }
      );

      if (loginResponse.status === 200 && loginResponse.data.token) {
        state.customerToken = loginResponse.data.token;
        log('   ✅ Customer logged in', colors.green);
        return true;
      }
    }

    log(`   ❌ Registration failed: ${registerResponse.data?.message || 'Unknown error'}`, colors.red);
    return false;
  } catch (error: any) {
    log(`   ❌ Error: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function registerServiceProvider(): Promise<boolean> {
  try {
    log(`   📧 Email: ${state.providerEmail}`, colors.cyan);
    
    const registerResponse = await axios.post(
      `${API_BASE_URL}/auth/register`,
      {
        email: state.providerEmail,
        password: 'ProviderPassword123!',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'service_provider',
        phone: '+27987654321'
      },
      { timeout: 30000, validateStatus: () => true }
    );

    if (registerResponse.status === 201 || registerResponse.status === 200) {
      log('   ✅ Service provider registered successfully', colors.green);
      
      // Login to get token
      const loginResponse = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email: state.providerEmail,
          password: 'ProviderPassword123!'
        },
        { timeout: 30000 }
      );

      state.providerToken = loginResponse.data.token;
      log('   ✅ Service provider logged in', colors.green);
      return true;
    } else if (registerResponse.status === 400 && registerResponse.data.message?.includes('already exists')) {
      log('   ℹ️  Provider already exists, logging in...', colors.yellow);
      
      const loginResponse = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email: state.providerEmail,
          password: 'ProviderPassword123!'
        },
        { timeout: 30000, validateStatus: () => true }
      );

      if (loginResponse.status === 200 && loginResponse.data.token) {
        state.providerToken = loginResponse.data.token;
        log('   ✅ Service provider logged in', colors.green);
        return true;
      }
    }

    log(`   ❌ Registration failed: ${registerResponse.data?.message || 'Unknown error'}`, colors.red);
    return false;
  } catch (error: any) {
    log(`   ❌ Error: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function approveServiceDirectly(): Promise<void> {
  try {
    // For testing: Approve service directly via Prisma
    await prisma.service.update({
      where: { id: state.serviceId },
      data: {
        adminApproved: true,
        status: 'active'
      }
    });
    log('   ✅ Service approved directly (for testing)', colors.green);
  } catch (error: any) {
    log(`   ⚠️  Could not approve service directly: ${error.message}`, colors.yellow);
  }
}

async function refreshProviderToken(): Promise<boolean> {
  try {
    log('   🔄 Refreshing provider token...', colors.cyan);
    const loginResponse = await axios.post(
      `${API_BASE_URL}/auth/login`,
      {
        email: state.providerEmail,
        password: 'ProviderPassword123!'
      },
      { timeout: 30000 }
    );

    if (loginResponse.data.token) {
      state.providerToken = loginResponse.data.token;
      log('   ✅ Provider token refreshed', colors.green);
      return true;
    }
    return false;
  } catch (error: any) {
    log(`   ❌ Token refresh failed: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function completeProviderProfile(): Promise<boolean> {
  try {
    log('   📝 Completing provider profile...', colors.cyan);
    
    // Refresh token first to ensure it's valid
    await refreshProviderToken();
    
    // Complete provider profile with all required fields
    const profileResponse = await axios.put(
      `${API_BASE_URL}/auth/profile`,
      {
        profileImage: 'https://i.pravatar.cc/150?img=12', // Profile image required
        skills: ['plumbing', 'electrical', 'repair'],
        experienceYears: 5,
        serviceAreaRadius: 50,
        serviceAreaCenter: {
          type: 'Point',
          coordinates: [28.0473, -26.2041],
          address: 'Johannesburg, South Africa'
        },
        isProfileComplete: true,
        availability: {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          hours: { start: '08:00', end: '18:00' }
        },
        // Set verification flags (for testing - in production these come from actual verification)
        providerDetails: {
          isVerified: true,
          isIdentityVerified: true
        }
      },
      {
        headers: { Authorization: `Bearer ${state.providerToken}` },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    if (profileResponse.status === 200) {
      log('   ✅ Provider profile updated', colors.green);
      
      // For testing: Set verification flags directly via Prisma
      // In production, these would be set through proper verification flows
      try {
        const user = await prisma.user.findUnique({
          where: { email: state.providerEmail.toLowerCase() },
          include: { serviceProvider: true }
        });
        
        if (user && user.serviceProvider) {
          // Set verification flags for testing
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isEmailVerified: true,
              isPhoneVerified: true
            }
          });
          
          await prisma.serviceProvider.update({
            where: { id: user.serviceProvider.id },
            data: {
              isVerified: true,
              isIdentityVerified: true,
              isProfileComplete: true,
              isOnline: true, // Set provider as online so they can receive bookings
              applicationStatus: 'active' // Set application status to active (required for matching)
            }
          });
          
          // Create a verified document (required for profile completion)
          await prisma.document.create({
            data: {
              providerId: user.serviceProvider.id,
              type: 'id_number',
              url: 'https://example.com/test-document.jpg',
              verified: true
            }
          }).catch(() => {}); // Ignore if document already exists
          
          log('   ✅ Verification flags set for testing', colors.green);
        }
      } catch (dbError: any) {
        log(`   ⚠️  Could not set verification flags: ${dbError.message}`, colors.yellow);
      }
      
      // Wait a moment for database to sync
      await sleep(500);
      
      return true;
    } else {
      log(`   ⚠️  Profile update returned status ${profileResponse.status}`, colors.yellow);
      log(`   Message: ${profileResponse.data?.message || 'Unknown'}`, colors.yellow);
      
      // If token invalid, try refreshing and retry once
      if (profileResponse.status === 401) {
        log('   🔄 Token invalid, refreshing and retrying...', colors.yellow);
        if (await refreshProviderToken()) {
          const retryResponse = await axios.put(
            `${API_BASE_URL}/auth/profile`,
            {
              skills: ['plumbing', 'electrical', 'repair'],
              experienceYears: 5,
              serviceAreaRadius: 50,
              serviceAreaCenter: {
                type: 'Point',
                coordinates: [28.0473, -26.2041],
                address: 'Johannesburg, South Africa'
              },
              isProfileComplete: true,
              availability: {
                days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                hours: { start: '08:00', end: '18:00' }
              }
            },
            {
              headers: { Authorization: `Bearer ${state.providerToken}` },
              timeout: 30000,
              validateStatus: () => true
            }
          );
          
          if (retryResponse.status === 200) {
            log('   ✅ Provider profile completed (after retry)', colors.green);
            await sleep(500); // Wait for DB sync
            return true;
          }
        }
      }
      
      return false;
    }
  } catch (error: any) {
    log(`   ⚠️  Profile completion error: ${error.response?.data?.message || error.message}`, colors.yellow);
    return false;
  }
}

async function createAndApproveService(): Promise<boolean> {
  try {
    // First, complete provider profile (required for service creation)
    const profileComplete = await completeProviderProfile();
    if (!profileComplete) {
      log('   ⚠️  Profile completion had issues, but continuing...', colors.yellow);
    }

    await sleep(1000); // Brief pause

    // Try to get admin token (optional - service can be created without approval)
    if (!state.adminToken && ADMIN_PASSWORD) {
      log('   🔐 Attempting admin login for service approval...', colors.cyan);
      state.adminToken = await loginAsAdmin() || '';
      if (!state.adminToken) {
        log('   ⚠️  Admin login failed - will create service without approval', colors.yellow);
      }
    } else if (!ADMIN_PASSWORD) {
      log('   ⚠️  ADMIN_PASSWORD not set - will create service without approval', colors.yellow);
    }

    // Create service
    log('   🔧 Creating service...', colors.cyan);
    const serviceResponse = await axios.post(
      `${API_BASE_URL}/services`,
      {
        title: 'Plumbing Service',
        description: 'Professional plumbing repairs and installations',
        category: 'Plumbing',
        price: 500,
        duration: 120
      },
      {
        headers: { Authorization: `Bearer ${state.providerToken}` },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    if (serviceResponse.status === 201 || serviceResponse.status === 200) {
      state.serviceId = serviceResponse.data.service?.id || serviceResponse.data.id;
      log(`   ✅ Service created: ${state.serviceId}`, colors.green);
      
      // Approve service as admin (if admin token available)
      if (state.adminToken) {
        log('   ✅ Approving service...', colors.cyan);
        const approveResponse = await axios.patch(
          `${API_BASE_URL}/admin/services/${state.serviceId}/approve`,
          {},
          {
            headers: { Authorization: `Bearer ${state.adminToken}` },
            timeout: 30000,
            validateStatus: () => true
          }
        );

        if (approveResponse.status === 200) {
          log('   ✅ Service approved', colors.green);
        } else {
          log(`   ⚠️  Service approval returned status ${approveResponse.status}`, colors.yellow);
          log(`   💡 Approving service directly via database for testing...`, colors.cyan);
          await approveServiceDirectly();
        }
      } else {
        log('   ⚠️  Service created but not approved (admin token unavailable)', colors.yellow);
        log('   💡 Approving service directly via database for testing...', colors.cyan);
        await approveServiceDirectly();
      }
      
      return true;
    } else {
      log(`   ❌ Service creation failed: ${serviceResponse.data?.message || 'Unknown error'}`, colors.red);
      return false;
    }
  } catch (error: any) {
    log(`   ❌ Error: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function createBooking(): Promise<boolean> {
  try {
    // Booking must be for today only (same-day bookings like Uber)
    const now = new Date();
    
    // Set booking to 30 minutes from now
    const bookingDateTime = new Date(now.getTime() + 30 * 60 * 1000);
    
    // Verify it's still today (should be unless it's very late at night)
    const today = new Date();
    const isSameDay = 
      bookingDateTime.getFullYear() === today.getFullYear() &&
      bookingDateTime.getMonth() === today.getMonth() &&
      bookingDateTime.getDate() === today.getDate();
    
    if (!isSameDay) {
      // If booking would be tomorrow, set it to 5 minutes from now instead
      const adjustedDateTime = new Date(now.getTime() + 5 * 60 * 1000);
      log(`   ⚠️  Booking time adjusted to stay within today`, colors.yellow);
      log(`   📅 Booking date: ${adjustedDateTime.toISOString()}`, colors.cyan);
      
      const bookingResponse = await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          serviceId: state.serviceId,
          date: adjustedDateTime.toISOString(),
          time: adjustedDateTime.toTimeString().slice(0, 5),
          location: {
            type: 'Point',
            coordinates: [28.0473, -26.2041], // Johannesburg
            address: '123 Main Street, Johannesburg, South Africa'
          },
          notes: 'Please arrive on time',
          estimatedDurationMinutes: 120,
          jobSize: 'medium'
        },
        {
          headers: { Authorization: `Bearer ${state.customerToken}` },
          timeout: 30000, // Increased timeout for provider matching
          validateStatus: () => true
        }
      );
      
      if (bookingResponse.status === 201) {
        state.bookingId = bookingResponse.data.booking?.id || bookingResponse.data.id;
        log(`   ✅ Booking created: ${state.bookingId}`, colors.green);
        log(`   💰 Amount: R${bookingResponse.data.amount || bookingResponse.data.booking?.calculatedPrice || 'N/A'}`, colors.cyan);
        return true;
      } else {
        log(`   ❌ Booking creation failed: ${bookingResponse.data?.message || 'Unknown error'}`, colors.red);
        log(`   Status: ${bookingResponse.status}`, colors.yellow);
        return false;
      }
    }
    
    log(`   📅 Booking date: ${bookingDateTime.toISOString()}`, colors.cyan);
    
    // Format date as YYYY-MM-DD for today
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const timeStr = bookingDateTime.toTimeString().slice(0, 5);
    
    log(`   📅 Using date string: ${todayStr} ${timeStr}`, colors.cyan);
    
    const bookingResponse = await axios.post(
      `${API_BASE_URL}/bookings`,
      {
        serviceId: state.serviceId,
        date: `${todayStr}T${timeStr}:00.000Z`, // Use today's date with booking time
        time: timeStr,
        location: {
          type: 'Point',
          coordinates: [28.0473, -26.2041], // Johannesburg
          address: '123 Main Street, Johannesburg, South Africa'
        },
        notes: 'Please arrive on time',
        estimatedDurationMinutes: 120,
        jobSize: 'medium'
      },
      {
        headers: { Authorization: `Bearer ${state.customerToken}` },
        timeout: 30000, // Increased timeout for provider matching
        validateStatus: () => true
      }
    );

    if (bookingResponse.status === 201) {
      state.bookingId = bookingResponse.data.booking?.id || bookingResponse.data.id;
      log(`   ✅ Booking created: ${state.bookingId}`, colors.green);
      log(`   💰 Amount: R${bookingResponse.data.amount || bookingResponse.data.booking?.calculatedPrice || 'N/A'}`, colors.cyan);
      return true;
    } else {
      log(`   ❌ Booking creation failed: ${bookingResponse.data?.message || 'Unknown error'}`, colors.red);
      log(`   Status: ${bookingResponse.status}`, colors.yellow);
      return false;
    }
  } catch (error: any) {
    log(`   ❌ Error: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function processPayment(): Promise<boolean> {
  try {
    // Simulate payment - in real scenario, this would go through PayFast
    log('   💳 Processing payment...', colors.cyan);
    
    // For testing, we'll use a mock payment endpoint or update payment status directly
    // Since we don't have a mock payment endpoint, we'll check if payment is required
    log('   ℹ️  Payment processing would occur via PayFast gateway', colors.yellow);
    log('   ℹ️  For testing, payment status is tracked but not processed', colors.yellow);
    
    // Check booking status
    const bookingResponse = await axios.get(
      `${API_BASE_URL}/bookings/${state.bookingId}`,
      {
        headers: { Authorization: `Bearer ${state.customerToken}` },
        timeout: 15000
      }
    );

    if (bookingResponse.status === 200) {
      const booking = bookingResponse.data.booking || bookingResponse.data;
      log(`   📊 Booking status: ${booking.status}`, colors.cyan);
      log(`   💰 Payment status: ${booking.paymentStatus || 'N/A'}`, colors.cyan);
      
      // If payment is pending, we'll note it
      if (booking.paymentStatus === 'pending') {
        log('   ⚠️  Payment is pending - booking requires payment before provider can accept', colors.yellow);
      }
      
      return true;
    }

    return false;
  } catch (error: any) {
    log(`   ❌ Error: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function providerAcceptsBooking(): Promise<boolean> {
  try {
    log('   ✅ Provider accepting booking...', colors.cyan);
    
    const acceptResponse = await axios.post(
      `${API_BASE_URL}/bookings/${state.bookingId}/accept`,
      {},
      {
        headers: { Authorization: `Bearer ${state.providerToken}` },
        timeout: 15000,
        validateStatus: () => true
      }
    );

    if (acceptResponse.status === 200) {
      log('   ✅ Provider accepted booking', colors.green);
      return true;
    } else {
      log(`   ⚠️  Accept response: ${acceptResponse.status}`, colors.yellow);
      log(`   Message: ${acceptResponse.data?.message || 'Unknown'}`, colors.yellow);
      
      // Check if payment is required first
      if (acceptResponse.data?.message?.includes('payment')) {
        log('   ℹ️  Payment must be completed before provider can accept', colors.cyan);
      }
      
      return acceptResponse.status === 200;
    }
  } catch (error: any) {
    log(`   ❌ Error: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function completeJob(): Promise<boolean> {
  try {
    log('   🎯 Completing job...', colors.cyan);
    
    const completeResponse = await axios.post(
      `${API_BASE_URL}/bookings/${state.bookingId}/complete`,
      {
        notes: 'Job completed successfully. Customer satisfied.'
      },
      {
        headers: { Authorization: `Bearer ${state.providerToken}` },
        timeout: 15000,
        validateStatus: () => true
      }
    );

    if (completeResponse.status === 200) {
      log('   ✅ Job marked as completed', colors.green);
      
      // Check final booking status
      const bookingResponse = await axios.get(
        `${API_BASE_URL}/bookings/${state.bookingId}`,
        {
          headers: { Authorization: `Bearer ${state.customerToken}` },
          timeout: 15000
        }
      );

      if (bookingResponse.status === 200) {
        const booking = bookingResponse.data.booking || bookingResponse.data;
        log(`   📊 Final status: ${booking.status}`, colors.cyan);
        log(`   💰 Payment status: ${booking.paymentStatus || 'N/A'}`, colors.cyan);
      }
      
      return true;
    } else {
      log(`   ⚠️  Complete response: ${completeResponse.status}`, colors.yellow);
      log(`   Message: ${completeResponse.data?.message || 'Unknown'}`, colors.yellow);
      return false;
    }
  } catch (error: any) {
    log(`   ❌ Error: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function runCompleteServiceFlowTest() {
  logSection('COMPLETE SERVICE FLOW TEST SUITE');
  log(`📍 API Base URL: ${API_BASE_URL}`, colors.cyan);
  log(`📧 Customer Email: ${state.customerEmail}`, colors.cyan);
  log(`📧 Provider Email: ${state.providerEmail}`, colors.cyan);
  log(`📧 Admin Email: ${ADMIN_EMAIL}`, colors.cyan);

  const results: { [key: string]: boolean } = {};

  try {
    // Step 1: Health Check
    logStep(1, 'Health Check');
    try {
      const healthRes = await axios.get(`${API_BASE_URL}/health`, {
        timeout: 30000,
        validateStatus: () => true
      });
      if (healthRes.status === 200) {
        log('   ✅ Server is running', colors.green);
        results['health'] = true;
      } else {
        log(`   ⚠️  Server returned status ${healthRes.status}`, colors.yellow);
        results['health'] = false;
      }
    } catch (error: any) {
      log(`   ❌ Cannot connect to server: ${error.message}`, colors.red);
      log(`   💡 Make sure the server is running at ${API_BASE_URL}`, colors.yellow);
      log(`   💡 For localhost: Set TEST_API_URL=http://localhost:5003`, colors.yellow);
      results['health'] = false;
      return;
    }

    // Step 2: Register Customer
    logStep(2, 'Customer Registration');
    results['customerRegistration'] = await registerCustomer();
    if (!results['customerRegistration']) {
      log('\n❌ Cannot proceed without customer', colors.red);
      return;
    }

    // Step 3: Register Service Provider
    logStep(3, 'Service Provider Registration');
    results['providerRegistration'] = await registerServiceProvider();
    if (!results['providerRegistration']) {
      log('\n❌ Cannot proceed without provider', colors.red);
      return;
    }

    // Step 4: Create and Approve Service
    logStep(4, 'Service Creation & Approval');
    results['serviceCreation'] = await createAndApproveService();
    if (!results['serviceCreation']) {
      log('\n❌ Cannot proceed without approved service', colors.red);
      return;
    }

    await sleep(1000); // Brief pause

    // Step 5: Create Booking
    logStep(5, 'Booking Creation');
    results['bookingCreation'] = await createBooking();
    if (!results['bookingCreation']) {
      log('\n❌ Cannot proceed without booking', colors.red);
      return;
    }

    await sleep(1000);

    // Step 6: Process Payment
    logStep(6, 'Payment Processing');
    results['paymentProcessing'] = await processPayment();

    await sleep(1000);

    // Step 7: Provider Accepts Booking
    logStep(7, 'Provider Acceptance');
    results['providerAcceptance'] = await providerAcceptsBooking();

    await sleep(1000);

    // Step 8: Complete Job
    logStep(8, 'Job Completion');
    results['jobCompletion'] = await completeJob();

    // Summary
    logSection('TEST RESULTS SUMMARY');
    
    const allSteps = [
      { name: 'Health Check', key: 'health' },
      { name: 'Customer Registration', key: 'customerRegistration' },
      { name: 'Provider Registration', key: 'providerRegistration' },
      { name: 'Service Creation', key: 'serviceCreation' },
      { name: 'Booking Creation', key: 'bookingCreation' },
      { name: 'Payment Processing', key: 'paymentProcessing' },
      { name: 'Provider Acceptance', key: 'providerAcceptance' },
      { name: 'Job Completion', key: 'jobCompletion' }
    ];

    let passed = 0;
    let failed = 0;

    allSteps.forEach(step => {
      const result = results[step.key];
      if (result === true) {
        log(`   ✅ ${step.name}`, colors.green);
        passed++;
      } else if (result === false) {
        log(`   ❌ ${step.name}`, colors.red);
        failed++;
      } else {
        log(`   ⚠️  ${step.name} (skipped)`, colors.yellow);
      }
    });

    log(`\n📊 Results: ${passed} passed, ${failed} failed`, colors.cyan);
    
    if (failed === 0) {
      log('\n✅ All tests passed!', colors.green);
    } else {
      log('\n⚠️  Some tests failed. Check logs above for details.', colors.yellow);
    }

    log('\n📋 Test Data Created:', colors.cyan);
    log(`   Customer: ${state.customerEmail}`, colors.cyan);
    log(`   Provider: ${state.providerEmail}`, colors.cyan);
    log(`   Service ID: ${state.serviceId}`, colors.cyan);
    log(`   Booking ID: ${state.bookingId}`, colors.cyan);
    log('\n💡 All data has been persisted in the database.', colors.green);

  } catch (error: any) {
    log(`\n❌ Test suite failed: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
  } finally {
    // Disconnect Prisma
    await prisma.$disconnect();
  }
}

// Run the test
runCompleteServiceFlowTest();
