/**
 * Test script to verify provider login credentials on hosted server
 */

import axios from 'axios';

const PRODUCTION_URL = 'https://spana-server-5bhu.onrender.com';
const TEST_EMAIL = 'eksnxiweni@gmail.com';
const TEST_PASSWORD = 'G3SHCWYeGd^q';

async function testProviderLogin() {
  console.log('🧪 Testing Provider Login Credentials\n');
  console.log('='.repeat(60));
  console.log(`Server: ${PRODUCTION_URL}`);
  console.log(`Email: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD.substring(0, 4)}...\n`);

  try {
    // Test 1: Check if server is reachable
    console.log('📋 Step 1: Checking server health...');
    try {
      const healthResponse = await axios.get(`${PRODUCTION_URL}/health`, {
        timeout: 10000
      });
      console.log('   ✅ Server is reachable');
      console.log(`   Status: ${healthResponse.status}`);
      if (healthResponse.data) {
        console.log(`   Response: ${JSON.stringify(healthResponse.data)}`);
      }
    } catch (healthError: any) {
      console.log('   ⚠️  Health check failed:', healthError.message);
      console.log('   Continuing with login test anyway...\n');
    }

    // Test 2: Attempt login
    console.log('\n📋 Step 2: Attempting login...');
    const loginResponse = await axios.post(
      `${PRODUCTION_URL}/auth/login`,
      {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000,
        validateStatus: () => true // Don't throw on any status
      }
    );

    console.log(`   Status Code: ${loginResponse.status}`);
    console.log(`   Response:`, JSON.stringify(loginResponse.data, null, 2));

    // Analyze response
    if (loginResponse.status === 200) {
      if (loginResponse.data.token) {
        console.log('\n✅ LOGIN SUCCESSFUL!');
        console.log(`   Token received: ${loginResponse.data.token.substring(0, 20)}...`);
        console.log(`   User ID: ${loginResponse.data.user?.id || loginResponse.data.user?._id || 'N/A'}`);
        console.log(`   Role: ${loginResponse.data.user?.role || 'N/A'}`);
        console.log(`   Email: ${loginResponse.data.user?.email || 'N/A'}`);
        console.log(`   Name: ${loginResponse.data.user?.firstName || ''} ${loginResponse.data.user?.lastName || ''}`.trim() || 'N/A');
        
        if (loginResponse.data.requiresOTP) {
          console.log('\n⚠️  Note: This account requires OTP verification (admin account)');
          console.log(`   OTP: ${loginResponse.data.otp || 'Check email'}`);
        }
      } else if (loginResponse.data.requiresOTP) {
        console.log('\n⚠️  LOGIN REQUIRES OTP VERIFICATION');
        console.log('   This appears to be an admin account');
        console.log(`   OTP: ${loginResponse.data.otp || 'Check email'}`);
        console.log(`   Verification Link: ${loginResponse.data.verificationLink || 'N/A'}`);
      } else {
        console.log('\n⚠️  Login returned 200 but no token received');
        console.log('   Response:', loginResponse.data);
      }
    } else if (loginResponse.status === 400) {
      console.log('\n❌ LOGIN FAILED');
      console.log(`   Reason: ${loginResponse.data.message || loginResponse.data.error || 'Invalid credentials'}`);
      
      if (loginResponse.data.message?.includes('Invalid credentials')) {
        console.log('\n💡 Possible issues:');
        console.log('   1. Password is incorrect');
        console.log('   2. Email does not exist');
        console.log('   3. Account may not be activated');
      }
    } else if (loginResponse.status === 401) {
      console.log('\n❌ LOGIN FAILED - Unauthorized');
      console.log(`   Reason: ${loginResponse.data.message || 'Authentication failed'}`);
    } else {
      console.log('\n❌ LOGIN FAILED');
      console.log(`   Status: ${loginResponse.status}`);
      console.log(`   Reason: ${loginResponse.data.message || loginResponse.data.error || 'Unknown error'}`);
    }

    // Test 3: If login successful, test token validity
    if (loginResponse.status === 200 && loginResponse.data.token && !loginResponse.data.requiresOTP) {
      console.log('\n📋 Step 3: Testing token validity...');
      try {
        const meResponse = await axios.get(
          `${PRODUCTION_URL}/auth/me`,
          {
            headers: {
              'Authorization': `Bearer ${loginResponse.data.token}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        if (meResponse.status === 200) {
          console.log('   ✅ Token is valid');
          console.log(`   User Profile:`, JSON.stringify(meResponse.data, null, 2));
        }
      } catch (tokenError: any) {
        console.log('   ❌ Token validation failed:', tokenError.message);
        if (tokenError.response) {
          console.log(`   Status: ${tokenError.response.status}`);
          console.log(`   Response:`, tokenError.response.data);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test Complete\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received from server');
      console.error('   Error:', error.message);
      console.error('\n💡 Possible issues:');
      console.error('   1. Server is down or unreachable');
      console.error('   2. Network connectivity issue');
      console.error('   3. Server is still deploying');
    } else {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testProviderLogin().catch(console.error);
