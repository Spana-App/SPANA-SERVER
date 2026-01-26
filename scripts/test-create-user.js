/**
 * Test Unified User Creation
 * 
 * Tests the new unified user creation endpoint where admin selects role
 */

const axios = require('axios');
require('dotenv').config();

async function testCreateUser() {
  try {
    console.log('\n🔐 Step 1: Logging in as admin...\n');
    
    const baseUrl = process.env.TEST_API_URL || 'http://localhost:5003';
    
    // Login as existing admin
    const loginResponse = await axios.post(`${baseUrl}/auth/login`, {
      email: 'xoli@spana.co.za',
      password: 'TestPassword@123!'
    });

    let adminToken;
    
    if (loginResponse.data.requiresOTP) {
      console.log('📧 OTP required. OTP:', loginResponse.data.otp);
      console.log('Verifying OTP...\n');
      
      const otpResponse = await axios.post(`${baseUrl}/admin/otp/verify`, {
        email: 'xoli@spana.co.za',
        otp: loginResponse.data.otp
      });

      if (!otpResponse.data.token) {
        console.error('❌ OTP verification failed');
        return;
      }
      
      adminToken = otpResponse.data.token;
      console.log('✅ Admin authenticated\n');
    } else {
      adminToken = loginResponse.data.token;
      console.log('✅ Admin logged in\n');
    }

    // Test creating different user types
    const timestamp = Date.now();
    
    // Test 1: Create Admin
    console.log('👤 Test 1: Creating Admin user...\n');
    try {
      const adminResponse = await axios.post(
        `${baseUrl}/admin/users/create`,
        {
          firstName: 'Test',
          lastName: 'Admin',
          email: `admin-test-${timestamp}@gmail.com`,
          phone: '+27123456789',
          role: 'admin'
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (adminResponse.status === 201) {
        console.log('✅ Admin created successfully!');
        console.log('   Email:', adminResponse.data.user.email);
        console.log('   Password:', adminResponse.data.password);
        console.log('   📧 Credentials email sent!\n');
      }
    } catch (error) {
      console.error('❌ Admin creation failed:', error.response?.data?.message || error.message, '\n');
    }

    // Test 2: Create Customer
    console.log('👤 Test 2: Creating Customer user...\n');
    try {
      const customerResponse = await axios.post(
        `${baseUrl}/admin/users/create`,
        {
          firstName: 'Test',
          lastName: 'Customer',
          email: `customer-test-${timestamp}@example.com`,
          phone: '+27123456789',
          role: 'customer'
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (customerResponse.status === 201) {
        console.log('✅ Customer created successfully!');
        console.log('   Email:', customerResponse.data.user.email);
        console.log('   Password:', customerResponse.data.password);
        console.log('   📧 Welcome email sent!\n');
      }
    } catch (error) {
      console.error('❌ Customer creation failed:', error.response?.data?.message || error.message, '\n');
    }

    // Test 3: Create Service Provider
    console.log('👤 Test 3: Creating Service Provider user...\n');
    try {
      const providerResponse = await axios.post(
        `${baseUrl}/admin/users/create`,
        {
          firstName: 'Test',
          lastName: 'Provider',
          email: `provider-test-${timestamp}@example.com`,
          phone: '+27123456789',
          role: 'service_provider'
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (providerResponse.status === 201) {
        console.log('✅ Service Provider created successfully!');
        console.log('   Email:', providerResponse.data.user.email);
        console.log('   Profile Link:', providerResponse.data.profileCompletionLink);
        console.log('   📧 Welcome email sent!\n');
      }
    } catch (error) {
      console.error('❌ Service Provider creation failed:', error.response?.data?.message || error.message, '\n');
    }

    console.log('✅ All tests completed!\n');
  } catch (error) {
    if (error.response) {
      console.error('\n❌ Error (Status:', error.response.status, ')\n');
      if (error.response.data) {
        console.error('Response:', JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testCreateUser();
