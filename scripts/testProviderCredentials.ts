/**
 * Test script for provider credentials email flow
 * Tests: Admin creates provider → Provider completes profile → Credentials email sent
 */

import axios from 'axios';
import prisma from '../lib/database';

// Force localhost for local testing
const BASE_URL = 'http://localhost:5003';
const TEST_EMAIL = 'test-provider-credentials@example.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'xoli@spana.co.za';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
// Accept token from environment or command line argument
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.argv[2] || '';

async function testProviderCredentialsFlow() {
  console.log('🧪 Testing Provider Credentials Flow\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Check if test user exists - skip to prevent accidental deletion
    console.log('\n📋 Step 1: Checking for existing test user...');
    const existing = await prisma.user.findUnique({
      where: { email: TEST_EMAIL.toLowerCase() }
    });
    if (existing) {
      console.log('   ⚠️  Test user already exists. Use a different email or skip this test.\n');
      return;
    }
    console.log('   ✅ No existing user found\n');

    // Step 2: Admin authentication
    console.log('📋 Step 2: Admin authentication...');
    let adminToken: string;

    // Option 1: Use provided token
    if (ADMIN_TOKEN) {
      adminToken = ADMIN_TOKEN;
      console.log('   ✅ Using ADMIN_TOKEN from environment\n');
    } else if (ADMIN_PASSWORD) {
      // Option 2: Login and handle OTP
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log('   Logging in...\n');

      const loginResponse = await axios.post(
        `${BASE_URL}/auth/login`,
        {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (loginResponse.data.requiresOTP) {
        console.log('   ⚠️  Admin login requires OTP verification');
        console.log(`   OTP: ${loginResponse.data.otp}`);
        console.log(`   Verification Link: ${loginResponse.data.verificationLink}\n`);
        
        const otp = loginResponse.data.otp;
        console.log(`   Verifying OTP: ${otp}...`);
        
        const otpResponse = await axios.post(
          `${BASE_URL}/admin/otp/verify`,
          {
            email: ADMIN_EMAIL,
            otp: otp
          }
        );

        if (!otpResponse.data.token) {
          throw new Error('OTP verification failed');
        }

        adminToken = otpResponse.data.token;
        console.log('   ✅ Admin authenticated successfully\n');
      } else if (loginResponse.data.token) {
        adminToken = loginResponse.data.token;
        console.log('   ✅ Admin logged in successfully\n');
      } else {
        throw new Error('Login failed - no token received');
      }
    } else {
      console.log('   ⚠️  No ADMIN_TOKEN or ADMIN_PASSWORD provided');
      console.log('   Set ADMIN_TOKEN or ADMIN_PASSWORD environment variable\n');
      throw new Error('Admin authentication required');
    }

    // Step 3: Register provider via admin endpoint
    console.log('📋 Step 3: Registering provider via admin endpoint...');
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log('   First Name: Test');
    console.log('   Last Name: Provider');
    console.log('   Phone: +27123456789\n');

    const registerResponse = await axios.post(
      `${BASE_URL}/admin/providers/register`,
      {
        firstName: 'Test',
        lastName: 'Provider',
        email: TEST_EMAIL,
        phone: '+27123456789'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    if (registerResponse.status !== 201) {
      throw new Error(`Registration failed: ${registerResponse.status}`);
    }

    console.log('   ✅ Provider registered successfully');
    console.log(`   User ID: ${registerResponse.data.user.id}`);
    console.log(`   Profile Completion Link: ${registerResponse.data.profileCompletionLink}\n`);

    // Step 4: Verify password was stored
    console.log('📋 Step 4: Verifying password was stored...');
    // Add small delay to ensure database write completes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const user = await prisma.user.findUnique({
      where: { email: TEST_EMAIL.toLowerCase() },
      include: { serviceProvider: true }
    });

    if (!user) {
      throw new Error('User not found after registration');
    }

    if (!user.serviceProvider) {
      throw new Error('ServiceProvider record not found');
    }

    console.log('   ServiceProvider record found');
    console.log(`   temporaryPassword field: ${user.serviceProvider.temporaryPassword ? 'EXISTS' : 'NULL'}`);
    
    if (!user.serviceProvider.temporaryPassword) {
      console.log('   ⚠️  Password was not stored in temporaryPassword field');
      console.log('   This might be a schema issue - checking database...');
      // Try to fetch raw data
      const rawProvider = await prisma.serviceProvider.findUnique({
        where: { userId: user.id },
        select: { temporaryPassword: true }
      });
      console.log(`   Raw temporaryPassword: ${rawProvider?.temporaryPassword || 'NULL'}`);
      throw new Error('Password was not stored in temporaryPassword field');
    }

    console.log('   ✅ Password stored successfully');
    console.log(`   Password length: ${user.serviceProvider.temporaryPassword.length} characters`);
    console.log(`   Password preview: ${user.serviceProvider.temporaryPassword.substring(0, 4)}...\n`);

    // Step 5: Complete profile (simulate form submission)
    console.log('📋 Step 5: Completing provider profile...');
    const profileCompletionLink = registerResponse.data.profileCompletionLink;
    const url = new URL(profileCompletionLink);
    const token = url.searchParams.get('token');
    const uid = url.searchParams.get('uid');

    if (!token || !uid) {
      throw new Error('Token or UID missing from profile completion link');
    }

    // First, access the form (GET request) to trigger lazy expiration
    console.log('   Accessing profile completion form...');
    const formResponse = await axios.get(profileCompletionLink);
    if (formResponse.status !== 200) {
      throw new Error(`Failed to access form: ${formResponse.status}`);
    }
    console.log('   ✅ Form accessed successfully');

    // Submit profile completion
    console.log('   Submitting profile...');
    const submitResponse = await axios.post(
      `${BASE_URL}/complete-registration`,
      {
        token,
        uid,
        firstName: 'Test',
        lastName: 'Provider',
        phone: '+27123456789',
        experienceYears: 5,
        skills: ['Plumbing', 'Electrical']
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (submitResponse.status !== 200) {
      throw new Error(`Profile completion failed: ${submitResponse.status}`);
    }

    console.log('   ✅ Profile completed successfully');
    console.log(`   Message: ${submitResponse.data.message}\n`);

    // Step 6: Verify password still exists (not cleared)
    console.log('📋 Step 6: Verifying password was NOT cleared...');
    const updatedUser = await prisma.user.findUnique({
      where: { email: TEST_EMAIL.toLowerCase() },
      include: { serviceProvider: true }
    });

    if (!updatedUser?.serviceProvider) {
      throw new Error('ServiceProvider record not found after profile completion');
    }

    if (!updatedUser.serviceProvider.temporaryPassword) {
      throw new Error('Password was cleared - it should remain until user changes it');
    }

    console.log('   ✅ Password still stored (permanent until user changes it)');
    console.log(`   Password: ${updatedUser.serviceProvider.temporaryPassword}\n`);

    // Step 7: Verify profile is complete
    console.log('📋 Step 7: Verifying profile completion status...');
    if (!updatedUser.serviceProvider.isProfileComplete) {
      throw new Error('Profile is not marked as complete');
    }
    if (!updatedUser.serviceProvider.isVerified) {
      throw new Error('Provider is not marked as verified');
    }
    console.log('   ✅ Profile is complete and verified\n');

    console.log('='.repeat(60));
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('Summary:');
    console.log(`- Provider registered: ${TEST_EMAIL}`);
    console.log('- Password generated and stored');
    console.log('- Profile completed successfully');
    console.log('- Password remains stored (permanent)');
    console.log('- Credentials email should have been sent\n');
    console.log('📧 Check the email inbox for:', TEST_EMAIL);
    console.log('   The email should contain:');
    console.log('   - Username (Email):', TEST_EMAIL);
    console.log('   - Password:', updatedUser.serviceProvider.temporaryPassword);
    console.log('   - Security recommendation to change password\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.message) {
      console.error(`   Error: ${error.message}`);
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testProviderCredentialsFlow().catch(console.error);
