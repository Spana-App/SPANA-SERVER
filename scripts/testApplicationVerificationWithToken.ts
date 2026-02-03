/**
 * Test script for the new application verification endpoint
 * Uses provided admin token directly
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5003'; // Force localhost for local testing
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNta2w3MGJ1ejAwMGE0ZWc0cDZ4eTJjNHoiLCJpYXQiOjE3NzAxMTQwNzMsImV4cCI6MTc3MDEzMjA3M30.qPrkyzZKsm9n2P_zT3RPR6Qej-n7tUSIOgyHq9uW3xw';

async function testApplicationVerificationFlow() {
  console.log('🧪 Testing Application Verification Flow\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    // Step 1: Create a test application
    const testEmail = `test-app-verification-${Date.now()}@example.com`;
    console.log(`📝 Step 1: Creating test application for ${testEmail}...`);
    
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

    // Step 2: Verify application and create provider account
    console.log('✅ Step 2: Verifying application and creating provider account...');
    const verifyAppResponse = await axios.post(
      `${BASE_URL}/admin/applications/${application.id}/verify`,
      {},
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`
        }
      }
    );
    console.log('✅ Application verified and provider account created\n');
    console.log('Response:', JSON.stringify(verifyAppResponse.data, null, 2));
    console.log('');

    // Step 3: Verify flags are set correctly
    console.log('🔍 Step 3: Verifying flags are set correctly...');
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

    // Step 4: Check application status
    const updatedApplication = await prisma.serviceProviderApplication.findUnique({
      where: { id: application.id }
    });

    if (updatedApplication?.status !== 'approved') {
      throw new Error(`Application status should be 'approved', got '${updatedApplication?.status}'`);
    }
    console.log(`✅ Application status updated to: ${updatedApplication.status}\n`);

    // Step 5: Test profile completion
    console.log('📋 Step 5: Testing profile completion flow...');
    const registrationToken = user.serviceProvider.verificationToken;
    if (!registrationToken) {
      throw new Error('Registration token not found');
    }

    console.log(`Registration link: ${BASE_URL}/complete-registration?token=${registrationToken}&uid=${user.id}\n`);

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

    // Step 6: Verify flags after profile completion
    console.log('🔍 Step 6: Verifying flags after profile completion...');
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

    // Show summary
    console.log('📊 Summary:');
    console.log(`   Application ID: ${application.id}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Provider ID: ${user.serviceProvider.id}`);
    console.log(`   Registration Token: ${registrationToken.substring(0, 20)}...`);
    console.log(`   Temporary Password: ${user.serviceProvider.temporaryPassword ? 'Set (will be sent via email)' : 'Not set'}`);
    console.log('');

    // Cleanup option
    console.log('💡 Note: Test data created. You can clean it up manually or let it remain for testing.\n');
    console.log('   To delete:');
    console.log(`   DELETE FROM users WHERE id = '${user.id}';`);
    console.log(`   DELETE FROM service_provider_applications WHERE id = '${application.id}';`);
    console.log('');

    console.log('🎉 All tests passed! Application verification flow is working correctly.\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testApplicationVerificationFlow();
