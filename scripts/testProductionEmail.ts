/**
 * Test Email Functionality on Production Server
 */

import axios from 'axios';

const BASE_URL = 'https://spana-server-5bhu.onrender.com';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(step: string, message: string, color: string = colors.reset) {
  console.log(`${color}${step}${colors.reset} ${message}`);
}

async function testProductionEmail() {
  log('📧', 'TESTING EMAIL FUNCTIONALITY ON PRODUCTION', colors.cyan);
  log('', `URL: ${BASE_URL}`, colors.cyan);
  console.log('');

  let customerToken = '';
  let customerEmail = '';

  try {
    // 1. Register a test user
    log('📋', '1. Registering test user...', colors.yellow);
    const timestamp = Date.now();
    customerEmail = `email-test-${timestamp}@test.com`;
    
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        email: customerEmail,
        password: 'Test123!',
        firstName: 'Email',
        lastName: 'Test',
        phone: '+27123456789',
        role: 'customer'
      });
      log('  ✅', 'User registered', colors.green);
    } catch (error: any) {
      log('  ⚠️', `Registration: ${error.response?.data?.message || error.message}`, colors.yellow);
    }
    console.log('');

    // 2. Login to get token
    log('📋', '2. Logging in...', colors.yellow);
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: customerEmail,
        password: 'Test123!'
      });
      customerToken = loginResponse.data.token;
      log('  ✅', 'Logged in successfully', colors.green);
    } catch (error: any) {
      log('  ❌', `Login failed: ${error.response?.data?.message || error.message}`, colors.red);
      return;
    }
    console.log('');

    // 3. Test Email Verification Endpoint
    log('📋', '3. Testing Email Verification Endpoint...', colors.yellow);
    try {
      const verifyResponse = await axios.post(
        `${BASE_URL}/email-verification/send-verification`,
        {},
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      log('  ✅', 'Email verification request sent', colors.green);
      log('  ℹ️', `Response: ${JSON.stringify(verifyResponse.data)}`, colors.cyan);
    } catch (error: any) {
      log('  ❌', `Email verification failed: ${error.response?.data?.message || error.message}`, colors.red);
      log('  ℹ️', `Status: ${error.response?.status}`, colors.yellow);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.yellow);
      }
    }
    console.log('');

    // 4. Test Password Reset Endpoint
    log('📋', '4. Testing Password Reset Endpoint...', colors.yellow);
    try {
      const resetResponse = await axios.post(
        `${BASE_URL}/password-reset/request`,
        { email: customerEmail },
        { validateStatus: () => true }
      );
      if (resetResponse.status === 200 || resetResponse.status === 201) {
        log('  ✅', 'Password reset request sent', colors.green);
        log('  ℹ️', `Response: ${JSON.stringify(resetResponse.data)}`, colors.cyan);
      } else {
        log('  ⚠️', `Status: ${resetResponse.status}`, colors.yellow);
        log('  ℹ️', `Response: ${JSON.stringify(resetResponse.data)}`, colors.yellow);
      }
    } catch (error: any) {
      log('  ❌', `Password reset failed: ${error.response?.data?.message || error.message}`, colors.red);
      log('  ℹ️', `Status: ${error.response?.status}`, colors.yellow);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.yellow);
      }
    }
    console.log('');

    // 5. Check SMTP Configuration
    log('📋', '5. Checking SMTP Configuration...', colors.yellow);
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health/detailed`);
      log('  ℹ️', `SMTP Status: ${healthResponse.data.smtp || 'N/A'}`, colors.cyan);
      log('  ℹ️', `Environment: ${healthResponse.data.env || 'N/A'}`, colors.cyan);
    } catch (error: any) {
      log('  ⚠️', `Health check: ${error.message}`, colors.yellow);
    }
    console.log('');

    // Summary
    log('📊', 'EMAIL TEST SUMMARY', colors.cyan);
    log('', `Test email: ${customerEmail}`, colors.yellow);
    log('', 'Check your email inbox for verification and password reset emails', colors.yellow);
    log('', 'If emails are not received, check:', colors.yellow);
    log('  1. SMTP credentials in Render environment variables', colors.cyan);
    log('  2. SMTP server logs in Render dashboard', colors.cyan);
    log('  3. Email spam/junk folder', colors.cyan);

  } catch (error: any) {
    console.error(colors.red + '❌ Test Error:' + colors.reset, error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
      console.error('Status:', error.response.status);
    }
    process.exit(1);
  }
}

testProductionEmail()
  .then(() => {
    console.log('');
    log('✅', 'Email test completed!', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    console.error(colors.red + '❌ Tests failed:' + colors.reset, error);
    process.exit(1);
  });
