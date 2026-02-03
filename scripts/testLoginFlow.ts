/**
 * Test Complete Login Flow
 * Creates a user and immediately tests login
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5003';

async function testLoginFlow() {
  console.log('🧪 Testing Complete Login Flow\n');

  const testUser = {
    email: `test-login-${Date.now()}@test.com`,
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User',
    phone: '+27123456789',
    role: 'customer'
  };

  try {
    // Step 1: Register
    console.log('📝 Step 1: Registering user...');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Password: ${testUser.password}`);
    
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log(`   ✅ Registration successful: ${registerResponse.status}`);
    console.log(`   User ID: ${registerResponse.data.user?.id || 'N/A'}`);
    console.log(`   Message: ${registerResponse.data.message}\n`);

    // Step 2: Login with same credentials
    console.log('📝 Step 2: Logging in with same credentials...');
    
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });

    console.log(`   ✅ Login successful: ${loginResponse.status}`);
    console.log(`   Token: ${loginResponse.data.token?.substring(0, 30)}...`);
    console.log(`   User ID: ${loginResponse.data.user?.id}`);
    console.log(`   Role: ${loginResponse.data.user?.role}`);
    console.log(`   Email: ${loginResponse.data.user?.email}\n`);

    // Step 3: Use token to access protected route
    console.log('📝 Step 3: Testing token with /auth/me...');
    
    const meResponse = await axios.get(`${BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginResponse.data.token}`
      }
    });

    console.log(`   ✅ Token valid: ${meResponse.status}`);
    console.log(`   User: ${meResponse.data.firstName} ${meResponse.data.lastName}`);
    console.log(`   ID: ${meResponse.data.id}`);
    console.log(`   Email: ${meResponse.data.email}\n`);

    console.log('✅ All steps passed! Login flow is working correctly.');

  } catch (error: any) {
    if (error.response) {
      console.log(`   ❌ Request failed: ${error.response.status} ${error.response.statusText}`);
      console.log(`   Message: ${error.response.data?.message || error.response.data?.error || 'Unknown error'}`);
      console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

testLoginFlow();
