import axios from 'axios';
import prisma from '../lib/database';

const BACKEND_URL = 'https://spana-server-5bhu.onrender.com';
const EMAIL_SERVICE_URL = 'https://email-microservice-pi.vercel.app';

// Admin credentials
const adminEmail = 'xoli@spana.co.za';
const adminPassword = 'TestPassword123!';

// Test users (using timestamps for uniqueness)
const timestamp = Date.now();
const testCustomerEmail = `test-customer-${timestamp}@example.com`;
const testProviderEmail = `test-provider-${timestamp}@example.com`;
const testAdminEmail = `test-admin-${timestamp}@spana.co.za`;

let adminToken: string | null = null;
let customerToken: string | null = null;
let providerToken: string | null = null;

interface TestResult {
  category: string;
  step: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(category: string, step: string, status: 'pass' | 'fail' | 'skip', message: string, details?: any) {
  results.push({ category, step, status, message, details });
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  console.log(`${icon} [${category}] ${step}: ${message}`);
  if (details) {
    console.log(`   Details:`, details);
  }
}

// ============================================================================
// INFRASTRUCTURE TESTS
// ============================================================================

async function testInfrastructure() {
  console.log('\n🏗️  INFRASTRUCTURE TESTS');
  console.log('='.repeat(80));

  // Email Service
  try {
    const response = await axios.get(`${EMAIL_SERVICE_URL}/api/health`, { timeout: 10000, validateStatus: () => true });
    if (response.status === 200 && response.data.providers?.smtp?.status === 'connected') {
      logResult('Infrastructure', 'Email Service', 'pass', 'SMTP connected', response.data.providers.smtp);
    } else {
      logResult('Infrastructure', 'Email Service', 'fail', 'SMTP not connected', response.data);
    }
  } catch (error: any) {
    logResult('Infrastructure', 'Email Service', 'fail', 'Service unreachable', { error: error.message });
  }

  // Backend Health
  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000, validateStatus: () => true });
    if (response.status === 200) {
      logResult('Infrastructure', 'Backend Health', 'pass', 'Backend healthy', {
        database: response.data.database,
        uptime: `${Math.floor(response.data.uptime)}s`
      });
    } else {
      logResult('Infrastructure', 'Backend Health', 'fail', 'Health check failed', { status: response.status });
    }
  } catch (error: any) {
    logResult('Infrastructure', 'Backend Health', 'fail', 'Health check error', { error: error.message });
  }
}

// ============================================================================
// ADMIN TESTS
// ============================================================================

async function testAdminFlow() {
  console.log('\n👑 ADMIN TESTS');
  console.log('='.repeat(80));

  // Login
  try {
    const loginResponse = await axios.post(
      `${BACKEND_URL}/auth/login`,
      { email: adminEmail, password: adminPassword },
      { timeout: 15000, validateStatus: () => true }
    );

    if (loginResponse.status === 200 && loginResponse.data.requiresOTP) {
      const otp = loginResponse.data.otp;
      logResult('Admin', 'Login', 'pass', 'OTP received', { otp });

      const verifyResponse = await axios.post(
        `${BACKEND_URL}/admin/otp/verify`,
        { email: adminEmail, otp },
        { timeout: 15000, validateStatus: () => true }
      );

      if (verifyResponse.status === 200 && verifyResponse.data.token) {
        adminToken = verifyResponse.data.token;
        logResult('Admin', 'OTP Verify', 'pass', 'Token received');
      } else {
        logResult('Admin', 'OTP Verify', 'fail', 'Verification failed', verifyResponse.data);
        return false;
      }
    } else {
      logResult('Admin', 'Login', 'fail', 'Login failed', loginResponse.data);
      return false;
    }
  } catch (error: any) {
    logResult('Admin', 'Login', 'fail', 'Login error', { error: error.message });
    return false;
  }

  // Admin Endpoints
  const adminEndpoints = [
    { name: 'Get All Users', path: '/admin/users' },
    { name: 'Get All Bookings', path: '/admin/bookings' },
    { name: 'Get All Services', path: '/admin/services' },
    { name: 'Get Complaints', path: '/admin/complaints' },
    { name: 'Get Wallet Summary', path: '/admin/wallet/summary' },
    { name: 'Get Wallet Transactions', path: '/admin/wallet/transactions' },
    { name: 'Get Pending Documents', path: '/admin/documents/pending' },
  ];

  for (const endpoint of adminEndpoints) {
    try {
      const response = await axios.get(`${BACKEND_URL}${endpoint.path}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        timeout: 10000,
        validateStatus: () => true
      });
      if (response.status === 200) {
        const count = Array.isArray(response.data) ? response.data.length : 'N/A';
        logResult('Admin', endpoint.name, 'pass', `Status 200`, { count });
      } else {
        logResult('Admin', endpoint.name, 'fail', `Status ${response.status}`, response.data);
      }
    } catch (error: any) {
      logResult('Admin', endpoint.name, 'fail', 'Request failed', { error: error.message });
    }
  }

  return true;
}

// ============================================================================
// CUSTOMER TESTS
// ============================================================================

async function testCustomerFlow() {
  console.log('\n👤 CUSTOMER TESTS');
  console.log('='.repeat(80));

  // Register Customer
  try {
    const registerResponse = await axios.post(
      `${BACKEND_URL}/auth/register`,
      {
        email: testCustomerEmail,
        password: 'Customer123!',
        firstName: 'Test',
        lastName: 'Customer',
        phone: '+27123456789',
        role: 'customer'
      },
      { timeout: 15000, validateStatus: () => true }
    );

    if (registerResponse.status === 201) {
      // Customer registration may return token or just user (depending on implementation)
      if (registerResponse.data.token) {
        customerToken = registerResponse.data.token;
        logResult('Customer', 'Registration', 'pass', 'Customer registered with token', {
          userId: registerResponse.data.user?._id || registerResponse.data.user?.id,
          email: registerResponse.data.user?.email
        });
      } else if (registerResponse.data.user) {
        // User created, need to login to get token
        logResult('Customer', 'Registration', 'pass', 'Customer registered (login required)', {
          userId: registerResponse.data.user._id || registerResponse.data.user.id,
          email: registerResponse.data.user.email,
          message: registerResponse.data.message
        });
      } else {
        logResult('Customer', 'Registration', 'fail', 'Registration response unclear', registerResponse.data);
        return false;
      }
    } else {
      logResult('Customer', 'Registration', 'fail', 'Registration failed', registerResponse.data);
      return false;
    }
  } catch (error: any) {
    logResult('Customer', 'Registration', 'fail', 'Registration error', {
      error: error.message,
      response: error.response?.data
    });
    return false;
  }

  // Customer Login (always try, even if we got token from registration)
  try {
    const loginResponse = await axios.post(
      `${BACKEND_URL}/auth/login`,
      { email: testCustomerEmail, password: 'Customer123!' },
      { timeout: 15000, validateStatus: () => true }
    );

    if (loginResponse.status === 200) {
      if (loginResponse.data.token) {
        customerToken = loginResponse.data.token;
        logResult('Customer', 'Login', 'pass', 'Login successful, token received');
      } else if (loginResponse.data.requiresOTP) {
        logResult('Customer', 'Login', 'fail', 'Unexpected OTP requirement for customer', loginResponse.data);
      } else {
        logResult('Customer', 'Login', 'fail', 'Login successful but no token', loginResponse.data);
      }
    } else {
      logResult('Customer', 'Login', 'fail', 'Login failed', loginResponse.data);
    }
  } catch (error: any) {
    logResult('Customer', 'Login', 'fail', 'Login error', { error: error.message });
  }

  // Customer Endpoints
  const customerEndpoints = [
    { name: 'Get Profile', path: '/auth/me', method: 'GET' },
    { name: 'Get Services', path: '/services', method: 'GET' },
    { name: 'Get Providers', path: '/users/providers/all', method: 'GET' },
    { name: 'Get My Bookings', path: '/bookings', method: 'GET' },
    { name: 'Get Payment History', path: '/payments/history', method: 'GET' },
    { name: 'Get My Complaints', path: '/complaints/my-complaints', method: 'GET' },
  ];

  for (const endpoint of customerEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method as any,
        url: `${BACKEND_URL}${endpoint.path}`,
        headers: { 'Authorization': `Bearer ${customerToken}` },
        timeout: 10000,
        validateStatus: () => true
      });
      if (response.status === 200) {
        const count = Array.isArray(response.data) ? response.data.length : 'N/A';
        logResult('Customer', endpoint.name, 'pass', `Status 200`, { count });
      } else {
        logResult('Customer', endpoint.name, 'fail', `Status ${response.status}`, response.data);
      }
    } catch (error: any) {
      logResult('Customer', endpoint.name, 'fail', 'Request failed', { error: error.message });
    }
  }

  return true;
}

// ============================================================================
// SERVICE PROVIDER TESTS
// ============================================================================

async function testProviderFlow() {
  console.log('\n🔧 SERVICE PROVIDER TESTS');
  console.log('='.repeat(80));

  // Register Provider (via admin)
  if (!adminToken) {
    logResult('Provider', 'Registration', 'skip', 'Skipped - no admin token');
    return false;
  }

  try {
    const registerResponse = await axios.post(
      `${BACKEND_URL}/admin/providers/register`,
      {
        email: testProviderEmail,
        firstName: 'Test',
        lastName: 'Provider',
        phone: '+27123456789'
      },
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        timeout: 20000,
        validateStatus: () => true
      }
    );

    if (registerResponse.status === 201) {
      logResult('Provider', 'Registration', 'pass', 'Provider registered by admin', {
        userId: registerResponse.data.user?.id,
        email: registerResponse.data.user?.email,
        profileCompletionLink: !!registerResponse.data.profileCompletionLink
      });
    } else {
      logResult('Provider', 'Registration', 'fail', 'Registration failed', registerResponse.data);
      return false;
    }
  } catch (error: any) {
    logResult('Provider', 'Registration', 'fail', 'Registration error', {
      error: error.message,
      response: error.response?.data
    });
    return false;
  }

  // Provider Login (will need to complete profile first, but test what we can)
  try {
    // Try to get provider profile
    const user = await prisma.user.findUnique({
      where: { email: testProviderEmail.toLowerCase() },
      include: { serviceProvider: true }
    });

    if (user && user.serviceProvider) {
      logResult('Provider', 'Database Check', 'pass', 'Provider exists in database', {
        userId: user.id,
        isProfileComplete: user.serviceProvider.isProfileComplete
      });
    }
  } catch (error: any) {
    logResult('Provider', 'Database Check', 'fail', 'Error checking provider', { error: error.message });
  }

  // Provider Endpoints (if we had a token)
  logResult('Provider', 'Endpoints', 'skip', 'Skipped - provider needs profile completion for login');

  return true;
}

// ============================================================================
// PUBLIC ENDPOINTS TESTS
// ============================================================================

async function testPublicEndpoints() {
  console.log('\n🌐 PUBLIC ENDPOINTS TESTS');
  console.log('='.repeat(80));

  const publicEndpoints = [
    { name: 'Get Services', path: '/services', method: 'GET' },
    { name: 'Get Providers', path: '/users/providers/all', method: 'GET' },
    { name: 'Platform Stats', path: '/stats/platform', method: 'GET' },
    { name: 'Provider Stats by Location', path: '/stats/providers/location', method: 'GET' },
    { name: 'Booking Trends', path: '/stats/bookings/trends', method: 'GET' },
    { name: 'Top Providers', path: '/stats/providers/top', method: 'GET' },
    { name: 'Revenue Stats', path: '/stats/revenue', method: 'GET' },
  ];

  for (const endpoint of publicEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method as any,
        url: `${BACKEND_URL}${endpoint.path}`,
        timeout: 10000,
        validateStatus: () => true
      });
      if (response.status === 200) {
        const count = Array.isArray(response.data) ? response.data.length : 
                     typeof response.data === 'object' ? Object.keys(response.data).length : 'N/A';
        logResult('Public', endpoint.name, 'pass', `Status 200`, { dataKeys: count });
      } else {
        logResult('Public', endpoint.name, 'fail', `Status ${response.status}`, response.data);
      }
    } catch (error: any) {
      logResult('Public', endpoint.name, 'fail', 'Request failed', { error: error.message });
    }
  }
}

// ============================================================================
// SERVICE TESTS
// ============================================================================

async function testServiceEndpoints() {
  console.log('\n🛠️  SERVICE ENDPOINTS TESTS');
  console.log('='.repeat(80));

  const serviceEndpoints = [
    { name: 'Get All Services', path: '/services', method: 'GET', auth: false },
    { name: 'Discover Services', path: '/services/discover', method: 'GET', auth: false },
  ];

  for (const endpoint of serviceEndpoints) {
    try {
      const config: any = {
        method: endpoint.method as any,
        url: `${BACKEND_URL}${endpoint.path}`,
        timeout: 10000,
        validateStatus: () => true
      };

      if (endpoint.auth && customerToken) {
        config.headers = { 'Authorization': `Bearer ${customerToken}` };
      }

      const response = await axios(config);
      if (response.status === 200) {
        const count = Array.isArray(response.data) ? response.data.length : 'N/A';
        logResult('Services', endpoint.name, 'pass', `Status 200`, { count });
      } else {
        logResult('Services', endpoint.name, 'fail', `Status ${response.status}`, response.data);
      }
    } catch (error: any) {
      logResult('Services', endpoint.name, 'fail', 'Request failed', { error: error.message });
    }
  }
}

// ============================================================================
// BOOKING TESTS
// ============================================================================

async function testBookingEndpoints() {
  console.log('\n📅 BOOKING ENDPOINTS TESTS');
  console.log('='.repeat(80));

  if (!customerToken) {
    logResult('Bookings', 'All Tests', 'skip', 'Skipped - no customer token');
    return;
  }

  const bookingEndpoints = [
    { name: 'Get My Bookings', path: '/bookings', method: 'GET' },
  ];

  for (const endpoint of bookingEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method as any,
        url: `${BACKEND_URL}${endpoint.path}`,
        headers: { 'Authorization': `Bearer ${customerToken}` },
        timeout: 10000,
        validateStatus: () => true
      });
      if (response.status === 200) {
        const count = Array.isArray(response.data) ? response.data.length : 'N/A';
        logResult('Bookings', endpoint.name, 'pass', `Status 200`, { count });
      } else {
        logResult('Bookings', endpoint.name, 'fail', `Status ${response.status}`, response.data);
      }
    } catch (error: any) {
      logResult('Bookings', endpoint.name, 'fail', 'Request failed', { error: error.message });
    }
  }
}

// ============================================================================
// PAYMENT TESTS
// ============================================================================

async function testPaymentEndpoints() {
  console.log('\n💳 PAYMENT ENDPOINTS TESTS');
  console.log('='.repeat(80));

  if (!customerToken) {
    logResult('Payments', 'All Tests', 'skip', 'Skipped - no customer token');
    return;
  }

  const paymentEndpoints = [
    { name: 'Get Payment History', path: '/payments/history', method: 'GET' },
  ];

  for (const endpoint of paymentEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method as any,
        url: `${BACKEND_URL}${endpoint.path}`,
        headers: { 'Authorization': `Bearer ${customerToken}` },
        timeout: 10000,
        validateStatus: () => true
      });
      if (response.status === 200) {
        const count = Array.isArray(response.data) ? response.data.length : 'N/A';
        logResult('Payments', endpoint.name, 'pass', `Status 200`, { count });
      } else {
        logResult('Payments', endpoint.name, 'fail', `Status ${response.status}`, response.data);
      }
    } catch (error: any) {
      logResult('Payments', endpoint.name, 'fail', 'Request failed', { error: error.message });
    }
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runCompleteE2ETest() {
  console.log('🧪 COMPLETE END-TO-END TEST');
  console.log('='.repeat(80));
  console.log(`\n🌐 Using LIVE URLs:`);
  console.log(`   Backend: ${BACKEND_URL}`);
  console.log(`   Email Service: ${EMAIL_SERVICE_URL}`);
  console.log(`\n👥 Test Users:`);
  console.log(`   Customer: ${testCustomerEmail}`);
  console.log(`   Provider: ${testProviderEmail}`);
  console.log(`   Admin: ${testAdminEmail}`);
  console.log('='.repeat(80));

  try {
    // Infrastructure
    await testInfrastructure();

    // Admin Flow
    await testAdminFlow();

    // Customer Flow
    await testCustomerFlow();

    // Provider Flow
    await testProviderFlow();

    // Public Endpoints
    await testPublicEndpoints();

    // Service Endpoints
    await testServiceEndpoints();

    // Booking Endpoints
    await testBookingEndpoints();

    // Payment Endpoints
    await testPaymentEndpoints();

    // Print Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPLETE TEST SUMMARY');
    console.log('='.repeat(80));

    const byCategory = results.reduce((acc, r) => {
      if (!acc[r.category]) acc[r.category] = { pass: 0, fail: 0, skip: 0 };
      acc[r.category][r.status]++;
      return acc;
    }, {} as Record<string, { pass: number; fail: number; skip: number }>);

    console.log('\n📈 Results by Category:');
    Object.entries(byCategory).forEach(([category, counts]) => {
      const total = counts.pass + counts.fail + counts.skip;
      const passRate = total > 0 ? ((counts.pass / total) * 100).toFixed(1) : '0';
      console.log(`   ${category}: ${counts.pass}✅ ${counts.fail}❌ ${counts.skip}⏭️  (${passRate}% pass rate)`);
    });

    const totalPassed = results.filter(r => r.status === 'pass').length;
    const totalFailed = results.filter(r => r.status === 'fail').length;
    const totalSkipped = results.filter(r => r.status === 'skip').length;
    const total = results.length;
    const overallPassRate = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : '0';

    console.log(`\n📊 Overall Results:`);
    console.log(`   ✅ Passed: ${totalPassed}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   📈 Total: ${total}`);
    console.log(`   🎯 Pass Rate: ${overallPassRate}%`);

    console.log('\n' + '='.repeat(80));
    if (totalFailed === 0) {
      console.log('🎉 All tests passed! System is fully operational.');
    } else {
      console.log('⚠️  Some tests failed. Review details above.');
    }
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

runCompleteE2ETest();
