/**
 * Test All Email Types
 * Directly triggers all email types via the email microservice
 */

// Load environment variables
require('dotenv').config();

import axios from 'axios';

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3000';
// Try to get API_SECRET from backend .env or email service .env
const API_SECRET = process.env.EMAIL_SERVICE_SECRET || process.env.API_SECRET || 'e37cf6365bf1daa23bbb4dfd359a978117857dfabb5410478ca0f8c58880cbf3';
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

async function testAllEmailTypes() {
  console.log(`\n${colors.cyan}📧 TESTING ALL EMAIL TYPES${colors.reset}\n`);
  console.log(`${colors.gray}Email Service: ${EMAIL_SERVICE_URL}${colors.reset}`);
  console.log(`${colors.gray}Test Email: ${TEST_EMAIL}${colors.reset}\n`);

  const results: any[] = [];

  try {
    // 1. Health Check
    log('📋', '1. Health Check...', colors.yellow);
    try {
      const healthResponse = await axios.get(`${EMAIL_SERVICE_URL}/api/health`, { timeout: 5000 });
      log('  ✅', `Service healthy: ${JSON.stringify(healthResponse.data)}`, colors.green);
      results.push({ type: 'Health Check', status: 'success', data: healthResponse.data });
    } catch (error: any) {
      log('  ❌', `Health check failed: ${error.message}`, colors.red);
      log('  ℹ️', 'Make sure the email service is running:', colors.gray);
      log('  ℹ️', `${EMAIL_SERVICE_URL}`, colors.gray);
      results.push({ type: 'Health Check', status: 'failed', error: error.message });
      return;
    }
    console.log('');

    // 2. Admin OTP Email
    log('📋', '2. Sending Admin OTP Email...', colors.yellow);
    try {
      const otpResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/otp`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        otp: '123456',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `OTP email sent: ${JSON.stringify(otpResponse.data)}`, colors.green);
      results.push({ type: 'Admin OTP', status: 'success', data: otpResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `OTP email failed: ${error.response?.data?.message || error.message}`, colors.red);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
      }
      results.push({ type: 'Admin OTP', status: 'failed', error: error.message });
    }
    console.log('');

    // 3. Email Verification
    log('📋', '3. Sending Email Verification...', colors.yellow);
    try {
      const verificationResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/verification`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        verificationLink: 'https://spana.co.za/verify?token=test_verification_token_12345',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Verification email sent: ${JSON.stringify(verificationResponse.data)}`, colors.green);
      results.push({ type: 'Email Verification', status: 'success', data: verificationResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Verification email failed: ${error.response?.data?.message || error.message}`, colors.red);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
      }
      results.push({ type: 'Email Verification', status: 'failed', error: error.message });
    }
    console.log('');

    // 4. Welcome Email
    log('📋', '4. Sending Welcome Email...', colors.yellow);
    try {
      const welcomeResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/welcome`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        role: 'admin',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Welcome email sent: ${JSON.stringify(welcomeResponse.data)}`, colors.green);
      results.push({ type: 'Welcome Email', status: 'success', data: welcomeResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Welcome email failed: ${error.response?.data?.message || error.message}`, colors.red);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
      }
      results.push({ type: 'Welcome Email', status: 'failed', error: error.message });
    }
    console.log('');

    // 5. Password Reset Email (via generic send)
    log('📋', '5. Sending Password Reset Email...', colors.yellow);
    try {
      const resetResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: 'Reset Your Password - SPANA',
        text: 'Hi Xoli,\n\nYou requested to reset your password. Click this link to reset: https://spana.co.za/reset?token=test_reset_token_12345\n\nThis link expires in 1 hour.\n\nIf you didn\'t request this, please ignore this email.\n\nThanks,\nThe SPANA Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
            <div style="background: #000000; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Reset Your Password</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #000000; margin-top: 0;">Hello Xoli!</h2>
              <p style="color: #333333; line-height: 1.6; font-size: 16px;">
                You requested to reset your password. Click the button below to create a new password.
              </p>
              <p style="color: #333333; line-height: 1.6; font-size: 16px;">
                This link will expire in 1 hour for your security.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://spana.co.za/reset?token=test_reset_token_12345" style="background: #000000; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; font-size: 16px;">
                  Reset Password
                </a>
              </div>
              <p style="color: #666666; font-size: 14px; text-align: center; margin-top: 30px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="https://spana.co.za/reset?token=test_reset_token_12345" style="color: #000000; word-break: break-all; text-decoration: underline;">https://spana.co.za/reset?token=test_reset_token_12345</a>
              </p>
              <p style="color: #333333; font-size: 14px; text-align: center; margin-top: 20px;">
                If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999999; font-size: 12px;">
              <p>© ${new Date().getFullYear()} SPANA. All rights reserved.</p>
            </div>
          </div>
        `,
        type: 'password_reset',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Password reset email sent: ${JSON.stringify(resetResponse.data)}`, colors.green);
      results.push({ type: 'Password Reset', status: 'success', data: resetResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Password reset email failed: ${error.response?.data?.message || error.message}`, colors.red);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
      }
      results.push({ type: 'Password Reset', status: 'failed', error: error.message });
    }
    console.log('');

    // 6. Invoice Email (via generic send)
    log('📋', '6. Sending Invoice Email...', colors.yellow);
    try {
      const invoiceResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: 'Invoice SPANA-INV-000001 - SPANA Service',
        text: 'Invoice SPANA-INV-000001\n\nBooking: SPANA-BK-000001\nService: Plumbing Service\nAmount: 650.00 ZAR\nDate: 2026-01-19',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
            <div style="background: #000000; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Invoice</h1>
              <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 18px;">SPANA-INV-000001</p>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0;">Hello Xoli!</h2>
              <p style="color: #666; line-height: 1.6; font-size: 16px;">
                Thank you for your payment. Please find your invoice details below.
              </p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666;"><strong>Booking ID:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #333;">SPANA-BK-000001</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #333;">Plumbing Service</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;"><strong>Job Size:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #333;">Medium</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;"><strong>Base Price:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #333;">500.00 ZAR</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;"><strong>Multiplier:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #333;">1.3x</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;"><strong>Tip:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #000000;">+50.00 ZAR</td>
                  </tr>
                  <tr style="border-top: 2px solid #000000; margin-top: 10px;">
                    <td style="padding: 12px 0; color: #000000; font-size: 18px;"><strong>Total Amount:</strong></td>
                    <td style="padding: 12px 0; text-align: right; color: #000000; font-size: 20px; font-weight: bold;">650.00 ZAR</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;"><strong>Transaction ID:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #333; font-size: 12px;">TXN-123456789</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #333;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
              </div>
              <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
                This is an automated invoice. Please keep this for your records.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>© ${new Date().getFullYear()} SPANA. All rights reserved.</p>
            </div>
          </div>
        `,
        type: 'invoice',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Invoice email sent: ${JSON.stringify(invoiceResponse.data)}`, colors.green);
      results.push({ type: 'Invoice Email', status: 'success', data: invoiceResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Invoice email failed: ${error.response?.data?.message || error.message}`, colors.red);
      if (error.response?.data) {
        log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
      }
      results.push({ type: 'Invoice Email', status: 'failed', error: error.message });
    }
    console.log('');

    // Summary
    console.log(`${colors.magenta}════════════════════════════════════════${colors.reset}`);
    log('✅', 'ALL EMAIL TESTS COMPLETED!', colors.green);
    console.log(`${colors.magenta}════════════════════════════════════════${colors.reset}\n`);

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    log('📊', `Summary: ${successCount} sent, ${failedCount} failed`, colors.cyan);
    console.log('\n📧 Check your email inbox at:', colors.cyan, TEST_EMAIL, colors.reset);
    console.log('\n📋 Email Types Sent:');
    results.forEach(result => {
      const icon = result.status === 'success' ? '✅' : '❌';
      const color = result.status === 'success' ? colors.green : colors.red;
      console.log(`   ${icon} ${result.type}`);
      if (result.data?.messageId) {
        console.log(`      Message ID: ${result.data.messageId}`);
      }
    });
    console.log('');

  } catch (error: any) {
    log('❌', `Test failed: ${error.message}`, colors.red);
    if (error.response?.data) {
      log('  ℹ️', `Details: ${JSON.stringify(error.response.data)}`, colors.gray);
    }
  }
}

// Run tests
testAllEmailTypes().catch(console.error);
