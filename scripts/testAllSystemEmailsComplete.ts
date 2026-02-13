/**
 * Test ALL System Emails
 * Comprehensive test that sends ALL email types used in the SPANA system
 * - Customer emails
 * - Service Provider emails (including credentials)
 * - Admin emails
 * - Booking emails
 * - Payment emails
 */

// Load environment variables
require('dotenv').config();

import axios from 'axios';

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3000';
const API_SECRET = process.env.EMAIL_SERVICE_SECRET || process.env.API_SECRET;
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
  console.log(`${colors.gray}Email Service: ${EMAIL_SERVICE_URL}${colors.reset}`);
  console.log(`${colors.gray}Test Email: ${TEST_EMAIL}${colors.reset}\n`);

  const results: any[] = [];

  try {
    // 1. Health Check
    log('📋', '1. Health Check...', colors.yellow);
    try {
      const healthResponse = await axios.get(`${EMAIL_SERVICE_URL}/api/health`, { timeout: 5000 });
      log('  ✅', `Service healthy`, colors.green);
      results.push({ type: 'Health Check', status: 'success', data: healthResponse.data });
    } catch (error: any) {
      log('  ❌', `Health check failed: ${error.message}`, colors.red);
      return;
    }
    console.log('');

    // ==================== ADMIN EMAILS ====================
    log('👑', 'ADMIN EMAILS', colors.magenta);
    console.log('');

    // 2. Admin OTP Email
    log('📋', '2. Admin OTP Email...', colors.yellow);
    try {
      const otpResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/otp`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        otp: '123456',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${otpResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Admin OTP', status: 'success', data: otpResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Admin OTP', status: 'failed', error: error.message });
    }
    console.log('');

    // ==================== CUSTOMER EMAILS ====================
    log('👤', 'CUSTOMER EMAILS', colors.magenta);
    console.log('');

    // 3. Customer Welcome Email
    log('📋', '3. Customer Welcome Email...', colors.yellow);
    try {
      const welcomeCustomerResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/welcome`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        role: 'customer',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${welcomeCustomerResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Customer Welcome', status: 'success', data: welcomeCustomerResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Customer Welcome', status: 'failed', error: error.message });
    }
    console.log('');

    // 4. Customer Email Verification
    log('📋', '4. Customer Email Verification...', colors.yellow);
    try {
      const verificationResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/verification`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        verificationLink: 'https://spana.co.za/verify?token=customer_verification_token_12345',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${verificationResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Customer Email Verification', status: 'success', data: verificationResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Customer Email Verification', status: 'failed', error: error.message });
    }
    console.log('');

    // 5. Customer Password Reset
    log('📋', '5. Customer Password Reset...', colors.yellow);
    try {
      const resetResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: 'Reset Your Password - SPANA Customer Account',
        text: 'Hi Xoli,\n\nYou requested to reset your SPANA customer account password.\n\nClick this link to create a new password: https://spana.co.za/reset?token=customer_reset_token_12345\n\nThis link expires in 1 hour for your security.\n\nIf you didn\'t request this password reset, please secure your account immediately by contacting our support team.\n\nThanks,\nThe SPANA Security Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F5F5;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔒 Reset Your Password</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">SPANA Customer Account</p>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #0066CC; border-radius: 0 0 10px 10px;">
              <p style="color: #000000; font-size: 16px;">Hello Xoli,</p>
              <p style="color: #000000;">You've requested to reset your SPANA customer account password. Click the button below to create a new secure password.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://spana.co.za/reset?token=customer_reset_token_12345" style="background: #0066CC; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset My Password</a>
              </div>
              
              <div style="background: #FFF3CD; border-left: 4px solid #FFA500; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #856404; margin: 0; font-size: 14px;"><strong>⏰ Security Notice:</strong><br>• This link expires in <strong>1 hour</strong><br>• For your security, use a strong, unique password<br>• Never share your password with anyone</p>
              </div>
              
              <p style="color: #000000; margin-top: 20px;">If you didn't request this password reset, please secure your account immediately by contacting our security team at security@spana.co.za</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Stay secure,<br><strong>The SPANA Security Team</strong></p>
            </div>
          </div>
        `,
        type: 'customer_password_reset',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${resetResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Customer Password Reset', status: 'success', data: resetResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Customer Password Reset', status: 'failed', error: error.message });
    }
    console.log('');

    // ==================== SERVICE PROVIDER EMAILS ====================
    log('🔧', 'SERVICE PROVIDER EMAILS', colors.magenta);
    console.log('');

    // 6. Service Provider Welcome Email
    log('📋', '6. Service Provider Welcome Email...', colors.yellow);
    try {
      const welcomeProviderResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/welcome`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        role: 'service_provider',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${welcomeProviderResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Service Provider Welcome', status: 'success', data: welcomeProviderResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Service Provider Welcome', status: 'failed', error: error.message });
    }
    console.log('');

    // 7. Service Provider Credentials Email (NEW - CMS Registration)
    log('📋', '7. Service Provider Credentials Email (CMS Registration)...', colors.yellow);
    try {
      const credentialsResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/provider-credentials`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        email: 'provider@spana.co.za',
        password: 'TempPassword@123',
        appDownloadLink: 'https://spana.co.za/download',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${credentialsResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Service Provider Credentials', status: 'success', data: credentialsResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Service Provider Credentials', status: 'failed', error: error.message });
    }
    console.log('');

    // 8. Service Provider Email Verification
    log('📋', '8. Service Provider Email Verification...', colors.yellow);
    try {
      const providerVerificationResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/verification`, {
        to: TEST_EMAIL,
        name: 'Xoli',
        verificationLink: 'https://spana.co.za/verify?token=provider_verification_token_12345',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${providerVerificationResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Service Provider Email Verification', status: 'success', data: providerVerificationResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Service Provider Email Verification', status: 'failed', error: error.message });
    }
    console.log('');

    // 9. Service Provider Password Reset
    log('📋', '9. Service Provider Password Reset...', colors.yellow);
    try {
      const providerResetResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: 'Reset Your Password - SPANA Service Provider Account',
        text: 'Hi Xoli,\n\nYou requested to reset your SPANA service provider account password.\n\nClick this link to create a new password: https://app.spana.co.za/reset?token=provider_reset_token_12345\n\nThis link expires in 1 hour for your security.\n\nIf you didn\'t request this password reset, please secure your account immediately.\n\nThanks,\nThe SPANA Security Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F5F5;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔒 Reset Your Password</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">SPANA Service Provider Account</p>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #0066CC; border-radius: 0 0 10px 10px;">
              <p style="color: #000000; font-size: 16px;">Hello Xoli,</p>
              <p style="color: #000000;">You've requested to reset your SPANA service provider account password. This will not affect your bookings or earnings.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.spana.co.za/reset?token=provider_reset_token_12345" style="background: #0066CC; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset My Password</a>
              </div>
              
              <div style="background: #FFF3CD; border-left: 4px solid #FFA500; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #856404; margin: 0; font-size: 14px;"><strong>⏰ Security Notice:</strong><br>• This link expires in <strong>1 hour</strong><br>• Use a strong password to protect your earnings<br>• Never share your password with anyone</p>
              </div>
              
              <p style="color: #000000; margin-top: 20px;">If you didn't request this password reset, please secure your account immediately by contacting security@spana.co.za</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Stay secure,<br><strong>The SPANA Security Team</strong></p>
            </div>
          </div>
        `,
        type: 'provider_password_reset',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${providerResetResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Service Provider Password Reset', status: 'success', data: providerResetResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Service Provider Password Reset', status: 'failed', error: error.message });
    }
    console.log('');

    // ==================== BOOKING EMAILS ====================
    log('📅', 'BOOKING EMAILS', colors.magenta);
    console.log('');

    // 10. Booking Confirmation (Customer)
    log('📋', '10. Booking Confirmation (Customer)...', colors.yellow);
    try {
      const bookingConfirmationResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: 'Booking Confirmed - SPANA',
        text: 'Hi Xoli,\n\nYour booking has been confirmed!\n\nBooking ID: SPANA-BK-000001\nService: Plumbing Service\nDate: 2026-01-20 at 10:00 AM\nLocation: Sandton\n\nYou will receive updates about your booking.\n\nThanks,\nThe SPANA Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Booking Confirmed! ✅</h1>
            </div>
            <div style="background: #F5F5F5; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
              <h2 style="color: #000000; margin-top: 0;">Hello Xoli!</h2>
              <p>Your booking has been confirmed. Here are the details:</p>
              <div style="background: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
                <p><strong>Booking ID:</strong> SPANA-BK-000001</p>
                <p><strong>Service:</strong> Plumbing Service</p>
                <p><strong>Date:</strong> January 20, 2026 at 10:00 AM</p>
                <p><strong>Location:</strong> Sandton</p>
              </div>
              <p>You will receive updates about your booking as it progresses.</p>
            </div>
          </div>
        `,
        type: 'booking_confirmation_customer',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${bookingConfirmationResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Booking Confirmation (Customer)', status: 'success', data: bookingConfirmationResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Booking Confirmation (Customer)', status: 'failed', error: error.message });
    }
    console.log('');

    // 11. New Booking Request (Provider)
    log('📋', '11. New Booking Request (Provider)...', colors.yellow);
    try {
      const newBookingResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: '💰 New Booking Request - Earn R 585.00 - SPANA-BK-000001',
        text: 'Hi Xoli,\n\nYou have a new booking request!\n\n📋 BOOKING DETAILS:\nBooking ID: SPANA-BK-000001\nService: Emergency Plumbing Repair\nCustomer: John Doe ⭐ 4.9\nDate: January 20, 2026 at 10:00 AM\nLocation: 123 Main Street, Sandton (2.5 km away)\nDuration: ~2 hours\nJob Size: Medium\n\n💰 EARNINGS:\nTotal Service Fee: R 650.00\nYour Earnings (90%): R 585.00\nCommission (10%): R 65.00\n\n⚡ Action Required: Accept or decline within 10 minutes.\n\nThanks,\nThe SPANA Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F5F5;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔔 New Booking Request!</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">Earn R 585.00</p>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #0066CC; border-radius: 0 0 10px 10px;">
              <p style="color: #000000; font-size: 16px;">Hello Xoli,</p>
              <p style="color: #000000;">You have a new booking request! A customer needs your services.</p>
              
              <div style="background: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
                <h3 style="color: #0066CC; margin-top: 0;">📋 Job Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Booking ID:</strong></td><td style="text-align: right; color: #0066CC; font-weight: bold;">SPANA-BK-000001</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Service:</strong></td><td style="text-align: right; color: #000000;">Emergency Plumbing Repair</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Customer:</strong></td><td style="text-align: right; color: #000000;">John Doe ⭐ 4.9</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Date & Time:</strong></td><td style="text-align: right; color: #000000;">January 20, 2026 at 10:00 AM</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Location:</strong></td><td style="text-align: right; color: #000000;">123 Main Street, Sandton</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Distance:</strong></td><td style="text-align: right; color: #4CAF50;">2.5 km away</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Duration:</strong></td><td style="text-align: right; color: #000000;">~2 hours</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Job Size:</strong></td><td style="text-align: right; color: #000000;">Medium</td></tr>
                </table>
              </div>
              
              <div style="background: #E8F5E9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <h3 style="color: #2E7D32; margin-top: 0;">💰 Your Earnings</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #2E7D32;"><strong>Total Service Fee:</strong></td><td style="text-align: right; color: #2E7D32;">R 650.00</td></tr>
                  <tr><td style="padding: 8px 0; color: #2E7D32;"><strong>Platform Commission (10%):</strong></td><td style="text-align: right; color: #666;">- R 65.00</td></tr>
                  <tr style="border-top: 2px solid #4CAF50;"><td style="padding: 12px 0; font-size: 18px; color: #2E7D32;"><strong>Your Earnings:</strong></td><td style="text-align: right; font-size: 20px; font-weight: bold; color: #2E7D32;">R 585.00</td></tr>
                </table>
                <p style="color: #2E7D32; font-size: 14px; margin-top: 15px; margin-bottom: 0;"><strong>💵 Payment:</strong> Funds are secured in escrow. Payment will be released to your wallet after service completion.</p>
              </div>
              
              <div style="background: #FFF3CD; border-left: 4px solid #FFA500; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #856404; margin: 0; font-size: 14px;"><strong>⚡ Action Required:</strong> Please accept or decline this booking within <strong>10 minutes</strong> in the SPANA app. The customer is waiting!</p>
              </div>
              
              <p style="color: #000000; margin-top: 20px;">Open the SPANA app to view full details and accept this booking.</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Best regards,<br><strong>The SPANA Team</strong></p>
            </div>
          </div>
        `,
        type: 'new_booking_request_provider',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${newBookingResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'New Booking Request (Provider)', status: 'success', data: newBookingResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'New Booking Request (Provider)', status: 'failed', error: error.message });
    }
    console.log('');

    // 12. Booking Status Update (Provider En Route)
    log('📋', '12. Booking Status Update - Provider En Route (Customer)...', colors.yellow);
    try {
      const enRouteResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: '🚗 Your Provider is on the Way - SPANA-BK-000001',
        text: 'Hi Xoli,\n\nGreat news! Your service provider is on the way to your location.\n\n📋 BOOKING:\nBooking ID: SPANA-BK-000001\nService: Emergency Plumbing Repair\nProvider: John Plumbing Services ⭐ 4.8\n\n🚗 ARRIVAL:\nEstimated Arrival: 15 minutes\nCurrent Location: En route (tracking active)\n\n📱 Track their live location in the SPANA app!\n\nThanks,\nThe SPANA Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F5F5;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🚗 Provider on the Way!</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Estimated arrival in 15 minutes</p>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #0066CC; border-radius: 0 0 10px 10px;">
              <p style="color: #000000; font-size: 16px;">Hello Xoli,</p>
              <p style="color: #000000;">Great news! Your service provider has started their journey to your location and you can now track them in real-time.</p>
              
              <div style="background: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
                <h3 style="color: #0066CC; margin-top: 0;">📋 Service Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Booking ID:</strong></td><td style="text-align: right; color: #0066CC; font-weight: bold;">SPANA-BK-000001</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Service:</strong></td><td style="text-align: right; color: #000000;">Emergency Plumbing Repair</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Provider:</strong></td><td style="text-align: right; color: #000000;">John Plumbing Services ⭐ 4.8</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Location:</strong></td><td style="text-align: right; color: #000000;">123 Main Street, Sandton</td></tr>
                </table>
              </div>
              
              <div style="background: #E3F2FD; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066CC;">
                <h3 style="color: #0066CC; margin-top: 0;">🚗 Arrival Information</h3>
                <p style="color: #000000; font-size: 18px; margin: 10px 0;"><strong>Estimated Arrival:</strong> <span style="color: #0066CC; font-weight: bold;">15 minutes</span></p>
                <p style="color: #000000; font-size: 14px; margin: 5px 0;">🟢 Status: En route (tracking active)</p>
                <p style="color: #000000; font-size: 14px; margin: 5px 0;">📍 Current Location: Provider is traveling to your location</p>
              </div>
              
              <div style="background: #FFF3CD; border-left: 4px solid #FFA500; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #856404; margin: 0; font-size: 14px;"><strong>📱 Track Live Location:</strong> Open the SPANA app to see your provider's real-time location on the map. You'll receive notifications as they approach!</p>
              </div>
              
              <p style="color: #000000; margin-top: 20px;">Your provider will contact you when they're nearby. Please ensure someone is available at the location.</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Best regards,<br><strong>The SPANA Team</strong></p>
            </div>
          </div>
        `,
        type: 'booking_status_update_customer',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${enRouteResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Booking Status - Provider En Route', status: 'success', data: enRouteResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Booking Status - Provider En Route', status: 'failed', error: error.message });
    }
    console.log('');

    // 13. Booking Completed (Customer & Provider)
    log('📋', '13. Booking Completed (Customer)...', colors.yellow);
    try {
      const completedCustomerResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: '✅ Service Completed - Please Rate Your Experience - SPANA-BK-000001',
        text: 'Hi Xoli,\n\nYour service has been completed successfully!\n\n📋 COMPLETED SERVICE:\nBooking ID: SPANA-BK-000001\nService: Emergency Plumbing Repair\nProvider: John Plumbing Services ⭐ 4.8\nDate Completed: January 20, 2026 at 11:45 AM\nDuration: 1 hour 45 minutes\nTotal Paid: R 650.00\n\n⭐ Help your provider by rating them in the SPANA app! Your feedback helps other customers and improves the platform.\n\nThanks for choosing SPANA!\nThe SPANA Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F5F5;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">✅ Service Completed!</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Thank you for choosing SPANA</p>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #0066CC; border-radius: 0 0 10px 10px;">
              <p style="color: #000000; font-size: 16px;">Hello Xoli,</p>
              <p style="color: #000000;">Great news! Your service has been completed successfully. We hope you're satisfied with the work.</p>
              
              <div style="background: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
                <h3 style="color: #0066CC; margin-top: 0;">📋 Service Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Booking ID:</strong></td><td style="text-align: right; color: #0066CC; font-weight: bold;">SPANA-BK-000001</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Service:</strong></td><td style="text-align: right; color: #000000;">Emergency Plumbing Repair</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Provider:</strong></td><td style="text-align: right; color: #000000;">John Plumbing Services ⭐ 4.8</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Date Completed:</strong></td><td style="text-align: right; color: #000000;">January 20, 2026 at 11:45 AM</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Duration:</strong></td><td style="text-align: right; color: #000000;">1 hour 45 minutes</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Total Amount:</strong></td><td style="text-align: right; color: #000000; font-weight: bold;">R 650.00</td></tr>
                </table>
              </div>
              
              <div style="background: #E8F5E9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <p style="color: #2E7D32; margin: 0; font-size: 16px;"><strong>💰 Payment Status:</strong> R 650.00 has been released from escrow to your provider. Your payment is complete.</p>
              </div>
              
              <div style="background: #FFF3CD; border-left: 4px solid #FFA500; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: center;">
                <p style="color: #856404; margin: 0; font-size: 18px;"><strong>⭐ Rate Your Experience</strong></p>
                <p style="color: #856404; margin: 10px 0 0 0; font-size: 14px;">Help your provider and other customers by sharing your experience! Your feedback helps improve the platform for everyone.</p>
                <p style="color: #856404; margin: 15px 0 0 0; font-size: 14px;">Open the SPANA app to rate and review your service provider.</p>
              </div>
              
              <p style="color: #000000; margin-top: 25px;">Need to book another service? Browse thousands of verified providers in the SPANA app!</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Thank you for choosing SPANA,<br><strong>The SPANA Team</strong></p>
            </div>
          </div>
        `,
        type: 'booking_completed_customer',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${completedCustomerResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Booking Completed (Customer)', status: 'success', data: completedCustomerResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Booking Completed (Customer)', status: 'failed', error: error.message });
    }
    console.log('');

    // ==================== PAYMENT EMAILS ====================
    log('💰', 'PAYMENT EMAILS', colors.magenta);
    console.log('');

    // 14. Invoice Email
    log('📋', '14. Invoice Email...', colors.yellow);
    try {
      const invoiceResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: 'Invoice SPANA-INV-000001 - SPANA Service',
        text: 'Invoice SPANA-INV-000001\n\nBooking: SPANA-BK-000001\nService: Plumbing Service\nAmount: 650.00 ZAR\nDate: 2026-01-19',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F5F5;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">📄 Invoice</h1>
              <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 18px; font-weight: bold;">SPANA-INV-000001</p>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">Date: January 20, 2026</p>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #0066CC; border-radius: 0 0 10px 10px;">
              <p style="color: #000000; font-size: 16px;">Hello Xoli,</p>
              <p style="color: #000000;">Please find your detailed invoice below for your completed service.</p>
              
              <div style="background: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
                <h3 style="color: #0066CC; margin-top: 0;">📋 Service Details</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Booking ID:</strong></td><td style="text-align: right; color: #0066CC; font-weight: bold;">SPANA-BK-000001</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Service:</strong></td><td style="text-align: right; color: #000000;">Emergency Plumbing Repair</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Provider:</strong></td><td style="text-align: right; color: #000000;">John Plumbing Services</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Service Date:</strong></td><td style="text-align: right; color: #000000;">January 20, 2026</td></tr>
                </table>
                
                <h3 style="color: #0066CC; margin-top: 20px;">💰 Payment Breakdown</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Base Service Price:</strong></td><td style="text-align: right; color: #000000;">R 500.00</td></tr>
                  <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">Location Multiplier (Sandton):</td><td style="text-align: right; color: #666; font-size: 14px;">1.3x</td></tr>
                  <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">Job Size (Medium):</td><td style="text-align: right; color: #666; font-size: 14px;">+ R 150.00</td></tr>
                  <tr><td style="padding: 8px 0; color: #4CAF50;"><strong>Customer Tip:</strong></td><td style="text-align: right; color: #4CAF50;">+ R 50.00</td></tr>
                  <tr style="border-top: 2px solid #0066CC; margin-top: 10px;"><td style="padding: 15px 0; font-size: 18px; color: #000000;"><strong>Total Amount:</strong></td><td style="text-align: right; font-size: 22px; font-weight: bold; color: #0066CC;">R 650.00</td></tr>
                </table>
              </div>
              
              <div style="background: #E8F5E9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <p style="color: #2E7D32; margin: 0; font-size: 14px;"><strong>✅ Payment Status:</strong> Paid and processed successfully via escrow.</p>
                <p style="color: #2E7D32; margin: 5px 0 0 0; font-size: 14px;">Payment Method: PayFast | Transaction ID: TXN-123456789</p>
              </div>
              
              <p style="color: #000000; margin-top: 25px;">This invoice has been saved to your account. You can view all your invoices in the SPANA app under "My Bookings".</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Thank you for choosing SPANA,<br><strong>The SPANA Team</strong></p>
            </div>
          </div>
        `,
        type: 'invoice',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${invoiceResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Invoice Email', status: 'success', data: invoiceResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Invoice Email', status: 'failed', error: error.message });
    }
    console.log('');

    // 15. Payment Receipt (Customer)
    log('📋', '15. Payment Receipt (Customer)...', colors.yellow);
    try {
      const receiptCustomerResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: '✅ Payment Receipt - R 650.00 Paid - SPANA-BK-000001',
        text: 'Hi Xoli,\n\nYour payment has been successfully processed!\n\n💰 PAYMENT DETAILS:\nAmount: R 650.00\nBooking ID: SPANA-BK-000001\nService: Emergency Plumbing Repair\nPayment Method: PayFast\nTransaction ID: TXN-123456789\nPayment Date: January 20, 2026 at 09:30 AM\n\n✅ Status: Payment secured in escrow until service completion.\n\nKeep this receipt for your records.\n\nThanks,\nThe SPANA Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F5F5;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">✅ Payment Receipt</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">R 650.00</p>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #0066CC; border-radius: 0 0 10px 10px;">
              <p style="color: #000000; font-size: 16px;">Hello Xoli,</p>
              <p style="color: #000000;">Your payment has been successfully processed and is securely held in escrow until your service is completed.</p>
              <div style="background: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
                <h3 style="color: #0066CC; margin-top: 0;">💰 Payment Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 10px 0; color: #000000;"><strong>Amount Paid:</strong></td><td style="text-align: right; color: #0066CC; font-size: 20px; font-weight: bold;">R 650.00</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Booking ID:</strong></td><td style="text-align: right; color: #0066CC; font-weight: bold;">SPANA-BK-000001</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Service:</strong></td><td style="text-align: right; color: #000000;">Emergency Plumbing Repair</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Payment Method:</strong></td><td style="text-align: right; color: #000000;">PayFast</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Transaction ID:</strong></td><td style="text-align: right; color: #666; font-size: 12px;">TXN-123456789</td></tr>
                  <tr><td style="padding: 8px 0; color: #000000;"><strong>Payment Date:</strong></td><td style="text-align: right; color: #000000;">January 20, 2026 at 09:30 AM</td></tr>
                </table>
              </div>
              <div style="background: #E3F2FD; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066CC;">
                <p style="color: #0066CC; margin: 0; font-size: 14px;"><strong>🔒 Escrow Protection:</strong> Your payment is securely held and will only be released after service completion.</p>
              </div>
              <p style="color: #000000; margin-top: 25px;">This receipt has been saved to your SPANA account. Keep it for your records.</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Thank you for choosing SPANA,<br><strong>The SPANA Team</strong></p>
            </div>
          </div>
        `,
        type: 'payment_receipt_customer',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${receiptCustomerResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Payment Receipt (Customer)', status: 'success', data: receiptCustomerResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Payment Receipt (Customer)', status: 'failed', error: error.message });
    }
    console.log('');

    // 16. Payment Receipt (Provider)
    log('📋', '16. Payment Receipt (Provider)...', colors.yellow);
    try {
      const receiptProviderResponse = await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: TEST_EMAIL,
        subject: '💰 Payment Payout Received - R 585.00 - SPANA-BK-000001',
        text: 'Hi Xoli,\n\nGreat news! Your payment has been released to your wallet!\n\n💰 PAYOUT DETAILS:\nPayout Amount: R 585.00\nBooking ID: SPANA-BK-000001\nService: Emergency Plumbing Repair\nTotal Service Fee: R 650.00\nPlatform Commission (10%): R 65.00\nTransaction ID: TXN-123456789\nRelease Date: January 20, 2026 at 11:50 AM\n\n✅ This amount has been added to your SPANA wallet balance.\n\nKeep earning!\nThe SPANA Team',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F5F5F5;">
            <div style="background: #0066CC; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">💰 Payment Received!</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">R 585.00</p>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #0066CC; border-radius: 0 0 10px 10px;">
              <p style="color: #000000; font-size: 16px;">Hello Xoli,</p>
              <p style="color: #000000;">Great news! Your payment has been processed and released from escrow to your SPANA wallet.</p>
              <div style="background: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
                <h3 style="color: #0066CC; margin-top: 0;">💰 Earnings Breakdown</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 10px 0; color: #000000;"><strong>Total Service Fee:</strong></td><td style="text-align: right; color: #000000;">R 650.00</td></tr>
                  <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">Platform Commission (10%):</td><td style="text-align: right; color: #666; font-size: 14px;">- R 65.00</td></tr>
                  <tr style="border-top: 2px solid #0066CC;"><td style="padding: 15px 0; font-size: 18px; color: #000000;"><strong>Your Earnings:</strong></td><td style="text-align: right; font-size: 22px; font-weight: bold; color: #4CAF50;">R 585.00</td></tr>
                </table>
              </div>
              <div style="background: #F5F5F5; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #0066CC;">
                <p style="color: #000000; margin: 5px 0;"><strong>Booking ID:</strong> <span style="color: #0066CC; font-weight: bold;">SPANA-BK-000001</span></p>
                <p style="color: #000000; margin: 5px 0;"><strong>Service:</strong> Emergency Plumbing Repair</p>
                <p style="color: #000000; margin: 5px 0;"><strong>Transaction ID:</strong> <span style="color: #666; font-size: 12px;">TXN-123456789</span></p>
                <p style="color: #000000; margin: 5px 0;"><strong>Release Date:</strong> January 20, 2026 at 11:50 AM</p>
              </div>
              <div style="background: #E8F5E9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <p style="color: #2E7D32; margin: 0; font-size: 14px;"><strong>✅ Wallet Updated:</strong> R 585.00 has been added to your SPANA wallet balance. You can withdraw funds anytime from the app!</p>
              </div>
              <p style="color: #000000; margin-top: 25px;">Keep providing excellent service to earn more! Your rating and reviews help you get more bookings.</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Keep earning,<br><strong>The SPANA Team</strong></p>
            </div>
          </div>
        `,
        type: 'payment_receipt_provider',
        apiSecret: API_SECRET
      }, { timeout: 10000 });
      log('  ✅', `Sent (Message ID: ${receiptProviderResponse.data.messageId?.substring(0, 20)}...)`, colors.green);
      results.push({ type: 'Payment Receipt (Provider)', status: 'success', data: receiptProviderResponse.data });
      await sleep(1000);
    } catch (error: any) {
      log('  ❌', `Failed: ${error.response?.data?.message || error.message}`, colors.red);
      results.push({ type: 'Payment Receipt (Provider)', status: 'failed', error: error.message });
    }
    console.log('');

    // Summary
    console.log(`${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
    log('✅', 'ALL SYSTEM EMAIL TESTS COMPLETED!', colors.green);
    console.log(`${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}\n`);

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    log('📊', `Summary: ${successCount} sent, ${failedCount} failed`, colors.cyan);
    console.log(`\n📧 Check your email inbox at: ${colors.cyan}${TEST_EMAIL}${colors.reset}\n`);

    console.log(`${colors.cyan}📋 EMAIL TYPES SENT:${colors.reset}\n`);
    results.forEach((result, index) => {
      const icon = result.status === 'success' ? '✅' : '❌';
      const color = result.status === 'success' ? colors.green : colors.red;
      console.log(`   ${index}. ${icon} ${result.type}`);
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
testAllSystemEmails().catch(console.error);
