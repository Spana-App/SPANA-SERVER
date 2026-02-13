/**
 * Test script for the new application verification endpoint
 * POST /admin/applications/:applicationId/verify
 * 
 * This tests the complete flow:
 * 1. Create a test application
 * 2. Admin verifies application (creates provider account)
 * 3. Verify flags are set correctly
 * 4. Complete registration
 * 5. Verify credentials email would be sent
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.EXTERNAL_API_URL || 'http://localhost:5003';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'xoli@spana.co.za';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

async function testApplicationVerificationFlow() {
  console.log('🧪 Testing Application Verification Flow\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    // Step 1: Admin OTP Login
    console.log('📧 Step 1: Requesting admin OTP...');
    const otpResponse = await axios.post(`${BASE_URL}/admin/otp/request`, {
      email: ADMIN_EMAIL
    });
    console.log('✅ OTP requested\n');

    // Get OTP from console or environment
    const OTP = process.env.ADMIN_OTP || process.argv[2];
    if (!OTP) {
      console.log('⚠️  Please provide OTP as environment variable ADMIN_OTP or as argument');
      console.log('   Example: ADMIN_OTP=123456 npx ts-node scripts/testApplicationVerification.ts');
      console.log('   Or: npx ts-node scripts/testApplicationVerification.ts 123456');
      return;
    }

    console.log('🔐 Step 2: Verifying OTP...');
    const verifyResponse = await axios.post(`${BASE_URL}/admin/otp/verify`, {
      email: ADMIN_EMAIL,
      otp: OTP
    });
    const adminToken = verifyResponse.data.token;
    console.log('✅ Admin authenticated\n');

    // Step 3: Create a test application
    const testEmail = `test-app-verification-${Date.now()}@example.com`;
    console.log(`📝 Step 3: Creating test application for ${testEmail}...`);
    
    const application = await prisma.serviceProviderApplication.create({
      data: {
        email: testEmail,
        firstName: 'Test',
        lastName: 'Provider',
        phone: '+27123456789',
        status: 'pending',
        skills: ['Plumbing', 'Electrical'],
        experienceYears: 5,
        motivation: 'Test application for verification flow'
      }
    });
    console.log(`✅ Application created: ${application.id}\n`);

    // Step 4: Verify application and create provider account
    console.log('✅ Step 4: Verifying application and creating provider account...');
    const verifyAppResponse = await axios.post(
      `${BASE_URL}/admin/applications/${application.id}/verify`,
      {},
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );
    console.log('✅ Application verified and provider account created\n');
    console.log('Response:', JSON.stringify(verifyAppResponse.data, null, 2));
    console.log('');

    // Step 5: Verify flags are set correctly
    console.log('🔍 Step 5: Verifying flags are set correctly...');
    const user = await prisma.user.findUnique({
      where: { email: testEmail.toLowerCase() },
      include: { serviceProvider: true }
    });

    if (!user) {
      throw new Error('User not found after verification');
    }

    if (!user.serviceProvider) {
      throw new Error('ServiceProvider not found after verification');
    }

    // Check flags
    const checks = [
      { name: 'isEmailVerified', expected: false, actual: user.isEmailVerified },
      { name: 'isPhoneVerified', expected: null, actual: user.isPhoneVerified },
      { name: 'isIdentityVerified', expected: true, actual: user.serviceProvider.isIdentityVerified },
      { name: 'isVerified', expected: true, actual: user.serviceProvider.isVerified },
      { name: 'temporaryPassword exists', expected: true, actual: !!user.serviceProvider.temporaryPassword }
    ];

    let allPassed = true;
    for (const check of checks) {
      const passed = check.actual === check.expected;
      const icon = passed ? '✅' : '❌';
      console.log(`${icon} ${check.name}: ${check.actual} (expected: ${check.expected})`);
      if (!passed) allPassed = false;
    }

    if (!allPassed) {
      throw new Error('Some verification flags are incorrect');
    }

    console.log('\n✅ All verification flags are correct!\n');

    // Step 6: Check application status
    const updatedApplication = await prisma.serviceProviderApplication.findUnique({
      where: { id: application.id }
    });

    if (updatedApplication?.status !== 'approved') {
      throw new Error(`Application status should be 'approved', got '${updatedApplication?.status}'`);
    }
    console.log(`✅ Application status updated to: ${updatedApplication.status}\n`);

    // Step 7: Test profile completion (simulate)
    console.log('📋 Step 7: Testing profile completion flow...');
    const registrationToken = user.serviceProvider.verificationToken;
    if (!registrationToken) {
      throw new Error('Registration token not found');
    }

    // Simulate profile completion
    const profileResponse = await axios.post(
      `${BASE_URL}/complete-registration`,
      {
        token: registrationToken,
        uid: user.id,
        experienceYears: 5,
        skills: ['Plumbing', 'Electrical', 'HVAC']
      }
    );
    console.log('✅ Profile completion successful\n');
    console.log('Response:', JSON.stringify(profileResponse.data, null, 2));
    console.log('');

    // Step 8: Verify flags after profile completion
    console.log('🔍 Step 8: Verifying flags after profile completion...');
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { serviceProvider: true }
    });

    if (!updatedUser) {
      throw new Error('User not found after profile completion');
    }

    const finalChecks = [
      { name: 'isEmailVerified', expected: true, actual: updatedUser.isEmailVerified },
      { name: 'isPhoneVerified', expected: null, actual: updatedUser.isPhoneVerified },
      { name: 'isIdentityVerified', expected: true, actual: updatedUser.serviceProvider.isIdentityVerified },
      { name: 'isVerified', expected: true, actual: updatedUser.serviceProvider.isVerified },
      { name: 'isProfileComplete', expected: true, actual: updatedUser.serviceProvider.isProfileComplete }
    ];

    allPassed = true;
    for (const check of finalChecks) {
      const passed = check.actual === check.expected;
      const icon = passed ? '✅' : '❌';
      console.log(`${icon} ${check.name}: ${check.actual} (expected: ${check.expected})`);
      if (!passed) allPassed = false;
    }

    if (!allPassed) {
      throw new Error('Some verification flags are incorrect after profile completion');
    }

    console.log('\n✅ All final verification flags are correct!\n');

    // Cleanup removed to prevent accidental data loss
    console.log('🧹 Test complete. (DB cleanup skipped - delete test data manually if needed)\n');

    console.log('🎉 All tests passed! Application verification flow is working correctly.\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testApplicationVerificationFlow();
