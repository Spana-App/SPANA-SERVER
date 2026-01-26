const axios = require('axios');
require('dotenv').config();

async function testAdminRegisterProvider() {
  try {
    console.log('\n📝 Testing Admin Service Provider Registration\n');
    console.log('='.repeat(60));

    const baseUrl = process.env.EXTERNAL_API_URL || 'http://localhost:5003';
    const testEmail = 'eksnxiweni@gmail.com';

    // Step 1: Login as admin to get token
    console.log('\n1️⃣ Logging in as admin...');
    const loginResponse = await axios.post(`${baseUrl}/auth/login`, {
      email: 'xoli@spana.co.za',
      password: 'TestPassword@123!'
    });

    if (loginResponse.data.requiresOTP) {
      console.log('⚠️  Admin login requires OTP');
      console.log('OTP:', loginResponse.data.otp);
      console.log('Verification Link:', loginResponse.data.verificationLink);
      
      // For testing, we'll use the OTP from response
      const otp = loginResponse.data.otp;
      console.log(`\n2️⃣ Verifying OTP: ${otp}...`);
      
      const otpResponse = await axios.post(`${baseUrl}/admin/otp/verify`, {
        email: 'xoli@spana.co.za',
        otp: otp
      });

      if (!otpResponse.data.token) {
        console.error('❌ OTP verification failed');
        console.log('Response:', otpResponse.data);
        return;
      }

      var adminToken = otpResponse.data.token;
      console.log('✅ Admin authenticated successfully\n');
    } else if (loginResponse.data.token) {
      var adminToken = loginResponse.data.token;
      console.log('✅ Admin logged in successfully\n');
    } else {
      console.error('❌ Admin login failed');
      console.log('Response:', loginResponse.data);
      return;
    }

    // Step 2: Delete existing user if exists (for clean test)
    console.log('3️⃣ Checking if test user already exists...');
    try {
      // Try to find user first
      const findUserResponse = await axios.get(
        `${baseUrl}/users?email=${encodeURIComponent(testEmail)}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` }
        }
      );
      
      if (findUserResponse.data && findUserResponse.data.length > 0) {
        const userId = findUserResponse.data[0].id;
        console.log(`   Found existing user: ${userId}`);
        console.log('   Deleting existing user...');
        
        await axios.delete(`${baseUrl}/users/${userId}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('   ✅ Deleted existing user\n');
      } else {
        console.log('   ✅ No existing user found\n');
      }
    } catch (e) {
      if (e.response && e.response.status === 404) {
        console.log('   ✅ No existing user found\n');
      } else {
        console.log('   ⚠️  Could not check/delete existing user (continuing anyway)\n');
      }
    }

    // Step 3: Register service provider via admin endpoint
    console.log('4️⃣ Registering service provider via admin endpoint...');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Name: Test Provider`);
    
    const registerResponse = await axios.post(
      `${baseUrl}/admin/providers/register`,
      {
        firstName: 'Test',
        lastName: 'Provider',
        email: testEmail,
        phone: '+27123456789'
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (registerResponse.status === 201) {
      console.log('\n✅ Service provider registered successfully!\n');
      console.log('📋 Registration Details:');
      console.log('   User ID:', registerResponse.data.user.id);
      console.log('   Email:', registerResponse.data.user.email);
      console.log('   Name:', registerResponse.data.user.firstName, registerResponse.data.user.lastName);
      console.log('   Role:', registerResponse.data.user.role);
      console.log('   Reference Number:', registerResponse.data.user.referenceNumber);
      console.log('\n📧 Email Information:');
      console.log('   Profile Completion Link:', registerResponse.data.profileCompletionLink);
      console.log('\n📬 Check your inbox:');
      console.log(`   Email: ${testEmail}`);
      console.log('   Subject: Welcome to SPANA, Test Provider! 🎉');
      console.log('   From: onboarding@resend.dev');
      console.log('   Should contain "Complete Profile" button\n');
      
      console.log('✅ Registration complete!');
      console.log('   Provider will receive email with profile completion link');
      console.log('   Provider can set their password and complete profile\n');
    } else {
      console.error('❌ Registration failed');
      console.log('Response:', registerResponse.data);
    }
  } catch (error) {
    if (error.response) {
      console.error('\n❌ Error (Status:', error.response.status, ')\n');
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 400 && error.response.data.message?.includes('already exists')) {
        console.log('\n💡 User already exists. Delete the user first or use a different email.\n');
      }
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testAdminRegisterProvider();
