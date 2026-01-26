/**
 * Test Admin Registration (Admin creates another admin)
 * 
 * This script tests the admin-to-admin registration flow via CMS
 */

const axios = require('axios');
require('dotenv').config();

async function testAdminRegisterAdmin() {
  try {
    console.log('\n🔐 Step 1: Logging in as existing admin...\n');
    
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

    // Generate unique email for test
    const timestamp = Date.now();
    const testEmail = `admin-test-${timestamp}@gmail.com`;
    
    console.log('👤 Step 2: Creating new admin via CMS...\n');
    console.log(`   Email: ${testEmail}\n`);
    
    // Register new admin
    const registerResponse = await axios.post(
      `${baseUrl}/admin/admins/register`,
      {
        firstName: 'Test',
        lastName: 'Admin',
        email: testEmail,
        phone: '+27123456789',
        password: 'TestPassword123!'
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (registerResponse.status === 201) {
      console.log('✅ New admin created successfully!\n');
      console.log('📋 Details:');
      console.log('   User ID:', registerResponse.data.user.id);
      console.log('   Email:', registerResponse.data.user.email);
      console.log('   Name:', registerResponse.data.user.firstName, registerResponse.data.user.lastName);
      console.log('   Role:', registerResponse.data.user.role);
      console.log('\n📧 Verification email sent!');
      console.log(`   Check ${testEmail} for:`);
      console.log('   • Subject: Verify your provider account');
      console.log('   • From: noreply.spana@gmail.com');
      console.log('   • Contains: Email verification link');
      console.log('\n🔗 Verification Link:');
      console.log('   ', registerResponse.data.verificationLink, '\n');
      console.log('📝 Next Steps for New Admin:');
      console.log('   1. Check email and click verification link');
      console.log('   2. Login with email + password');
      console.log('   3. Receive OTP via email');
      console.log('   4. Verify OTP to get access token\n');
    } else {
      console.error('❌ Registration failed');
      console.log(registerResponse.data);
    }
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

testAdminRegisterAdmin();
