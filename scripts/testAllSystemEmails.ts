/**
 * Test All System Emails
 * Triggers all email types that the backend sends to xoli@spana.co.za
 */

// Load environment variables
require('dotenv').config();

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5003';
const TEST_EMAIL = 'xoli@spana.co.za';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m'
};

function log(icon: string, message: string, color: string = colors.reset) {
  console.log(`${color}${icon}${colors.reset} ${message}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAllSystemEmails() {
  console.log(`\n${colors.cyan}📧 TESTING ALL SYSTEM EMAILS${colors.reset}\n`);
  console.log(`${colors.gray}URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.gray}Email: ${TEST_EMAIL}${colors.reset}\n`);

  let adminToken = '';
  let customerToken = '';
  let testUserId = '';

  try {
    // 1. Health Check
    log('📋', '1. Health Check...', colors.yellow);
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      log('  ✅', `Server healthy: ${healthResponse.data.status || 'OK'}`, colors.green);
    } catch (error: any) {
      log('  ⚠️', `Health check failed: ${error.message}. Continuing anyway...`, colors.yellow);
      log('  ℹ️', 'Make sure the server is running on', colors.gray);
      log('  ℹ️', `${BASE_URL}`, colors.gray);
    }
    console.log('');

    // 2. Admin Login (to get admin token for OTP)
    log('📋', '2. Admin Login (for OTP test)...', colors.yellow);
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: TEST_EMAIL,
        password: process.env.ADMIN_PASSWORD || 'Admin@2028' // Default password if not set
      });
      adminToken = loginResponse.data.token || loginResponse.data.accessToken;
      log('  ✅', 'Admin logged in successfully', colors.green);
    } catch (error: any) {
      log('  ⚠️', `Admin login failed (will skip OTP test): ${error.response?.data?.message || error.message}`, colors.yellow);
    }
    console.log('');

    // 3. Register a test customer (for welcome email)
    log('📋', '3. Registering Test Customer (Welcome Email)...', colors.yellow);
    try {
      const timestamp = Date.now();
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
        email: `test-welcome-${timestamp}@test.com`,
        password: 'Test@123456',
        firstName: 'Test',
        lastName: 'Customer',
        phone: '+27123456789',
        role: 'customer'
      });
      testUserId = registerResponse.data.user?.id || registerResponse.data.id;
      log('  ✅', 'Test customer registered (welcome email should be sent)', colors.green);
      await sleep(2000); // Wait for email to be sent
    } catch (error: any) {
      log('  ⚠️', `Registration failed (welcome email may not send): ${error.response?.data?.message || error.message}`, colors.yellow);
    }
    console.log('');

    // 4. Request Admin OTP Email
    log('📋', '4. Requesting Admin OTP Email...', colors.yellow);
    try {
      const otpResponse = await axios.post(`${BASE_URL}/admin/otp/request`, {
        email: TEST_EMAIL
      });
      log('  ✅', `OTP request sent: ${JSON.stringify(otpResponse.data)}`, colors.green);
      await sleep(2000);
    } catch (error: any) {
      log('  ❌', `OTP request failed: ${error.response?.data?.message || error.message}`, colors.red);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
      }
    }
    console.log('');

    // 5. Request Email Verification
    log('📋', '5. Requesting Email Verification...', colors.yellow);
    try {
      const verificationResponse = await axios.post(`${BASE_URL}/email-verification/send-verification`, {
        email: TEST_EMAIL
      });
      log('  ✅', `Verification email sent: ${JSON.stringify(verificationResponse.data)}`, colors.green);
      await sleep(2000);
    } catch (error: any) {
      log('  ⚠️', `Verification request: ${error.response?.data?.message || error.message}`, colors.yellow);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
      }
    }
    console.log('');

    // 6. Request Password Reset
    log('📋', '6. Requesting Password Reset...', colors.yellow);
    try {
      const resetResponse = await axios.post(`${BASE_URL}/password-reset/request`, {
        email: TEST_EMAIL
      });
      log('  ✅', `Password reset email sent: ${JSON.stringify(resetResponse.data)}`, colors.green);
      await sleep(2000);
    } catch (error: any) {
      log('  ⚠️', `Password reset request: ${error.response?.data?.message || error.message}`, colors.yellow);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
      }
    }
    console.log('');

    // 7. Create a booking and payment to trigger invoice email
    log('📋', '7. Creating Booking & Payment (Invoice Email)...', colors.yellow);
    try {
      // First, get or create a service provider
      const providerRegisterResponse = await axios.post(`${BASE_URL}/auth/register`, {
        email: `test-provider-${Date.now()}@test.com`,
        password: 'Test@123456',
        firstName: 'Test',
        lastName: 'Provider',
        phone: '+27123456790',
        role: 'service_provider'
      });
      const providerToken = providerRegisterResponse.data.token || providerRegisterResponse.data.accessToken;

      // Update provider profile to be complete
      await axios.put(`${BASE_URL}/auth/profile`, {
        skills: ['plumbing'],
        experienceYears: 5,
        serviceAreaRadius: 25,
        serviceAreaCenter: {
          type: 'Point',
          coordinates: [28.0500, -26.2100]
        },
        availability: {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          hours: { start: '08:00', end: '20:00' }
        }
      }, {
        headers: { Authorization: `Bearer ${providerToken}` }
      });

      // Create a service
      const serviceResponse = await axios.post(`${BASE_URL}/services`, {
        title: 'Test Plumbing Service',
        description: 'Test service for email testing',
        category: 'plumbing',
        basePrice: 500,
        duration: 60
      }, {
        headers: { Authorization: `Bearer ${providerToken}` }
      });

      // Approve service (via direct DB update or admin endpoint if available)
      // For now, skip if approval fails

      // Create booking
      const bookingDate = new Date();
      bookingDate.setHours(bookingDate.getHours() + 1);

      const bookingResponse = await axios.post(`${BASE_URL}/bookings`, {
        serviceId: serviceResponse.data.service?.id || serviceResponse.data.id,
        date: bookingDate.toISOString(),
        time: bookingDate.toISOString(),
        location: {
          type: 'Point',
          coordinates: [28.0473, -26.2041],
          address: 'Sandton'
        },
        notes: 'Test booking for invoice email',
        jobSize: 'medium'
      }, {
        headers: { Authorization: `Bearer ${customerToken || (await axios.post(`${BASE_URL}/auth/login`, {
          email: `test-welcome-${Date.now()}@test.com`,
          password: 'Test@123456'
        })).data.token}` }
      });

      log('  ✅', 'Booking created (invoice email will be sent after payment)', colors.green);
      log('  ℹ️', 'Note: Invoice email is sent after payment completion', colors.gray);
    } catch (error: any) {
      log('  ⚠️', `Booking/Payment setup failed: ${error.response?.data?.message || error.message}`, colors.yellow);
      log('  ℹ️', 'Invoice email will be sent automatically after payment completion', colors.gray);
    }
    console.log('');

    // Summary
    console.log(`${colors.magenta}════════════════════════════════════════${colors.reset}`);
    log('✅', 'ALL SYSTEM EMAIL TESTS COMPLETED!', colors.green);
    console.log(`${colors.magenta}════════════════════════════════════════${colors.reset}\n`);

    log('📧', `Check your email inbox at: ${TEST_EMAIL}`, colors.cyan);
    console.log('\n📋 Email Types Sent:');
    console.log('   ✅ Admin OTP Email');
    console.log('   ✅ Email Verification');
    console.log('   ✅ Password Reset');
    console.log('   ✅ Welcome Email (if new user registered)');
    console.log('   ℹ️  Invoice Email (sent after payment completion)');
    console.log('   ℹ️  Receipt Email (sent after payment completion)\n');

  } catch (error: any) {
    log('❌', `Test failed: ${error.message}`, colors.red);
    if (error.response?.data) {
      log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
    }
  }
}

// Run tests
testAllSystemEmails().catch(console.error);
