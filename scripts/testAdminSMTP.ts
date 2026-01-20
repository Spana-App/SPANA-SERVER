/**
 * Test Admin Login and SMTP on Production
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

async function testAdminSMTP() {
  log('🔐', 'TESTING ADMIN LOGIN & SMTP', colors.cyan);
  log('', `URL: ${BASE_URL}`, colors.cyan);
  console.log('');

  let adminToken = '';

  try {
    // 1. Admin Login
    log('📋', '1. Admin Login...', colors.yellow);
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'xoli@spana.co.za',
        password: 'Admin123!'
      });
      adminToken = loginResponse.data.token;
      log('  ✅', 'Admin logged in successfully', colors.green);
      if (adminToken) {
        log('  ℹ️', `Token: ${adminToken.substring(0, 20)}...`, colors.cyan);
      }
    } catch (error: any) {
      log('  ❌', `Admin login failed: ${error.response?.data?.message || error.message}`, colors.red);
      log('  ℹ️', `Status: ${error.response?.status}`, colors.yellow);
      return;
    }
    console.log('');

    // 2. Request Admin OTP (tests SMTP)
    log('📋', '2. Requesting Admin OTP (SMTP Test)...', colors.yellow);
    try {
      const otpResponse = await axios.post(
        `${BASE_URL}/admin/otp/request`,
        { email: 'xoli@spana.co.za' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      log('  ✅', 'OTP request sent', colors.green);
      log('  ℹ️', `Response: ${JSON.stringify(otpResponse.data)}`, colors.cyan);
      if (otpResponse.data.otp) {
        log('  📧', `OTP: ${otpResponse.data.otp}`, colors.yellow);
        log('  ℹ️', 'Check email inbox for OTP', colors.cyan);
      }
    } catch (error: any) {
      log('  ❌', `OTP request failed: ${error.response?.data?.message || error.message}`, colors.red);
      log('  ℹ️', `Status: ${error.response?.status}`, colors.yellow);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.yellow);
      }
    }
    console.log('');

    // 3. Test Email Verification (as admin)
    log('📋', '3. Testing Email Verification...', colors.yellow);
    try {
      const verifyResponse = await axios.post(
        `${BASE_URL}/email-verification/send-verification`,
        { email: 'xoli@spana.co.za' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      log('  ✅', 'Verification email sent', colors.green);
      log('  ℹ️', `Response: ${JSON.stringify(verifyResponse.data)}`, colors.cyan);
    } catch (error: any) {
      log('  ⚠️', `Verification: ${error.response?.data?.message || error.message}`, colors.yellow);
      log('  ℹ️', `Status: ${error.response?.status}`, colors.yellow);
    }
    console.log('');

    // 4. Check Health for SMTP Status
    log('📋', '4. Checking SMTP Status...', colors.yellow);
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health/detailed`);
      log('  ℹ️', `SMTP Status: ${healthResponse.data.smtp || 'N/A'}`, colors.cyan);
      log('  ℹ️', `Environment: ${healthResponse.data.env || 'N/A'}`, colors.cyan);
      if (healthResponse.data.smtp === 'disconnected') {
        log('  ⚠️', 'SMTP is disconnected - check Render environment variables', colors.yellow);
      }
    } catch (error: any) {
      log('  ⚠️', `Health check: ${error.message}`, colors.yellow);
    }
    console.log('');

    // Summary
    log('📊', 'TEST SUMMARY', colors.cyan);
    log('', '✅ Admin login working', colors.green);
    log('', '📧 Check email inbox for OTP', colors.yellow);
    log('', '📧 Check email inbox for verification email', colors.yellow);
    log('', '', colors.reset);
    log('💡', 'SMTP Solutions:', colors.yellow);
    log('', '1. Try SMTP_ALT_PORT=2525 in Render environment', colors.cyan);
    log('', '2. Use Mailgun (free: 5,000 emails/month)', colors.cyan);
    log('', '3. Upgrade Render to paid plan', colors.cyan);
    log('', 'See RENDER_SMTP_WORKAROUND.md for details', colors.cyan);

  } catch (error: any) {
    console.error(colors.red + '❌ Test Error:' + colors.reset, error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
      console.error('Status:', error.response.status);
    }
    process.exit(1);
  }
}

testAdminSMTP()
  .then(() => {
    console.log('');
    log('✅', 'Admin SMTP test completed!', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    console.error(colors.red + '❌ Tests failed:' + colors.reset, error);
    process.exit(1);
  });
